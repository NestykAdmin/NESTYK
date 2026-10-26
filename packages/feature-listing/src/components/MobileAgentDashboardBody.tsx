import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
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
  DashboardSectionStatus,
} from '../dashboard/types';
import { formatMoney, formatTimeLabel, interpolate } from '../dashboard/types';

export type MobileAgentDashboardBodyProps = {
  snapshot: AgentDashboardSnapshot;
  onNavigate: (link: AgentDashboardDeepLink) => void;
  onRefresh?: () => void;
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
  onRefresh,
  initials = '?',
  avatarUri,
}) => {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.agent.dashboard;
  const ink = theme.screenTitle || primary;
  const [scheduleExpanded, setScheduleExpanded] = useState(false);

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

  const now = Date.now();
  const upcoming = snapshot.schedule.items
    .filter((a) => new Date(a.startsAt).getTime() >= now - 5 * 60_000)
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const highlight = upcoming[0] ?? snapshot.schedule.items[0] ?? null;
  const rest = upcoming.filter((a) => a.id !== highlight?.id);
  const visibleRest = scheduleExpanded ? rest : rest.slice(0, 0);

  const apptSubtitle = (a: AgentDashboardAppointment) => {
    const kind = a.kind === 'viewing' ? copy.apptViewing : copy.apptFollowUp;
    return `${kind} · ${a.contactName}`;
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
          : interpolate(copy.itemsCount, { count: item.count });
      case 'lead_follow_up':
        return interpolate(copy.followUpHint, { count: item.count });
      case 'awaiting_signature':
        return interpolate(copy.signingHint, { count: item.count });
      case 'renewal':
        return interpolate(copy.renewalHint, { count: item.count });
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

  const isReady = (status: DashboardSectionStatus) => status === 'available' || status === 'demo';
  const sectionState = (status: DashboardSectionStatus, children: React.ReactNode) => {
    if (status === 'loading') return <ActivityIndicator color={accent} accessibilityLabel={t.common.loading} />;
    if (isReady(status)) return children;
    return (
      <View style={{ gap: 8 }} accessibilityLiveRegion="polite">
        <Text style={{ color: theme.textSecondary }}>
          {status === 'error' ? copy.webOverview.loadFailed : copy.unavailableSection}
        </Text>
        {status === 'error' && onRefresh ? (
          <MobileButton variant="outline" onPress={onRefresh}>{t.agent.tenants.retry}</MobileButton>
        ) : null}
      </View>
    );
  };

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
          {sectionState(snapshot.business.status,
          <View style={styles.kpiGrid}>
            {[
              {
                label: copy.availableListings,
                value: String(snapshot.business.availableListings),
                sub: interpolate(copy.ofTotal, { count: snapshot.business.totalListings }),
                onPress: () => onNavigate({ type: 'tab', tab: 'listingRoom' }),
                status: snapshot.business.status,
              },
              {
                label: copy.openLeads,
                value: String(snapshot.business.openLeads),
                sub: '',
                onPress: () => onNavigate({ type: 'tab', tab: 'listingLead' }),
                status: snapshot.business.status,
              },
              {
                label: copy.currentClients,
                value: String(snapshot.business.currentClients),
                sub: interpolate(copy.tenantsCount, { count: snapshot.business.tenantsCount }),
                onPress: () => onNavigate({ type: 'tab', tab: 'clients' }),
                status: snapshot.business.status,
              },
              {
                label: copy.commissionPending,
                value: formatMoney(snapshot.business.commissionPending),
                sub: '',
                onPress: () => onNavigate({ type: 'action', id: 'viewCommission' }),
                status: snapshot.commission.status,
              },
            ].map((kpi, index) => (
              <Pressable
                key={kpi.label}
                onPress={kpi.onPress}
                disabled={!isReady(kpi.status)}
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
                <Text style={[styles.kpiValue, { color: ink }]} numberOfLines={1}>{isReady(kpi.status) ? kpi.value : '—'}</Text>
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]} numberOfLines={2}>{kpi.label}</Text>
                {!isReady(kpi.status) ? <Text style={[styles.kpiSub, { color: theme.textSecondary }]}>{copy.unavailableSection}</Text> : kpi.sub ? (
                  <Text style={[styles.kpiSub, { color: theme.textSecondary }]} numberOfLines={1}>{kpi.sub}</Text>
                ) : null}
              </Pressable>
            ))}
          </View>)}
        </Section>

        <Section>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: ink }]}>{copy.actionRequired}</Text>
            {isReady(snapshot.actionRequired.status) && snapshot.actionRequired.items.length ? (
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>
                  {snapshot.actionRequired.items.reduce((n, i) => n + i.count, 0)}
                </Text>
              </View>
            ) : null}
          </View>
          {sectionState(snapshot.actionRequired.status, !snapshot.actionRequired.items.length ? (
            <Text style={{ color: theme.textSecondary }}>{copy.emptyActions}</Text>
          ) : (
            snapshot.actionRequired.items.map((item) => {
              const tone = actionTone(item.kind);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => onNavigate(item.deepLink)}
                  accessibilityRole="button"
                  accessibilityLabel={`${actionTitle(item.kind)}, ${actionSubtitle(item)}`}
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
                      {actionSubtitle(item)}
                    </Text>
                  </View>
                  <View style={[styles.actionCount, { backgroundColor: tone.countBg }]}>
                    <Text style={[styles.actionCountText, { color: tone.countFg }]}>{item.count}</Text>
                  </View>
                  <MobileIcon name="chevron-right" size={16} color={theme.textSecondary} />
                </Pressable>
              );
            })
          ))}
        </Section>

        {/* Merged schedule: highlight + expand */}
        <Section>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: ink }]}>{copy.todaysSchedule}</Text>
            <LinkRow label={copy.viewCalendar} onPress={() => onNavigate({ type: 'action', id: 'viewCalendar' })} />
          </View>
          {sectionState(snapshot.schedule.status, !highlight ? (
            <Text style={{ color: theme.textSecondary }}>{copy.noAppointments}</Text>
          ) : (
            <>
              <Pressable
                onPress={() =>
                  onNavigate({ type: 'action', id: 'viewAppointment', appointmentId: highlight.id })
                }
                accessibilityRole="button"
                style={({ pressed }) => [styles.highlightAppt, { borderColor: theme.border, backgroundColor: theme.background, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={[styles.timeLabel, { color: accent }]}>{formatTimeLabel(highlight.startsAt, localeTag)}</Text>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={[styles.rowTitle, { color: ink }]} numberOfLines={1}>{highlight.title}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19 }} numberOfLines={1}>
                    {apptSubtitle(highlight)}
                  </Text>
                </View>
                <SoftPill
                  label={highlight.status === 'confirmed' ? copy.statusConfirmed : copy.statusPending}
                  tone={highlight.status === 'confirmed' ? 'success' : 'warning'}
                />
              </Pressable>
              {visibleRest.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => onNavigate({ type: 'action', id: 'viewAppointment', appointmentId: item.id })}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.scheduleRow, { opacity: pressed ? 0.75 : 1 }]}
                >
                  <Text style={[styles.timeLabel, { color: accent }]}>{formatTimeLabel(item.startsAt, localeTag)}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.rowTitle, { color: ink }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19 }} numberOfLines={1}>
                      {apptSubtitle(item)}
                    </Text>
                  </View>
                  <SoftPill
                    label={item.status === 'confirmed' ? copy.statusConfirmed : copy.statusPending}
                    tone={item.status === 'confirmed' ? 'success' : 'warning'}
                  />
                </Pressable>
              ))}
              {rest.length > 0 ? (
                <Pressable
                  onPress={() => setScheduleExpanded((v) => !v)}
                  accessibilityRole="button"
                  style={styles.linkRow}
                >
                  <Text style={styles.linkText}>
                    {scheduleExpanded ? copy.showLessSchedule : `${copy.showMoreSchedule} (${rest.length})`}
                  </Text>
                </Pressable>
              ) : null}
            </>
          ))}
        </Section>
      </View>

      {/* Zone B */}
      <View style={styles.zone}>
        <Section>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: ink }]}>{copy.listingInventory}</Text>
            <LinkRow label={copy.viewAllListings} onPress={() => onNavigate({ type: 'tab', tab: 'listingRoom' })} />
          </View>
          {sectionState(snapshot.inventory.status, <>
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
              onPress={() => onNavigate({ type: 'tab', tab: 'listingRoom' })}
              style={({ pressed }) => [styles.previewRow, { borderTopColor: theme.border, opacity: pressed ? 0.8 : 1 }]}
            >
              <View style={[styles.thumb, { backgroundColor: subtle.neutralBg }]}>
                <Text style={{ color: ink, fontWeight: '700' }}>{room.title.slice(0, 1)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={[styles.rowTitle, { color: ink }]} numberOfLines={1}>{room.title}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 18 }} numberOfLines={1}>
                  {interpolate(copy.bedsArea, { beds: room.beds, area: room.area })}
                  {' · '}
                  {interpolate(copy.rentPerMonthShort, { price: formatMoney(room.price) })}
                </Text>
                <View style={styles.badgeRow}>
                  <SoftPill label={room.availability === 'available' ? copy.available : copy.unavailable} tone={room.availability === 'available' ? 'success' : 'neutral'} />
                  <SoftPill label={room.visibility === 'published' ? copy.published : copy.private} tone={room.visibility === 'published' ? 'info' : 'neutral'} />
                </View>
              </View>
              <MobileIcon name="chevron-right" size={16} color={theme.textSecondary} />
            </Pressable>
          ))}
          {!snapshot.inventory.preview.length ? <Text style={{ color: theme.textSecondary }}>{t.common.noData}</Text> : null}
          </>)}
        </Section>

        <Section>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: ink }]}>{copy.clientOverview}</Text>
            <LinkRow label={copy.viewClients} onPress={() => onNavigate({ type: 'tab', tab: 'clients' })} />
          </View>
          {sectionState(snapshot.clients.status, <>
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
          </>)}
        </Section>
      </View>

      {/* Zone C */}
      <View style={styles.zone}>
        <Section>
          <Text style={[styles.sectionTitle, { color: ink }]}>{copy.paymentsEarnings}</Text>
          <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>
            {copy.rentCollection} · {periodLabel}
          </Text>
          {sectionState(snapshot.rent.status, <>
          <Text style={[styles.moneyHero, { color: ink }]}>{formatMoney(snapshot.rent.totalDue)}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{copy.totalDue}</Text>
          <RatioBar left={snapshot.rent.received} right={Math.max(0, snapshot.rent.totalDue - snapshot.rent.received)} leftColor={success} />
          <View style={styles.moneyRow}>
            <Text style={{ color: subtle.successFg }}>{copy.received} {formatMoney(snapshot.rent.received)}</Text>
            <Text style={{ color: danger }}>{copy.overdue} {formatMoney(snapshot.rent.overdue)}</Text>
          </View>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
            {interpolate(copy.receivedPercent, { pct: rentPct })}
          </Text>
          <LinkRow label={copy.viewPayments} onPress={() => onNavigate({ type: 'action', id: 'viewPayments' })} />
          </>)}
        </Section>

        <Section>
          <Text style={[styles.sectionTitle, { color: ink }]}>{copy.agentCommission}</Text>
          <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>{periodLabel}</Text>
          {sectionState(snapshot.commission.status, <>
          <Text style={[styles.moneyHero, { color: ink }]}>{formatMoney(snapshot.commission.total)}</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{copy.totalThisMonth}</Text>
          <View style={styles.moneyRow}>
            <Text style={{ color: subtle.successFg }}>{copy.received} {formatMoney(snapshot.commission.received)}</Text>
            <Text style={{ color: subtle.warningFg }}>{copy.pendingAmount} {formatMoney(snapshot.commission.pending)}</Text>
          </View>
          <LinkRow label={copy.openCommission} onPress={() => onNavigate({ type: 'action', id: 'viewCommission' })} />
          </>)}
        </Section>

        <Section>
          <Text style={[styles.sectionTitle, { color: ink }]}>{copy.recentActivity}</Text>
          {sectionState(snapshot.activity.status, snapshot.activity.items.length ? snapshot.activity.items.slice(0, 3).map((item) => (
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
                {formatTimeLabel(item.at, localeTag)}
              </Text>
            </Pressable>
          )) : <Text style={{ color: theme.textSecondary }}>{t.common.noData}</Text>)}
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
  highlightAppt: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, padding: 10, minHeight: 56,
  },
  timeLabel: { fontFamily: tokens.typography.native.headingTh, fontSize: 15, lineHeight: 22, fontWeight: '500', width: 52 },
  rowTitle: { fontFamily: tokens.typography.native.headingTh, fontSize: 15, lineHeight: 22, fontWeight: '500' },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 4 },
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
