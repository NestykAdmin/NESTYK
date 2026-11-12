import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MobileIcon } from '../icons/MobileIcon';
import { MobileNestykLogo } from './MobileNestykLogo';
import { roleOnDark, tokens } from '../theme/tokens';
import { useMobileTheme } from '../theme/ThemeContext';

export interface MobileWorkspaceHeaderProps {
  workspaceLabel: string;
  /** Agent rose / role accent for the thin status rule */
  accentColor?: string;
  notificationCount?: number;
  /** Opens profile drawer (hamburger). */
  onMenuPress?: () => void;
  onNotificationsPress?: () => void;
}

/**
 * Persistent top shell for Agent (and later Owner) workspace:
 * menu · logo + passive role label · notifications.
 * Profile / role switching stays in the drawer — opened via menu.
 */
export const MobileWorkspaceHeader: React.FC<MobileWorkspaceHeaderProps> = ({
  workspaceLabel,
  accentColor = tokens.colors.roles.agent,
  notificationCount = 0,
  onMenuPress,
  onNotificationsPress,
}) => {
  const { theme, isDark } = useMobileTheme();

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.iconBtn}
        onPress={onMenuPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Menu"
      >
        <MobileIcon name="menu" size={22} color={theme.screenTitle || tokens.colors.primary} />
      </TouchableOpacity>

      <View style={styles.brandBlock} accessibilityRole="header">
        <View style={styles.primaryLine}>
          <MobileNestykLogo variant={isDark ? 'wordmarkOnDark' : 'wordmark'} height={24} />
        </View>
        <View style={styles.workspaceRow}>
          <View style={[styles.rule, { backgroundColor: roleOnDark(accentColor, isDark) }]} />
          <Text
            style={[styles.workspaceLabel, { color: theme.screenTitle || tokens.colors.primary }]}
            numberOfLines={1}
            accessibilityRole="text"
          >
            {workspaceLabel}
          </Text>
        </View>
      </View>

      <View style={styles.trailingSlot}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onNotificationsPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <MobileIcon name="bell" size={22} color={theme.screenTitle || tokens.colors.primary} />
          {notificationCount > 0 ? (
            <View style={[styles.badge, { borderColor: theme.card }]}>
              <Text style={styles.badgeText}>{notificationCount > 9 ? '9+' : notificationCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 52,
    gap: 8,
  },
  brandBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    justifyContent: 'center',
  },
  primaryLine: {
    height: 24,
    justifyContent: 'center',
  },
  workspaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 18,
  },
  rule: {
    width: 2,
    height: 12,
    borderRadius: 1,
  },
  workspaceLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  trailingSlot: {
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: tokens.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
  },
  badgeText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 12,
  },
});
