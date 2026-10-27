import type { ContractReminder } from "@nestyk/types";
import { apiGet } from "./api";

/** D4: the agent's reminders, worked out now (what is late or due). */
export function listAgentReminders(): Promise<ContractReminder[]> {
  return apiGet("/agent/reminders");
}

/** D4 (AC-7.5): the landlord's reminders: rent 15 days late on their rooms. */
export function listLandlordReminders(): Promise<ContractReminder[]> {
  return apiGet("/contracts/mine/reminders");
}
