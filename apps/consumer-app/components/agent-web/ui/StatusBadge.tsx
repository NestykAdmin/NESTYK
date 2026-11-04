import React from "react";
import {
  MobileFilterChip,
  MobileStatusPill,
  type MobileFilterChipProps,
} from "@nestyk/ui/native";
import { STATUS_INTENT_TONES, type StatusIntent } from "./statusIntent";

/** Read-only status capsule — the app's `MobileStatusPill` coloured by intent. */
export function StatusBadge({ label, intent }: { label: string; intent: StatusIntent }) {
  const tone = STATUS_INTENT_TONES[intent];
  return (
    <MobileStatusPill
      label={label}
      tone={tone}
      style={{ borderWidth: 1, borderColor: tone.border }}
    />
  );
}

export type StatusFilterChipProps = Omit<MobileFilterChipProps, "tone"> & {
  /** Omit for the "All" chip (brand look, no dot). */
  intent?: StatusIntent;
};

/** Filter chip above a list — the app's `MobileFilterChip` coloured by intent. */
export function StatusFilterChip({ intent, ...rest }: StatusFilterChipProps) {
  return (
    <MobileFilterChip
      {...rest}
      tone={intent ? STATUS_INTENT_TONES[intent] : undefined}
    />
  );
}
