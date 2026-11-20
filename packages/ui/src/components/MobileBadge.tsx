import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { UserRole } from '@nestyk/types';
import { roleTileColors, tokens } from '../theme/tokens';
import { useMobileTheme } from '../theme/ThemeContext';

export interface MobileBadgeProps {
  role?: UserRole | 'services';
  label?: string;
  variant?: 'solid' | 'subtle';
  children?: React.ReactNode;
  style?: ViewStyle;
}

export const MobileBadge: React.FC<MobileBadgeProps> = ({
  role = 'guest',
  label,
  variant = 'subtle',
  children,
  style,
}) => {
  const { isDark } = useMobileTheme();
  const roleColor = tokens.colors.roles[role] || tokens.colors.brand[500];
  // Subtle badge = the role chip of the web (Mos 20 Nov 2026): role identity tile, text and ring.
  const tile = roleTileColors(role, isDark);

  const badgeStyle: ViewStyle = {
    paddingVertical: variant === 'solid' ? 3 : 2,
    paddingHorizontal: variant === 'solid' ? 8 : 7,
    borderRadius: 12,
    alignSelf: 'flex-start',
    backgroundColor: variant === 'solid' ? roleColor : tile.bg,
    borderWidth: variant === 'solid' ? 0 : 1,
    borderColor: tile.ring,
  };

  return (
    <View style={[badgeStyle, style]}>
      <Text
        style={{
          fontFamily: tokens.typography.native.headingTh,
          fontSize: 12,
          lineHeight: 18,
          fontWeight: '500',
          color: variant === 'solid' ? (role === 'guest' ? tokens.colors.primary : '#FFFFFF') : tile.fg,
        }}
      >
        {label || (typeof children === 'string' ? children : '')}
      </Text>
    </View>
  );
};
