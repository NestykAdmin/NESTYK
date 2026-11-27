import { useMemo, useSyncExternalStore } from 'react';
import type { DashboardSectionStatus } from '@nestyk/feature-listing';
import type { PartyContract } from '@nestyk/types';
import { createSelfOwnerRoomsDemo, type SelfOwnerRoom } from './self-owner-rooms';

/**
 * Self owner contracts and rent income (UI round, 24 Nov 2026, ClickUp z8rcteng6e / z8rcteng6f).
 * The owner only reads them: NESTYK admin will create contracts (Jom 24 Nov 2026). No admin or API yet, so the
 * hooks return demo data; when the API lands, only `useSelfOwnerContracts` / `useSelfOwnerIncome` change.
 * The Dashboard's rent and to-do sections read the same demo set, so the numbers agree.
 */
export type SelfOwnerContractStatus = 'active' | 'ending_soon' | 'awaiting_signature' | 'processing' | 'ended';
export type SelfOwnerContractFilter = 'all' | SelfOwnerContractStatus;
/** Filter order of the contracts page: work first. `processing`: everyone signed, NESTYK is on it (review, deposit, handover). */
export const SELF_OWNER_CONTRACT_FILTERS: SelfOwnerContractFilter[] = ['all', 'awaiting_signature', 'processing', 'ending_soon', 'active', 'ended'];
/** The `form_kind` values of `master_agreement_types` (Jom 24 Nov 2026: the owner sees all four). */
export type SelfOwnerContractKind = 'reservation' | 'lease' | 'renewal' | 'broker_appointment';

export type SelfOwnerContract = {
  id: string;
  /** The API contract id (agent_contracts); absent on demo contracts. */
  apiId?: number;
  kind: SelfOwnerContractKind;
  roomId: string;
  roomTitle: string;
  project: string;
  /** The tenant (lease, renewal) or the booker (reservation); empty for a broker appointment. */
  tenantName: string;
  tenantPhone: string;
  /** YYYY-MM-DD; the signed date of a reservation or a broker appointment. */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  monthlyRent: number;
  advanceRentMonths: number;
  depositMonths: number;
  status: SelfOwnerContractStatus;
  /** Days to the end date; only when ending soon. */
  daysLeft?: number;
  /** A renewal: the contract it renews. */
  renewsContractId?: string;
  /** Why an ended contract ended; `reservation_fulfilled`: a booking letter used once its lease is in force (the
   * system's end reason, migration 20261103110000; shown as "ใช้แล้ว"). */
  endReason?: 'reservation_fulfilled';
  /** A broker appointment: the broker and the commission (an amount or months of rent, as in the agent form). */
  broker?: { company: string; contact: string; phone: string; commission: { months: number } | { amount: number } };
  /** A reservation: the agreed move-in date (also its end date) and the booking fee. */
  reservation?: { moveInDate: string; bookingFee: number };
  /** Who signed and when (YYYY-MM-DD); the owner signs in the contract detail (Jom 25 Nov 2026, demo). */
  signatures?: Partial<Record<SelfOwnerSigner, string>>;
};

/** The parties that sign a contract. */
export type SelfOwnerSigner = 'owner' | 'tenant' | 'broker';

/** One room and every contract of it, newest first; the page lists these (Jom 24 Nov 2026). */
export type SelfOwnerRoomContracts = {
  roomId: string;
  roomTitle: string;
  project: string;
  contracts: SelfOwnerContract[];
  current: SelfOwnerContract;
  status: SelfOwnerContractStatus;
};

/** A booking letter that became the lease (ended with reason reservation_fulfilled): the system calls it "ใช้แล้ว". */
export const isFulfilledReservation = (contract: SelfOwnerContract): boolean =>
  contract.kind === 'reservation' && contract.status === 'ended' && contract.endReason === 'reservation_fulfilled';

/** Leases and renewals carry rent, can end soon and are the room's current contract. */
export const isRentContract = (contract: SelfOwnerContract): boolean => contract.kind === 'lease' || contract.kind === 'renewal';

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

/** Income status filter (Jom 25 Nov 2026): overdue first, the rooms to chase. */
export type SelfOwnerRentFilter = 'all' | SelfOwnerRentState;
export const SELF_OWNER_RENT_FILTERS: SelfOwnerRentFilter[] = ['all', 'overdue', 'due', 'paid'];

