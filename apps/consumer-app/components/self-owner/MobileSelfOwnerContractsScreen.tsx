import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { MobileIcon, MobileInput, tokens, useMobileTheme } from '@nestyk/ui/native';
import { interpolate } from '@nestyk/feature-listing';
import { StatusBadge } from '../agent-web/ui/StatusBadge';
import type { StatusIntent } from '../agent-web/ui/statusIntent';
import { SELF_OWNER_LOCALE_TAG } from '../../lib/self-owner-dashboard';
import {
  countSelfOwnerContracts,
  filterSelfOwnerContracts,
  type SelfOwnerContract,
  type SelfOwnerContractFilter,
  type SelfOwnerContractStatus,
} from '../../lib/self-owner-contracts';
import type { SelfOwnerContractsPageProps } from './SelfOwnerContractsPage.types';

const FILTERS: SelfOwnerContractFilter[] = ['all', 'awaiting_signature', 'ending_soon', 'active', 'ended'];
const STATUS_INTENT: Record<SelfOwnerContractStatus, StatusIntent> = { active: 'done', ending_soon: 'attn', awaiting_signature: 'prog', ended: 'neutral' };
const { subtle } = tokens.colors;

function useFormat() {
  const { t, locale } = useLocale();
  const tag = SELF_OWNER_LOCALE_TAG[locale as keyof typeof SELF_OWNER_LOCALE_TAG] ?? SELF_OWNER_LOCALE_TAG.th;
  const money = (amount: number) => t.agent.listings.rentAmount.replace('{price}', amount.toLocaleString(tag));
  const day = (ymd: string) =>
    new Date(`${ymd}T00:00:00+07:00`).toLocaleDateString(tag, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' });
  return { money, day };
}

/** Read-only contract details on the phone (the owner cannot change or sign anything, Jom 24 Nov 2026). */
export function MobileSelfOwnerContractDetail({ contract, onClose }: { contract: SelfOwnerContract; onClose: () => void }) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const so = t.selfOwnerContracts;
  const { money, day } = useFormat();
  const ink = theme.screenTitle;
  const muted = theme.textSecondary;
  const rows: Array<[string, string]> = [
    [so.room, `${contract.roomTitle} · ${contract.project}`],
    [so.tenant, contract.tenantName],
    [so.phone, contract.tenantPhone],
    [so.startDate, day(contract.startDate)],
    [so.endDate, day(contract.endDate)],
    [so.monthlyRent, money(contract.monthlyRent)],
    [so.advanceRent, interpolate(so.monthsAmount, { months: contract.advanceRentMonths, amount: money(contract.monthlyRent * contract.advanceRentMonths) })],
    [so.deposit, interpolate(so.monthsAmount, { months: contract.depositMonths, amount: money(contract.monthlyRent * contract.depositMonths) })],
  ];
  return (
    <View style={[styles.sheet, { backgroundColor: theme.background }]}>
      <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: ink }]} numberOfLines={1}>{so.detailTitle}</Text>
        <Pressable
          testID="soc-close"
          accessibilityRole="button"
          accessibilityLabel={t.agent.dashboard.webWorkspace.close}
          onPress={onClose}
          hitSlop={8}
        >
          <MobileIcon name="close" size={20} color={ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.sheetBody}>
        <View style={styles.row}>
          <StatusBadge label={so.status[contract.status]} intent={STATUS_INTENT[contract.status]} />
          {contract.daysLeft !== undefined ? <Text style={[styles.small, { color: muted }]}>{interpolate(so.daysLeft, { n: contract.daysLeft })}</Text> : null}
        </View>
        {rows.map(([term, value]) => (
          <View key={term} style={[styles.field, { borderBottomColor: theme.border }]}>
            <Text style={[styles.small, { color: muted }]}>{term}</Text>
            <Text style={[styles.body, { color: ink }]}>{value}</Text>
          </View>
        ))}
        <Text style={[styles.small, { color: muted }]}>{so.readOnlyNote}</Text>
        <Pressable
          testID="soc-document"
          accessibilityRole="button"
          accessibilityLabel={`${so.viewDocument}, ${so.noDocument}`}
          accessibilityState={{ disabled: true }}
          disabled
          style={[styles.outline, styles.row, { borderColor: theme.border, opacity: 0.5 }]}
        >
          <MobileIcon name="file-text" size={16} color={ink} />
          <Text style={[styles.small, { color: ink }]}>{so.viewDocument}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/**
 * Self owner contracts on the phone (UI round, 24 Nov 2026, ClickUp z8rcteng6e): search, status chips with counts and
 * contract cards; a card opens the read-only details. Demo data until NESTYK admin creates contracts.
 */
