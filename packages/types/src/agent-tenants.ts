import type { AgentContract } from "./agent-contracts";
export interface AgentTenant {
  id: number;
  leadId: number;
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  note: string | null;
  identityNumber: string | null;
  nationality: string | null;
  createdAt: string;
  property: string;
  room: string | null;
  fullAddress: string | null;
  contracts: AgentContract[];
}
/** `awaiting_review`: the tenant attached a slip the agent has not confirmed or rejected yet. */
export type AgentTenantBillStatus = "pending" | "awaiting_review" | "overdue" | "paid";
export interface AgentTenantBill {
  id: number;
  /** `YYYY-MM` of the due date. */
  period: string;
  documentNo: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  status: AgentTenantBillStatus;
  slipSubmittedAt: string | null;
  paidAt: string | null;
}
export interface AgentTenantPayment {
  id: string;
  kind: "rent" | "reservation";
  /** Rent period (`YYYY-MM`); null for the reservation fee. */
  period: string | null;
  amount: number;
  paidAt: string;
  hasSlip: boolean;
  receiptIssued: boolean;
}
/** One tenant's rent billing as the agent sees it (planned `GET /bills/agent/tenants/:tenantId`). */
export interface AgentTenantBilling {
  bills: AgentTenantBill[];
  /** Next period whose bill is not issued yet. */
  upcoming: { period: string; issueDate: string; dueDate: string; amount: number } | null;
  /** Periods paid in advance at signing, so they never get a bill. */
  advancePeriods: string[];
  payments: AgentTenantPayment[];
}
export interface TenantLeadOption {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  nationality: string | null;
}
export interface TenantRoomOption {
  id: number;
  property: string;
  room: string | null;
  /** The lead asked about (`leadId`) has a viewing of this room that was not cancelled. */
  viewed?: boolean;
  /** Name of the lead that already booked this room; null while it is free. */
  bookedBy?: string | null;
}
export interface UpdateAgentTenant {
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  note?: string;
  identityNumber?: string;
  nationality?: string;
}
export interface CreateAgentTenant extends UpdateAgentTenant {
  leadId: number;
  rentRoomId: number;
}