export function countSelfOwnerRent(rows: SelfOwnerRent[]): Record<SelfOwnerRentFilter, number> {
  const counts: Record<SelfOwnerRentFilter, number> = { all: rows.length, overdue: 0, due: 0, paid: 0 };
  for (const row of rows) counts[row.state] += 1;
  return counts;
}

export function filterSelfOwnerRent(rows: SelfOwnerRent[], filter: SelfOwnerRentFilter): SelfOwnerRent[] {
  return filter === 'all' ? rows : rows.filter((row) => row.state === filter);
}

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
/** Today in Bangkok as YYYY-MM-DD (the contracts' dates are Bangkok days). */
export function selfOwnerToday(now: Date = new Date()): string {
  return bangkokToday(now);
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

/** Demo brokers per room (fixed). */
const DEMO_BROKERS: Record<string, NonNullable<SelfOwnerContract['broker']>> = {
  r1: { company: 'Bangkok Home Agent', contact: 'สมชาย ใจดี', phone: '02-118-4400', commission: { months: 1 } },
  r5: { company: 'Urban Nest Realty', contact: 'Jenny Lim', phone: '02-660-7171', commission: { amount: 30000 } },
};
const addDays = (date: string, n: number) => new Date(toUtc(date) + n * DAY_MS).toISOString().slice(0, 10);

function contractOf(room: SelfOwnerRoom, fields: Partial<SelfOwnerContract> & Pick<SelfOwnerContract, 'tenantName' | 'startDate' | 'endDate'>): SelfOwnerContract {
  return {
    id: `c-${room.id}`,
    kind: 'lease',
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
  if (contract.status === 'awaiting_signature' || contract.status === 'processing') return contract;
  const left = daysBetween(today, contract.endDate);
  if (left < 0) return { ...contract, status: 'ended' };
  if (isRentContract(contract) && left <= SELF_OWNER_ENDING_SOON_DAYS) return { ...contract, status: 'ending_soon', daysLeft: left };
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
      const start = twelveMonthsBefore(room.leaseEndsAt) > today ? firstOfPrevious : twelveMonthsBefore(room.leaseEndsAt);
      const tenantName = room.tenantName ?? '';
      if (room.id === 'r1') {
        // ห้อง 1204: broker appointment → reservation → lease → the renewal running now (all four kinds).
        const leaseEnd = addDays(start, -1);
        const leaseStart = twelveMonthsBefore(leaseEnd);
        const brokerSigned = addDays(leaseStart, -45);
        contracts.push(contractOf(room, { id: 'c-r1-broker', kind: 'broker_appointment', tenantName: '', tenantPhone: '', startDate: brokerSigned, endDate: twelveMonthsFrom(brokerSigned), broker: DEMO_BROKERS.r1 }));
        contracts.push(contractOf(room, { id: 'c-r1-reservation', kind: 'reservation', tenantName, startDate: addDays(leaseStart, -22), endDate: leaseStart, reservation: { moveInDate: leaseStart, bookingFee: room.monthlyRent } }));
        contracts.push(contractOf(room, { id: 'c-r1-lease', tenantName, startDate: leaseStart, endDate: leaseEnd }));
        contracts.push(contractOf(room, { kind: 'renewal', renewsContractId: 'c-r1-lease', tenantName, startDate: start, endDate: room.leaseEndsAt }));
      } else {
        contracts.push(contractOf(room, { tenantName, startDate: start, endDate: room.leaseEndsAt }));
      }
      if (room.id === 'r2') {
        // ห้อง 805: the lease ends soon and its renewal waits for signatures.
        const renewalStart = addDays(room.leaseEndsAt, 1);
        contracts.push(contractOf(room, { id: 'c-r2-renewal', kind: 'renewal', renewsContractId: 'c-r2', tenantName, startDate: renewalStart, endDate: twelveMonthsFrom(renewalStart), status: 'awaiting_signature' }));
      }
    } else if (room.id === 'r5') {
      // ห้อง 2101: broker appointment and reservation in force, the lease awaits signatures.
      const next = shiftMonth(year, month, 1);
      const start = ymd(next.year, next.month, 1);
      contracts.push(contractOf(room, { id: 'c-r5-broker', kind: 'broker_appointment', tenantName: '', tenantPhone: '', startDate: firstOfPrevious, endDate: twelveMonthsFrom(firstOfPrevious), broker: DEMO_BROKERS.r5 }));
      contracts.push(contractOf(room, { id: 'c-r5-reservation', kind: 'reservation', tenantName: 'คุณกานต์', startDate: addDays(today, -4), endDate: start, reservation: { moveInDate: start, bookingFee: room.monthlyRent } }));
      contracts.push(contractOf(room, { tenantName: 'คุณกานต์', startDate: start, endDate: twelveMonthsFrom(start), status: 'awaiting_signature' }));
    } else if (room.id === 'r6') {
      const ended = shiftMonth(year, month, -2);
      const end = ymd(ended.year, ended.month, lastDay(ended.year, ended.month));
      contracts.push(contractOf(room, { tenantName: 'มานพ ดีงาม', startDate: twelveMonthsBefore(end), endDate: end }));
    }
  }
  // Who signed (Jom 25 Nov 2026, demo): awaiting contracts wait only for the owner, the tenant signed yesterday; every
  // other contract is signed by all, a lease or renewal three days before it starts, the others on their date.
  const signedDemo = contracts.map((contract): SelfOwnerContract => {
    const signers = selfOwnerSigners(contract);
    if (contract.status === 'awaiting_signature') return { ...contract, signatures: { tenant: addDays(today, -1) } };
    const day = isRentContract(contract) ? addDays(contract.startDate, -3) : contract.startDate;
    return { ...contract, signatures: Object.fromEntries(signers.map((signer) => [signer, day])) };
  });
  const dated = signedDemo.map((contract) => statusOn(contract, today));
  // A booking letter ends as used once the room's lease from its move-in date is in force (as the API records it).
  return dated.map((c) =>
    c.kind === 'reservation' && c.status === 'ended' &&
    dated.some((l) => l.roomId === c.roomId && isRentContract(l) && l.status !== 'awaiting_signature' && l.startDate === c.reservation?.moveInDate)
      ? { ...c, endReason: 'reservation_fulfilled' as const }
      : c,
  );
}

