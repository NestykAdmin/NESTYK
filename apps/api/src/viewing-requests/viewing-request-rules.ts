import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type {
  AdminViewingRequest,
  AgentViewingRequest,
  GuestViewingRequest,
  PublicRoomCard,
  ViewingRequestContact,
  ViewingRequestErrorCode,
  ViewingRequestHandler,
  ViewingRequestStatus,
} from '@nestyk/types';

/**
 * Rules of a viewing request (project-docs/nestyk-guest-viewing-request-plan-20261123.md, Mos approved 23 Nov 2026).
 * Pure functions so every move of the state table can be tested without a database.
 * The numbers match @nestyk/types (VIEWING_REQUEST_*); kept here because the API test loads this file on its own.
 */
export const OPEN_STATUSES: ViewingRequestStatus[] = ['new', 'awaiting_agent', 'agent_handling', 'admin_handling', 'scheduled'];
export const ALL_STATUSES: ViewingRequestStatus[] = [...OPEN_STATUSES, 'viewed', 'cancelled', 'closed'];
export const OPEN_LIMIT = 10;
/** One preferred day and time (Mos 23 Nov 2026): from tomorrow up to 60 days ahead, 08:00–20:00 Bangkok, every 30 minutes. */
const MIN_DAYS_AHEAD = 1;
const MAX_DAYS_AHEAD = 60;
const FIRST_MINUTE = 8 * 60;
const LAST_MINUTE = 20 * 60;
const STEP_MINUTES = 30;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
/** A date-time with a time and an offset (Z or ±hh:mm), so the moment is never guessed from the server's zone. */
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const MAX_TEXT = 500;
const MAX_INT = 2147483647;
/** Same as agent viewings (lead-viewings.service.ts): 60 s of clock skew, at most 366 days ahead. */
const PAST_SLACK_MS = 60 * 1000;
const MAX_AHEAD_MS = 366 * 24 * 60 * 60 * 1000;
/** Same phone rule as leads (agent-leads.service.ts): "+…" must be E.164, anything else is kept as typed. */
const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

export type Actor = { role: 'guest' | 'admin' | 'agent'; userId: number };

export type RoomInfo = { id: number; agentUserId: number | null; isScout: boolean; title: string; number: string | null };

/** A request row as the service sees it (columns of viewing_requests). */
export type ViewingRequestRow = {
  id: number;
  rent_room_id: number;
  requester_user_id: number;
  agent_user_id: number | null;
  status: ViewingRequestStatus;
  handled_by: ViewingRequestHandler | null;
  scheduled_at: Date | null;
};

export type ViewingRequestRecord = ViewingRequestRow & {
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  preferred_at: Date;
  message: string | null;
  close_reason: string | null;
  cancelled_by: 'guest' | 'admin' | null;
  owner_notified_at: Date | null;
  created_at: Date;
  updated_at: Date;
  room: RoomInfo | null;
  agent: { id: number; name: string; email: string } | null;
};

export type Action =
  | { type: 'forward' }
  | { type: 'take' }
  | { type: 'handle' }
  | { type: 'handToAdmin' }
  | { type: 'schedule'; at: Date }
  | { type: 'viewed' }
  | { type: 'cancel' }
  | { type: 'close'; reason: string };

export type Patch = Partial<Pick<ViewingRequestRecord, 'status' | 'agent_user_id' | 'handled_by' | 'scheduled_at' | 'close_reason' | 'cancelled_by'>>;

export type NewViewingRequest = {
  roomId: number;
  preferredAt: Date;
  phone: string;
  message: string | null;
};

function fail(code: ViewingRequestErrorCode, message: string, extra: Record<string, unknown> = {}): never {
  throw new ConflictException({ code, message, ...extra });
}

function wrongStatus(row: ViewingRequestRow, action: Action): never {
  fail('WRONG_STATUS', `Cannot ${action.type} a request that is ${row.status}`);
}

function asObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Body must be an object');
  return input as Record<string, unknown>;
}

function optionalText(value: unknown, field: string): string | null {
  if (value == null) return null;
  if (typeof value !== 'string' || value.length > MAX_TEXT) throw new BadRequestException(`${field} must be text up to ${MAX_TEXT} characters`);
  return value.trim() || null;
}

