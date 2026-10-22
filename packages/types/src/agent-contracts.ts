import type { ContractParty } from "./roles";
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
  /** D7: the lease document is generated; waiting for the deposit receipt. */
  | "awaiting_deposit"
  /** D7: the deposit is received (or there is none); waiting for the handover to be signed by both. */
  | "awaiting_handover"
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
    /** D11 (AC-3.4): why the agent returned the tenant's slip; null once a new slip is sent. */
    slipReturnReason?: string | null;
  } | null;
  /** D10: the deposit of a generated lease (null when not a lease, not generated yet, or the deposit is 0). */
  depositPayment?: DepositPayment | null;
}
/**
 * D2 (AC-2.1 to 2.4, round 1): the terms agreed for a lead and a room, confirmed by the landlord before the room is
 * booked. The numbers then flow into the reservation letter and the lease. A confirmed offer cannot change in round 1.
 */
export type DealOfferStatus = "draft" | "awaiting_landlord" | "confirmed" | "room_taken" | "cancelled";
/** app = the landlord confirmed in the app; agent_recorded = the agent recorded the landlord's confirmation. */
export type DealOfferConfirmationChannel = "app" | "agent_recorded";
export type DealOfferConfirmationMethod = "phone" | "line" | "in_person" | "other";
/** The terms the agent types. Money is text like the contract forms ("15000" or "15,000.50"). */
export interface DealOfferTerms {
  monthlyRent: string;
  termMonths: number;
  startDate: string;
  depositAmount: string;
  contractDate: string;
  rentDueDay: number;
  /** Day of the month, like the lease form; null keeps the billing default. */
  graceDay: number | null;
  lateFeePerDay: string | null;
  /** null = 30 days (AC-2.3). */
  renewalNoticeDays: number | null;
  coBroke: boolean;
  coBrokeAgentName: string | null;
}
export interface SaveDealOffer extends DealOfferTerms {
  /** Create only. */
  leadId?: number;
  rentRoomId?: number;
  /** Update only: the revision the agent edited. */
  revision?: number;
}
export interface DealOffer extends Omit<DealOfferTerms, "renewalNoticeDays"> {
  id: number;
  leadId: number;
  leadName: string;
  rentRoomId: number;
  /** Project and room number, for the landlord's list. */
  roomLabel: string;
  status: DealOfferStatus;
  revision: number;
  /** 1 month of rent (AC-2.2). */
  reservationAmount: string;
  /** The day before the term's anniversary, like the lease. */
  endDate: string;
  renewalNoticeDays: number;
  sentAt: string | null;
  confirmedAt: string | null;
  confirmationChannel: DealOfferConfirmationChannel | null;
  confirmationMethod: DealOfferConfirmationMethod | null;
  confirmationNote: string | null;
  confirmedByName: string | null;
  /** The room has a landlord account, so the landlord can confirm in the app. */
  landlordInApp: boolean;
  closedAt: string | null;
}
/**
 * D10: one deposit invoice per lease, issued in the landlord's name once the lease document is generated.
 * not_issued = the lease is generated but issuing failed; the agent can issue it again.
 * voided = the lease was closed while it waited for the deposit, so the unpaid invoice is cancelled.
 */
export interface DepositPayment {
  status: "not_issued" | "unpaid" | "submitted" | "paid" | "voided";
  total: number;
  invoiceId: number | null;
  invoiceDocumentNo: string | null;
  dueDate: string | null;
  invoiceUrl: string | null;
  receiptDocumentNo: string | null;
  receiptUrl: string | null;
  paymentSlipUrl: string | null;
  submittedAt: string | null;
  /** D11 (AC-5.4): why the agent returned the tenant's slip; null once a new slip is sent. */
  slipReturnReason?: string | null;
}
export type DepositFinancialDocumentKind = "deposit-invoice" | "deposit-receipt" | "deposit-payment-slip";
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
export interface ContractDelivery {
  party: ContractParty;
  userId: number;
  deliveredAt: string;
}
export interface PartyContract extends AgentContract {
  myParties: Array<ContractParty>;
  /** Next scheduled rent round, independently of any outstanding bills. */
  nextRentBill?: Pick<TenantNextBill, "period" | "issueDate" | "dueDate" | "graceUntil"> | null;
}
/**
 * D17: how a signature was made. app = the party signed in their own app, link = through a sign link,
 * on_site = the agent signed for that party on the agent's device, uploaded_file = a signed file was attached,
 * legacy = copied from the old signature columns (channel unknown).
 */
