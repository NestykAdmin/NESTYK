import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import {
  AccountDeletionNotice,
  MobileButton,
  MobileIcon,
  MobileProfileAvatar,
  getCardElevation,
  tokens,
  useMobileTheme,
} from '@nestyk/ui/native';
import { interpolate, type DashboardSectionStatus } from '@nestyk/feature-listing';
import {
  SELF_OWNER_LOCALE_TAG,
  SELF_OWNER_PREVIEW,
  summarizeRent,
  summarizeRooms,
  type SelfOwnerDashboardSnapshot,
  type SelfOwnerWorkKind,
} from '../../lib/self-owner-dashboard';
import { MobileSelfOwnerRoomCard } from './MobileSelfOwnerRoomCard';

const TODO_ORDER: SelfOwnerWorkKind[] = ['overdue_rent', 'new_interest', 'awaiting_signature', 'renewal'];
const { subtle } = tokens.colors;

export type MobileSelfOwnerDashboardBodyProps = {
  snapshot: SelfOwnerDashboardSnapshot;
  initials?: string;
  deletionScheduledFor?: string | null;
  /** Opens the rooms list; without it "view all rooms" stays "coming soon". */
  onOpenRooms?: () => void;
};

/**
 * Self owner phone Dashboard (UI round, 19 Nov 2026, ClickUp z8rcteng6b). Same sections and order as the web page:
 * my rooms → rent this month → to do → today's viewings. No navigation yet; the one action is disabled.
 */
