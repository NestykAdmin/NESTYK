export const ACCOUNT_DELETE_GRACE_DAYS = 30;
export const ACCOUNT_DELETE_BLOCKERS = ['open_contract', 'open_agent_contract', 'unpaid_bill', 'bill_awaiting_review', 'unrefunded_deposit'] as const;
export type AccountDeleteBlocker = (typeof ACCOUNT_DELETE_BLOCKERS)[number];

const CLOSED = new Set(['cancelled', 'expired', 'terminated']);

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000; // Thailand has no daylight saving

/**
 * QA A10: 00:00 Bangkok of the 30th day after the request. The 00:10 Bangkok job then deletes the account on the
 * day the app shows, instead of the night after it.
 */
export function deletionEffectiveAt(requestedAt: Date): Date {
  const bangkok = new Date(requestedAt.getTime() + BANGKOK_OFFSET_MS);
  const day = Date.UTC(bangkok.getUTCFullYear(), bangkok.getUTCMonth(), bangkok.getUTCDate() + ACCOUNT_DELETE_GRACE_DAYS);
  return new Date(day - BANGKOK_OFFSET_MS);
}

/**
 * "Delete now" exists for QA (Jom, 3 Nov 2026) and is off unless this is exactly `true`. Production keeps only the
 * 30-day schedule, whose job retries a deletion that failed half way the next night.
 */
export function immediateDeletionEnabled(): boolean {
  return process.env.ALLOW_IMMEDIATE_ACCOUNT_DELETION === 'true';
}

export function anonymizedAccountEmail(userId: number): string {
  return `deleted+${userId}@users.invalid`;
}

/** A lease still in progress blocks deletion. Ended, cancelled, and terminated contracts do not. */
export function contractBlocksDeletion(status: string): boolean {
  return !CLOSED.has(status);
}

export function deletionBlockers(input: {
  openContracts: number;
  /** Agreements the user manages as the agent of the deal that still hold (agreement-hold.ts). */
  openAgentContracts?: number;
  unpaidBills: number;
  /** Pending bills whose slip the tenant sent and the agent has not checked yet. */
  billsAwaitingReview?: number;
  unrefundedDeposits: number;
}): AccountDeleteBlocker[] {
  const reasons: AccountDeleteBlocker[] = [];
  if (input.openContracts > 0) reasons.push('open_contract');
  if ((input.openAgentContracts ?? 0) > 0) reasons.push('open_agent_contract');
  if (input.unpaidBills > 0) reasons.push('unpaid_bill');
  if ((input.billsAwaitingReview ?? 0) > 0) reasons.push('bill_awaiting_review');
  if (input.unrefundedDeposits > 0) reasons.push('unrefunded_deposit');
  return reasons;
}
