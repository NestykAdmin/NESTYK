import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { AgentTenant, TenantLeadOption, TenantRoomOption } from '@nestyk/types';
import { localizedError, useLocale } from '@nestyk/i18n';
import { MobileBottomSheet, MobileButton, MobileIcon, MobileInput, tokens, useMobileTheme } from '@nestyk/ui/native';
import { createAgentTenant, tenantRoomOptions } from '../lib/agent-tenants-api';
import {
  TENANT_PROFILE_MAX,
  tenantProfileBody,
  tenantProfileFromLead,
  tenantProfileIssues,
  type TenantProfileField,
  type TenantProfileForm,
  type TenantProfileIssue,
} from '../lib/tenant-profile';
import { nextIdentityNumberDraft } from '../lib/identity-number';
import { SheetHeader } from './AgentLeadDetailBody';

/** Where the agent goes from the "booked" state: on to the reservation letter, or to the tenant page first. */
export type ReserveNext = 'reservation' | 'tenant';

const PROFILE_ANIM_MS = 220;

const EMPTY_FORM: TenantProfileForm = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  identityNumber: '',
  nationality: '',
  note: '',
};

function SummaryRow({ label, value, detail, divider }: { label: string; value: string; detail?: string; divider?: boolean }) {
  const { theme } = useMobileTheme();
  return (
    <View
      style={[
        styles.summaryRow,
        divider ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border } : null,
      ]}
    >
      <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{label}</Text>
      <View style={styles.flex1}>
        <Text style={[styles.value, { color: theme.textHeading }]} numberOfLines={2}>
          {value}
        </Text>
        {detail ? (
          <Text style={[styles.muted, { color: theme.textSecondary }]} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Notice({ tone, text }: { tone: 'warning' | 'danger'; text: string }) {
  const bg = tone === 'danger' ? tokens.colors.subtle.dangerBg : tokens.colors.subtle.warningBg;
  const fg = tone === 'danger' ? tokens.colors.subtle.dangerFg : tokens.colors.subtle.warningFg;
  return (
    <View style={[styles.notice, { backgroundColor: bg }]} accessibilityRole="alert">
      <MobileIcon name="warning" size={16} color={fg} />
      <Text style={[styles.noticeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

/**
 * Books a room for a lead with one confirmation instead of a form. The lead's contact details become
 * the tenant's; only what the reservation letter needs later (email, ID number) is asked up front, and
 * the rest sits behind "edit". Saving creates the tenant and moves the lead to `booked`.
 */
export function ReserveRoomSheet({
  visible,
  lead,
  room,
  onClose,
  onReserved,
  onContinue,
  onBusy,
  showBookedState = true,
}: {
  visible: boolean;
  /** Who is booking. */
  lead: TenantLeadOption | null;
  /** The room being booked; its number and booking state are read again when the sheet opens. */
  room: TenantRoomOption | null;
  onClose: () => void;
  /** The tenant was created and the lead is now booked. */
  onReserved: (tenant: AgentTenant) => void;
  /** Chosen on the "booked" state. */
  onContinue?: (tenant: AgentTenant, next: ReserveNext) => void;
  onBusy?: (busy: boolean) => void;
  /** False when the caller closes the sheet on success and shows the result itself. */
  showBookedState?: boolean;
}) {
  const { t, locale } = useLocale();
  const c = t.agent.tenants;
  const { theme, isDark } = useMobileTheme();
  const [form, setForm] = useState<TenantProfileForm>(() => (lead ? tenantProfileFromLead(lead) : EMPTY_FORM));
  const [roomInfo, setRoomInfo] = useState<TenantRoomOption | null>(room);
  /** True once the room's number and booking state are known, not just its title. */
  const [roomKnown, setRoomKnown] = useState(() => room?.bookedBy !== undefined);
  const [issues, setIssues] = useState<Partial<Record<TenantProfileField, TenantProfileIssue>>>({});
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Guards the request itself: two taps can land before `busy` re-renders the button. */
  const saving = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<AgentTenant | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const profileY = useRef(0);
  const chevron = useSharedValue(0);
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${chevron.value * 180}deg` }] }));

  useEffect(() => {
    chevron.value = withTiming(editing ? 1 : 0, { duration: PROFILE_ANIM_MS });
    if (!editing) return;
    // Wait for the fields to lay out, then bring the opened card into view.
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, profileY.current - 8), animated: true });
    }, PROFILE_ANIM_MS + 20);
    return () => clearTimeout(id);
  }, [editing, chevron]);

  const leadId = lead?.id ?? null;
  const roomId = room?.id ?? null;

  // Opening the sheet starts a fresh booking of this room for this lead.
  useEffect(() => {
    if (!visible || !lead || !room) return;
    setForm(tenantProfileFromLead(lead));
    setRoomInfo(room);
    setRoomKnown(room.bookedBy !== undefined);
    setIssues({});
    setEditing(false);
    setError(null);
    setBooked(null);
    let active = true;
    tenantRoomOptions('', { leadId: lead.id, roomId: room.id })
      .then((rows) => {
        const found = rows.find((row) => row.id === room.id);
        if (!active || !found) return;
        setRoomInfo(found);
        setRoomKnown(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // Keyed on the ids: a refreshed lead object must not restart a booking in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, leadId, roomId]);

  useEffect(() => {
    onBusy?.(busy);
  }, [busy, onBusy]);

  const issueText: Record<TenantProfileIssue, string> = {
    required: c.errorRequired,
    phone: c.errorPhone,
    email: c.errorEmail,
    identity: c.errorIdentity,
  };
  const fieldError = (key: TenantProfileField) => {
    const issue = issues[key];
    return issue ? issueText[issue] : undefined;
  };
  const setField = (key: TenantProfileField, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setIssues((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setError(null);
  };

  const roomNumber = roomInfo?.room ? t.agent.leads.viewing.roomNumber.replace('{number}', roomInfo.room) : null;
  const roomLine = [roomInfo?.property, roomNumber].filter(Boolean).join(' · ');
  const customerName = [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(' ') || lead?.name || '';
  const takenBy = roomInfo?.bookedBy ?? null;
  const profileIssue = Boolean(issues.firstName || issues.phone);

  const close = () => {
    if (!busy) onClose();
  };

  const confirm = async () => {
    if (saving.current || !lead || !room || takenBy) return;
    const found = tenantProfileIssues(form);
    setIssues(found);
    if (Object.keys(found).length) {
      // Name and phone sit behind "edit": open it so the message is visible.
      if (found.firstName || found.phone) {
        if (editing) scrollRef.current?.scrollTo({ y: Math.max(0, profileY.current - 8), animated: true });
        else setEditing(true);
      }
      return;
    }
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      const tenant = await createAgentTenant({ leadId: lead.id, rentRoomId: room.id, ...tenantProfileBody(form) });
      if (showBookedState) setBooked(tenant);
      onReserved(tenant);
    } catch (err) {
      setError(localizedError(err, t.common.errorGeneric, locale));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  return (
    <MobileBottomSheet visible={visible && !!lead && !!room} onClose={close} maxHeight="90%" avoidKeyboard>
      {booked ? (
        <>
          <SheetHeader title={c.reservedTitle} onClose={close} />
          <View style={styles.body}>
            <View style={styles.bookedRow}>
              <View style={[styles.bookedIcon, { backgroundColor: tokens.colors.subtle.successBg }]}>
                <MobileIcon name="check" size={22} color={tokens.colors.subtle.successFg} />
              </View>
              <View style={styles.flex1}>
                <Text style={[styles.value, { color: theme.textHeading }]} numberOfLines={2}>
                  {booked.name}
                </Text>
                {roomLine ? (
                  <Text style={[styles.muted, { color: theme.textSecondary }]} numberOfLines={2}>
                    {roomLine}
                  </Text>
                ) : null}
              </View>
            </View>
            {booked.email ? (
              <Text style={[styles.muted, { color: theme.textSecondary }]}>{c.reservedNext}</Text>
            ) : (
              <Notice tone="warning" text={c.reservedNeedsEmail} />
            )}
            <MobileButton onPress={() => onContinue?.(booked, booked.email ? 'reservation' : 'tenant')}>
              {booked.email ? c.continueToLetter : c.openTenant}
            </MobileButton>
            <MobileButton variant="outline" onPress={close}>
              {c.later}
            </MobileButton>
          </View>
        </>
      ) : (
        <>
          <SheetHeader title={c.reserveTitle} onClose={close} />
          <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <SummaryRow label={c.reserveCustomer} value={customerName} detail={form.phone.trim()} />
              <SummaryRow
                label={c.reserveRoom}
                value={roomInfo?.property ?? ''}
                detail={roomNumber ?? (roomKnown ? c.roomNoNumber : undefined)}
                divider
              />
            </View>
            {takenBy ? <Notice tone="danger" text={c.reserveTaken.replace('{name}', takenBy)} /> : null}

            <MobileInput
              label={c.reserveEmail}
              value={form.email}
              onChangeText={(value) => setField('email', value)}
              placeholder="name@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              maxLength={TENANT_PROFILE_MAX.email}
              editable={!busy}
              error={fieldError('email')}
              helperText={form.email.trim() ? c.reserveEmailHint : c.reserveEmailMissing}
            />
            <MobileInput
              label={c.reserveIdentity}
              value={form.identityNumber}
              onChangeText={(value) => setField('identityNumber', nextIdentityNumberDraft(value))}
              placeholder={c.reserveIdentityPlaceholder}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={TENANT_PROFILE_MAX.identityNumber}
              editable={!busy}
              error={fieldError('identityNumber')}
            />

            <Animated.View
              layout={LinearTransition.duration(PROFILE_ANIM_MS)}
              onLayout={(event) => {
                profileY.current = event.nativeEvent.layout.y;
              }}
              style={[
                styles.group,
                { backgroundColor: theme.surface, borderColor: profileIssue ? tokens.colors.danger : theme.border },
              ]}
            >
              <Pressable
                onPress={() => setEditing((open) => !open)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityState={{ expanded: editing, disabled: busy }}
                accessibilityLabel={`${c.reserveProfileTitle}, ${profileIssue ? c.reserveProfileIssue : c.reserveProfileHint}`}
                android_ripple={{ color: 'rgba(33,30,30,0.08)' }}
                style={({ pressed }) => [styles.profileHeader, pressed && Platform.OS === 'ios' ? styles.pressed : null]}
              >
                <View style={[styles.profileIcon, { backgroundColor: isDark ? 'rgba(148,163,184,0.16)' : '#F1F5F9' }]}>
                  <MobileIcon name="pencil" size={18} color={theme.textHeading} />
                </View>
                <View style={styles.flex1}>
                  <Text style={[styles.value, { color: theme.textHeading }]} numberOfLines={1}>
                    {c.reserveProfileTitle}
                  </Text>
                  <Text
                    style={[styles.muted, { color: profileIssue ? tokens.colors.danger : theme.textSecondary }]}
                    numberOfLines={1}
                  >
                    {profileIssue ? c.reserveProfileIssue : c.reserveProfileHint}
                  </Text>
                </View>
                <Animated.View style={chevronStyle}>
                  <MobileIcon name="chevron-down" size={18} color={theme.textSecondary} />
                </Animated.View>
              </Pressable>
              {editing ? (
                <Animated.View
                  entering={FadeIn.duration(PROFILE_ANIM_MS)}
                  exiting={FadeOut.duration(120)}
                  style={[styles.profileBody, { borderTopColor: theme.border }]}
                >
                  <MobileInput
                    label={c.fieldFirstName}
                    required
                    value={form.firstName}
                    onChangeText={(value) => setField('firstName', value)}
                    maxLength={TENANT_PROFILE_MAX.firstName}
                    editable={!busy}
                    error={fieldError('firstName')}
                  />
                  <MobileInput
                    label={c.fieldLastName}
                    value={form.lastName}
                    onChangeText={(value) => setField('lastName', value)}
                    maxLength={TENANT_PROFILE_MAX.lastName}
                    editable={!busy}
                  />
                  <MobileInput
                    label={c.fieldPhone}
                    required
                    value={form.phone}
                    onChangeText={(value) => setField('phone', value)}
                    keyboardType="phone-pad"
                    maxLength={TENANT_PROFILE_MAX.phone}
                    editable={!busy}
                    error={fieldError('phone')}
                  />
                  <MobileInput
                    label={c.fieldNationality}
                    value={form.nationality}
                    onChangeText={(value) => setField('nationality', value)}
                    maxLength={TENANT_PROFILE_MAX.nationality}
                    editable={!busy}
                  />
                  <MobileInput
                    label={c.fieldNote}
                    value={form.note}
                    onChangeText={(value) => setField('note', value)}
                    maxLength={TENANT_PROFILE_MAX.note}
                    editable={!busy}
                  />
                </Animated.View>
              ) : null}
            </Animated.View>

            <Animated.View layout={LinearTransition.duration(PROFILE_ANIM_MS)} style={styles.footer}>
              <Text style={[styles.muted, { color: theme.textSecondary }]}>{c.reserveInfo}</Text>
              {error ? (
                <Text accessibilityRole="alert" style={[styles.error, { color: tokens.colors.danger }]}>
                  {error}
                </Text>
              ) : null}
              <MobileButton onPress={() => void confirm()} isLoading={busy} disabled={!!takenBy}>
                {c.reserveConfirm}
              </MobileButton>
            </Animated.View>
          </ScrollView>
        </>
      )}
    </MobileBottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  body: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, gap: 12 },
  flex1: { flex: 1 },
  group: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  summaryLabel: { width: 64, fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 22 },
  value: { fontFamily: tokens.typography.native.bodyBold, fontSize: 15, lineHeight: 22 },
  muted: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 19 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  noticeText: { flex: 1, fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 19 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 12 },
  pressed: { opacity: 0.75 },
  profileIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  profileBody: {
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footer: { gap: 12 },
  error: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 19 },
  bookedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bookedIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
