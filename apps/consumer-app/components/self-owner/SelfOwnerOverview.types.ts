import type { SelfOwnerDashboardSnapshot } from "../../lib/self-owner-dashboard";

export interface SelfOwnerOverviewProps {
  snapshot: SelfOwnerDashboardSnapshot;
  deletionScheduledFor?: string | null;
}
