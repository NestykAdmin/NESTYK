import { interpolate } from '@nestyk/feature-listing';
import type { useLocale } from '@nestyk/i18n';
import { ownerCanSign, selfOwnerSigners, type SelfOwnerContract, type SelfOwnerSigner } from '../../lib/self-owner-contracts';

type ContractsCopy = ReturnType<typeof useLocale>['t']['selfOwnerContracts'];
type Format = { money: (amount: number) => string; day: (ymd: string) => string };

/** One money (or date) tile: a label, the value, and an optional note under it ("2 เดือน"). */
export type ContractTile = { label: string; value: string; note?: string };

/**
 * What the read-only contract detail shows, layout A (Jom 24 Nov 2026): the period and how far into it we are, the
 * other party, money tiles, other dates, and the contract a renewal renews. Shared by the web dialog and the phone modal.
 */
export type ContractDetailView = {
  period: string;
  room: string;
  /** Only while the contract is in force (lease, renewal or broker appointment). */
  progress?: { month: number; months: number; daysLeft: number; ratio: number };
  progressLabel?: string;
  party: { name: string; role: string; phone: string; initial: string };
  tiles: ContractTile[];
  extra: Array<[string, string]>;
  renewsFrom?: { id: string; label: string };
};

/** Who the contract is with: the broker company for a broker appointment, else the tenant or booker. */
export function contractParty(contract: SelfOwnerContract): string {
  return contract.broker ? contract.broker.company : contract.tenantName;
}

const THAI_LEADING_VOWELS = 'เแโใไ';
/** The avatar letter: the first letter of the name, skipping a Thai leading vowel ("เมษา" → "ม"). */
export function initialOf(name: string): string {
  const letter = [...name.trim()].find((ch) => !THAI_LEADING_VOWELS.includes(ch) && ch.trim());
  return (letter ?? '').toLocaleUpperCase();
}

const DAY_MS = 86_400_000;
const utc = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`);
const monthIndex = (ymd: string) => {
  const [y, m] = ymd.split('-').map(Number);
  return y * 12 + m - 1;
};

/** Month n of m, days left and the share of the term gone, for a contract in force on `today` (YYYY-MM-DD). */
function progressOf(contract: SelfOwnerContract, today: string): ContractDetailView['progress'] {
  const inForce = contract.status === 'active' || contract.status === 'ending_soon';
  if (!inForce || contract.kind === 'reservation' || today < contract.startDate || today > contract.endDate) return undefined;
  const dayAfterEnd = new Date(utc(contract.endDate) + DAY_MS).toISOString().slice(0, 10);
  const startDay = Number(contract.startDate.slice(8));
  const months = monthIndex(dayAfterEnd) - monthIndex(contract.startDate);
  const month = Math.min(months, monthIndex(today) - monthIndex(contract.startDate) + (Number(today.slice(8)) >= startDay ? 1 : 0));
  const daysLeft = Math.round((utc(contract.endDate) - utc(today)) / DAY_MS);
  const ratio = (utc(today) - utc(contract.startDate)) / (utc(dayAfterEnd) - utc(contract.startDate));
  return { month: Math.max(1, month), months, daysLeft, ratio };
}

export function contractDetailView(contract: SelfOwnerContract, all: SelfOwnerContract[], so: ContractsCopy, { money, day }: Format, today: string): ContractDetailView {
  const period = (c: SelfOwnerContract) => interpolate(so.period, { start: day(c.startDate), end: day(c.endDate) });
  const progress = progressOf(contract, today);
  const base = {
    period: period(contract),
    room: `${contract.roomTitle} · ${contract.project}`,
    progress,
    progressLabel: progress ? interpolate(so.progressMonth, { n: progress.month, total: progress.months }) : undefined,
  };
  if (contract.kind === 'broker_appointment' && contract.broker) {
    const { commission } = contract.broker;
    return {
      ...base,
      party: { name: contract.broker.company, role: `${so.brokerContact} ${contract.broker.contact}`, phone: contract.broker.phone, initial: initialOf(contract.broker.company) },
      tiles: [
        { label: so.askingRent, value: money(contract.monthlyRent) },
        'months' in commission
          ? { label: so.commission, value: money(contract.monthlyRent * commission.months), note: interpolate(so.commissionMonths, { months: commission.months }) }
          : { label: so.commission, value: money(commission.amount) },
      ],
      extra: [[so.signedDate, day(contract.startDate)]],
    };
  }
  const party = { name: contract.tenantName, phone: contract.tenantPhone, initial: initialOf(contract.tenantName) };
  if (contract.kind === 'reservation' && contract.reservation) {
    return {
      ...base,
      party: { ...party, role: so.booker },
      tiles: [
        { label: so.bookingFee, value: money(contract.reservation.bookingFee) },
        { label: so.moveInDate, value: day(contract.reservation.moveInDate) },
      ],
      extra: [[so.signedDate, day(contract.startDate)]],
    };
  }
  const renewed = contract.renewsContractId ? all.find((c) => c.id === contract.renewsContractId) : undefined;
  return {
    ...base,
    party: { ...party, role: so.tenant },
    tiles: [
      { label: so.monthlyRent, value: money(contract.monthlyRent) },
      { label: so.advanceRent, value: money(contract.monthlyRent * contract.advanceRentMonths), note: interpolate(so.monthsCount, { n: contract.advanceRentMonths }) },
      { label: so.deposit, value: money(contract.monthlyRent * contract.depositMonths), note: interpolate(so.monthsCount, { n: contract.depositMonths }) },
    ],
    extra: [],
    renewsFrom: renewed ? { id: renewed.id, label: `${so.renewsFrom} ${so.kind[renewed.kind]} · ${period(renewed)}` } : undefined,
  };
}

/** The "การลงนาม" section of the detail (Jom 25 Nov 2026, demo): who signs and when, and what the owner can do. */
export type ContractSigningView = {
  rows: Array<{ signer: SelfOwnerSigner; label: string; name: string; status: string; signed: boolean }>;
  /** The contract awaits signatures and the owner has not signed. */
  canSign: boolean;
  /** The owner has signed and another party has not yet. */
  waiting: boolean;
};

export function contractSigningView(contract: SelfOwnerContract, so: ContractsCopy, day: (ymd: string) => string): ContractSigningView {
  const labelOf = (signer: SelfOwnerSigner) =>
    signer === 'owner' ? so.signerOwner : signer === 'broker' ? so.signerBroker : contract.kind === 'reservation' ? so.booker : so.tenant;
  const nameOf = (signer: SelfOwnerSigner) => (signer === 'owner' ? '' : signer === 'broker' ? contract.broker?.company ?? '' : contract.tenantName);
  const rows = selfOwnerSigners(contract).map((signer) => {
    const on = contract.signatures?.[signer];
    return { signer, label: labelOf(signer), name: nameOf(signer), signed: !!on, status: on ? interpolate(so.signedOn, { date: day(on) }) : so.notSigned };
  });
  return {
    rows,
    canSign: ownerCanSign(contract),
    waiting: contract.status === 'awaiting_signature' && !!contract.signatures?.owner,
  };
}
