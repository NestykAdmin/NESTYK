import type { LeadViewing } from '@nestyk/types';
import { calendarDateKey, calendarTimeKey, type CalendarEvent } from './agent-calendar';

/** `[from, to)` ISO range covering the visible month plus a week either side, within the API's 62-day cap. */
export function calendarViewingRange(visibleMonth: string): { from: string; to: string } {
  const [year, month] = visibleMonth.split('-').map(Number);
  const from = new Date(Date.UTC(year, month - 1, 1 - 7) - 7 * 3600000);
  const to = new Date(Date.UTC(year, month, 1 + 7) - 7 * 3600000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function viewingToCalendarEvent(viewing: LeadViewing): CalendarEvent {
  const at = new Date(viewing.scheduledAt);
  const room = viewing.roomNumber ? `${viewing.roomTitle} · ${viewing.roomNumber}` : viewing.roomTitle;
  return {
    id: `viewing-${viewing.id}`,
    date: calendarDateKey(at),
    time: calendarTimeKey(at),
    source: 'lead',
    title: `${viewing.leadName} · ${viewing.roomTitle}`,
    location: room,
    status: viewing.status,
  };
}
