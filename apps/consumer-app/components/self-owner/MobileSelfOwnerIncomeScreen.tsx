import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { MobileIcon, tokens, useMobileTheme } from '@nestyk/ui/native';
import { interpolate } from '@nestyk/feature-listing';
import { StatusBadge } from '../agent-web/ui/StatusBadge';
import type { StatusIntent } from '../agent-web/ui/statusIntent';
import { SELF_OWNER_LOCALE_TAG, summarizeRent } from '../../lib/self-owner-dashboard';
import {
  SELF_OWNER_RENT_FILTERS,
  countSelfOwnerRent,
  filterSelfOwnerRent,
  selfOwnerRentForMonth,
  type SelfOwnerRent,
  type SelfOwnerRentFilter,
  type SelfOwnerRentState,
} from '../../lib/self-owner-contracts';
import type { SelfOwnerIncomePageProps } from './SelfOwnerIncomePage.types';
import { LeadSelectField } from '../LeadSelectField';
import { MobileSelfOwnerPager } from './MobileSelfOwnerPager';
import { MobileSkeletonCards } from './MobileSkeletonCards';
import { MobileLoadError } from './MobileLoadError';
import { SELF_OWNER_ROOMS_PAGE_SIZE, clampPage } from '../../lib/self-owner-rooms';

const STATE_INTENT: Record<SelfOwnerRentState, StatusIntent> = { paid: 'done', due: 'neutral', overdue: 'crit' };
const { subtle } = tokens.colors;

function indexOf(months: SelfOwnerIncomePageProps['months'], month?: SelfOwnerIncomePageProps['initialMonth']): number {
  const found = month ? months.findIndex((m) => m.year === month.year && m.month === month.month) : -1;
  return found >= 0 ? found : Math.max(0, months.length - 1);
}

/**
 * Self owner income on the phone (UI round, 24 Nov 2026, ClickUp z8rcteng6f): pick a month, see the total, received
 * and overdue rent, and which rooms paid. Read only; demo data, same rows as the Dashboard's rent section.
 */
