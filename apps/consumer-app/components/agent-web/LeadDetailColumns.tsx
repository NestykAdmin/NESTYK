import React from "react";
import type { LeadDetailColumnProps, LeadDetailColumnsProps } from "./LeadDetailColumns.types";

/** Native: the lead page keeps the app's single column; these wrappers add nothing to the tree. */
export function LeadDetailColumns({ children }: LeadDetailColumnsProps) {
  return <>{children}</>;
}

export function LeadDetailColumn({ children }: LeadDetailColumnProps) {
  return <>{children}</>;
}
