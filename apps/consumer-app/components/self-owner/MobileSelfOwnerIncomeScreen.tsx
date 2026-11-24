import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { MobileIcon, tokens, useMobileTheme } from '@nestyk/ui/native';
import { interpolate } from '@nestyk/feature-listing';
import { StatusBadge } from '../agent-web/ui/StatusBadge';
import type { StatusIntent } from '../agent-web/ui/statusIntent';
import { SELF_OWNER_LOCALE_TAG, summarizeRent } from '../../lib/self-owner-dashboard';
import { selfOwnerRentForMonth, type SelfOwnerRent, type SelfOwnerRentState } from '../../lib/self-owner-contracts';
import type { SelfOwnerIncomePageProps } from './SelfOwnerIncomePage.types';

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
export function MobileSelfOwnerIncomeScreen({ contracts, months, isDemoPreview, initialMonth, now }: SelfOwnerIncomePageProps) {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const inc = t.selfOwnerIncome;
  const shared = t.selfOwnerDashboard;
  const tag = SELF_OWNER_LOCALE_TAG[locale as keyof typeof SELF_OWNER_LOCALE_TAG] ?? SELF_OWNER_LOCALE_TAG.th;
  const ink = theme.screenTitle;
  const muted = theme.textSecondary;
  const [index, setIndex] = useState(() => indexOf(months, initialMonth));
  const shownMonth = months[index] ?? months[months.length - 1];
  const rows = useMemo(
    () => (shownMonth ? selfOwnerRentForMonth(contracts, shownMonth.year, shownMonth.month, now) : []),
    [contracts, shownMonth, now],
  );
  const sum = summarizeRent(rows);
  const money = (amount: number) => t.agent.listings.rentAmount.replace('{price}', amount.toLocaleString(tag));
  const day = (ymd: string) => new Date(`${ymd}T00:00:00+07:00`).toLocaleDateString(tag, { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' });
  const monthLabel = shownMonth
    ? new Date(Date.UTC(shownMonth.year, shownMonth.month - 1, 15)).toLocaleDateString(tag, { month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' })
    : '';
  const stateText = (row: SelfOwnerRent) => (row.state === 'overdue' ? interpolate(inc.overdue, { n: row.overdueDays ?? 0 }) : inc[row.state]);
  const small = [styles.small, { color: muted }];

  const navButton = (label: string, icon: 'chevron-left' | 'chevron-right', next: number) => {
    const disabled = next < 0 || next >= months.length;
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
        <Text style={[styles.title, { color: ink }]} accessibilityLiveRegion="polite">{monthLabel}</Text>
        {navButton(inc.nextMonth, 'chevron-right', index + 1)}
      </View>
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
      <View style={styles.list}>
        {rows.length === 0 ? (
          <Text style={small}>{inc.empty}</Text>
        ) : (
          rows.map((r) => (
            <View key={r.id} testID={`soi-row-${r.id}`} style={[styles.card, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <View style={styles.row}>
                <Text style={[styles.body, styles.flex, { color: ink }]} numberOfLines={1}>{r.roomTitle}</Text>
                <Text style={[styles.body, { color: ink }]}>{money(r.amount)}</Text>
              </View>
              <Text style={small} numberOfLines={1}>{r.tenantName}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12, paddingBottom: 24 },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  demo: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  month: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  navBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1 },
  summary: { gap: 8 },
  tile: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  amount: { fontFamily: tokens.typography.native.bodyBold, fontSize: 17, lineHeight: 24 },
  list: { gap: 10 },
  card: { gap: 6, padding: 14, borderRadius: 14, borderWidth: 1 },
  title: { fontFamily: tokens.typography.native.bodyBold, fontSize: 18, lineHeight: 26, flex: 1, textAlign: 'center' },
  body: { fontFamily: tokens.typography.native.body, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 19 },
});
