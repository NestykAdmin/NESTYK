import type { AgentContract } from "@nestyk/types";

export function bookingPaymentBlocksSigning(
  contract: Pick<AgentContract, "formKind" | "receiptUrl">,
  party: string | undefined,
) {
  return party === "tenant" && contract.formKind === "reservation" && !contract.receiptUrl;
}
