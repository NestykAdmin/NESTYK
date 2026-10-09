import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { tokens } from '../theme/tokens';
import { useMobileTheme } from '../theme/ThemeContext';

export type MobileActionSheetItem = {
  key: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  loading?: boolean;
};

export type MobileActionSheetBodyProps = {
  title?: string;
  actions: MobileActionSheetItem[];
  /** Optional muted cancel row; sheets close by drag-down or backdrop tap, so most menus omit it. */
  cancelLabel?: string;
  onCancel?: () => void;
};

/**
 * Shared action-list body for MobileBottomSheet (profile photo, room photo menu, etc.).
 * Rows (+ optional muted cancel) — not stacked outline buttons.
 */
export function MobileActionSheetBody({
  title,
  actions,
  cancelLabel,
  onCancel,
}: MobileActionSheetBodyProps) {
  const { theme, isDark } = useMobileTheme();
  const visibleActions = actions.filter(Boolean);

  return (
    <View style={styles.wrap}>
      {title ? (
        <Text style={[styles.title, { color: theme.textHeading }]} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <View
        style={[
          styles.list,
          {
            borderColor: tokens.colors.divider,
            backgroundColor: isDark ? theme.card : tokens.colors.white,
          },
        ]}
      >
        {visibleActions.map((action, index) => {
          const disabled = !!action.disabled || !!action.loading;
          const labelColor = action.danger
            ? tokens.colors.error
            : disabled
              ? tokens.colors.textSecondary
              : theme.textHeading;
          return (
            <Pressable
              key={action.key}
              onPress={action.onPress}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled }}
              android_ripple={disabled ? undefined : { color: '#00000014' }}
              style={({ pressed }) => [
                styles.row,
                index < visibleActions.length - 1
                  ? {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: tokens.colors.divider,
                    }
                  : null,
                pressed && !disabled && Platform.OS === 'ios' ? { opacity: 0.7 } : null,
              ]}
            >
              {action.loading ? (
                <ActivityIndicator color={theme.textHeading} />
              ) : (
                <Text
                  style={[
                    styles.rowLabel,
                    { color: labelColor, fontWeight: disabled ? '500' : '600' },
                  ]}
                >
                  {action.label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
      {cancelLabel && onCancel ? (
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          android_ripple={{ color: '#00000014' }}
          style={({ pressed }) => [
            styles.cancel,
            {
              backgroundColor: isDark ? theme.background : '#F1F5F9',
              borderColor: tokens.colors.divider,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.rowLabel, styles.cancelLabel, { color: theme.textHeading }]}>
            {cancelLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: 8,
  },
  title: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  list: {
    marginHorizontal: 20,
    marginBottom: 4,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  cancel: {
    marginTop: 12,
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    fontWeight: '700',
  },
});
