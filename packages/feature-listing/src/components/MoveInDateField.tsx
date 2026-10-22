import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { MobileBottomSheet, WebFormSheet, MobileIcon, tokens } from '@nestyk/ui/native';
import { WizardSheetChrome } from './WizardSheetChrome';

LocaleConfig.locales.en = LocaleConfig.locales[''];
LocaleConfig.defaultLocale = 'en';

function todayIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function clampMoveInDate(iso: string) {
  const today = todayIsoDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return today;
  return iso < today ? today : iso;
}

function formatDisplayDate(iso: string, locale: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(y, m - 1, d));
  } catch {
    return iso;
  }
}

export function MoveInDateField({
  label,
  value,
  onChange,
  accentColor,
  locale = 'en',
  error,
  placeholder,
  closeLabel = 'Close',
  desktop = false,
}: {
  label: string;
  value: string;
  onChange: (isoDate: string) => void;
  accentColor: string;
  locale?: string;
  error?: string;
  placeholder?: string;
  closeLabel?: string;
  /** Centered dialog on web; native keeps its original sheet. */
  desktop?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const minDate = todayIsoDate();
  const selected = clampMoveInDate(value || minDate);
  const markedDates = useMemo(
    () => ({
      [selected]: {
        selected: true,
        selectedColor: accentColor,
        selectedTextColor: tokens.colors.primary,
      },
    }),
    [selected, accentColor],
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        android_ripple={{ color: '#00000014' }}
        style={({ pressed }) => [
          styles.row,
          error ? { borderColor: tokens.colors.error } : null,
          pressed ? { opacity: 0.9 } : null,
        ]}
      >
        <MobileIcon name="calendar" size={18} color={tokens.colors.textSecondary} />
        <Text style={[styles.value, !value ? styles.placeholder : null]} numberOfLines={1}>
          {value
            ? formatDisplayDate(clampMoveInDate(value), locale)
            : placeholder || formatDisplayDate(minDate, locale)}
        </Text>
        <MobileIcon name="chevron-down" size={18} color={tokens.colors.textSecondary} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <WebFormSheet enabled={desktop} label={label}>
      <MobileBottomSheet visible={open} onClose={() => setOpen(false)}>
        <View style={{ paddingHorizontal: 4, paddingBottom: 8, gap: 8 }}>
          <WizardSheetChrome title={label} closeLabel={closeLabel} onClose={() => setOpen(false)} />
          <Calendar
            current={selected < minDate ? minDate : selected}
            minDate={minDate}
            markedDates={markedDates}
            onDayPress={(day) => {
              if (day.dateString < minDate) return;
              onChange(day.dateString);
              setOpen(false);
            }}
            theme={{
              todayTextColor: accentColor,
              arrowColor: tokens.colors.primary,
              selectedDayBackgroundColor: accentColor,
              selectedDayTextColor: tokens.colors.primary,
              textDayFontFamily: undefined,
              textMonthFontWeight: '600',
              textDisabledColor: tokens.colors.placeholder,
            }}
          />
        </View>
      </MobileBottomSheet>
      </WebFormSheet>
    </View>
  );
}

export { todayIsoDate, clampMoveInDate };

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: tokens.colors.textSecondary,
  },
  row: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 12,
    backgroundColor: tokens.colors.white,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  value: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: tokens.colors.primary,
  },
  placeholder: {
    color: tokens.colors.textSecondary,
  },
  error: {
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.error,
  },
});
