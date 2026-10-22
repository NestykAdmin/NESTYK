import React from "react";
import type { WebFormSheetProps } from "./WebFormLayout.types";
// Native mounts the original sheet without adding layout or changing its props.
export function WebFormSheet({ children }: WebFormSheetProps) {
  return <>{children}</>;
}
