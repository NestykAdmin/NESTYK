import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { localizedError, useLocale } from '@nestyk/i18n';
import { MobileBottomSheet, MobileBrandLoader, MobileButton, MobileInput, MobileStatusPill, tokens, useMobileTheme } from '@nestyk/ui/native';
import { ApiError } from '../lib/api';
import type { AgentContactDetail } from '../lib/agent-listings-api';
import { createCoAgentContact, fetchContactRooms, fetchDirectoryContact, updateDirectoryContact, type AgentContactRoom, type AgentDirectoryKind } from '../lib/agent-contacts-api';

export type ContactDetailState = {
  title: string;
  editing: boolean;
  saving: boolean;
  confirming: boolean;
  canEdit: boolean;
  error: string;
};
export type ContactDetailActions = { back: () => boolean; edit: () => void; save: () => void };

const FIELD_LIMITS = { name: 255, phone: 50, email: 255, lineId: 100, facebook: 255, note: 500 };
type Confirmation = 'edit' | 'save' | 'create';
type ContactFields = Omit<AgentContactDetail, 'id'>;
const EMPTY: ContactFields = { name: '', phone: '', email: '', lineId: '', facebook: '', note: '' };

function fields(contact: AgentContactDetail): ContactFields {
  const { id: _id, ...values } = contact;
  return values;
}

