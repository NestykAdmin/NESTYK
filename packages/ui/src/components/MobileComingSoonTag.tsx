import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { tokens } from '../theme/tokens';
import { useMobileTheme } from '../theme/ThemeContext';

/**
 * "Coming soon" tag (Mos, 12 Nov 2026, design B "soft fill"): quieter than a status pill.
 * Soft fill per mode, regular 11px muted text (6.9:1 light, 4.6:1 dark), one line with a capped
 * width so long translations (th/en/ja/zh) never push the item label.
 */
export function MobileComingSoonTag({ label, style }: { label: string; style?: ViewStyle }) {
  const { theme, isDark } = useMobileTheme();
  return (
    <View style={[styles.tag, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }, style]}>
      <Text style={[styles.label, { color: isDark ? theme.textSecondary : '#475569' }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'center',
    flexShrink: 0,
    maxWidth: 112,
  },
  label: {
    fontFamily: tokens.typography.native.body,
    fontSize: 11,
    lineHeight: 16,
  },
});
