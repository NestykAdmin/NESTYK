import { useMemo } from 'react';
import type { DashboardSectionStatus } from '@nestyk/feature-listing';

/**
 * Self owner rooms (UI round, 19 Nov 2026, ClickUp z8rcteng6c). One demo room set shared by the Dashboard
 * and the rooms page until the self owner API exists; `useSelfOwnerRooms` is the one place to swap for it.
 */
export type SelfOwnerRoomState = 'occupied' | 'listed' | 'unlisted';

export type SelfOwnerRoom = {
  id: string;
  title: string;
  project: string;
  monthlyRent: number;
  state: SelfOwnerRoomState;
  /** 0 = studio */
  bedrooms: number;
  sizeSqm: number;
  /** ISO timestamp */
  updatedAt: string;
  tenantName?: string;
  /** ISO date (YYYY-MM-DD) */
  leaseEndsAt?: string;
  interestCount?: number;
};

export type SelfOwnerRoomFilter = 'all' | SelfOwnerRoomState;
export type SelfOwnerRoomSort = 'updated_desc' | 'updated_asc' | 'rent_asc' | 'rent_desc';
/** Table columns that sort (web table view sorts from the column headers, like the agent rooms page). */
export type SelfOwnerSortColumn = 'rent' | 'updated';

export const SELF_OWNER_ROOMS_PAGE_SIZE = 10;

type DemoRoom = Omit<SelfOwnerRoom, 'updatedAt' | 'leaseEndsAt'> & { updatedDaysAgo: number; leaseEnds?: [yearOffset: number, monthDay: string] };

const DEMO_ROOMS: DemoRoom[] = [
  { id: 'r1', title: 'ห้อง 1204', project: 'Ideo Q สยาม-ราชเทวี', monthlyRent: 18000, state: 'occupied', bedrooms: 1, sizeSqm: 34, tenantName: 'ณัฐวุฒิ ใจดี', leaseEnds: [1, '03-31'], updatedDaysAgo: 12 },
  { id: 'r2', title: 'ห้อง 805', project: 'Life One Wireless', monthlyRent: 25000, state: 'occupied', bedrooms: 1, sizeSqm: 42, tenantName: 'Emily Carter', leaseEnds: [0, '12-31'], updatedDaysAgo: 2 },
  { id: 'r3', title: 'เพนต์เฮาส์ชั้น 32 วิวแม่น้ำเจ้าพระยา ห้องมุม 3 ห้องนอน', project: 'Four Seasons Private Residences', monthlyRent: 185000, state: 'occupied', bedrooms: 3, sizeSqm: 245, tenantName: 'สมศักดิ์ วงศ์ทอง', leaseEnds: [1, '08-15'], updatedDaysAgo: 30 },
  { id: 'r4', title: 'ห้อง 417', project: 'The Base พระราม 9', monthlyRent: 15500, state: 'occupied', bedrooms: 1, sizeSqm: 28, tenantName: 'ปิยะนุช แสงทอง', leaseEnds: [1, '05-31'], updatedDaysAgo: 7 },
  { id: 'r5', title: 'ห้อง 2101', project: 'Noble Ploenchit', monthlyRent: 42000, state: 'listed', bedrooms: 2, sizeSqm: 68, interestCount: 3, updatedDaysAgo: 0 },
  { id: 'r6', title: 'ห้อง 309', project: 'Aspire สาทร-ท่าพระ', monthlyRent: 12000, state: 'unlisted', bedrooms: 0, sizeSqm: 24, updatedDaysAgo: 45 },
  { id: 'r7', title: 'ห้อง 1510', project: 'Rhythm สุขุมวิท 36-38', monthlyRent: 28000, state: 'occupied', bedrooms: 1, sizeSqm: 45, tenantName: 'Kenji Watanabe', leaseEnds: [1, '01-31'], updatedDaysAgo: 18 },
  { id: 'r8', title: 'ห้อง 702', project: 'Lumpini Suite ดินแดง', monthlyRent: 9500, state: 'occupied', bedrooms: 0, sizeSqm: 23, tenantName: 'ธนพล ศรีสุข', leaseEnds: [1, '06-30'], updatedDaysAgo: 60 },
  { id: 'r9', title: 'ห้อง 1803', project: 'Noble Revo สยาม', monthlyRent: 35000, state: 'listed', bedrooms: 1, sizeSqm: 48, interestCount: 1, updatedDaysAgo: 4 },
  { id: 'r10', title: 'ห้อง 2208', project: 'Ashton อโศก', monthlyRent: 55000, state: 'occupied', bedrooms: 2, sizeSqm: 70, tenantName: 'Li Wei', leaseEnds: [1, '02-28'], updatedDaysAgo: 9 },
  { id: 'r11', title: 'ห้อง 612', project: 'Ideo Mobi พญาไท', monthlyRent: 16000, state: 'occupied', bedrooms: 1, sizeSqm: 30, tenantName: 'วรรณา ทองดี', leaseEnds: [1, '04-30'], updatedDaysAgo: 21 },
  { id: 'r12', title: 'ห้อง 1106', project: 'Supalai Premier อโศก', monthlyRent: 22000, state: 'listed', bedrooms: 1, sizeSqm: 40, interestCount: 0, updatedDaysAgo: 1 },
  { id: 'r13', title: 'ห้อง 905', project: 'The Line จตุจักร-หมอชิต', monthlyRent: 19500, state: 'occupied', bedrooms: 1, sizeSqm: 35, tenantName: 'Sarah Kim', leaseEnds: [1, '10-31'], updatedDaysAgo: 40 },
  { id: 'r14', title: 'ห้อง 2502', project: 'Park Origin พระราม 4', monthlyRent: 31000, state: 'unlisted', bedrooms: 1, sizeSqm: 41, updatedDaysAgo: 3 },
];

