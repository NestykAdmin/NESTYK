import type { ReactNode } from "react";
import type { AgentListingCard } from "@nestyk/feature-listing";
import type {
  AgentLead,
  AgentLeadsPage,
  AgentLeadsSort,
  AgentTenant,
  LeadDisplayStatus,
} from "@nestyk/types";
import type { AgentListingsSort } from "../../lib/agent-listings-api";
import type { TenantWorkItem, TenantWorkKind } from "../../lib/tenant-work";
import type { RoomFilters } from "../AgentRoomsScreen";
import type { TenantDirectoryFilter } from "../TenantDirectoryBody";

type Option<T extends string = string> = { value: T; label: string };
export interface RoomsPresentationProps {
  children: ReactNode;
  items: AgentListingCard[];
  total: number;
  query: string;
  onQueryChange: (value: string) => void;
  filters: RoomFilters;
  onFiltersChange: (filters: RoomFilters) => void;
  sort: AgentListingsSort;
  sortOptions: Option<AgentListingsSort>[];
  onSortChange: (sort: AgentListingsSort) => void;
  statusOptions: Option[];
  visibilityOptions: Option[];
  loading: boolean;
  error: string | null;
  loadingMore: boolean;
  moreError: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onRetryMore: () => void;
  onRetry: () => void;
  onOpen: (id: number) => void;
}
export type LeadLocationFilter = {
  province: string;
  locations: string[];
  includeUnspecified: boolean;
};
export interface LeadsPresentationProps {
  children: ReactNode;
  items: AgentLead[];
  total: number;
  query: string;
  onQueryChange: (value: string) => void;
  sort: AgentLeadsSort;
  sortOptions: Option<AgentLeadsSort>[];
  onSortChange: (value: AgentLeadsSort) => void;
  status: LeadDisplayStatus | null;
  statusCounts: AgentLeadsPage["statusCounts"] | null;
  onStatusChange: (value: LeadDisplayStatus | null) => void;
  location: LeadLocationFilter;
  onLocationChange: (value: LeadLocationFilter) => void;
  page: number;
  onPageChange: (value: number) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpen: (lead: AgentLead) => void;
  workFilter: boolean;
  onClearWorkFilter: () => void;
}
export interface TenantsPresentationProps {
  children: ReactNode;
  tenants: AgentTenant[];
  workItems: TenantWorkItem[];
  view: "work" | "all";
  onViewChange: (value: "work" | "all") => void;
  query: string;
  onQueryChange: (value: string) => void;
  filter: TenantDirectoryFilter;
  onFilterChange: (value: TenantDirectoryFilter) => void;
  workQuery: string;
  onWorkQueryChange: (value: string) => void;
  kind: TenantWorkKind | null;
  onKindChange: (value: TenantWorkKind | null) => void;
  loading: boolean;
  busy: boolean;
  error: string;
  onOpen: (tenant: AgentTenant) => void;
  onWorkOpen: (item: TenantWorkItem) => void;
  onWorkAction: (item: TenantWorkItem) => void;
}
