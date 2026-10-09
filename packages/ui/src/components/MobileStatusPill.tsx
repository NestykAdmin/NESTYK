import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { tokens } from '../theme/tokens';

export type MobileStatusPillTone = {
  bg: string;
  fg: string;
  /** Saturated mid shade for small marks (dots) that should read as the same hue as `bg`; `fg` is too dark at that size. */
  dot?: string;
};

export const STATUS_PILL_TONES = {
  yellow: { bg: '#FEF3C7', fg: '#B45309', dot: '#F59E0B' },
  blue: { bg: '#DBEAFE', fg: '#1D4ED8', dot: '#3B82F6' },
  purple: { bg: '#EDE9FE', fg: '#6D28D9', dot: '#8B5CF6' },
  green: { bg: '#DCFCE7', fg: '#15803D', dot: '#22C55E' },
  rose: { bg: '#FCE7F3', fg: '#BE185D', dot: '#EC4899' },
  red: { bg: '#FEE2E2', fg: '#B91C1C', dot: '#EF4444' },
  slate: { bg: '#F1F5F9', fg: '#475569', dot: '#94A3B8' },
} as const satisfies Record<string, MobileStatusPillTone>;

export type MobileStatusPillToneKey = keyof typeof STATUS_PILL_TONES;

export function MobileStatusPill({
  label,
  tone = 'slate',
  style,
}: {
  label: string;
  tone?: MobileStatusPillToneKey | MobileStatusPillTone;
  style?: ViewStyle;
}) {
  const colors = typeof tone === 'string' ? STATUS_PILL_TONES[tone] : tone;
  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }, style]}>
      <Text style={[styles.label, { color: colors.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    maxWidth: 140,
  },
  label: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
});
