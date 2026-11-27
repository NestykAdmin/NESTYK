import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import { tokens } from '../theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const BRAND = tokens.colors.brand[500];
const TRACK = '#E5E7EB';

/** Smile arc — viewBox 240×90 */
export const SMILE_D = 'M 28 32 Q 120 98 212 32';
export const SMILE_LENGTH = 248;

export type SmileProgressSize = 'sm' | 'md' | 'lg';

export type SmileProgressMetrics = {
  width: number;
  height: number;
  stroke: number;
  glow: number;
};

const SIZE_MAP: Record<SmileProgressSize, SmileProgressMetrics> = {
  sm: { width: 120, height: 46, stroke: 7, glow: 12 },
  md: { width: 160, height: 61, stroke: 9, glow: 14 },
  lg: { width: 236, height: 90, stroke: 11, glow: 18 },
};

export interface MobileSmileProgressProps {
  /** 0–1 determinate fill. Ignored when `indeterminate`. */
  progress?: number;
  indeterminate?: boolean;
  size?: SmileProgressSize;
  /** Override width/stroke metrics (e.g. BrandLoader paired layout). */
  metrics?: SmileProgressMetrics;
  onFilled?: () => void;
  /** Unique gradient id when multiple smiles mount. */
  gradientId?: string;
  /** Colour of the empty part of the arc (light grey by default; the ink preload uses a light line on ink). */
  trackColor?: string;
}

export function MobileSmileProgress({
  progress = 0.2,
  indeterminate = false,
  size = 'lg',
  metrics,
  onFilled,
  gradientId = 'smileGlow',
  trackColor = TRACK,
}: MobileSmileProgressProps) {
  const dash = useSharedValue(indeterminate ? 0.18 : 0.12);
  const filled = useSharedValue(false);
  const dims = metrics ?? SIZE_MAP[size];

  useEffect(() => {
    filled.value = false;
  }, [indeterminate, filled]);

  useEffect(() => {
    if (!indeterminate && progress < 0.99) {
      filled.value = false;
    }
  }, [progress, indeterminate, filled]);

  useEffect(() => {
    if (indeterminate) {
      dash.value = 0.22;
      dash.value = withRepeat(
        withSequence(
          withTiming(0.88, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.22, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
      return () => cancelAnimation(dash);
    }

    const target = Math.max(0.04, Math.min(1, progress));
    dash.value = withTiming(
      target,
      { duration: target >= 0.99 ? 420 : 700, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished && target >= 0.99 && onFilled && !filled.value) {
          filled.value = true;
          runOnJS(onFilled)();
        }
      },
    );
    return () => cancelAnimation(dash);
  }, [progress, indeterminate, dash, filled, onFilled]);

  const animatedProps = useAnimatedProps(() => {
    const len = SMILE_LENGTH * dash.value;
    return {
      strokeDasharray: `${len} ${SMILE_LENGTH}`,
      strokeDashoffset: 0,
    };
  });

  return (
    <View
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityValue={
        indeterminate
          ? undefined
          : { min: 0, max: 100, now: Math.round(Math.min(1, Math.max(0, progress)) * 100) }
      }
    >
      <Svg width={dims.width} height={dims.height} viewBox="0 0 240 90">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={BRAND} stopOpacity="0.1" />
            <Stop offset="0.5" stopColor={BRAND} stopOpacity="0.4" />
            <Stop offset="1" stopColor={BRAND} stopOpacity="0.1" />
          </LinearGradient>
        </Defs>
        <Path
          d={SMILE_D}
          stroke={trackColor}
          strokeWidth={dims.stroke}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d={SMILE_D}
          stroke={`url(#${gradientId})`}
          strokeWidth={dims.glow}
          strokeLinecap="round"
          fill="none"
          opacity={0.5}
        />
        <AnimatedPath
          d={SMILE_D}
          stroke={BRAND}
          strokeWidth={dims.stroke}
          strokeLinecap="round"
          fill="none"
          animatedProps={animatedProps}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
