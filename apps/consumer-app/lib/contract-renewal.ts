import type { AgentContract } from "@nestyk/types";
import { bangkokDateKey, shiftIsoDate } from "./lease-term";

export const RENEWAL_ADVANCE_DAYS = 30;

export function hasRenewalSuccessor(rows: AgentContract[], id: number) {
  return rows.some((row) => row.previousAgreementId === id && row.status !== "cancelled");
}

/** Each independent lease chain has its own tail, including in the agent's combined list. */
/** D15/D16: a stay recorded as not renewing or ending early is not renewed (Aof 29 Oct 2026). */
export function isLeaving(row: AgentContract) {
  const data = (row.data ?? {}) as { notRenewing?: unknown; endsOn?: unknown };
  return !!data.notRenewing || !!data.endsOn;
}

export function renewalCandidates(rows: AgentContract[]) {
  return rows.filter((row) =>
    (row.formKind === "lease" || row.formKind === "renewal") &&
    (row.status === "active" || row.status === "expired") &&
    !!row.endDate && !hasRenewalSuccessor(rows, row.id) && !isLeaving(row),
  ).sort((a, b) => (a.endDate ?? "").localeCompare(b.endDate ?? "") || a.id - b.id);
}

export function renewalOpensOn(endDate: string) {
  return shiftIsoDate(endDate, -RENEWAL_ADVANCE_DAYS);
}

type RenewalCopy = {
  disabled: string; needsEndDate: string; needsActive: string;
  alreadyRenewed: string; tooEarly: string; leaving: string;
};

function displayDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function renewalClosedMessage(
  rows: AgentContract[], copy: RenewalCopy, sourceId?: number, today = bangkokDateKey(),
) {
  const scope = sourceId == null ? rows : rows.filter((row) => row.id === sourceId);
  const tails = renewalCandidates(rows).filter((row) => sourceId == null || row.id === sourceId);
  if (tails.some((row) => today >= renewalOpensOn(row.endDate!))) return "";
  if (tails[0]?.endDate) {
    const tail = tails[0];
    return copy.tooEarly
      .replace(/\{end\}/g, displayDate(tail.endDate!))
      .replace(/\{date\}/g, displayDate(renewalOpensOn(tail.endDate!)));
  }
  const stays = scope.filter((row) => row.formKind === "lease" || row.formKind === "renewal");
  if (stays.some((row) => ["active", "expired"].includes(row.status) && hasRenewalSuccessor(rows, row.id)))
    return copy.alreadyRenewed;
  if (stays.some((row) => ["active", "expired"].includes(row.status) && !hasRenewalSuccessor(rows, row.id) && isLeaving(row)))
    return copy.leaving;
  const stay = stays.find((row) => row.status !== "cancelled");
  if (!stay) return copy.disabled;
  return stay.endDate ? copy.needsActive : copy.needsEndDate;
}

/** AC-8.1: the renewal commission typed by the agent, as sent to the API ("0" allowed), or null when not a number. */
export function renewalCommissionValue(text: string): string | null {
  const raw = text.replace(/,/g, "").trim();
  return /^\d{1,9}(\.\d{1,2})?$/.test(raw) && Number(raw) <= 99_999_999.99 ? raw : null;
}

/** AC-8.7: a lease ended with no decision yet; the agent can still record that it will not be renewed. */
export function awaitingDecision(row: Pick<AgentContract, "status" | "data">) {
  return row.status === "expired" && !!(row.data as { undecided?: unknown } | null | undefined)?.undecided;
}

/** AC-8.2: a renewal is cancelled (with a reason) until both the landlord and the tenant have signed. */
export function canCancelRenewal(row: Pick<AgentContract, "formKind" | "status" | "ownerSignedAt" | "tenantSignedAt">) {
  return row.formKind === "renewal" && (row.status === "draft" || row.status === "awaiting_signatures")
    && !(row.ownerSignedAt && row.tenantSignedAt);
}