/** Deterministic demo rooms; never live data. */
export function createSelfOwnerRoomsDemo(now: Date = new Date()): SelfOwnerRoom[] {
  const year = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric' }).format(now));
  return DEMO_ROOMS.map(({ updatedDaysAgo, leaseEnds, ...room }) => ({
    ...room,
    updatedAt: new Date(now.getTime() - updatedDaysAgo * 86_400_000).toISOString(),
    ...(leaseEnds ? { leaseEndsAt: `${year + leaseEnds[0]}-${leaseEnds[1]}` } : {}),
  }));
}

const tieBreak = (a: SelfOwnerRoom, b: SelfOwnerRoom) => a.id.localeCompare(b.id, 'en', { numeric: true });

/** Search (room, project or tenant; trimmed, case-insensitive), then state filter, then sort. Input is not mutated. */
export function filterSelfOwnerRooms(
  rooms: SelfOwnerRoom[],
  q: string,
  filter: SelfOwnerRoomFilter,
  sort: SelfOwnerRoomSort,
): SelfOwnerRoom[] {
  const needle = q.trim().toLowerCase();
  const out = rooms.filter(
    (room) =>
      (filter === 'all' || room.state === filter) &&
      (!needle || [room.title, room.project, room.tenantName ?? ''].some((text) => text.toLowerCase().includes(needle))),
  );
  if (sort === 'rent_asc') return out.sort((a, b) => a.monthlyRent - b.monthlyRent || tieBreak(a, b));
  if (sort === 'rent_desc') return out.sort((a, b) => b.monthlyRent - a.monthlyRent || tieBreak(a, b));
  if (sort === 'updated_asc') return out.sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt) || tieBreak(a, b));
  return out.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || tieBreak(a, b));
}

export function sortToColumn(sort: SelfOwnerRoomSort): { key: SelfOwnerSortColumn; direction: 'asc' | 'desc' } {
  const [key, direction] = sort.split('_') as [SelfOwnerSortColumn, 'asc' | 'desc'];
  return { key, direction };
}

/** Header click → room sort; a column without a sort falls back to newest first. */
export function columnToSort(key: string, direction: 'asc' | 'desc'): SelfOwnerRoomSort {
  return key === 'rent' || key === 'updated' ? (`${key}_${direction}` as SelfOwnerRoomSort) : 'updated_desc';
}

/** Pager buttons like the agent rooms page: every page up to 7, else first · around the current page · last, with gaps (null). */
export function pageButtons(page: number, pages: number): Array<number | null> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const lo = Math.max(1, Math.min(page - 1, pages - 2));
  const hi = lo + 2;
  const window = [lo, lo + 1, hi];
  return [
    ...(lo > 1 ? [1] : []),
    ...(lo > 2 ? [null] : []),
    ...window,
    ...(hi < pages - 1 ? [null] : []),
    ...(hi < pages ? [pages] : []),
  ];
}

export function countSelfOwnerRooms(rooms: SelfOwnerRoom[]): Record<SelfOwnerRoomFilter, number> {
  const count = (state: SelfOwnerRoomState) => rooms.filter((room) => room.state === state).length;
  return { all: rooms.length, occupied: count('occupied'), listed: count('listed'), unlisted: count('unlisted') };
}

/** 1-based page kept inside the results (back to page 1 when a filter leaves fewer pages). */
export function clampPage(page: number, total: number, size: number = SELF_OWNER_ROOMS_PAGE_SIZE): number {
  const pages = Math.max(1, Math.ceil(total / size));
  return Math.min(Math.max(1, Math.floor(page) || 1), pages);
}

/** The owner's rooms. Demo only until the self owner API exists. */
export function useSelfOwnerRooms(): { status: DashboardSectionStatus; rooms: SelfOwnerRoom[]; isDemoPreview: boolean } {
  return useMemo(() => ({ status: 'demo' as DashboardSectionStatus, rooms: createSelfOwnerRoomsDemo(), isDemoPreview: true }), []);
}
