import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { useMobileTheme } from '@nestyk/ui/native';

/** Delay before the skeleton shows, so a quick load does not flash it (Jom 25 Nov 2026; the web uses the same 300 ms). */
const SHOW_AFTER_MS = 300;

/**
 * Grey placeholder cards while a self owner list loads on the phone (Jom 25 Nov 2026), in place of a spinner: the
 * same shape as the cards that come next. Fades in after a short wait, then pulses gently; no pulse with reduced motion.
 */
export function MobileSkeletonCards({ count = 3, lines = 3 }: { count?: number; lines?: number }) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let cancelled = false;
    let run: Animated.CompositeAnimation | null = null;
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        const fadeIn = Animated.timing(opacity, { toValue: 1, duration: 160, delay: SHOW_AFTER_MS, useNativeDriver: true });
        run = reduce
          ? fadeIn
          : Animated.sequence([
              fadeIn,
              Animated.loop(
                Animated.sequence([
                  Animated.timing(opacity, { toValue: 0.55, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                  Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                ]),
              ),
            ]);
        run.start();
      });
    return () => {
      cancelled = true;
      run?.stop();
    };
  }, [opacity]);

  const bar = { backgroundColor: theme.border };
  return (
    <Animated.View testID="so-skeleton" accessible accessibilityRole="progressbar" accessibilityLabel={t.common.loading} style={[styles.list, { opacity }]}>
      {Array.from({ length: count }, (_, card) => (
        <View key={card} testID="so-skeleton-card" style={[styles.card, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          {Array.from({ length: lines }, (_, line) => (
            <View key={line} style={[styles.bar, bar, { width: line === 0 ? '60%' : `${85 - ((card + line) % 3) * 15}%` }]} />
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  card: { gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  bar: { height: 12, borderRadius: 6 },
});
