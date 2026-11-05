import type { TenantWorkItem, TenantWorkKind } from "../../lib/tenant-work";

/** Same props as TenantWorkBody (the app's "To do" tab). */
export interface TenantWorkTableProps {
  items: TenantWorkItem[];
  kind: TenantWorkKind | null;
  onKindChange: (kind: TenantWorkKind | null) => void;
  query: string;
  onQueryChange: (query: string) => void;
  onOpenTenant: (item: TenantWorkItem) => void;
  onAction: (item: TenantWorkItem) => void;
  busy: boolean;
}
