import { parseZonedInstant as instant } from '../../common/iso-date-time';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AgentCalendarEvent, CreateAgentCalendarEvent, UpdateAgentCalendarEvent } from '@nestyk/types';

export function calendarRange(from: unknown, to: unknown) {
  const start = instant(from), end = instant(to);
  if (end <= start || +end - +start > 62 * 86400000) throw new BadRequestException('Range must be positive and at most 62 days');
  return { start, end };
}
function text(value: unknown, key: string, max: number, required: boolean): string {
  const content = value ?? (required ? null : '');
  if (typeof content !== 'string' || (required && !content.trim()) || content.trim().length > max || content.includes('\0')) throw new BadRequestException(`Invalid ${key}`);
  return content.trim();
}
export function calendarInput(input: unknown): CreateAgentCalendarEvent & { kind: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Invalid event');
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some(key => !['title', 'location', 'startsAt', 'kind'].includes(key))) throw new BadRequestException('Unknown event field');
  return { title: text(body.title, 'title', 160, true), location: text(body.location, 'location', 160, false), kind: text(body.kind, 'kind', 80, false), startsAt: instant(body.startsAt).toISOString() };
}
export function calendarPatch(input: unknown): UpdateAgentCalendarEvent {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Invalid event');
  const body = input as Record<string, unknown>;
  const keys = Object.keys(body);
  if (!keys.length || keys.some(key => !['title', 'location', 'startsAt', 'status'].includes(key))) throw new BadRequestException('Invalid event fields');
  const result: UpdateAgentCalendarEvent = {};
  if ('title' in body) result.title = text(body.title, 'title', 160, true);
  if ('location' in body) result.location = text(body.location, 'location', 160, false);
  if ('startsAt' in body) result.startsAt = instant(body.startsAt).toISOString();
  if ('status' in body) {
    if (!['scheduled', 'done', 'cancelled'].includes(body.status as string)) throw new BadRequestException('Invalid status');
    result.status = body.status as UpdateAgentCalendarEvent['status'];
  }
  return result;
}

type Row = { id: number; title: string; location: string; starts_at: Date; kind: string; status: AgentCalendarEvent['status'] };
function event(row: Row): AgentCalendarEvent {
  return { id: `event-${row.id}`, title: row.title, location: row.location, startsAt: new Date(row.starts_at).toISOString(), kind: row.kind, status: row.status === 'pending' || row.status === 'confirmed' ? 'scheduled' : row.status };
}
@Injectable()
export class AgentCalendarService {
  constructor(private readonly db: DataSource) {}
  async list(agentId: number, from: unknown, to: unknown): Promise<AgentCalendarEvent[]> {
    const { start, end } = calendarRange(from, to);
    const rows: Row[] = await this.db.query("SELECT id,title,location,starts_at,kind,status FROM agent_calendar_events WHERE created_by_user_id=$1 AND starts_at >= $2 AND starts_at < $3 AND status <> 'cancelled' ORDER BY starts_at,id", [agentId, start, end]);
    return rows.map(event);
  }
  async create(agentId: number, input: unknown): Promise<AgentCalendarEvent> {
    const body = calendarInput(input);
    const [row]: Row[] = await this.db.query('INSERT INTO agent_calendar_events(created_by_user_id,title,location,starts_at,kind) VALUES ($1,$2,$3,$4,$5) RETURNING id,title,location,starts_at,kind,status', [agentId, body.title, body.location, body.startsAt, body.kind]);
    return event(row!);
  }
  async update(agentId: number, id: number, input: unknown): Promise<AgentCalendarEvent> {
    const patch = calendarPatch(input);
    return this.db.transaction(async em => {
      const [row]: Row[] = await em.query('SELECT id,title,location,starts_at,kind,status FROM agent_calendar_events WHERE id=$1 AND created_by_user_id=$2 FOR UPDATE', [id, agentId]);
      if (!row) throw new NotFoundException('Appointment not found');
      if (row.status === 'cancelled') throw new ConflictException('Cancelled appointments cannot be changed');
      const [saved]: Row[] = await em.query('WITH updated AS (UPDATE agent_calendar_events SET title=$3,location=$4,starts_at=$5,status=$6,updated_at=now() WHERE id=$1 AND created_by_user_id=$2 RETURNING id,title,location,starts_at,kind,status) SELECT * FROM updated',
        [id, agentId, patch.title ?? row.title, patch.location ?? row.location, patch.startsAt ?? row.starts_at, patch.status ?? row.status]);
      return event(saved!);
    });
  }

}
