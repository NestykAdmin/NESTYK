/**
 * M5 (Aof 29 Oct 2026): the tenant's slip for the rent still to collect after an early end. The agent confirms the
 * money or returns the slip with a reason; the tenant sends a new one until the money is confirmed. No receipt yet.
 */
export type EarlyEndMoney = {
  kind?: string;
  invoicePath?: string | null;
  slipPath?: string | null;
  slipSubmittedAt?: string | null;
  paidAt?: string | null;
  returnNote?: string | null;
};
export type EarlyEndSlipState = "none" | "no_slip" | "returned" | "awaiting" | "paid";

export function earlyEndMoneyOf(data: unknown): EarlyEndMoney | null {
  const money = (data as { endsOn?: { money?: EarlyEndMoney } } | null | undefined)?.endsOn?.money;
  return money && typeof money === "object" ? money : null;
}

/** none: no amount to collect · no_slip / returned: the tenant can send one · awaiting: the agent checks it · paid. */
export function earlyEndSlipState(money: EarlyEndMoney | null): EarlyEndSlipState {
  if (money?.kind !== "collect" || !money.invoicePath) return "none";
  if (money.paidAt) return "paid";
  if (money.slipPath) return "awaiting";
  return money.returnNote ? "returned" : "no_slip";
}
