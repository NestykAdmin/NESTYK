import type { AgentContract } from "@nestyk/types";

/** The end reason the move-in handover sets on the deal's booking letter (API: reservation-fulfilment.ts). */
export const RESERVATION_FULFILLED_REASON = "reservation_fulfilled";

/**
 * A booking letter its lease has taken over (the booking fee became the first month's rent). It is shown as "used",
 * not as an ended contract. An API without `endReasonCode` shows the plain ended status.
 */
export function isFulfilledReservation(c: Pick<AgentContract, "status" | "endReasonCode">): boolean {
  return c.status === "terminated" && c.endReasonCode === RESERVATION_FULFILLED_REASON;
}
