import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import {
  MobileBottomSheet,
  MobileIcon,
  SelectionCheck,
  tokens,
  useMobileTheme,
  type AppIconName,
} from '@nestyk/ui/native';

/** `shortLabel` replaces `label` on the closed field when space is tight (e.g. "🇹🇭 +66"). */
export type LeadSelectOption<T extends string | number> = { value: T; label: string; shortLabel?: string };

export function LeadSelectField<T extends string | number>({
  label,
  placeholder,
  icon,
  value,
  options,
  onChange,
  clearLabel,
  disabled = false,
  error,
  style,
  hideLabel = false,
}: {
  /** Also the sheet title and accessibility label, so it is required even when hidden. */
  label: string;
  placeholder: string;
  icon?: AppIconName;
  value: T | null;
  options: LeadSelectOption<T>[];
  onChange: (value: T | null) => void;
  /** Adds a first row that resets the value to `null`. */
  clearLabel?: string;
  disabled?: boolean;
  error?: string;
  style?: object;
  hideLabel?: boolean;
}) {
  const { t } = useLocale();
  const { theme, isDark } = useMobileTheme();
  // v1.2 B+C (13 Nov 2026): the select field matches MobileInput in dark mode.
  const field = isDark ? tokens.colors.fieldOnDark : null;
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  const pick = (next: T | null) => {
    onChange(next);
    setOpen(false);
  };

  const row = (key: string, text: string, on: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      {...(Platform.OS === 'android' ? { android_ripple: { color: 'rgba(0,0,0,0.06)' } } : {})}
      style={({ pressed }) => [
        styles.optionRow,
        { borderColor: theme.border, opacity: pressed && Platform.OS === 'ios' ? 0.85 : 1 },
        on && styles.optionRowOn,
        on && isDark ? DARK_OPTION_ON : null,
      ]}
    >
      <Text style={[styles.optionText, { color: theme.textHeading }]}>{text}</Text>
      {on ? <SelectionCheck selected variant="chip" size="md" /> : null}
    </Pressable>
  );

  return (
    <View style={[styles.group, style]}>
      {hideLabel ? null : (
        <Text style={[styles.label, { color: theme.textHeading }]} numberOfLines={1}>
          {label}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        disabled={disabled}
        onPress={() => setOpen(true)}
        {...(Platform.OS === 'android' ? { android_ripple: { color: 'rgba(0,0,0,0.06)' } } : {})}
        style={({ pressed }) => [
          styles.shell,
          {
            backgroundColor: field ? field.fill : tokens.colors.white,
            borderColor: error ? (field ? field.error : tokens.colors.error) : field ? field.line : tokens.colors.border,
          },
          disabled && (field ? { backgroundColor: field.readOnly } : styles.shellDisabled),
          pressed && Platform.OS === 'ios' ? { opacity: 0.85 } : null,
        ]}
      >
        {icon ? <MobileIcon name={icon} size={18} color={field ? field.placeholder : tokens.colors.textSecondary} /> : null}
        <Text
          style={[
            styles.value,
            {
              color: selected
                ? field ? field.text : tokens.colors.primary
                : field ? field.placeholder : tokens.colors.placeholder,
            },
          ]}
          numberOfLines={1}
        >
          {selected ? selected.shortLabel ?? selected.label : placeholder}
        </Text>
        <MobileIcon name="chevron-down" size={16} color={field ? field.placeholder : tokens.colors.textSecondary} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <MobileBottomSheet visible={open} onClose={() => setOpen(false)} maxHeight="75%">
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: theme.textHeading }]}>{label}</Text>
          <Pressable
            onPress={() => setOpen(false)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t.common.cancel}
          >
            <MobileIcon name="close" size={22} color={theme.textHeading} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.optionList} showsVerticalScrollIndicator={false}>
          {clearLabel ? row('__clear', clearLabel, value == null, () => pick(null)) : null}
          {options.map((option) =>
            row(String(option.value), option.label, option.value === value, () => pick(option.value)),
          )}
        </ScrollView>
      </MobileBottomSheet>
    </View>
  );
}

// Selected option in dark mode: yellow tint, as the dark filter chips (v1.2 B+C).
const DARK_OPTION_ON = { backgroundColor: 'rgba(248,182,21,0.16)' } as const;

const styles = StyleSheet.create({
  group: { gap: 6, minWidth: 0 },
  label: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  shell: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  shellDisabled: { backgroundColor: tokens.colors.background },
  value: {
    flex: 1,
    minWidth: 0,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
  },
  error: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.error,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 18,
    lineHeight: 27,
    flex: 1,
    paddingRight: 12,
  },
  optionList: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionRowOn: {
    borderColor: tokens.colors.brand[500],
    backgroundColor: tokens.colors.brand[50],
  },
  optionText: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    paddingRight: 8,
  },
});
