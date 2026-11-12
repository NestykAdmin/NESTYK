import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Image,
  ImageSourcePropType,
  Pressable,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '@nestyk/i18n';
import { MobileNestykLogo } from './MobileNestykLogo';
import { MobileSmileProgress } from './MobileSmileProgress';
import { tokens } from '../theme/tokens';
import preloadBackground from '../../assets/backgrounds/preload-background.png';

const BRAND = tokens.colors.brand[500];
const INK = tokens.colors.primary;
const IDLE_DURATION = 2200;
const GLOW_DURATION = 2400;
const RING_DURATION = 3600;
const RING_STAGGER = 1400;
const RING_COUNT = 2;

function SoftGlowRing({
  diameter,
  delayMs,
  active,
}: {
  diameter: number;
  delayMs: number;
  active: boolean;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withDelay(
      delayMs,
      withRepeat(
        withTiming(1, { duration: RING_DURATION, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );
  }, [active, delayMs, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.34 * (1 - progress.value),
    transform: [{ scale: 1 + progress.value * 0.6 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.softRing,
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          borderColor: BRAND,
        },
        style,
      ]}
    />
  );
}

export interface MobilePreloadScreenProps {
  /** Bootstrap finished (auth + min delay). */
  ready?: boolean;
  /** User taps to dismiss preload and enter the app. */
  onEnter?: () => void;
}

function SoftBackdrop() {
  const insets = useSafeAreaInsets();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={preloadBackground as ImageSourcePropType}
        style={styles.backdropImage}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      <Text style={[styles.cornerText, { top: insets.top + 20, right: 18 }]} numberOfLines={1}>
        A MORE CONNECTED TOMORROW
      </Text>
      <Text
        style={[styles.cornerText, { bottom: Math.max(insets.bottom, 16) + 14, left: 18 }]}
        numberOfLines={1}
      >
        SPACES · PEOPLE · PROGRESS
      </Text>
    </View>
  );
}

/** Branded preload — smile progress, then welcome + tap to enter. */
export const MobilePreloadScreen: React.FC<MobilePreloadScreenProps> = ({
  ready = false,
  onEnter,
}) => {
  const { t, locale } = useLocale();
  const { width, height } = useWindowDimensions();
  const copy = t.mobile.preload;
  const [phase, setPhase] = useState<'loading' | 'welcome'>('loading');
  const [progress, setProgress] = useState(0.18);
  const [exiting, setExiting] = useState(false);
  const pulse = useSharedValue(1);
  const exitOpacity = useSharedValue(1);
  const exitScale = useSharedValue(1);
  const idle = useSharedValue(1);
  const glow = useSharedValue(0.55);
  const compact = height < 720 || width < 360;
  const iconSize = compact ? 112 : 132;
  const logoSize = compact ? 108 : 128;
  const iconActive = !exiting;

  const primary = locale === 'en' ? copy.preparingEn : copy.preparing;
  const secondary = locale === 'en' ? copy.preparing : copy.preparingEn;

  useEffect(() => {
    if (ready) {
      setProgress(1);
      return;
    }
    setPhase('loading');
    setProgress(0.22);
    const t1 = setTimeout(() => setProgress(0.48), 280);
    const t2 = setTimeout(() => setProgress(0.72), 650);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [ready]);

  useEffect(() => {
    if (phase !== 'welcome' || exiting) return;
    pulse.value = 1;
    pulse.value = withRepeat(
      withTiming(0.35, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [phase, exiting, pulse]);

  useEffect(() => {
    if (!iconActive) {
      cancelAnimation(idle);
      cancelAnimation(glow);
      idle.value = withTiming(1, { duration: 160 });
      glow.value = withTiming(0.4, { duration: 160 });
      return;
    }
    idle.value = 1;
    idle.value = withRepeat(
      withTiming(1.045, { duration: IDLE_DURATION, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    glow.value = 0.55;
    glow.value = withRepeat(
      withTiming(1, { duration: GLOW_DURATION, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [iconActive, idle, glow]);

  const welcomeStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  const exitStyle = useAnimatedStyle(() => ({
    opacity: exitOpacity.value,
    transform: [{ scale: exitScale.value }],
  }));

  const iconIdleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: idle.value }],
  }));

  const glowHaloStyle = useAnimatedStyle(() => ({
    opacity: 0.1 + glow.value * 0.14,
    transform: [{ scale: 0.92 + glow.value * 0.14 }],
  }));

  const handleFilled = useCallback(() => {
    setPhase('welcome');
  }, []);

  const finishEnter = useCallback(() => {
    onEnter?.();
  }, [onEnter]);

  const handleEnterPress = useCallback(() => {
    if (phase !== 'welcome' || exiting) return;
    setExiting(true);
    pulse.value = withTiming(1, { duration: 80 });
    exitOpacity.value = withTiming(0, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    });
    exitScale.value = withTiming(
      0.96,
      { duration: 320, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishEnter)();
      },
    );
  }, [phase, exiting, pulse, exitOpacity, exitScale, finishEnter]);

  const content = (
    <Animated.View style={[styles.exitLayer, exitStyle]}>
      <SoftBackdrop />
      <View style={styles.center} pointerEvents="none">
        <View
          style={[
            styles.iconStage,
            {
              width: Math.round(iconSize * 1.7),
              height: Math.round(iconSize * 1.7),
            },
          ]}
        >
          {Array.from({ length: RING_COUNT }, (_, index) => (
            <SoftGlowRing
              key={index}
              diameter={iconSize}
              delayMs={index * RING_STAGGER}
              active={iconActive}
            />
          ))}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glowHalo,
              {
                width: Math.round(iconSize * 1.35),
                height: Math.round(iconSize * 1.35),
                borderRadius: Math.round(iconSize * 1.35) / 2,
              },
              glowHaloStyle,
            ]}
          />
          <Animated.View
            style={[
              styles.iconCircle,
              {
                width: iconSize,
                height: iconSize,
                borderRadius: iconSize / 2,
              },
              iconIdleStyle,
            ]}
          >
            <MobileNestykLogo variant="mark" height={logoSize} />
          </Animated.View>
        </View>
        <MobileNestykLogo
          variant="wordmark"
          height={compact ? 44 : 52}
          style={[styles.wordmark, compact && styles.wordmarkCompact]}
        />

        <View style={[styles.messageSlot, compact && styles.messageSlotCompact]}>
          <Text
            style={
              phase === 'loading'
                ? styles.primary
                : [styles.welcomeTitle, compact && styles.welcomeTitleCompact]
            }
          >
            {phase === 'loading' ? primary : copy.welcome}
          </Text>
          <Text
            style={[
              styles.secondary,
              compact && styles.secondaryCompact,
              phase === 'welcome' && styles.slotHidden,
            ]}
          >
            {secondary}
          </Text>
        </View>

        <View style={styles.smileWrap}>
          <MobileSmileProgress
            progress={progress}
            size="lg"
            gradientId="preloadSmileGlow"
            onFilled={ready ? handleFilled : undefined}
          />
        </View>

        <View style={[styles.hintSlot, compact && styles.hintSlotCompact]}>
          <Animated.Text
            style={[
              styles.tapHint,
              phase === 'welcome' ? welcomeStyle : styles.slotHidden,
            ]}
          >
            {copy.tapToEnter}
          </Animated.Text>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <Pressable
      style={styles.root}
      onPress={phase === 'welcome' && !exiting ? handleEnterPress : undefined}
      disabled={phase !== 'welcome' || exiting}
      accessibilityRole={phase === 'welcome' ? 'button' : undefined}
      accessibilityLabel={phase === 'welcome' ? copy.tapToEnter : primary}
      accessibilityLiveRegion="polite"
      accessibilityViewIsModal
    >
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 100,
    elevation: 100,
  },
  exitLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconStage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  softRing: {
    position: 'absolute',
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  glowHalo: {
    position: 'absolute',
    backgroundColor: BRAND,
    ...Platform.select({
      ios: {
        shadowColor: BRAND,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 28,
      },
      android: {
        elevation: 8,
      },
      default: {},
    }),
  },
  iconCircle: {
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 1,
    ...Platform.select({
      ios: {
        shadowColor: BRAND,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.42,
        shadowRadius: 22,
      },
      android: {
        elevation: 12,
      },
      default: {},
    }),
  },
  wordmark: {
    marginTop: 10,
    marginBottom: 32,
  },
  wordmarkCompact: {
    marginTop: 6,
    marginBottom: 24,
  },
  primary: {
    fontFamily: tokens.typography.native.body,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '600',
    color: INK,
    textAlign: 'center',
  },
  welcomeTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 26,
    lineHeight: 39,
    fontWeight: '600',
    color: INK,
    textAlign: 'center',
  },
  welcomeTitleCompact: {
    fontSize: 24,
    lineHeight: 36,
  },
  secondary: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  secondaryCompact: {},
  messageSlot: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 39 + 6 + 21,
    marginBottom: 28,
    width: '100%',
  },
  messageSlotCompact: {
    minHeight: 36 + 6 + 21,
    marginBottom: 20,
  },
  slotHidden: {
    opacity: 0,
  },
  smileWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  hintSlot: {
    minHeight: 21,
    marginTop: 28,
    paddingTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintSlotCompact: {
    marginTop: 22,
    paddingTop: 6,
  },
  tapHint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: BRAND,
    textAlign: 'center',
  },
  cornerText: {
    position: 'absolute',
    fontFamily: tokens.typography.native.body,
    fontSize: 8,
    lineHeight: 12,
    letterSpacing: 1.1,
    color: '#CBD5E1',
    fontWeight: '600',
  },
});
