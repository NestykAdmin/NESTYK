import React from 'react';
import { tokens, useMobileTheme } from '@nestyk/ui/native';

/** Web uses the browser's time input inline under the time row (the native picker library has no web build). */
export const timePickerInline = true;

export function openTimeDialog(_value: string, _onChange: (time: string) => void) {}

export function ViewingTimePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (time: string) => void;
  disabled?: boolean;
}) {
  const { theme } = useMobileTheme();
  return (
    <input
      type="time"
      step={900}
      value={value}
      disabled={disabled}
      onChange={(event) => {
        if (event.target.value) onChange(event.target.value);
      }}
      style={{
        minHeight: 48,
        padding: '0 14px',
        borderRadius: 12,
        border: `1.5px solid ${theme.border}`,
        background: theme.surface,
        color: theme.textHeading,
        fontFamily: tokens.typography.native.headingTh,
        fontSize: 20,
        lineHeight: '30px',
        opacity: disabled ? 0.5 : 1,
        colorScheme: theme.mode === 'dark' ? 'dark' : 'light',
      }}
    />
  );
}