/** Reads and edits the canonical contact, shared by every linked room. */
export function AgentContactDetailBody({
  kind = 'owner', contactId, onClose, onSaved, onStateChange, actionsRef, reloadToken, onReloadSettled,
}: {
  kind?: AgentDirectoryKind;
  contactId: number | null;
  onClose: () => void;
  onSaved: (contact: AgentContactDetail) => void;
  onStateChange: (state: ContactDetailState | null) => void;
  actionsRef: React.MutableRefObject<ContactDetailActions | null>;
  reloadToken: number;
  onReloadSettled: (token: number) => void;
}) {
  const { t, locale } = useLocale();
  const copy = t.agent.dashboard.contactDetails;
  const renter = kind === 'lead' || kind === 'tenant';
  const { theme } = useMobileTheme();
  const [contact, setContact] = useState<AgentContactDetail | null>(null);
  const [rooms, setRooms] = useState<AgentContactRoom[]>([]);
  const [roomsFailed, setRoomsFailed] = useState(false);
  const [values, setValues] = useState<ContactFields>(EMPTY);
  const [editing, setEditing] = useState(contactId === null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const pendingConfirmation = useRef<Confirmation | null>(null);
  const lastConfirmation = useRef<Confirmation>('save');
  const confirmationAction = confirmation ?? lastConfirmation.current;
  const busy = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; onStateChange(null); };
  }, [onStateChange]);

  useEffect(() => {
    if (contactId === null) { onReloadSettled(reloadToken); return; }
    let active = true;
    setContact(null);
    setError('');
    setRooms([]);
    setRoomsFailed(false);
    Promise.allSettled([
      fetchDirectoryContact(kind, contactId),
      kind === 'landlord' ? fetchContactRooms(contactId) : Promise.resolve([] as AgentContactRoom[]),
    ]).then(([profile, linkedRooms]) => {
      if (!active) return;
      if (profile.status === 'fulfilled') { setContact(profile.value); setValues(fields(profile.value)); }
      else setError(copy.loadError);
      if (linkedRooms.status === 'fulfilled') setRooms(linkedRooms.value);
      else setRoomsFailed(true);
    }).finally(() => { if (active) onReloadSettled(reloadToken); });
    return () => { active = false; };
  }, [kind, contactId, retry, copy.loadError, reloadToken, onReloadSettled]);

  const back = useCallback(() => {
    if (busy.current) return true;
    if (pendingConfirmation.current) {
      pendingConfirmation.current = null;
      setConfirmation(null);
      return true;
    }
    if (editing && contact) {
      setValues(fields(contact));
      setEditing(false);
      setError('');
    } else onClose();
    return true;
  }, [editing, contact, onClose]);

  const requestConfirmation = useCallback((action: Confirmation) => {
    if (busy.current || pendingConfirmation.current) return;
    Keyboard.dismiss();
    pendingConfirmation.current = action;
    lastConfirmation.current = action;
    setConfirmation(action);
  }, []);

  const dismissConfirmation = useCallback(() => {
    pendingConfirmation.current = null;
    setConfirmation(null);
  }, []);

  const edit = useCallback(() => {
    if (!contact || editing) return;
    requestConfirmation('edit');
  }, [contact, editing, requestConfirmation]);

  const requestSave = useCallback(() => {
    if ((!contact && contactId !== null) || !editing || busy.current || pendingConfirmation.current) return;
    if (!values.name.trim() || !values.phone.trim()) { setError(copy.required); return; }
    if (values.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      setError(copy.invalidEmail); return;
    }
    setError('');
    requestConfirmation(contact ? 'save' : 'create');
  }, [contact, contactId, editing, values, copy, requestConfirmation]);

  const save = useCallback(async () => {
    if (busy.current || !mounted.current) return;
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      const updated = contact ? await updateDirectoryContact(kind, contact.id, values)
        : await createCoAgentContact(values);
      if (!mounted.current) return;
      setContact(updated);
      setValues(fields(updated));
      setEditing(false);
      onSaved(updated);
    } catch (err) {
      if (mounted.current) setError(err instanceof ApiError && err.status === 409
        ? copy.duplicatePhone : localizedError(err, copy.saveError, locale));
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }, [kind, contact, values, copy, locale, onSaved]);

  const confirm = useCallback(() => {
    const action = pendingConfirmation.current;
    if (!action || busy.current || !mounted.current) return;
    dismissConfirmation();
    if (action === 'edit') {
      if (!contact) return;
      setValues(fields(contact));
      setError('');
      setEditing(true);
    } else {
      void save();
    }
  }, [contact, dismissConfirmation, save]);

  useEffect(() => {
    const actions = { back, edit, save: requestSave };
    actionsRef.current = actions;
    return () => { if (actionsRef.current === actions) actionsRef.current = null; };
  }, [actionsRef, back, edit, requestSave]);

  useEffect(() => {
    onStateChange({ title: contactId === null && !contact ? copy.createCoAgentTitle : editing ? copy.editTitle : contact?.name || copy.title,
      editing, saving, confirming: !!confirmation, canEdit: !!contact && !editing && !confirmation, error: editing ? error : '' });
  }, [contactId, contact, editing, saving, confirmation, error, copy, onStateChange]);

  if (!contact && contactId !== null) return error ? (
    <View style={styles.body}>
      <Text style={[styles.text, { color: theme.textSecondary }]} accessibilityRole="alert">{error}</Text>
      <MobileButton onPress={() => setRetry((n) => n + 1)}>{t.agent.listings.retry}</MobileButton>
    </View>
  ) : <MobileBrandLoader />;

  return (
    <Animated.View entering={FadeIn.duration(150)} style={styles.body}>
      <Text style={[styles.text, { color: theme.textSecondary }]}>{renter ? copy.renterSharedHint : copy.sharedHint}</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {(Object.keys(FIELD_LIMITS) as Array<keyof ContactFields>).map((key) => editing ? (
          <MobileInput
            key={key}
            label={copy[key]}
            accessibilityLabel={copy[key]}
            value={values[key] ?? ''}
            onChangeText={(value) => setValues((current) => ({ ...current, [key]: value }))}
            editable={!saving && !confirmation}
            maxLength={key === 'lineId' && renter ? 255 : FIELD_LIMITS[key]}
            required={key === 'name' || key === 'phone'}
            keyboardType={key === 'phone' ? 'phone-pad' : key === 'email' ? 'email-address' : 'default'}
            autoCapitalize={key === 'name' ? 'words' : 'none'}
            multiline={key === 'note'}
            style={{ color: theme.textHeading, backgroundColor: theme.surface, borderColor: theme.border }}
          />
        ) : (
          <View key={key} style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>{copy[key]}</Text>
            <Text selectable style={[styles.text, { color: theme.textHeading }]}>
              {contact?.[key] || copy.notSpecified}
            </Text>
          </View>
        ))}
      </View>
      {kind === 'landlord' && !editing && (
        <ContactRooms rooms={rooms} failed={roomsFailed} onRetry={() => setRetry((n) => n + 1)} />
      )}
      <MobileBottomSheet visible={!!confirmation} onClose={dismissConfirmation} showHandle={false}>
        <View style={styles.confirmation}>
          <Text accessibilityRole="header" style={[styles.confirmTitle, { color: theme.textHeading }]}>
            {confirmationAction === 'edit' ? copy.confirmEditTitle : confirmationAction === 'create' ? copy.confirmCreateTitle : copy.confirmSaveTitle}
          </Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            {(confirmationAction === 'edit' ? copy.confirmEditBody : confirmationAction === 'create' ? copy.confirmCreateBody : copy.confirmSaveBody)
              .replace('{name}', confirmationAction === 'edit' ? contact?.name || '' : values.name.trim())}
          </Text>
          <View style={styles.buttons}>
            <MobileButton variant="outline" onPress={dismissConfirmation} style={styles.button}>{copy.cancel}</MobileButton>
            <MobileButton onPress={confirm} style={styles.button}>{t.common.confirm}</MobileButton>
          </View>
        </View>
      </MobileBottomSheet>
    </Animated.View>
  );
}

