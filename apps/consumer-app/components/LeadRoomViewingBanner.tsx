import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import type { LeadViewing } from '@nestyk/types';
import { useLocale } from '@nestyk/i18n';
import { MobileIcon, STATUS_PILL_TONES, tokens, useMobileTheme } from '@nestyk/ui/native';
import { formatShortDateTime } from '../lib/lead-format';

/** Reminder on top of a lead's matched room that this room already has a viewing; actions live in the bottom bar. */
export function LeadRoomViewingBanner({ viewing }: { viewing: LeadViewing | null }) {
  const { t, locale } = useLocale();
  const { theme, isDark } = useMobileTheme();
  if (!viewing) return null;
  const purple = STATUS_PILL_TONES.purple;
  const label = t.agent.leads.viewing.banner.replace('{date}', formatShortDateTime(viewing.scheduledAt, locale) ?? '');

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      accessibilityRole="alert"
      style={[
        styles.banner,
        isDark
          ? { backgroundColor: 'rgba(139,92,246,0.16)', borderColor: 'rgba(139,92,246,0.4)' }
          : { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(139,92,246,0.24)' : purple.bg }]}>
        <MobileIcon name="calendar" size={18} color={isDark ? '#C4B5FD' : purple.fg} />
      </View>
      <Text style={[styles.label, { color: theme.textHeading }]} numberOfLines={2}>
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontFamily: tokens.typography.native.headingTh, fontSize: 15, lineHeight: 23 },
});
