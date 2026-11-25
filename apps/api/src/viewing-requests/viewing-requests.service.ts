import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminViewingRequest,
  AdminViewingRequestDetail,
  AgentViewingRequest,
  GuestViewingRequest,
  PublicRoomCard,
  ViewingRequestEvent,
  ViewingRequestStatus,
} from '@nestyk/types';
import { PublicRoomsService } from '../public-listings/public-rooms.service';
import {
  ALL_STATUSES,
  OPEN_LIMIT,
  OPEN_STATUSES,
  decide,
  toAdminView,
  toAgentView,
  toGuestView,
  validateCreate,
  validateNote,
  validateReason,
  validateSchedule,
  type Action,
  type Actor,
  type Patch,
  type RoomInfo,
  type ViewingRequestRecord,
} from './viewing-request-rules';
import { ViewingRequestsStore } from './viewing-requests.store';

/** What the service needs from the database (ViewingRequestsStore; tests pass an in-memory one). */
export interface ViewingRequestsStoreLike {
  roomInfo(roomId: number): Promise<RoomInfo | null>;
  countOpen(userId: number): Promise<number>;
  findOpenId(userId: number, roomId: number): Promise<number | null>;
  /** Inserts the request and its first event; a second open request for the same room is a 409 REQUEST_EXISTS. */
  create(values: NewRow, actorUserId: number): Promise<number>;
  get(id: number): Promise<ViewingRequestRecord | null>;
  list(filter: { requesterUserId?: number; agentUserId?: number; statuses?: ViewingRequestStatus[] }): Promise<ViewingRequestRecord[]>;
  events(id: number): Promise<ViewingRequestEvent[]>;
  /** Locks the row, applies the change and writes its event in one transaction. 404 when the row is gone. */
  mutate(id: number, change: (row: ViewingRequestRecord, room: RoomInfo | null) => Change): Promise<void>;
}

export type NewRow = {
  rent_room_id: number;
  requester_user_id: number;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  preferred_at: Date;
  message: string | null;
};

export type Change = {
  patch: Patch;
  event: { actorUserId: number; from: ViewingRequestStatus | null; to: ViewingRequestStatus; note: string | null };
};

export interface PublicRoomsLike {
  publicIdsAmong(ids: number[]): Promise<number[]>;
  cardsFor(ids: number[]): Promise<PublicRoomCard[]>;
}

/** The account sending a request (the signed-in user row). */
export type Requester = { id: number; first_name?: string | null; last_name?: string | null; email?: string | null };

export const VIEWING_REQUESTS_CLOCK = Symbol('VIEWING_REQUESTS_CLOCK');

const ADMIN_ACTIONS = ['forward', 'take', 'schedule', 'viewed', 'cancel', 'close', 'notes'] as const;
const AGENT_ACTIONS = ['handle', 'hand-to-admin', 'schedule', 'viewed'] as const;

function actionFor(name: string, body: unknown, now: number): Action {
  switch (name) {
    case 'forward': return { type: 'forward' };
    case 'take': return { type: 'take' };
    case 'handle': return { type: 'handle' };
    case 'hand-to-admin': return { type: 'handToAdmin' };
    case 'schedule': return { type: 'schedule', at: validateSchedule(body, now) };
    case 'viewed': return { type: 'viewed' };
    case 'cancel': return { type: 'cancel' };
    case 'close': return { type: 'close', reason: validateReason(body) };
    default: throw new NotFoundException('Unknown action');
  }
}

@Injectable()
export class ViewingRequestsService {
  // Explicit tokens: interfaces reach Nest as Object. Tests pass fakes and a fixed clock.
  constructor(
    @Inject(ViewingRequestsStore) private readonly store: ViewingRequestsStoreLike,
    @Inject(PublicRoomsService) private readonly rooms: PublicRoomsLike,
    @Inject(VIEWING_REQUESTS_CLOCK) private readonly now: () => number = () => Date.now(),
  ) {}