export type AgreementSignatureChannel = "app" | "link" | "on_site" | "uploaded_file" | "legacy";
export type AgreementSignatureParty = AgentContractSignParty | "witness";
/** One live signature of a contract (`GET /agent/contracts/:id/signatures`). */
export interface AgreementSignatureLogEntry {
  party: AgreementSignatureParty;
  channel: AgreementSignatureChannel;
  signedAt: string;
  /** The name to show: the name typed for a witness without an account, otherwise the account that pressed sign. */
  signedBy: string | null;
}
/**
 * D6 (AC-6.1 to 6.4): handing the room over after the deposit receipt. Annex 1 = what is in the room (items),
 * annex 2 = photos of the room. The landlord and the tenant sign it, in their app or on the agent's device.
 */
export type HandoverKind = "move_in" | "move_out";
export type HandoverItemCondition = "good" | "damaged" | "missing";
export type HandoverSignParty = "owner" | "tenant";
/** Why the handover of a lease cannot be filled in yet. */
export type HandoverBlockedReason = "not_lease" | "contract_ended" | "lease_not_issued" | "deposit_unpaid";
/** blocked: not open yet (see blockedReason) · not_started: open, nothing saved · in_progress: saved, not signed by both · completed: signed by both, locked. */
export type HandoverStatus = "blocked" | "not_started" | "in_progress" | "completed";
export interface HandoverItemInput {
  name: string;
  quantity: number;
  condition: HandoverItemCondition;
  note?: string | null;
}
export interface HandoverItem extends HandoverItemInput {
  id: number;
  note: string | null;
}
export interface HandoverPhoto {
  id: number;
  url: string | null;
  caption: string | null;
  createdAt: string;
}
export interface HandoverSignature {
  party: HandoverSignParty;
  channel: "app" | "on_site";
  signedAt: string;
  signedBy: string | null;
}
export interface HandoverRecord {
  contractId: number;
  /** null until the agent first saves the form. */
  id: number | null;
  status: HandoverStatus;
  blockedReason: HandoverBlockedReason | null;
  handoverDate: string | null;
  note: string | null;
  /** Goes up on every change; signing sends the revision the signer saw. */
  revision: number;
  items: HandoverItem[];
  photos: HandoverPhoto[];
  signatures: HandoverSignature[];
  completedAt: string | null;
  /** Party endpoints only: the sides of the contract the viewer is. */
  myParties?: HandoverSignParty[];
}
export interface SaveHandover {
  handoverDate: string;
  note?: string | null;
  items: HandoverItemInput[];
  /** The revision the agent edited (0 for a new record). */
  revision: number;
}
export interface SignHandover {
  party: HandoverSignParty;
  signaturePng: string;
  revision: number;
}
export interface ContractCandidate {
  leadId: number;
  tenant: string;
  property: string;
  room: string | null;
  /** D2: the booked room, to find the offer the landlord confirmed for it. */
  rentRoomId?: number;
  /** D1: this room + tenant has a valid broker appointment (generated, under 1 year old), so a reservation letter can start. */
  brokerAppointmentReady?: boolean;
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
/** B3: a current attached document the agent rejected, shown to whoever signs (signing is not blocked). */
export interface RejectedAttachmentNotice {
  /** The document type name, or the file name when the type is unknown. */
  name: string;
  /** The reason the agent gave, if any. */
  note: string | null;
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
  /** D11 (AC-3.5): who received a booking or deposit payment; agent = with a power of attorney attached. */
  receivedBy?: ReceiptReceiver;
  /** D11 (TC-3.15): baht the tenant withheld from a booking payment; the receipt total stays the full amount. */
  withholdingTax?: number;
}
export type ReceiptReceiver = "landlord" | "agent";

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
