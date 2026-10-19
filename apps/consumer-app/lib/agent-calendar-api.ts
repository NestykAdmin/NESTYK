import type { AgentCalendarEvent, CreateAgentCalendarEvent, UpdateAgentCalendarEvent } from '@nestyk/types';
import { apiGet, apiPost, apiPatch } from './api';
import { ensureAgentSession } from './agent-session';

export async function listCalendarEvents(from: string, to: string): Promise<AgentCalendarEvent[]> {
  await ensureAgentSession();
  return apiGet(`/agent/calendar/events?${new URLSearchParams({ from, to })}`);
}
export async function createCalendarEvent(body: CreateAgentCalendarEvent): Promise<AgentCalendarEvent> {
  await ensureAgentSession();
  return apiPost('/agent/calendar/events', body);
}

export async function updateCalendarEvent(id: string, body: UpdateAgentCalendarEvent): Promise<AgentCalendarEvent> {
  await ensureAgentSession();
  if (!/^event-[1-9]\d*$/.test(id)) throw new Error('Invalid appointment');
  return apiPatch(`/agent/calendar/events/${id.slice(6)}`, body);
}
