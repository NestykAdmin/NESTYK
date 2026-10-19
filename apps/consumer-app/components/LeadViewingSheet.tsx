import { listCalendarEvents } from '../lib/agent-calendar-api';
import { viewingToCalendarEvent } from '../lib/agent-calendar-viewings';
import { calendarEventFromApi } from '../lib/agent-calendar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import type { LeadViewing } from '@nestyk/types';
import { localizedError, useLocale } from '@nestyk/i18n';
import { MobileBottomSheet, MobileButton, MobileIcon, MobileInput, tokens, useMobileTheme } from '@nestyk/ui/native';
import { createLeadViewing, listAgentViewings, updateLeadViewing } from '../lib/agent-leads-api';
import { calendarDateKey, calendarLocalDate, calendarDateTime, calendarTimeKey, calendarDayRange, nearbyCalendarEvent, CALENDAR_TIMEZONE, type CalendarEvent } from '../lib/agent-calendar';
import { localeTag } from '../lib/lead-format';
import { SheetHeader } from './AgentLeadDetailBody';
import { openTimeDialog, timePickerInline, ViewingTimePicker } from './ViewingTimeField';

function nextFullHour(): Date {
  return new Date(Math.ceil((Date.now() + 1) / 3600000) * 3600000);
}
const timeKey = calendarTimeKey;

