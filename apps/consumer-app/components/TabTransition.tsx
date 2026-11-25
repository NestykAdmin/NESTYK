import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import type { TabSlideDirection } from '../lib/tab-transition';

/**
 * Phone version of TabTransition.web.tsx: one menu's page (keyed per menu by the shell) slides and fades in once from
 * `direction`, 140 ms; nothing moves when the phone asks for reduced motion. No direction → the page as before.
 */
export function TabTransition({ direction, children }: { direction: TabSlideDirection | null; children?: React.ReactNode }) {
  const [side] = useState(direction);
  const progress = useRef(new Animated.Value(side ? 0 : 1)).current;

  useEffect(() => {
    if (!side) return;
    let cancelled = false;
    const run = Animated.timing(progress, { toValue: 1, duration: 140, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) progress.setValue(1);
        else run.start();
      });
    return () => {
      cancelled = true;
      run.stop();
    };
  }, [side, progress]);

  if (!side) return <>{children}</>;
  const from = side === 'right' ? 24 : -24;
  return (
    <Animated.View
      style={{
        // Passes the page's height through (a filling page such as the add-room form still fills; recheck 25 Nov 2026).
        flexGrow: 1,
        flexShrink: 1,
        minHeight: 0,
        opacity: progress,
        transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}
