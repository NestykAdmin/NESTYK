import { useMemo } from 'react';
import type { DashboardSectionStatus } from '@nestyk/feature-listing';

/**
 * Self owner Dashboard data (UI round, 19 Nov 2026, ClickUp z8rcteng6b).
 * No self owner API exists yet (docs/ROLE-CHANGE-PLAN.md 5.1), so the hook returns a demo snapshot.
 * When the API lands, only `useSelfOwnerDashboard` changes; the screens read this shape.
 */
export type SelfOwnerRoomState = 'occupied' | 'listed' | 'unlisted';
export type SelfOwnerRentState = 'paid' | 'due' | 'overdue';
export type SelfOwnerWorkKind = 'overdue_rent' | 'new_interest' | 'awaiting_signature' | 'renewal';

export type SelfOwnerRoom = {
  id: string;
  title: string;
  project: string;
  monthlyRent: number;
  state: SelfOwnerRoomState;
  tenantName?: string;
  /** ISO date (YYYY-MM-DD) */
  leaseEndsAt?: string;
  interestCount?: number;
};

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
  const nextYear = year + 1;

  const rooms: SelfOwnerRoom[] = [
    { id: 'r1', title: 'ห้อง 1204', project: 'Ideo Q สยาม-ราชเทวี', monthlyRent: 18000, state: 'occupied', tenantName: 'ณัฐวุฒิ ใจดี', leaseEndsAt: `${nextYear}-03-31` },
    { id: 'r2', title: 'ห้อง 805', project: 'Life One Wireless', monthlyRent: 25000, state: 'occupied', tenantName: 'Emily Carter', leaseEndsAt: `${year}-12-31` },
    { id: 'r3', title: 'เพนต์เฮาส์ชั้น 32 วิวแม่น้ำเจ้าพระยา ห้องมุม 3 ห้องนอน', project: 'Four Seasons Private Residences', monthlyRent: 185000, state: 'occupied', tenantName: 'สมศักดิ์ วงศ์ทอง', leaseEndsAt: `${nextYear}-08-15` },
    { id: 'r4', title: 'ห้อง 417', project: 'The Base พระราม 9', monthlyRent: 15500, state: 'occupied', tenantName: 'ปิยะนุช แสงทอง', leaseEndsAt: `${nextYear}-05-31` },
    { id: 'r5', title: 'ห้อง 2101', project: 'Noble Ploenchit', monthlyRent: 42000, state: 'listed', interestCount: 3 },
    { id: 'r6', title: 'ห้อง 309', project: 'Aspire สาทร-ท่าพระ', monthlyRent: 12000, state: 'unlisted' },
  ];

  const rent: SelfOwnerRent[] = [
    { id: 'p1', roomTitle: 'ห้อง 1204', tenantName: 'ณัฐวุฒิ ใจดี', amount: 18000, state: 'paid', dueDate: `${ym}-05` },
    { id: 'p2', roomTitle: 'ห้อง 805', tenantName: 'Emily Carter', amount: 25000, state: 'overdue', dueDate: `${ym}-01`, overdueDays: 3 },
    { id: 'p3', roomTitle: 'เพนต์เฮาส์ชั้น 32 วิวแม่น้ำเจ้าพระยา ห้องมุม 3 ห้องนอน', tenantName: 'สมศักดิ์ วงศ์ทอง', amount: 185000, state: 'paid', dueDate: `${ym}-01` },
    { id: 'p4', roomTitle: 'ห้อง 417', tenantName: 'ปิยะนุช แสงทอง', amount: 15500, state: 'due', dueDate: `${ym}-25` },
  ];

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