export function MobileSelfOwnerContractsScreen({ contracts, isDemoPreview, initialFilter = 'all', initialQuery = '' }: SelfOwnerContractsPageProps) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const so = t.selfOwnerContracts;
  const rooms = t.selfOwnerRooms;
  const shared = t.selfOwnerDashboard;
  const { money, day } = useFormat();
  const ink = theme.screenTitle;
  const muted = theme.textSecondary;
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<SelfOwnerContractFilter>(initialFilter);
  const [selected, setSelected] = useState<string | null>(null);
  const counts = useMemo(() => countSelfOwnerContracts(contracts), [contracts]);
  const shown = useMemo(() => filterSelfOwnerContracts(contracts, query, filter), [contracts, query, filter]);
  const open = selected ? contracts.find((c) => c.id === selected) ?? null : null;
  const small = [styles.small, { color: muted }];

  const list = () => {
    if (contracts.length === 0) return <Text style={small}>{so.empty}</Text>;
    if (shown.length === 0) {
      return (
        <View style={styles.empty}>
          <Text style={small}>{rooms.noMatch}</Text>
          <Pressable
            testID="soc-clear"
            accessibilityRole="button"
            onPress={() => {
              setQuery('');
              setFilter('all');
            }}
            style={[styles.outline, { borderColor: theme.border }]}
          >
            <Text style={[styles.small, { color: ink }]}>{rooms.clearFilters}</Text>
          </Pressable>
        </View>
      );
    }
    return shown.map((c) => (
      <Pressable
        key={c.id}
        testID={`soc-card-${c.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${so.viewDetail} ${c.roomTitle}`}
        onPress={() => setSelected(c.id)}
        style={({ pressed }: { pressed: boolean }) => [styles.card, { borderColor: theme.border, backgroundColor: theme.surface }, pressed ? styles.pressed : null]}
      >
        <View style={styles.row}>
          <Text style={[styles.body, styles.flex, { color: ink }]} numberOfLines={1}>{c.roomTitle}</Text>
          <StatusBadge label={so.status[c.status]} intent={STATUS_INTENT[c.status]} />
        </View>
        <Text style={small} numberOfLines={1}>{`${c.tenantName} · ${c.project}`}</Text>
        <View style={styles.row}>
          <Text style={[small, styles.flex]}>{interpolate(so.period, { start: day(c.startDate), end: day(c.endDate) })}</Text>
          <Text style={[styles.body, { color: ink }]}>{money(c.monthlyRent)}</Text>
        </View>
        {c.daysLeft !== undefined ? <Text style={[styles.small, { color: subtle.warningFg }]}>{interpolate(so.daysLeft, { n: c.daysLeft })}</Text> : null}
      </Pressable>
    ));
  };

  return (
    <View style={styles.root}>
      {isDemoPreview ? (
        <View testID="soc-demo" style={[styles.demo, { backgroundColor: subtle.brandBg, borderColor: tokens.colors.icon.brand }]}>
          <MobileIcon name="info" size={14} color={subtle.warningFg} />
          <Text style={[styles.small, styles.flex, { color: subtle.warningFg }]}>{shared.demoNote}</Text>
        </View>
      ) : null}
      <MobileInput value={query} placeholder={so.searchPlaceholder} accessibilityLabel={so.searchPlaceholder} onChangeText={setQuery} returnKeyType="search" />
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={so.filterLabel}>
        {FILTERS.map((key) => {
          const on = filter === key;
          return (
            <Pressable
              key={key}
              testID={`soc-filter-${key}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => setFilter(key)}
              style={[styles.chip, { borderColor: on ? ink : theme.border, backgroundColor: on ? ink : theme.surface }]}
            >
              <Text style={[styles.small, { color: on ? theme.surface : ink }]}>{key === 'all' ? so.filterAll : so.status[key]}</Text>
              <Text style={[styles.small, { color: on ? theme.surface : muted }]}>{String(counts[key])}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={small}>{interpolate(so.count, { n: shown.length })}</Text>
      <View style={styles.list}>{list()}</View>
      <Modal visible={!!open} animationType="slide" onRequestClose={() => setSelected(null)}>
        {open ? <MobileSelfOwnerContractDetail contract={open} onClose={() => setSelected(null)} /> : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12, paddingBottom: 24 },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  demo: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  list: { gap: 10 },
  card: { gap: 6, padding: 14, borderRadius: 14, borderWidth: 1 },
  pressed: { opacity: 0.85 },
  empty: { alignItems: 'flex-start', gap: 10 },
  outline: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10, borderWidth: 1 },
  sheet: { flex: 1 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  sheetBody: { gap: 12, padding: 16, paddingBottom: 40 },
  field: { gap: 2, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontFamily: tokens.typography.native.bodyBold, fontSize: 18, lineHeight: 26, flex: 1 },
  body: { fontFamily: tokens.typography.native.body, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 19 },
});
