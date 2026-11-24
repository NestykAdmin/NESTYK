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

export type ViewingRequestHandler = 'agent' | 'admin';

/** At most this many open requests per account, and the preferred day at most this far ahead (Mos D2, 23 Nov 2026). */
export const VIEWING_REQUEST_OPEN_LIMIT = 10;
export const VIEWING_REQUEST_MAX_DAYS_AHEAD = 60;
/** One preferred day and time (Mos 23 Nov 2026): not today, 08:00–20:00 Bangkok time, every 30 minutes. */
export const VIEWING_REQUEST_MIN_DAYS_AHEAD = 1;
export const VIEWING_REQUEST_FIRST_TIME = '08:00';
export const VIEWING_REQUEST_LAST_TIME = '20:00';
export const VIEWING_REQUEST_STEP_MINUTES = 30;

export type ViewingRequestErrorCode = 'REQUEST_EXISTS' | 'REQUEST_LIMIT' | 'OWN_ROOM' | 'WRONG_STATUS' | 'NO_AGENT';

export interface CreateViewingRequestInput {
  /** Public room id (as in /rooms/<id>). */
  roomId: string;
  /** Date-time with an offset, e.g. '2026-11-24T14:30:00+07:00': from tomorrow up to 60 days ahead, 08:00–20:00 Bangkok, :00 or :30. */
  preferredAt: string;
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
  /** ISO date-time (UTC); show it in Asia/Bangkok. */
  preferredAt: string;
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
  /** ISO date-time (UTC); show it in Asia/Bangkok. */
  preferredAt: string;
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
  /** ISO date-time (UTC); show it in Asia/Bangkok. */
  preferredAt: string;
  scheduledAt: string | null;
  createdAt: string;
}