/** Who signs each kind: the owner always; the tenant (or booker), or the broker for a broker appointment. A self owner's
 * booking letter has no broker signing it (in the agent system the agent signs, Jom 25 Nov 2026). */
export function selfOwnerSigners(contract: SelfOwnerContract): SelfOwnerSigner[] {
  return contract.kind === 'broker_appointment' ? ['owner', 'broker'] : ['owner', 'tenant'];
}

/** The owner can sign: the contract awaits signatures and the owner has not signed yet. */
export const ownerCanSign = (contract: SelfOwnerContract): boolean =>
  contract.status === 'awaiting_signature' && !contract.signatures?.owner;

/** The owner signs on `today`; once every party has signed the contract takes its status from its dates. */
export function signSelfOwnerContract(contract: SelfOwnerContract, today: string): SelfOwnerContract {
  const signed = { ...contract, signatures: { ...contract.signatures, owner: today } };
  const all = selfOwnerSigners(signed).every((signer) => signed.signatures[signer]);
  return all ? statusOn({ ...signed, status: 'active' }, today) : signed;
}

/** The list with the owner's signatures of this session (contract id → day signed) applied. */
export function applySelfOwnerSignatures(list: SelfOwnerContract[], signedOn: Record<string, string>, today: string): SelfOwnerContract[] {
  return list.map((contract) => (signedOn[contract.id] && ownerCanSign(contract) ? signSelfOwnerContract(contract, signedOn[contract.id] ?? today) : contract));
}

const STATUS_ORDER: SelfOwnerContractStatus[] = ['awaiting_signature', 'processing', 'ending_soon', 'active', 'ended'];

/** The contract a room's row shows: the running lease or renewal, else one awaiting signature, else the last ended one;
 * a room with no lease or renewal shows its newest contract. `newestFirst` is sorted by start date, newest first. */
function currentOf(newestFirst: SelfOwnerContract[]): SelfOwnerContract {
  const rent = newestFirst.filter(isRentContract);
  return (
    rent.find((c) => c.status === 'active' || c.status === 'ending_soon') ??
    rent.find((c) => c.status === 'awaiting_signature') ??
    rent.find((c) => c.status === 'ended') ??
    newestFirst[0]
  );
}

