import type {
  AgentDashboardDeepLink,
  AgentDashboardSnapshot,
} from "@nestyk/feature-listing";

export interface AgentOverviewProps {
  snapshot: AgentDashboardSnapshot;
  onNavigate: (link: AgentDashboardDeepLink) => void;
  onRefresh?: () => void;
}