  /** A signed-in account asks to view a public room (any role, not the room's own agent). */
  async create(user: Requester, input: unknown): Promise<GuestViewingRequest> {
    const body = validateCreate(input, this.now());
    if (!(await this.rooms.publicIdsAmong([body.roomId])).length) throw new NotFoundException('Room not found');
    const room = await this.store.roomInfo(body.roomId);
    if (room?.agentUserId === user.id) {
      throw new ConflictException({ code: 'OWN_ROOM', message: 'You cannot ask to view your own room' });
    }
    const existing = await this.store.findOpenId(user.id, body.roomId);
    if (existing != null) {
      throw new ConflictException({ code: 'REQUEST_EXISTS', message: 'You already asked to view this room', requestId: existing });
    }
    if ((await this.store.countOpen(user.id)) >= OPEN_LIMIT) {
      throw new ConflictException({ code: 'REQUEST_LIMIT', message: `At most ${OPEN_LIMIT} open viewing requests` });
    }
    const name = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email || `#${user.id}`;
    const id = await this.store.create(
      {
        rent_room_id: body.roomId,
        requester_user_id: user.id,
        contact_name: name.slice(0, 255),
        contact_phone: body.phone,
        contact_email: user.email ?? null,
        preferred_at: body.preferredAt,
        message: body.message,
      },
      user.id,
    );
    const row = await this.store.get(id);
    if (!row) throw new NotFoundException('Viewing request not found');
    return toGuestView(row, (await this.rooms.cardsFor([row.rent_room_id]))[0] ?? null);
  }

  /** The account's own requests, newest first; the room card only while the room is public. */
  async listMine(userId: number): Promise<GuestViewingRequest[]> {
    const rows = await this.store.list({ requesterUserId: userId });
    const cards = new Map((await this.rooms.cardsFor([...new Set(rows.map((r) => r.rent_room_id))])).map((c) => [c.id, c]));
    return rows.map((row) => toGuestView(row, cards.get(String(row.rent_room_id)) ?? null));
  }

  async cancelMine(userId: number, id: number): Promise<void> {
    await this.act(id, { type: 'cancel' }, { role: 'guest', userId }, null);
  }

  /** Admin queue: `open` (default), one status, or `all`. */
  async adminList(statusRaw: unknown): Promise<AdminViewingRequest[]> {
    const status = statusRaw == null || statusRaw === '' ? 'open' : statusRaw;
    let statuses: ViewingRequestStatus[] | undefined;
    if (status === 'open') statuses = OPEN_STATUSES;
    else if (status === 'all') statuses = undefined;
    else if (ALL_STATUSES.includes(status as ViewingRequestStatus)) statuses = [status as ViewingRequestStatus];
    else throw new BadRequestException('status must be open, all or a request status');
    return (await this.store.list({ statuses })).map(toAdminView);
  }

  async adminGet(id: number): Promise<AdminViewingRequestDetail> {
    const row = await this.store.get(id);
    if (!row) throw new NotFoundException('Viewing request not found');
    return { ...toAdminView(row), events: await this.store.events(id) };
  }

  async adminAct(adminId: number, id: number, name: string, body: unknown): Promise<AdminViewingRequestDetail> {
    if (!(ADMIN_ACTIONS as readonly string[]).includes(name)) throw new NotFoundException('Unknown action');
    if (name === 'notes') {
      const note = validateNote(body);
      await this.store.mutate(id, (row) => ({ patch: {}, event: { actorUserId: adminId, from: row.status, to: row.status, note } }));
    } else {
      const note = name === 'close' ? null : optionalNote(body);
      await this.act(id, actionFor(name, body, this.now()), { role: 'admin', userId: adminId }, note);
    }
    return this.adminGet(id);
  }

  /** Requests sent to this agent, newest first. */
  async agentList(agentId: number): Promise<AgentViewingRequest[]> {
    return (await this.store.list({ agentUserId: agentId })).map(toAgentView);
  }

  async agentAct(agentId: number, id: number, name: string, body: unknown): Promise<AgentViewingRequest> {
    if (!(AGENT_ACTIONS as readonly string[]).includes(name)) throw new NotFoundException('Unknown action');
    await this.act(id, actionFor(name, body, this.now()), { role: 'agent', userId: agentId }, null);
    const row = await this.store.get(id);
    if (!row) throw new NotFoundException('Viewing request not found');
    return toAgentView(row);
  }

  private async act(id: number, action: Action, actor: Actor, note: string | null): Promise<void> {
    await this.store.mutate(id, (row, room) => {
      const patch = decide(row, room, action, actor);
      return { patch, event: { actorUserId: actor.userId, from: row.status, to: patch.status ?? row.status, note } };
    });
  }
}

/** Admin may add a short note to any action (e.g. "called the agent"); empty means none. */
function optionalNote(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body) || (body as Record<string, unknown>).note == null) return null;
  return validateNote(body);
}
