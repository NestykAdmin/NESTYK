import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import type { LeadViewing } from '@nestyk/types';
import { localizedError, useLocale } from '@nestyk/i18n';
import { MobileBottomSheet, MobileButton, MobileIcon, MobileInput, tokens, useMobileTheme } from '@nestyk/ui/native';
import { createLeadViewing, listAgentViewings, updateLeadViewing } from '../lib/agent-leads-api';
import { calendarDateKey, calendarLocalDate } from '../lib/agent-calendar-demo';
import { localeTag } from '../lib/lead-format';
import { SheetHeader } from './AgentLeadDetailBody';
import { openTimeDialog, timePickerInline, ViewingTimePicker } from './ViewingTimeField';

/** Viewings closer than this to another one on the same day get a (non-blocking) warning. */
const NEAR_MS = 60 * 60 * 1000;

function localDateTime(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

function timeKey(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Next full hour from now — a new viewing starts there so it can be saved straight away. */
function nextFullHour(): Date {
  const at = new Date();
  at.setMinutes(0, 0, 0);
  at.setHours(at.getHours() + 1);
  return at;
}

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
  const [dayViewings, setDayViewings] = useState<LeadViewing[] | null>(null);
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
    const start = calendarLocalDate(date);
    const from = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const to = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    listAgentViewings(from.toISOString(), to.toISOString())
      .then((rows) => {
        if (active) setDayViewings(rows.filter((v) => v.status === 'scheduled' && v.id !== viewing?.id));
      })
      .catch(() => {
        if (active) setDayViewings([]);
      });
    return () => {
      active = false;
    };
  }, [visible, date, viewing]);

  const tag = localeTag(locale);
  const today = calendarDateKey(new Date());
  const selectedAt = date && time ? localDateTime(date, time).getTime() : 0;
  const past = !!selectedAt && selectedAt <= Date.now();
  const near = selectedAt
    ? (dayViewings ?? []).find((v) => Math.abs(new Date(v.scheduledAt).getTime() - selectedAt) < NEAR_MS)
    : undefined;
  const dateLabel = date
    ? calendarLocalDate(date).toLocaleDateString(tag, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
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
    if (busy || !date || !time || past) return;
    setBusy(true);
    setError(null);
    try {
      const scheduledAt = localDateTime(date, time).toISOString();
      const saved = viewing
        ? await updateLeadViewing(viewing.id, { scheduledAt, note: note.trim() || null })
        : await createLeadViewing(leadId, { rentRoomId: roomId, scheduledAt, note: note.trim() || null });
      onSaved(saved);
    } catch (err) {
      setError(localizedError(err, c.saveError, locale));
    } finally {
      setBusy(false);
    }
  };

  const cancelViewing = async () => {
    if (busy || !viewing) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await updateLeadViewing(viewing.id, { status: 'cancelled' }));
    } catch (err) {
      setError(localizedError(err, c.cancelError, locale));
    } finally {
      setBusy(false);
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
                  {(near.rentRoomId === roomId ? c.nearViewingSameRoom : c.nearViewing).replace(
                    '{time}',
                    timeKey(new Date(near.scheduledAt)),
                  )}
                </Text>
              </View>
            ) : null}

            <View style={styles.daySection}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>{c.dayViewings}</Text>
              {dayViewings === null ? null : dayViewings.length === 0 ? (
                <Text style={[styles.muted, { color: theme.textSecondary }]}>{c.noDayViewings}</Text>
              ) : (
                dayViewings.map((v) => (
                  <View key={v.id} style={styles.dayItem}>
                    <Text style={[styles.dayTime, { color: theme.textHeading }]}>{timeKey(new Date(v.scheduledAt))}</Text>
                    <Text style={[styles.dayTitle, { color: theme.textHeading }]} numberOfLines={1}>
                      {v.leadName} · {v.roomTitle}
                    </Text>
                  </View>
                ))
              )}
            </View>

            <MobileInput value={note} onChangeText={setNote} placeholder={c.notePlaceholder} maxLength={500} editable={!busy} />
            {error ? <Text style={[styles.error, { color: tokens.colors.danger }]}>{error}</Text> : null}
            <MobileButton onPress={() => void save()} isLoading={busy} disabled={past}>
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
