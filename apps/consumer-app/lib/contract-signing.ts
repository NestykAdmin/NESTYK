import type { AgentContract } from "@nestyk/types";

/** D3 (AC-3.6): nobody signs a reservation letter before the booking receipt is issued. */
export function bookingPaymentBlocksSigning(
  contract: Pick<AgentContract, "formKind" | "receiptUrl">,
  party: string | undefined,
) {
  return !!party && contract.formKind === "reservation" && !contract.receiptUrl;
}

/**
 * D3 (AC-3.6): a reservation letter not signed by everyone after its due day (the 3rd day after it was made, Bangkok
 * time). Only a warning: signing and confirming stay open.
 */
export function reservationSigningOverdue(contract: Pick<AgentContract, "signDueDate">, today: string) {
  return !!contract.signDueDate && today > contract.signDueDate;
}
