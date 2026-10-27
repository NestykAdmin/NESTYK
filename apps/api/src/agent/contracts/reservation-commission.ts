import type { CommissionConfirmationInput, ReservationCommission, ReservationLetterInput } from "@nestyk/types";
import { COMMISSION_LIMITS } from "./commission-confirmation";
import { isIsoDate, leaseTermEnd, shiftIsoDate } from "./lease-term";

const DAY_MS = 86_400_000;
const daysInclusive = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
const cents = (value: number) => Math.round(value * 100);
const baht = (value: number) => String(value / 100);

/**
 * D13 (AC-3.7, Aof 26 Oct 2026): the landlord pays 1 month of rent for every full year of the lease; the part
 * after the full years (or the whole lease when shorter than a year) is rent × its days ÷ 365, both days counted,
 * rounded to whole baht with .5 up. A year is full when the lease reaches the day before the same date a year
 * later (so a 12-month lease with 29 February is still 1 month). Amounts are in baht, as plain numbers.
 */
export function commissionFor(monthlyRent: number, start: string, end: string) {
  if (!(monthlyRent > 0) || !isIsoDate(start) || !isIsoDate(end) || end < start) return null;
  let fullYears = 0;
  while (leaseTermEnd(start, 12 * (fullYears + 1)) <= end) fullYears++;
  const restFrom = fullYears ? shiftIsoDate(leaseTermEnd(start, 12 * fullYears), 1) : start;
  const restDays = restFrom <= end ? daysInclusive(restFrom, end) : 0;
  const rent = cents(monthlyRent);
  // Whole baht of rent × days ÷ 365, half up, in integers (no floating point at the .5 boundary).
  const rest = Math.floor((rent * restDays + 18_250) / 36_500);
  return { amount: (fullYears * rent + rest * 100) / 100, fullYears, restDays };
}

type ReservationRow = {
  id: number;
  contract_no?: string | null;
  data?: Record<string, unknown> | null;
};

/** The deal's commission confirmation number: one per reservation letter. */
export const commissionDocumentNo = (c: ReservationRow) => `CCM-${c.contract_no || `RS${c.id}`}`;

/** The commission of a reservation letter, from its rent and lease term (null when the letter lacks them). */
export function reservationCommission(c: ReservationRow): Omit<ReservationCommission, "url"> | null {
  const letter = c.data?.reservationLetter as Partial<ReservationLetterInput> | undefined;
  if (!letter) return null;
  const rent = Number(String(letter.monthlyRent ?? "").replace(/,/g, ""));
  const start = String(letter.termFrom ?? "");
  const months = Number(letter.termMonths);
  const end = isIsoDate(letter.termTo) ? letter.termTo
    : isIsoDate(start) && Number.isInteger(months) && months > 0 ? leaseTermEnd(start, months) : "";
  const result = commissionFor(rent, start, end);
  if (!result) return null;
  return {
    documentNo: commissionDocumentNo(c),
    monthlyRent: baht(cents(rent)),
    leaseStart: start,
    leaseEnd: end,
    fullYears: result.fullYears,
    restDays: result.restDays,
    amount: baht(cents(result.amount)),
  };
}

/** The fields of the commission confirmation PDF of a reservation letter (landlord and agent sign it with the letter). */
export function reservationCommissionInput(
  c: ReservationRow,
  dates: { issueDate: string; landlordSignDate: string; agentSignDate: string },
): CommissionConfirmationInput | null {
  const commission = reservationCommission(c);
  const letter = c.data?.reservationLetter as Partial<ReservationLetterInput> | undefined;
  if (!commission || !letter) return null;
  const text = (value: unknown) => String(value ?? "").replace(/[\x00-\x08\x0b-\x1f]/g, " ").trim();
  const input: CommissionConfirmationInput = {
    documentNo: commission.documentNo,
    issueDate: dates.issueDate,
    landlordName: text(letter.landlordName),
    landlordFirstName: text(letter.landlordFirstName),
    landlordLastName: text(letter.landlordLastName),
    landlordNationality: text(letter.landlordNationality),
    landlordId: text(letter.landlordId),
    agentName: text(letter.agentName),
    agentNationality: "",
    agentId: "",
    propertyType: "",
    project: text(letter.project),
    unitNo: text(letter.unitNo),
    propertyAddress: text(letter.address) || text(letter.project),
    tenantName: text(letter.tenantName),
    tenantFirstName: text(letter.tenantFirstName),
    tenantLastName: text(letter.tenantLastName),
    tenantNationality: text(letter.tenantNationality),
    tenantIdentity: text(letter.tenantId),
    leasePeriod: text(letter.termMonths) ? `${text(letter.termMonths)} เดือน` : "",
    leaseStart: commission.leaseStart,
    leaseEnd: commission.leaseEnd,
    monthlyRent: commission.monthlyRent,
    agreedCommission: commission.amount,
    // The account the commission is paid to is the agent's; the system does not keep it, so it is left blank.
    bankAccount: "",
    landlordSignName: text(letter.landlordSignName) || text(letter.landlordName),
    agentSignName: text(letter.agentSignName) || text(letter.agentName),
    landlordSignDate: dates.landlordSignDate,
    agentSignDate: dates.agentSignDate,
  };
  for (const key of Object.keys(input) as Array<keyof CommissionConfirmationInput>)
    input[key] = input[key].slice(0, COMMISSION_LIMITS[key]);
  return input;
}
