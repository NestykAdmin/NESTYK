import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  RefreshControl,
  Platform,
  Keyboard,
  findNodeHandle,
  UIManager,
  type View as RNView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { UserRole } from '@nestyk/types';
import { useMobileTheme } from '../theme/ThemeContext';
import { tokens } from '../theme/tokens';

export type ModePageScrollApi = {
  scrollTo: (options?: { y?: number; animated?: boolean }) => void;
  scrollToView: (
    target: React.RefObject<RNView | null> | RNView | null,
    options?: { offset?: number; animated?: boolean },
  ) => void;
  /** Called when the page is scrolled near its end (infinite lists). Returns an unsubscribe. */
  onEndReached: (handler: () => void) => () => void;
};

/** Distance from the bottom (px) that counts as "near the end". */
const END_REACHED_THRESHOLD = 480;
/** Scroll travel (px) in one direction before the floating tab bar hides / returns; ignores finger jitter. */
const TAB_BAR_SCROLL_SLOP = 12;
const TAB_BAR_SLIDE_MS = 200;

export const ModePageScrollContext = React.createContext<ModePageScrollApi | null>(null);

export interface MobileModePageProps {
  role?: UserRole | 'services';
  screenTitle?: string;
  header?: React.ReactNode;
  children: React.ReactNode;
  /** Docked full-width bar (action bars, edit bars). Takes the place of `tabBar` when both are set. */
  bottomBar?: React.ReactNode;
  /** Floating tab bar (`MobileBottomTabBar`): overlays the content above the home indicator; the page pads its end. */
  tabBar?: React.ReactNode;
  scrollable?: boolean;
  /** Pull-to-refresh via layout template — enable on all scrollable ModePages (not wizards). */
  refreshing?: boolean;
  onRefresh?: () => void;
}

