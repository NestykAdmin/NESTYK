import type { AgentContract, CommissionConfirmation, StandaloneInvoice } from '@nestyk/types';

export type ContractFolder = 'rental' | 'finance' | 'brokerage';
export type LibraryStatus = 'all' | 'attention' | 'active' | 'closed';
export type LibraryView = { folder: ContractFolder | null; type: string; status: LibraryStatus; query: string };
export const emptyLibraryView = (): LibraryView => ({ folder: null, type: 'all', status: 'all', query: '' });

type EntryMeta = { key: string; folder: ContractFolder; type: string; state: Exclude<LibraryStatus, 'all'>; date: string; search: string };
export type ContractLibraryEntry = EntryMeta & (
  | { kind: 'contract'; value: AgentContract }
  | { kind: 'booking_invoice'; value: AgentContract }
  | { kind: 'booking_receipt'; value: AgentContract }
  | { kind: 'invoice'; value: StandaloneInvoice }
  | { kind: 'receipt'; value: StandaloneInvoice }
  | { kind: 'commission'; value: CommissionConfirmation }
);
const ended = (status: string) => ['cancelled', 'expired', 'terminated'].includes(status);

/** Financial documents keep their source ID: receipts always open the invoice/booking that issued them. */
export function contractLibraryEntries(contracts: AgentContract[], invoices: StandaloneInvoice[], commissions: CommissionConfirmation[]): ContractLibraryEntry[] {
  const entries: ContractLibraryEntry[] = [];
  for (const value of contracts) {
    const search = [value.contractNo, value.property, value.room, value.tenant].filter(Boolean).join(' ');
    const dataKey = { reservation: 'reservationLetter', lease: 'leaseAgreement', renewal: 'leaseRenewal', broker_appointment: 'brokerAppointment' }[value.formKind];
    const form = value.data?.[dataKey];
    const date = String(form && typeof form === 'object' ? (form as { issueDate?: string }).issueDate || value.startDate : value.startDate);
    entries.push({ key: `contract:${value.id}`, folder: value.formKind === 'broker_appointment' ? 'brokerage' : 'rental', type: value.formKind,
      state: ended(value.status) ? 'closed' : value.status === 'active' ? 'active' : 'attention', date, search, kind: 'contract', value });
    if (value.formKind !== 'reservation') continue;
    const payment = value.reservationPayment;
    if (value.invoiceUrl && payment) entries.push({ key: `booking-invoice:${value.id}`, folder: 'finance', type: 'booking_invoice',
      state: ended(value.status) ? 'closed' : payment.status === 'paid' ? 'active' : 'attention', date,
      search: `${search} ${payment.invoiceDocumentNo}`, kind: 'booking_invoice', value });
    if (value.receiptUrl && payment?.receiptDocumentNo) entries.push({ key: `booking-receipt:${value.id}`, folder: 'finance', type: 'receipt',
      state: 'active', date, search: `${search} ${payment.receiptDocumentNo} ${payment.invoiceDocumentNo}`, kind: 'booking_receipt', value });
  }
  for (const value of invoices) {
    const search = `${value.documentNo} ${value.customerName}`;
    entries.push({ key: `invoice:${value.id}`, folder: 'finance', type: 'invoice', state: value.receiptDocumentNo ? 'active' : 'attention',
      date: value.issueDate, search, kind: 'invoice', value });
    if (value.receiptUrl && value.receiptDocumentNo) entries.push({ key: `receipt:${value.id}`, folder: 'finance', type: 'receipt', state: 'active',
      date: value.issueDate, search: `${search} ${value.receiptDocumentNo}`, kind: 'receipt', value });
  }
  for (const value of commissions) entries.push({ key: `commission:${value.id}`, folder: 'brokerage', type: 'agent_commission',
    state: value.pdfUrl ? 'active' : 'attention', date: value.issueDate, search: `${value.documentNo} ${value.landlordName} ${value.tenantName}`,
    kind: 'commission', value });
  return entries.sort((a, b) => b.date.localeCompare(a.date) || b.value.id - a.value.id || a.key.localeCompare(b.key));
}

export function filterContractLibrary(entries: ContractLibraryEntry[], view: LibraryView) {
  const query = view.query.trim().toLocaleLowerCase();
  return entries.filter(entry => entry.folder === view.folder && (view.type === 'all' || entry.type === view.type)
    && (view.status === 'all' || entry.state === view.status) && (!query || entry.search.toLocaleLowerCase().includes(query)));
}
