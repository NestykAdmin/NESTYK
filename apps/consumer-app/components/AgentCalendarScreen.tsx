import type { UpdateAgentCalendarEvent } from '@nestyk/types';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, StyleSheet } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import { useLocale } from '@nestyk/i18n';
import { MobileButton, MobileIcon, tokens, useMobileTheme } from '@nestyk/ui/native';
import {
  calendarDateKey, calendarLocalDate, calendarMonthSelection, calendarEventInput, nearbyCalendarEvent, CALENDAR_TIMEZONE,
  type CalendarEvent, type CalendarEventInput, type CalendarSource,
} from '../lib/agent-calendar';

export interface CalendarDraft {
  title: string;
  location: string;
  time: string;
}
export const emptyCalendarDraft: CalendarDraft = { title: '', location: '', time: '10:00' };

interface Props {
  events: CalendarEvent[];
  onAdd: (event: CalendarEventInput) => Promise<void>;
  loading: boolean;
  failedSources: CalendarSource[];
  onRetry: (source: CalendarSource) => void;
  onUpdate: (id: string, patch: UpdateAgentCalendarEvent) => Promise<void>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  visibleMonth: string;
  onMonthChange: (date: string) => void;
  draft: CalendarDraft;
  onDraftChange: (draft: CalendarDraft) => void;
}

