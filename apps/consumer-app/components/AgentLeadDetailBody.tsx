import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { RangeSlider } from '@react-native-assets/slider';
import {
  LEAD_MATCH_MAX_RESULTS_OPTIONS,
  LEAD_MATCH_MIN_SCORE,
  type AgentLead,
  type LeadMatchSettings,
  type LeadViewing,
} from '@nestyk/types';
import { localizedError, useLocale } from '@nestyk/i18n';
import {
  getCardElevation,
  MobileActionSheetBody,
  MobileAiQuotaAction,
  MobileBottomSheet,
  MobileButton,
  MobileIcon,
  MobileInput,
  MobileScoreRing,
  MobileStatusPill,
  SelectionChip,
  STATUS_PILL_TONES,
  tokens,
  useMobileTheme,
  type AppIconName,
  type MobileStatusPillToneKey,
} from '@nestyk/ui/native';
import {
  clearLeadMatches,
  fetchLatestLeadMatch,
  getAgentLead,
  getLeadMatchSettings,
  listLeadViewings,
  markAgentLeadInProgress,
  markAgentLeadLost,
  runLeadMatch,
  saveLeadMatchSettings,
} from '../lib/agent-leads-api';
import { leadMatchReady, type LeadMatchRunResult, type LeadRoomMatch } from '../lib/lead-match-preview';
import { criterionTone, summarizeComparison, type CompareKey } from '../lib/lead-room-compare';
import { useMatchCopy } from './lead-match-copy';
import { LeadViewingsSection, viewedRoomIds } from './LeadViewingsSection';
import {
  formatBudgetRange,
  formatDate,
  formatDateTime,
  formatKm,
  formatLeadCode,
  formatMoveIn,
  formatShortDateTime,
  leadAvatarInitials,
  viewingDayLabel,
} from '../lib/lead-format';
import { formatPhoneDisplay, phoneDialString } from '../lib/phone';

export { leadAvatarInitials };

const LEAD_STATUS_TONE: Record<string, MobileStatusPillToneKey> = {
  new: 'yellow',
  inprogress: 'blue',
  viewing: 'purple',
  booked: 'green',
  lost: 'slate',
};

export function leadStatusTone(status: string): MobileStatusPillToneKey {
  return LEAD_STATUS_TONE[status] ?? 'slate';
}

/** Status to show: an open lead with an upcoming viewing reads as `viewing`; it falls back by itself once the viewing passes. */
export function leadDisplayStatus(lead: Pick<AgentLead, 'status' | 'nextViewingAt'>): string {
  const open = lead.status === 'new' || lead.status === 'inprogress';
  const upcoming = !!lead.nextViewingAt && new Date(lead.nextViewingAt).getTime() > Date.now();
  return open && upcoming ? 'viewing' : lead.status;
}

export function LeadStatusBadge({ status }: { status: string }) {
  const { t } = useLocale();
  const c = t.agent.leads;
  const key = status as keyof typeof c.statuses;
  return <MobileStatusPill label={c.statuses[key] || status} tone={leadStatusTone(status)} />;
}

/** "วันนี้ · 5 ต.ค. 17:00 · The Line · 1208" in dark text; renders nothing unless the lead shows as `viewing`. */
export function LeadNextViewingLine({ lead }: { lead: Pick<AgentLead, 'status' | 'nextViewingAt' | 'nextViewingRoom'> }) {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const c = t.agent.leads;
  if (leadDisplayStatus(lead) !== 'viewing') return null;
  const when = [viewingDayLabel(lead.nextViewingAt, locale, c.viewing), formatShortDateTime(lead.nextViewingAt, locale)]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={styles.nextViewing}>
      <MobileIcon name="calendar" size={14} color={tokens.colors.primary} />
      <Text style={[styles.nextViewingText, { color: tokens.colors.primary }]} numberOfLines={1}>
        {when}
        {lead.nextViewingRoom ? (
          <Text style={[styles.nextViewingRoom, { color: theme.textSecondary }]}>{` · ${lead.nextViewingRoom}`}</Text>
        ) : null}
      </Text>
    </View>
  );
}

const STATUS_TARGETS: Record<string, Array<'inprogress' | 'lost'>> = {
  new: ['inprogress', 'lost'],
  inprogress: ['lost'],
  lost: ['inprogress'],
};

const MATCH_PAGE_SIZE = 10;
const { boxShadow: _webShadow, ...cardShadow } = getCardElevation(1);
export const leadCardShadow = cardShadow;

type SheetMode = 'menu' | 'status' | 'lost' | 'criteria' | 'settings' | 'clear';

