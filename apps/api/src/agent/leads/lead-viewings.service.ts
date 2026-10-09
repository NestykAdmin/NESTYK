import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, EntityManager, MoreThan, Not, Repository } from 'typeorm';
import type { LeadViewing } from '@nestyk/types';
import { LeadEntity } from '../../entities/lead.entity';
import { LeadViewingEntity, type LeadViewingStatus } from '../../entities/lead-viewing.entity';
import { RentRoomEntity } from '../../entities/rent-room.entity';

const STATUSES: LeadViewingStatus[] = ['scheduled', 'done', 'cancelled'];
const MAX_NOTE = 500;
const MAX_AHEAD_MS = 366 * 24 * 60 * 60 * 1000;
/** Clock skew allowed between the app and the server for "not in the past". */
const PAST_SLACK_MS = 60 * 1000;
const MAX_RANGE_MS = 62 * 24 * 60 * 60 * 1000;

type ViewingInput = { rentRoomId: number; scheduledAt: Date; note: string | null };
type ViewingPatch = { scheduledAt?: Date; status?: LeadViewingStatus; note?: string | null };

export type NextViewing = { at: string; room: string };

function roomTitle(row: LeadViewingEntity): string {
  const room = row.rent_room;
  return room?.property?.name || room?.listing_title || `#${row.rent_room_id}`;
}

/** Earliest upcoming scheduled viewing per lead, behind the derived "viewing booked" status. */
export async function loadNextViewings(em: EntityManager, leadIds: number[]): Promise<Map<number, NextViewing>> {
  const result = new Map<number, NextViewing>();
  if (!leadIds.length) return result;
  const rows = await em
    .getRepository(LeadViewingEntity)
    .createQueryBuilder('viewing')
    .leftJoinAndSelect('viewing.rent_room', 'room')
    .leftJoinAndSelect('room.property', 'property')
    .distinctOn(['viewing.lead_id'])
    .where('viewing.lead_id IN (:...ids)', { ids: leadIds })
    .andWhere("viewing.status = 'scheduled'")
    .andWhere('viewing.scheduled_at > now()')
    .orderBy('viewing.lead_id')
    .addOrderBy('viewing.scheduled_at', 'ASC')
    .getMany();
  for (const row of rows) {
    const number = row.rent_room?.room_id;
    result.set(Number(row.lead_id), {
      at: new Date(row.scheduled_at).toISOString(),
      room: number ? `${roomTitle(row)} · ${number}` : roomTitle(row),
    });
  }
  return result;
}

function asObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Body must be an object');
  return input as Record<string, unknown>;
}

function futureDate(value: unknown, now = Date.now()): Date {
  const date = typeof value === 'string' ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw new BadRequestException('scheduledAt must be an ISO date-time');
  if (date.getTime() < now - PAST_SLACK_MS) throw new BadRequestException('scheduledAt is in the past');
  if (date.getTime() > now + MAX_AHEAD_MS) throw new BadRequestException('scheduledAt is more than a year ahead');
  return date;
}

function noteValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string' || value.length > MAX_NOTE) throw new BadRequestException(`note must be text up to ${MAX_NOTE} characters`);
  return value.trim() || null;
}

export function validateViewingInput(input: unknown, now = Date.now()): ViewingInput {
  const body = asObject(input);
  if (!Number.isInteger(body.rentRoomId) || (body.rentRoomId as number) <= 0) throw new BadRequestException('rentRoomId is required');
  return { rentRoomId: body.rentRoomId as number, scheduledAt: futureDate(body.scheduledAt, now), note: noteValue(body.note) };
}

export function validateViewingPatch(input: unknown, now = Date.now()): ViewingPatch {
  const body = asObject(input);
  const patch: ViewingPatch = {};
  if (body.scheduledAt !== undefined) patch.scheduledAt = futureDate(body.scheduledAt, now);
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as LeadViewingStatus)) throw new BadRequestException('status is invalid');
    patch.status = body.status as LeadViewingStatus;
  }
  if (body.note !== undefined) patch.note = noteValue(body.note);
  if (!Object.keys(patch).length) throw new BadRequestException('Nothing to update');
  return patch;
}

