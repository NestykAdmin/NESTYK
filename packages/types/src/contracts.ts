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

/** D12 (AC-7.2): the first bill of a new lease is the rent less the reservation receipt (never below 0). */
export interface BillReservationCredit {
  rent: number;
  credit: number;
}

/** D12 (AC-7.8): the late fee invoice of one rent bill. The rent bill's own amount never includes it. */
export interface BillLateFee {
  invoiceId: number;
  documentNo: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'awaiting_review' | 'paid';
  slipReturnReason: string | null;
  hasPaymentSlip: boolean;
  slipSubmitted: boolean;
  /** Set when the tenant sent the current slip, so the agent returns that exact slip. */
  slipSubmittedAt: string | null;
  receiptIssued: boolean;
}

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
  /** Set on the first bill of a new lease when the reservation was taken off it; null otherwise. */
  reservationCredit: BillReservationCredit | null;
  /** Days after the grace day, through the confirmation day or today. 0 until the grace day has passed. */
  lateDays: number;
  /** The contract's late fee per day, for display. The agent types the invoice amount. */
  lateFeePerDay: number | null;
  /** The late fee invoice of this bill, once the agent has issued one. */
  lateFee: BillLateFee | null;
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