/** Contracts grouped by room (first-seen room order), each room's contracts newest first. Input is not mutated. */
export function groupSelfOwnerContracts(list: SelfOwnerContract[]): SelfOwnerRoomContracts[] {
  const byRoom = new Map<string, SelfOwnerContract[]>();
  for (const contract of list) byRoom.set(contract.roomId, [...(byRoom.get(contract.roomId) ?? []), contract]);
  return [...byRoom.values()].map((own) => {
    const contracts = [...own].sort((a, b) => b.startDate.localeCompare(a.startDate) || a.id.localeCompare(b.id, 'en', { numeric: true }));
    const current = currentOf(contracts);
    return { roomId: current.roomId, roomTitle: current.roomTitle, project: current.project, contracts, current, status: current.status };
  });
}

export function countSelfOwnerRooms(rooms: SelfOwnerRoomContracts[]): Record<SelfOwnerContractFilter, number> {
  const counts: Record<SelfOwnerContractFilter, number> = { all: rooms.length, active: 0, ending_soon: 0, awaiting_signature: 0, processing: 0, ended: 0 };
  for (const room of rooms) counts[room.status] += 1;
  return counts;
}

/** Search (room, project, any contract's tenant or broker; trimmed, case-insensitive), then the room's current status;
 * work first. Input is not mutated. */
export function filterSelfOwnerRooms(rooms: SelfOwnerRoomContracts[], q: string, filter: SelfOwnerContractFilter): SelfOwnerRoomContracts[] {
  const needle = q.trim().toLocaleLowerCase();
  const texts = (room: SelfOwnerRoomContracts) => [
    room.roomTitle,
    room.project,
    ...room.contracts.flatMap((c) => [c.tenantName, c.broker?.company ?? '', c.broker?.contact ?? '']),
  ];
  return rooms
    .filter((room) => filter === 'all' || room.status === filter)
    .filter((room) => !needle || texts(room).some((text) => text.toLocaleLowerCase().includes(needle)))
    .sort((a, b) => {
      const byStatus = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      if (byStatus) return byStatus;
      if (a.status === 'ended') return b.current.endDate.localeCompare(a.current.endDate);
      return a.current.endDate.localeCompare(b.current.endDate) || a.roomId.localeCompare(b.roomId, 'en', { numeric: true });
    });
}

/** Rent of one month for the leases and renewals that run in it (not the ones awaiting signature). Future months are empty. */
export function selfOwnerRentForMonth(contracts: SelfOwnerContract[], year: number, month: number, now: Date = new Date()): SelfOwnerRent[] {
  const today = bangkokToday(now);
  const [thisYear, thisMonth] = today.split('-').map(Number);
  const key = year * 12 + month;
  const current = thisYear * 12 + thisMonth;
  if (key > current) return [];
  const first = ymd(year, month, 1);
  const last = ymd(year, month, lastDay(year, month));
  return contracts
    .filter((c) => isRentContract(c) && c.status !== 'awaiting_signature' && c.startDate <= last && c.endDate >= first)
    .map((c) => {
      // The contract id keeps rows apart when two contracts of a room fall in one month.
      const base = { id: `p-${c.id}-${year}-${pad(month)}`, roomTitle: c.roomTitle, project: c.project, tenantName: c.tenantName, amount: c.monthlyRent };
      const unpaidDay = key === current ? UNPAID_THIS_MONTH[c.roomId] : undefined;
      const dueDate = ymd(year, month, unpaidDay ?? DUE_DAY);
      if (unpaidDay === undefined && dueDate <= today) return { ...base, state: 'paid' as const, dueDate, paidAt: ymd(year, month, PAID_DAY) };
      if (dueDate < today) return { ...base, state: 'overdue' as const, dueDate, overdueDays: daysBetween(dueDate, today) };
      return { ...base, state: 'due' as const, dueDate };
    });
}

