import React from "react";
import { TenantWorkBody } from "../TenantWorkBody";
import type { TenantWorkTableProps } from "./TenantWorkTable.types";

/** Platform fallback: native never shows the web table; keeps the app's "To do" list if ever used. */
export function TenantWorkTable(props: TenantWorkTableProps) {
  return <TenantWorkBody {...props} />;
}
