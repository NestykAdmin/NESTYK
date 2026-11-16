import type { TenantBill } from "@nestyk/types";

/**
 * Whether the tenant can attach a slip from the bill sheet.
 * - Rent: while the bill is unpaid and its slip is not yet sent.
 * - Late fee (QA Aof 16 Nov 2026, Q2): until the late fee receipt is issued, whatever the rent bill's state. A late fee
 *   usually follows a bill already paid late, and the API takes the slip until the receipt.
 */
export function canAttachSlip(
  bill: Pick<TenantBill, "status" | "slipSubmitted" | "lateFee">,
  lateFee: boolean,
): boolean {
  if (lateFee) return !!bill.lateFee && !bill.lateFee.receiptIssued;
  return bill.status !== "paid" && !bill.slipSubmitted;
}

export type TenantBillBadge = "paid" | "reviewing" | "overdue" | "pending";

/**
 * The tenant's status for a bill. QA Aof 16 Nov 2026 (Q6): a sent slip reads "under review" even past the grace
 * day, the same as the agent's "Slip to review". Returning the slip clears slipSubmitted, so the bill is overdue again.
 */
export function tenantBillBadge(bill: Pick<TenantBill, "status" | "slipSubmitted">): TenantBillBadge {
  if (bill.status === "paid") return "paid";
  if (bill.slipSubmitted) return "reviewing";
  return bill.status === "overdue" ? "overdue" : "pending";
}
