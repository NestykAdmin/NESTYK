import React from "react";
import type {
  RoomsPresentationProps,
  LeadsPresentationProps,
  TenantsPresentationProps,
} from "./RecordPresentations.types";

// Native keeps the original screen children, host views, styles and interactions.
export function RoomsPresentation({ children }: RoomsPresentationProps) {
  return <>{children}</>;
}
export function LeadsPresentation({ children }: LeadsPresentationProps) {
  return <>{children}</>;
}
export function TenantsPresentation({ children }: TenantsPresentationProps) {
  return <>{children}</>;
}
