import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { UserRole } from '@nestyk/types';
import { roleOnDark, tokens } from '../theme/tokens';
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

  const badgeStyle: ViewStyle = {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
    backgroundColor: variant === 'solid' ? roleColor : `${roleColor}18`,
  };

  return (
    <View style={[badgeStyle, style]}>
      <Text
        style={{
          fontFamily: tokens.typography.native.headingTh,
          fontSize: 12,
          lineHeight: 18,
          fontWeight: '500',
          color: variant === 'solid' ? (role === 'guest' ? tokens.colors.primary : '#FFFFFF') : roleOnDark(roleColor, isDark),
        }}
      >
        {label || (typeof children === 'string' ? children : '')}
      </Text>
    </View>
  );
};