function FormRow({
  label,
  value,
  expanded,
  onPress,
  disabled,
  divider,
}: {
  label: string;
  value: string;
  expanded: boolean;
  onPress: () => void;
  disabled?: boolean;
  divider?: boolean;
}) {
  const { theme } = useMobileTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ expanded, disabled }}
      style={({ pressed }) => [
        styles.row,
        divider ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border } : null,
        pressed && Platform.OS === 'ios' ? { opacity: 0.7 } : null,
      ]}
      android_ripple={{ color: 'rgba(33,30,30,0.08)' }}
    >
      <Text style={[styles.rowLabel, { color: theme.textHeading }]}>{label}</Text>
      <Text
        style={[styles.rowValue, { color: expanded ? tokens.colors.brand[700] : theme.textHeading }]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <MobileIcon name={expanded ? 'chevron-down' : 'chevron-right'} size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

/** Book or move a lead's viewing of one room; an existing viewing can also be cancelled here. */
export function LeadViewingSheet({
  visible,
  leadId,
  roomId,
  viewing,
  onClose,
  onSaved,
}: {
  visible: boolean;
  leadId: number;
  roomId: number;
  /** Upcoming scheduled viewing of this room, if any. */
  viewing: LeadViewing | null;
  onClose: () => void;
  /** Called with the saved viewing; a cancelled one comes back with `status: 'cancelled'`. */
  onSaved: (viewing: LeadViewing) => void;
}) {
  const { t, locale } = useLocale();
  const c = t.agent.leads.viewing;
  const { theme } = useMobileTheme();
  const [mode, setMode] = useState<'form' | 'cancel'>('form');
  const [expanded, setExpanded] = useState<'date' | 'time' | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [dayViewings, setDayViewings] = useState<CalendarEvent[] | null>(null);
  const [checkedDate, setCheckedDate] = useState('');
  const pending = useRef(false);
  const [overlapFailed, setOverlapFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const at = viewing ? new Date(viewing.scheduledAt) : nextFullHour();
    setMode('form');
    setExpanded(null);
    setDate(calendarDateKey(at));
    setTime(timeKey(at));
    setNote(viewing?.note ?? '');
    setError(null);
  }, [visible, viewing]);

  useEffect(() => {
    if (!visible || !date) return;
    let active = true;
    setDayViewings(null);
    setOverlapFailed(false); setCheckedDate('');
    const dayRange = calendarDayRange(date);
    const from = new Date(Date.parse(dayRange.from) - 3600000).toISOString();
    const to = new Date(Date.parse(dayRange.to) + 3600000).toISOString();
    Promise.allSettled([listAgentViewings(from, to).then(rows => rows.map(viewingToCalendarEvent)), listCalendarEvents(from, to).then(rows => rows.map(calendarEventFromApi))])
      .then(results => {
        if (!active) return;
        setDayViewings(results.flatMap(result => result.status === 'fulfilled' ? result.value : []).filter(event => (event.source === 'manual' ? event.status !== 'cancelled' : event.status === 'scheduled') && event.id !== `viewing-${viewing?.id}`));
        setOverlapFailed(results.some(result => result.status === 'rejected'));
        setCheckedDate(date);
      });
    return () => {
      active = false;
    };
  }, [visible, date, viewing]);

  const tag = localeTag(locale);
  const today = calendarDateKey(new Date());
  const selectedAt = date && time ? calendarDateTime(date, time).getTime() : 0;
  const past = !!selectedAt && selectedAt <= Date.now();
  const near = nearbyCalendarEvent(dayViewings ?? [], date, time, `viewing-${viewing?.id}`);
  const sameDay = dayViewings?.filter(event => event.date === date);
  const dateLabel = date
    ? calendarLocalDate(date).toLocaleDateString(tag, { timeZone: CALENDAR_TIMEZONE, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  const markedDates = useMemo(
    () => (date ? { [date]: { selected: true, selectedColor: tokens.colors.brand[500], selectedTextColor: tokens.colors.primary } } : {}),
    [date],
  );

  const close = () => {
    if (!busy) onClose();
  };

  const pickTime = (next: string) => {
    setTime(next);
    setError(null);
  };

  const save = async () => {
    if (pending.current || !date || !time || past || checkedDate !== date) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const scheduledAt = calendarDateTime(date, time).toISOString();
      const saved = viewing
        ? await updateLeadViewing(viewing.id, { scheduledAt, note: note.trim() || null })
        : await createLeadViewing(leadId, { rentRoomId: roomId, scheduledAt, note: note.trim() || null });
      onSaved(saved);
    } catch (err) {
      setError(localizedError(err, c.saveError, locale));
    } finally {
      pending.current = false; setBusy(false);
    }
  };

  const cancelViewing = async () => {
    if (pending.current || !viewing) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      onSaved(await updateLeadViewing(viewing.id, { status: 'cancelled' }));
    } catch (err) {
      setError(localizedError(err, c.cancelError, locale));
    } finally {
      pending.current = false; setBusy(false);
    }
  };

  return (
    <MobileBottomSheet visible={visible} onClose={close} maxHeight="90%" avoidKeyboard>
      {mode === 'cancel' ? (
        <>
          <SheetHeader title={c.cancelConfirm} onClose={close} />
          <View style={styles.body}>
            {error ? <Text style={[styles.error, { color: tokens.colors.danger }]}>{error}</Text> : null}
            <MobileButton onPress={() => void cancelViewing()} isLoading={busy} style={styles.dangerBtn} textStyle={styles.dangerLabel}>
              {c.cancel}
            </MobileButton>
            <MobileButton variant="outline" onPress={() => setMode('form')} disabled={busy}>
              {c.keep}
            </MobileButton>
          </View>
        </>
      ) : (
        <>
          <SheetHeader title={viewing ? c.editTitle : c.title} onClose={close} />
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <FormRow
                label={c.date}
                value={dateLabel}
                expanded={expanded === 'date'}
                disabled={busy}
                onPress={() => setExpanded((open) => (open === 'date' ? null : 'date'))}
              />
              {expanded === 'date' ? (
                <Calendar
                  current={date || today}
                  minDate={today}
                  firstDay={1}
                  markedDates={markedDates}
                  onDayPress={(day) => {
                    if (day.dateString < today) return;
                    setDate(day.dateString);
                    setError(null);
                    setExpanded(null);
                  }}
                  theme={{
                    calendarBackground: theme.surface,
                    dayTextColor: theme.textHeading,
                    monthTextColor: theme.textHeading,
                    todayTextColor: tokens.colors.brand[700],
                    arrowColor: theme.textHeading,
                    textDisabledColor: tokens.colors.placeholder,
                    selectedDayBackgroundColor: tokens.colors.brand[500],
                    selectedDayTextColor: tokens.colors.primary,
                    textMonthFontWeight: '600',
                  }}
                  style={styles.calendar}
                />
              ) : null}
              <FormRow
                label={c.time}
                value={time}
                expanded={expanded === 'time'}
                disabled={busy}
                divider
                onPress={() => {
                  if (timePickerInline) setExpanded((open) => (open === 'time' ? null : 'time'));
                  else {
                    setExpanded(null);
                    openTimeDialog(time, pickTime);
                  }
                }}
              />
              {expanded === 'time' && time ? (
                <View style={styles.timeWrap}>
                  <ViewingTimePicker value={time} disabled={busy} onChange={pickTime} />
                </View>
              ) : null}
            </View>

            {past ? <Text style={[styles.error, { color: tokens.colors.danger }]}>{c.timePast}</Text> : null}
            {!past && near ? (
              <View style={[styles.warn, { backgroundColor: tokens.colors.subtle.warningBg }]}>
                <MobileIcon name="warning" size={16} color={tokens.colors.subtle.warningFg} />
                <Text style={[styles.warnText, { color: tokens.colors.subtle.warningFg }]}>
                  {t.agent.calendar.overlapWarning.replace('{time}', near.date === date ? near.time : `${near.date} ${near.time}`).replace('{title}', near.title)}
                </Text>
              </View>
            ) : null}

            {overlapFailed && <Text style={[styles.muted, { color: theme.textSecondary }]}>{t.agent.calendar.overlapIncomplete}</Text>}
            <View style={styles.daySection}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>{t.agent.calendar.dayAppointments}</Text>
              {sameDay === undefined ? <Text style={[styles.muted, { color: theme.textSecondary }]}>{t.common.loading}</Text> : sameDay.length === 0 && !overlapFailed ? (
                <Text style={[styles.muted, { color: theme.textSecondary }]}>{t.agent.calendar.noDayAppointments}</Text>
              ) : (
                sameDay.map((v) => (
                  <View key={v.id} style={styles.dayItem}>
                    <Text style={[styles.dayTime, { color: theme.textHeading }]}>{v.time}</Text>
                    <Text style={[styles.dayTitle, { color: theme.textHeading }]} numberOfLines={1}>
                      {v.title}
                    </Text>
                  </View>
                ))
              )}
            </View>

            <MobileInput value={note} onChangeText={setNote} placeholder={c.notePlaceholder} maxLength={500} editable={!busy} />
            {error ? <Text style={[styles.error, { color: tokens.colors.danger }]}>{error}</Text> : null}
            <MobileButton onPress={() => void save()} isLoading={busy} disabled={past || checkedDate !== date}>
              {viewing ? c.saveChange : c.save}
            </MobileButton>
            {viewing ? (
              <Pressable
                onPress={() => setMode('cancel')}
                disabled={busy}
                hitSlop={8}
                accessibilityRole="button"
                style={({ pressed }) => [styles.cancelLink, pressed && Platform.OS === 'ios' ? { opacity: 0.75 } : null]}
                {...(Platform.OS === 'android' ? { android_ripple: { color: 'rgba(33,30,30,0.08)' } } : {})}
              >
                <Text style={[styles.link, { color: tokens.colors.danger }]}>{c.cancel}</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </>
      )}
    </MobileBottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  body: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, gap: 12 },
  group: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, paddingHorizontal: 14 },
  rowLabel: { fontFamily: tokens.typography.native.bodyBold, fontSize: 15, lineHeight: 22 },
  rowValue: { flex: 1, textAlign: 'right', fontFamily: tokens.typography.native.headingTh, fontSize: 16, lineHeight: 24 },
  calendar: { paddingBottom: 8 },
  timeWrap: { paddingHorizontal: 14, paddingBottom: 10 },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  warnText: { flex: 1, fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 19 },
  daySection: { gap: 6 },
  sectionLabel: { fontFamily: tokens.typography.native.bodyBold, fontSize: 13, lineHeight: 19 },
  muted: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 19 },
  dayItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayTime: { width: 48, fontFamily: tokens.typography.native.bodyBold, fontSize: 14, lineHeight: 21 },
  dayTitle: { flex: 1, fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 21 },
  error: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 19 },
  link: { fontFamily: tokens.typography.native.bodyBold, fontSize: 13, lineHeight: 19 },
  cancelLink: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 8, overflow: 'hidden' },
  dangerBtn: { backgroundColor: tokens.colors.danger },
  dangerLabel: { color: '#FFFFFF' },
});
