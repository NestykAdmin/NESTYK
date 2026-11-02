export const ACCOUNT_DELETE_GRACE_DAYS = 30;
export const ACCOUNT_DELETE_BLOCKERS = ['open_contract', 'unpaid_bill', 'unrefunded_deposit'] as const;
export type AccountDeleteBlocker = (typeof ACCOUNT_DELETE_BLOCKERS)[number];

const CLOSED = new Set(['cancelled', 'expired', 'terminated']);

export function deletionEffectiveAt(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + ACCOUNT_DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000);
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
  unpaidBills: number;
  unrefundedDeposits: number;
}): AccountDeleteBlocker[] {
  const reasons: AccountDeleteBlocker[] = [];
  if (input.openContracts > 0) reasons.push('open_contract');
  if (input.unpaidBills > 0) reasons.push('unpaid_bill');
  if (input.unrefundedDeposits > 0) reasons.push('unrefunded_deposit');
  return reasons;
}
