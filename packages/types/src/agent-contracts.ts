import type { TenantNextBill } from "./contracts";

export interface AgreementTemplate {
  id: number;
  agreementTypeCode: string;
  version: number;
  name: string;
  formKind: "reservation" | "lease" | "broker_appointment" | "renewal";
  dataSchema: Record<string, unknown>;
}
export interface AgreementType {
  code: string;
  nameTh: string;
  nameEn: string;
  icon: string;
  formKind: "reservation" | "lease" | "broker_appointment" | "renewal";
}
export type AgentContractStatus =
  | "draft"
  | "awaiting_signatures"
  | "awaiting_agent_review"
  | "awaiting_payment"
  | "awaiting_payment_verification"
  | "active"
  | "cancelled"
  | "expired"
  | "terminated";
export interface AgentContract {
  id: number;
  tenantId: number;
  leadId: number;
  contractNo: string;
  templateId: number | null;
  templateVersion: number | null;
  agreementKind: "new" | "renewal";
  previousAgreementId: number | null;
  rootAgreementId: number;
  data: Record<string, unknown>;
  property: string;
  room: string | null;
  tenant: string;
  agreementTypeCode: string;
  agreementTypeName: string;
  formKind: "reservation" | "lease" | "broker_appointment" | "renewal";
  reservationFee: number | null;
  status: AgentContractStatus;
  startDate: string;
  endDate: string | null;
  bookingDate: string | null;
  moveInDate: string | null;
  monthlyRent: number | null;
  deposit: number | null;
  endReasonId?: number | null;
  endReasonNote?: string | null;
  effectiveEndDate?: string | null;
  endRecordedAt?: string | null;
  endRecordedByUserId?: number | null;
  notes: string | null;
  ownerSignedAt: string | null;
  tenantSignedAt: string | null;
  ownerDeliveredAt: string | null;
  tenantDeliveredAt: string | null;
  agentSignedAt: string | null;
  ownerSignatureUrl: string | null;
  tenantSignatureUrl: string | null;
  agentSignatureUrl: string | null;
  reservationLetterUrl: string | null;
  reservationLetterStatus:
    "awaiting_signatures" | "ready_to_generate" | "ready" | null;
  brokerAppointmentUrl: string | null;
  brokerAppointmentStatus:
    "awaiting_signatures" | "ready_to_generate" | "ready" | null;
  leaseDocumentUrl: string | null;
  leaseAgreementStatus:
    "awaiting_signatures" | "ready_to_generate" | "ready" | null;
  invoiceUrl: string | null;
  receiptUrl: string | null;
  reservationPayment: {
    invoiceDocumentNo: string;
    receiptDocumentNo: string | null;
    total: number;
    status: "unpaid" | "submitted" | "paid";
    paymentSlipUrl: string | null;
    submittedAt: string | null;
  } | null;
}
export type AgentContractDocumentKind =
  | "reservation_letter"
  | "lease_agreement"
  | "invoice"
  | "receipt"
  | "broker_appointment";
export type AgentContractSignParty = "owner" | "tenant" | "agent";
export interface SignAgentContract {
  parties: AgentContractSignParty[];
  signaturePng: string;
}
export interface ContractSignInvite {
  party: "owner" | "tenant";
  url: string;
  expiresAt: string;
}
export interface ContractDelivery {
  party: "owner" | "tenant";
  userId: number;
  deliveredAt: string;
}
export interface PartyContract extends AgentContract {
  myParties: Array<"owner" | "tenant">;
  /** Next scheduled rent round, independently of any outstanding bills. */
  nextRentBill?: Pick<TenantNextBill, "period" | "issueDate" | "dueDate" | "graceUntil"> | null;
}
export interface ContractCandidate {
  leadId: number;
  tenant: string;
  property: string;
  room: string | null;
}
export interface CreateAgentContract {
  templateId?: number;
  previousAgreementId?: number;
  data?: Record<string, unknown>;
  leadId: number;
  startDate: string;
  endDate?: string;
  moveInDate?: string;
  monthlyRent?: number;
  deposit?: number;
  reservationFee?: number;
  agreementTypeCode?: string;
  notes?: string;
}

