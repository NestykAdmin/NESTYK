import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { ButtonVariant, tokens } from '../theme/tokens';

export interface MobileButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  isLoading?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: TextStyle;
  disabled?: boolean;
}

export const MobileButton: React.FC<MobileButtonProps> = ({
  children,
  variant = 'primary',
  isLoading = false,
  onPress,
  style,
  textStyle,
  disabled,
}) => {
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'secondary' || variant === 'outline';

  const containerStyle: ViewStyle = {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isPrimary
      ? disabled
        ? '#FFF9E8'
        : tokens.colors.brand[500]
      : isOutline
      ? '#FFFFFF'
      : 'transparent',
    borderWidth: isOutline ? 1 : 0,
    borderColor: isOutline ? tokens.colors.brand[500] : 'transparent',
    opacity: disabled ? 0.6 : 1,
  };

  const labelStyle: TextStyle = {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 14,
    lineHeight: 21, // 1.5x Typography Safety
    fontWeight: '500',
    color: isPrimary
      ? disabled
        ? '#CBD5E1'
        : tokens.colors.primary
      : isOutline
      ? tokens.colors.primary
      : tokens.colors.textSecondary,
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || isLoading), busy: isLoading }}
      style={[containerStyle, style]}
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.7}
    >
      {isLoading ? (
        <ActivityIndicator color={tokens.colors.primary} size="small" />
      ) : React.isValidElement(children) ? (
        children
      ) : (
        <Text style={[labelStyle, textStyle]}>{children}</Text>
      )}
    </TouchableOpacity>
  );
};
