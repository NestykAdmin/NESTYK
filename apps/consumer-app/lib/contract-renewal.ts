import type { AgentContract } from "@nestyk/types";
import { bangkokDateKey, shiftIsoDate } from "./lease-term";

export const RENEWAL_ADVANCE_DAYS = 30;

export function hasRenewalSuccessor(rows: AgentContract[], id: number) {
  return rows.some((row) => row.previousAgreementId === id && row.status !== "cancelled");
}

/** Each independent lease chain has its own tail, including in the agent's combined list. */
export function renewalCandidates(rows: AgentContract[]) {
  return rows.filter((row) =>
    (row.formKind === "lease" || row.formKind === "renewal") &&
    (row.status === "active" || row.status === "expired") &&
    !!row.endDate && !hasRenewalSuccessor(rows, row.id),
  ).sort((a, b) => (a.endDate ?? "").localeCompare(b.endDate ?? "") || a.id - b.id);
}

export function renewalOpensOn(endDate: string) {
  return shiftIsoDate(endDate, -RENEWAL_ADVANCE_DAYS);
}

type RenewalCopy = {
  disabled: string; needsEndDate: string; needsActive: string;
  alreadyRenewed: string; tooEarly: string;
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
  const stay = stays.find((row) => row.status !== "cancelled");
  if (!stay) return copy.disabled;
  return stay.endDate ? copy.needsActive : copy.needsEndDate;
}
