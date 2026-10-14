import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getCardElevation, MobileButton, MobileIcon, MobileInput, MobileStatusPill, tokens, useMobileTheme, type AppIconName } from '@nestyk/ui/native';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import type { AgentContract, CommissionConfirmation, StandaloneInvoice } from '@nestyk/types';
import { contractLibraryEntries, emptyLibraryView, filterContractLibrary, type ContractFolder, type ContractLibraryEntry, type LibraryStatus, type LibraryView } from '../lib/agent-contract-library';
import { localeTag } from '../lib/lead-format';
import { DetailCard, DetailMenuRow, ps } from './TenantDetailParts';

const folders: { key: ContractFolder; icon: AppIconName; hint: 'rentalHint' | 'financeHint' | 'brokerageHint' }[] = [
  { key: 'rental', icon: 'key', hint: 'rentalHint' },
  { key: 'finance', icon: 'note', hint: 'financeHint' },
  { key: 'brokerage', icon: 'handshake', hint: 'brokerageHint' },
];
const types: Record<ContractFolder, string[]> = {
  rental: ['reservation', 'lease', 'renewal'], finance: ['booking_invoice', 'invoice', 'receipt'], brokerage: ['broker_appointment', 'agent_commission'],
};
const { boxShadow: _webShadow, ...cardShadow } = getCardElevation(1);

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] ?? '').join('').toUpperCase();
}