/** Calendar body only: the existing Agent shell owns navigation and page chrome. */
export function AgentCalendarScreen({ events, onAdd, selectedDate, onSelectDate, visibleMonth, onMonthChange, draft, onDraftChange, loading, failedSources, onRetry, onUpdate }: Props) {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.agent.calendar;
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<'titleRequired' | 'timeInvalid' | 'saveFailed' | null>(null);
  const [notice, setNotice] = useState<'saved' | 'cancelled' | null>(null);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [confirmation, setConfirmation] = useState<{ kind: 'edit' | 'cancel'; event: CalendarEvent } | null>(null);
  const [confirmingCreate, setConfirmingCreate] = useState(false);
  const [actionError, setActionError] = useState(false);
  const localeTag = { th: 'th-TH', en: 'en-GB', zh: 'zh-CN', ja: 'ja-JP' }[locale];
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const daily = events.filter(event => event.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time));
  const markedDates = useMemo(() => {
    const marks: Record<string, { marked?: boolean; selected?: boolean }> = {};
    events.forEach(event => { marks[event.date] = { marked: true }; });
    marks[selectedDate] = { ...marks[selectedDate], selected: true };
    return marks;
  }, [events, selectedDate]);
  const heading = { color: theme.screenTitle };
  const secondary = { color: theme.textSecondary };
  const surface = { backgroundColor: theme.card, borderColor: theme.border };
  const monthLabel = new Intl.DateTimeFormat(localeTag, { timeZone: CALENDAR_TIMEZONE, month: 'long', year: 'numeric' }).format(calendarLocalDate(visibleMonth));
  const selectedLabel = new Intl.DateTimeFormat(localeTag, { timeZone: CALENDAR_TIMEZONE, weekday: 'long', day: 'numeric', month: 'long' }).format(calendarLocalDate(selectedDate));
  const weekdays = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(localeTag, { weekday: 'short' }).format(new Date(2026, 8, 28 + index, 12)));

  const shiftMonth = (offset: number) => {
    const next = calendarMonthSelection(selectedDate, visibleMonth, offset);
    onSelectDate(next.date); onMonthChange(next.month); setNotice(null); setConfirmation(null);
  };
  const creating = adding && !editing;
  const editingForm = editing !== null && confirmation === null;
  const near = adding ? nearbyCalendarEvent(events, selectedDate, draft.time, editing?.id) : undefined;
  const overlapText = (event: CalendarEvent, date: string) => copy.overlapWarning.replace('{time}', event.date === date ? event.time : `${event.date} ${event.time}`).replace('{title}', event.title);
  const edit = (event: CalendarEvent) => {
    setEditing(event); setAdding(true); setNotice(null); setError(null); setActionError(false); setConfirmation(null);
    onSelectDate(event.date); onMonthChange(event.date.slice(0, 7) + '-01');
    onDraftChange({ title: event.title, location: event.location, time: event.time });
  };
  const requestConfirmation = (kind: 'edit' | 'cancel', event: CalendarEvent) => {
    if (pending.current || loading || confirmation) return;
    setActionError(false); setNotice(null); setConfirmation({ kind, event });
  };
  const dismissConfirmation = () => {
    if (pending.current) return;
    if (confirmingCreate) { setConfirmingCreate(false); setError(null); return; }
    if (creating) { setAdding(false); setError(null); }
    if (editing) { setAdding(false); setEditing(null); setError(null); }
    setConfirmation(null); setActionError(false);
  };
  const openCreate = () => {
    if (pending.current || loading || saving || confirmation || confirmingCreate || editing) return;
    setEditing(null); setError(null); setActionError(false); setNotice(null); setConfirmingCreate(false); setAdding(true);
  };
  const requestCreate = () => {
    if (pending.current || loading || saving || confirmingCreate) return;
    if (!draft.title.trim()) { setError('titleRequired'); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time.trim())) { setError('timeInvalid'); return; }
    setError(null); setActionError(false); setNotice(null); setConfirmingCreate(true);
  };
  const cancelAppointment = async (event: CalendarEvent) => {
    if (pending.current || loading) return;
    pending.current = true; setSaving(true); setActionError(false); setNotice(null);
    try {
      await onUpdate(event.id, { status: 'cancelled' });
      if (mounted.current) { setConfirmation(null); setNotice('cancelled'); }
    } catch { if (mounted.current) setActionError(true); }
    finally { pending.current = false; if (mounted.current) setSaving(false); }
  };
  const save = async () => {
    if (pending.current || loading || confirmation) return;
    if (!draft.title.trim()) { setError('titleRequired'); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time.trim())) { setError('timeInvalid'); return; }
    const input = { date: selectedDate, time: draft.time.trim(), title: draft.title.trim(), location: draft.location.trim() };
    pending.current = true; setSaving(true); setError(null); setActionError(false); setNotice(null);
    try {
      if (editing) await onUpdate(editing.id, calendarEventInput(input));
      else await onAdd(input);
      if (!mounted.current) return;
      onDraftChange({ ...emptyCalendarDraft });
      setAdding(false); setEditing(null); setConfirmingCreate(false); setNotice('saved');
    } catch {
      if (mounted.current) setError('saveFailed');
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  return (
    <View style={styles.body}>
      <View style={[styles.calendar, surface]}>
        <Calendar
          key={`${visibleMonth}-${locale}-${theme.mode}`}
          current={visibleMonth}
          firstDay={1}
          hideExtraDays
          markedDates={markedDates}
          dayComponent={({ date, state, marking, onPress, accessibilityLabel }: {
            date?: DateData;
            state?: string;
            marking?: { selected?: boolean; marked?: boolean };
            onPress?: (date: DateData) => void;
            accessibilityLabel?: string;
          }) => {
            if (!date) return null;
            const selected = !!marking?.selected;
            const today = date.dateString === calendarDateKey(new Date());
            const disabled = state === 'disabled';
            const eventCount = events.filter(event => event.date === date.dateString).length;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                accessibilityLabel={[
                  accessibilityLabel || date.dateString,
                  eventCount ? copy.eventCount.replace('{count}', String(eventCount)) : '',
                ].filter(Boolean).join(', ')}
                disabled={disabled || saving}
                onPress={() => onPress?.(date)}
                style={({ pressed }) => [styles.day, {
                  backgroundColor: selected ? tokens.colors.brand[500] : 'transparent',
                  borderColor: today && !selected ? theme.textSecondary : 'transparent',
                  opacity: pressed ? 0.65 : disabled ? 0.4 : 1,
                }]}
              >
                <Text style={[styles.dayNumber, {
                  color: selected ? tokens.colors.onBrand : theme.textHeading,
                  fontFamily: selected || today ? tokens.typography.native.bodyBold : tokens.typography.native.body,
                }]}>{date.day}</Text>
                {eventCount > 0 && (
                  <View pointerEvents="none" style={[styles.dayBadge, {
                    backgroundColor: selected ? tokens.colors.primary : tokens.colors.brand[100],
                    borderColor: theme.card,
                  }]}>
                    <Text style={[styles.dayBadgeText, {
                      color: selected ? tokens.colors.white : tokens.colors.onBrand,
                    }]}>{eventCount > 99 ? '99+' : eventCount}</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
          onDayPress={day => { onSelectDate(day.dateString); setNotice(null); setConfirmation(null); }}
          customHeader={() => (
            <View>
              <View style={styles.monthRow}>
                <Text style={[styles.heading, heading, { flex: 1 }]}>{monthLabel}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={copy.previousMonth} disabled={saving} onPress={() => shiftMonth(-1)} style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.5 : 1 }]}>
                  <MobileIcon name="chevron-left" size={20} color={theme.screenTitle} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={copy.nextMonth} disabled={saving} onPress={() => shiftMonth(1)} style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.5 : 1 }]}>
                  <MobileIcon name="chevron-right" size={20} color={theme.screenTitle} />
                </Pressable>
              </View>
              <View style={styles.weekdays}>{weekdays.map((day, index) => <Text key={index} style={[styles.caption, secondary, styles.weekday]}>{day}</Text>)}</View>
            </View>
          )}
          theme={{
            calendarBackground: theme.card,
            dayTextColor: theme.textHeading,
            todayTextColor: theme.screenTitle,
            textDisabledColor: theme.textSecondary,
            textDayFontFamily: tokens.typography.native.body,
            textDayFontSize: 14,
            selectedDayBackgroundColor: tokens.colors.brand[500],
            selectedDayTextColor: tokens.colors.onBrand,
          }}
        />
        <MobileButton disabled={saving} variant="ghost" onPress={() => { const today = calendarDateKey(new Date()); onSelectDate(today); onMonthChange(today.slice(0, 7) + '-01'); setNotice(null); }} textStyle={secondary}>{copy.today}</MobileButton>
      </View>
      <View style={styles.section}>
        <Text style={[styles.heading, heading, { flex: 1 }]}>{selectedLabel}</Text>
        <Text style={[styles.caption, secondary]}>{loading || failedSources.length > 0 ? '' : copy.eventCount.replace('{count}', String(daily.length))}</Text>
      </View>
      {failedSources.map(source => <View key={source} style={styles.form}>
        <Text accessibilityRole="alert" style={[styles.caption, secondary]}>{source === 'lead' ? copy.leadLoadFailed : copy.manualLoadFailed}</Text>
        <MobileButton disabled={loading || saving} variant="outline" onPress={() => onRetry(source)}>{t.contracts.common.retry}</MobileButton>
      </View>)}
      {loading && events.length === 0 ? <Text accessibilityLiveRegion="polite" style={[styles.caption, secondary]}>{t.common.loading}</Text>
        : daily.length === 0 && failedSources.length === 0 ? (
        <View style={[styles.empty, surface]}>
          <MobileIcon name="calendar" size={30} color={theme.textSecondary} />
          <Text style={[styles.heading, heading]}>{copy.emptyTitle}</Text>
          <Text style={[styles.caption, secondary, { textAlign: 'center' }]}>{copy.emptyHint}</Text>
        </View>
      ) : daily.map(event => {
        return (
          <View key={event.id} style={styles.event}>
            <Text style={[styles.time, heading]}>{event.time}</Text>
            <View style={[styles.eventCard, surface]}>
              <View style={styles.eventMain}>
                {event.source === 'lead' && <Text style={[styles.caption, secondary]}>{copy.viewing}</Text>}
                <Text style={[styles.eventTitle, heading]}>{event.title}</Text>
                {!!event.location && <Text style={[styles.caption, secondary]}>{event.location}</Text>}
              </View>
              {event.source === 'manual' && !adding && <View style={styles.actions}>
                <Pressable accessibilityRole="button" accessibilityLabel={copy.edit} disabled={saving || loading}
                  android_ripple={{ color: tokens.colors.brand[100] }}
                  onPress={() => requestConfirmation('edit', event)}
                  style={({ pressed }) => [styles.eventAction, { opacity: saving || loading ? 0.45 : pressed ? 0.7 : 1 }]}>
                  <MobileIcon name="note" size={20} color={tokens.colors.icon.dark} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={copy.cancelAppointment} disabled={saving || loading}
                  android_ripple={{ color: tokens.colors.brand[100] }}
                  onPress={() => requestConfirmation('cancel', event)}
                  style={({ pressed }) => [styles.eventAction, { opacity: saving || loading ? 0.45 : pressed ? 0.7 : 1 }]}>
                  <MobileIcon name="trash" size={20} color={tokens.colors.icon.dark} />
                </Pressable>
              </View>}
            </View>
          </View>
        );
      })}
      <Modal visible={confirmation !== null || creating || editingForm} transparent animationType="fade" statusBarTranslucent onRequestClose={dismissConfirmation}>
        {(confirmation || creating || editingForm) && <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={dismissConfirmation} disabled={saving} accessibilityRole="button" accessibilityLabel={copy.dismissConfirmation} />
          <View accessibilityViewIsModal onAccessibilityEscape={dismissConfirmation} style={[styles.modalCard, surface]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: confirmation?.kind === 'cancel' ? tokens.colors.subtle.dangerBg : tokens.colors.subtle.brandBg }]}>
                <MobileIcon name={creating || editingForm ? 'calendar' : confirmation?.kind === 'cancel' ? 'trash' : 'pencil'} size={24} color={confirmation?.kind === 'cancel' ? tokens.colors.danger : tokens.colors.onBrand} />
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={copy.dismissConfirmation} disabled={saving} onPress={dismissConfirmation} style={styles.closeButton}>
                <MobileIcon name="close" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
            <Text accessibilityRole="header" style={[styles.modalTitle, heading]}>{creating ? (confirmingCreate ? copy.createDescription : copy.newEvent) : confirmation?.kind === 'cancel' ? copy.cancelAppointment : copy.edit}</Text>
            {confirmation && !editingForm && <Text style={[styles.caption, secondary]}>{confirmation.kind === 'cancel' ? copy.cancelDescription : copy.editDescription}</Text>}
            {creating && confirmingCreate ? <>
              <View style={[styles.modalAppointment, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Text style={[styles.eventTitle, heading]}>{draft.title.trim()}</Text>
                <Text style={[styles.caption, secondary]}>{selectedLabel} · {draft.time.trim()}</Text>
                {!!draft.location.trim() && <Text style={[styles.caption, secondary]}>{draft.location.trim()}</Text>}
              </View>
              {near && <Text style={[styles.caption, { color: tokens.colors.subtle.warningFg }]}>{overlapText(near, selectedDate)}</Text>}
              {failedSources.length > 0 && <Text style={[styles.caption, secondary]}>{copy.overlapIncomplete}</Text>}
              {error && <Text accessibilityRole="alert" style={[styles.caption, { color: tokens.colors.danger }]}>{copy[error]}</Text>}
            </> : (creating || editingForm) ? <>
              <Text style={[styles.caption, secondary]}>{selectedLabel}</Text>
              {(['title', 'location', 'time'] as const).map(field => <View key={field} style={styles.field}>
                <Text style={[styles.label, heading]}>{copy[field]}</Text>
                <TextInput
                  accessibilityLabel={copy[field]}
                  value={draft[field]}
                  onChangeText={value => { onDraftChange({ ...draft, [field]: value }); setError(null); }}
                  placeholder={field === 'time' ? '10:00' : copy[field === 'title' ? 'titlePlaceholder' : 'locationPlaceholder']}
                  placeholderTextColor={theme.textSecondary}
                  editable={!saving}
                  maxLength={field === 'time' ? 5 : 160}
                  autoCapitalize={field === 'time' ? 'none' : 'sentences'}
                  style={[styles.input, { color: theme.textHeading, backgroundColor: theme.background, borderColor: theme.border }]}
                />
              </View>)}
              {near && <Text accessibilityLiveRegion="polite" style={[styles.caption, { color: tokens.colors.subtle.warningFg }]}>{overlapText(near, selectedDate)}</Text>}
              {failedSources.length > 0 && <Text style={[styles.caption, secondary]}>{copy.overlapIncomplete}</Text>}
              {error && <Text accessibilityRole="alert" style={[styles.caption, { color: tokens.colors.danger }]}>{copy[error]}</Text>}
            </> : confirmation && <View style={[styles.modalAppointment, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Text style={[styles.eventTitle, heading]}>{confirmation.event.title}</Text>
              <Text style={[styles.caption, secondary]}>{new Intl.DateTimeFormat(localeTag, { timeZone: CALENDAR_TIMEZONE, day: 'numeric', month: 'long', year: 'numeric' }).format(calendarLocalDate(confirmation.event.date))} · {confirmation.event.time}</Text>
              {!!confirmation.event.location && <Text style={[styles.caption, secondary]}>{confirmation.event.location}</Text>}
            </View>}
            {actionError && <Text accessibilityRole="alert" style={[styles.caption, { color: tokens.colors.danger }]}>{copy.saveFailed}</Text>}
            <View style={styles.modalActions}>
              <MobileButton variant="outline" disabled={saving} onPress={dismissConfirmation} style={[styles.modalButton, { backgroundColor: theme.card, borderColor: theme.border }]} textStyle={secondary}>
                {confirmation?.kind === 'cancel' ? copy.keepAppointment : t.common.cancel}
              </MobileButton>
              <MobileButton disabled={saving || loading} isLoading={saving}
                onPress={() => editingForm ? void save() : creating ? (confirmingCreate ? void save() : requestCreate()) : confirmation?.kind === 'edit' ? edit(confirmation.event) : confirmation && void cancelAppointment(confirmation.event)}
                style={[styles.modalButton, confirmation?.kind === 'cancel' && { backgroundColor: tokens.colors.danger }]}
                textStyle={confirmation?.kind === 'cancel' ? { color: tokens.colors.white } : undefined}>
                {editingForm ? copy.save : creating ? copy.confirmCreate : confirmation?.kind === 'cancel' ? copy.confirmCancel : copy.confirmEdit}
              </MobileButton>
            </View>
          </View>
        </View>}
      </Modal>
      {notice && <Text accessibilityLiveRegion="polite" style={[styles.caption, secondary]}>{notice === 'cancelled' ? copy.cancelSuccess : copy.saved}</Text>}
      <MobileButton disabled={loading || saving || creating || editingForm} onPress={openCreate}>{`＋ ${copy.add}`}</MobileButton>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventAction: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: tokens.colors.brand[500], backgroundColor: tokens.colors.white, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(15,23,42,0.55)' },
  modalCard: { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: 22, padding: 24, gap: 14 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  closeButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontFamily: tokens.typography.native.headingTh, fontSize: 20, lineHeight: 30 },
  modalAppointment: { padding: 14, borderWidth: 1, borderRadius: 12, gap: 5 },
  modalActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 6 },
  modalButton: { flexBasis: 145, flexGrow: 1 },
  body: { gap: 14, paddingBottom: 16 },
  calendar: { borderWidth: 1, borderRadius: 16, padding: 8, overflow: 'hidden' },
  day: { width: 40, maxWidth: '100%', height: 44, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dayNumber: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  dayBadge: { position: 'absolute', top: -5, right: -5, minWidth: 20, height: 20, paddingHorizontal: 3, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dayBadgeText: { fontFamily: tokens.typography.native.bodyBold, fontSize: 10, lineHeight: 14, textAlign: 'center' },
  monthRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 8 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  weekdays: { flexDirection: 'row', paddingVertical: 8 },
  weekday: { flex: 1, textAlign: 'center' },
  heading: { fontFamily: tokens.typography.native.headingTh, fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
  section: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  empty: { borderWidth: 1, borderRadius: 14, alignItems: 'center', gap: 8, padding: 24 },
  event: { flexDirection: 'row', gap: 10 },
  time: { width: 44, paddingTop: 15, fontFamily: tokens.typography.native.bodyBold, fontSize: 12, lineHeight: 18 },
  eventCard: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  eventMain: { flex: 1, gap: 4 },
  eventTitle: { fontFamily: tokens.typography.native.bodyBold, fontSize: 14, lineHeight: 21 },
  form: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  label: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20 },
  field: { gap: 6 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontFamily: tokens.typography.native.body, fontSize: 16, lineHeight: 24 },
});
