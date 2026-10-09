import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import type { AgentLead } from '@nestyk/types';
import {
  formatBedroomSpec,
  HeroPhotoPager,
  RoomShareLinkSheet,
  type AgentRoomDetail,
  type RoomShareVisibility,
} from '@nestyk/feature-listing';
import {
  MobileActionSheetBody,
  MobileBottomSheet,
  MobileButton,
  MobileIcon,
  MobileScoreRing,
  MobileStatusPill,
  STATUS_PILL_TONES,
  tokens,
  useMobileTheme,
  type AppIconName,
  type MobileStatusPillTone,
  type MobileStatusPillToneKey,
} from '@nestyk/ui/native';
import {
  createRoomShareLink,
  fetchAgentRoom,
  listRoomShareLinks,
  revokeRoomShareLink,
} from '../lib/agent-listings-api';
import type { LeadRoomMatch } from '../lib/lead-match-preview';
import {
  COMPARE_KEYS,
  criterionTone,
  roomLayoutValue,
  summarizeComparison,
  type CompareKey,
  type CompareStatus,
} from '../lib/lead-room-compare';
import { formatBudgetRange, formatKm, formatMoveIn } from '../lib/lead-format';
import { leadCardShadow } from './AgentLeadDetailBody';
import { useMatchCopy } from './lead-match-copy';

/** Lets the closing sheet's modal unmount before the next one opens (iOS can't stack them mid-animation). */
const SHEET_HANDOFF_MS = 300;

const ISSUES: CompareStatus[] = ['near', 'mismatch', 'later'];
/** Rows that get a status pill; full passes and blanks the lead left unset speak through the % alone. */
const PILLED: CompareStatus[] = [...ISSUES, 'unknown', 'notEvaluable'];

/** Pastel pill tones wash out on dark surfaces. */
const DARK_TONES: Partial<Record<MobileStatusPillToneKey, MobileStatusPillTone>> = {
  green: { bg: 'rgba(34,197,94,0.16)', fg: '#4ADE80' },
  yellow: { bg: 'rgba(245,158,11,0.18)', fg: '#FBBF24' },
  red: { bg: 'rgba(220,38,38,0.18)', fg: '#F87171' },
  slate: { bg: 'rgba(148,163,184,0.16)', fg: '#CBD5E1' },
};

function toneFor(key: MobileStatusPillToneKey, isDark: boolean): MobileStatusPillTone {
  return (isDark && DARK_TONES[key]) || STATUS_PILL_TONES[key];
}

const ROW_ICONS: Record<CompareKey, AppIconName> = {
  budget: 'credit-card',
  location: 'map-pin',
  roomType: 'home',
  lease: 'file-text',
  moveIn: 'calendar',
};