export function MobileSelfOwnerDashboardBody({ snapshot, initials = '', deletionScheduledFor, onOpenRooms }: MobileSelfOwnerDashboardBodyProps) {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.selfOwnerDashboard;
  const tag = SELF_OWNER_LOCALE_TAG[locale as keyof typeof SELF_OWNER_LOCALE_TAG] ?? SELF_OWNER_LOCALE_TAG.th;
  const isDark = theme.mode === 'dark';
  const ink = theme.screenTitle;
  const muted = theme.textSecondary;
  const accent = isDark ? tokens.colors.rolesOnDark.self_owner : tokens.colors.roles.self_owner;

  const money = (amount: number) =>
    new Intl.NumberFormat(tag, { style: 'currency', currency: snapshot.currency, maximumFractionDigits: 0 }).format(amount);
  const day = (ymd: string, withYear: boolean) =>
    new Date(`${ymd}T00:00:00+07:00`).toLocaleDateString(tag, {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' as const } : {}),
      timeZone: 'Asia/Bangkok',
    });
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' });
  const period = new Date(snapshot.rent.periodYear, snapshot.rent.periodMonth - 1, 1).toLocaleDateString(tag, {
    month: 'long',
    year: 'numeric',
  });

  const rooms = summarizeRooms(snapshot.rooms.items);
  const rent = summarizeRent(snapshot.rent.items);
  const receivedShare = rent.total > 0 ? Math.round((rent.received / rent.total) * 100) : 0;
  const todo = TODO_ORDER.map((kind) => ({ kind, count: snapshot.todo.items.find((item) => item.kind === kind)?.count ?? 0 })).filter(
    (item) => item.count > 0,
  );
  const viewings = [...snapshot.viewings.items].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  const card = [styles.card, getCardElevation(1), { backgroundColor: theme.surface, borderColor: theme.border }];
  const mutedText = [styles.small, { color: muted }];
  const isReady = (status: DashboardSectionStatus) => status === 'available' || status === 'demo';
  const ready = (status: DashboardSectionStatus, content: React.ReactNode) => {
    if (status === 'error') return <Text style={[styles.small, { color: subtle.dangerFg }]}>{copy.sectionError}</Text>;
    if (status === 'loading') return <ActivityIndicator color={theme.spinner} accessibilityLabel={t.common.loading} />;
    if (status === 'not_configured') return <Text style={mutedText}>{copy.comingSoon}</Text>;
    return content;
  };
  const Title = ({ children }: { children: string }) => <Text style={[styles.sectionTitle, { color: ink }]}>{children}</Text>;
  // Same place as the agent's "view all" rows; disabled as coming soon until the pages exist.
  const ViewAll = ({ id, label, onOpen }: { id: string; label: string; onOpen?: () => void }) => (
    <Pressable
      testID={`so-link-${id}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: !onOpen }}
      disabled={!onOpen}
      onPress={onOpen}
      style={[styles.linkRow, { borderTopColor: theme.border }]}
    >
      <Text style={[styles.small, styles.flex, { color: onOpen ? ink : muted }]}>{label}</Text>
      {onOpen ? <MobileIcon name="chevron-right" size={14} color={muted} /> : <Text style={[styles.caption, { color: muted }]}>{copy.comingSoon}</Text>}
    </Pressable>
  );
  const More = ({ total, shown }: { total: number; shown: number }) =>
    total > shown ? <Text style={[styles.caption, { color: muted }]}>{interpolate(copy.moreItems, { n: total - shown })}</Text> : null;

  return (
    <View style={styles.root}>
      {deletionScheduledFor ? <AccountDeletionNotice scheduledFor={deletionScheduledFor} /> : null}

      <View style={styles.greetingRow}>
        <MobileProfileAvatar initials={initials} size="md" />
        <View style={styles.greetingText}>
          <Text style={[styles.greeting, { color: ink }]} numberOfLines={1}>
            {interpolate(copy.greeting, { name: snapshot.greetingName })}
          </Text>
          <Text style={mutedText}>{snapshot.localDateLabel}</Text>
        </View>
      </View>

      <MobileButton disabled onPress={() => {}}>
        {`+ ${copy.addListing} · ${copy.comingSoon}`}
      </MobileButton>

      {snapshot.isDemoPreview ? (
        <View style={[styles.demo, { backgroundColor: subtle.brandBg, borderColor: tokens.colors.icon.brand }]}>
          <MobileIcon name="info" size={14} color={subtle.warningFg} />
          <Text style={[styles.small, styles.flex, { color: subtle.warningFg }]}>{copy.demoNote}</Text>
        </View>
      ) : null}

      <View style={card}>
        <Title>{copy.myRooms}</Title>
        {!isReady(snapshot.rooms.status) ? null : (
          <View style={styles.counts}>
            <Text style={mutedText}>{interpolate(copy.roomCount, { n: rooms.total })}</Text>
            <Text style={[styles.small, { color: accent }]}>{interpolate(copy.occupiedCount, { n: rooms.occupied })}</Text>
            <Text style={mutedText}>{interpolate(copy.vacantCount, { n: rooms.vacant })}</Text>
          </View>
        )}
        {ready(
          snapshot.rooms.status,
          snapshot.rooms.items.length === 0 ? (
            <Text style={mutedText}>{copy.noRooms}</Text>
          ) : (
            snapshot.rooms.items.slice(0, SELF_OWNER_PREVIEW.rooms).map((room) => (
              <MobileSelfOwnerRoomCard key={room.id} room={room} testID={`so-room-${room.id}`} />
            ))
          ),
        )}
        {isReady(snapshot.rooms.status) ? <More total={snapshot.rooms.items.length} shown={SELF_OWNER_PREVIEW.rooms} /> : null}
        <ViewAll id="rooms" label={copy.viewAllRooms} onOpen={onOpenRooms} />
      </View>

      <View style={card}>
        <Title>{interpolate(copy.rentTitle, { period })}</Title>
        {ready(
          snapshot.rent.status,
          snapshot.rent.items.length === 0 ? (
            <Text style={mutedText}>{copy.noRent}</Text>
          ) : (
            <>
              <Text style={[styles.body, { color: ink }]}>
                {interpolate(copy.received, { received: money(rent.received), total: money(rent.total) })}
              </Text>
              <View style={[styles.bar, { backgroundColor: theme.border }]}>
                <View style={[styles.barFill, { width: `${receivedShare}%`, backgroundColor: accent }]} />
              </View>
              {rent.overdue > 0 ? (
                <Text style={[styles.small, { color: subtle.dangerFg }]}>{interpolate(copy.outstanding, { amount: money(rent.overdue) })}</Text>
              ) : null}
              {snapshot.rent.items.slice(0, SELF_OWNER_PREVIEW.rent).map((row) => {
                const tone =
                  row.state === 'paid'
                    ? { bg: subtle.successBg, fg: subtle.successFg }
                    : row.state === 'overdue'
                      ? { bg: subtle.dangerBg, fg: subtle.dangerFg }
                      : { bg: subtle.neutralBg, fg: muted };
                return (
                  <View key={row.id} testID={`so-rent-${row.id}`} style={[styles.listRow, { borderTopColor: theme.border }]}>
                    <View style={styles.flex}>
                      <Text style={[styles.body, { color: ink }]} numberOfLines={1}>{row.roomTitle}</Text>
                      <Text style={[styles.caption, { color: muted }]} numberOfLines={1}>{row.tenantName}</Text>
                    </View>
                    <View style={styles.rentEnd}>
                      <Text style={[styles.body, { color: ink }]}>{money(row.amount)}</Text>
                      <Text style={[styles.chip, { backgroundColor: tone.bg, color: tone.fg }]}>
                        {row.state === 'paid'
                          ? copy.rentState.paid
                          : row.state === 'overdue'
                            ? interpolate(copy.rentState.overdue, { days: row.overdueDays ?? 0 })
                            : interpolate(copy.rentState.due, { date: day(row.dueDate, false) })}
                      </Text>
                    </View>
                  </View>
                );
              })}
              <More total={snapshot.rent.items.length} shown={SELF_OWNER_PREVIEW.rent} />
            </>
          ),
        )}
        <ViewAll id="rent" label={copy.viewAllRent} />
      </View>

      <View style={card}>
        <Title>{copy.todoTitle}</Title>
        {ready(
          snapshot.todo.status,
          todo.length === 0 ? (
            <Text style={mutedText}>{copy.noTodo}</Text>
          ) : (
            todo.map((item, index) => (
              <View key={item.kind} testID={`so-todo-${item.kind}`} style={[styles.listRow, index === 0 ? styles.firstRow : { borderTopColor: theme.border }]}>
                <Text style={[styles.body, styles.flex, { color: ink }]}>{copy.todo[item.kind]}</Text>
                <Text
                  style={[
                    styles.chip,
                    item.kind === 'overdue_rent'
                      ? { backgroundColor: subtle.dangerBg, color: subtle.dangerFg }
                      : { backgroundColor: isDark ? theme.border : subtle.warningBg, color: accent },
                  ]}
                >
                  {String(item.count)}
                </Text>
              </View>
            ))
          ),
        )}
      </View>

      <View style={card}>
        <Title>{copy.viewingsTitle}</Title>
        {ready(
          snapshot.viewings.status,
          viewings.length === 0 ? (
            <Text style={mutedText}>{copy.noViewings}</Text>
          ) : (
            viewings.slice(0, SELF_OWNER_PREVIEW.viewings).map((item, index) => (
              <View key={item.id} testID={`so-viewing-${item.id}`} style={[styles.listRow, index === 0 ? styles.firstRow : { borderTopColor: theme.border }]}>
                <Text style={[styles.time, { color: accent }]}>{time(item.startsAt)}</Text>
                <View style={styles.flex}>
                  <Text style={[styles.body, { color: ink }]} numberOfLines={1}>{item.roomTitle}</Text>
                  <Text style={[styles.caption, { color: muted }]} numberOfLines={1}>{item.contactName}</Text>
                </View>
              </View>
            ))
          ),
        )}
        {isReady(snapshot.viewings.status) ? <More total={viewings.length} shown={SELF_OWNER_PREVIEW.viewings} /> : null}
        <ViewAll id="calendar" label={copy.viewCalendar} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14, paddingBottom: 24 },
  flex: { flex: 1, minWidth: 0 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greetingText: { flex: 1, minWidth: 0, gap: 2 },
  greeting: { fontFamily: tokens.typography.native.headingTh, fontSize: 22, lineHeight: 32, fontWeight: '500' },
  demo: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  card: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 8, overflow: 'hidden' },
  sectionTitle: { fontFamily: tokens.typography.native.headingTh, fontSize: 16, lineHeight: 24, fontWeight: '500' },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  body: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 21 },
  small: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 19 },
  caption: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
  bar: { height: 8, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  firstRow: { borderTopWidth: 0 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  rentEnd: { alignItems: 'flex-end', gap: 2 },
  chip: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 8,
    borderRadius: 999,
    overflow: 'hidden',
    minWidth: 28,
    textAlign: 'center',
  },
  time: { fontFamily: tokens.typography.native.headingTh, fontSize: 16, lineHeight: 24, fontWeight: '500', width: 52 },
});
