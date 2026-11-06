import type { LeadViewing } from '@nestyk/types';
import { calendarDateKey, calendarLocalDate } from './agent-calendar-demo';
import type { CalendarViewingEvent } from './agent-calendar-viewings';

/**
 * W13 (Mos 6 Nov 2026): rules of the agent web calendar. Pure functions, no API: the page gets its rows
 * from `useAgentCalendarViewings` like the app (cancelled viewings are already left out there).
 */
export type CalendarCell = { dateKey: string; day: number; inMonth: boolean; isToday: boolean };
/** What the agent sees: upcoming, done, or still "scheduled" after its time (overdue). */
export type ViewingStateKey = 'scheduled' | 'done' | 'overdue';
export const VIEWING_STATE_KEYS: readonly ViewingStateKey[] = ['scheduled', 'done', 'overdue'];

/** Whole weeks covering the month of `visibleMonth` (YYYY-MM-DD). `weekStart` 0 = Sunday, 1 = Monday (the app). */
export function buildMonthGrid(visibleMonth: string, weekStart: 0 | 1, today: Date = new Date()): CalendarCell[] {
  const anchor = calendarLocalDate(visibleMonth);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const lead = (new Date(year, month, 1, 12).getDay() - weekStart + 7) % 7;
  const daysInMonth = new Date(year, month + 1, 0, 12).getDate();
  const total = Math.ceil((lead + daysInMonth) / 7) * 7;
  const todayKey = calendarDateKey(today);
  return Array.from({ length: total }, (_, index) => {
    const date = new Date(year, month, 1 - lead + index, 12);
    const dateKey = calendarDateKey(date);
    return { dateKey, day: date.getDate(), inMonth: date.getMonth() === month, isToday: dateKey === todayKey };
  });
}

/** First day of the month `offset` months away, as YYYY-MM-01. */
export function shiftMonth(visibleMonth: string, offset: number): string {
  const anchor = calendarLocalDate(visibleMonth);
  return calendarDateKey(new Date(anchor.getFullYear(), anchor.getMonth() + offset, 1, 12));
}

/** Same rule as `viewingIntent`: a scheduled viewing whose time has passed is overdue. Cancelled = null. */
export function viewingStateKey(viewing: LeadViewing, now: Date = new Date()): ViewingStateKey | null {
  if (viewing.status === 'done') return 'done';
  if (viewing.status !== 'scheduled') return null;
  const at = Date.parse(viewing.scheduledAt);
  return Number.isFinite(at) && at < now.getTime() ? 'overdue' : 'scheduled';
}

/** Rows whose state is switched on and whose lead or room text holds the query (case and outer spaces ignored). */
export function filterCalendarEvents(
  events: CalendarViewingEvent[],
  opts: { states: ReadonlySet<ViewingStateKey>; query: string; now?: Date },
): CalendarViewingEvent[] {
  const query = opts.query.trim().toLocaleLowerCase();
  return events.filter((event) => {
    const state = viewingStateKey(event.viewing, opts.now);
    if (!state || !opts.states.has(state)) return false;
    if (!query) return true;
    return `${event.title} ${event.location}`.toLocaleLowerCase().includes(query);
  });
}

/** Rows by day (YYYY-MM-DD), days ascending and times ascending inside a day. */
export function groupEventsByDate(events: CalendarViewingEvent[]): Map<string, CalendarViewingEvent[]> {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const groups = new Map<string, CalendarViewingEvent[]>();
  for (const event of sorted) {
    const list = groups.get(event.date);
    if (list) list.push(event);
    else groups.set(event.date, [event]);
  }
  return groups;
}

/** The hook loads a week either side; counts and the agenda use the visible month only. */
export function eventsInMonth(events: CalendarViewingEvent[], visibleMonth: string): CalendarViewingEvent[] {
  const month = visibleMonth.slice(0, 7);
  return events.filter((event) => event.date.slice(0, 7) === month);
}

export function countByState(events: CalendarViewingEvent[], now: Date = new Date()): Record<ViewingStateKey, number> {
  const counts: Record<ViewingStateKey, number> = { scheduled: 0, done: 0, overdue: 0 };
  for (const event of events) {
    const state = viewingStateKey(event.viewing, now);
    if (state) counts[state] += 1;
  }
  return counts;
}
