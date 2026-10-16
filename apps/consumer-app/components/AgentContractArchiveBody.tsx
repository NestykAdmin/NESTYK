import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Animated, { SlideInRight } from 'react-native-reanimated';
import { useLocale, type ContractCopy } from '@nestyk/i18n';
import { getCardElevation, MobileBrandLoader, MobileButton, MobileIcon, MobileListSearchRow, ModePageScrollContext, tokens, useMobileTheme, type AppIconName } from '@nestyk/ui/native';
import type { ContractArchiveDetail, ContractArchiveEntry, ContractArchiveType } from '@nestyk/types';
import { ARCHIVE_PAGE_SIZE, getContractArchiveDetail, listContractArchive } from '../lib/contract-archive-api';
import { ContractDocumentPreview } from './ContractDocumentPreview';

const { boxShadow: _webShadow, ...kindCardShadow } = getCardElevation(1);

const documentTypes: Array<{ type: ContractArchiveType; icon: AppIconName; color: string; darkColor: string }> = [
  { type: 'reservation', icon: 'calendar', color: tokens.colors.brand[700], darkColor: '#FCD34D' },
  { type: 'lease', icon: 'key', color: tokens.colors.roles.owner, darkColor: '#93C5FD' },
  { type: 'renewal', icon: 'file-text', color: '#7C3AED', darkColor: '#C4B5FD' },
  { type: 'broker_appointment', icon: 'handshake', color: tokens.colors.roles.agent, darkColor: '#FDA4AF' },
  { type: 'booking_invoice', icon: 'note', color: '#EA580C', darkColor: '#FDBA74' },
  { type: 'invoice', icon: 'note', color: '#4F46E5', darkColor: '#A5B4FC' },
  { type: 'receipt', icon: 'file-text', color: '#00966C', darkColor: '#6EE7B7' },
  { type: 'agent_commission', icon: 'users', color: '#0D9488', darkColor: '#5EEAD4' },
];
export function archiveTypeLabel(type: ContractArchiveType, copy: ContractCopy): string {
  if (type === 'booking_invoice') return copy.screen.library.bookingInvoice;
  if (type === 'invoice') return copy.picker.invoice;
  if (type === 'receipt') return copy.screen.library.receipt;
  if (type === 'agent_commission') return copy.screen.library.commission;
  return copy.common.kinds[type];
}
export function AgentContractArchiveKindsBody({ onSelect }: { onSelect: (type: ContractArchiveType) => void }) {
  const { t } = useLocale();
  const { theme, isDark } = useMobileTheme();
  return <View style={styles.body}>
    <Text style={[styles.text, { color: theme.textSecondary }]}>{t.contracts.archive.choose}</Text>
    {documentTypes.map(({ type, icon, color, darkColor }) => <Pressable key={type} accessibilityRole="button"
      accessibilityLabel={`${archiveTypeLabel(type, t.contracts)}, ${t.contracts.archive.descriptions[type]}`} onPress={() => onSelect(type)}
      android_ripple={{ color: 'rgba(33,30,30,0.08)' }}
      style={({ pressed }) => [styles.card, styles.kindCard, kindCardShadow, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed && Platform.OS === 'ios' ? 0.7 : 1 }]}>
      <View style={[styles.icon, { backgroundColor: isDark ? `${darkColor}24` : `${color}14` }]}>
        <MobileIcon name={icon} size={22} color={isDark ? darkColor : color} />
      </View>
      <View style={styles.grow}>
        <Text style={[styles.title, styles.kindTitle, { color: theme.textHeading }]} numberOfLines={1}>{archiveTypeLabel(type, t.contracts)}</Text>
        <Text style={[styles.kindDescription, { color: theme.textSecondary }]} numberOfLines={1}>{t.contracts.archive.descriptions[type]}</Text>
      </View>
      <MobileIcon name="chevron-right" size={18} color={theme.textSecondary} />
    </Pressable>)}
  </View>;
}

