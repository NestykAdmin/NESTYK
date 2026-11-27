import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Phone version of FadeIn.web.tsx: new content fades in, 120 ms, where the frame stays still (the sign page's steps,
 * Jom 25 Nov 2026); nothing moves with reduced motion. Passes the height through, like TabTransition.
 */
export function FadeIn({ active, style, children }: { active: boolean; /** The web version's layout switch; the phone always passes the height through. */ fill?: boolean; style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const [on] = useState(active);
  const [opacity] = useState(() => new Animated.Value(on ? 0 : 1));
  useEffect(() => {
    if (!on) return;
    let cancelled = false;
    const run = Animated.timing(opacity, { toValue: 1, duration: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) opacity.setValue(1);
        else run.start();
      });
    return () => {
      cancelled = true;
      run.stop();
    };
  }, [on, opacity]);
  if (!on) return <>{children}</>;
  return <Animated.View style={[{ flexGrow: 1, flexShrink: 1, minHeight: 0, opacity }, style]}>{children}</Animated.View>;
}
