import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useLocale } from '@nestyk/i18n';
import { useMobileTheme } from '@nestyk/ui/native';
import { localeTag } from '../lib/lead-format';

const MINUTE_STEP = 15;

function toDate(time: string): Date {
  const [hh, mm] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hh, mm, 0, 0);
  return date;
}

/** `HH:mm`, snapped to the minute step (Android's clock dialog has no interval). */
function toKey(date: Date): string {
  const total = Math.round((date.getHours() * 60 + date.getMinutes()) / MINUTE_STEP) * MINUTE_STEP;
  const minutes = Math.min(total, 24 * 60 - MINUTE_STEP);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** iOS shows the wheel inline under the time row; Android opens the system clock dialog instead. */
export const timePickerInline = Platform.OS === 'ios';

export function openTimeDialog(value: string, onChange: (time: string) => void) {
  if (Platform.OS !== 'android') return;
  DateTimePickerAndroid.open({
    value: toDate(value),
    mode: 'time',
    is24Hour: true,
    onChange: (event, date) => {
      if (event.type === 'set' && date) onChange(toKey(date));
    },
  });
}

export function ViewingTimePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (time: string) => void;
  disabled?: boolean;
}) {
  const { locale } = useLocale();
  const { theme } = useMobileTheme();
  return (
    <View pointerEvents={disabled ? 'none' : 'auto'} style={disabled ? styles.disabled : null}>
      <DateTimePicker
        value={toDate(value)}
        mode="time"
        display="spinner"
        minuteInterval={MINUTE_STEP}
        locale={localeTag(locale)}
        themeVariant={theme.mode === 'dark' ? 'dark' : 'light'}
        onChange={(_, date) => {
          if (date) onChange(toKey(date));
        }}
        style={styles.wheel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wheel: { alignSelf: 'stretch', height: 180 },
  disabled: { opacity: 0.5 },
});
