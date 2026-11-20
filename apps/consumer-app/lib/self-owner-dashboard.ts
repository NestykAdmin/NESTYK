import { useMemo } from 'react';
import type { DashboardSectionStatus } from '@nestyk/feature-listing';
import { createSelfOwnerRoomsDemo, type SelfOwnerRoom } from './self-owner-rooms';

export type { SelfOwnerRoom, SelfOwnerRoomState } from './self-owner-rooms';

/**
 * Self owner Dashboard data (UI round, 19 Nov 2026, ClickUp z8rcteng6b).
 * No self owner API exists yet (docs/ROLE-CHANGE-PLAN.md 5.1), so the hook returns a demo snapshot.
 * When the API lands, only `useSelfOwnerDashboard` changes; the screens read this shape.
 */
export type SelfOwnerRentState = 'paid' | 'due' | 'overdue';
export type SelfOwnerWorkKind = 'overdue_rent' | 'new_interest' | 'awaiting_signature' | 'renewal';

export type SelfOwnerRent = {
  id: string;
  roomTitle: string;
  tenantName: string;
  amount: number;
  state: SelfOwnerRentState;
  /** ISO date (YYYY-MM-DD) */
  dueDate: string;
  overdueDays?: number;
};

export type SelfOwnerViewing = { id: string; startsAt: string; roomTitle: string; contactName: string };

export type SelfOwnerDashboardSnapshot = {
  isDemoPreview: boolean;
  greetingName: string;
  localDateLabel: string;
  currency: string;
  rooms: { status: DashboardSectionStatus; items: SelfOwnerRoom[] };
  rent: { status: DashboardSectionStatus; periodYear: number; periodMonth: number; items: SelfOwnerRent[] };
  todo: { status: DashboardSectionStatus; items: Array<{ kind: SelfOwnerWorkKind; count: number }> };
  viewings: { status: DashboardSectionStatus; items: SelfOwnerViewing[] };
};

export type SelfOwnerLocale = 'th' | 'en' | 'ja' | 'zh';

/** How many rows each Dashboard list shows before "view all" (agent overview: 5 rooms, 4 appointments). */
export const SELF_OWNER_PREVIEW = { rooms: 5, rent: 5, viewings: 4 } as const;

export const SELF_OWNER_LOCALE_TAG: Record<SelfOwnerLocale, string> = {
  th: 'th-TH-u-ca-gregory',
  en: 'en-GB',
  ja: 'ja-JP',
  zh: 'zh-CN',
};

export function summarizeRooms(items: SelfOwnerRoom[]): { total: number; occupied: number; vacant: number } {
  const occupied = items.filter((room) => room.state === 'occupied').length;
  return { total: items.length, occupied, vacant: items.length - occupied };
}

export function summarizeRent(items: SelfOwnerRent[]): { total: number; received: number; overdue: number } {
  const sum = (state?: SelfOwnerRentState) =>
    items.filter((row) => !state || row.state === state).reduce((total, row) => total + row.amount, 0);
  return { total: sum(), received: sum('paid'), overdue: sum('overdue') };
}

/** YYYY-MM-DD of `date` in Bangkok. */
function bangkokYmd(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(date);
}

/** Deterministic demo data for the layout; never live data. */
export function createSelfOwnerDashboardDemoFixture(input: {
  greetingName: string;
  localDateLabel: string;
  now?: Date;
}): SelfOwnerDashboardSnapshot {
  const now = input.now ?? new Date();
  const today = bangkokYmd(now);
  const [year, month] = today.split('-').map(Number);
  const ym = `${year}-${String(month).padStart(2, '0')}`;

  const rooms = createSelfOwnerRoomsDemo(now);
  // Rent this month for every rented room; a few rooms are due later or overdue so each state shows.
  const rentPlan: Record<string, { state: SelfOwnerRentState; day: string; overdueDays?: number }> = {
    r2: { state: 'overdue', day: '01', overdueDays: 3 },
    r11: { state: 'overdue', day: '10', overdueDays: 6 },
    r4: { state: 'due', day: '25' },
    r10: { state: 'due', day: '28' },
  };
  const rent: SelfOwnerRent[] = rooms
    .filter((room) => room.state === 'occupied')
    .map((room) => {
      const plan = rentPlan[room.id] ?? { state: 'paid' as const, day: '05' };
      return {
        id: `p-${room.id}`,
        roomTitle: room.title,
        tenantName: room.tenantName ?? '',
        amount: room.monthlyRent,
        state: plan.state,
        dueDate: `${ym}-${plan.day}`,
        ...(plan.overdueDays ? { overdueDays: plan.overdueDays } : {}),
      };
    });

  const viewings: SelfOwnerViewing[] = [
    { id: 'v1', startsAt: `${today}T10:30:00+07:00`, roomTitle: 'ห้อง 2101', contactName: 'คุณกานต์' },
    { id: 'v2', startsAt: `${today}T16:00:00+07:00`, roomTitle: 'ห้อง 2101', contactName: 'Mr. Tanaka' },
  ];

  return {
    isDemoPreview: true,
    greetingName: input.greetingName,
    localDateLabel: input.localDateLabel,
    currency: 'THB',
    rooms: { status: 'demo', items: rooms },
    rent: { status: 'demo', periodYear: year, periodMonth: month, items: rent },
    todo: {
      status: 'demo',
      items: [
        { kind: 'overdue_rent', count: rent.filter((row) => row.state === 'overdue').length },
        { kind: 'new_interest', count: rooms.reduce((total, room) => total + (room.interestCount ?? 0), 0) },
        { kind: 'awaiting_signature', count: 1 },
        { kind: 'renewal', count: 1 },
      ],
    },
    viewings: { status: 'demo', items: viewings },
  };
}

/** The self owner Dashboard data. Demo only until the self owner API exists. */
export function useSelfOwnerDashboard(input: { greetingName: string; locale: SelfOwnerLocale }): SelfOwnerDashboardSnapshot {
  const { greetingName, locale } = input;
  return useMemo(() => {
    const localDateLabel = new Date().toLocaleDateString(SELF_OWNER_LOCALE_TAG[locale], {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Bangkok',
    });
    return createSelfOwnerDashboardDemoFixture({ greetingName, localDateLabel });
  }, [greetingName, locale]);
}