export function AgentContractLibrary({ contracts, invoices, commissions, view, onViewChange, onOpen, onCreate, busy, loading, tenantName }: {
  contracts: AgentContract[]; invoices: StandaloneInvoice[]; commissions: CommissionConfirmation[];
  view: LibraryView; onViewChange: (view: LibraryView) => void; onOpen: (entry: ContractLibraryEntry) => void;
  onCreate: () => void; busy: boolean; loading: boolean; tenantName?: string;
}) {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const tc = t.contracts;
  const copy = tc.screen.library;
  const entries = useMemo(() => contractLibraryEntries(contracts, invoices, commissions), [contracts, invoices, commissions]);
  const visible = filterContractLibrary(entries, view);
  const pending = entries.filter(entry => entry.state === 'attention');
  const formatDate = (value: string | null | undefined) => value && !Number.isNaN(Date.parse(value))
    ? new Date(`${value}T00:00:00`).toLocaleDateString(localeTag(locale), { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const label = (type: string): string => {
    if (type === 'booking_invoice') return copy.bookingInvoice;
    if (type === 'invoice') return tc.picker.invoice;
    if (type === 'receipt') return copy.receipt;
    if (type === 'agent_commission') return copy.commission;
    return tc.common.kinds[type as keyof typeof tc.common.kinds];
  };
  const chip = (text: string, selected: boolean, onPress: () => void, key: string) => (
    <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
      style={({ pressed }) => [s.chip, selected && s.chipSelected, { opacity: pressed ? 0.7 : 1 }]}>
      <Text style={[s.small, selected ? s.selectedText : s.muted]}>{text}</Text>
    </Pressable>
  );
  const entryCard = (entry: ContractLibraryEntry) => {
    let number: string, person: string, detail = '', reference = '', status: string, amount: number | null = null;
    if (entry.kind === 'contract' || entry.kind === 'booking_invoice' || entry.kind === 'booking_receipt') {
      const c = entry.value;
      number = entry.kind === 'contract' ? c.contractNo : entry.kind === 'booking_invoice' ? c.reservationPayment!.invoiceDocumentNo : c.reservationPayment!.receiptDocumentNo!;
      person = c.tenant;
      detail = [c.property, c.room && fillTemplate(tc.common.room, { room: c.room })].filter(Boolean).join(' · ');
      if (entry.kind !== 'contract') { amount = c.reservationPayment!.total; reference = c.contractNo; }
      else amount = c.formKind === 'reservation' ? c.reservationFee : c.formKind === 'broker_appointment' ? null : c.monthlyRent;
      status = entry.kind === 'contract' ? tc.common.status[c.status] : entry.kind === 'booking_receipt' ? tc.payment.status.paid
        : entry.state === 'closed' ? tc.payment.closed : c.reservationPayment!.status === 'paid' ? tc.payment.status.paid
        : c.reservationPayment!.status === 'submitted' ? tc.payment.submittedShort : tc.payment.unpaidShort;
    } else if (entry.kind === 'invoice' || entry.kind === 'receipt') {
      number = entry.kind === 'receipt' ? entry.value.receiptDocumentNo! : entry.value.documentNo;
      person = entry.value.customerName;
      amount = entry.value.total;
      if (entry.kind === 'receipt') reference = entry.value.documentNo;
      status = entry.value.receiptDocumentNo ? tc.payment.status.paid : tc.payment.unpaidShort;
    } else {
      number = entry.value.documentNo; person = entry.value.landlordName; detail = entry.value.tenantName || '';
      status = entry.value.pdfUrl ? copy.active : copy.attention;
    }
    const unavailable = entry.kind === 'commission' && !entry.value.pdfUrl;
    const lease = entry.kind === 'contract' && (entry.value.formKind === 'lease' || entry.value.formKind === 'renewal');
    const date = lease ? [formatDate(entry.value.startDate), formatDate(entry.value.effectiveEndDate || entry.value.endDate)].filter(Boolean).join(' – ') : formatDate(entry.date);
    const amountText = amount == null ? '' : `฿${amount.toLocaleString(localeTag(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return <Pressable key={entry.key} accessibilityRole="button" accessibilityLabel={`${label(entry.type)} ${number}`}
      accessibilityState={{ disabled: busy || unavailable }} disabled={busy || unavailable} onPress={() => onOpen(entry)}
      android_ripple={{ color: 'rgba(33,30,30,0.08)' }}
      style={({ pressed }) => [s.document, cardShadow, { opacity: pressed || busy || unavailable ? 0.65 : 1 }]}>
      <View style={s.row}>
        <Text style={[s.small, s.muted, s.flex]}>{label(entry.type)}</Text>
        <View style={[s.badge, entry.state === 'attention' ? s.waitBadge : entry.state === 'closed' ? s.closedBadge : s.readyBadge]}>
          <Text style={[s.badgeText, { color: entry.state === 'attention' ? '#92400E' : entry.state === 'closed' ? '#64748B' : '#16734B' }]}>{status}</Text>
        </View>
      </View>
      <Text style={s.documentNo}>{number}</Text>
      <Text style={s.body}>{person}</Text>
      {!!detail && <Text style={[s.small, s.muted]}>{detail}</Text>}
      {!!reference && <Text style={[s.small, s.muted]}>{fillTemplate(copy.reference, { no: reference })}</Text>}
      <Text style={[s.small, s.muted]}>{date}</Text>
      <View style={s.row}>
        <Text style={[s.amount, s.flex]}>{lease ? fillTemplate(tc.common.perMonth, { amount: amountText || tc.common.notSpecified }) : amountText}</Text>
        <MobileIcon name="chevron-right" size={18} color="#64748B" />
      </View>
    </Pressable>;
  };
  const totalLabel = loading ? '…' : fillTemplate(copy.documentCount, { count: entries.length });
  return <View style={s.root}>
    {view.folder == null ? <>
      <DetailCard>
        <View style={s.person}>
          <View style={s.avatar}>
            {tenantName ? <Text style={s.avatarText}>{initials(tenantName)}</Text> : <MobileIcon name="files" size={24} color={tokens.colors.onBrand} />}
          </View>
          <View style={[ps.grow, s.personCopy]}>
            <Text style={[s.name, { color: theme.textHeading }]} numberOfLines={2}>{tenantName || copy.title}</Text>
            {!loading && pending.length > 0 && (
              <MobileStatusPill label={copy.attention} tone="yellow" style={s.pill} />
            )}
          </View>
        </View>
        <View style={ps.row}>
          <MobileIcon name="file-text" size={16} color={theme.textSecondary} />
          <Text style={[ps.body, ps.grow, { color: theme.textSecondary }]} numberOfLines={2}>
            {tenantName ? copy.title : copy.hint}
          </Text>
        </View>
        <View style={[s.actionRow, { borderTopColor: theme.border }]}>
          <Text style={[ps.value, ps.grow, { color: theme.textHeading }]}>{totalLabel}</Text>
          <MobileButton disabled={busy} onPress={onCreate} style={s.createButton}>{copy.create}</MobileButton>
        </View>
      </DetailCard>
      <DetailCard style={s.menu}>
        {folders.map((folder, index) => {
          const rows = entries.filter(entry => entry.folder === folder.key);
          const attention = rows.some(entry => entry.state === 'attention');
          const countLabel = loading ? '…' : fillTemplate(copy.documentCount, { count: rows.length });
          return (
            <DetailMenuRow
              key={folder.key}
              icon={folder.icon}
              title={copy[folder.key]}
              summary={copy[folder.hint]}
              pill={loading ? null : { label: countLabel, tone: attention ? 'yellow' : rows.length ? 'green' : 'slate' }}
              last={index === folders.length - 1}
              onPress={() => onViewChange({ ...emptyLibraryView(), folder: folder.key })}
            />
          );
        })}
      </DetailCard>
    </> : <View style={s.stack}>
      <MobileButton variant="outline" onPress={() => onViewChange(emptyLibraryView())}>{copy.back}</MobileButton>
      <View style={s.row}><Text style={[s.sectionTitle, s.flex]}>{copy[view.folder]}</Text><Text style={s.count}>{loading ? '…' : fillTemplate(copy.results, { count: visible.length })}</Text></View>
      <MobileInput accessibilityLabel={copy.searchLabel} placeholder={copy.search} value={view.query} onChangeText={query => onViewChange({ ...view, query })} />
      <View style={s.chips}>{['all', ...types[view.folder]].map(type => chip(type === 'all' ? copy.all : label(type), view.type === type, () => onViewChange({ ...view, type }), type))}</View>
      <Text style={[s.small, s.muted]}>{copy.status}</Text>
      <View style={s.chips}>{(['all', 'attention', 'active', 'closed'] as LibraryStatus[]).map(status => chip(copy[status], view.status === status, () => onViewChange({ ...view, status }), status))}</View>
      {view.folder === 'finance' && <View style={s.hint}><Text style={[s.small, s.muted]}>{copy.autoFinanceHint}</Text><Text style={[s.small, s.muted]}>{copy.rentBillsHint}</Text></View>}
      {!loading && (visible.length ? visible.map(entryCard) : <Text style={[s.body, s.muted, s.empty]}>{copy.empty}</Text>)}
    </View>}
  </View>;
}

const s = StyleSheet.create({
  root: { gap: 16, paddingBottom: 24 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  personCopy: { gap: 6 },
  avatar: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: tokens.colors.brand[100],
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    fontFamily: tokens.typography.native.headingTh, fontSize: 22, lineHeight: 32, color: tokens.colors.onBrand,
  },
  name: { fontFamily: tokens.typography.native.headingTh, fontSize: 20, lineHeight: 30 },
  pill: { alignSelf: 'flex-start' },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12,
  },
  createButton: { flexShrink: 0 },
  menu: { padding: 0, gap: 0 },
  stack: { gap: 12 }, flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  sectionTitle: { fontFamily: tokens.typography.native.headingTh, fontSize: 18, lineHeight: 28, color: '#263343' },
  body: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 23, color: '#334155' },
  small: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 20, color: '#334155' },
  muted: { color: '#64748B' },
  count: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 20, color: '#A66B00', flexShrink: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  chipSelected: { backgroundColor: '#FFF6DC', borderColor: '#F8B615' }, selectedText: { color: '#805300' },
  document: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, padding: 16, gap: 6, backgroundColor: '#FFFFFF' },
  documentNo: { fontFamily: tokens.typography.native.headingTh, fontSize: 17, lineHeight: 27, color: '#263343' },
  amount: { fontFamily: tokens.typography.native.headingTh, fontSize: 14, lineHeight: 21, color: '#263343' },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 }, waitBadge: { backgroundColor: '#FFF6DC' }, readyBadge: { backgroundColor: '#EAF6EF' }, closedBadge: { backgroundColor: '#F1F5F9' },
  badgeText: { fontFamily: tokens.typography.native.body, fontSize: 11, lineHeight: 18 },
  hint: { padding: 14, borderRadius: 12, gap: 6, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' }, empty: { textAlign: 'center', paddingVertical: 28 },
});
