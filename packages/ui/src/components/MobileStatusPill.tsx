import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { tokens } from '../theme/tokens';
import { useMobileThemeOptional } from '../theme/ThemeContext';

export type MobileStatusPillTone = {
  bg: string;
  fg: string;
  /** Saturated mid shade for small marks (dots) that should read as the same hue as `bg`; `fg` is too dark at that size. */
  dot?: string;
  /** Hairline border in the same family (200 step); omitted on filled tones such as the dark "in progress" pill. */
  border?: string;
};

export const STATUS_PILL_TONES = {
  // Colour system v1.2 (Mos, 12 Nov 2026): fill one step stronger (100) and no border, so pills no longer fade into
  // the card · text 800 · dot 700. Same values as the agent web STATUS_INTENT_TONES. v1.1 was fill 50 + border 200.
  yellow: { bg: '#FEF3C7', fg: '#92400E', dot: '#B45309' },
  blue: { bg: '#DBEAFE', fg: '#1E3A8A', dot: '#1D4ED8' },
  /** "In progress" / viewing: dark pill, white text, yellow dot (same as agent web "prog"). */
  purple: { bg: '#211E1E', fg: '#FFFFFF', dot: '#F8B615' },
  green: { bg: '#DCFCE7', fg: '#166534', dot: '#15803D' },
  /** "New" / needs attention: brand family (same as agent web "attn"). */
  rose: { bg: '#FFF0C4', fg: '#211E1E', dot: '#F8B615' },
  red: { bg: '#FEE2E2', fg: '#991B1B', dot: '#B91C1C' },
  slate: { bg: '#E2E8F0', fg: '#334155', dot: '#64748B' },
} as const satisfies Record<string, MobileStatusPillTone>;

export type MobileStatusPillToneKey = keyof typeof STATUS_PILL_TONES;

/**
 * Dark mode (v1.2, B+C): a 30% translucent fill of the status colour (red 34%) with its light text step, readable on
 * the page (#211E1E) and on cards (#2F2B2B). "In progress" turns light (CI slate 100 #F1F5F9) so the ink pill does not vanish.
 */
export const STATUS_PILL_DARK_TONES = {
  yellow: { bg: 'rgba(245,158,11,0.3)', fg: '#FCD34D', dot: '#F59E0B' },
  blue: { bg: 'rgba(96,165,250,0.3)', fg: '#93C5FD', dot: '#60A5FA' },
  purple: { bg: '#F1F5F9', fg: '#211E1E', dot: '#F8B615' },
  green: { bg: 'rgba(34,197,94,0.3)', fg: '#4ADE80', dot: '#22C55E' },
  rose: { bg: 'rgba(248,182,21,0.3)', fg: '#FCDE96', dot: '#F8B615' },
  red: { bg: 'rgba(220,38,38,0.34)', fg: '#FCA5A5', dot: '#F87171' },
  slate: { bg: 'rgba(148,163,184,0.3)', fg: '#E2E8F0', dot: '#94A3B8' },
} as const satisfies Record<MobileStatusPillToneKey, MobileStatusPillTone>;

const TONE_KEY_BY_BG: Record<string, MobileStatusPillToneKey> = Object.fromEntries(
  (Object.keys(STATUS_PILL_TONES) as MobileStatusPillToneKey[]).map((key) => [STATUS_PILL_TONES[key].bg.toLowerCase(), key]),
);

/**
 * The colours to paint for a pill tone: a key, or a light tone object from STATUS_PILL_TONES / the web intents,
 * becomes its dark tone in dark mode. Any other custom tone is returned unchanged.
 */
export function pillToneFor(tone: MobileStatusPillToneKey | MobileStatusPillTone, isDark: boolean): MobileStatusPillTone {
  if (typeof tone === 'string') return isDark ? STATUS_PILL_DARK_TONES[tone] : STATUS_PILL_TONES[tone];
  if (!isDark) return tone;
  const key = TONE_KEY_BY_BG[tone.bg.toLowerCase()];
  return key ? STATUS_PILL_DARK_TONES[key] : tone;
}

export function MobileStatusPill({
  label,
  tone = 'slate',
  style,
}: {
  label: string;
  tone?: MobileStatusPillToneKey | MobileStatusPillTone;
  style?: ViewStyle;
}) {
  const isDark = useMobileThemeOptional()?.isDark ?? false;
  const colors: MobileStatusPillTone = pillToneFor(tone, isDark);
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