/** 'YYYY-MM-DD' of the given moment in Bangkok (UTC+7, no daylight saving). */
export function bangkokDate(now: number): string {
  return new Date(now + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/** Calendar day plus n days, 'YYYY-MM-DD'. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** The preferred moment: on the half hour, 08:00–20:00 in Bangkok, on a day from tomorrow up to 60 days ahead. */
function preferredMoment(value: unknown, now: number): Date {
  const message = 'preferredAt must be a date-time with an offset, like 2026-11-24T14:30:00+07:00';
  if (typeof value !== 'string' || !DATE_TIME_PATTERN.test(value)) throw new BadRequestException(message);
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) throw new BadRequestException(message);
  // A day that does not exist (2026-11-31) would roll over to the next month: the written day must survive parsing.
  const offset = value.endsWith('Z') ? 0 : (value.at(-6) === '-' ? -1 : 1) * (Number(value.slice(-5, -3)) * 60 + Number(value.slice(-2)));
  if (new Date(at.getTime() + offset * 60000).toISOString().slice(0, 10) !== value.slice(0, 10)) throw new BadRequestException(message);
  const local = at.getTime() + BANGKOK_OFFSET_MS;
  const minuteOfDay = Math.floor((((local % 86400000) + 86400000) % 86400000) / 60000);
  if (local % 60000 !== 0 || minuteOfDay % STEP_MINUTES !== 0 || minuteOfDay < FIRST_MINUTE || minuteOfDay > LAST_MINUTE) {
    throw new BadRequestException('preferredAt must be 08:00–20:00 Bangkok time, on the hour or half hour');
  }
  const day = bangkokDate(at.getTime());
  const today = bangkokDate(now);
  if (day < addDays(today, MIN_DAYS_AHEAD) || day > addDays(today, MAX_DAYS_AHEAD)) {
    throw new BadRequestException(`preferredAt must be from tomorrow up to ${MAX_DAYS_AHEAD} days ahead`);
  }
  return at;
}

export function validateCreate(input: unknown, now: number): NewViewingRequest {
  const body = asObject(input);
  const roomText = body.roomId;
  if (typeof roomText !== 'string' || !/^[1-9]\d{0,9}$/.test(roomText) || Number(roomText) > MAX_INT) throw new BadRequestException('Invalid room id');

  const preferredAt = preferredMoment(body.preferredAt, now);

  if (typeof body.phone !== 'string' || !body.phone.trim() || body.phone.trim().length > 50) {
    throw new BadRequestException('phone is required and must be text up to 50 characters');
  }
  let phone = body.phone.trim();
  if (phone.startsWith('+')) {
    phone = phone.replace(/[\s().-]/g, '');
    if (!E164_PATTERN.test(phone)) throw new BadRequestException('phone must be an international number like +66812345678');
  }

  return { roomId: Number(roomText), preferredAt, phone, message: optionalText(body.message, 'message') };
}

export function validateSchedule(input: unknown, now: number): Date {
  const body = asObject(input);
  const date = typeof body.scheduledAt === 'string' ? new Date(body.scheduledAt) : null;
  if (!date || Number.isNaN(date.getTime())) throw new BadRequestException('scheduledAt must be an ISO date-time');
  if (date.getTime() < now - PAST_SLACK_MS) throw new BadRequestException('scheduledAt is in the past');
  if (date.getTime() > now + MAX_AHEAD_MS) throw new BadRequestException('scheduledAt is more than a year ahead');
  return date;
}

export function validateReason(input: unknown): string {
  const reason = optionalText(asObject(input).reason, 'reason');
  if (!reason) throw new BadRequestException('reason is required');
  return reason;
}

export function validateNote(input: unknown): string {
  const note = optionalText(asObject(input).note, 'note');
  if (!note) throw new BadRequestException('note is required');
  return note;
}

function notYours(): never {
  throw new NotFoundException('Viewing request not found');
}

/** The agent this request was sent to, else 404 (an agent never learns about other agents' requests). */
function requireAssignedAgent(row: ViewingRequestRow, actor: Actor) {
  if (actor.role !== 'agent' || row.agent_user_id !== actor.userId) notYours();
}

/** Who may book, move and finish the viewing: the handler (admin, or the agent who chose "นัดเอง"). */
function requireHandler(row: ViewingRequestRow, actor: Actor, action: Action) {
  if (actor.role === 'agent') {
    requireAssignedAgent(row, actor);
    if (row.handled_by !== 'agent') wrongStatus(row, action);
  } else if (actor.role !== 'admin' || row.handled_by !== 'admin') {
    wrongStatus(row, action);
  }
}

/** The change one action makes to a request, or the reason it is refused (the state table in the plan, section 3). */
export function decide(row: ViewingRequestRow, room: RoomInfo | null, action: Action, actor: Actor): Patch {
  const open = OPEN_STATUSES.includes(row.status);
  switch (action.type) {
    case 'forward':
      if (actor.role !== 'admin') notYours();
      if (row.status !== 'new') wrongStatus(row, action);
      if (!room?.isScout || !room.agentUserId) fail('NO_AGENT', 'This room has no agent to forward to');
      return { status: 'awaiting_agent', agent_user_id: room.agentUserId, handled_by: null };
    case 'take':
      if (actor.role !== 'admin') notYours();
      if (row.status !== 'new' && row.status !== 'awaiting_agent') wrongStatus(row, action);
      return { status: 'admin_handling', handled_by: 'admin' };
    case 'handle':
    case 'handToAdmin':
      requireAssignedAgent(row, actor);
      if (row.status !== 'awaiting_agent') wrongStatus(row, action);
      return action.type === 'handle' ? { status: 'agent_handling', handled_by: 'agent' } : { status: 'admin_handling', handled_by: 'admin' };
    case 'schedule':
      requireHandler(row, actor, action);
      if (row.status !== 'agent_handling' && row.status !== 'admin_handling' && row.status !== 'scheduled') wrongStatus(row, action);
      return { status: 'scheduled', scheduled_at: action.at };
    case 'viewed':
      requireHandler(row, actor, action);
      if (row.status !== 'scheduled') wrongStatus(row, action);
      return { status: 'viewed' };
    case 'cancel':
      if (actor.role === 'guest' && row.requester_user_id !== actor.userId) notYours();
      if (actor.role === 'agent') notYours();
      if (!open) wrongStatus(row, action);
      return { status: 'cancelled', cancelled_by: actor.role === 'guest' ? 'guest' : 'admin' };
    case 'close':
      if (actor.role !== 'admin') notYours();
      if (!open) wrongStatus(row, action);
      return { status: 'closed', close_reason: action.reason };
  }
}

const isoOrNull = (value: Date | string | null) => (value ? new Date(value).toISOString() : null);

function contactOf(row: ViewingRequestRecord): ViewingRequestContact {
  return { name: row.contact_name, phone: row.contact_phone, email: row.contact_email ?? null };
}

function roomSummary(row: ViewingRequestRecord) {
  return { id: row.rent_room_id, title: row.room?.title ?? `#${row.rent_room_id}`, number: row.room?.number ?? null };
}

/** The guest's own view: never the agent, never admin's reasons or notes. */
export function toGuestView(row: ViewingRequestRecord, card: PublicRoomCard | null): GuestViewingRequest {
  return {
    id: row.id,
    roomId: String(row.rent_room_id),
    room: card,
    status: row.status,
    preferredAt: new Date(row.preferred_at).toISOString(),
    scheduledAt: isoOrNull(row.scheduled_at),
    message: row.message ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    cancellable: OPEN_STATUSES.includes(row.status),
  };
}

export function toAdminView(row: ViewingRequestRecord): AdminViewingRequest {
  return {
    id: row.id,
    room: roomSummary(row),
    isAgentRoom: Boolean(row.room?.isScout && row.room.agentUserId),
    agent: row.agent ?? null,
    status: row.status,
    handledBy: row.handled_by ?? null,
    contact: contactOf(row),
    preferredAt: new Date(row.preferred_at).toISOString(),
    message: row.message ?? null,
    scheduledAt: isoOrNull(row.scheduled_at),
    closeReason: row.close_reason ?? null,
    cancelledBy: row.cancelled_by ?? null,
    ownerNotifiedAt: isoOrNull(row.owner_notified_at),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/** The room's agent: contact and message only once they chose "นัดเอง" (Mos 23 Nov 2026). */
export function toAgentView(row: ViewingRequestRecord): AgentViewingRequest {
  const mine = row.handled_by === 'agent';
  return {
    id: row.id,
    room: roomSummary(row),
    status: row.status,
    handledBy: row.handled_by ?? null,
    contact: mine ? contactOf(row) : null,
    message: mine ? row.message ?? null : null,
    preferredAt: new Date(row.preferred_at).toISOString(),
    scheduledAt: isoOrNull(row.scheduled_at),
    createdAt: new Date(row.created_at).toISOString(),
  };
}
