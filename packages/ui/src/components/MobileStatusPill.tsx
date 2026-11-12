import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { tokens } from '../theme/tokens';

export type MobileStatusPillTone = {
  bg: string;
  fg: string;
  /** Saturated mid shade for small marks (dots) that should read as the same hue as `bg`; `fg` is too dark at that size. */
  dot?: string;
  /** Hairline border in the same family (200 step); omitted on filled tones such as the dark "in progress" pill. */
  border?: string;
};

export const STATUS_PILL_TONES = {
  // Colour system v1.1 (CI, 12 Nov 2026): text 800 · dot 700 · bg 50 · border 200. See nestyk-color-system-v1-plan-20261112.md.
  yellow: { bg: '#FFFBEB', fg: '#92400E', dot: '#B45309', border: '#FDE68A' },
  blue: { bg: '#EFF6FF', fg: '#1E3A8A', dot: '#1D4ED8', border: '#BFDBFE' },
  /** "In progress" / viewing: dark pill, white text, yellow dot (same as agent web "prog"). */
  purple: { bg: '#211E1E', fg: '#FFFFFF', dot: '#F8B615' },
  green: { bg: '#F0FDF4', fg: '#166534', dot: '#15803D', border: '#BBF7D0' },
  /** "New" / needs attention: brand family (same as agent web "attn"). */
  rose: { bg: '#FFF9E8', fg: '#211E1E', dot: '#F8B615', border: '#FCDE96' },
  red: { bg: '#FEF2F2', fg: '#991B1B', dot: '#B91C1C', border: '#FECACA' },
  slate: { bg: '#F1F5F9', fg: '#334155', dot: '#64748B', border: '#E2E8F0' },
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
  const colors: MobileStatusPillTone = typeof tone === 'string' ? STATUS_PILL_TONES[tone] : tone;
  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }, colors.border ? { borderWidth: 1, borderColor: colors.border } : null, style]}>
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
