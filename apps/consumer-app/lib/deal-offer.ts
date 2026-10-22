import type { DealOffer, DealOfferStatus, DealOfferTerms } from "@nestyk/types";

/**
 * D2 (AC-2.1 to 2.4, round 1): the offer form, the same checks as the API, and which numbers of the reservation
 * letter and the lease an offer the landlord confirmed fixes (the API sets them whatever is typed).
 */
export type DealOfferForm = {
  monthlyRent: string;
  termMonths: string;
  startDate: string;
  depositAmount: string;
  contractDate: string;
  rentDueDay: string;
  graceDay: string;
  lateFeePerDay: string;
  renewalNoticeDays: string;
  coBroke: boolean;
  coBrokeAgentName: string;
};
export type DealOfferField = keyof DealOfferForm;
export type DealOfferIssue = "required" | "amount" | "date" | "day" | "months" | "notice" | "contractAfterStart" | "coBrokeName";

export const EMPTY_DEAL_OFFER_FORM: DealOfferForm = {
  monthlyRent: "",
  termMonths: "12",
  startDate: "",
  depositAmount: "",
  contractDate: "",
  rentDueDay: "",
  graceDay: "",
  lateFeePerDay: "",
  renewalNoticeDays: "",
  coBroke: false,
  coBrokeAgentName: "",
};
export const OPEN_DEAL_OFFER_STATUSES: readonly DealOfferStatus[] = ["draft", "awaiting_landlord", "confirmed"];

/** The lead's open offer for this room (one at most), or null. */
export function openDealOfferFor(offers: readonly DealOffer[], roomId: number | null | undefined) {
  return offers.find((offer) => offer.rentRoomId === roomId && OPEN_DEAL_OFFER_STATUSES.includes(offer.status)) ?? null;
}

export function dealOfferForm(offer: DealOffer): DealOfferForm {
  return {
    monthlyRent: offer.monthlyRent,
    termMonths: String(offer.termMonths),
    startDate: offer.startDate,
    depositAmount: offer.depositAmount,
    contractDate: offer.contractDate,
    rentDueDay: String(offer.rentDueDay),
    graceDay: offer.graceDay == null ? "" : String(offer.graceDay),
    lateFeePerDay: offer.lateFeePerDay ?? "",
    renewalNoticeDays: String(offer.renewalNoticeDays),
    coBroke: offer.coBroke,
    coBrokeAgentName: offer.coBrokeAgentName ?? "",
  };
}

const AMOUNT = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/;
const amountOf = (value: string) => Number(value.trim().replace(/,/g, ""));
function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
const whole = (value: string, min: number, max: number) =>
  /^\d{1,4}$/.test(value.trim()) && Number(value) >= min && Number(value) <= max;

/** The same rules as the API (deal-offers.service.ts validateDealOfferTerms). */
export function dealOfferIssues(form: DealOfferForm): Partial<Record<DealOfferField, DealOfferIssue>> {
  const out: Partial<Record<DealOfferField, DealOfferIssue>> = {};
  const money = (key: "monthlyRent" | "depositAmount" | "lateFeePerDay", required: boolean, positive: boolean) => {
    const value = form[key].trim();
    if (!value) {
      if (required) out[key] = "required";
      return;
    }
    if (!AMOUNT.test(value) || amountOf(value) >= 1e10 || (positive && amountOf(value) <= 0)) out[key] = "amount";
  };
  money("monthlyRent", true, true);
  money("depositAmount", true, false);
  money("lateFeePerDay", false, false);
  if (!form.termMonths.trim()) out.termMonths = "required";
  else if (!whole(form.termMonths, 1, 120)) out.termMonths = "months";
  for (const key of ["startDate", "contractDate"] as const) {
    if (!form[key].trim()) out[key] = "required";
    else if (!isDate(form[key].trim())) out[key] = "date";
  }
  if (!out.startDate && !out.contractDate && form.contractDate.trim() > form.startDate.trim()) out.contractDate = "contractAfterStart";
  if (!form.rentDueDay.trim()) out.rentDueDay = "required";
  else if (!whole(form.rentDueDay, 1, 31)) out.rentDueDay = "day";
  if (form.graceDay.trim() && !whole(form.graceDay, 1, 31)) out.graceDay = "day";
  if (form.renewalNoticeDays.trim() && !whole(form.renewalNoticeDays, 1, 365)) out.renewalNoticeDays = "notice";
  if (form.coBroke && (!form.coBrokeAgentName.trim() || form.coBrokeAgentName.trim().length > 120)) out.coBrokeAgentName = "coBrokeName";
  return out;
}

/** What the API takes; blanks become null (the API turns a blank notice period into 30 days). */
export function dealOfferBody(form: DealOfferForm): DealOfferTerms {
  const blank = (value: string) => (value.trim() ? value.trim() : null);
  return {
    monthlyRent: form.monthlyRent.trim(),
    termMonths: Number(form.termMonths),
    startDate: form.startDate.trim(),
    depositAmount: form.depositAmount.trim(),
    contractDate: form.contractDate.trim(),
    rentDueDay: Number(form.rentDueDay),
    graceDay: form.graceDay.trim() ? Number(form.graceDay) : null,
    lateFeePerDay: blank(form.lateFeePerDay),
    renewalNoticeDays: form.renewalNoticeDays.trim() ? Number(form.renewalNoticeDays) : null,
    coBroke: form.coBroke,
    coBrokeAgentName: form.coBroke ? form.coBrokeAgentName.trim() : null,
  };
}

/** True when the form differs from the saved offer (so it must be saved before sending or confirming). */
export function dealOfferDirty(form: DealOfferForm, offer: DealOffer | null) {
  if (!offer) return true;
  const saved = dealOfferForm(offer);
  return (Object.keys(saved) as DealOfferField[]).some((key) =>
    key === "coBrokeAgentName" && !form.coBroke ? false : String(form[key]).trim() !== String(saved[key]).trim());
}

/** Letter and lease fields an offer the landlord confirmed fixes (deal-offers.service.ts offerReservationFields). */
export const OFFER_RESERVATION_LOCKED_KEYS = [
  "monthlyRent", "termMonths", "termFrom", "termTo", "advanceMonths", "advanceAmount", "reservationPayment",
  "depositAmount", "depositMonths", "applyToAdvance", "applyToDeposit", "balanceDue",
] as const;
export const OFFER_LEASE_LOCKED_KEYS = [
  "monthlyRent", "termMonths", "termFrom", "termTo", "advanceMonths", "advanceAmount", "depositMonths",
  "depositAmount", "rentDueDay", "graceDay", "latePenalty",
] as const;