export function MobileSelfOwnerIncomeScreen({ contracts, months, isDemoPreview, initialMonth, now, initialFilter = 'all', initialPage = 1, status = 'demo', onRetry }: SelfOwnerIncomePageProps) {
  // Amounts, rows and month changes only once the rent is in (Jom 25 Nov 2026).
  const ready = status !== 'loading' && status !== 'error';
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const inc = t.selfOwnerIncome;
  const shared = t.selfOwnerDashboard;
  const roomsCopy = t.selfOwnerRooms;
  const tag = SELF_OWNER_LOCALE_TAG[locale as keyof typeof SELF_OWNER_LOCALE_TAG] ?? SELF_OWNER_LOCALE_TAG.th;
  const ink = theme.screenTitle;
  const muted = theme.textSecondary;
  const [index, setMonthIndex] = useState(() => indexOf(months, initialMonth));
  const [page, setPage] = useState(initialPage);
  // The status filter stays when the month changes, to follow overdue rooms month by month (Jom 25 Nov 2026).
  const [filter, setFilter] = useState<SelfOwnerRentFilter>(initialFilter);
  // Another month starts again from page 1.
  const setIndex = (next: number) => {
    setMonthIndex(next);
    setPage(1);
  };
  const shownMonth = months[index] ?? months[months.length - 1];
  const rows = useMemo(
    () => (shownMonth ? selfOwnerRentForMonth(contracts, shownMonth.year, shownMonth.month, now) : []),
    [contracts, shownMonth, now],
  );
  // The summary adds up the whole month, whatever the filter; the list shows ten rows a page, like "my rooms" (Jom 25 Nov 2026).
  const sum = summarizeRent(rows);
  const counts = countSelfOwnerRent(rows);
  const shown = filterSelfOwnerRent(rows, filter);
  const pages = Math.max(1, Math.ceil(shown.length / SELF_OWNER_ROOMS_PAGE_SIZE));
  const current = clampPage(page, shown.length);
  const pageRows = shown.slice((current - 1) * SELF_OWNER_ROOMS_PAGE_SIZE, current * SELF_OWNER_ROOMS_PAGE_SIZE);
  const pickFilter = (next: SelfOwnerRentFilter) => {
    setFilter(next);
    setPage(1);
  };
  const filterName = (key: SelfOwnerRentFilter) => (key === 'all' ? roomsCopy.filterAll : key === 'overdue' ? inc.filterOverdue : inc[key]);
  const money = (amount: number) => t.agent.listings.rentAmount.replace('{price}', amount.toLocaleString(tag));
  const day = (ymd: string) => new Date(`${ymd}T00:00:00+07:00`).toLocaleDateString(tag, { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' });
  const nameOf = (m: { year: number; month: number }) =>
    new Date(Date.UTC(m.year, m.month - 1, 15)).toLocaleDateString(tag, { month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' });
  const stateText = (row: SelfOwnerRent) => (row.state === 'overdue' ? interpolate(inc.overdue, { n: row.overdueDays ?? 0 }) : inc[row.state]);
  const small = [styles.small, { color: muted }];

  // Arrows step one month; the month itself is a select field, newest first (Jom 24 Nov 2026).
  const monthOptions = months.map((m, i) => ({ value: i, label: nameOf(m) })).reverse();
  const navButton = (label: string, icon: 'chevron-left' | 'chevron-right', next: number) => {
    const disabled = !ready || next < 0 || next >= months.length;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setIndex(next)}
        hitSlop={6}
        style={[styles.navBtn, { borderColor: theme.border, backgroundColor: theme.surface, opacity: disabled ? 0.4 : 1 }]}
      >
        <MobileIcon name={icon} size={18} color={ink} />
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      {isDemoPreview ? (
        <View testID="soi-demo" style={[styles.demo, { backgroundColor: subtle.brandBg, borderColor: tokens.colors.icon.brand }]}>
          <MobileIcon name="info" size={14} color={subtle.warningFg} />
          <Text style={[styles.small, styles.flex, { color: subtle.warningFg }]}>{shared.demoNote}</Text>
        </View>
      ) : null}
      <View style={styles.month}>
        {navButton(inc.prevMonth, 'chevron-left', index - 1)}
        <LeadSelectField
          label={inc.month}
          placeholder={inc.month}
          hideLabel
          icon="calendar"
          value={index}
          options={monthOptions}
          disabled={!ready}
          onChange={(next) => {
            if (next != null) setIndex(next);
          }}
          style={styles.flex}
        />
        {navButton(inc.nextMonth, 'chevron-right', index + 1)}
      </View>
      {status === 'loading' ? <MobileSkeletonCards count={3} lines={1} /> : null}
      {ready ? (
        <View style={styles.summary}>
          {([
            [inc.summaryTotal, sum.total, ink],
            [inc.summaryReceived, sum.received, subtle.successFg ?? ink],
            [inc.summaryOutstanding, sum.overdue, subtle.dangerFg ?? ink],
          ] as const).map(([name, amount, color]) => (
            <View key={name} style={[styles.tile, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <Text style={small}>{name}</Text>
              <Text style={[styles.amount, { color }]}>{money(amount)}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {/* Status chips with counts, like the documents page (Jom 25 Nov 2026). */}
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={roomsCopy.filterLabel}>
        {SELF_OWNER_RENT_FILTERS.map((key) => {
          const on = filter === key;
          return (
            <Pressable
              key={key}
              testID={`soi-filter-${key}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => pickFilter(key)}
              style={[styles.chip, { borderColor: on ? ink : theme.border, backgroundColor: on ? ink : theme.surface }]}
            >
              <Text style={[styles.small, { color: on ? theme.surface : ink }]}>{filterName(key)}</Text>
              {ready ? <Text style={[styles.small, { color: on ? theme.surface : muted }]}>{String(counts[key])}</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.list}>
        {status === 'loading' ? (
          <MobileSkeletonCards count={3} />
        ) : status === 'error' ? (
          <MobileLoadError onRetry={onRetry} retryTestID="soi-retry" />
        ) : rows.length === 0 ? (
          <Text style={small}>{inc.empty}</Text>
        ) : shown.length === 0 ? (
          <View style={styles.empty}>
            <Text style={small}>{roomsCopy.noMatch}</Text>
            <Pressable testID="soi-clear" accessibilityRole="button" onPress={() => pickFilter('all')} style={[styles.outline, { borderColor: theme.border }]}>
              <Text style={[styles.small, { color: ink }]}>{roomsCopy.clearFilters}</Text>
            </Pressable>
          </View>
        ) : (
          pageRows.map((r) => (
            <View key={r.id} testID={`soi-row-${r.id}`} style={[styles.card, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <View style={styles.row}>
                <Text style={[styles.body, styles.flex, { color: ink }]} numberOfLines={1}>{r.roomTitle}</Text>
                <Text style={[styles.body, { color: ink }]}>{money(r.amount)}</Text>
              </View>
              <Text style={small} numberOfLines={1}>{`${r.tenantName} · ${r.project}`}</Text>
              <View style={styles.row}>
                <StatusBadge label={stateText(r)} intent={STATE_INTENT[r.state]} />
                <Text style={[small, styles.flex]}>
                  {r.paidAt ? interpolate(inc.paidOn, { date: day(r.paidAt) }) : interpolate(inc.dueOn, { date: day(r.dueDate) })}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
      {ready ? <MobileSelfOwnerPager current={current} pages={pages} onPage={(next) => setPage(clampPage(next, shown.length))} testIDPrefix="soi-page" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12, paddingBottom: 24 },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  demo: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  month: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1 },
  summary: { gap: 8 },
  tile: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  amount: { fontFamily: tokens.typography.native.bodyBold, fontSize: 17, lineHeight: 24 },
  list: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  empty: { alignItems: 'flex-start', gap: 10 },
  outline: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10, borderWidth: 1 },
  card: { gap: 6, padding: 14, borderRadius: 14, borderWidth: 1 },
  body: { fontFamily: tokens.typography.native.body, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 19 },
});
