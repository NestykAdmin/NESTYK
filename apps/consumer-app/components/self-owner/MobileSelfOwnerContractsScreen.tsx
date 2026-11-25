import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { MobileIcon, MobileInput, tokens, useMobileTheme } from '@nestyk/ui/native';
import { interpolate } from '@nestyk/feature-listing';
import { StatusBadge } from '../agent-web/ui/StatusBadge';
import type { StatusIntent } from '../agent-web/ui/statusIntent';
import { SELF_OWNER_LOCALE_TAG } from '../../lib/self-owner-dashboard';
import {
  countSelfOwnerRooms,
  filterSelfOwnerRooms,
  groupSelfOwnerContracts,
  isFulfilledReservation,
  isRentContract,
  selfOwnerToday,
  type SelfOwnerContract,
  type SelfOwnerContractFilter,
  type SelfOwnerContractStatus,
  type SelfOwnerRoomContracts,
} from '../../lib/self-owner-contracts';
import { contractDetailView, contractParty } from './contract-detail-rows';
import { MobileSelfOwnerPager } from './MobileSelfOwnerPager';
import { SELF_OWNER_ROOMS_PAGE_SIZE, clampPage } from '../../lib/self-owner-rooms';
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

/**
 * All contracts of one room on the phone (contract kinds, Jom 24 Nov 2026): the list, newest first; a contract opens
 * its read-only details with a back button to the list. The owner cannot change or sign anything.
 */
