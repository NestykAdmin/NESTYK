import type { AgentTenant } from "@nestyk/types";
import type { TenantDirectoryFilter, TenantWorkItem } from "../../lib/tenant-work";

/** Same props as TenantDirectoryBody (the app's "All tenants" tab). */
export interface TenantDirectoryTableProps {
  tenants: AgentTenant[];
  items: TenantWorkItem[];
  loading: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  filter: TenantDirectoryFilter;
  onFilterChange: (filter: TenantDirectoryFilter) => void;
  onOpen: (tenant: AgentTenant) => void;
  busy: boolean;
}