export function AgentLeadDetailBody({
  lead,
  onLeadChange,
  onOpenInfo,
  onEditMatching,
  onOpenMatch,
  onOpenTenant,
  menuRequest = 0,
}: {
  lead: AgentLead;
  onLeadChange: (lead: AgentLead) => void;
  onOpenInfo: () => void;
  onEditMatching: () => void;
  onOpenMatch?: (match: LeadRoomMatch) => void;
  /** Opens the tenant page of a booked lead. */
  onOpenTenant?: (tenantId: number) => void;
  /** Bumped by the shell header "⋯" button; a change (not the mount value) opens the actions sheet. */
  menuRequest?: number;
}) {
  const { t, locale } = useLocale();
  const c = t.agent.leads;
  const { theme } = useMobileTheme();
  const agentColor = tokens.colors.roles.agent;

  const [leadError, setLeadError] = useState<string | null>(null);
  const [leadAttempt, setLeadAttempt] = useState(0);
  const [matchResult, setMatchResult] = useState<LeadMatchRunResult | null>(null);
  const [matchError, setMatchError] = useState(false);
  const [matchAttempt, setMatchAttempt] = useState(0);
  const [running, setRunning] = useState(false);
  const [settings, setSettings] = useState<LeadMatchSettings | null>(null);
  const [draft, setDraft] = useState<LeadMatchSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>('menu');
  const [lostReason, setLostReason] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const [viewings, setViewings] = useState<LeadViewing[]>([]);

  useEffect(() => {
    let active = true;
    listLeadViewings(lead.id)
      .then((rows) => {
        if (active) setViewings(rows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [lead.id, lead.nextViewingAt]);

  const onViewingSaved = (saved: LeadViewing) => {
    setViewings((rows) => [...rows.filter((v) => v.id !== saved.id), saved]);
    getAgentLead(lead.id)
      .then(onLeadChange)
      .catch(() => {});
  };

  useEffect(() => {
    let active = true;
    setLeadError(null);
    getAgentLead(lead.id)
      .then((latest) => {
        if (active) onLeadChange(latest);
      })
      .catch((err) => {
        if (active) setLeadError(localizedError(err, t.common.errorGeneric, locale));
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id, leadAttempt]);

  const seenMenuRequest = useRef(menuRequest);
  useEffect(() => {
    if (menuRequest === seenMenuRequest.current) return;
    seenMenuRequest.current = menuRequest;
    openSheet('menu');
  }, [menuRequest]);

  const ready = leadMatchReady(lead);
  const booked = lead.status === 'booked';

  /** Fields the server hashes for the stale flag; editing one of them re-reads the last run. */
  const matchInputKey = JSON.stringify([
    lead.budgetMax,
    lead.radiusKm,
    lead.pins.map((p) => [p.rank, p.name, p.latitude, p.longitude]),
    lead.leaseDurationMonths,
    lead.desiredRoomTypeCode,
    lead.moveInPlan,
  ]);

  /** Last stored run only — matching itself runs when the agent asks for it. */
  useEffect(() => {
    if (booked) return;
    let active = true;
    setMatchError(false);
    Promise.all([fetchLatestLeadMatch(lead.id), getLeadMatchSettings(lead.id)])
      .then(([latest, saved]) => {
        if (!active) return;
        setMatchResult(latest);
        setSettings(saved.effective);
      })
      .catch(() => {
        if (active) setMatchError(true);
      });
    return () => {
      active = false;
    };
  }, [lead.id, matchInputKey, booked, matchAttempt]);

  /** Matching always starts from the settings sheet; it stays open until the run succeeds. */
  const runFromSettings = async () => {
    if (!draft || savingSettings || running) return;
    if (
      draft.minScore !== settings?.minScore ||
      draft.maxScore !== settings?.maxScore ||
      draft.maxResults !== settings?.maxResults
    ) {
      setSavingSettings(true);
      try {
        setSettings((await saveLeadMatchSettings(lead.id, draft)).effective);
      } catch (err) {
        Alert.alert(c.matchSettings.saveError, localizedError(err, t.common.errorGeneric, locale));
        return;
      } finally {
        setSavingSettings(false);
      }
    }
    setRunning(true);
    try {
      setMatchResult(await runLeadMatch(lead.id));
      setMatchError(false);
      setSheetOpen(false);
    } catch (err) {
      Alert.alert(c.matchRunError, localizedError(err, t.common.errorGeneric, locale));
    } finally {
      setRunning(false);
    }
  };

  const clearMatches = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      await clearLeadMatches(lead.id);
      setMatchResult({ run: null, items: [] });
      setSheetOpen(false);
    } catch (err) {
      Alert.alert(c.matchClearError, localizedError(err, t.common.errorGeneric, locale));
    } finally {
      setClearing(false);
    }
  };

  const openSettings = () => {
    setDraft(settings);
    openSheet('settings');
  };

  const matches = matchResult?.items ?? [];
  const lastRun = matchResult?.run ?? null;
  const hasViewings = viewings.length > 0;
  const viewedIds = viewedRoomIds(viewings);
  const suggestions = matches.filter((m) => !viewedIds.has(m.room.id));
  const [visibleCount, setVisibleCount] = useState(MATCH_PAGE_SIZE);
  useEffect(() => setVisibleCount(MATCH_PAGE_SIZE), [lead.id, matchResult]);
  const visibleMatches = suggestions.slice(0, visibleCount);
  const moreCount = Math.min(MATCH_PAGE_SIZE, suggestions.length - visibleMatches.length);
  /** With viewings booked the suggestions are secondary, so they start folded; state cards stay visible. */
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  useEffect(() => setSuggestionsOpen(false), [lead.id]);
  const suggestionsCollapsible = hasViewings && !booked && ready && !matchError && !!lastRun && suggestions.length > 0;
  const suggestionsCollapsed = suggestionsCollapsible && !suggestionsOpen;
  const suggestionsSummary =
    suggestionsCollapsible && lastRun
      ? c.suggestedSummary
          .replace('{score}', String(Math.max(...suggestions.map((m) => m.score))))
          .replace('{date}', formatDateTime(lastRun.createdAt, locale) ?? '—')
      : null;
  const toggleSuggestions = () => setSuggestionsOpen((v) => !v);
  const statusTargets = STATUS_TARGETS[lead.status] ?? [];
  const displayStatus = leadDisplayStatus(lead);
  const statusLabel = c.statuses[displayStatus as keyof typeof c.statuses] || displayStatus;
  const statusTone = STATUS_PILL_TONES[leadStatusTone(displayStatus)];

  const budget = formatBudgetRange(lead);
  const firstPin = lead.pins[0];
  const area = firstPin
    ? (lead.pins.length > 1 ? c.summaryAreaMore : c.summaryArea)
        .replace('{name}', firstPin.name)
        .replace('{count}', String(lead.pins.length - 1))
        .replace('{km}', String(lead.radiusKm ?? ''))
    : lead.province || (lead.locations?.length ? lead.locations.join(', ') : null);
  const moveIn = formatMoveIn(lead.moveInPlan, locale);
  const requirement = [
    lead.desiredRoomTypeCode
      ? t.masters.roomTypes[lead.desiredRoomTypeCode as keyof typeof t.masters.roomTypes] || lead.desiredRoomTypeCode
      : null,
    lead.leaseDurationMonths != null
      ? t.agent.createRoom.contractMonths.replace('{months}', String(lead.leaseDurationMonths))
      : null,
    moveIn ? c.moveInShort.replace('{date}', moveIn) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const summary: Array<{ icon: AppIconName; text: string | null; strong?: boolean }> = [
    { icon: 'credit-card', text: budget ? `${budget} ${c.perMonth}` : null, strong: true },
    { icon: 'map-pin', text: area },
    { icon: 'home', text: requirement || null },
  ];

  const phoneText = formatPhoneDisplay(lead.phone);

  const call = () => {
    const dial = phoneDialString(lead.phone);
    if (!dial) return;
    Linking.openURL(`tel:${dial}`).catch(async () => {
      await Clipboard.setStringAsync(phoneText);
      Alert.alert(c.phoneCopied, phoneText);
    });
  };

  function openSheet(mode: SheetMode) {
    setSheetMode(mode);
    setSheetOpen(true);
  }

  const closeSheet = () => {
    if (statusBusy || clearing) return;
    setSheetOpen(false);
    setLostReason('');
  };

  const copyPhone = async () => {
    setSheetOpen(false);
    await Clipboard.setStringAsync(phoneText);
    Alert.alert(c.phoneCopied, phoneText);
  };

  const changeStatus = async (target: 'inprogress' | 'lost') => {
    if (statusBusy) return;
    if (target === 'lost' && sheetMode !== 'lost') {
      setLostReason(lead.lostReason ?? '');
      setSheetMode('lost');
      return;
    }
    const reason = lostReason.trim();
    if (target === 'lost' && !reason) {
      Alert.alert(c.lostReasonRequired);
      return;
    }
    setStatusBusy(true);
    try {
      const next =
        target === 'lost' ? await markAgentLeadLost(lead.id, reason) : await markAgentLeadInProgress(lead.id);
      onLeadChange(next);
      setSheetOpen(false);
      setLostReason('');
    } catch (err) {
      Alert.alert(c.loadError, localizedError(err, t.common.errorGeneric, locale));
    } finally {
      setStatusBusy(false);
    }
  };

  const renderMatches = () => {
    if (booked) {
      const tenantId = lead.tenantId;
      return (
        <StateCard
          icon="check"
          title={c.bookedTitle}
          action={
            tenantId && onOpenTenant ? (
              <MobileButton onPress={() => onOpenTenant(tenantId)}>{c.bookedOpenTenant}</MobileButton>
            ) : undefined
          }
        />
      );
    }
    if (!ready) {
      return (
        <StateCard
          icon="map-pin"
          title={c.matchNotReadyTitle}
          action={<MobileButton onPress={onEditMatching}>{c.matchCompleteInfo}</MobileButton>}
        />
      );
    }
    if (matchError) {
      return (
        <StateCard
          icon="warning"
          title={c.matchLoadError}
          action={
            <MobileButton variant="outline" onPress={() => setMatchAttempt((n) => n + 1)}>
              {c.retry}
            </MobileButton>
          }
        />
      );
    }
    if (!matchResult) return <ActivityIndicator style={styles.loader} color={agentColor} />;
    if (!lastRun) {
      return (
        <MobileAiQuotaAction
          label={c.matchRun}
          variant="solid"
          remaining={1}
          limit={1}
          showQuota={false}
          loading={running}
          onPress={openSettings}
        />
      );
    }
    const runMeta = (
      <View style={styles.runMeta}>
        <Text style={[styles.meta, styles.flex1, { color: theme.textSecondary }]} numberOfLines={1}>
          {c.matchLastRun.replace('{date}', formatDateTime(lastRun.createdAt, locale) ?? '—')}
          {' · '}
          {c.matchSettings.summary
            .replace('{min}', String(lastRun.settings.minScore))
            .replace('{max}', String(lastRun.settings.maxScore))}
        </Text>
        {lastRun.stale ? <MobileStatusPill label={c.matchStale} tone="yellow" /> : null}
      </View>
    );
    if (!matches.length) {
      const belowScore = lastRun.candidateCount > 0;
      return (
        <View style={styles.roomList}>
          {runMeta}
          <StateCard
            icon="search"
            title={
              belowScore
                ? c.matchEmptyScore
                    .replace('{count}', String(lastRun.candidateCount))
                    .replace('{min}', String(lastRun.settings.minScore))
                    .replace('{max}', String(lastRun.settings.maxScore))
                : c.matchEmptyTitle
            }
            action={
              <MobileButton variant="outline" onPress={belowScore ? openSettings : onEditMatching}>
                {belowScore ? c.matchSettings.title : c.matchAdjust}
              </MobileButton>
            }
          />
        </View>
      );
    }
    if (!suggestions.length) {
      return (
        <View style={styles.roomList}>
          {runMeta}
          <StateCard icon="calendar" title={c.suggestedAllScheduled} />
        </View>
      );
    }
    return (
      <View style={styles.roomList}>
        {suggestionsCollapsible ? null : runMeta}
        {visibleMatches.map((match, index) =>
          suggestionsCollapsible && index < STAGGERED_CARDS ? (
            <Animated.View key={match.room.id} entering={FadeInDown.duration(220).delay(index * 40)}>
              <MatchedRoomCard match={match} onPress={onOpenMatch} />
            </Animated.View>
          ) : (
            <MatchedRoomCard key={match.room.id} match={match} onPress={onOpenMatch} />
          ),
        )}
        {moreCount > 0 ? (
          <Pressable
            onPress={() => setVisibleCount((n) => n + MATCH_PAGE_SIZE)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.moreBtn, { borderColor: theme.border }, iosPressed(pressed)]}
            {...androidRipple}
          >
            <Text style={[styles.moreLabel, { color: theme.textHeading }]}>
              {c.matchShowMore.replace('{count}', String(moreCount))}
            </Text>
            <MobileIcon name="chevron-down" size={14} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    );
  };

  const renderSheet = () => {
    if (sheetMode === 'menu') {
      return (
        <MobileActionSheetBody
          title={c.moreActions}
          actions={[
            ...(statusTargets.length
              ? [{ key: 'status', label: c.changeStatus, onPress: () => setSheetMode('status') }]
              : []),
            { key: 'copy', label: c.copyPhone, onPress: () => void copyPhone() },
          ]}
        />
      );
    }
    if (sheetMode === 'clear') {
      return (
        <>
          <SheetHeader title={c.matchClearConfirm} onClose={closeSheet} />
          <View style={styles.sheetBody}>
            <MobileButton
              onPress={() => void clearMatches()}
              isLoading={clearing}
              style={styles.dangerBtn}
              textStyle={styles.dangerLabel}
            >
              {c.matchClear}
            </MobileButton>
            <MobileButton variant="outline" onPress={() => setSheetMode('settings')} disabled={clearing}>
              {t.common.cancel}
            </MobileButton>
          </View>
        </>
      );
    }
    if (sheetMode === 'settings') {
      const s = c.matchSettings;
      const value = draft ?? settings;
      const busy = savingSettings || running;
      const group = (
        title: string,
        options: readonly number[],
        selected: number | undefined,
        label: (n: number) => string,
        pick: (n: number) => void,
      ) => (
        <View style={styles.settingGroup}>
          <Text style={[styles.settingTitle, { color: theme.textHeading }]}>{title}</Text>
          <View style={styles.chipRow}>
            {options.map((n) => (
              <SelectionChip
                key={n}
                label={label(n)}
                selected={selected === n}
                showCheck={false}
                disabled={busy}
                onPress={() => pick(n)}
              />
            ))}
          </View>
        </View>
      );
      return (
        <>
          <SheetHeader title={s.title} onClose={closeSheet} />
          {!value ? (
            <ActivityIndicator style={styles.loader} color={agentColor} />
          ) : (
            <View style={styles.sheetBody}>
              <View style={styles.settingGroup}>
                <View style={styles.scoreHead}>
                  <Text style={[styles.settingTitle, styles.flex1, { color: theme.textHeading }]}>{s.minScore}</Text>
                  <Text style={[styles.scoreValue, { color: theme.textHeading }]}>
                    {s.percent.replace('{value}', `${value.minScore}–${value.maxScore}`)}
                  </Text>
                </View>
                <RangeSlider
                  style={styles.scoreSlider}
                  range={[value.minScore, value.maxScore]}
                  minimumValue={LEAD_MATCH_MIN_SCORE.min}
                  maximumValue={LEAD_MATCH_MIN_SCORE.max}
                  step={LEAD_MATCH_MIN_SCORE.step}
                  minimumRange={LEAD_MATCH_MIN_SCORE.gap}
                  crossingAllowed={false}
                  onValueChange={([min, max]) => {
                    const minScore = Math.round(min);
                    const maxScore = Math.round(max);
                    if (minScore !== value.minScore || maxScore !== value.maxScore) {
                      setDraft({ ...value, minScore, maxScore });
                    }
                  }}
                  enabled={!busy}
                  outboundColor={theme.border}
                  inboundColor={tokens.colors.brand[500]}
                  thumbTintColor={tokens.colors.brand[500]}
                  trackHeight={6}
                  thumbSize={24}
                  thumbStyle={styles.scoreThumb}
                  accessibilityLabel={s.minScore}
                />
                <View style={styles.scoreScale}>
                  <Text style={[styles.scoreScaleText, { color: theme.textSecondary }]}>
                    {`${s.scoreLoose} · ${s.percent.replace('{value}', String(LEAD_MATCH_MIN_SCORE.min))}`}
                  </Text>
                  <Text style={[styles.scoreScaleText, { color: theme.textSecondary }]}>
                    {`${s.scoreStrict} · ${s.percent.replace('{value}', String(LEAD_MATCH_MIN_SCORE.max))}`}
                  </Text>
                </View>
                <Text style={[styles.scoreScaleText, { color: theme.textSecondary }]}>
                  {s.minScoreHint.replace('{min}', String(value.minScore)).replace('{max}', String(value.maxScore))}
                </Text>
              </View>
              {group(
                s.maxResults,
                LEAD_MATCH_MAX_RESULTS_OPTIONS,
                value.maxResults,
                (n) => s.rooms.replace('{count}', String(n)),
                (n) => setDraft({ ...value, maxResults: n }),
              )}
              <MobileAiQuotaAction
                label={lastRun ? c.matchRerun : c.matchRun}
                variant="solid"
                remaining={1}
                limit={1}
                showQuota={false}
                loading={busy}
                onPress={() => void runFromSettings()}
                style={styles.sheetAction}
              />
              {lastRun ? (
                <Pressable
                  onPress={() => setSheetMode('clear')}
                  disabled={busy}
                  hitSlop={8}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.clearLink, iosPressed(pressed)]}
                  {...androidRipple}
                >
                  <Text style={[styles.link, { color: tokens.colors.danger }]}>{c.matchClear}</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </>
      );
    }
    if (sheetMode === 'criteria') {
      return (
        <>
          <SheetHeader title={c.scoreCriteriaTitle} onClose={closeSheet} />
          <View style={styles.sheetBody}>
            {(
              [
                ['info', c.scoreCriteriaAverage],
                ['funnel', c.scoreCriteriaFilter],
                ['map-pin', c.scoreCriteriaDistance],
                ['stairs', c.scoreCriteriaWeights],
                ['calendar', c.scoreCriteriaMoveIn],
              ] as Array<[AppIconName, string]>
            ).map(([icon, text]) => (
              <View key={icon} style={styles.criteriaRow}>
                <MobileIcon name={icon} size={18} color={theme.textSecondary} />
                <Text style={[styles.bodyText, styles.flex1, { color: theme.textHeading }]}>{text}</Text>
              </View>
            ))}
          </View>
        </>
      );
    }
    if (sheetMode === 'lost') {
      return (
        <>
          <SheetHeader title={c.markLost} onClose={closeSheet} />
          <View style={styles.sheetBody}>
            <Text style={[styles.bodyText, { color: theme.textSecondary }]}>{c.lostReasonHint}</Text>
            <MobileInput
              value={lostReason}
              onChangeText={setLostReason}
              placeholder={c.lostReasonPlaceholder}
              editable={!statusBusy}
            />
            <MobileButton onPress={() => void changeStatus('lost')} disabled={statusBusy} isLoading={statusBusy}>
              {c.confirmLost}
            </MobileButton>
          </View>
        </>
      );
    }
    return (
      <>
        <SheetHeader title={c.changeStatus} onClose={closeSheet} />
        <View style={styles.sheetBody}>
          {statusTargets.map((target) => (
            <Pressable
              key={target}
              disabled={statusBusy}
              onPress={() => void changeStatus(target)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.statusOption, { borderColor: theme.border }, iosPressed(pressed)]}
              {...androidRipple}
            >
              <LeadStatusBadge status={target} />
              <Text style={[styles.statusOptionLabel, { color: theme.textHeading }]}>
                {target === 'lost' ? c.markLost : c.markInProgress}
              </Text>
              {statusBusy && target === 'inprogress' ? (
                <ActivityIndicator color={agentColor} />
              ) : (
                <MobileIcon name="chevron-right" size={18} color={theme.textSecondary} />
              )}
            </Pressable>
          ))}
        </View>
      </>
    );
  };

  return (
    <View style={styles.root}>
      {leadError ? (
        <View style={[styles.banner, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.bannerText, { color: theme.textHeading }]}>{c.loadError}</Text>
          <Pressable onPress={() => setLeadAttempt((n) => n + 1)} hitSlop={8}>
            <Text style={[styles.link, { color: tokens.colors.accent }]}>{c.retry}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.card, cardShadow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.heroTop}>
          <View style={[styles.avatar, { backgroundColor: STATUS_PILL_TONES.slate.bg }]}>
            <Text style={[styles.avatarText, { color: theme.textHeading }]}>{leadAvatarInitials(lead.name)}</Text>
          </View>
          <View style={styles.heroMain}>
            <View style={styles.nameRow}>
              <Text style={[styles.heroName, { color: theme.textHeading }]} numberOfLines={1}>
                {lead.name}
              </Text>
              <Pressable
                disabled={!statusTargets.length}
                onPress={() => openSheet('status')}
                accessibilityRole="button"
                accessibilityLabel={`${c.changeStatus}: ${statusLabel}`}
                accessibilityState={{ disabled: !statusTargets.length }}
                hitSlop={6}
                style={({ pressed }) => [styles.statusPill, iosPressed(pressed)]}
              >
                <LeadStatusBadge status={displayStatus} />
                {statusTargets.length ? <MobileIcon name="chevron-down" size={12} color={statusTone.fg} /> : null}
              </Pressable>
            </View>
            <Text style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={1}>
              {c.leadCodeLine
                .replace('{code}', formatLeadCode(lead))
                .replace('{date}', formatDate(lead.createdAt, locale) ?? '—')}
            </Text>
          </View>
          <Pressable
            onPress={call}
            accessibilityRole="button"
            accessibilityLabel={`${c.callPhone} ${phoneText}`}
            style={({ pressed }) => [styles.callBtn, iosPressed(pressed)]}
            android_ripple={{ color: 'rgba(255,255,255,0.24)', borderless: true }}
          >
            <MobileIcon name="phone" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={[styles.summaryBox, { backgroundColor: theme.background }]}>
          {summary.map((row) => (
            <View key={row.icon} style={styles.summaryRow}>
              <MobileIcon name={row.icon} size={20} color={theme.textSecondary} />
              <Text
                style={[
                  row.strong ? styles.summaryStrong : styles.summaryText,
                  { color: row.text ? theme.textHeading : tokens.colors.placeholder },
                ]}
                numberOfLines={2}
              >
                {row.text ?? c.unknown}
              </Text>
            </View>
          ))}
        </View>

        {lead.status === 'lost' && lead.lostReason ? (
          <View style={[styles.lostBox, { backgroundColor: STATUS_PILL_TONES.slate.bg }]}>
            <Text style={[styles.meta, { color: STATUS_PILL_TONES.slate.fg }]}>{c.lostReason}</Text>
            <Text style={[styles.bodyText, { color: theme.textHeading }]}>{lead.lostReason}</Text>
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={onOpenInfo}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.infoCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
          iosPressed(pressed),
        ]}
        {...androidRipple}
      >
        <MobileIcon name="list-rows" size={20} color={theme.textHeading} />
        <Text style={[styles.infoLabel, { color: theme.textHeading }]}>{c.viewFullInfo}</Text>
        <MobileIcon name="chevron-right" size={18} color={theme.textSecondary} />
      </Pressable>

      <LeadViewingsSection
        lead={lead}
        viewings={viewings}
        matches={matches}
        onOpenMatch={onOpenMatch}
        onSaved={onViewingSaved}
      />

      <Animated.View layout={LinearTransition.duration(220)} style={styles.section}>
        <View style={styles.sectionHead}>
          <Pressable
            disabled={!suggestionsCollapsible}
            onPress={toggleSuggestions}
            accessibilityRole={suggestionsCollapsible ? 'button' : 'header'}
            accessibilityState={suggestionsCollapsible ? { expanded: suggestionsOpen } : undefined}
            style={({ pressed }) => [styles.sectionToggle, suggestionsCollapsible ? iosPressed(pressed) : null]}
            android_ripple={suggestionsCollapsible ? { color: 'rgba(33,30,30,0.08)' } : undefined}
          >
            <Text style={[styles.sectionTitle, styles.noFlex, { color: theme.textHeading }]}>
              {!lastRun || !ready || booked
                ? hasViewings
                  ? c.suggestedTitle
                  : c.matchedTitle
                : suggestions.length > visibleMatches.length && !suggestionsCollapsible
                  ? (hasViewings ? c.suggestedTitleCapped : c.matchedTitleCapped)
                      .replace('{shown}', String(visibleMatches.length))
                      .replace('{total}', String(suggestions.length))
                  : (hasViewings ? c.suggestedTitleCount : c.matchedTitleCount).replace(
                      '{count}',
                      String(suggestions.length),
                    )}
            </Text>
            {suggestionsSummary ? (
              <View style={styles.runMeta}>
                <Text style={[styles.meta, styles.flexShrink, { color: theme.textSecondary }]} numberOfLines={1}>
                  {suggestionsSummary}
                </Text>
                {lastRun?.stale ? <MobileStatusPill label={c.matchStale} tone="yellow" /> : null}
              </View>
            ) : null}
          </Pressable>
          {lastRun && ready && !booked ? (
            <Pressable
              onPress={openSettings}
              disabled={!settings}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={c.matchSettings.title}
              accessibilityState={{ disabled: !settings }}
            >
              <MobileIcon name="sliders" size={20} color={settings ? theme.textSecondary : tokens.colors.divider} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => openSheet('criteria')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={c.scoreCriteria}
          >
            <MobileIcon name="info" size={20} color={theme.textSecondary} />
          </Pressable>
          {suggestionsCollapsible ? (
            <Pressable
              onPress={toggleSuggestions}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={suggestionsSummary ?? undefined}
              accessibilityState={{ expanded: suggestionsOpen }}
            >
              <FoldChevron open={suggestionsOpen} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
        {suggestionsCollapsed ? null : suggestionsCollapsible ? (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
            {renderMatches()}
          </Animated.View>
        ) : (
          renderMatches()
        )}
      </Animated.View>

      <MobileBottomSheet
        visible={sheetOpen}
        onClose={closeSheet}
        avoidKeyboard={sheetMode === 'lost'}
        maxHeight={sheetMode === 'criteria' || sheetMode === 'settings' ? '80%' : '70%'}
      >
        {renderSheet()}
      </MobileBottomSheet>
    </View>
  );
}

/** Cards that slide in one after another when the suggestions open; the rest just fade in with the list. */
const STAGGERED_CARDS = 3;

function FoldChevron({ open, color }: { open: boolean; color: string }) {
  const rotation = useSharedValue(open ? 180 : 0);
  useEffect(() => {
    rotation.value = withTiming(open ? 180 : 0, { duration: 200 });
  }, [open, rotation]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <MobileIcon name="chevron-down" size={20} color={color} />
    </Animated.View>
  );
}

const MAX_CARD_ISSUES = 2;

/** Why the room does not fully fit, one line per issue, so the agent sees it without opening the room. */
function MatchIssues({ match }: { match: LeadRoomMatch }) {
  const { m, reason } = useMatchCopy();
  const { issues } = summarizeComparison(match.comparison);
  const toneOf = (key: CompareKey) => STATUS_PILL_TONES[criterionTone(match.comparison[key].score) === 'red' ? 'red' : 'yellow'];
  const ok = STATUS_PILL_TONES.green;
  if (!issues.length) {
    return (
      <View style={[styles.issue, { backgroundColor: ok.bg }]}>
        <MobileIcon name="check" size={14} color={ok.fg} />
        <Text style={[styles.issueText, { color: ok.fg }]} numberOfLines={1}>
          {m.allPass}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.issues}>
      {issues.slice(0, MAX_CARD_ISSUES).map((key) => {
        const tone = toneOf(key);
        return (
          <View key={key} style={[styles.issue, { backgroundColor: tone.bg }]}>
            <MobileIcon name="warning" size={14} color={tone.fg} />
            <Text style={[styles.issueText, { color: tone.fg }]} numberOfLines={2}>
              {reason(key, match.comparison)}
            </Text>
          </View>
        );
      })}
      {issues.length > MAX_CARD_ISSUES ? (
        <Text style={[styles.meta, { color: STATUS_PILL_TONES.yellow.fg }]}>
          {m.moreIssues.replace('{count}', String(issues.length - MAX_CARD_ISSUES))}
        </Text>
      ) : null}
    </View>
  );
}

function MatchedRoomCard({ match, onPress }: { match: LeadRoomMatch; onPress?: (match: LeadRoomMatch) => void }) {
  const { t } = useLocale();
  const c = t.agent.leads;
  const { reason } = useMatchCopy();
  const { theme } = useMobileTheme();
  const { room } = match;
  const title = room.listingTitle || room.property?.name || `#${room.id}`;
  const area = room.property?.district || room.property?.province || '';
  const distance = c.roomDistance.replace('{km}', formatKm(match.distanceKm));
  const issueText = summarizeComparison(match.comparison).issues.map((key) => reason(key, match.comparison));

  return (
    <Pressable
      disabled={!onPress}
      onPress={() => onPress?.(match)}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[title, c.matchScoreA11y.replace('{score}', String(match.score)), ...issueText].join(', ')}
      style={({ pressed }) => [
        styles.roomCard,
        cardShadow,
        { backgroundColor: theme.surface, borderColor: theme.border },
        pressed && Platform.OS === 'ios' ? { opacity: 0.8 } : null,
      ]}
      android_ripple={onPress ? { color: 'rgba(33,30,30,0.08)' } : undefined}
    >
      <View style={styles.roomTop}>
        <View style={[styles.roomImage, { backgroundColor: theme.background }]}>
          {room.coverMediaUrl ? (
            <Image source={{ uri: room.coverMediaUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          ) : (
            <MobileIcon name="buildings" size={28} color={tokens.colors.divider} />
          )}
        </View>
        <View style={styles.roomMain}>
          <Text style={[styles.roomTitle, { color: theme.textHeading }]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[styles.roomPrice, { color: theme.textHeading }]} numberOfLines={1}>
            {match.price.toLocaleString()} {c.perMonth}
          </Text>
          <View style={styles.roomLine}>
            <MobileIcon name="map-pin" size={14} color={theme.textSecondary} />
            <Text style={[styles.meta, styles.flexShrink, { color: theme.textSecondary }]} numberOfLines={1}>
              {[area, distance].filter(Boolean).join(' ')}
            </Text>
          </View>
        </View>
        <View style={styles.roomAside}>
          <MobileScoreRing value={match.score} size={52} label={c.scoreOverallLabel} />
          {onPress ? <MobileIcon name="chevron-right" size={16} color={theme.textSecondary} /> : null}
        </View>
      </View>
      <MatchIssues match={match} />
    </Pressable>
  );
}

export function StateCard({
  icon,
  title,
  body,
  action,
}: {
  icon: AppIconName;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  const { theme } = useMobileTheme();
  return (
    <View style={[styles.stateCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.stateIcon, { backgroundColor: theme.background }]}>
        <MobileIcon name={icon} size={22} color={theme.textSecondary} />
      </View>
      <Text style={[styles.stateTitle, { color: theme.textHeading }]}>{title}</Text>
      {body ? <Text style={[styles.stateBody, { color: theme.textSecondary }]}>{body}</Text> : null}
      {action ? <View style={styles.stateAction}>{action}</View> : null}
    </View>
  );
}

export function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  return (
    <View style={styles.sheetHeader}>
      <Text style={[styles.sheetTitle, { color: theme.textHeading }]} numberOfLines={2}>
        {title}
      </Text>
      <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.common.cancel}>
        <MobileIcon name="close" size={22} color={theme.textHeading} />
      </Pressable>
    </View>
  );
}

const iosPressed = (pressed: boolean) => (pressed && Platform.OS === 'ios' ? { opacity: 0.75 } : null);
const androidRipple = Platform.OS === 'android' ? { android_ripple: { color: 'rgba(33,30,30,0.08)' } } : {};

const styles = StyleSheet.create({
  root: { gap: 14, paddingBottom: 24 },
  flex1: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bannerText: { flex: 1, fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 21 },
  link: { fontFamily: tokens.typography.native.bodyBold, fontSize: 13, lineHeight: 19 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 14 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: tokens.typography.native.headingTh, fontSize: 20, lineHeight: 30 },
  heroMain: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroName: { flexShrink: 1, fontFamily: tokens.typography.native.headingTh, fontSize: 20, lineHeight: 30 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  meta: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
  nextViewing: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  nextViewingText: { flexShrink: 1, fontFamily: tokens.typography.native.bodyBold, fontSize: 13, lineHeight: 20 },
  nextViewingRoom: { fontFamily: tokens.typography.native.body },
  callBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary,
    overflow: 'hidden',
  },
  summaryBox: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryStrong: { flex: 1, fontFamily: tokens.typography.native.headingTh, fontSize: 17, lineHeight: 26 },
  summaryText: { flex: 1, fontFamily: tokens.typography.native.body, fontSize: 15, lineHeight: 22 },
  lostBox: { borderRadius: 12, padding: 12, gap: 2 },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  infoLabel: { flex: 1, fontFamily: tokens.typography.native.bodyBold, fontSize: 15, lineHeight: 22 },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { flex: 1, fontFamily: tokens.typography.native.headingTh, fontSize: 16, lineHeight: 24 },
  sectionToggle: { flex: 1, minWidth: 0, minHeight: 32, justifyContent: 'center', gap: 2, overflow: 'hidden' },
  noFlex: { flex: 0 },
  loader: { paddingVertical: 24 },
  roomList: { gap: 10 },
  roomCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    gap: 10,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  roomTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roomImage: {
    width: 76,
    height: 76,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomMain: { flex: 1, minWidth: 0, gap: 2 },
  roomTitle: { fontFamily: tokens.typography.native.bodyBold, fontSize: 15, lineHeight: 22 },
  roomPrice: { fontFamily: tokens.typography.native.headingTh, fontSize: 16, lineHeight: 24 },
  roomLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  roomAside: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  issues: { gap: 6 },
  issue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  issueText: { flex: 1, fontFamily: tokens.typography.native.bodyBold, fontSize: 13, lineHeight: 19 },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  moreLabel: { fontFamily: tokens.typography.native.bodyBold, fontSize: 14, lineHeight: 21 },
  stateCard: { borderWidth: 1, borderRadius: 16, padding: 20, alignItems: 'center', gap: 6 },
  stateIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  stateTitle: { fontFamily: tokens.typography.native.headingTh, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  stateBody: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  stateAction: { alignSelf: 'stretch', marginTop: 8 },
  sheetAction: { marginTop: 8 },
  clearLink: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 8, overflow: 'hidden' },
  dangerBtn: { backgroundColor: tokens.colors.danger },
  dangerLabel: { color: '#FFFFFF' },
  runMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  settingGroup: { gap: 6 },
  settingTitle: { fontFamily: tokens.typography.native.bodyBold, fontSize: 15, lineHeight: 22 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  scoreHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreValue: { fontFamily: tokens.typography.native.headingTh, fontSize: 20, lineHeight: 30 },
  scoreSlider: { height: 40 },
  scoreThumb: { borderWidth: 3, borderColor: '#FFFFFF', ...cardShadow },
  scoreScale: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  scoreScaleText: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  sheetTitle: { flex: 1, fontFamily: tokens.typography.native.headingTh, fontSize: 18, lineHeight: 27 },
  sheetBody: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, gap: 12 },
  bodyText: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 21 },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  statusOptionLabel: { flex: 1, fontFamily: tokens.typography.native.bodyBold, fontSize: 15, lineHeight: 22 },
  criteriaRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
});
