import React from "react";
import type {
  WebFormSectionProps,
  WebFormSlotProps,
} from "./WebFormLayout.types";
// Native slots are transparent: no additional host views, styles or navigation.
export function WebFormSection({ children }: WebFormSectionProps) {
  return <>{children}</>;
}
export function WebFormTabs({ children }: WebFormSlotProps) {
  return <>{children}</>;
}
export function WebFormActions({ children }: WebFormSlotProps) {
  return <>{children}</>;
}
