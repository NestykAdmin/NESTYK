import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { MobileBrandLoader, MobileButton, MobileIcon, MobileListSearchRow, ModePageScrollContext, tokens, useMobileTheme } from '@nestyk/ui/native';
import { MobileAgentDashboardBody } from '@nestyk/feature-listing';
import type { AgentDashboardData, AgentDashboardDeepLink, DashboardWorkItem, DashboardWorkKind } from '@nestyk/types';
import { fetchAgentDashboard, fetchDashboardWork } from '../lib/agent-dashboard-api';

export type DashboardNavigationMemory = { account: string; kind: DashboardWorkKind | null; query: string; page: number };
export function AgentDashboardBody({ greetingName, initials, reloadToken, onReloadSettled, onNavigate, onDetailStateChange, backRef, memoryRef, account }: {
  greetingName: string; initials: string; reloadToken: number; onReloadSettled: (token: number) => void;
  onNavigate: (link: AgentDashboardDeepLink) => void; onDetailStateChange: (title: string | null) => void;
  backRef: React.MutableRefObject<(() => void) | null>;
  memoryRef: React.MutableRefObject<DashboardNavigationMemory>; account: string;
}) {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.agent.dashboard;
  const scroll = useContext(ModePageScrollContext);
  const [data, setData] = useState<AgentDashboardData | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  if (memoryRef.current.account !== account) memoryRef.current = { account, kind: null, query: '', page: 1 };
  const [work, setWork] = useState<DashboardWorkKind | null>(memoryRef.current.kind);
  const workRef = useRef(work); workRef.current = work;
  useEffect(() => {
    let active = true, didFail = false;
    setFailed(false); setLoading(true);
    fetchAgentDashboard().then(result => { if (active) setData(result); })
      .catch(() => { if (active) { didFail = true; if (!workRef.current) setData(null); setFailed(true); } })
      .finally(() => { if (active) { setLoading(false); if (!workRef.current || didFail) onReloadSettled(reloadToken); } });
    return () => { active = false; };
  }, [reloadToken, retry, onReloadSettled]);
  const back = useCallback(() => { setWork(null); memoryRef.current = { account, kind: null, query: '', page: 1 }; onDetailStateChange(null); onReloadSettled(reloadToken); scroll?.scrollTo({ y: 0, animated: false }); }, [onDetailStateChange, onReloadSettled, reloadToken, scroll, account, memoryRef]);
  useEffect(() => { backRef.current = work ? back : null; return () => { backRef.current = null; }; }, [backRef, back, work]);
  const workTitle = work === 'rent' ? copy.rentCollection : work === 'overdue_payment' ? copy.overduePayments : work === 'renewal' ? copy.renewalSoon : copy.awaitingSignature;
  useEffect(() => { onDetailStateChange(work ? workTitle : null); return () => onDetailStateChange(null); }, [work, workTitle, onDetailStateChange]);
  const navigate = (link: AgentDashboardDeepLink) => {
    const selected = link.type === 'tab' && link.filter?.kind === 'work' ? link.filter.work : link.type === 'action' && link.id === 'viewPayments' ? 'rent' : null;
    if (selected && selected !== 'lead_follow_up' && selected !== 'renewal') { memoryRef.current = { account, kind: selected, query: '', page: 1 }; setWork(selected); scroll?.scrollTo({ y: 0, animated: false }); return; }
    onNavigate(link);
  };
  if (work && data) return <DashboardWorkList key={work} kind={work} period={data.period} memoryRef={memoryRef} reloadToken={reloadToken} onReloadSettled={onReloadSettled} onOpen={item => onNavigate({
    type: 'action', id: 'viewClient', tenantId: item.tenantId, contractId: item.contractId, section: item.billId ? (item.awaitingReview && item.status !== 'paid' ? 'payments' : 'bills') : 'contracts',
  })} />;
  if (loading) return <MobileBrandLoader />;
  if (failed || !data) return <View style={styles.body}>
    <Text accessibilityRole="alert" style={[styles.text, { color: theme.textSecondary }]}>{copy.loadFailed}</Text>
    <MobileButton onPress={() => setRetry(n => n + 1)}>{t.contracts.common.retry}</MobileButton>
  </View>;
  return <MobileAgentDashboardBody initials={initials} onNavigate={navigate} snapshot={{ ...data, isDemoPreview: false, greetingName,
    localDateLabel: new Date(`${data.today}T12:00:00+07:00`).toLocaleDateString(locale === 'th' ? 'th-TH' : locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : 'en-GB', { timeZone: 'Asia/Bangkok', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  }} />;
}
function DashboardWorkList({ kind, period, reloadToken, onReloadSettled, onOpen, memoryRef }: {
  kind: DashboardWorkKind; period: string; memoryRef: React.MutableRefObject<DashboardNavigationMemory>; reloadToken: number; onReloadSettled: (token: number) => void; onOpen: (item: DashboardWorkItem) => void;
}) {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const scroll = useContext(ModePageScrollContext);
  const [items, setItems] = useState<DashboardWorkItem[]>([]), [query, setQuery] = useState(memoryRef.current.query), [page, setPage] = useState(memoryRef.current.page), [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => { memoryRef.current = { ...memoryRef.current, kind, query, page }; }, [kind, query, page, memoryRef]);
  useEffect(() => {
    let active = true, correcting = false;
    setLoading(true); setFailed(false);
    const timer = setTimeout(() => {
      fetchDashboardWork(kind, period, query, page).then(result => {
        if (!active) return;
        const last = Math.max(1, Math.ceil(result.total / 20));
        if (page > last) { correcting = true; setPage(last); return; }
        setItems(result.items); setTotal(result.total);
      }).catch(() => { if (active) setFailed(true); }).finally(() => {
        if (active && !correcting) { setLoading(false); onReloadSettled(reloadToken); }
      });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [kind, period, query, page, reloadToken, retry, onReloadSettled]);
  const search = (value: string) => { if (value === query && page === 1) return; setLoading(true); setQuery(value); setPage(1); };
  const changePage = (value: number) => { setLoading(true); setPage(value); scroll?.scrollTo({ y: 0, animated: false }); };
  return <View style={styles.body}>
    {kind === 'rent' && <Text style={[styles.text, { color: theme.textSecondary }]}>{period} · {t.agent.dashboard.issuedBillsHint}</Text>}
    <MobileListSearchRow value={query} onChangeText={search} onClear={() => search('')} placeholder={t.contracts.screen.library.search} clearAccessibilityLabel={t.agent.tenants.clearSearch} />
    {loading ? <MobileBrandLoader /> : failed ? <>
      <Text style={[styles.text, { color: theme.textSecondary }]} accessibilityRole="alert">{t.agent.dashboard.loadFailed}</Text>
      <MobileButton onPress={() => setRetry(n => n + 1)}>{t.contracts.common.retry}</MobileButton>
    </> : <>
      <Text style={[styles.text, { color: theme.textSecondary }]}>{t.contracts.screen.library.results.replace('{count}', String(total))}</Text>
      {!items.length && <Text style={[styles.text, { color: theme.textSecondary }]}>{t.agent.dashboard.emptyActions}</Text>}
      {items.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.person}, ${item.documentNo}`} onPress={() => onOpen(item)}
        android_ripple={{ color: 'rgba(0,0,0,0.06)' }} style={({ pressed }) => [styles.card, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}>
        <MobileIcon name={item.billId ? 'note' : kind === 'renewal' ? 'calendar' : 'file-text'} size={22} color={theme.textHeading} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.title, { color: theme.textHeading }]}>{item.person}</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>{[item.property, item.room].filter(Boolean).join(' · ')}</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>{item.documentNo} · {item.date}</Text>
          {item.amount != null && <Text style={[styles.text, { color: theme.textHeading }]}>{new Intl.NumberFormat(locale, { style: 'currency', currency: 'THB' }).format(item.amount)}</Text>}
          {item.billId && <Text style={[styles.text, { color: theme.textSecondary }]}>{item.awaitingReview && item.status !== 'paid' ? t.agent.dashboard.awaitingReview : item.status === 'paid' ? t.agent.dashboard.received : item.status === 'overdue' || kind === 'overdue_payment' ? t.agent.dashboard.overdue : t.agent.dashboard.pendingPayment}</Text>}
        </View>
        <MobileIcon name="chevron-right" size={18} color={theme.textSecondary} />
      </Pressable>)}
      {total > 20 && <View style={styles.pagination}>
        <MobileButton variant="outline" disabled={page === 1} onPress={() => changePage(page - 1)}>{t.agent.leads.previous}</MobileButton>
        <Text style={[styles.text, { color: theme.textHeading }]}>{page} / {Math.ceil(total / 20)}</Text>
        <MobileButton variant="outline" disabled={page * 20 >= total} onPress={() => changePage(page + 1)}>{t.agent.leads.next}</MobileButton>
      </View>}
    </>}
  </View>;
}
const styles = StyleSheet.create({ body: { gap: 12 }, card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1 },
  text: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 21 }, title: { fontFamily: tokens.typography.native.bodyBold, fontSize: 15, lineHeight: 23 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 12 }, });
