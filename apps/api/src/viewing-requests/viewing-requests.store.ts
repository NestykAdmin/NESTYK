import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import type { ViewingRequestEvent, ViewingRequestStatus } from '@nestyk/types';
import { RentRoomEntity } from '../entities/rent-room.entity';
import { ViewingRequestEntity } from '../entities/viewing-request.entity';
import { ViewingRequestEventEntity } from '../entities/viewing-request-event.entity';
import { OPEN_STATUSES, type RoomInfo, type ViewingRequestRecord } from './viewing-request-rules';
import type { Change, NewRow, ViewingRequestsStoreLike } from './viewing-requests.service';

/** Lists stop here; the queue and an account's own list stay far below it in practice. */
const LIST_LIMIT = 200;
const UNIQUE_VIOLATION = '23505';

function personName(user: { first_name?: string | null; last_name?: string | null; email?: string | null } | null | undefined) {
  if (!user) return null;
  return `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email || null;
}

/** Same title rule as agent viewings (lead-viewings.service.ts): project name, else the listing name, else #id. */
function roomInfoOf(room: RentRoomEntity | null | undefined): RoomInfo | null {
  if (!room) return null;
  return {
    id: room.id,
    agentUserId: room.is_scout_room ? room.created_by_user_id ?? null : null,
    isScout: Boolean(room.is_scout_room),
    title: room.property?.name || room.listing_title || `#${room.id}`,
    number: room.room_id ?? null,
  };
}

function toRecord(row: ViewingRequestEntity): ViewingRequestRecord {
  const agent = row.agent;
  return {
    ...row,
    room: roomInfoOf(row.rent_room),
    agent: agent ? { id: agent.id, name: personName(agent) ?? `#${agent.id}`, email: agent.email } : null,
  };
}

const RELATIONS = { rent_room: { property: true }, agent: true } as const;

/** TypeORM side of ViewingRequestsStoreLike. */
@Injectable()
export class ViewingRequestsStore implements ViewingRequestsStoreLike {
  constructor(
    @InjectRepository(ViewingRequestEntity) private readonly requests: Repository<ViewingRequestEntity>,
    @InjectRepository(ViewingRequestEventEntity) private readonly eventRows: Repository<ViewingRequestEventEntity>,
    @InjectRepository(RentRoomEntity) private readonly rooms: Repository<RentRoomEntity>,
  ) {}

  async roomInfo(roomId: number): Promise<RoomInfo | null> {
    return roomInfoOf(await this.rooms.findOne({ where: { id: roomId }, relations: { property: true } }));
  }

  countOpen(userId: number): Promise<number> {
    return this.requests.count({ where: { requester_user_id: userId, status: In(OPEN_STATUSES) } });
  }

  async findOpenId(userId: number, roomId: number): Promise<number | null> {
    const row = await this.requests.findOne({ select: { id: true }, where: { requester_user_id: userId, rent_room_id: roomId, status: In(OPEN_STATUSES) } });
    return row?.id ?? null;
  }

  async create(values: NewRow, actorUserId: number): Promise<number> {
    try {
      return await this.requests.manager.transaction(async (em) => {
        const saved = await em.getRepository(ViewingRequestEntity).save(em.getRepository(ViewingRequestEntity).create({ ...values, status: 'new' }));
        await em.getRepository(ViewingRequestEventEntity).insert({ request_id: saved.id, actor_user_id: actorUserId, from_status: null, to_status: 'new', note: null });
        return saved.id;
      });
    } catch (error) {
      // Two sends at the same moment: the partial unique index lets only one through.
      if (error instanceof QueryFailedError && (error as QueryFailedError & { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException({ code: 'REQUEST_EXISTS', message: 'You already asked to view this room' });
      }
      throw error;
    }
  }

  async get(id: number): Promise<ViewingRequestRecord | null> {
    const row = await this.requests.findOne({ where: { id }, relations: RELATIONS });
    return row ? toRecord(row) : null;
  }

  async list(filter: { requesterUserId?: number; agentUserId?: number; statuses?: ViewingRequestStatus[] }): Promise<ViewingRequestRecord[]> {
    const rows = await this.requests.find({
      where: {
        ...(filter.requesterUserId != null ? { requester_user_id: filter.requesterUserId } : {}),
        ...(filter.agentUserId != null ? { agent_user_id: filter.agentUserId } : {}),
        ...(filter.statuses ? { status: In(filter.statuses) } : {}),
      },
      relations: RELATIONS,
      order: { created_at: 'DESC', id: 'DESC' },
      take: LIST_LIMIT,
    });
    return rows.map(toRecord);
  }

  async events(id: number): Promise<ViewingRequestEvent[]> {
    const rows = await this.eventRows.find({ where: { request_id: id }, relations: { actor: true }, order: { created_at: 'ASC', id: 'ASC' } });
    return rows.map((row) => ({
      id: row.id,
      actorName: personName(row.actor),
      fromStatus: row.from_status ?? null,
      toStatus: row.to_status,
      note: row.note ?? null,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  async mutate(id: number, change: (row: ViewingRequestRecord, room: RoomInfo | null) => Change): Promise<void> {
    await this.requests.manager.transaction(async (em) => {
      // Lock without joins: FOR UPDATE cannot lock the nullable side of an outer join.
      const row = await em.findOne(ViewingRequestEntity, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!row) throw new NotFoundException('Viewing request not found');
      const room = roomInfoOf(await em.findOne(RentRoomEntity, { where: { id: row.rent_room_id }, relations: { property: true } }));
      const { patch, event } = change(toRecord({ ...row, rent_room: undefined as never, agent: null }), room);
      if (Object.keys(patch).length) await em.getRepository(ViewingRequestEntity).update({ id }, { ...patch, updated_at: new Date() });
      await em.getRepository(ViewingRequestEventEntity).insert({
        request_id: id,
        actor_user_id: event.actorUserId,
        from_status: event.from,
        to_status: event.to,
        note: event.note,
      });
    });
  }
}
