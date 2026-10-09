import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
  BackHandler,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMobileTheme } from '../theme/ThemeContext';
import { tokens } from '../theme/tokens';

const SHEET_EASE = Easing.out(Easing.cubic);

export interface MobileBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Sheet max height — default 85%. */
  maxHeight?: number | `${number}%`;
  /** Extra style for the sheet panel. */
  sheetStyle?: ViewStyle;
  /** Show the drag handle (default true); dragging it down closes the sheet. */
  showHandle?: boolean;
  /** Dimmed backdrop press closes (default true). */
  closeOnBackdropPress?: boolean;
  testID?: string;
  avoidKeyboard?: boolean;
}

/**
 * Bottom sheet with correct motion: scrim fades in place, panel slides up.
 * Never use Modal `animationType="slide"` for sheets — it animates the overlay too.
 */
export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  visible,
  onClose,
  children,
  maxHeight = '85%',
  sheetStyle,
  showHandle = true,
  closeOnBackdropPress = true,
  testID,
  avoidKeyboard = false,
}) => {
  const { theme } = useMobileTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const hiddenY = Math.min(windowHeight * 0.7, 640);

  const [mounted, setMounted] = useState(false);
  const scrimOpacity = useSharedValue(0);
  const translateY = useSharedValue(hiddenY);
  const sheetHeight = useSharedValue(hiddenY);

  const finishUnmount = useCallback(() => {
    setMounted(false);
  }, []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = hiddenY;
      scrimOpacity.value = 0;
      scrimOpacity.value = withTiming(1, { duration: 200 });
      translateY.value = withTiming(0, { duration: 280, easing: SHEET_EASE });
      return;
    }
    if (!mounted) return;
    scrimOpacity.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(
      Math.max(hiddenY, sheetHeight.value, translateY.value),
      { duration: 240, easing: SHEET_EASE },
      (finished) => {
        if (finished) runOnJS(finishUnmount)();
      },
    );
  }, [visible, mounted, hiddenY, scrimOpacity, translateY, sheetHeight, finishUnmount]);

  useEffect(() => {
    if (!mounted || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [mounted, onClose]);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Only the handle strip drags: sheet bodies often hold their own scroll views.
  const dragGesture = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onUpdate((event) => {
      'worklet';
      const next = Math.max(0, event.translationY);
      translateY.value = next;
      scrimOpacity.value = 1 - Math.min(1, next / Math.max(sheetHeight.value, 1));
    })
    .onEnd((event) => {
      'worklet';
      if (translateY.value > sheetHeight.value * 0.3 || event.velocityY > 800) {
        runOnJS(onClose)();
      } else {
        translateY.value = withTiming(0, { duration: 200, easing: SHEET_EASE });
        scrimOpacity.value = withTiming(1, { duration: 150 });
      }
    });

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} testID={testID}>
      <GestureHandlerRootView style={styles.root}>
        <KeyboardAvoidingView style={styles.root} pointerEvents="box-none" enabled={avoidKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, scrimStyle, { backgroundColor: theme.overlay }]}
          />
          {closeOnBackdropPress ? (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            />
          ) : null}
          <Animated.View
            style={[
              styles.sheet,
              panelStyle,
              {
                backgroundColor: theme.card,
                paddingBottom: Math.max(insets.bottom, 16),
                maxHeight,
              },
              sheetStyle,
            ]}
            accessibilityViewIsModal
            onLayout={(e) => {
              sheetHeight.value = e.nativeEvent.layout.height;
            }}
          >
            {showHandle ? (
              <GestureDetector gesture={dragGesture}>
                <View style={styles.handleZone}>
                  <View style={[styles.handle, { backgroundColor: theme.border }]} />
                </View>
              </GestureDetector>
            ) : null}
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    overflow: 'hidden',
  },
  // Full-width touch strip around the handle; negative margin keeps the visual spacing unchanged.
  handleZone: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: -10,
    paddingTop: 10,
    paddingBottom: 18,
    marginBottom: -10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.border,
  },
});
