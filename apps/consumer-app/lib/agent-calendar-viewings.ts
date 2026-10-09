import type { LeadViewing } from '@nestyk/types';
import { calendarDateKey, calendarLocalDate, type CalendarDemoEvent } from './agent-calendar-demo';

/** `[from, to)` ISO range covering the visible month plus a week either side, within the API's 62-day cap. */
export function calendarViewingRange(visibleMonth: string): { from: string; to: string } {
  const start = calendarLocalDate(visibleMonth);
  const from = new Date(start.getFullYear(), start.getMonth(), 1 - 7);
  const to = new Date(start.getFullYear(), start.getMonth() + 1, 1 + 7);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function viewingToCalendarEvent(viewing: LeadViewing): CalendarDemoEvent {
  const at = new Date(viewing.scheduledAt);
  const room = viewing.roomNumber ? `${viewing.roomTitle} · ${viewing.roomNumber}` : viewing.roomTitle;
  return {
    id: `viewing-${viewing.id}`,
    date: calendarDateKey(at),
    time: `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`,
    kind: 'viewing',
    title: `${viewing.leadName} · ${viewing.roomTitle}`,
    location: room,
    status: 'confirmed',
  };
}
