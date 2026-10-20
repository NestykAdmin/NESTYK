import type { AgentContract, CloseAgentContract, ContractEndReason } from "@nestyk/types";
import { isIsoDate, shiftIsoDate } from "./lease-term";

/** A reason the API will accept for this contract today, with the end date to start from. */
export type CloseOption = {
  reason: ContractEndReason;
  /** Suggested end date. */
  date: string;
  /** "expired" must use the contract's own end date, so the date cannot be edited. */
  dateLocked: boolean;
};

export type CloseDateProblem = "format" | "future" | "beforeStart" | "notBeforeEnd" | "notBeforeStart" | null;

/**
 * Only an active lease or renewal can be closed (`POST /agent/contracts/:id/close`).
 * The API reads the kind from the contract's template, so a contract without one is refused there.
 */
export function canCloseContract(contract: AgentContract): boolean {
  return (
    contract.status === "active" &&
    contract.templateId != null &&
    (contract.formKind === "lease" || contract.formKind === "renewal")
  );
}

/**
 * Reasons that match the date rules in apps/api/src/agent/contracts/contract-closure.ts:
 * - expired: only after the end date has passed, and the end date is the original one
 * - terminated: from the start date until the day before the original end date, never in the future
 * - cancelled: with an end date before the start date; the API does not look at today, so a
 *   cancellation recorded late (after the start date) is still offered, dated the day before the start
 */
export function closeOptions(contract: AgentContract, reasons: ContractEndReason[], today: string): CloseOption[] {
  if (!canCloseContract(contract)) return [];
  const start = contract.startDate.slice(0, 10);
  const end = contract.endDate?.slice(0, 10) ?? null;
  const options: CloseOption[] = [];
  for (const reason of reasons) {
    if (reason.status === "expired") {
      if (end && today > end) options.push({ reason, date: end, dateLocked: true });
    } else if (reason.status === "terminated") {
      if (today >= start) {
        const lastDay = end ? shiftIsoDate(end, -1) : today;
        if (lastDay >= start) options.push({ reason, date: today < lastDay ? today : lastDay, dateLocked: false });
      }
    } else if (reason.status === "cancelled") {
      const dayBefore = shiftIsoDate(start, -1);
      options.push({ reason, date: today < start ? today : dayBefore, dateLocked: false });
    }
  }
  return options;
}

/** Why a typed end date would be refused, matching the API's checks; null when it is fine. */
export function closeDateProblem(option: CloseOption, date: string, contract: AgentContract, today: string): CloseDateProblem {
  if (!isIsoDate(date)) return "format";
  if (date > today) return "future";
  const start = contract.startDate.slice(0, 10);
  const end = contract.endDate?.slice(0, 10) ?? null;
  if (option.reason.status === "terminated") {
    if (date < start) return "beforeStart";
    if (end && date >= end) return "notBeforeEnd";
  }
  if (option.reason.status === "cancelled" && date >= start) return "notBeforeStart";
  return null;
}

export function closeInput(option: CloseOption, date: string, note: string): CloseAgentContract {
  const trimmed = note.trim();
  return {
    endReasonCode: option.reason.code,
    effectiveEndDate: option.dateLocked ? option.date : date,
    ...(trimmed ? { note: trimmed } : {}),
  };
}
