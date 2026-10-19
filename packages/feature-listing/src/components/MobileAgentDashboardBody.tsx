import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import {
  MobileButton,
  MobileIcon,
  MobileProfileAvatar,
  tokens,
  getCardElevation,
  useMobileTheme,
  type AppIconName,
} from '@nestyk/ui/native';
import type {
  AgentDashboardAppointment,
  AgentDashboardDeepLink,
  AgentDashboardSnapshot,
  AgentWorkItemKind,
} from '../dashboard/types';
import { formatMoney, formatTimeLabel, interpolate } from '../dashboard/types';

export type MobileAgentDashboardBodyProps = {
  snapshot: AgentDashboardSnapshot;
  onNavigate: (link: AgentDashboardDeepLink) => void;
  /** Initials for greeting avatar (display only). */
  initials?: string;
  avatarUri?: string | null;
};

const { subtle, brand, primary, success, danger, accent, onBrand } = tokens.colors;

function nativeElevation(level: 1 | 2 | 3) {
  const { boxShadow: _webOnly, ...rest } = getCardElevation(level);
  return rest;
}

function SoftPill({
  label,
  tone,
}: {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'neutral';
}) {
  const map = {
    success: { bg: subtle.successBg, fg: subtle.successFg },
    warning: { bg: subtle.warningBg, fg: subtle.warningFg },
    danger: { bg: subtle.dangerBg, fg: subtle.dangerFg },
    info: { bg: subtle.infoBg, fg: subtle.infoFg },
    brand: { bg: subtle.brandBg, fg: primary },
    neutral: { bg: subtle.neutralBg, fg: primary },
  } as const;
  const c = map[tone];
  return (
    <View style={[styles.softPill, { backgroundColor: c.bg }]}>
      <Text style={[styles.softPillText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

function RatioBar({ left, right, leftColor, rightColor = subtle.track }: {
  left: number; right: number; leftColor: string; rightColor?: string;
}) {
  const total = Math.max(left + right, 1);
  return (
    <View style={[styles.ratioTrack, { backgroundColor: rightColor }]}>
      <View style={[styles.ratioFill, { width: `${(left / total) * 100}%`, backgroundColor: leftColor }]} />
    </View>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.linkRow, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={styles.linkText}>{label} →</Text>
    </Pressable>
  );
}

function workItemIcon(kind: AgentWorkItemKind): AppIconName {
  switch (kind) {
    case 'overdue_payment': return 'warning';
    case 'lead_follow_up': return 'clipboard';
    case 'awaiting_signature': return 'note';
    case 'renewal': return 'calendar';
    default: return 'clipboard';
  }
}

export const MobileAgentDashboardBody: React.FC<MobileAgentDashboardBodyProps> = ({
  snapshot,
  onNavigate,
  initials = '?',
  avatarUri,
}) => {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.agent.dashboard;
  const ink = theme.screenTitle || primary;

  const localeTag =
    locale === 'th' ? 'th-TH' : locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : 'en-GB';

  const periodLabel = useMemo(() => {
    const d = new Date(snapshot.rent.periodYear, snapshot.rent.periodMonth - 1, 1);
    return d.toLocaleDateString(localeTag, { month: 'long', year: 'numeric' });
  }, [localeTag, snapshot.rent.periodMonth, snapshot.rent.periodYear]);

  const rentPct =
    snapshot.rent.totalDue > 0
      ? Math.min(100, Math.round((snapshot.rent.received / snapshot.rent.totalDue) * 1000) / 10)
      : 0;

  const outlineMuted = { borderColor: theme.border, backgroundColor: theme.surface } as const;

  const { appointments, nextAppointmentId } = useMemo(() => {
    const now = Date.now();
    const sorted = [...snapshot.schedule.items]
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt) || a.id.localeCompare(b.id));
    return { appointments: sorted, nextAppointmentId: sorted.find(item => +new Date(item.startsAt) >= now)?.id ?? null };
  }, [snapshot.schedule.items]);

  const apptSubtitle = (a: AgentDashboardAppointment) => {
    const kind = a.kind === 'custom' ? '' : a.kind === 'viewing' ? copy.apptViewing : copy.apptFollowUp;
    return [kind, a.contactName].filter(Boolean).join(' · ');
  };

  const actionTitle = (kind: AgentWorkItemKind) => {
    switch (kind) {
      case 'overdue_payment': return copy.overduePayments;
      case 'lead_follow_up': return copy.leadsFollowUp;
      case 'awaiting_signature': return copy.awaitingSignature;
      case 'renewal': return copy.renewalSoon;
      default: return copy.actionRequired;
    }
  };

  const actionSubtitle = (item: AgentDashboardSnapshot['actionRequired']['items'][0]) => {
    switch (item.kind) {
      case 'overdue_payment':
        return item.amount != null
          ? interpolate(copy.overdueAmountHint, { amount: formatMoney(item.amount) })
          : interpolate(copy.itemsCount, { count: item.count ?? 0 });
      case 'lead_follow_up':
        return interpolate(copy.followUpHint, { count: item.count ?? 0 });
      case 'awaiting_signature':
        return interpolate(copy.signingHint, { count: item.count ?? 0 });
      case 'renewal':
        return interpolate(copy.renewalHint, { count: item.count ?? 0 });
      default:
        return '';
    }
  };

  // Hierarchy: section total stays solid brand; row counts stay soft except overdue (danger).
  const actionTone = (kind: AgentWorkItemKind) => {
    const softCount = { countBg: subtle.neutralBg, countFg: primary };
    if (kind === 'overdue_payment') {
      return { bg: subtle.dangerBg, fg: subtle.dangerFg, countBg: danger, countFg: '#fff' };
    }
    if (kind === 'awaiting_signature') {
      return { bg: subtle.warningBg, fg: subtle.warningFg, ...softCount };
    }
    // follow-up / renewal — slate icon, soft amber count
    return { bg: subtle.neutralBg, fg: theme.textSecondary, ...softCount };
  };

  const activityTitle = (kind: AgentDashboardSnapshot['activity']['items'][0]['kind'], subject: string) => {
    const map = {
      lead_added: copy.activityLeadAdded,
      contract_sent: copy.activityContractSent,
      payment_recorded: copy.activityPaymentRecorded,
    } as const;
    return interpolate(map[kind], { subject });
  };

  const Section = ({ children }: { children: React.ReactNode }) => (
    <View style={[styles.card, nativeElevation(1), { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {children}
    </View>
  );

  return (
    <View style={styles.root}>
      {snapshot.isDemoPreview ? (
        <View style={[styles.demoBanner, { backgroundColor: subtle.brandBg, borderColor: brand[500] }]}>
          <Text style={[styles.demoBannerText, { color: primary }]}>{copy.demoBanner}</Text>
        </View>
      ) : null}

      {/* Zone A — compact */}
      <View style={styles.zone}>
        <View style={styles.greetingRow}>
          <MobileProfileAvatar initials={initials} imageUri={avatarUri} size="md" />
          <View style={styles.greetingText}>
            <Text style={[styles.welcome, { color: ink }]} numberOfLines={1}>
              {interpolate(copy.welcome, { name: snapshot.greetingName })}
            </Text>
            <Text style={[styles.dateLine, { color: theme.textSecondary }]} numberOfLines={2}>
              {snapshot.localDateLabel}
            </Text>
          </View>
        </View>

        <View style={styles.ctaRow}>
          <View style={styles.ctaHalf}>
            <MobileButton onPress={() => onNavigate({ type: 'action', id: 'addListing' })}>
              {`+ ${copy.addListing}`}
            </MobileButton>
          </View>
          <View style={styles.ctaHalf}>
            <MobileButton
              variant="outline"
              style={outlineMuted}
              textStyle={{ color: ink }}
              onPress={() => onNavigate({ type: 'action', id: 'newLead' })}
            >
              {`+ ${copy.newLead}`}
            </MobileButton>
          </View>
        </View>

        <Section>
          <Text style={[styles.sectionTitle, { color: ink }]}>{copy.businessOverview}</Text>
          <View style={styles.kpiGrid}>
            {[
              {
                label: copy.availableListings,
                value: String(snapshot.business.availableListings),
                sub: interpolate(copy.ofTotal, { count: snapshot.business.totalListings }),
                onPress: () => onNavigate({ type: 'tab', tab: 'listingRoom' }),
              },
              {
                label: copy.openLeads,
                value: String(snapshot.business.openLeads),
                sub: '',
                onPress: () => onNavigate({ type: 'tab', tab: 'listingLead' }),
              },
              {
                label: copy.currentClients,
                value: String(snapshot.business.currentClients),
                sub: interpolate(copy.tenantsCount, { count: snapshot.business.tenantsCount }),
                onPress: () => onNavigate({ type: 'tab', tab: 'clients' }),
              },
              {
                label: copy.commissionPending,
                value: snapshot.business.commissionPending == null ? copy.unsupported : formatMoney(snapshot.business.commissionPending),
                disabled: snapshot.business.commissionPending == null,
                sub: '',
                onPress: () => onNavigate({ type: 'action', id: 'viewCommission' }),
              },
            ].map((kpi, index) => (
              <Pressable
                key={kpi.label}
                disabled={'disabled' in kpi && kpi.disabled}
                accessibilityState={{ disabled: 'disabled' in kpi && kpi.disabled }}
                onPress={kpi.onPress}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.kpiCell,
                  {
                    borderColor: theme.border,
                    borderLeftWidth: index % 2 ? StyleSheet.hairlineWidth : 0,
                    borderTopWidth: index >= 2 ? StyleSheet.hairlineWidth : 0,
                    backgroundColor: pressed ? theme.background : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.kpiValue, { color: ink }, 'disabled' in kpi && kpi.disabled ? styles.unsupportedValue : null]} numberOfLines={1}>{kpi.value}</Text>
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]} numberOfLines={2}>{kpi.label}</Text>
                {kpi.sub ? (
                  <Text style={[styles.kpiSub, { color: theme.textSecondary }]} numberOfLines={1}>{kpi.sub}</Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        </Section>

        <Section>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: ink }]}>{copy.actionRequired}</Text>
            {snapshot.actionRequired.items.some(item => (item.count ?? 0) > 0) ? (
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>
                  {snapshot.actionRequired.items.reduce((n, i) => n + (i.count ?? 0), 0)}
                </Text>
              </View>
            ) : null}
          </View>
          {!snapshot.actionRequired.items.some(item => (item.count ?? 0) > 0) ? (
            <Text style={{ color: theme.textSecondary }}>{copy.emptyActions}</Text>
          ) : null}
          {snapshot.actionRequired.items.filter(item => item.status === 'not_configured' || (item.count ?? 0) > 0).map((item) => {
              const tone = actionTone(item.kind);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => onNavigate(item.deepLink)}
                  disabled={item.status === 'not_configured'}
                  accessibilityState={{ disabled: item.status === 'not_configured' }}
                  accessibilityRole="button"
                  accessibilityLabel={`${actionTitle(item.kind)}, ${item.status === 'not_configured' ? copy.unsupported : actionSubtitle(item)}`}
                  style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.75 : 1 }]}
                >
                  <View style={[styles.actionIcon, { backgroundColor: tone.bg }]}>
                    <MobileIcon name={workItemIcon(item.kind)} size={18} color={tone.fg} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.actionLabel, { color: ink }]} numberOfLines={1}>
                      {actionTitle(item.kind)}
                    </Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 18 }} numberOfLines={1}>
                      {item.status === 'not_configured' ? copy.unsupported : actionSubtitle(item)}
                    </Text>
                  </View>
                  <View style={[styles.actionCount, { backgroundColor: tone.countBg }]}>
                    <Text style={[styles.actionCountText, { color: tone.countFg }]}>{item.count ?? '—'}</Text>
                  </View>
                  {item.status !== 'not_configured' && <MobileIcon name="chevron-right" size={16} color={theme.textSecondary} />}
                </Pressable>
              );
            })}
        </Section>

        {/* Today's full schedule, including appointments whose time has passed. */}
        <Section>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: ink }]}>{copy.todaysSchedule}</Text>
            <LinkRow label={copy.viewCalendar} onPress={() => onNavigate({ type: 'action', id: 'viewCalendar' })} />
          </View>
          {appointments.length === 0 ? (
            <Text style={{ color: theme.textSecondary }}>{copy.noAppointments}</Text>
          ) : (
            <View style={styles.scheduleList}>
              {appointments.map((item) => {
                const upcoming = item.id === nextAppointmentId;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => onNavigate({ type: 'action', id: 'viewAppointment', appointmentId: item.id, startsAt: item.startsAt })}
                    accessibilityRole="button"
                    android_ripple={{ color: brand[100] }}
                    style={({ pressed }) => [styles.scheduleRow, {
                      backgroundColor: upcoming ? brand[50] : theme.surface,
                      borderColor: upcoming ? brand[500] : theme.border,
                      opacity: pressed ? 0.85 : 1,
                    }]}
                  >
                    <Text style={[styles.timeLabel, { color: upcoming ? brand[700] : ink }]}>{formatTimeLabel(item.startsAt, localeTag)}</Text>
                    <View style={styles.scheduleCopy}>
                      <Text style={[styles.rowTitle, { color: ink }]} numberOfLines={1}>{item.title}</Text>
                      <Text style={[styles.scheduleMeta, { color: theme.textSecondary }]} numberOfLines={1}>{apptSubtitle(item)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Section>
      </View>

      {/* Zone B */}
      <View style={styles.zone}>
        <Section>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: ink }]}>{copy.listingInventory}</Text>
            <LinkRow label={copy.viewAllListings} onPress={() => onNavigate({ type: 'tab', tab: 'listingRoom' })} />
          </View>
          <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>{copy.availability}</Text>
          <RatioBar left={snapshot.inventory.available} right={snapshot.inventory.unavailable} leftColor={success} />
          <Text style={[styles.barCaption, { color: theme.textSecondary }]}>
            {snapshot.inventory.available} {copy.available} · {snapshot.inventory.unavailable} {copy.unavailable}
          </Text>
          <Text style={[styles.metaLabel, { color: theme.textSecondary, marginTop: 8 }]}>{copy.visibility}</Text>
          <RatioBar left={snapshot.inventory.published} right={snapshot.inventory.private} leftColor={accent} />
          <Text style={[styles.barCaption, { color: theme.textSecondary }]}>
            {snapshot.inventory.published} {copy.published} · {snapshot.inventory.private} {copy.private}
          </Text>
          {snapshot.inventory.preview.map((room) => (
            <Pressable
              key={String(room.id)}
              onPress={() => onNavigate({ type: 'action', id: 'viewListing', roomId: Number(room.id) })}
              style={({ pressed }) => [styles.previewRow, { borderTopColor: theme.border, opacity: pressed ? 0.8 : 1 }]}
            >
              <View style={[styles.thumb, { backgroundColor: subtle.neutralBg }]}>
                <Text style={{ color: ink, fontWeight: '700' }}>{room.title.slice(0, 1)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={[styles.rowTitle, { color: ink }]} numberOfLines={1}>{room.title}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 18 }} numberOfLines={1}>
                  {interpolate(copy.bedsArea, { beds: room.beds ?? '—', area: room.area || '—' })}
                  {' · '}
                  {interpolate(copy.rentPerMonthShort, { price: room.price == null ? t.contracts.common.notSpecified : formatMoney(room.price) })}
                </Text>
                <View style={styles.badgeRow}>
                  <SoftPill label={room.availability === 'available' ? copy.available : copy.unavailable} tone={room.availability === 'available' ? 'success' : 'neutral'} />
                  <SoftPill label={room.visibility === 'published' ? copy.published : room.visibility === 'private' ? copy.private : t.contracts.common.notSpecified} tone={room.visibility === 'published' ? 'info' : 'neutral'} />
                </View>
              </View>
              <MobileIcon name="chevron-right" size={16} color={theme.textSecondary} />
            </Pressable>
          ))}
        </Section>

        <Section>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: ink }]}>{copy.clientOverview}</Text>
            <LinkRow label={copy.viewClients} onPress={() => onNavigate({ type: 'tab', tab: 'clients' })} />
          </View>
          <View style={styles.clientStats}>
            {[
              { label: copy.draft, value: snapshot.clients.draft },
              { label: copy.signing, value: snapshot.clients.signing },
              { label: copy.tenants, value: snapshot.clients.tenants },
            ].map((stat) => (
              <View key={stat.label} style={styles.clientStat}>
                <Text style={[styles.kpiValue, { color: ink }]}>{stat.value}</Text>
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>{stat.label}</Text>
              </View>
            ))}
          </View>
          {snapshot.clients.renewal ? (
            <View style={[styles.renewalBox, { borderColor: theme.border, backgroundColor: theme.background }]}>
              <Text style={[styles.rowTitle, { color: ink }]}>{copy.upcomingRenewal}</Text>
              <Text style={{ color: ink, marginTop: 4 }}>{snapshot.clients.renewal.title}</Text>
              <Text style={{ color: theme.textSecondary, marginTop: 2 }}>
                {interpolate(copy.endsOn, {
                  date: new Date(snapshot.clients.renewal.endsAt).toLocaleDateString(localeTag, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }),
                })}
              </Text>
              <View style={styles.renewalFooter}>
                <SoftPill label={interpolate(copy.daysLeft, { count: snapshot.clients.renewal.daysLeft })} tone="brand" />
                <MobileButton
                  variant="outline"
                  style={outlineMuted}
                  textStyle={{ color: ink }}
                  onPress={() =>
                    onNavigate({ type: 'tab', tab: 'clients', filter: { kind: 'work', work: 'renewal' } })
                  }
                >
                  {copy.review}
                </MobileButton>
              </View>
            </View>
          ) : null}
        </Section>
      </View>

      {/* Zone C */}
      <View style={styles.zone}>
        <Section>
          <Text style={[styles.sectionTitle, { color: ink }]}>{copy.paymentsEarnings}</Text>
          <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>
            {copy.rentCollection} · {periodLabel}
          </Text>
          <Text style={[styles.moneyHero, { color: ink }]}>{formatMoney(snapshot.rent.totalDue)}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{copy.totalDue} · {copy.issuedBillsHint}</Text>
          <RatioBar left={snapshot.rent.received} right={Math.max(0, snapshot.rent.totalDue - snapshot.rent.received)} leftColor={success} />
          <View style={styles.moneyRow}>
            <Text style={{ color: subtle.successFg }}>{copy.received} {formatMoney(snapshot.rent.received)}</Text>
            <Text style={{ color: danger }}>{copy.overdue} {formatMoney(snapshot.rent.overdue)}</Text>
          </View>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{copy.pendingPayment} {formatMoney(snapshot.rent.pending ?? Math.max(0, snapshot.rent.totalDue - snapshot.rent.received - snapshot.rent.overdue))}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
            {interpolate(copy.receivedPercent, { pct: rentPct })}
          </Text>
          <LinkRow label={copy.viewPayments} onPress={() => onNavigate({ type: 'action', id: 'viewPayments' })} />
        </Section>

        <Section>
          <Text style={[styles.sectionTitle, { color: ink }]}>{copy.agentCommission}</Text>
          <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>{periodLabel}</Text>
          {snapshot.commission.status === 'not_configured' ? <View style={{ gap: 8 }}>
            <Text style={[styles.unsupportedText, { color: theme.textSecondary }]}>{copy.received} · {copy.unsupported}</Text>
            <Text style={[styles.unsupportedText, { color: theme.textSecondary }]}>{copy.pendingAmount} · {copy.unsupported}</Text>
          </View> : <>
          <Text style={[styles.moneyHero, { color: ink }]}>{formatMoney(snapshot.commission.total ?? 0)}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{copy.totalThisMonth}</Text>
          <View style={styles.moneyRow}>
            <Text style={{ color: subtle.successFg }}>{copy.received} {formatMoney(snapshot.commission.received ?? 0)}</Text>
            <Text style={{ color: subtle.warningFg }}>{copy.pendingAmount} {formatMoney(snapshot.commission.pending ?? 0)}</Text>
          </View>
          <LinkRow label={copy.openCommission} onPress={() => onNavigate({ type: 'action', id: 'viewCommission' })} />
          </>}
        </Section>

        <Section>
          <Text style={[styles.sectionTitle, { color: ink }]}>{copy.recentActivity}</Text>
          {!snapshot.activity.items.length && <Text style={{ color: theme.textSecondary }}>{copy.noActivity}</Text>}
          {snapshot.activity.items.slice(0, 3).map((item) => (
            <Pressable
              key={item.id}
              onPress={() => onNavigate(item.deepLink)}
              style={({ pressed }) => [styles.activityRow, { opacity: pressed ? 0.75 : 1 }]}
            >
              <MobileIcon name="sparkle" size={16} color={accent} />
              <Text style={[styles.actionLabel, { color: ink }]} numberOfLines={2}>
                {activityTitle(item.kind, item.subject)}
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                {new Date(item.at).toLocaleString(localeTag, { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}
              </Text>
            </Pressable>
          ))}
        </Section>

        <Pressable
          onPress={() => onNavigate({ type: 'tab', tab: 'more' })}
          style={({ pressed }) => [
            styles.moreTools,
            nativeElevation(1),
            { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
        >
          <MobileIcon name="wrench" size={20} color={ink} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: ink }]}>{copy.moreTools}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19 }}>{copy.moreToolsHint}</Text>
          </View>
          <MobileIcon name="chevron-right" size={16} color={theme.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  unsupportedText: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 21 },
  unsupportedValue: { fontSize: 14, lineHeight: 21 },
  root: { gap: 14, paddingBottom: 24 },
  zone: { gap: 10 },
  demoBanner: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  demoBannerText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  welcome: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 22,
    lineHeight: 32,
    fontWeight: '500',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  greetingText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  dateLine: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20 },
  ctaRow: { flexDirection: 'row', gap: 8 },
  ctaHalf: { flex: 1 },
  card: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 8, overflow: 'hidden' },
  softPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  softPillText: { fontFamily: tokens.typography.native.body, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  sectionTitle: { fontFamily: tokens.typography.native.headingTh, fontSize: 16, lineHeight: 24, fontWeight: '500' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  kpiCell: {
    width: '50%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 1,
    minWidth: 0,
  },
  kpiValue: { fontFamily: tokens.typography.native.headingTh, fontSize: 20, lineHeight: 28, fontWeight: '500' },
  kpiLabel: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
  kpiSub: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
  countPill: {
    minWidth: 24, height: 24, borderRadius: 12, backgroundColor: brand[500],
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  countPillText: { fontSize: 12, fontWeight: '700', color: onBrand },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingVertical: 4 },
  actionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  actionCount: {
    minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  actionCountText: { fontSize: 11, fontWeight: '700' },
  timeLabel: { fontFamily: tokens.typography.native.headingTh, fontSize: 14, lineHeight: 21, fontWeight: '500', width: 52 },
  rowTitle: { fontFamily: tokens.typography.native.headingTh, fontSize: 15, lineHeight: 22, fontWeight: '500' },
  scheduleList: { gap: 8 },
  scheduleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  scheduleCopy: { flex: 1, minWidth: 0, gap: 2 },
  scheduleMeta: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
  metaLabel: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  ratioTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  ratioFill: { height: '100%', borderRadius: 4 },
  barCaption: { fontSize: 12, lineHeight: 18 },
  previewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  clientStats: { flexDirection: 'row', gap: 8 },
  clientStat: { flex: 1, alignItems: 'center', gap: 2 },
  renewalBox: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 4 },
  renewalFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 },
  moneyHero: { fontFamily: tokens.typography.native.headingTh, fontSize: 26, lineHeight: 36, fontWeight: '500' },
  moneyRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingVertical: 4 },
  moreTools: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  linkRow: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 },
  linkText: {
    fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 19, color: accent, fontWeight: '600',
  },
});