type ArchiveProps = {
  type: ContractArchiveType;
  reloadToken: number;
  onReloadSettled: (token: number) => void;
  onDetailStateChange: (title: string | null) => void;
  detailBackRef: React.MutableRefObject<(() => void) | null>;
};
export function AgentContractArchiveBody({ type, reloadToken, onReloadSettled, onDetailStateChange, detailBackRef }: ArchiveProps) {
  const { t } = useLocale();
  const { theme, isDark } = useMobileTheme();
  const copy = t.contracts;
  const typeIcon = documentTypes.find(item => item.type === type);
  const scroll = useContext(ModePageScrollContext);
  const [items, setItems] = useState<ContractArchiveEntry[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<ContractArchiveEntry | null>(null);
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const restoreKey = useRef<string | null>(null);
  const rowRef = useRef<View | null>(null);
  useEffect(() => {
    if (selected || !restoreKey.current) return;
    if (rowRef.current) scroll?.scrollToView(rowRef, { animated: false });
    else scroll?.scrollTo({ y: 0, animated: false });
    restoreKey.current = null;
  }, [selected, scroll]);
  const close = useCallback(() => {
    setSelected(null); onDetailStateChange(null); onReloadSettled(reloadToken);
  }, [onDetailStateChange, onReloadSettled, reloadToken]);
  useEffect(() => {
    detailBackRef.current = selected ? close : null;
    return () => { detailBackRef.current = null; };
  }, [selected, close, detailBackRef]);
  useEffect(() => () => onDetailStateChange(null), [onDetailStateChange]);
  useEffect(() => {
    let active = true, correcting = false;
    setLoading(true); setFailed(false);
    const timer = setTimeout(() => {
      listContractArchive(type, query, page).then(result => {
        if (!active) return;
        const lastPage = Math.max(1, Math.ceil(result.total / ARCHIVE_PAGE_SIZE));
        if (page > lastPage) { correcting = true; setPage(lastPage); return; }
        setItems(result.items); setTotal(result.total);
      }).catch(() => { if (active) setFailed(true); }).finally(() => {
        if (!active || correcting) return;
        setLoading(false);
        if (!selectedRef.current) onReloadSettled(reloadToken);
      });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [type, query, page, retry, reloadToken, onReloadSettled]);
  const search = (value: string) => {
    if (value === query && page === 1) return;
    setLoading(true); setQuery(value); setPage(1);
  };
  const changePage = (next: number) => { setLoading(true); setPage(next); scroll?.scrollTo({ y: 0, animated: false }); };
  if (selected) return <ArchiveDetail key={selected.key} entry={selected} reloadToken={reloadToken} onReloadSettled={onReloadSettled} />;
  return <Animated.View entering={SlideInRight.duration(200)} style={styles.body}>
    <Text style={[styles.text, { color: theme.textSecondary }]}>{copy.archive.hint}</Text>
    <MobileListSearchRow value={query} onChangeText={search} onClear={() => search('')} placeholder={copy.screen.library.search} clearAccessibilityLabel={t.agent.tenants.clearSearch} />
    {loading ? <MobileBrandLoader /> : failed ? <View style={styles.body}>
      <Text accessibilityRole="alert" style={[styles.text, { color: theme.textSecondary }]}>{copy.archive.error}</Text>
      <MobileButton onPress={() => setRetry(n => n + 1)}>{copy.common.retry}</MobileButton>
    </View> : <>
      <Text style={[styles.text, { color: theme.textSecondary }]}>{copy.screen.library.results.replace('{count}', String(total))}</Text>
      {!items.length && <Text style={[styles.text, { color: theme.textSecondary }]}>{copy.screen.library.empty}</Text>}
      {items.map(item => <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.documentNo}
        ref={node => { if (item.key === restoreKey.current) rowRef.current = node; }}
        onPress={() => { restoreKey.current = item.key; setSelected(item); onDetailStateChange(item.documentNo); scroll?.scrollTo({ y: 0, animated: false }); }}
        android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
        style={({ pressed }) => [styles.card, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed && Platform.OS === 'ios' ? 0.7 : 1 }]}>
        {typeIcon && <View style={[styles.icon, { backgroundColor: isDark ? `${typeIcon.darkColor}24` : `${typeIcon.color}14` }]}>
          <MobileIcon name={typeIcon.icon} size={22} color={isDark ? typeIcon.darkColor : typeIcon.color} />
        </View>}
        <View style={[styles.grow, { gap: 4 }]}>
          <Text style={[styles.title, { color: theme.textHeading }]}>{item.documentNo}</Text>
          <Text style={[styles.text, { color: theme.textHeading }]}>{item.person || copy.common.notSpecified}</Text>
          {!!item.property && <Text style={[styles.text, { color: theme.textSecondary }]}>{[item.property, item.room].filter(Boolean).join(' · ')}</Text>}
          <Text style={[styles.text, { color: theme.textSecondary }]}>{copy.common.dated.replace('{date}', item.issueDate)}</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>{archiveStatus(item.status, copy)}</Text>
        </View>
        <MobileIcon name="chevron-right" size={18} color={theme.textSecondary} />
      </Pressable>)}
      {total > ARCHIVE_PAGE_SIZE && <View style={styles.pagination}>
        <MobileButton variant="outline" disabled={page === 1} onPress={() => changePage(page - 1)}>{t.agent.leads.previous}</MobileButton>
        <Text style={[styles.text, { color: theme.textHeading }]}>{page} / {Math.ceil(total / ARCHIVE_PAGE_SIZE)}</Text>
        <MobileButton variant="outline" disabled={page * ARCHIVE_PAGE_SIZE >= total} onPress={() => changePage(page + 1)}>{t.agent.leads.next}</MobileButton>
      </View>}
    </>}
  </Animated.View>;
}
function archiveStatus(status: string, copy: ContractCopy) {
  if (status === 'ready') return copy.archive.ready;
  if (status === 'paid' || status === 'unpaid' || status === 'submitted') return copy.payment.status[status];
  return copy.common.status[status as keyof typeof copy.common.status] || copy.common.notSpecified;
}
function ArchiveDetail({ entry, reloadToken, onReloadSettled }: { entry: ContractArchiveEntry; reloadToken: number; onReloadSettled: (token: number) => void }) {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const [detail, setDetail] = useState<ContractArchiveDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setFailed(false); setPreviewOpen(false);
    getContractArchiveDetail(entry.kind, entry.id).then(result => { if (active) setDetail(result); })
      .catch(() => { if (active) { setDetail(null); setFailed(true); } })
      .finally(() => { if (active) { setLoading(false); onReloadSettled(reloadToken); } });
    return () => { active = false; };
  }, [entry.kind, entry.id, reloadToken, retry, onReloadSettled]);
  if (loading) return <MobileBrandLoader />;
  if (failed || !detail) return <View style={styles.body}>
    <Text accessibilityRole="alert" style={[styles.text, { color: theme.textSecondary }]}>{t.contracts.archive.error}</Text>
    <MobileButton onPress={() => setRetry(n => n + 1)}>{t.contracts.common.retry}</MobileButton>
  </View>;
  const copy = t.contracts.archive;
  const fields = [[copy.no, detail.documentNo], [copy.person, detail.person], [copy.property, [detail.property, detail.room].filter(Boolean).join(' · ')],
    [copy.date, detail.issueDate], [t.contracts.screen.library.status, archiveStatus(detail.status, t.contracts)],
    [copy.amount, detail.amount == null ? '' : new Intl.NumberFormat(locale, { style: 'currency', currency: 'THB' }).format(detail.amount)]];
  return <Animated.View entering={SlideInRight.duration(200)} style={styles.body}>
    <View style={[styles.details, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.textHeading }]}>{archiveTypeLabel(detail.type, t.contracts)}</Text>
      {fields.filter(([, value]) => !!value).map(([label, value]) => <View key={label}>
        <Text style={[styles.text, { color: theme.textSecondary }]}>{label}</Text>
        <Text style={[styles.text, { color: theme.textHeading }]}>{value}</Text>
      </View>)}
      {!!detail.reference && <Text style={[styles.text, { color: theme.textSecondary }]}>{t.contracts.screen.library.reference.replace('{no}', detail.reference)}</Text>}
    </View>
    {detail.documentUrl ? <MobileButton variant="outline" onPress={() => setPreviewOpen(true)}>
      {entry.kind === 'contract' ? t.contracts.party.viewContractDocument : t.contracts.screen.viewDocument}
    </MobileButton>
      : <Text style={[styles.text, { color: theme.textSecondary }]}>{copy.unavailable}</Text>}
    <Modal visible={previewOpen} onRequestClose={() => setPreviewOpen(false)} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <SafeAreaView style={[styles.documentPage, { backgroundColor: theme.background }]}>
          <View style={styles.documentHeader}>
            <Pressable accessibilityRole="button" accessibilityLabel={t.contracts.common.closeDocument}
              onPress={() => setPreviewOpen(false)} hitSlop={4}
              android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
              style={({ pressed }) => [styles.documentClose, { opacity: pressed && Platform.OS === 'ios' ? 0.7 : 1 }]}>
              <Text style={[styles.text, { color: theme.textHeading }]}>{t.contracts.common.close}</Text>
            </Pressable>
            <Text style={[styles.documentTitle, { color: theme.textHeading }]}>
              {t.agent.contracts.previewTitle.replace('{name}', archiveTypeLabel(detail.type, t.contracts))}
            </Text>
          </View>
          {previewOpen && detail.documentUrl && <ContractDocumentPreview key={detail.documentUrl} url={detail.documentUrl} />}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  </Animated.View>;
}
const styles = StyleSheet.create({
  body: { gap: 12 }, grow: { flex: 1, minWidth: 0 },
  text: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 21 },
  title: { fontFamily: tokens.typography.native.bodyBold, fontSize: 15, lineHeight: 23 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 76, borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  kindCard: { padding: 14 },
  kindTitle: { lineHeight: 22 },
  kindDescription: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18, marginTop: 2 },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  details: { gap: 12, padding: 16, borderWidth: 1, borderRadius: 16 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 12 },
  documentPage: { flex: 1 },
  documentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16 },
  documentClose: { padding: 8 },
  documentTitle: { flex: 1, minWidth: 0, textAlign: 'right', fontFamily: tokens.typography.native.headingTh, fontSize: 18, lineHeight: 27, marginBottom: 4 },
});