function ContactRooms({ rooms, failed, onRetry }: { rooms: AgentContactRoom[]; failed: boolean; onRetry: () => void }) {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.agent.dashboard.contactDetails;
  const listings = t.agent.listings;
  const statuses: Record<string, string> = {
    available: listings.available, rented: listings.rented,
    pending_verification: listings.pending_verification, needs_edit: listings.needs_edit,
  };
  return (
    <View style={styles.body}>
      <Text accessibilityRole="header" style={[styles.confirmTitle, { color: theme.textHeading }]}>{listings.roomInformation}</Text>
      {failed ? (
        <View style={styles.body}>
          <Text accessibilityRole="alert" style={[styles.text, { color: theme.textSecondary }]}>{copy.roomsLoadError}</Text>
          <MobileButton onPress={onRetry}>{listings.retry}</MobileButton>
        </View>
      ) : (
        <>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            {rooms.length ? copy.roomsCount.replace('{count}', String(rooms.length)) : copy.roomsEmpty}
          </Text>
          {rooms.map(room => {
            const specs = [
              room.floor ? listings.specFloor.replace('{floor}', room.floor) : '',
              room.roomSizeSqm ? listings.specSqm.replace('{size}', room.roomSizeSqm) : '',
              room.bedroomCount === '0' || room.roomTypeCode === 'studio' ? t.masters.roomTypes.studio
                : room.bedroomCount ? listings.specBed.replace('{count}', room.bedroomCount) : '',
            ].filter(Boolean).join(' · ');
            return (
              <View key={room.id} style={[styles.roomCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.roomTitle, { color: theme.textHeading }]}>{room.propertyName || room.listingTitle || copy.notSpecified}</Text>
                <Text style={[styles.text, { color: theme.textHeading }]}>{copy.roomNumber.replace('{number}', room.roomId || copy.notSpecified)}</Text>
                {!!room.listingTitle && room.listingTitle !== room.propertyName && (
                  <Text style={[styles.text, { color: theme.textSecondary }]}>{room.listingTitle}</Text>
                )}
                {!![room.district, room.province].filter(Boolean).length && (
                  <Text style={[styles.text, { color: theme.textSecondary }]}>{[room.district, room.province].filter(Boolean).join(' · ')}</Text>
                )}
                {!!specs && <Text style={[styles.text, { color: theme.textSecondary }]}>{specs}</Text>}
                <MobileStatusPill label={statuses[room.roomStatusCode || ''] || listings.notSpecified}
                  tone={room.roomStatusCode === 'available' ? 'green' : room.roomStatusCode === 'rented' ? 'blue' : 'slate'} />
                <Text style={[styles.roomTitle, { color: theme.textHeading }]}>
                  {room.minRent != null ? listings.rentPerMonthShort.replace('{price}', room.minRent.toLocaleString(locale)) : copy.rentNotSpecified}
                </Text>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

export function AgentContactEditBar({ state, actionsRef }: {
  state: ContactDetailState;
  actionsRef: React.MutableRefObject<ContactDetailActions | null>;
}) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.agent.dashboard.contactDetails;
  return (
    <View style={[styles.bar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {!!state.error && <Text accessibilityRole="alert" style={[styles.text, { color: tokens.colors.error }]}>{state.error}</Text>}
      <View style={styles.buttons}>
        <MobileButton variant="outline" disabled={state.saving || state.confirming} onPress={() => actionsRef.current?.back()} style={styles.button}>
          {copy.cancel}
        </MobileButton>
        <MobileButton disabled={state.confirming} isLoading={state.saving} onPress={() => actionsRef.current?.save()} style={styles.button}>
          {copy.save}
        </MobileButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16 },
  confirmation: { padding: 20, gap: 16 },
  confirmTitle: { fontFamily: tokens.typography.native.bodyBold, fontSize: 18, lineHeight: 27 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 18 },
  roomCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  roomTitle: { fontFamily: tokens.typography.native.bodyBold, fontSize: 15, lineHeight: 23 },
  field: { gap: 4 },
  label: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
  text: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 21 },
  bar: { padding: 16, gap: 12, borderTopWidth: 1 },
  buttons: { flexDirection: 'row', gap: 12 },
  button: { flex: 1 },
});
