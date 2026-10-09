import React, { useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { NearbyPlacesMap } from '@nestyk/feature-listing';
import type { AgentLead, LeadContactChannel, LeadPin } from '@nestyk/types';
import { useLocale } from '@nestyk/i18n';
import {
  MobileBottomSheet,
  MobileIcon,
  STATUS_PILL_TONES,
  tokens,
  useMobileTheme,
  type AppIconName,
  type MobileStatusPillTone,
} from '@nestyk/ui/native';
import { LEAD_NATIONALITY_OPTIONS, LEAD_OCCUPATION_OPTIONS, presetCodeFor } from '../lib/lead-profile-options';
import {
  formatBudgetRange,
  formatDate,
  formatKm,
  formatLeadCode,
  formatMoveIn,
  leadContactUrl,
} from '../lib/lead-format';
import { formatPhoneDisplay, phoneDialString } from '../lib/phone';
import { distanceKm } from '../lib/lead-match-preview';
import { LeadNextViewingLine, LeadStatusBadge, SheetHeader, leadCardShadow, leadDisplayStatus } from './AgentLeadDetailBody';

type Accent = 'lead' | 'matching' | 'screening' | 'notes';

/** Section icon tiles: one hue per section so the page reads at a glance; pastel fills wash out on dark surfaces. */
const ACCENTS: Record<Accent, { light: MobileStatusPillTone; dark: MobileStatusPillTone }> = {
  lead: { light: { bg: '#DBEAFE', fg: '#1D4ED8' }, dark: { bg: 'rgba(37,99,235,0.22)', fg: '#93C5FD' } },
  matching: { light: { bg: '#FEF3C7', fg: '#B45309' }, dark: { bg: 'rgba(248,182,21,0.2)', fg: '#FBBF24' } },
  screening: { light: { bg: '#FCE7F3', fg: '#BE185D' }, dark: { bg: 'rgba(255,0,82,0.18)', fg: '#F9A8D4' } },
  notes: { light: { bg: '#F1F5F9', fg: '#475569' }, dark: { bg: 'rgba(148,163,184,0.16)', fg: '#CBD5E1' } },
};

const CHIP_TONES: Record<'warn' | 'neutral', { light: MobileStatusPillTone; dark: MobileStatusPillTone }> = {
  warn: { light: STATUS_PILL_TONES.yellow, dark: { bg: 'rgba(245,158,11,0.18)', fg: '#FBBF24' } },
  neutral: { light: STATUS_PILL_TONES.slate, dark: { bg: 'rgba(148,163,184,0.16)', fg: '#CBD5E1' } },
};

/** Pin rank badges fade with rank, mirroring the 100 / 85 / 70% pin weights in matching. */
const PIN_RANK_FILL: Record<number, string> = { 1: '#FF0052', 2: 'rgba(255,0,82,0.7)', 3: 'rgba(255,0,82,0.45)' };

const CALL_GREEN = '#22C55E';
const NOTE_TINT = 'rgba(248,182,21,0.08)';

type ContactKind = LeadContactChannel | 'email';

/** Brand hues so agents spot the channel before reading it; contrast holds on light and dark surfaces. */
const CONTACT_TONES: Record<ContactKind, { icon: AppIconName; fg: string; bg: string }> = {
  email: { icon: 'envelope', fg: '#2563EB', bg: 'rgba(37,99,235,0.14)' },
  line: { icon: 'chat', fg: '#06C755', bg: 'rgba(6,199,85,0.14)' },
  whatsapp: { icon: 'chat', fg: '#25D366', bg: 'rgba(37,211,102,0.14)' },
  wechat: { icon: 'chat', fg: '#07C160', bg: 'rgba(7,193,96,0.14)' },
  facebook: { icon: 'facebook', fg: '#1877F2', bg: 'rgba(24,119,242,0.14)' },
  telegram: { icon: 'chat', fg: '#229ED9', bg: 'rgba(34,158,217,0.14)' },
  other: { icon: 'chat', fg: '#64748B', bg: 'rgba(100,116,139,0.14)' },
};

export function LeadFullInfoBody({ lead }: { lead: AgentLead }) {
  const { t, locale } = useLocale();
  const c = t.agent.leads;
  const info = c.info;
  const { theme, isDark } = useMobileTheme();
  const [mapPin, setMapPin] = useState<LeadPin | null>(null);

  const nationalityCode = presetCodeFor(LEAD_NATIONALITY_OPTIONS, lead.nationality ?? '');
  const occupationCode = presetCodeFor(LEAD_OCCUPATION_OPTIONS, lead.occupation ?? '');
  const phoneText = formatPhoneDisplay(lead.phone);
  const phoneDial = phoneDialString(lead.phone);
  const firstPin = lead.pins[0];
  const legacy = [lead.province, ...(lead.locations ?? [])].filter(Boolean).join(' · ');
  const budget = formatBudgetRange(lead);

  const roomType = lead.desiredRoomTypeCode
    ? t.masters.roomTypes[lead.desiredRoomTypeCode as keyof typeof t.masters.roomTypes] || lead.desiredRoomTypeCode
    : null;
  const lease =
    lead.leaseDurationMonths == null
      ? null
      : t.agent.createRoom.contractMonths.replace('{months}', String(lead.leaseDurationMonths));
  const moveIn = formatMoveIn(lead.moveInPlan, locale);
  const matchingMissing = [
    budget ? null : info.budget,
    lead.pins.length ? null : info.location,
    roomType ? null : info.roomType,
    lease ? null : info.lease,
    moveIn ? null : info.moveIn,
  ].filter((label): label is string => !!label);

  const nationality = nationalityCode
    ? c.nationalityOptions[nationalityCode as keyof typeof c.nationalityOptions]
    : lead.nationality || null;
  const occupation = occupationCode
    ? c.occupationOptions[occupationCode as keyof typeof c.occupationOptions]
    : lead.occupation || null;
  const visa = lead.visaTypeCode
    ? t.masters.visaTypes[lead.visaTypeCode as keyof typeof t.masters.visaTypes] || lead.visaTypeCode
    : null;
  const occupants = lead.occupantCount ? c.occupantsOption.replace('{count}', String(lead.occupantCount)) : null;
  const chips: Array<{ key: string; icon: AppIconName; label: string; tone: 'warn' | 'neutral' }> = [];
  if (lead.hasPets != null)
    chips.push({ key: 'pets', icon: 'paw', label: lead.hasPets ? info.chipPets : info.chipNoPets, tone: lead.hasPets ? 'warn' : 'neutral' });
  if (lead.isSmoker != null)
    chips.push({
      key: 'smoker',
      icon: 'flame',
      label: lead.isSmoker ? info.chipSmoker : info.chipNonSmoker,
      tone: lead.isSmoker ? 'warn' : 'neutral',
    });
  if (lead.usesCar != null) chips.push({ key: 'car', icon: 'car', label: lead.usesCar ? info.chipCar : info.chipNoCar, tone: 'neutral' });
  const screeningMissing = [
    occupants ? null : info.occupants,
    occupation ? null : info.occupation,
    nationality ? null : info.nationality,
    visa ? null : info.visa,
    lead.hasPets == null ? info.chipPets : null,
    lead.isSmoker == null ? info.chipSmoker : null,
    lead.usesCar == null ? info.chipCar : null,
  ].filter((label): label is string => !!label);

  const createdDate = formatDate(lead.createdAt, locale);
  const callGreen = isDark ? '#4ADE80' : CALL_GREEN;
  const contacts: Array<{ key: string; kind: ContactKind; label: string; value: string }> = [
    ...(lead.email ? [{ key: 'email', kind: 'email' as const, label: c.email, value: lead.email }] : []),
    ...(lead.otherContacts ?? []).map((item, index) => ({
      key: `${item.channel}-${index}`,
      kind: item.channel,
      label: c.contactChannels[item.channel] ?? item.channel,
      value: item.value,
    })),
  ];

  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SectionCard accent="lead" icon="user" title={c.sectionLead}>
          <View style={styles.leadBody}>
            <View style={styles.flex1}>
              <Text selectable style={[styles.leadName, { color: theme.textHeading }]} numberOfLines={2}>
                {lead.name}
              </Text>
              <Text selectable style={[styles.value, { color: theme.textSecondary }]}>
                {phoneText}
              </Text>
            </View>
            {phoneDial ? (
              <Pressable
                onPress={() =>
                  Linking.openURL(`tel:${phoneDial}`).catch(async () => {
                    await Clipboard.setStringAsync(phoneText);
                    Alert.alert(c.phoneCopied, phoneText);
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`${c.callPhone} ${phoneText}`}
                style={({ pressed }) => [
                  styles.callBtn,
                  { backgroundColor: callGreen },
                  pressed && Platform.OS === 'ios' ? { opacity: 0.8 } : null,
                ]}
                android_ripple={{ color: 'rgba(255,255,255,0.24)', borderless: true }}
              >
                <MobileIcon name="phone" size={20} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </View>
          {contacts.length ? (
            <View style={[styles.contacts, { borderTopColor: theme.border }]}>
              {contacts.map((item) => (
                <ContactRow key={item.key} kind={item.kind} label={item.label} value={item.value} />
              ))}
            </View>
          ) : null}
        </SectionCard>

        <SectionCard
          accent="matching"
          icon="home"
          title={c.sectionMatching}
          hint={c.sectionMatchingHint}
          collapsible
          summary={[budget ? `${budget} ${c.perMonth}` : null, firstPin?.name].filter(Boolean).join(' · ') || null}
        >
          <InfoRow label={info.budget} value={budget ? `${budget} ${c.perMonth}` : null} strong />
          <InfoRow
            label={info.location}
            node={
              lead.pins.length ? (
                <View style={styles.pins}>
                  {lead.pins.map((pin) => (
                    <Pressable
                      key={pin.rank}
                      onPress={() => setMapPin(pin)}
                      accessibilityRole="button"
                      accessibilityLabel={c.pinMapTitle.replace('{rank}', String(pin.rank))}
                      style={({ pressed }) => [styles.pinRow, pressed ? { opacity: 0.7 } : null]}
                    >
                      <View style={[styles.rankBadge, { backgroundColor: PIN_RANK_FILL[pin.rank] ?? PIN_RANK_FILL[3] }]}>
                        <Text style={styles.rankText}>{pin.rank}</Text>
                      </View>
                      <Text style={[styles.value, styles.flex1, { color: theme.textHeading }]} numberOfLines={2}>
                        {!firstPin || pin === firstPin
                          ? pin.name
                          : info.pinDistance
                              .replace('{name}', pin.name)
                              .replace(
                                '{km}',
                                formatKm(distanceKm(firstPin.latitude, firstPin.longitude, pin.latitude, pin.longitude)),
                              )}
                      </Text>
                      <MobileIcon name="map-pin" size={16} color={tokens.colors.roles.agent} />
                    </Pressable>
                  ))}
                  {lead.radiusKm != null ? (
                    <Text style={[styles.label, { color: theme.textSecondary }]}>
                      {info.radiusValue.replace('{km}', String(lead.radiusKm))}
                    </Text>
                  ) : null}
                </View>
              ) : undefined
            }
            value={legacy ? c.legacyLocation.replace('{value}', legacy) : null}
          />
          {lead.preferredLocation ? <InfoRow label={info.areaNotes} value={lead.preferredLocation} /> : null}
          <InfoRow label={info.roomType} value={roomType} />
          <InfoRow label={info.lease} value={lease} />
          <InfoRow label={info.moveIn} value={moveIn} />
          <MissingLine fields={matchingMissing} />
        </SectionCard>

        <SectionCard
          accent="screening"
          icon="shield"
          title={c.sectionScreening}
          hint={c.sectionScreeningHint}
          collapsible
          summary={chips.map((chip) => chip.label).join(' · ') || null}
        >
          {chips.length ? (
            <View style={styles.chips}>
              {chips.map((chip) => {
                const tone = CHIP_TONES[chip.tone][isDark ? 'dark' : 'light'];
                return (
                  <View key={chip.key} style={[styles.chip, { backgroundColor: tone.bg }]}>
                    <MobileIcon name={chip.icon} size={14} color={tone.fg} />
                    <Text style={[styles.chipText, { color: tone.fg }]}>{chip.label}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
          <InfoRow label={info.occupants} value={occupants} />
          <InfoRow label={info.occupation} value={occupation} />
          <InfoRow label={info.nationality} value={nationality} />
          <InfoRow label={info.visa} value={visa} />
          <MissingLine fields={screeningMissing} />
        </SectionCard>

        <SectionCard accent="notes" icon="note" title={c.sectionNotes} tint={lead.notes ? NOTE_TINT : undefined}>
          <Text
            selectable={!!lead.notes}
            style={[styles.value, styles.notes, { color: lead.notes ? theme.textHeading : tokens.colors.placeholder }]}
          >
            {lead.notes || c.noNotes}
          </Text>
        </SectionCard>

        <View style={styles.footer}>
          <LeadStatusBadge status={leadDisplayStatus(lead)} />
          <Text style={[styles.label, styles.flex1, { color: theme.textSecondary }]}>
            {c.leadCodeLine.replace('{code}', formatLeadCode(lead)).replace('{date}', createdDate ?? '—')}
          </Text>
        </View>
        <LeadNextViewingLine lead={lead} />
        {lead.status === 'lost' && lead.lostReason ? (
          <Text style={[styles.label, styles.footerNote, { color: theme.textSecondary }]}>
            {`${info.lostReason}: ${lead.lostReason}`}
          </Text>
        ) : null}
      </ScrollView>

      <MobileBottomSheet visible={mapPin != null} onClose={() => setMapPin(null)} maxHeight="85%">
        {mapPin ? (
          <>
            <SheetHeader title={c.pinMapTitle.replace('{rank}', String(mapPin.rank))} onClose={() => setMapPin(null)} />
            <View style={styles.mapBody}>
              <Text style={[styles.value, { color: theme.textHeading }]}>{mapPin.name}</Text>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                {[
                  mapPin.district,
                  mapPin.province,
                  lead.radiusKm != null ? c.mapWithin.replace('{km}', String(lead.radiusKm)) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <NearbyPlacesMap
                key={mapPin.rank}
                showRecenter={false}
                latitude={mapPin.latitude}
                longitude={mapPin.longitude}
                radiusKm={lead.radiusKm ?? undefined}
                markerTitle={mapPin.name}
                places={[]}
                selectedIds={[]}
                readOnly
                apiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}
              />
            </View>
          </>
        ) : null}
      </MobileBottomSheet>
    </View>
  );
}

function SectionCard({
  accent,
  icon,
  title,
  hint,
  collapsible = false,
  summary,
  tint,
  children,
}: {
  accent: Accent;
  icon: AppIconName;
  title: string;
  hint?: string;
  /** Collapsible sections start open; the summary shows under the title while collapsed. */
  collapsible?: boolean;
  summary?: string | null;
  tint?: string;
  children: React.ReactNode;
}) {
  const { theme, isDark } = useMobileTheme();
  const [open, setOpen] = useState(true);
  const tone = ACCENTS[accent][isDark ? 'dark' : 'light'];
  const head = (
    <>
      <View style={[styles.iconTile, { backgroundColor: tone.bg }]}>
        <MobileIcon name={icon} size={18} color={tone.fg} />
      </View>
      <View style={styles.flex1}>
        <Text style={[styles.sectionTitle, { color: theme.textHeading }]}>{title}</Text>
        {collapsible && !open && summary ? (
          <Text style={[styles.label, { color: theme.textSecondary }]} numberOfLines={1}>
            {summary}
          </Text>
        ) : hint ? (
          <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text>
        ) : null}
      </View>
      {collapsible ? (
        <View style={open ? styles.flip : undefined}>
          <MobileIcon name="chevron-down" size={16} color={theme.textSecondary} />
        </View>
      ) : null}
    </>
  );
  return (
    <View
      style={[styles.section, leadCardShadow, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={[styles.sectionInner, tint ? { backgroundColor: tint } : null]}>
        {collapsible ? (
          <Pressable
            onPress={() => setOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            style={({ pressed }) => [styles.sectionHead, pressed && Platform.OS === 'ios' ? { opacity: 0.75 } : null]}
            android_ripple={{ color: 'rgba(33,30,30,0.08)' }}
          >
            {head}
          </Pressable>
        ) : (
          <View style={styles.sectionHead} accessibilityRole="header">
            {head}
          </View>
        )}
        {!collapsible || open ? (
          <Animated.View entering={FadeIn.duration(150)} style={[styles.rows, { borderTopColor: theme.border }]}>
            {children}
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

function InfoRow({
  label,
  value,
  node,
  strong,
}: {
  label: string;
  value?: string | null;
  node?: React.ReactNode;
  strong?: boolean;
}) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, styles.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
      <View style={styles.rowValue}>
        {node ?? (
          <Text
            selectable
            style={[
              styles.value,
              styles.flex1,
              strong && value ? styles.bold : null,
              { color: value ? theme.textHeading : tokens.colors.placeholder },
            ]}
          >
            {value ?? t.agent.leads.unknown}
          </Text>
        )}
      </View>
    </View>
  );
}

/** Tap opens the chat app (or copies when the channel has no link); long-press always copies. */
function ContactRow({ kind, label, value }: { kind: ContactKind; label: string; value: string }) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const tone = CONTACT_TONES[kind] ?? CONTACT_TONES.other;
  const url = leadContactUrl(kind, value);
  const copy = async () => {
    await Clipboard.setStringAsync(value);
    Alert.alert(t.agent.leads.contactCopied, value);
  };
  const open = () => {
    if (!url) return void copy();
    Linking.openURL(url).catch(() => void copy());
  };
  return (
    <Pressable
      onPress={open}
      onLongPress={() => void copy()}
      accessibilityRole={url ? 'link' : 'button'}
      accessibilityLabel={`${label}: ${value}`}
      android_ripple={{ color: 'rgba(33,30,30,0.08)' }}
      style={({ pressed }) => [styles.contactRow, pressed && Platform.OS === 'ios' ? { opacity: 0.7 } : null]}
    >
      <View style={[styles.contactIcon, { backgroundColor: tone.bg }]}>
        <MobileIcon name={tone.icon} size={16} color={tone.fg} />
      </View>
      <Text style={[styles.label, styles.contactLabel, { color: theme.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.value, styles.flex1, { color: theme.textHeading }]} numberOfLines={1}>
        {value}
      </Text>
      <MobileIcon name={url ? 'chevron-right' : 'clipboard'} size={16} color={theme.textSecondary} />
    </Pressable>
  );
}

/** Lists blanks the agent should ask about on the next call. */
function MissingLine({ fields }: { fields: string[] }) {
  const { t } = useLocale();
  const { isDark } = useMobileTheme();
  if (!fields.length) return null;
  const tone = CHIP_TONES.warn[isDark ? 'dark' : 'light'];
  return (
    <View style={[styles.missing, { backgroundColor: tone.bg }]}>
      <MobileIcon name="warning" size={14} color={tone.fg} />
      <Text style={[styles.label, styles.flex1, { color: tone.fg }]}>
        {t.agent.leads.missingFields.replace('{fields}', fields.join(', '))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex1: { flex: 1 },
  bold: { fontFamily: tokens.typography.native.bodyBold },
  flip: { transform: [{ rotate: '180deg' }] },
  scroll: { padding: 16, gap: 12, paddingBottom: 32 },
  section: { borderWidth: 1, borderRadius: 16, overflow: Platform.OS === 'android' ? 'hidden' : 'visible' },
  sectionInner: { borderRadius: 15, overflow: 'hidden' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, minHeight: 56 },
  iconTile: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontFamily: tokens.typography.native.headingTh, fontSize: 16, lineHeight: 24 },
  hint: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
  rows: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 8, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 36, paddingVertical: 6 },
  rowLabel: { flex: 2 },
  rowValue: { flex: 3, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20 },
  value: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 21 },
  leadBody: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  leadName: { fontFamily: tokens.typography.native.headingTh, fontSize: 18, lineHeight: 27 },
  callBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  contacts: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4, paddingTop: 4 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingVertical: 4 },
  contactIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { width: 76 },
  pins: { flex: 1, gap: 6 },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  rankBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontFamily: tokens.typography.native.bodyBold, fontSize: 12, lineHeight: 18, color: '#FFFFFF' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontFamily: tokens.typography.native.bodyBold, fontSize: 12, lineHeight: 18 },
  missing: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginVertical: 6 },
  notes: { paddingVertical: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  footerNote: { paddingHorizontal: 4 },
  mapBody: { paddingHorizontal: 20, paddingBottom: 12, gap: 6 },
});