export function MobileSelfOwnerRoomContracts({
  room,
  all,
  onClose,
  initialContractId = null,
  now,
}: {
  room: SelfOwnerRoomContracts;
  /** Every contract, to find the one a renewal renews. */
  all: SelfOwnerContract[];
  onClose: () => void;
  initialContractId?: string | null;
  /** "Today" for the progress bar; defaults to now. */
  now?: Date;
}) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const so = t.selfOwnerContracts;
  const fmt = useFormat();
  const ink = theme.screenTitle;
  const muted = theme.textSecondary;
  const [selectedId, setSelectedId] = useState<string | null>(initialContractId);
  const open = selectedId ? room.contracts.find((c) => c.id === selectedId) ?? null : null;
  const period = (c: SelfOwnerContract) => interpolate(so.period, { start: fmt.day(c.startDate), end: fmt.day(c.endDate) });
  const status = (c: SelfOwnerContract) => (
    <View style={styles.row}>
      <StatusBadge label={isFulfilledReservation(c) ? so.fulfilled : so.status[c.status]} intent={STATUS_INTENT[c.status]} />
      {c.daysLeft !== undefined ? <Text style={[styles.small, { color: muted }]}>{interpolate(so.daysLeft, { n: c.daysLeft })}</Text> : null}
    </View>
  );

  return (
    <View style={[styles.sheet, { backgroundColor: theme.background }]}>
      <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
        {open ? (
          <Pressable testID="soc-back" accessibilityRole="button" accessibilityLabel={so.back} onPress={() => setSelectedId(null)} hitSlop={8}>
            <MobileIcon name="chevron-left" size={20} color={ink} />
          </Pressable>
        ) : null}
        <Text style={[styles.title, { color: ink }]} numberOfLines={1}>
          {open ? so.kind[open.kind] : interpolate(so.roomContractsTitle, { room: room.roomTitle })}
        </Text>
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
        {open ? (
          (() => {
            // Layout A (Jom 24 Nov 2026): period and progress, the other party, money tiles, then the rest.
            const view = contractDetailView(open, all, so, fmt, selfOwnerToday(now));
            return (
              <>
                <View style={styles.row}>
                  <View style={[styles.kind, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.small, { color: ink }]}>{so.kind[open.kind]}</Text>
                  </View>
                  <StatusBadge label={isFulfilledReservation(open) ? so.fulfilled : so.status[open.status]} intent={STATUS_INTENT[open.status]} />
                </View>
                <View>
                  <Text style={[styles.period, { color: ink }]}>{view.period}</Text>
                  <Text style={[styles.small, { color: muted }]}>{view.room}</Text>
                </View>
                {view.progress ? (
                  <View testID="soc-progress" accessibilityRole="progressbar" accessibilityLabel={view.progressLabel} accessibilityValue={{ min: 1, max: view.progress.months, now: view.progress.month }}>
                    <View style={[styles.track, { backgroundColor: theme.border }]}>
                      <View style={[styles.bar, { width: `${Math.round(view.progress.ratio * 100)}%` }]} />
                    </View>
                    <View style={[styles.row, styles.between]}>
                      <Text style={[styles.small, { color: muted }]}>{view.progressLabel}</Text>
                      <Text style={[styles.small, { color: muted }]}>{interpolate(so.daysLeft, { n: view.progress.daysLeft })}</Text>
                    </View>
                  </View>
                ) : null}
                <View style={[styles.party, { borderColor: theme.border }]}>
                  <View style={styles.avatar}>
                    <Text style={[styles.body, { color: tokens.colors.icon.brand }]}>{view.party.initial}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.body, { color: ink }]} numberOfLines={2}>{view.party.name}</Text>
                    <Text style={[styles.small, { color: muted }]}>{view.party.role}</Text>
                  </View>
                  {view.party.phone ? <Text style={[styles.small, { color: muted }]}>{view.party.phone}</Text> : null}
                </View>
                <View style={styles.tiles}>
                  {view.tiles.map((tile) => (
                    <View key={tile.label} testID={`soc-tile-${tile.label}`} style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      <Text style={[styles.small, { color: muted }]}>{tile.label}</Text>
                      <Text style={[styles.tileValue, { color: ink }]}>{tile.value}</Text>
                      {tile.note ? <Text style={[styles.small, { color: muted }]}>{tile.note}</Text> : null}
                    </View>
                  ))}
                </View>
                {view.extra.map(([term, value]) => (
                  <View key={term} style={[styles.row, styles.between]}>
                    <Text style={[styles.small, { color: muted }]}>{term}</Text>
                    <Text style={[styles.body, { color: ink }]}>{value}</Text>
                  </View>
                ))}
                {view.renewsFrom ? (
                  <Pressable
                    testID="soc-renews-from"
                    accessibilityRole="button"
                    accessibilityLabel={view.renewsFrom.label}
                    onPress={() => setSelectedId(view.renewsFrom!.id)}
                    style={[styles.outline, styles.row, { borderColor: theme.border }]}
                  >
                    <MobileIcon name="files" size={16} color={muted} />
                    <Text style={[styles.small, styles.flex, { color: ink }]}>{view.renewsFrom.label}</Text>
                    <MobileIcon name="chevron-right" size={16} color={muted} />
                  </Pressable>
                ) : null}
                <View style={styles.row}>
                  <MobileIcon name="lock" size={14} color={muted} />
                  <Text style={[styles.small, styles.flex, { color: muted }]}>{so.readOnlyNote}</Text>
                </View>
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
              </>
            );
          })()
        ) : (
          <>
            <Text style={[styles.small, { color: muted }]}>{room.project}</Text>
            {room.contracts.map((c) => (
              <Pressable
                key={c.id}
                testID={`soc-contract-${c.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${so.viewDetail} ${so.kind[c.kind]} ${period(c)}`}
                onPress={() => setSelectedId(c.id)}
                style={({ pressed }: { pressed: boolean }) => [styles.card, { borderColor: theme.border, backgroundColor: theme.surface }, pressed ? styles.pressed : null]}
              >
                <View style={styles.row}>
                  <Text style={[styles.body, styles.flex, { color: ink }]} numberOfLines={1}>{so.kind[c.kind]}</Text>
                  <MobileIcon name="chevron-right" size={16} color={muted} />
                </View>
                <Text style={[styles.small, { color: muted }]}>{period(c)}</Text>
                {contractParty(c) ? <Text style={[styles.small, { color: muted }]} numberOfLines={1}>{contractParty(c)}</Text> : null}
                {status(c)}
              </Pressable>
            ))}
            <Text style={[styles.small, { color: muted }]}>{so.readOnlyNote}</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * Self owner contracts on the phone (UI round, 24 Nov 2026, ClickUp z8rcteng6e): search, status chips with counts and
 * one card per room (contract kinds, Jom 24 Nov 2026); a card opens all the room's contracts. Demo data until NESTYK
 * admin creates contracts.
 */
export function MobileSelfOwnerContractsScreen({ contracts, isDemoPreview, initialFilter = 'all', initialQuery = '', initialPage = 1 }: SelfOwnerContractsPageProps) {
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
  const [page, setPage] = useState(initialPage);
  const roomList = useMemo(() => groupSelfOwnerContracts(contracts), [contracts]);
  const counts = useMemo(() => countSelfOwnerRooms(roomList), [roomList]);
  const results = useMemo(() => filterSelfOwnerRooms(roomList, query, filter), [roomList, query, filter]);
  // Ten rooms a page, like "my rooms" (Jom 25 Nov 2026); a search or filter starts again from page 1.
  const pages = Math.max(1, Math.ceil(results.length / SELF_OWNER_ROOMS_PAGE_SIZE));
  const current = clampPage(page, results.length);
  const shown = results.slice((current - 1) * SELF_OWNER_ROOMS_PAGE_SIZE, current * SELF_OWNER_ROOMS_PAGE_SIZE);
  const open = selected ? roomList.find((room) => room.roomId === selected) ?? null : null;
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
              setPage(1);
            }}
            style={[styles.outline, { borderColor: theme.border }]}
          >
            <Text style={[styles.small, { color: ink }]}>{rooms.clearFilters}</Text>
          </Pressable>
        </View>
      );
    }
    // One card per room with its current contract (contract kinds, Jom 24 Nov 2026); a card opens all its contracts.
    return shown.map((r) => {
      const c = r.current;
      const rent = isRentContract(c);
      const tenant = rent && c.tenantName ? c.tenantName : '-';
      return (
        <Pressable
          key={r.roomId}
          testID={`soc-card-${r.roomId}`}
          accessibilityRole="button"
          accessibilityLabel={`${so.viewDetail} ${r.roomTitle}`}
          onPress={() => setSelected(r.roomId)}
          style={({ pressed }: { pressed: boolean }) => [styles.card, { borderColor: theme.border, backgroundColor: theme.surface }, pressed ? styles.pressed : null]}
        >
          <View style={styles.row}>
            <Text style={[styles.body, styles.flex, { color: ink }]} numberOfLines={1}>{r.roomTitle}</Text>
            <StatusBadge label={so.status[c.status]} intent={STATUS_INTENT[c.status]} />
          </View>
          <Text style={small} numberOfLines={1}>{`${tenant} · ${r.project}`}</Text>
          <View style={styles.row}>
            <Text style={[small, styles.flex]}>{`${so.kind[c.kind]} · ${interpolate(so.period, { start: day(c.startDate), end: day(c.endDate) })}`}</Text>
            <Text style={[styles.body, { color: ink }]}>{rent ? money(c.monthlyRent) : '-'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[small, styles.flex]}>{interpolate(so.contractCount, { n: r.contracts.length })}</Text>
            {c.daysLeft !== undefined ? <Text style={[styles.small, { color: subtle.warningFg }]}>{interpolate(so.daysLeft, { n: c.daysLeft })}</Text> : null}
          </View>
        </Pressable>
      );
    });
  };

  return (
    <View style={styles.root}>
      {isDemoPreview ? (
        <View testID="soc-demo" style={[styles.demo, { backgroundColor: subtle.brandBg, borderColor: tokens.colors.icon.brand }]}>
          <MobileIcon name="info" size={14} color={subtle.warningFg} />
          <Text style={[styles.small, styles.flex, { color: subtle.warningFg }]}>{shared.demoNote}</Text>
        </View>
      ) : null}
      <MobileInput value={query} placeholder={so.searchPlaceholder} accessibilityLabel={so.searchPlaceholder} onChangeText={(text) => {
          setQuery(text);
          setPage(1);
        }} returnKeyType="search" />
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={so.filterLabel}>
        {FILTERS.map((key) => {
          const on = filter === key;
          return (
            <Pressable
              key={key}
              testID={`soc-filter-${key}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => {
                setFilter(key);
                setPage(1);
              }}
              style={[styles.chip, { borderColor: on ? ink : theme.border, backgroundColor: on ? ink : theme.surface }]}
            >
              <Text style={[styles.small, { color: on ? theme.surface : ink }]}>{key === 'all' ? so.filterAll : so.status[key]}</Text>
              <Text style={[styles.small, { color: on ? theme.surface : muted }]}>{String(counts[key])}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={small}>{interpolate(so.count, { n: results.length })}</Text>
      <View style={styles.list}>{list()}</View>
      <MobileSelfOwnerPager current={current} pages={pages} onPage={(next) => setPage(clampPage(next, results.length))} testIDPrefix="soc-page" />
      <Modal visible={!!open} animationType="slide" onRequestClose={() => setSelected(null)}>
        {open ? <MobileSelfOwnerRoomContracts room={open} all={contracts} onClose={() => setSelected(null)} /> : null}
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
  between: { justifyContent: 'space-between' },
  kind: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  period: { fontFamily: tokens.typography.native.bodyBold, fontSize: 18, lineHeight: 26 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  bar: { height: 6, borderRadius: 3, backgroundColor: tokens.colors.icon.brand },
  party: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: subtle.brandBg },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexGrow: 1, flexBasis: '30%', minWidth: 96, gap: 2, padding: 10, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  tileValue: { fontFamily: tokens.typography.native.bodyBold, fontSize: 16, lineHeight: 22 },
  title: { fontFamily: tokens.typography.native.bodyBold, fontSize: 18, lineHeight: 26, flex: 1 },
  body: { fontFamily: tokens.typography.native.body, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 19 },
});
