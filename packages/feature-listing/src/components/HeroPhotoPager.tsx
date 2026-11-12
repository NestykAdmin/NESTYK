import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { tokens } from '@nestyk/ui/native';

const MAX_SLOTS = 5;
const DOT = 7;
const PILL_W = 22;
const ANIM_MS = 220;

function windowStart(index: number, total: number, slots: number) {
  if (total <= slots) return 0;
  const mid = Math.floor(slots / 2);
  return Math.min(Math.max(0, index - mid), total - slots);
}

function PagerSlot({ active }: { active: boolean }) {
  const width = useSharedValue(active ? PILL_W : DOT);
  const tone = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    width.value = withTiming(active ? PILL_W : DOT, { duration: ANIM_MS });
    tone.value = withTiming(active ? 1 : 0, { duration: ANIM_MS });
  }, [active, tone, width]);

  const style = useAnimatedStyle(() => ({
    width: width.value,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: interpolateColor(tone.value, [0, 1], ['#FFFFFF', tokens.colors.brand[500]]),
  }));

  return <Animated.View style={style} />;
}

export function HeroPhotoPager({
  index,
  total,
  bottom,
}: {
  index: number;
  total: number;
  /** Distance from the hero's bottom edge; defaults to clearing the overlapping summary card. */
  bottom?: number;
}) {
  const slotCount = Math.min(MAX_SLOTS, Math.max(total, 0));
  const start = useMemo(
    () => windowStart(index, total, slotCount),
    [index, total, slotCount],
  );
  const activeSlot = Math.min(Math.max(index - start, 0), Math.max(slotCount - 1, 0));

  if (total <= 1) return null;

  return (
    <View style={[styles.wrap, bottom != null && { bottom }]} pointerEvents="none">
      <View style={styles.slots}>
        {Array.from({ length: slotCount }, (_, slot) => (
          <PagerSlot key={slot} active={slot === activeSlot} />
        ))}
      </View>
      <View style={styles.countPill}>
        <Text style={styles.countText}>
          {index + 1}/{total}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Sit above the overlapping summary card (marginTop: -28).
    bottom: 40,
    height: 28,
    justifyContent: 'center',
  },
  slots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  countPill: {
    position: 'absolute',
    right: 12,
    bottom: 0,
    backgroundColor: 'rgba(33,30,30,0.72)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
