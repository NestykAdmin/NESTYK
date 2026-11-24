import { useMemo } from 'react';
import { createSelfOwnerRoomsDemo, type SelfOwnerRoom } from './self-owner-rooms';

/**
 * Self owner contracts and rent income (UI round, 24 Nov 2026, ClickUp z8rcteng6e / z8rcteng6f).
 * The owner only reads them: NESTYK admin will create contracts (Jom 24 Nov 2026). No admin or API yet, so the
 * hooks return demo data; when the API lands, only `useSelfOwnerContracts` / `useSelfOwnerIncome` change.
 * The Dashboard's rent and to-do sections read the same demo set, so the numbers agree.
 */
export type SelfOwnerContractStatus = 'active' | 'ending_soon' | 'awaiting_signature' | 'ended';
export type SelfOwnerContractFilter = 'all' | SelfOwnerContractStatus;

export type SelfOwnerContract = {
  id: string;
  roomId: string;
  roomTitle: string;
  project: string;
  tenantName: string;
  tenantPhone: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  monthlyRent: number;
  advanceRentMonths: number;
  depositMonths: number;
  status: SelfOwnerContractStatus;
  /** Days to the end date; only when ending soon. */
  daysLeft?: number;
};

export type SelfOwnerRentState = 'paid' | 'due' | 'overdue';

export type SelfOwnerRent = {
  id: string;
  roomTitle: string;
  /** The room's project: an owner can have rooms in several projects (Jom 24 Nov 2026). */
  project: string;
  tenantName: string;
  amount: number;
  state: SelfOwnerRentState;
  /** YYYY-MM-DD */
  dueDate: string;
  /** YYYY-MM-DD; only when paid. */
  paidAt?: string;
  overdueDays?: number;
};

export type SelfOwnerMonth = { year: number; month: number };

