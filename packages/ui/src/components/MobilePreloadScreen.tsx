import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useLocale } from '@nestyk/i18n';
import { MobileNestykLogo } from './MobileNestykLogo';
import { MobileSmileProgress } from './MobileSmileProgress';
import { tokens } from '../theme/tokens';

/**
 * Ink of the loading screens (design A, Mos 25 Nov 2026, canvas page "loading"): the native splash, this screen and
 * the guest page's header share it, so opening the app never flashes white.
 */
const INK = '#211E1E';
/** Empty part of the smile on ink. */
const DARK_TRACK = 'rgba(255,255,255,0.16)';
const LABEL = 'rgba(255,255,255,0.72)';
const EXIT_MS = 320;

export interface MobilePreloadScreenProps {
  /** Bootstrap finished (auth + min delay). */
  ready?: boolean;
  /** Called once the screen is gone: the smile filled and the screen faded out. */
  onEnter?: () => void;
}

/** Branded preload: logo and smile progress on ink, then a short fade into the app (no tap needed). */
export const MobilePreloadScreen: React.FC<MobilePreloadScreenProps> = ({ ready = false, onEnter }) => {
  const { t } = useLocale();
  const copy = t.mobile.preload;
  const { width, height } = useWindowDimensions();
  const compact = height < 720 || width < 360;
  const reduceMotion = useReducedMotion();
  const [progress, setProgress] = useState(0.18);
  const fade = useSharedValue(1);

  useEffect(() => {
    if (ready) {
      setProgress(1);
      return;
    }
    setProgress(0.22);
    const t1 = setTimeout(() => setProgress(0.48), 280);
    const t2 = setTimeout(() => setProgress(0.72), 650);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [ready]);

  const finish = useCallback(() => {
    onEnter?.();
  }, [onEnter]);

  // The smile is full and the app is ready: fade out, then enter (at once when the phone asks for less motion).
  const handleFilled = useCallback(() => {
    if (reduceMotion) {
      onEnter?.();
      return;
    }
    fade.value = withTiming(0, { duration: EXIT_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(finish)();
    });
  }, [reduceMotion, onEnter, fade, finish]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <Animated.View
      style={[styles.root, fadeStyle]}
      accessibilityLabel={copy.preparing}
      accessibilityLiveRegion="polite"
      accessibilityViewIsModal
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.center} pointerEvents="none">
        <MobileNestykLogo variant="wordmarkOnDark" height={compact ? 48 : 56} />
        <View style={styles.smile}>
          <MobileSmileProgress
            progress={progress}
            size="md"
            gradientId="preloadSmileGlow"
            trackColor={DARK_TRACK}
            onFilled={ready ? handleFilled : undefined}
          />
        </View>
        <Text style={styles.label} numberOfLines={2}>
          {copy.preparing}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: INK,
    zIndex: 100,
    elevation: 100,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  smile: {
    marginTop: 20,
  },
  label: {
    marginTop: 8,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: LABEL,
    textAlign: 'center',
  },
});
