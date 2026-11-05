import React from "react";
import type { TenantDetailFrameProps } from "./TenantDetailFrame.types";

/** Native: the tenant page is the app's own layout; this frame adds nothing. */
export function TenantDetailFrame({ children }: TenantDetailFrameProps) {
  return <>{children}</>;
}
