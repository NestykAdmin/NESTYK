import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { tokens } from '../theme/tokens';
import { useMobileThemeOptional } from '../theme/ThemeContext';
import { MobileIcon } from '../icons/MobileIcon';
import type { AppIconName } from '../icons/types';

// Keep Safari's read-only text color override on the web only.
const readOnlyWebStyle: TextStyle & Pick<React.CSSProperties, 'WebkitTextFillColor'> = {
  WebkitTextFillColor: tokens.colors.primary,
};
const readOnlyWebStyleDark: TextStyle & Pick<React.CSSProperties, 'WebkitTextFillColor'> = {
  WebkitTextFillColor: tokens.colors.fieldOnDark.text,
};

export interface MobileInputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: ViewStyle;
  containerRef?: React.Ref<View>;
  required?: boolean;
  leadingIcon?: AppIconName;
  trailingText?: string;
}

export const MobileInput = React.forwardRef<TextInput, MobileInputProps>(
  (
    {
      label,
      error,
      helperText,
      containerStyle,
      containerRef,
      style,
      editable = true,
      required = false,
      leadingIcon,
      trailingText,
      multiline,
      ...props
    },
    ref,
  ) => {
    const hasChrome = !!leadingIcon || !!trailingText;
    const alignVertical = multiline ? 'top' : 'center';
    // v1.2 B+C (13 Nov 2026): dark field colours when a dark theme is mounted; light stays as before.
    const theme = useMobileThemeOptional();
    const dark = theme?.isDark ? tokens.colors.fieldOnDark : null;
    const errorColor = dark ? dark.error : tokens.colors.error;
    const fieldDark = dark ? { backgroundColor: dark.fill, borderColor: dark.line } : null;
    const readOnlyDark = dark && !editable ? { backgroundColor: dark.readOnly } : null;
    const textDark = dark ? { color: dark.text } : null;
    const mutedColor = dark ? tokens.colors.textOnDark.muted : tokens.colors.textSecondary;

    return (
      <View
        ref={containerRef}
        collapsable={false}
        style={[{ width: '100%', gap: 6 }, containerStyle]}
      >
        {label && (
          <Text style={[styles.label, dark ? { color: dark.text } : null]}>
            {label}
            {required ? <Text style={[styles.requiredMark, { color: errorColor }]}> *</Text> : null}
          </Text>
        )}
        {hasChrome ? (
          <View
            style={[
              styles.inputShell,
              multiline ? styles.inputShellMultiline : null,
              fieldDark,
              !editable ? styles.inputReadOnly : null,
              readOnlyDark,
              error ? { borderColor: errorColor } : null,
            ]}
          >
            {leadingIcon ? (
              <MobileIcon
                name={leadingIcon}
                size={18}
                color={mutedColor}
              />
            ) : null}
            <TextInput
              ref={ref}
              editable={editable}
              multiline={multiline}
              textAlignVertical={alignVertical}
              underlineColorAndroid="transparent"
              style={[
                styles.inputInner,
                multiline ? styles.inputInnerMultiline : styles.inputInnerSingle,
                textDark,
                !editable && Platform.OS === 'web' ? (dark ? readOnlyWebStyleDark : readOnlyWebStyle) : null,
                style,
              ]}
              placeholderTextColor={dark ? dark.placeholder : tokens.colors.placeholder}
              {...props}
            />
            {trailingText ? (
              <Text style={[styles.trailingText, { color: mutedColor }]}>{trailingText}</Text>
            ) : null}
          </View>
        ) : (
          <TextInput
            ref={ref}
            editable={editable}
            multiline={multiline}
            textAlignVertical={alignVertical}
            underlineColorAndroid="transparent"
            style={[
              styles.inputBase,
              multiline ? styles.inputMultiline : styles.inputSingle,
              fieldDark,
              textDark,
              !editable ? styles.inputReadOnly : null,
              readOnlyDark,
              // inputReadOnly sets ink text for light mode; keep white text in dark mode
              !editable ? textDark : null,
              !editable && Platform.OS === 'web' ? (dark ? readOnlyWebStyleDark : readOnlyWebStyle) : null,
              error ? { borderColor: errorColor } : null,
              style,
            ]}
            placeholderTextColor={dark ? dark.placeholder : tokens.colors.placeholder}
            {...props}
          />
        )}
        {error ? (
          <Text style={[styles.errorText, { color: errorColor }]}>{error}</Text>
        ) : helperText ? (
          <Text style={[styles.helperText, { color: mutedColor }]}>{helperText}</Text>
        ) : null}
      </View>
    );
  },
);

MobileInput.displayName = 'MobileInput';

const styles = StyleSheet.create({
  label: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    color: tokens.colors.textHeading,
  },
  requiredMark: {
    color: tokens.colors.error,
    fontWeight: '700',
  },
  /** Shared chrome without fixed height — multiline must never inherit height:44. */
  inputBase: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.primary,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  inputSingle: {
    height: 44,
  },
  inputMultiline: {
    minHeight: 88,
    paddingVertical: 11,
    textAlignVertical: 'top',
  },
  inputShell: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  inputShellMultiline: {
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  inputInner: {
    flex: 1,
    minWidth: 0,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.primary,
    padding: 0,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  inputInnerSingle: {
    height: 44,
  },
  inputInnerMultiline: {
    minHeight: 88,
    paddingVertical: 11,
    textAlignVertical: 'top',
  },
  trailingText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: tokens.colors.textSecondary,
  },
  inputReadOnly: {
    backgroundColor: tokens.colors.background,
    color: tokens.colors.primary,
    opacity: 1,
  } as const,
  errorText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.error,
  },
  helperText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
});