function toViewing(row: LeadViewingEntity): LeadViewing {
  return {
    id: row.id,
    leadId: row.lead_id,
    leadName: row.lead?.name ?? '',
    rentRoomId: row.rent_room_id,
    roomTitle: roomTitle(row),
    roomNumber: row.rent_room?.room_id ?? null,
    scheduledAt: new Date(row.scheduled_at).toISOString(),
    status: row.status,
    note: row.note ?? null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

const RELATIONS = { lead: true, rent_room: { property: true } } as const;

@Injectable()
export class LeadViewingsService {
  constructor(
    @InjectRepository(LeadEntity) private readonly leads: Repository<LeadEntity>,
    @InjectRepository(LeadViewingEntity) private readonly viewings: Repository<LeadViewingEntity>,
  ) {}

  async create(agentId: number, leadId: number, input: unknown): Promise<LeadViewing> {
    const body = validateViewingInput(input);
    const id = await this.leads.manager.transaction(async (em) => {
      const lead = await em.findOne(LeadEntity, {
        where: { id: leadId, created_by_user_id: agentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lead) throw new NotFoundException('Lead not found');
      if (lead.status === 'booked' || lead.status === 'lost') {
        throw new ConflictException({ code: 'LEAD_CLOSED', message: 'Booked or lost leads cannot book viewings' });
      }
      const room = await em.findOneBy(RentRoomEntity, { id: body.rentRoomId, created_by_user_id: agentId });
      if (!room) throw new NotFoundException('Room not found');
      const open = await em.findOneBy(LeadViewingEntity, {
        lead_id: leadId,
        rent_room_id: room.id,
        status: 'scheduled',
        scheduled_at: MoreThan(new Date()),
      });
      if (open) throw new ConflictException({ code: 'VIEWING_EXISTS', message: 'This room already has an upcoming viewing for the lead', viewingId: open.id });
      const repo = em.getRepository(LeadViewingEntity);
      const saved = await repo.save(
        repo.create({
          lead_id: leadId,
          rent_room_id: room.id,
          created_by_user_id: agentId,
          scheduled_at: body.scheduledAt,
          status: 'scheduled',
          note: body.note,
        }),
      );
      await em.getRepository(LeadEntity).update({ id: leadId }, { updated_at: new Date() });
      return saved.id;
    });
    return this.view(agentId, id);
  }

  async listForLead(agentId: number, leadId: number): Promise<LeadViewing[]> {
    const lead = await this.leads.findOne({ select: { id: true }, where: { id: leadId, created_by_user_id: agentId } });
    if (!lead) throw new NotFoundException('Lead not found');
    const rows = await this.viewings.find({ where: { lead_id: leadId }, relations: RELATIONS, order: { scheduled_at: 'ASC', id: 'ASC' } });
    return rows.map(toViewing);
  }

  /** Calendar range; cancelled viewings are left out. */
  async listRange(agentId: number, fromRaw: unknown, toRaw: unknown): Promise<LeadViewing[]> {
    const from = typeof fromRaw === 'string' ? new Date(fromRaw) : null;
    const to = typeof toRaw === 'string' ? new Date(toRaw) : null;
    if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('from and to must be ISO date-times');
    }
    if (to <= from || to.getTime() - from.getTime() > MAX_RANGE_MS) throw new BadRequestException('Range must be positive and at most 62 days');
    const rows = await this.viewings.find({
      where: { created_by_user_id: agentId, scheduled_at: Between(from, to), status: Not('cancelled') },
      relations: RELATIONS,
      order: { scheduled_at: 'ASC', id: 'ASC' },
    });
    return rows.map(toViewing);
  }

  async update(agentId: number, id: number, input: unknown): Promise<LeadViewing> {
    const patch = validateViewingPatch(input);
    const row = await this.viewings.findOneBy({ id, created_by_user_id: agentId });
    if (!row) throw new NotFoundException('Viewing not found');
    if (row.status !== 'scheduled' && (patch.scheduledAt || (patch.status && patch.status !== row.status))) {
      throw new ConflictException({ code: 'VIEWING_CLOSED', message: 'Only scheduled viewings can be moved or change status' });
    }
    await this.viewings.manager.transaction(async (em) => {
      await em.getRepository(LeadViewingEntity).update(
        { id, created_by_user_id: agentId },
        {
          ...(patch.scheduledAt ? { scheduled_at: patch.scheduledAt } : {}),
          ...(patch.status ? { status: patch.status } : {}),
          ...(patch.note !== undefined ? { note: patch.note } : {}),
        },
      );
      await em.getRepository(LeadEntity).update({ id: row.lead_id }, { updated_at: new Date() });
    });
    return this.view(agentId, id);
  }

  private async view(agentId: number, id: number): Promise<LeadViewing> {
    const row = await this.viewings.findOne({ where: { id, created_by_user_id: agentId }, relations: RELATIONS });
    if (!row) throw new NotFoundException('Viewing not found');
    return toViewing(row);
  }
}
