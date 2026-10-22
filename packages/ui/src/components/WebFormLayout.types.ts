import type { ReactNode } from "react";
export interface WebFormStep {
  key: string;
  label: string;
  description?: string;
  disabled?: boolean;
  complete?: boolean;
  error?: boolean;
}
export interface WebFormSectionProps {
  children: ReactNode;
  enabled?: boolean;
  title: string;
  description?: string | null;
  activeStep: string;
  steps: WebFormStep[];
  onStepChange?: (key: string) => void;
  busy?: boolean;
  variant?: "lead" | "tenant" | "source" | "overview" | "room";
}
export interface WebFormSlotProps {
  children: ReactNode;
  enabled?: boolean;
}

export interface WebFormSheetProps extends WebFormSlotProps {
  label?: string;
  showClose?: boolean;
}
