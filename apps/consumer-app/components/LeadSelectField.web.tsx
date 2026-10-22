import React, { useId } from "react";
import { StyleSheet, View } from "react-native";
import {
  MobileIcon,
  useMobileTheme,
  type AppIconName,
} from "@nestyk/ui/native";
import "./agent-web/agent-fields.css";
import { AgentSelect } from "./agent-web/AgentSelect";

export type LeadSelectOption<T extends string | number> = {
  value: T;
  label: string;
  shortLabel?: string;
};
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
  label: string;
  placeholder: string;
  icon?: AppIconName;
  value: T | null;
  options: LeadSelectOption<T>[];
  onChange: (value: T | null) => void;
  clearLabel?: string;
  disabled?: boolean;
  error?: string;
  style?: object;
  hideLabel?: boolean;
}) {
  const id = useId();
  const { theme } = useMobileTheme();
  const selected = options.findIndex((o) => o.value === value);
  return (
    <View style={[styles.group, style]}>
      {!hideLabel && (
        <label className="adf-label" htmlFor={id}>
          {label}
        </label>
      )}
      <div
        className={`adf-select ${error ? "adf-invalid" : ""}`}
        style={{
          background: theme.surface,
          borderColor: error ? "#c43d4c" : theme.border,
        }}
      >
        {icon && (
          <MobileIcon name={icon} size={18} color={theme.textSecondary} />
        )}
        <AgentSelect
          id={id}
          aria-label={label}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          disabled={disabled}
          value={selected < 0 ? "" : String(selected)}
          onChange={(e) =>
            onChange(
              e.target.value === ""
                ? null
                : options[Number(e.target.value)].value,
            )
          }
        >
          <option value="" disabled={!clearLabel}>
            {clearLabel || placeholder}
          </option>
          {options.map((option, index) => (
            <option key={String(option.value)} value={index}>
              {hideLabel && selected === index && option.shortLabel
                ? option.shortLabel
                : option.label}
            </option>
          ))}
        </AgentSelect>
      </div>
      {error && (
        <small id={`${id}-error`} className="adf-error" role="alert">
          {error}
        </small>
      )}
    </View>
  );
}
const styles = StyleSheet.create({ group: { gap: 6, minWidth: 0 } });