export const MobileModePage: React.FC<MobileModePageProps> = ({
  screenTitle,
  header,
  children,
  bottomBar,
  tabBar,
  scrollable = true,
  refreshing = false,
  onRefresh,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useMobileTheme();
  const [tabBarHeight, setTabBarHeight] = useState(64);
  const showTabBar = Boolean(tabBar) && !bottomBar;
  const tabBarBottom = Math.max(insets.bottom, 12);
  /** Room the floating tab bar takes over the end of the content. */
  const tabBarSpace = showTabBar ? tabBarHeight + tabBarBottom + 16 : 0;

  // Floating tab bar slides away while scrolling down or typing; 0 = shown, 1 = hidden.
  const scrollHide = useSharedValue(0);
  const scrollHideTarget = useSharedValue(0);
  const keyboardHide = useSharedValue(0);
  const scrollTravel = useSharedValue(0);
  const lastScrollY = useSharedValue(0);
  const tabBarHideDistance = useSharedValue(tabBarSpace + 24);
  useEffect(() => {
    tabBarHideDistance.value = tabBarSpace + 24;
  }, [tabBarSpace, tabBarHideDistance]);
  const revealTabBar = useCallback(() => {
    scrollTravel.value = 0;
    if (scrollHideTarget.value === 0) return;
    scrollHideTarget.value = 0;
    scrollHide.value = withTiming(0, { duration: TAB_BAR_SLIDE_MS });
  }, [scrollHide, scrollHideTarget, scrollTravel]);
  useEffect(() => {
    if (showTabBar) revealTabBar();
  }, [showTabBar, revealTabBar]);
  useEffect(() => {
    if (!showTabBar) return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, () => {
      keyboardHide.value = withTiming(1, { duration: TAB_BAR_SLIDE_MS });
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      keyboardHide.value = withTiming(0, { duration: TAB_BAR_SLIDE_MS });
    });
    return () => {
      onShow.remove();
      onHide.remove();
      keyboardHide.value = 0;
    };
  }, [showTabBar, keyboardHide]);
  const tabBarSlideStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: Math.max(scrollHide.value, keyboardHide.value) * tabBarHideDistance.value },
    ],
  }));

  const floatingTabBar = showTabBar ? (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.floatingTabBar, { bottom: tabBarBottom }, tabBarSlideStyle]}
      onLayout={(e) => setTabBarHeight(Math.round(e.nativeEvent.layout.height))}
    >
      {tabBar}
    </Animated.View>
  ) : null;
  const scrollY = useSharedValue(0);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const endHandlerRef = useRef<(() => void) | null>(null);
  const viewportHeight = useRef(0);
  const contentHeight = useRef(0);
  const nearEnd = useSharedValue(false);

  const fireEndReached = useCallback(() => endHandlerRef.current?.(), []);
  // Content that grows (or starts) short of the viewport never scrolls, so re-check on size changes.
  const checkNearEnd = useCallback(() => {
    if (!viewportHeight.current || !contentHeight.current) return;
    if (scrollY.value + viewportHeight.current >= contentHeight.current - END_REACHED_THRESHOLD) {
      fireEndReached();
    }
  }, [fireEndReached, scrollY]);

  const scrollApi = useMemo<ModePageScrollApi>(
    () => ({
      scrollTo: (options) => {
        scrollRef.current?.scrollTo({
          y: options?.y ?? 0,
          animated: options?.animated ?? true,
        });
      },
      scrollToView: (target, options) => {
        const node =
          target && 'current' in (target as object)
            ? (target as React.RefObject<RNView | null>).current
            : (target as RNView | null);
        const scrollNode = findNodeHandle(scrollRef.current);
        const targetNode = findNodeHandle(node);
        if (!scrollNode || !targetNode) return;
        UIManager.measureLayout(
          targetNode,
          scrollNode,
          () => undefined,
          (_x, y) => {
            scrollRef.current?.scrollTo({
              y: Math.max(0, y - (options?.offset ?? 12)),
              animated: options?.animated ?? true,
            });
          },
        );
      },
      onEndReached: (handler) => {
        endHandlerRef.current = handler;
        return () => {
          if (endHandlerRef.current === handler) endHandlerRef.current = null;
        };
      },
    }),
    [],
  );

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      scrollY.value = y;
      const near =
        y + event.layoutMeasurement.height >=
        event.contentSize.height - END_REACHED_THRESHOLD;
      if (near !== nearEnd.value) {
        nearEnd.value = near;
        if (near) runOnJS(fireEndReached)();
      }

      // Top of the page or the very end: always show the bar so the menu is never lost.
      const atEdge = y <= 0 || y + event.layoutMeasurement.height >= event.contentSize.height - 8;
      const delta = y - lastScrollY.value;
      lastScrollY.value = y;
      let target = scrollHideTarget.value;
      if (atEdge) {
        scrollTravel.value = 0;
        target = 0;
      } else {
        scrollTravel.value =
          delta > 0 ? Math.max(0, scrollTravel.value) + delta : Math.min(0, scrollTravel.value) + delta;
        if (scrollTravel.value > TAB_BAR_SCROLL_SLOP) target = 1;
        else if (scrollTravel.value < -TAB_BAR_SCROLL_SLOP) target = 0;
      }
      if (target !== scrollHideTarget.value) {
        scrollHideTarget.value = target;
        scrollHide.value = withTiming(target, { duration: TAB_BAR_SLIDE_MS });
      }
    },
  });

  const headerBorderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 40], [0.12, 1], Extrapolation.CLAMP),
  }));

  const headerShadowStyle = useAnimatedStyle(() => {
    const elevation = interpolate(scrollY.value, [0, 48], [0, 3], Extrapolation.CLAMP);
    return {
      shadowOpacity: interpolate(scrollY.value, [0, 48], [0, 0.08], Extrapolation.CLAMP),
      shadowRadius: interpolate(scrollY.value, [0, 48], [0, 8], Extrapolation.CLAMP),
      elevation: Platform.OS === 'android' ? elevation : 0,
    };
  });

  const headerBlock = (
    <View
      style={[
        styles.headerInner,
        {
          paddingTop: Math.max(insets.top, 8),
        },
      ]}
    >
      {header}
      {screenTitle ? (
        <Text style={[styles.screenTitle, { color: theme.screenTitle }]}>{screenTitle}</Text>
      ) : null}
    </View>
  );

  if (!scrollable) {
    return (
      <ModePageScrollContext.Provider value={null}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.header} />
        <View
          style={[
            styles.headerSolid,
            {
              paddingTop: Math.max(insets.top, 8),
              backgroundColor: theme.header,
              borderBottomColor: theme.border,
            },
          ]}
        >
          {header}
          {screenTitle ? (
            <Text style={[styles.screenTitle, { color: theme.screenTitle }]}>{screenTitle}</Text>
          ) : null}
        </View>
        <View
          style={[
            styles.body,
            { backgroundColor: theme.background, paddingBottom: bottomBar ? 0 : showTabBar ? tabBarHeight + tabBarBottom : insets.bottom },
          ]}
        >
          <View style={styles.bodyFill}>{children}</View>
        </View>
        {bottomBar ? (
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: theme.surface }]}>{bottomBar}</View>
        ) : null}
        {floatingTabBar}
      </View>
      </ModePageScrollContext.Provider>
    );
  }

  return (
    <ModePageScrollContext.Provider value={scrollApi}>
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBarStyle} translucent backgroundColor="transparent" />

      {/* Outside the scroll viewport: native refresh always appears below the header. */}
      <Animated.View
        style={[
          styles.headerOverlay,
          headerShadowStyle,
          { backgroundColor: theme.header, shadowColor: '#000', shadowOffset: { width: 0, height: 2 } },
        ]}
      >
        {headerBlock}
        <Animated.View
          pointerEvents="none"
          style={[styles.headerBorder, headerBorderStyle, { backgroundColor: theme.border }]}
        />
      </Animated.View>

      <View style={[styles.body, { backgroundColor: theme.background }]}>
        <Animated.ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: 8, paddingBottom: bottomBar ? 16 : tabBarSpace || 16 + insets.bottom },
          ]}
          contentInsetAdjustmentBehavior="never"
          alwaysBounceVertical={Boolean(onRefresh)}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
          onLayout={(e) => {
            viewportHeight.current = e.nativeEvent.layout.height;
            checkNearEnd();
          }}
          onContentSizeChange={(_w, h) => {
            contentHeight.current = h;
            checkNearEnd();
            // A page that no longer scrolls (e.g. a shorter tab) can't scroll the bar back in.
            if (viewportHeight.current && h <= viewportHeight.current + 8) revealTabBar();
          }}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={tokens.colors.primary}
                colors={[tokens.colors.brand[700]]}
                progressBackgroundColor={theme.surface}
              />
            ) : undefined
          }
        >
          {children}
        </Animated.ScrollView>
      </View>

      {bottomBar ? (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: theme.surface }]}>
          {bottomBar}
        </View>
      ) : null}
      {floatingTabBar}
    </View>
    </ModePageScrollContext.Provider>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerOverlay: {
    flexShrink: 0,
    zIndex: 20,
  },
  headerInner: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerSolid: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerBorder: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  screenTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 26,
    lineHeight: 39,
    fontWeight: '500',
    marginTop: 12,
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexGrow: 1,
  },
  bodyFill: {
    flex: 1,
    minHeight: 0,
    padding: 16,
  },
  bottomBar: {},
  floatingTabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 30,
  },
});
