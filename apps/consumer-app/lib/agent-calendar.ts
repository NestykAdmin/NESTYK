import type { AgentCalendarEvent, CreateAgentCalendarEvent } from '@nestyk/types';

export const CALENDAR_TIMEZONE = 'Asia/Bangkok';
const BANGKOK_OFFSET = 7 * 3600000;
export interface CalendarEvent {
  id: string;
  date: string;
  time: string;
  source: 'lead' | 'manual';
  title: string;
  location: string;
  status: 'scheduled' | 'done' | 'cancelled';
}
export type CalendarEventInput = Omit<CalendarEvent, 'id' | 'source' | 'status'>;
export type CalendarSource = CalendarEvent['source'];

/** Business dates always use Bangkok, independently of the device timezone. */
export function calendarDateKey(date: Date): string {
  return new Date(+date + BANGKOK_OFFSET).toISOString().slice(0, 10);
}
export function calendarTimeKey(date: Date): string {
  return new Date(+date + BANGKOK_OFFSET).toISOString().slice(11, 16);
}
export function calendarDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+07:00`);
}
/** Bangkok noon, for date-only labels formatted with CALENDAR_TIMEZONE. */
export function calendarLocalDate(key: string): Date {
  return calendarDateTime(key, '12:00');
}
export function calendarDayRange(key: string): { from: string; to: string } {
  const from = calendarDateTime(key, '00:00');
  return { from: from.toISOString(), to: new Date(+from + 86400000).toISOString() };
}
export function calendarMonthSelection(selected: string, visibleMonth: string, offset: number) {
  const [year, month] = visibleMonth.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + offset, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(Number(selected.slice(8, 10)), lastDay);
  const key = target.toISOString().slice(0, 7);
  return { month: `${key}-01`, date: `${key}-${String(day).padStart(2, '0')}` };
}
export function calendarEventFromApi(event: AgentCalendarEvent): CalendarEvent {
  const at = new Date(event.startsAt);
  return { id: event.id, date: calendarDateKey(at), time: calendarTimeKey(at), title: event.title, location: event.location,
    status: event.status === 'cancelled' ? 'cancelled' : 'scheduled', source: 'manual' };
}
export function calendarEventInput(event: CalendarEventInput): CreateAgentCalendarEvent {
  return { title: event.title, location: event.location, startsAt: calendarDateTime(event.date, event.time).toISOString() };
}
/** A warning only: appointments have no duration yet, so use the existing one-hour proximity rule. */
export function nearbyCalendarEvent(events: CalendarEvent[], date: string, time: string, excludeId?: string): CalendarEvent | undefined {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return undefined;
  const at = +calendarDateTime(date, time);
  return events.filter(event => event.id !== excludeId && (event.source === 'manual' ? event.status !== 'cancelled' : event.status === 'scheduled'))
    .sort((a, b) => Math.abs(+calendarDateTime(a.date, a.time) - at) - Math.abs(+calendarDateTime(b.date, b.time) - at))
    .find(event => Math.abs(+calendarDateTime(event.date, event.time) - at) < 3600000);
}
