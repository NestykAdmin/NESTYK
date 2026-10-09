import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { tokens, useMobileTheme } from '@nestyk/ui/native';
import { daysFromToday, localeTag, viewingDayLabel } from '../lib/lead-format';

export type ViewingDateTileTone = 'upcoming' | 'past' | 'cancelled';

/**
 * Day label strip + time + date of a viewing. Without `tone`, only today's upcoming viewing gets the
 * brand strip; with `tone` the tile itself shows the status (yellow upcoming, gray past, struck-through cancelled).
 */
export function ViewingDateTile({ at, past = false, tone }: { at: string; past?: boolean; tone?: ViewingDateTileTone }) {
  const { t, locale } = useLocale();
  const c = t.agent.leads;
  const { theme, isDark } = useMobileTheme();
  const date = new Date(at);
  const tag = localeTag(locale);
  const day = date.toLocaleDateString(tag, { day: 'numeric', month: 'short' });
  const time = date.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit', hour12: false });
  const isPast = tone ? tone !== 'upcoming' : past;
  const dayLabel = isPast
    ? date.toLocaleDateString(tag, { weekday: 'short' })
    : (viewingDayLabel(at, locale, c.viewing) ?? '');
  const brand = tone ? tone === 'upcoming' : !past && daysFromToday(date) <= 0;
  const gray = !!tone && tone !== 'upcoming';
  const grayStrip = isDark ? 'rgba(148,163,184,0.18)' : '#E2E8F0';

  return (
    <View
      accessible
      accessibilityLabel={`${dayLabel} ${day} ${time}`}
      style={[
        styles.tile,
        { backgroundColor: theme.surface, borderColor: brand ? tokens.colors.brand[500] : theme.border },
      ]}
    >
      <View
        style={[styles.head, { backgroundColor: brand ? tokens.colors.brand[500] : gray ? grayStrip : theme.background }]}
      >
        <Text
          style={[styles.headText, { color: brand ? tokens.colors.primary : theme.textSecondary }]}
          numberOfLines={1}
        >
          {dayLabel}
        </Text>
      </View>
      <Text
        style={[
          styles.time,
          { color: gray ? theme.textSecondary : theme.textHeading },
          tone === 'cancelled' ? styles.struck : null,
        ]}
        numberOfLines={1}
      >
        {time}
      </Text>
      <Text style={[styles.day, { color: theme.textSecondary }]} numberOfLines={1}>
        {day}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 60,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    paddingBottom: 4,
  },
  head: { alignSelf: 'stretch', alignItems: 'center', paddingHorizontal: 2, paddingVertical: 1 },
  headText: { fontFamily: tokens.typography.native.bodyBold, fontSize: 11, lineHeight: 17 },
  time: { fontFamily: tokens.typography.native.bodyBold, fontSize: 18, lineHeight: 26, marginTop: 2 },
  struck: { textDecorationLine: 'line-through' },
  day: { fontFamily: tokens.typography.native.bodyBold, fontSize: 12, lineHeight: 18 },
});
