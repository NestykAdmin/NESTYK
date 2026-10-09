import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { tokens } from '../theme/tokens';
import { useMobileTheme } from '../theme/ThemeContext';
import { STATUS_PILL_TONES, type MobileStatusPillTone, type MobileStatusPillToneKey } from './MobileStatusPill';

export type MobileFilterChipProps = {
  label: string;
  /** Shown after the label; `null` hides it, a string (e.g. "–") stands in while loading. */
  count?: number | string | null;
  selected?: boolean;
  onPress: () => void;
  /**
   * Status colours: a dot while unselected, the tone's fill + ink when selected.
   * Omit for the default brand look (cream fill, yellow border, dark ink).
   */
  tone?: MobileStatusPillToneKey | MobileStatusPillTone;
  /** Hide the dot even with a tone (e.g. the "All" chip). */
  showDot?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Filter chip for list screens (status / quick filters above a list).
 * Rounded rectangle (radius 12) — capsules are reserved for read-only `MobileStatusPill`.
 */
export function MobileFilterChip({
  label,
  count = null,
  selected = false,
  onPress,
  tone,
  showDot = true,
  accessibilityLabel,
  style,
  testID,
}: MobileFilterChipProps) {
  const { theme } = useMobileTheme();
  const colors = typeof tone === 'string' ? STATUS_PILL_TONES[tone] : tone;
  const fill = selected
    ? colors
      ? { backgroundColor: colors.bg, borderColor: colors.fg }
      : { backgroundColor: tokens.colors.brand[100], borderColor: tokens.colors.brand[500] }
    : { backgroundColor: theme.surface, borderColor: theme.border };
  const ink = selected ? (colors ? colors.fg : tokens.colors.primary) : theme.textHeading;
  const countInk = selected ? ink : theme.textSecondary;
  const dot = colors && showDot && !selected ? (colors.dot ?? colors.fg) : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? (count == null ? label : `${label} ${count}`)}
      android_ripple={{ color: 'rgba(33,30,30,0.12)' }}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        fill,
        pressed && Platform.OS === 'ios' ? styles.pressed : null,
        style,
      ]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      <Text style={[styles.label, { color: ink }]} numberOfLines={1}>
        {label}
      </Text>
      {count != null ? <Text style={[styles.count, { color: countInk }]}>{count}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontFamily: tokens.typography.native.bodyBold, fontSize: 13, lineHeight: 20 },
  count: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
});