/** Months that have rent to show: from the oldest lease or renewal start (not awaiting signature) to this month, oldest first. */
export function selfOwnerIncomeMonths(contracts: SelfOwnerContract[], now: Date = new Date()): SelfOwnerMonth[] {
  const [thisYear, thisMonth] = bangkokToday(now).split('-').map(Number);
  const starts = contracts.filter((c) => isRentContract(c) && c.status !== 'awaiting_signature').map((c) => c.startDate).sort();
  if (!starts.length) return [{ year: thisYear, month: thisMonth }];
  const [startYear, startMonth] = starts[0].split('-').map(Number);
  const months: SelfOwnerMonth[] = [];
  for (let index = startYear * 12 + startMonth - 1; index <= thisYear * 12 + thisMonth - 1; index++) {
    months.push({ year: Math.floor(index / 12), month: (index % 12) + 1 });
  }
  return months;
}

/** Bangkok day (YYYY-MM-DD) of an API timestamp. */
const bangkokDay = (iso: string): string => bangkokToday(new Date(iso));
const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '');
const monthsOf = (value: unknown): number => {
  const n = Number(textOf(value).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const amountOf = (value: unknown): number => monthsOf(value);

/**
 * One API contract as the owner's contract, or null when it is not the owner's own-room contract (the owner is not a
 * party of it, it has no self owner room) or it was cancelled. `today` is the Bangkok day (YYYY-MM-DD).
 * The forms sit nested in `data`, one per kind, as the agent's saveDraft and the seed planner
 * (apps/api/scripts/self-owner-contracts-plan.cjs) store them: `leaseAgreement` (lease-agreement.ts: tenantPhone,
 * advanceMonths, depositMonths), `leaseRenewal` (lease-renewal.ts: depositCarried, an amount; no phone, no advance),
 * `reservationLetter` (reservation-letter.ts: tenantPhone, advanceMonths, depositMonths, reservationPayment) and
 * `brokerAppointment` (broker-appointment.ts: brokerCompany, brokerContact, brokerPhone, monthlyRent, commissionMonths,
 * commissionFee; the monthly_rent column is null for an appointment). The same keys at the top of `data` are the fallback.
 */
export function fromPartyContract(c: PartyContract, today: string): SelfOwnerContract | null {
  if (!c.myParties.includes('owner') || c.selfOwnerRoomId == null) return null;
  if (c.status === 'cancelled') return null;
  const kind = c.formKind;
  const data = (c.data ?? {}) as Record<string, unknown>;
  const nestedKey = { lease: 'leaseAgreement', renewal: 'leaseRenewal', reservation: 'reservationLetter', broker_appointment: 'brokerAppointment' }[kind];
  const nested = data[nestedKey];
  const form = nested && typeof nested === 'object' && !Array.isArray(nested) ? (nested as Record<string, unknown>) : {};
  /** The form's value, else the same key at the top of `data`. */
  const field = (key: string): unknown => (textOf(form[key]) !== '' ? form[key] : data[key]);
  const monthlyRent = c.monthlyRent ?? amountOf(field('monthlyRent'));
  // A renewal carries the previous deposit as an amount: shown as months of rent like the other kinds.
  const carried = kind === 'renewal' ? amountOf(form.depositCarried) || (c.deposit ?? 0) : 0;
  const depositMonths = monthsOf(field('depositMonths')) || (carried > 0 && monthlyRent > 0 ? Math.round((carried / monthlyRent) * 100) / 100 : 0);
  const startDate = c.startDate;
  const endDate = c.endDate ?? (kind === 'reservation' ? c.moveInDate ?? startDate : kind === 'broker_appointment' ? twelveMonthsFrom(startDate) : startDate);
  let status: SelfOwnerContractStatus;
  let daysLeft: number | undefined;
  switch (c.status) {
    case 'draft':
    case 'awaiting_signatures':
      status = 'awaiting_signature';
      break;
    case 'awaiting_agent_review':
    case 'awaiting_deposit':
    case 'awaiting_handover':
      status = 'processing';
      break;
    case 'active': {
      const left = daysBetween(today, endDate);
      if (left < 0) status = 'ended';
      else if ((kind === 'lease' || kind === 'renewal') && left <= SELF_OWNER_ENDING_SOON_DAYS) {
        status = 'ending_soon';
        daysLeft = left;
      } else status = 'active';
      break;
    }
    default:
      status = 'ended';
  }
  const signatures: Partial<Record<SelfOwnerSigner, string>> = {};
  if (c.ownerSignedAt) signatures.owner = bangkokDay(c.ownerSignedAt);
  if (c.tenantSignedAt) signatures.tenant = bangkokDay(c.tenantSignedAt);
  if (c.agentSignedAt) signatures.broker = bangkokDay(c.agentSignedAt);
  const contract: SelfOwnerContract = {
    id: String(c.id),
    apiId: c.id,
    kind,
    roomId: String(c.selfOwnerRoomId),
    roomTitle: c.room ?? c.property,
    project: c.property,
    tenantName: kind === 'broker_appointment' ? '' : c.tenant,
    tenantPhone: textOf(field('tenantPhone')),
    startDate,
    endDate,
    monthlyRent,
    advanceRentMonths: monthsOf(field('advanceMonths')),
    depositMonths,
    status,
    signatures,
  };
  if (daysLeft !== undefined) contract.daysLeft = daysLeft;
  if (c.endReasonCode === 'reservation_fulfilled') contract.endReason = 'reservation_fulfilled';
  if (kind === 'reservation') contract.reservation = { moveInDate: c.moveInDate ?? endDate, bookingFee: c.reservationFee ?? (amountOf(data.reservationFee) || amountOf(form.reservationPayment)) };
  if (kind === 'broker_appointment') {
    const months = monthsOf(field('commissionMonths'));
    contract.broker = {
      company: textOf(field('brokerCompany')),
      contact: textOf(field('brokerContact')),
      phone: textOf(field('brokerPhone')),
      commission: months > 0 ? { months } : { amount: amountOf(field('commissionFee')) },
    };
  }
  return contract;
}

/** What the store needs from the party contracts API (lib/self-owner-contracts-api.ts); a fake in tests. */
export interface SelfOwnerContractsBackend {
  list(): Promise<PartyContract[]>;
  sign(id: number, signaturePng: string): Promise<PartyContract>;
  documentUrl(id: number): Promise<string>;
}

export type SelfOwnerSignResult = { ok: true } | { ok: false; message: string };
/** Used when a failed sign has no message of its own (no answer from the server); pages pass their localized copy. */
const SIGN_FAILED_FALLBACK = 'ลงนามไม่สำเร็จ กรุณาลองอีกครั้ง';

type ContractStoreState = { source: 'demo' | 'api'; status: DashboardSectionStatus; contracts: SelfOwnerContract[] };

/**
 * The owner's contracts, shared by the contracts pages. Demo contracts until the app connects the API; connected, it
 * holds the signed-in owner's own-room contracts (same pattern as `selfOwnerRoomStore`).
 */
function createContractStore() {
  let state: ContractStoreState = { source: 'demo', status: 'demo', contracts: createSelfOwnerContractsDemo() };
  let backend: SelfOwnerContractsBackend | null = null;
  let accountKey: string | null = null;
  let loadId = 0;
  // Bumped by connect and disconnect: the backend object is shared by every account, so a call that outlives its
  // connection is told apart by this, not by the backend.
  let generation = 0;
  const listeners = new Set<() => void>();
  const set = (next: Partial<ContractStoreState>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  };
  const mapAll = (rows: PartyContract[]): SelfOwnerContract[] => {
    const today = selfOwnerToday();
    return rows.map((row) => fromPartyContract(row, today)).filter((row): row is SelfOwnerContract => row !== null);
  };
  const load = async (): Promise<void> => {
    if (!backend) return;
    const id = ++loadId;
    const source = backend;
    try {
      const rows = await source.list();
      if (id !== loadId || backend !== source) return;
      set({ status: 'available', contracts: mapAll(rows) });
    } catch {
      if (id !== loadId || backend !== source) return;
      set({ status: 'error' });
    }
  };
  const demoNow = (now: Date) => ({ source: 'demo' as const, status: 'demo' as const, contracts: createSelfOwnerContractsDemo(now) });
  return {
    getState: (): ContractStoreState => state,
    backend: (): SelfOwnerContractsBackend | null => backend,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Use the API for this account; the same account again is a no-op, another account loads its own contracts. */
    connect(next: SelfOwnerContractsBackend, account: string): void {
      if (backend === next && accountKey === account) return;
      backend = next;
      accountKey = account;
      generation++;
      set({ source: 'api', status: 'loading', contracts: [] });
      void load();
    },
    refresh: (): Promise<void> => load(),
    /** Signed out: back to the demo contracts. */
    disconnect(now: Date = new Date()): void {
      backend = null;
      accountKey = null;
      generation++;
      loadId++;
      set(demoNow(now));
    },
    /** Back to the demo, not connected (tests). */
    reset(now: Date = new Date()): void {
      this.disconnect(now);
    },
    /**
     * The owner signs. The contract changes only when the API agrees; any failure answers `{ ok: false, message }` with the
     * API's own message (else `fallbackMessage`) and leaves the contract as it was. Not for the demo: the pages sign locally there.
     */
    async sign(contractId: string, signaturePng: string, fallbackMessage: string = SIGN_FAILED_FALLBACK): Promise<SelfOwnerSignResult> {
      const source = backend;
      const connection = generation;
      const contract = state.contracts.find((item) => item.id === contractId);
      if (!source || !contract || contract.apiId === undefined) return { ok: false, message: fallbackMessage };
      try {
        const updated = fromPartyContract(await source.sign(contract.apiId, signaturePng), selfOwnerToday());
        // The owner signed out or another account connected meanwhile: the result is not theirs to show here.
        if (generation !== connection) return { ok: false, message: fallbackMessage };
        // A list that started before this sign holds the unsigned contract; its answer must not land after it.
        loadId++;
        set({ contracts: updated ? state.contracts.map((item) => (item.id === contractId ? updated : item)) : state.contracts.filter((item) => item.id !== contractId) });
        return { ok: true };
      } catch (error) {
        const e = error as { message?: unknown; status?: unknown; code?: unknown } | null;
        // Any failure: the contract may have changed (409), been signed in another tab (400 "ฝ่ายนี้ลงนามแล้ว") or been
        // signed by the server before the answer was lost; load it again so the page shows what is there now.
        if (generation === connection) void load();
        // Only the API's own (Thai) message is shown: no answer, a server error or a raw "HTTP ..." text is the page's copy.
        const raw = typeof e?.message === 'string' ? e.message.trim() : '';
        const technical = e?.code === 'NETWORK_ERROR' || e?.status === 0 || (typeof e?.status === 'number' && e.status >= 500) || raw.startsWith('HTTP ');
        const message = raw && !technical ? raw : fallbackMessage;
        return { ok: false, message };
      }
    },
    /** The file to show: the API's link, or on the demo the bundled sample file (what the Document viewer takes as `source`). */
    documentUrl(contractId: string): Promise<number | string> {
      const contract = state.contracts.find((item) => item.id === contractId);
      if (backend) {
        if (!contract || contract.apiId === undefined) return Promise.reject(new Error('contract not found'));
        return backend.documentUrl(contract.apiId);
      }
      // Lazy: the bundled PDFs are Metro assets; only the demo path needs them.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const file = (require('../components/self-owner/demo-documents') as typeof import('../components/self-owner/demo-documents')).selfOwnerDocumentOf(contractId);
      return file === undefined ? Promise.reject(new Error('no file')) : Promise.resolve(file);
    },
  };
}

export const selfOwnerContractStore = createContractStore();

/** The owner's contracts: the demo until the app connects the API, then the signed-in owner's own-room contracts. */
export function useSelfOwnerContracts(): { status: DashboardSectionStatus; isDemoPreview: boolean; contracts: SelfOwnerContract[] } {
  const state = useSyncExternalStore(selfOwnerContractStore.subscribe, selfOwnerContractStore.getState, selfOwnerContractStore.getState);
  return useMemo(() => ({ status: state.status, isDemoPreview: state.source === 'demo', contracts: state.contracts }), [state]);
}

/** The owner's rent income: the contracts and the months that can be shown (demo for now). */
export function useSelfOwnerIncome(): { status: 'demo'; isDemoPreview: true; contracts: SelfOwnerContract[]; months: SelfOwnerMonth[] } {
  return useMemo(() => {
    const now = new Date();
    const contracts = createSelfOwnerContractsDemo(now);
    return { status: 'demo' as const, isDemoPreview: true as const, contracts, months: selfOwnerIncomeMonths(contracts, now) };
  }, []);
}
