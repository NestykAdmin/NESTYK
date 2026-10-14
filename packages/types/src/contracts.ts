export type ContractStatus = 'draft' | 'pending_signature' | 'active' | 'expired' | 'terminated';
export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'failed';

export interface RentalContract {
  id: string;
  listingId: string;
  tenantId: string;
  ownerId: string;
  agentId?: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number;
  contractPdfUrl?: string;
  status: ContractStatus;
  createdAt: string;
  updatedAt: string;
}

export type TenantBillStatus = 'pending' | 'paid' | 'overdue';

/** Monthly rent bill generated from an active lease agreement (rent only). */
export interface TenantBill {
  id: number;
  leaseContractId: number;
  contractNo: string | null;
  tenantName: string;
  property: string;
  room: string | null;
  /** `YYYY-MM` of the due date. */
  period: string;
  documentNo: string;
  issueDate: string;
  dueDate: string;
  graceUntil: string;
  amount: number;
  status: TenantBillStatus;
  /** The lease that issued this bill is still the tenant's current stay. */
  leaseActive: boolean;
  paidAt: string | null;
  hasPaymentSlip: boolean;
  /** True after the tenant confirms and the slip is waiting for the agent. */
  slipSubmitted: boolean;
  /** Agent's return note. `invalid_image` is the legacy fixed reason. Cleared after a new upload. */
  slipReturnReason: string | null;
  payTo: { bankName: string; accountName: string; accountNo: string } | null;
}

/**
 * Next rent round for the dashboard: the oldest unpaid bill, or the next period not issued yet.
 * The payable window is `issueDate` → `graceUntil`.
 */
export interface TenantNextBill {
  billId: number | null;
  leaseContractId: number;
  property: string;
  room: string | null;
  period: string;
  issueDate: string;
  dueDate: string;
  graceUntil: string;
  amount: number;
  status: 'upcoming' | 'pending' | 'overdue';
}
