import { useMemo } from 'react';
import type { DashboardSectionStatus } from '@nestyk/feature-listing';
import { createSelfOwnerRoomsDemo, useSelfOwnerRooms, type SelfOwnerRoom } from './self-owner-rooms';
import { createSelfOwnerContractsDemo, groupSelfOwnerContracts, selfOwnerRentForMonth, type SelfOwnerRent, type SelfOwnerRentState } from './self-owner-contracts';

export type { SelfOwnerRoom, SelfOwnerRoomState } from './self-owner-rooms';

/**
 * Self owner Dashboard data (UI round, 19 Nov 2026, ClickUp z8rcteng6b).
 * No self owner API exists yet (docs/ROLE-CHANGE-PLAN.md 5.1), so the hook returns a demo snapshot.
 * When the API lands, only `useSelfOwnerDashboard` changes; the screens read this shape.
 */
// Rent rows live with the contracts (24 Nov 2026): the income page and this Dashboard read one demo set.
export type { SelfOwnerRent, SelfOwnerRentState } from './self-owner-contracts';
export type SelfOwnerWorkKind = 'overdue_rent' | 'new_interest' | 'awaiting_signature' | 'renewal';

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
  /** The owner's rooms (the shared room store); defaults to the demo set. */
  rooms?: SelfOwnerRoom[];
  /** Load state of `rooms` (the API rooms once connected); the demo set is 'demo'. */
  roomsStatus?: DashboardSectionStatus;
}): SelfOwnerDashboardSnapshot {
  const now = input.now ?? new Date();
  const today = bangkokYmd(now);
  const [year, month] = today.split('-').map(Number);

  const rooms = input.rooms ?? createSelfOwnerRoomsDemo(now);
  // Rent this month and the contract to-dos come from the demo contracts (always demo, like the income page), so the
  // numbers here agree with the income page even when the rooms above are the owner's real rooms (24 Nov 2026).
  const contracts = createSelfOwnerContractsDemo(now);
  const rent: SelfOwnerRent[] = selfOwnerRentForMonth(contracts, year, month, now);

  const viewings: SelfOwnerViewing[] = [
    { id: 'v1', startsAt: `${today}T10:30:00+07:00`, roomTitle: 'ห้อง 2101', contactName: 'คุณกานต์' },
    { id: 'v2', startsAt: `${today}T16:00:00+07:00`, roomTitle: 'ห้อง 2101', contactName: 'Mr. Tanaka' },
  ];

  return {
    isDemoPreview: true,
    greetingName: input.greetingName,
    localDateLabel: input.localDateLabel,
    currency: 'THB',
    rooms: { status: input.roomsStatus ?? 'demo', items: rooms },
    rent: { status: 'demo', periodYear: year, periodMonth: month, items: rent },
    todo: {
      status: 'demo',
      items: [
        { kind: 'overdue_rent', count: rent.filter((row) => row.state === 'overdue').length },
        { kind: 'new_interest', count: rooms.reduce((total, room) => total + (room.interestCount ?? 0), 0) },
        { kind: 'awaiting_signature', count: contracts.filter((c) => c.status === 'awaiting_signature').length },
        // Rooms whose lease ends soon and have no renewal awaiting signature yet (contract kinds, Jom 24 Nov 2026).
        {
          kind: 'renewal',
          count: groupSelfOwnerContracts(contracts).filter(
            (room) => room.status === 'ending_soon' && !room.contracts.some((c) => c.kind === 'renewal' && c.status === 'awaiting_signature'),
          ).length,
        },
      ],
    },
    viewings: { status: 'demo', items: viewings },
  };
}

/** The self owner Dashboard data: rooms from the room store (the API once connected); rent, to-dos and viewings are demo. */
export function useSelfOwnerDashboard(input: { greetingName: string; locale: SelfOwnerLocale }): SelfOwnerDashboardSnapshot {
  const { greetingName, locale } = input;
  const { rooms, status: roomsStatus } = useSelfOwnerRooms();
  return useMemo(() => {
    const localDateLabel = new Date().toLocaleDateString(SELF_OWNER_LOCALE_TAG[locale], {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Bangkok',
    });
    return createSelfOwnerDashboardDemoFixture({ greetingName, localDateLabel, rooms, roomsStatus });
  }, [greetingName, locale, rooms, roomsStatus]);
}