export function LeadMatchedRoomBody({
  lead,
  match,
  onOpenRoom,
  onPreviewRoom,
  roomVersion = 0,
  menuRequest = 0,
}: {
  lead: AgentLead;
  match: LeadRoomMatch;
  onOpenRoom: (roomId: number) => void;
  /** Customer preview chosen in the share sheet. */
  onPreviewRoom: (roomId: number, visibility: RoomShareVisibility, contactId: number | null) => void;
  /** Bumped when the room was edited elsewhere; re-reads the room detail. */
  roomVersion?: number;
  /** Bumped by the shell header "⋯" button; a change (not the mount value) opens the menu. */
  menuRequest?: number;
}) {
  const { t, locale, m, roomTypeName, months } = useMatchCopy();
  const c = t.agent.leads;
  const { theme, isDark } = useMobileTheme();
  const [room, setRoom] = useState<AgentRoomDetail | null>(null);
  const [roomError, setRoomError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [width, setWidth] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const handoff = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (handoff.current) clearTimeout(handoff.current);
  }, []);

  const seenMenuRequest = useRef(menuRequest);
  useEffect(() => {
    if (menuRequest === seenMenuRequest.current) return;
    seenMenuRequest.current = menuRequest;
    setMenuOpen(true);
  }, [menuRequest]);

  useEffect(() => {
    let active = true;
    setRoomError(false);
    fetchAgentRoom(match.room.id)
      .then((detail) => {
        if (active) setRoom(detail);
      })
      .catch(() => {
        if (active) setRoomError(true);
      });
    return () => {
      active = false;
    };
  }, [match.room.id, attempt, roomVersion]);

  const photos = useMemo(() => {
    const images = room?.medias.filter((media) => media.mediaType === 'image') ?? [];
    if (images.length) return images.map((media) => ({ id: String(media.id), uri: media.mediaUrl }));
    return match.room.coverMediaUrl ? [{ id: 'cover', uri: match.room.coverMediaUrl }] : [];
  }, [room, match.room.coverMediaUrl]);

  const { comparison, score } = match;
  const summary = summarizeComparison(comparison);
  const judged = COMPARE_KEYS.filter((key) => comparison[key].score != null).length;

  const heroHeight = Math.round(Math.min(width * 0.5, 180));
  const title = match.room.property?.name || room?.promoTitle?.trim() || match.room.listingTitle || `#${match.room.id}`;
  const size = room ? roomLayoutValue(room, 'room_size') : match.room.roomSizeSqm ?? null;
  const subtitle = [roomTypeName(comparison.roomType.have), size ? m.factSizeValue.replace('{value}', size) : null]
    .filter(Boolean)
    .join(' · ');
  const area = match.room.property?.district || match.room.property?.province || '';
  const km = formatKm(match.distanceKm);
  const fromPin = m.distanceFromPinName.replace('{km}', km).replace('{name}', comparison.location.pinName);
  const budget = formatBudgetRange(lead);
  const headroom = comparison.budget.headroom;

  const statusLabel: Record<CompareStatus, string> = {
    pass: m.pass,
    near: m.near,
    mismatch: m.mismatch,
    later: m.later,
    unspecified: m.unspecified,
    unknown: m.roomUnknown,
    notEvaluable: m.notEvaluated,
  };

  const rows: Array<{ key: CompareKey; title: string; want: string | null; have: string | null; sub?: string }> = [
    {
      key: 'budget',
      title: m.budget,
      want: budget ? `${budget} ฿` : null,
      have: `${comparison.budget.price.toLocaleString()} ${c.perMonth}`,
      sub: headroom ? m.belowBudget.replace('{amount}', headroom.toLocaleString()) : undefined,
    },
    {
      key: 'location',
      title: m.location,
      want: m.wantLocation.replace('{name}', comparison.location.pinName).replace('{km}', String(lead.radiusKm ?? '')),
      have: fromPin,
    },
    {
      key: 'roomType',
      title: m.roomType,
      want: roomTypeName(comparison.roomType.want),
      have: roomTypeName(comparison.roomType.have),
    },
    {
      key: 'lease',
      title: m.lease,
      want: comparison.lease.want != null ? months(comparison.lease.want) : null,
      have: comparison.lease.terms.length ? months(comparison.lease.terms.join(', ')) : null,
    },
    {
      key: 'moveIn',
      title: m.moveIn,
      want: formatMoveIn(comparison.moveIn.want, locale),
      have: comparison.moveIn.availableFrom
        ? m.availableFrom.replace('{date}', formatMoveIn(comparison.moveIn.availableFrom, locale) ?? '')
        : null,
    },
  ];
  const green = toneFor('green', isDark);
  const issueTone = toneFor(
    summary.issues.some((key) => criterionTone(comparison[key].score) === 'red') ? 'red' : 'yellow',
    isDark,
  );

  const facts = room ? roomFacts(room, match, { t, m, months }) : [];

  /** The hero sits inside the summary card, so it is the card width minus its 1px borders. */
  const photoWidth = Math.max(width - 2, 0);

  const onHeroScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(photoWidth, 1));
      if (next >= 0 && next < photos.length) setPhotoIndex(next);
    },
    [photos.length, photoWidth],
  );

  const afterMenuClose = (next: () => void) => {
    setMenuOpen(false);
    handoff.current = setTimeout(next, SHEET_HANDOFF_MS);
  };

  return (
    <View style={styles.root} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.card, leadCardShadow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.hero, { height: heroHeight || 170, backgroundColor: theme.background }]}>
          {photoWidth > 0 && photos.length ? (
            <>
              <FlatList
                data={photos}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onHeroScroll}
                getItemLayout={(_, index) => ({ length: photoWidth, offset: photoWidth * index, index })}
                renderItem={({ item }) => (
                  <Pressable onPress={() => onOpenRoom(match.room.id)} accessibilityRole="imagebutton">
                    <Image
                      source={{ uri: item.uri }}
                      style={{ width: photoWidth, height: heroHeight }}
                      contentFit="cover"
                      transition={150}
                    />
                  </Pressable>
                )}
              />
              <HeroPhotoPager index={photoIndex} total={photos.length} bottom={12} />
            </>
          ) : (
            <View style={styles.heroEmpty}>
              {roomError ? (
                <>
                  <Text style={[styles.body, { color: theme.textSecondary }]}>{m.loadError}</Text>
                  <MobileButton variant="outline" onPress={() => setAttempt((n) => n + 1)}>
                    {c.retry}
                  </MobileButton>
                </>
              ) : room ? (
                <MobileIcon name="camera" size={28} color={tokens.colors.divider} />
              ) : (
                <ActivityIndicator color={tokens.colors.roles.agent} />
              )}
            </View>
          )}
        </View>
        <View style={[styles.titleRow, styles.summaryBody]}>
          <View style={styles.titleMain}>
            <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={2}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.body, { color: theme.textSecondary }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
            <Text style={[styles.price, { color: theme.textHeading }]} numberOfLines={1}>
              {match.price.toLocaleString()} {c.perMonth}
              {match.termMonths ? (
                <Text style={[styles.meta, { color: theme.textSecondary }]}>{`  ·  ${months(match.termMonths)}`}</Text>
              ) : null}
            </Text>
            <View style={styles.inline}>
              <MobileIcon name="map-pin" size={15} color={theme.textSecondary} />
              <Text style={[styles.meta, styles.flex1, { color: theme.textSecondary }]} numberOfLines={1}>
                {[area, fromPin].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>
          <MobileScoreRing
            value={score}
            size={64}
            label={c.scoreOverallLabel}
            accessibilityLabel={c.matchScoreA11y.replace('{score}', String(score))}
          />
        </View>
        <View style={[styles.summaryFooter, { borderTopColor: theme.border }]}>
          <Text style={[styles.meta, styles.flex1, { color: theme.textSecondary }]}>
            {m.evaluatedCount.replace('{count}', String(judged)).replace('{total}', String(COMPARE_KEYS.length))}
          </Text>
          {summary.issues.length ? (
            <View style={styles.inline}>
              <MobileIcon name="warning" size={14} color={issueTone.fg} />
              <Text style={[styles.meta, styles.bold, { color: issueTone.fg }]}>
                {m.issueCount.replace('{count}', String(summary.issues.length))}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textHeading }]}>{m.evaluationTitle}</Text>
        <View style={[styles.card, leadCardShadow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View
            style={[styles.tableHead, { backgroundColor: theme.background, borderBottomColor: theme.border }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={[styles.meta, styles.bold, styles.flex1, { color: theme.textSecondary }]}>{m.want}</Text>
            <View style={[styles.valueDivider, { backgroundColor: theme.border }]} />
            <Text style={[styles.meta, styles.bold, styles.flex1, { color: theme.textSecondary }]}>{m.have}</Text>
          </View>
          {rows.map((row, index) => {
            const status = comparison[row.key].status as CompareStatus;
            const rowScore = comparison[row.key].score;
            const issue = ISSUES.includes(status);
            const pill = PILLED.includes(status) ? statusLabel[status] : null;
            const scoreText = rowScore == null ? '—' : `${Math.round(rowScore)}%`;
            const toneKey = criterionTone(rowScore);
            const tone = toneFor(toneKey, isDark);
            const scoreColor = rowScore == null ? tokens.colors.placeholder : tone.fg;
            const want = row.want ?? (status === 'unspecified' ? m.unspecified : null);
            const a11y =
              rowScore == null
                ? `${row.title}, ${m.scoreExcluded}`
                : m.rowScoreA11y.replace('{title}', row.title).replace('{score}', String(Math.round(rowScore)));
            const note =
              row.key === 'location' && rowScore != null && rowScore < 100
                ? m.locationBreakdown
                    .replace('{distance}', String(comparison.location.distanceScore))
                    .replace('{rank}', String(comparison.location.pinRank))
                    .replace('{weight}', String(Math.round(comparison.location.pinWeight * 100)))
                : status === 'notEvaluable'
                  ? m.notEvaluableNote
                  : status === 'unknown'
                    ? m.unknownNote
                    : null;
            return (
              <View
                key={row.key}
                style={[
                  styles.compareRow,
                  index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border } : null,
                  issue ? [styles.issueRow, toneKey === 'red' ? styles.issueRowRed : null] : null,
                ]}
                accessible
                accessibilityLabel={[
                  a11y,
                  pill,
                  `${m.want} ${want ?? c.unknown}`,
                  `${m.have} ${row.have ?? c.unknown}`,
                  row.sub,
                  note,
                ]
                  .filter(Boolean)
                  .join(', ')}
              >
                {issue ? <View style={[styles.issueBar, { backgroundColor: tone.fg }]} /> : null}
                <View style={styles.compareHead}>
                  <MobileIcon name={ROW_ICONS[row.key]} size={18} color={theme.textSecondary} />
                  <Text style={[styles.body, styles.bold, styles.flex1, { color: theme.textHeading }]}>{row.title}</Text>
                  <Text style={[styles.body, styles.bold, styles.scoreText, { color: scoreColor }]}>{scoreText}</Text>
                  {pill ? <MobileStatusPill label={pill} tone={tone} /> : null}
                </View>
                <View style={styles.compareValues}>
                  <View style={styles.flex1}>
                    <Text
                      style={[styles.body, { color: row.want ? theme.textSecondary : tokens.colors.placeholder }]}
                      numberOfLines={2}
                    >
                      {want ?? c.unknown}
                    </Text>
                  </View>
                  <View style={[styles.valueDivider, { backgroundColor: theme.border }]} />
                  <View style={styles.flex1}>
                    <Text
                      style={[
                        styles.body,
                        issue ? styles.bold : null,
                        { color: !row.have ? tokens.colors.placeholder : issue ? tone.fg : theme.textHeading },
                      ]}
                      numberOfLines={2}
                    >
                      {row.have ?? c.unknown}
                    </Text>
                    {row.sub ? <Text style={[styles.meta, { color: green.fg }]}>{row.sub}</Text> : null}
                  </View>
                </View>
                {note ? <Text style={[styles.meta, styles.note, { color: theme.textSecondary }]}>{note}</Text> : null}
              </View>
            );
          })}
          <Pressable
            onPress={() => setHowOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: howOpen }}
            android_ripple={{ color: theme.border }}
            style={({ pressed }) => [
              styles.howHead,
              { borderTopColor: theme.border },
              pressed && Platform.OS === 'ios' ? { opacity: 0.7 } : null,
            ]}
          >
            <MobileIcon name="info" size={16} color={theme.textSecondary} />
            <Text style={[styles.meta, styles.bold, styles.flex1, { color: theme.textSecondary }]}>{m.howScored}</Text>
            <View style={howOpen ? styles.flipped : undefined}>
              <MobileIcon name="chevron-down" size={16} color={theme.textSecondary} />
            </View>
          </Pressable>
          {howOpen ? (
            <View style={styles.howBody}>
              {[m.howScoredHigher, m.howScoredPerRow, m.howScoredAverage].map((line) => (
                <Text key={line} style={[styles.meta, { color: theme.textSecondary }]}>
                  {`• ${line}`}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textHeading }]}>{m.factsTitle}</Text>
        <View style={[styles.card, leadCardShadow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {!room ? (
            <View style={styles.factsState}>
              {roomError ? (
                <Text style={[styles.body, { color: tokens.colors.placeholder }]}>{c.unknown}</Text>
              ) : (
                <ActivityIndicator color={tokens.colors.roles.agent} />
              )}
            </View>
          ) : facts.length ? (
            facts.map((group, index) => (
              <View
                key={group.key}
                style={[
                  styles.factGroup,
                  index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border } : null,
                ]}
              >
                <Text style={[styles.meta, styles.bold, { color: theme.textSecondary }]} accessibilityRole="header">
                  {group.title}
                </Text>
                {group.facts.map((fact) => (
                  <View key={fact.key} style={styles.factRow} accessible accessibilityLabel={`${fact.label} ${fact.value}`}>
                    <MobileIcon name={fact.icon} size={16} color={theme.textSecondary} />
                    <Text style={[styles.body, styles.factLabel, { color: theme.textSecondary }]}>{fact.label}</Text>
                    <Text
                      style={[styles.body, styles.factValue, fact.strong ? styles.bold : null, { color: theme.textHeading }]}
                      numberOfLines={2}
                    >
                      {fact.value}
                    </Text>
                  </View>
                ))}
              </View>
            ))
          ) : (
            <View style={styles.factsState}>
              <Text style={[styles.body, { color: tokens.colors.placeholder }]}>{c.unknown}</Text>
            </View>
          )}
        </View>
      </View>

      <MobileBottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <MobileActionSheetBody
          title={c.moreActions}
          actions={[
            { key: 'share', label: m.shareLink, onPress: () => afterMenuClose(() => setShareOpen(true)), disabled: !room },
            { key: 'room', label: m.viewRoom, onPress: () => afterMenuClose(() => onOpenRoom(match.room.id)) },
          ]}
        />
      </MobileBottomSheet>

      {room ? (
        <RoomShareLinkSheet
          visible={shareOpen}
          room={room}
          api={{ create: createRoomShareLink, list: listRoomShareLinks, revoke: revokeRoomShareLink }}
          onClose={() => setShareOpen(false)}
          onPreview={(visibility, contactId) => {
            setShareOpen(false);
            handoff.current = setTimeout(() => onPreviewRoom(match.room.id, visibility, contactId), SHEET_HANDOFF_MS);
          }}
        />
      ) : null}
    </View>
  );
}

type MatchCopy = ReturnType<typeof useMatchCopy>;
type Fact = { key: string; icon: AppIconName; label: string; value: string; strong?: boolean };
type FactGroup = { key: string; title: string; facts: Fact[] };

/** Room facts as label/value rows; anything the room doesn't record is left out rather than shown as 0 or —. */
function roomFacts(
  room: AgentRoomDetail,
  match: LeadRoomMatch,
  { t, m, months }: Pick<MatchCopy, 't' | 'm' | 'months'>,
): FactGroup[] {
  const spec = t.agent.listings;
  const size = roomLayoutValue(room, 'room_size');
  const floor = roomLayoutValue(room, 'floor');
  const building = roomLayoutValue(room, 'building');
  const bed = roomLayoutValue(room, 'bedroom');
  const bath = roomLayoutValue(room, 'bathroom');
  const bedValue = formatBedroomSpec(
    bed,
    { studio: t.masters.roomTypes.studio, one: spec.specBed, many: spec.specBeds },
    room.roomTypeCode,
  );
  const roomRows: Array<Omit<Fact, 'value'> & { value: string | null }> = [
    { key: 'bed', icon: 'bed', label: m.factBedroom, value: bedValue },
    {
      key: 'bath',
      icon: 'bath',
      label: m.factBathroom,
      value: bath ? (Number(bath) === 1 ? spec.specBath : spec.specBaths).replace('{count}', bath) : null,
    },
    { key: 'size', icon: 'room-size', label: m.factSize, value: size ? spec.specSqm.replace('{size}', size) : null },
    {
      key: 'floor',
      icon: 'stairs',
      label: m.factFloor,
      value: floor
        ? building
          ? t.agent.roomDetail.floorBuilding.replace('{floor}', floor).replace('{building}', building)
          : spec.specFloor.replace('{floor}', floor)
        : null,
    },
  ];

  const term = room.prices.find((p) => p.termMonths === match.termMonths);
  const deposit = term?.depositMonths ?? room.depositMonths;
  const advance = term?.advanceRentMonths ?? room.advanceRentMonths;
  const monthsAmount = (count: number) =>
    count > 0
      ? m.factMonthsAmount.replace('{months}', String(count)).replace('{amount}', (count * match.price).toLocaleString())
      : m.factNone;
  const upfront = (deposit + advance) * match.price;
  const costRows: Array<Omit<Fact, 'value'> & { value: string | null }> = [
    { key: 'deposit', icon: 'shield', label: m.factDeposit, value: monthsAmount(deposit) },
    { key: 'advance', icon: 'credit-card', label: m.factAdvance, value: monthsAmount(advance) },
    { key: 'upfront', icon: 'coins', label: m.factUpfront, value: upfront > 0 ? `${upfront.toLocaleString()} ฿` : null, strong: true },
    { key: 'water', icon: 'drop', label: m.factWater, value: room.waterRatePerUnit ? m.factRate.replace('{value}', room.waterRatePerUnit) : null },
    {
      key: 'electric',
      icon: 'lightning',
      label: m.factElectric,
      value: room.electricRatePerUnit ? m.factRate.replace('{value}', room.electricRatePerUnit) : null,
    },
  ];

  const known = (rows: typeof roomRows): Fact[] => rows.filter((row): row is Fact => !!row.value);
  return [
    { key: 'room', title: m.factRoomGroup, facts: known(roomRows) },
    {
      key: 'cost',
      title: match.termMonths ? m.factCostGroupTerm.replace('{term}', months(match.termMonths)) : m.factCostGroup,
      facts: known(costRows),
    },
  ].filter((group) => group.facts.length > 0);
}

const styles = StyleSheet.create({
  root: { gap: 20, paddingBottom: 8 },
  flex1: { flex: 1 },
  bold: { fontFamily: tokens.typography.native.bodyBold },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hero: { borderTopLeftRadius: 15, borderTopRightRadius: 15, overflow: 'hidden' },
  heroEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titleMain: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: tokens.typography.native.headingTh, fontSize: 20, lineHeight: 30 },
  price: { fontFamily: tokens.typography.native.headingTh, fontSize: 18, lineHeight: 27 },
  meta: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
  body: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 21 },
  section: { gap: 8 },
  sectionTitle: { fontFamily: tokens.typography.native.headingTh, fontSize: 16, lineHeight: 24 },
  card: { borderWidth: 1, borderRadius: 16, overflow: Platform.OS === 'android' ? 'hidden' : 'visible' },
  tableHead: {
    flexDirection: 'row',
    gap: 12,
    paddingLeft: 42,
    paddingRight: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  compareRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 6 },
  compareHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compareValues: { flexDirection: 'row', gap: 12, paddingLeft: 26 },
  valueDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  scoreText: { minWidth: 40, textAlign: 'right' },
  issueRow: { overflow: 'hidden', backgroundColor: 'rgba(245,158,11,0.08)' },
  issueRowRed: { backgroundColor: 'rgba(220,38,38,0.07)' },
  issueBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  note: { paddingLeft: 26 },
  summaryBody: { padding: 16 },
  summaryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  howHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  flipped: { transform: [{ rotate: '180deg' }] },
  howBody: { gap: 4, paddingLeft: 40, paddingRight: 16, paddingBottom: 14 },
  factsState: { padding: 16, alignItems: 'flex-start' },
  factGroup: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  factLabel: { flexShrink: 0 },
  factValue: { flex: 1, textAlign: 'right' },
});
