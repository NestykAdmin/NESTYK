/** Agent-owned document archive; source kind prevents overlapping IDs from opening another document. */
export type ContractArchiveType = 'reservation' | 'lease' | 'renewal' | 'broker_appointment' | 'booking_invoice' | 'invoice' | 'receipt' | 'agent_commission';
export type ContractArchiveKind = 'contract' | 'booking_invoice' | 'booking_receipt' | 'invoice' | 'receipt' | 'commission';
export type ContractArchiveEntry = {
  id: number;
  key: string;
  kind: ContractArchiveKind;
  type: ContractArchiveType;
  documentNo: string;
  person: string;
  property: string | null;
  room: string | null;
  reference: string | null;
  issueDate: string;
  status: string;
  amount: number | null;
};
export type ContractArchivePage = { items: ContractArchiveEntry[]; total: number; page: number; limit: number };
export type ContractArchiveDetail = ContractArchiveEntry & { documentUrl: string | null };
