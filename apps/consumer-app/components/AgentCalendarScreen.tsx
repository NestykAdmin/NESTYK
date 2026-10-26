import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import { useLocale } from '@nestyk/i18n';
import { MobileButton, MobileIcon, tokens, useMobileTheme } from '@nestyk/ui/native';
import type { LeadViewing } from '@nestyk/types';
import { calendarDateKey, calendarLocalDate } from '../lib/agent-calendar-demo';
import { viewingToCalendarEvent } from '../lib/agent-calendar-viewings';
import { LeadViewingSheet } from './LeadViewingSheet';

interface Props {
  viewings: LeadViewing[];
  status: 'loading' | 'available' | 'error';
  onRetry: () => void;
  onSaved: (viewing: LeadViewing) => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  visibleMonth: string;
  onMonthChange: (date: string) => void;
}

/** Calendar body only: the existing Agent shell owns navigation and page chrome. */
export function AgentCalendarScreen({ viewings, status: loadStatus, onRetry, onSaved, selectedDate, onSelectDate, visibleMonth, onMonthChange }: Props) {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.agent.calendar;
  const [editing, setEditing] = useState<LeadViewing | null>(null);
  const events = useMemo(() => loadStatus === 'available'
    ? viewings.filter(viewing => viewing.status !== 'cancelled').map(viewingToCalendarEvent)
    : [], [viewings, loadStatus]);
  const localeTag = { th: 'th-TH', en: 'en-GB', zh: 'zh-CN', ja: 'ja-JP' }[locale];
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
  const monthLabel = new Intl.DateTimeFormat(localeTag, { month: 'long', year: 'numeric' }).format(calendarLocalDate(visibleMonth));
  const selectedLabel = new Intl.DateTimeFormat(localeTag, { weekday: 'long', day: 'numeric', month: 'long' }).format(calendarLocalDate(selectedDate));
  const weekdays = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(localeTag, { weekday: 'short' }).format(new Date(2026, 8, 28 + index, 12)));

  const shiftMonth = (offset: number) => {
    const date = calendarLocalDate(visibleMonth);
    date.setDate(1);
    date.setMonth(date.getMonth() + offset);
    onMonthChange(calendarDateKey(date));
  };

  return (
    <View style={styles.body}>
      <View style={[styles.notice, { backgroundColor: tokens.colors.subtle.brandBg }]}>
        <MobileIcon name="calendar" size={16} color={tokens.colors.onBrand} />
        <Text style={[styles.caption, { color: tokens.colors.onBrand, flex: 1 }]}>{copy.liveNotice}</Text>
      </View>
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
                disabled={disabled}
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
          onDayPress={day => onSelectDate(day.dateString)}
          customHeader={() => (
            <View>
              <View style={styles.monthRow}>
                <Text style={[styles.heading, heading, { flex: 1 }]}>{monthLabel}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={copy.previousMonth} onPress={() => shiftMonth(-1)} style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.5 : 1 }]}>
                  <MobileIcon name="chevron-left" size={20} color={theme.screenTitle} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={copy.nextMonth} onPress={() => shiftMonth(1)} style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.5 : 1 }]}>
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
        <MobileButton variant="ghost" onPress={() => { const today = calendarDateKey(new Date()); onSelectDate(today); onMonthChange(today.slice(0, 7) + '-01'); }} textStyle={secondary}>{copy.today}</MobileButton>
      </View>
      <View style={styles.section}>
        <Text style={[styles.heading, heading, { flex: 1 }]}>{selectedLabel}</Text>
        <Text style={[styles.caption, secondary]}>{copy.eventCount.replace('{count}', String(daily.length))}</Text>
      </View>
      {loadStatus === 'loading' ? (
        <View style={[styles.empty, surface]}>
          <ActivityIndicator color={theme.textSecondary} />
          <Text accessibilityLiveRegion="polite" style={[styles.caption, secondary]}>{t.common.loading}</Text>
        </View>
      ) : loadStatus === 'error' ? (
        <View style={[styles.empty, surface]}>
          <Text accessibilityRole="alert" style={[styles.caption, secondary]}>{copy.loadError}</Text>
          <MobileButton variant="outline" onPress={onRetry}>{t.agent.tenants.retry}</MobileButton>
        </View>
      ) : daily.length === 0 ? (
        <View style={[styles.empty, surface]}>
          <MobileIcon name="calendar" size={30} color={theme.textSecondary} />
          <Text style={[styles.heading, heading]}>{copy.emptyTitle}</Text>
          <Text style={[styles.caption, secondary, { textAlign: 'center' }]}>{copy.emptyHint}</Text>
        </View>
      ) : daily.map(event => {
        const status = event.status === 'scheduled'
          ? { backgroundColor: tokens.colors.subtle.successBg, color: tokens.colors.subtle.successFg }
          : { backgroundColor: tokens.colors.subtle.warningBg, color: tokens.colors.subtle.warningFg };
        return (
          <View key={event.id} style={styles.event}>
            <Text style={[styles.time, heading]}>{event.time}</Text>
            <View style={[styles.eventCard, surface]}>
              <View style={styles.eventTop}>
                <Text style={[styles.caption, secondary]}>{copy.viewing}</Text>
                <Text style={[styles.status, status]}>{event.status === 'done' ? copy.done : copy.confirmed}</Text>
              </View>
              <Text style={[styles.eventTitle, heading]}>{event.title}</Text>
              {!!event.location && <Text style={[styles.caption, secondary]}>{event.location}</Text>}
              {event.status === 'scheduled' && (
                <MobileButton variant="outline" onPress={() => setEditing(event.viewing)}>{copy.manage}</MobileButton>
              )}
            </View>
          </View>
        );
      })}
      <MobileButton disabled>{`＋ ${copy.add}`}</MobileButton>
      <Text style={[styles.caption, secondary]}>{copy.creationDisabled}</Text>
      {editing && <LeadViewingSheet
        visible
        leadId={editing.leadId}
        roomId={editing.rentRoomId}
        viewing={editing}
        onClose={() => setEditing(null)}
        onSaved={viewing => { setEditing(null); onSaved(viewing); }}
      />}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14, paddingBottom: 16 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10 },
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
  eventCard: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 },
  eventTop: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  status: { fontFamily: tokens.typography.native.body, fontSize: 11, lineHeight: 17, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  eventTitle: { fontFamily: tokens.typography.native.bodyBold, fontSize: 14, lineHeight: 21 },
});
