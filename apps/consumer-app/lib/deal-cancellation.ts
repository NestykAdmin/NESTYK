import type { AgentContract, DealCancellationParty, DealCancellationPreview } from "@nestyk/types";

/**
 * D5 (AC-C.1 to C.4): the deal cancellation form's rules, the same as the API's
 * (apps/api/src/agent/contracts/deal-cancellation.ts); the API checks them again.
 */
export const MAX_EVIDENCE_FILES = 5;
const ENDED = ["cancelled", "expired", "terminated"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type DealCancellationField = "reason" | "evidence" | "atFault" | "notifiedOn";

/** A booking letter or lease not ended, of a deal not handed over (an active lease is ended early instead, TC-C.09). */
export function canCancelDeal(c: Pick<AgentContract, "formKind" | "status" | "agreementKind">) {
  if (c.formKind !== "reservation" && c.formKind !== "lease") return false;
  if (c.agreementKind === "renewal" || ENDED.includes(c.status)) return false;
  return !(c.formKind === "lease" && c.status === "active");
}

export function isIsoDate(value: string) {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** The fields still missing, in the form's order (TC-C.08). */
export function missingDealCancellationFields(form: {
  reason: string;
  evidenceCount: number;
  atFault: DealCancellationParty | null;
  notifiedOn: string;
}): DealCancellationField[] {
  const missing: DealCancellationField[] = [];
  if (!form.reason.trim()) missing.push("reason");
  if (form.evidenceCount < 1) missing.push("evidence");
  if (!form.atFault) missing.push("atFault");
  if (form.atFault === "landlord" && !form.notifiedOn.trim()) missing.push("notifiedOn");
  return missing;
}

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** What happens to the money received with a receipt (forfeited, or refunded 7 days after the day told). */
export function dealCancellationOutcome(
  preview: Pick<DealCancellationPreview, "bookingReceived" | "depositReceived" | "refundDays">,
  atFault: DealCancellationParty | null,
  notifiedOn: string,
): { kind: "none" } | { kind: "forfeit"; amount: number } | { kind: "refund"; amount: number; dueOn: string | null } {
  const total = Math.round(preview.bookingReceived * 100) + Math.round(preview.depositReceived * 100);
  if (!atFault || total === 0) return { kind: "none" };
  if (atFault === "tenant") return { kind: "forfeit", amount: total / 100 };
  return { kind: "refund", amount: total / 100, dueOn: isIsoDate(notifiedOn) ? addDays(notifiedOn, preview.refundDays) : null };
}
