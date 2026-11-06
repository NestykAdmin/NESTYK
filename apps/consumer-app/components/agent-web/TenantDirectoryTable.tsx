import React from "react";
import { TenantDirectoryBody } from "../TenantDirectoryBody";
import type { TenantDirectoryTableProps } from "./TenantDirectoryTable.types";

/** Platform fallback: native never shows the web table; keeps the app's "All tenants" list if ever used. */
export function TenantDirectoryTable(props: TenantDirectoryTableProps) {
  return <TenantDirectoryBody {...props} />;
}
