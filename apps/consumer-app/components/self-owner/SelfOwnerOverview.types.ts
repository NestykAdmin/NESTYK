import type { SelfOwnerDashboardSnapshot } from "../../lib/self-owner-dashboard";

export interface SelfOwnerOverviewProps {
  snapshot: SelfOwnerDashboardSnapshot;
  deletionScheduledFor?: string | null;
  /** Opens the rooms and listings page; without it "view all rooms" stays "coming soon". */
  onOpenRooms?: () => void;
  /** Opens the add-room form; without it "list a room" stays "coming soon". */
  onAddListing?: () => void;
  /** Opens the income page (rent "view all" and the overdue-rent to-do). */
  onOpenIncome?: () => void;
  /** Opens the contracts page (awaiting-signature and renewal to-dos). */
  onOpenContracts?: () => void;
}