export interface ContractEndReason {
  code: string;
  nameTh: string;
  nameEn: string;
  status: "expired" | "terminated" | "cancelled";
  requiresNote: boolean;
}
export interface CloseAgentContract {
  endReasonCode: string;
  effectiveEndDate: string;
  note?: string;
}
export interface ContractClosureBilling {
  policy: "retain_existing";
  unpaidCount: number;
  unpaidAmount: string;
  paidCount: number;
  /** Already-issued bills due after closure need a separate financial decision. */
  billsDueAfterEndCount: number;
}
export interface CloseAgentContractResult {
  contract: AgentContract;
  billing: ContractClosureBilling;
}

export type AgreementDocumentSubject =
  "tenant" | "owner" | "property" | "representative";
export interface AgreementAttachment {
  id: number;
  agreementId: number;
  documentTypeCode: string;
  subject: AgreementDocumentSubject;
  fileName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
  reviewStatus: "pending" | "accepted" | "rejected";
  reviewNote: string | null;
  reviewedAt: string | null;
  supersedesDocumentId: number | null;
  sourceDocumentId: number | null;
  isCurrent: boolean;
}
export interface AgreementAttachmentChecklist {
  editable: boolean;
  readyToSign: boolean;
  documentTypes: Array<{ code: string; nameTh: string }>;
  requirements: Array<{
    groupKey: string;
    label: string;
    subject: AgreementDocumentSubject;
    documentTypeCodes: string[];
    complete: boolean;
  }>;
  documents: AgreementAttachment[];
  reusableDocuments: AgreementAttachment[];
}

export type FinancialDocumentKind = "invoice" | "receipt";
export interface FinancialDocumentInput {
  documentNo: string;
  issueDate: string;
  dueDate: string;
  reference: string;
  customerName: string;
  customerFirstName: string;
  customerLastName: string;
  customerAddress: string;
  customerTaxId: string;
  customerPhone: string;
  customerEmail: string;
  issuerName: string;
  issuerAddress: string;
  issuerTaxId: string;
  issuerPhone: string;
  issuerEmail: string;
  items: { description: string; quantity: number; unitPrice: number }[];
  vatRate: number;
  discount: number;
  paymentMethod: string;
  paymentDetails: string;
  receiverName: string;
  notes: string;
}

/** Invoice created without a reservation letter. A receipt, when present, belongs to this invoice. */
export interface StandaloneInvoice {
  id: number;
  documentNo: string;
  customerName: string;
  issueDate: string;
  total: number;
  invoiceUrl: string | null;
  tenantId: number | null;
  receiptDocumentNo: string | null;
  receiptUrl: string | null;
  paymentSlipUrl: string | null;
}

/** Landlord-to-agent commission confirmation, stamped onto the paper template. */
export interface CommissionConfirmationInput {
  documentNo: string;
  issueDate: string;
  landlordName: string;
  landlordFirstName: string;
  landlordLastName: string;
  landlordNationality: string;
  landlordId: string;
  agentName: string;
  agentNationality: string;
  agentId: string;
  propertyType: string;
  project: string;
  unitNo: string;
  propertyAddress: string;
  tenantName: string;
  tenantFirstName: string;
  tenantLastName: string;
  tenantNationality: string;
  tenantIdentity: string;
  leasePeriod: string;
  leaseStart: string;
  leaseEnd: string;
  monthlyRent: string;
  agreedCommission: string;
  bankAccount: string;
  landlordSignName: string;
  agentSignName: string;
  landlordSignDate: string;
  agentSignDate: string;
}

export interface CommissionConfirmation {
  id: number;
  documentNo: string;
  issueDate: string;
  landlordName: string;
  agentName: string;
  tenantName: string;
  tenantId: number | null;
  pdfUrl: string | null;
}

