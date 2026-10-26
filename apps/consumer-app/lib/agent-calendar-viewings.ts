import { useEffect, useState } from 'react';
import type { LeadViewing } from '@nestyk/types';
import { calendarDateKey, calendarLocalDate } from './agent-calendar-demo';
import { listAgentViewings } from './agent-leads-api';

export interface CalendarViewingEvent {
  id: string;
  date: string;
  time: string;
  title: string;
  location: string;
  status: LeadViewing['status'];
  viewing: LeadViewing;
}

type CalendarStatus = 'loading' | 'available' | 'error';
type CalendarInput = {
  enabled: boolean;
  accountId: string | null;
  visibleMonth: string;
  refreshToken: number;
  onSettled?: (token: number) => void;
};

/** A response belongs only to the account, month and refresh that requested it. */
export function useAgentCalendarViewings({ enabled, accountId, visibleMonth, refreshToken, onSettled }: CalendarInput): {
  status: CalendarStatus;
  viewings: LeadViewing[];
} {
  const [result, setResult] = useState<{
    accountId: string;
    visibleMonth: string;
    refreshToken: number;
    status: CalendarStatus;
    viewings: LeadViewing[];
  } | null>(null);

  useEffect(() => {
    if (!enabled || !accountId) {
      setResult(null);
      return;
    }
    let active = true;
    const { from, to } = calendarViewingRange(visibleMonth);
    listAgentViewings(from, to).then(viewings => {
      if (active) setResult({ accountId, visibleMonth, refreshToken, status: 'available', viewings: viewings.filter(row => row.status !== 'cancelled') });
    }).catch(() => {
      if (active) setResult({ accountId, visibleMonth, refreshToken, status: 'error', viewings: [] });
    }).finally(() => {
      if (active) onSettled?.(refreshToken);
    });
    return () => { active = false; };
  }, [enabled, accountId, visibleMonth, refreshToken, onSettled]);

  return enabled && accountId && result?.accountId === accountId && result.visibleMonth === visibleMonth && result.refreshToken === refreshToken
    ? result
    : { status: 'loading', viewings: [] };
}

/** `[from, to)` ISO range covering the visible month plus a week either side, within the API's 62-day cap. */
export function calendarViewingRange(visibleMonth: string): { from: string; to: string } {
  const start = calendarLocalDate(visibleMonth);
  const from = new Date(start.getFullYear(), start.getMonth(), 1 - 7);
  const to = new Date(start.getFullYear(), start.getMonth() + 1, 1 + 7);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function viewingToCalendarEvent(viewing: LeadViewing): CalendarViewingEvent {
  const at = new Date(viewing.scheduledAt);
  const room = viewing.roomNumber ? `${viewing.roomTitle} · ${viewing.roomNumber}` : viewing.roomTitle;
  return {
    id: `viewing-${viewing.id}`,
    date: calendarDateKey(at),
    time: `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`,
    title: `${viewing.leadName} · ${viewing.roomTitle}`,
    location: room,
    status: viewing.status,
    viewing,
  };
}
