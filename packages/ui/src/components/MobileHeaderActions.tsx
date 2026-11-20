import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { UserRole } from '@nestyk/types';
import { MobileIcon } from '../icons/MobileIcon';
import { MobileProfileAvatar } from './MobileProfileAvatar';
import { tokens } from '../theme/tokens';
import { useMobileTheme } from '../theme/ThemeContext';

export interface MobileHeaderActionsProps {
  initials?: string;
  /** Current role: colours of the own avatar (role identity, as on the web). */
  role?: UserRole;
  /** When false, show outline user icon instead of profile avatar. */
  isAuthenticated?: boolean;
  notificationCount?: number;
  onAvatarPress?: () => void;
  onNotificationsPress?: () => void;
  onThemeToggle?: () => void;
}

export const MobileHeaderActions: React.FC<MobileHeaderActionsProps> = ({
  initials = 'JD',
  role,
  isAuthenticated = true,
  notificationCount = 0,
  onAvatarPress,
  onNotificationsPress,
  onThemeToggle,
}) => {
  const { theme } = useMobileTheme();

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={onAvatarPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={isAuthenticated ? undefined : 'Sign in'}
      >
        {isAuthenticated ? (
          <MobileProfileAvatar initials={initials} size="sm" role={role} />
        ) : (
          <View style={[styles.guestAvatar, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <MobileIcon name="user" size={20} color={theme.textSecondary} />
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.actions}>
        {onThemeToggle ? (
          <TouchableOpacity style={styles.iconBtn} onPress={onThemeToggle} activeOpacity={0.7}>
            <MobileIcon name="moon" size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.iconBtn} onPress={onNotificationsPress} activeOpacity={0.7}>
          <MobileIcon name="bell" size={22} color={theme.textSecondary} />
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
    justifyContent: 'space-between',
    width: '100%',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guestAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    backgroundColor: tokens.colors.accent,
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
