import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useLocale } from '@nestyk/i18n';
import { MobileIcon } from '../icons/MobileIcon';
import { MobileNestykLogo } from './MobileNestykLogo';
import { useMobileTheme } from '../theme/ThemeContext';
import { tokens } from '../theme/tokens';
import { ExtendedTabRole, getTabsForRole } from '../config/mobileTabMatrix';
import { AppIconName } from '../icons/types';
import { getCardElevation } from '../theme/elevation';

const { boxShadow: _webShadow, ...floatingShadow } = getCardElevation(3);

export type MobileAppTab =
  | 'home'
  | 'search'
  | 'living'
  | 'bills'
  | 'dashboard'
  | 'listings'
  | 'listingRoom'
  | 'createListing'
  | 'listingLead'
  | 'createLead'
  | 'leadDetail'
  | 'leadInfo'
  | 'leadRoom'
  | 'clients'
  | 'more'
  | 'contact'
  | 'contracts'
  | 'calendar'
  | 'income'
  | 'deals'
  | 'tickets'
  | 'services'
  | 'menu';

export interface MobileBottomTabBarProps {
  activeRole: ExtendedTabRole;
  activeTab: MobileAppTab;
  onTabPress: (tab: MobileAppTab) => void;
  /** Active icon/label tint when `indicatorColor` is unset (legacy role-accent mode). */
  accentColor?: string;
  /**
   * Active icon/label tint when using brand underline mode (e.g. Agent Overview).
   * Defaults to theme.screenTitle / ink.
   */
  activeTintColor?: string;
  /** Brand underline under the active tab (Agent design). */
  indicatorColor?: string;
  /**
   * `floating` (default): capsule above the home indicator, for `MobileModePage` `tabBar`.
   * `docked`: full-width bar with a top border, for a plain `bottomBar` slot.
   */
  variant?: 'floating' | 'docked';
}

/** Shared slot so every tab label sits on the same baseline */
const ICON_SLOT = 24;
const ICON_SIZE = 22;
const SERVICES_LOGO_SIZE = 22;

function ServicesTabIcon({
  isActive,
  tintColor,
}: {
  isActive: boolean;
  tintColor: string;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(isActive ? 1.06 : 1, {
      damping: 14,
      stiffness: 200,
      mass: 0.6,
    });
  }, [isActive, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: isActive ? 1 : 0.88,
  }));

  return (
    <View style={styles.iconSlot}>
      <Animated.View
        style={[
          styles.servicesIconWrap,
          isActive && { backgroundColor: `${tintColor}18` },
          animStyle,
        ]}
      >
        <MobileNestykLogo variant="markSecondary" height={SERVICES_LOGO_SIZE} />
      </Animated.View>
    </View>
  );
}

function RegularTabIcon({
  name,
  isActive,
  activeColor,
  mutedColor,
}: {
  name: AppIconName;
  isActive: boolean;
  activeColor: string;
  mutedColor: string;
}) {
  return (
    <View style={styles.iconSlot}>
      <MobileIcon
        name={name}
        size={ICON_SIZE}
        color={isActive ? activeColor : mutedColor}
        weight={isActive ? 'bold' : 'regular'}
      />
    </View>
  );
}

export const MobileBottomTabBar: React.FC<MobileBottomTabBarProps> = ({
  activeRole,
  activeTab,
  onTabPress,
  accentColor = tokens.colors.accent,
  activeTintColor,
  indicatorColor,
  variant = 'floating',
}) => {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const tabs = getTabsForRole(activeRole);
  const useUnderline = Boolean(indicatorColor);
  const resolvedActive = useUnderline
    ? activeTintColor || theme.screenTitle || tokens.colors.primary
    : accentColor;
  const floating = variant === 'floating';

  return (
    <View
      accessibilityRole="tablist"
      style={
        floating
          ? [styles.floating, floatingShadow, { backgroundColor: theme.surface, borderColor: theme.border }]
          : [styles.container, { backgroundColor: theme.surface, borderTopColor: theme.border }]
      }
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const label = t.mobile.tabs[tab.key];
        const isServices = tab.key === 'services';
        return (
          <Pressable
            key={tab.key}
            style={({ pressed }) => [styles.tabItem, pressed && Platform.OS === 'ios' ? styles.pressed : null]}
            onPress={() => onTabPress(tab.key)}
            android_ripple={{ color: 'rgba(33,30,30,0.08)', borderless: true, radius: 32 }}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
          >
            {isServices ? (
              <ServicesTabIcon isActive={isActive} tintColor={resolvedActive} />
            ) : (
              <RegularTabIcon
                name={tab.icon}
                isActive={isActive}
                activeColor={resolvedActive}
                mutedColor={theme.textSecondary}
              />
            )}
            <Text
              style={[
                styles.tabLabel,
                isActive
                  ? { color: resolvedActive, fontWeight: '600' }
                  : { color: theme.textSecondary },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
            {useUnderline ? (
              <View
                style={[
                  styles.indicator,
                  {
                    backgroundColor: isActive ? indicatorColor : 'transparent',
                  },
                ]}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 4,
    paddingBottom: 2,
    paddingHorizontal: 4,
  },
  floating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    minHeight: 64,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.7 },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 2,
    minHeight: 48,
    minWidth: 0,
  },
  iconSlot: {
    width: ICON_SLOT,
    height: ICON_SLOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servicesIconWrap: {
    width: SERVICES_LOGO_SIZE,
    height: SERVICES_LOGO_SIZE,
    borderRadius: 6,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '400',
  },
  indicator: {
    marginTop: 0,
    height: 3,
    width: 22,
    borderRadius: 2,
  },
});