/** A contract with this many days or fewer left is "ending soon". */
export const SELF_OWNER_ENDING_SOON_DAYS = 60;

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const toUtc = (date: string) => Date.parse(`${date}T00:00:00Z`);
const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** Month `m` of year `y` moved by `delta` months. */
function shiftMonth(y: number, m: number, delta: number): SelfOwnerMonth {
  const index = y * 12 + (m - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}
function bangkokToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now);
}
/** The day after `end` one year earlier: a 12-month term ending on `end`. */
function twelveMonthsBefore(end: string): string {
  const [y, m, d] = end.split('-').map(Number);
  const next = new Date(Date.UTC(y - 1, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}
/** The last day of a 12-month term starting on `start`. */
function twelveMonthsFrom(start: string): string {
  const [y, m, d] = start.split('-').map(Number);
  return new Date(Date.UTC(y + 1, m - 1, d - 1)).toISOString().slice(0, 10);
}

/** Demo phone per room (fixed, all different). */
const DEMO_PHONES: Record<string, string> = {
  r1: '081-234-5601', r2: '089-112-3402', r3: '086-555-0103', r4: '084-321-7704', r5: '082-908-1105',
  r6: '087-640-2206', r7: '090-117-8807', r8: '083-276-4408', r10: '095-880-1210', r11: '088-019-3311', r13: '091-472-6613',
};
/** Rent of this month that is still unpaid, by room, and its due day (the Dashboard's plan before 24 Nov 2026). */
const UNPAID_THIS_MONTH: Record<string, number> = { r2: 1, r11: 10, r4: 25, r10: 28 };
const DUE_DAY = 5;
const PAID_DAY = 3;

function contractOf(room: SelfOwnerRoom, fields: Partial<SelfOwnerContract> & Pick<SelfOwnerContract, 'tenantName' | 'startDate' | 'endDate'>): SelfOwnerContract {
  return {
    id: `c-${room.id}`,
    roomId: room.id,
    roomTitle: room.title,
    project: room.project,
    tenantPhone: DEMO_PHONES[room.id] ?? '080-000-0000',
    monthlyRent: room.monthlyRent,
    advanceRentMonths: 1,
    depositMonths: 2,
    status: 'active',
    ...fields,
  };
}

function statusOn(contract: SelfOwnerContract, today: string): SelfOwnerContract {
  if (contract.status === 'awaiting_signature') return contract;
  const left = daysBetween(today, contract.endDate);
  if (left < 0) return { ...contract, status: 'ended' };
  if (left <= SELF_OWNER_ENDING_SOON_DAYS) return { ...contract, status: 'ending_soon', daysLeft: left };
  return { ...contract, status: 'active' };
}

/** Deterministic demo contracts from the demo rooms; never live data. */
export function createSelfOwnerContractsDemo(now: Date = new Date()): SelfOwnerContract[] {
  const today = bangkokToday(now);
  const [year, month] = today.split('-').map(Number);
  const firstOfPrevious = (() => {
    const p = shiftMonth(year, month, -1);
    return ymd(p.year, p.month, 1);
  })();
  const contracts: SelfOwnerContract[] = [];
  for (const room of createSelfOwnerRoomsDemo(now)) {
    if (room.state === 'occupied' && room.leaseEndsAt) {
      const start = twelveMonthsBefore(room.leaseEndsAt);
      contracts.push(contractOf(room, {
        tenantName: room.tenantName ?? '',
        startDate: start > today ? firstOfPrevious : start,
        endDate: room.leaseEndsAt,
      }));
    } else if (room.id === 'r5') {
      const next = shiftMonth(year, month, 1);
      const start = ymd(next.year, next.month, 1);
      contracts.push(contractOf(room, { tenantName: 'คุณกานต์', startDate: start, endDate: twelveMonthsFrom(start), status: 'awaiting_signature' }));
    } else if (room.id === 'r6') {
      const ended = shiftMonth(year, month, -2);
      const end = ymd(ended.year, ended.month, lastDay(ended.year, ended.month));
      contracts.push(contractOf(room, { tenantName: 'มานพ ดีงาม', startDate: twelveMonthsBefore(end), endDate: end }));
    }
  }
  return contracts.map((contract) => statusOn(contract, today));
}

export function countSelfOwnerContracts(list: SelfOwnerContract[]): Record<SelfOwnerContractFilter, number> {
  const counts: Record<SelfOwnerContractFilter, number> = { all: list.length, active: 0, ending_soon: 0, awaiting_signature: 0, ended: 0 };
  for (const contract of list) counts[contract.status] += 1;
  return counts;
}

const STATUS_ORDER: SelfOwnerContractStatus[] = ['awaiting_signature', 'ending_soon', 'active', 'ended'];

/** Search (room, project or tenant; trimmed, case-insensitive), then status; work first. Input is not mutated. */
export function filterSelfOwnerContracts(list: SelfOwnerContract[], q: string, filter: SelfOwnerContractFilter): SelfOwnerContract[] {
  const needle = q.trim().toLocaleLowerCase();
  return list
    .filter((c) => filter === 'all' || c.status === filter)
    .filter((c) => !needle || [c.roomTitle, c.project, c.tenantName].some((text) => text.toLocaleLowerCase().includes(needle)))
    .sort((a, b) => {
      const byStatus = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      if (byStatus) return byStatus;
      if (a.status === 'ended') return b.endDate.localeCompare(a.endDate);
      return a.endDate.localeCompare(b.endDate) || a.id.localeCompare(b.id, 'en', { numeric: true });
    });
}

/** Rent of one month for the contracts that run in it (not the ones awaiting signature). Future months are empty. */
export function selfOwnerRentForMonth(contracts: SelfOwnerContract[], year: number, month: number, now: Date = new Date()): SelfOwnerRent[] {
  const today = bangkokToday(now);
  const [thisYear, thisMonth] = today.split('-').map(Number);
  const key = year * 12 + month;
  const current = thisYear * 12 + thisMonth;
  if (key > current) return [];
  const first = ymd(year, month, 1);
  const last = ymd(year, month, lastDay(year, month));
  return contracts
    .filter((c) => c.status !== 'awaiting_signature' && c.startDate <= last && c.endDate >= first)
    .map((c) => {
      const base = { id: `p-${c.roomId}-${year}-${pad(month)}`, roomTitle: c.roomTitle, project: c.project, tenantName: c.tenantName, amount: c.monthlyRent };
      const unpaidDay = key === current ? UNPAID_THIS_MONTH[c.roomId] : undefined;
      const dueDate = ymd(year, month, unpaidDay ?? DUE_DAY);
      if (unpaidDay === undefined && dueDate <= today) return { ...base, state: 'paid' as const, dueDate, paidAt: ymd(year, month, PAID_DAY) };
      if (dueDate < today) return { ...base, state: 'overdue' as const, dueDate, overdueDays: daysBetween(dueDate, today) };
      return { ...base, state: 'due' as const, dueDate };
    });
}

/** Months that have rent to show: from the oldest contract start (not awaiting signature) to this month, oldest first. */
export function selfOwnerIncomeMonths(contracts: SelfOwnerContract[], now: Date = new Date()): SelfOwnerMonth[] {
  const [thisYear, thisMonth] = bangkokToday(now).split('-').map(Number);
  const starts = contracts.filter((c) => c.status !== 'awaiting_signature').map((c) => c.startDate).sort();
  if (!starts.length) return [{ year: thisYear, month: thisMonth }];
  const [startYear, startMonth] = starts[0].split('-').map(Number);
  const months: SelfOwnerMonth[] = [];
  for (let index = startYear * 12 + startMonth - 1; index <= thisYear * 12 + thisMonth - 1; index++) {
    months.push({ year: Math.floor(index / 12), month: (index % 12) + 1 });
  }
  return months;
}

/** The owner's contracts (demo until the admin side and its API exist). */
export function useSelfOwnerContracts(): { status: 'demo'; isDemoPreview: true; contracts: SelfOwnerContract[] } {
  return useMemo(() => ({ status: 'demo' as const, isDemoPreview: true as const, contracts: createSelfOwnerContractsDemo() }), []);
}

/** The owner's rent income: the contracts and the months that can be shown (demo for now). */
export function useSelfOwnerIncome(): { status: 'demo'; isDemoPreview: true; contracts: SelfOwnerContract[]; months: SelfOwnerMonth[] } {
  return useMemo(() => {
    const now = new Date();
    const contracts = createSelfOwnerContractsDemo(now);
    return { status: 'demo' as const, isDemoPreview: true as const, contracts, months: selfOwnerIncomeMonths(contracts, now) };
  }, []);
}
