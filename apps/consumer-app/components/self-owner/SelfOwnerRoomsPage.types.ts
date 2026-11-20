import type { DashboardSectionStatus } from "@nestyk/feature-listing";
import type { SelfOwnerRoom, SelfOwnerRoomFilter } from "../../lib/self-owner-rooms";

export interface SelfOwnerRoomsPageProps {
  rooms: SelfOwnerRoom[];
  status: DashboardSectionStatus;
  isDemoPreview: boolean;
  /** Starting search text (e.g. a deep link later). */
  initialQuery?: string;
  /** Starting status filter. */
  initialFilter?: SelfOwnerRoomFilter;
  /** Opens the add-room form; without it the button stays "coming soon". */
  onAddListing?: () => void;
  /** The owner's profile contact, handed to the room edit form. */
  ownerContact?: { name: string; phone: string };
}
