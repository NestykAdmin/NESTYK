import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { tokens, useMobileTheme } from '@nestyk/ui/native';
import { interpolate } from '@nestyk/feature-listing';

/**
 * The phone pager of the self owner lists, the same as "my rooms" (MobileSelfOwnerRoomsScreen): previous, "page n of m",
 * next (Jom 25 Nov 2026: documents and income). Shown only when there is more than one page.
 */
export function MobileSelfOwnerPager({ current, pages, onPage, testIDPrefix }: { current: number; pages: number; onPage: (page: number) => void; testIDPrefix: string }) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.selfOwnerRooms;
  if (pages <= 1) return null;
  const button = (id: 'prev' | 'next', label: string, disabled: boolean, page: number) => (
    <Pressable
      testID={`${testIDPrefix}-${id}`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onPage(page)}
      style={[styles.outline, { borderColor: theme.border, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={[styles.small, { color: theme.screenTitle }]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.pager}>
      {button('prev', copy.prev, current <= 1, current - 1)}
      <Text style={[styles.small, { color: theme.textSecondary }]}>{interpolate(copy.pageOf, { page: current, pages })}</Text>
      {button('next', copy.next, current >= pages, current + 1)}
    </View>
  );
}

const styles = StyleSheet.create({
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  outline: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10, borderWidth: 1 },
  small: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 19 },
});