/** Fillable fields for residential lease PDF (สัญญาเช่า). */
export interface LeaseAgreementInput {
  documentNo: string;
  issueDate: string;
  landlordName: string;
  landlordFirstName: string;
  landlordLastName: string;
  landlordNationality: string;
  landlordId: string;
  landlordAddress: string;
  landlordPhone: string;
  landlordEmail: string;
  tenantName: string;
  tenantFirstName: string;
  tenantLastName: string;
  tenantNationality: string;
  tenantId: string;
  tenantAddress: string;
  tenantPhone: string;
  tenantEmail: string;
  propertyType: string;
  project: string;
  houseNo: string;
  propertyAddress: string;
  roomType: string;
  floor: string;
  area: string;
  termMonths: string;
  termFrom: string;
  termTo: string;
  monthlyRent: string;
  monthlyRentWords: string;
  rentDueDay: string;
  graceDay: string;
  latePenalty: string;
  latePenaltyWords: string;
  bankName: string;
  accountName: string;
  accountNo: string;
  otherPaymentMethod: string;
  advanceMonths: string;
  advanceAmount: string;
  depositMonths: string;
  depositAmount: string;
  otherInitialPayment: string;
  additionalTerms: string;
  agentContact: string;
  landlordSignName: string;
  tenantSignName: string;
  witnessSignName: string;
  /** Optional PNG data URL — not persisted on the contract JSON. */
  landlordSignaturePng: string;
  tenantSignaturePng: string;
}

/** Fillable fields for residential rental reservation PDF (หนังสือจอง). */
export interface ReservationLetterInput {
  documentNo: string;
  issueDate: string;
  tenantName: string;
  tenantFirstName: string;
  tenantLastName: string;
  tenantPhone: string;
  tenantEmail: string;
  tenantId: string;
  tenantNationality: string;
  landlordName: string;
  landlordFirstName: string;
  landlordLastName: string;
  landlordPhone: string;
  landlordEmail: string;
  landlordId: string;
  landlordNationality: string;
  agentName: string;
  companyName: string;
  agentPhone: string;
  project: string;
  address: string;
  unitNo: string;
  floor: string;
  area: string;
  beds: string;
  baths: string;
  termMonths: string;
  termFrom: string;
  termTo: string;
  monthlyRent: string;
  advanceMonths: string;
  advanceAmount: string;
  depositMonths: string;
  depositAmount: string;
  reservationPayment: string;
  reservationWords: string;
  /** Apply reservation to advance rent. */
  applyToAdvance: boolean;
  /** Apply reservation to security deposit. */
  applyToDeposit: boolean;
  balanceDue: string;
  payee: string;
  /** transfer | cash | credit | "" */
  paymentMethod: string;
  bankAccount: string;
  tenantSignName: string;
  landlordSignName: string;
  agentSignName: string;
}

/** Fields for generated rental broker appointment PDF (แต่งตั้งนายหน้า). */
export interface BrokerAppointmentInput {
  documentNo: string;
  issueDate: string;
  landlordName: string;
  landlordFirstName: string;
  landlordLastName: string;
  landlordNationality: string;
  landlordId: string;
  landlordAddress: string;
  landlordPhone: string;
  brokerCompany: string;
  brokerContact: string;
  brokerNationality: string;
  brokerId: string;
  brokerPhone: string;
  brokerAddress: string;
  propertyLine: string;
  monthlyRent: string;
  leaseMonths: string;
  commissionFee: string;
  commissionMonths: string;
  landlordSignName: string;
  brokerSignName: string;
  /** Optional PNG data URL for landlord signature image on the PDF. */
  landlordSignaturePng: string;
  /** Optional PNG data URL for broker signature image on the PDF. */
  brokerSignaturePng: string;
}

/** Fields stamped onto the lease renewal addendum PDF. */
export interface LeaseRenewalInput {
  documentNo: string;
  issueDate: string;
  landlordName: string;
  tenantName: string;
  propertyLine: string;
  /** First lease in the chain. Copied onto every later renewal. */
  firstLeaseNo: string;
  firstLeaseDate: string;
  firstLeaseStart: string;
  firstLeaseEnd: string;
  originalLeaseNo: string;
  originalLeaseDate: string;
  originalExpiryDate: string;
  renewMonths: string;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  dueDay: string;
  bankAccount: string;
  depositCarried: string;
  additionalChanges: string;
  landlordSignName: string;
  tenantSignName: string;
  landlordSignaturePng: string;
  tenantSignaturePng: string;
}
