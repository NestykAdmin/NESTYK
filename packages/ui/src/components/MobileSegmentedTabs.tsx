import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { tokens } from '../theme/tokens';
import { useMobileTheme } from '../theme/ThemeContext';

export type MobileSegmentedTab<K extends string> = {
  key: K;
  label: string;
  /** Shown after the label; `null` hides it, a string (e.g. "–") stands in while loading. */
  count?: number | string | null;
};

const PAD = 4;
const SLIDE_MS = 200;

/**
 * Two-to-four equal segments switching views of one screen (e.g. "To do" / "All").
 * The selected segment is a brand-yellow block that slides between positions.
 */
export function MobileSegmentedTabs<K extends string>({
  tabs,
  value,
  onChange,
  style,
}: {
  tabs: MobileSegmentedTab<K>[];
  value: K;
  onChange: (key: K) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useMobileTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(
    tabs.findIndex((tab) => tab.key === value),
    0,
  );
  const segment = width > 0 ? (width - PAD * 2) / tabs.length : 0;
  const offset = useSharedValue(0);

  useEffect(() => {
    offset.value = withTiming(index * segment, { duration: SLIDE_MS });
  }, [index, segment, offset]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: theme.surface, borderColor: theme.border }, style]}
    >
      {segment > 0 ? <Animated.View pointerEvents="none" style={[styles.indicator, { width: segment }, indicator]} /> : null}
      {tabs.map((tab) => {
        const selected = tab.key === value;
        const ink = selected ? tokens.colors.onBrand : theme.textHeading;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.count == null ? tab.label : `${tab.label} ${tab.count}`}
            android_ripple={{ color: 'rgba(33,30,30,0.08)', borderless: false }}
            style={({ pressed }) => [styles.segment, pressed && !selected ? styles.pressed : null]}
          >
            <Text style={[styles.label, { color: ink }]} numberOfLines={1}>
              {tab.label}
            </Text>
            {tab.count != null ? (
              <Text style={[styles.count, { color: selected ? ink : theme.textSecondary }]}>{tab.count}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    padding: PAD,
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: 10,
    backgroundColor: tokens.colors.brand[500],
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.7 },
  label: { fontFamily: tokens.typography.native.bodyBold, fontSize: 14, lineHeight: 21 },
  count: { fontFamily: tokens.typography.native.bodyBold, fontSize: 14, lineHeight: 21 },
});
