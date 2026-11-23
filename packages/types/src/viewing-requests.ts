import type { PublicRoomCard } from './public-listing';

/**
 * Viewing requests from the guest web, coordinated by NESTYK admin
 * (project-docs/nestyk-guest-viewing-request-plan-20261123.md).
 *
 * new → awaiting_agent (admin forwards to the room's agent) → agent_handling ("นัดเอง") or admin_handling
 * new → admin_handling (admin takes it on) · the handler books it → scheduled → viewed
 * any open state → cancelled (guest or admin) or closed (admin, with a reason)
 */
export type ViewingRequestStatus =
  | 'new'
  | 'awaiting_agent'
  | 'agent_handling'
  | 'admin_handling'
  | 'scheduled'
  | 'viewed'
  | 'cancelled'
  | 'closed';

export const VIEWING_REQUEST_OPEN_STATUSES: readonly ViewingRequestStatus[] = ['new', 'awaiting_agent', 'agent_handling', 'admin_handling', 'scheduled'];

export type ViewingRequestSlot = 'morning' | 'afternoon' | 'evening' | 'any';
export const VIEWING_REQUEST_SLOTS: readonly ViewingRequestSlot[] = ['morning', 'afternoon', 'evening', 'any'];

export type ViewingRequestHandler = 'agent' | 'admin';

/** At most this many open requests per account, and preferred days at most this far ahead (Mos D2, 23 Nov 2026). */
export const VIEWING_REQUEST_OPEN_LIMIT = 10;
export const VIEWING_REQUEST_MAX_DAYS_AHEAD = 60;
export const VIEWING_REQUEST_MAX_DATES = 3;

export type ViewingRequestErrorCode = 'REQUEST_EXISTS' | 'REQUEST_LIMIT' | 'OWN_ROOM' | 'WRONG_STATUS' | 'NO_AGENT';

export interface CreateViewingRequestInput {
  /** Public room id (as in /rooms/<id>). */
  roomId: string;
  /** 1–3 Bangkok calendar days, 'YYYY-MM-DD', today up to 60 days ahead. */
  preferredDates: string[];
  preferredSlot: ViewingRequestSlot;
  phone: string;
  message?: string | null;
}

export interface ViewingRequestContact {
  name: string;
  phone: string;
  email: string | null;
}

/** What the guest sees: never the agent. `room` is null once the room is no longer public. */
export interface GuestViewingRequest {
  id: number;
  roomId: string;
  room: PublicRoomCard | null;
  status: ViewingRequestStatus;
  preferredDates: string[];
  preferredSlot: ViewingRequestSlot;
  scheduledAt: string | null;
  message: string | null;
  createdAt: string;
  cancellable: boolean;
}

export interface ViewingRequestRoomSummary {
  id: number;
  title: string;
  number: string | null;
}

/** What admin sees: everything, including the guest's contact and the room's agent. */
export interface AdminViewingRequest {
  id: number;
  room: ViewingRequestRoomSummary;
  isAgentRoom: boolean;
  agent: { id: number; name: string; email: string } | null;
  status: ViewingRequestStatus;
  handledBy: ViewingRequestHandler | null;
  contact: ViewingRequestContact;
  preferredDates: string[];
  preferredSlot: ViewingRequestSlot;
  message: string | null;
  scheduledAt: string | null;
  closeReason: string | null;
  cancelledBy: 'guest' | 'admin' | null;
  ownerNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ViewingRequestEvent {
  id: number;
  actorName: string | null;
  fromStatus: ViewingRequestStatus | null;
  toStatus: ViewingRequestStatus;
  note: string | null;
  createdAt: string;
}

export interface AdminViewingRequestDetail extends AdminViewingRequest {
  events: ViewingRequestEvent[];
}

/** What the room's agent sees: the guest's contact and message only after choosing "นัดเอง". */
export interface AgentViewingRequest {
  id: number;
  room: ViewingRequestRoomSummary;
  status: ViewingRequestStatus;
  handledBy: ViewingRequestHandler | null;
  contact: ViewingRequestContact | null;
  message: string | null;
  preferredDates: string[];
  preferredSlot: ViewingRequestSlot;
  scheduledAt: string | null;
  createdAt: string;
}
