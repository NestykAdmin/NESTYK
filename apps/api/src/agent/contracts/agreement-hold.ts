/**
 * One rule for "this agreement still holds its parties" (QA Aof, 3 Nov 2026), shared by account deletion
 * (auth.service deletionCounts), rent bills (tenant-billing persistEndedLeases) and room status (room-deal-status).
 * No imports, so every caller and its tests can load it on its own.
 */

/** D1: a broker appointment is valid for this many years from its start date (activeBrokerAppointments). */
export const BROKER_APPOINTMENT_TERM_YEARS = 1;

/**
 * AC-8.7: an expired lease whose stay is not released yet (no renewal decided, or "not renewing" recorded but the
 * tenant stays until then). The closure job keeps `data.undecided` ({ since }) while the stay lasts and removes the
 * key when it releases the stay. SQL form for `lease_contracts c`.
 */
export const LEASE_STILL_HELD_SQL = "(c.status = 'expired' AND (c.data->'undecided') IS NOT NULL)";

export function hasUndecidedStay(data: unknown): boolean {
  return data != null && typeof data === "object" && (data as { undecided?: unknown }).undecided != null;
}

export function leaseStillHeld(c: { status: string; data?: unknown }): boolean {
  return c.status === "expired" && hasUndecidedStay(c.data);
}

/** start + 1 year > today, as Postgres computes `date + interval '1 year'` (29 Feb moves to 28 Feb). */
export function brokerAppointmentValid(startDate: string, today: string): boolean {
  const [y, m, d] = startDate.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return false;
  const year = y + BROKER_APPOINTMENT_TERM_YEARS;
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const until = `${year}-${String(m).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
  return until > today.slice(0, 10);
}

export type AgreementHoldRow = {
  formKind: string | null | undefined;
  status: string;
  startDate: string | null | undefined;
  data?: unknown;
  /** The deal (lead, room, tenant) has a first lease that has started (active, expired or terminated). */
  leaseStarted?: boolean;
};

const ENDED = ["cancelled", "expired", "terminated"];

/**
 * Whether the agreement still holds its parties (and its agent):
 * - booking letter: not ended, and its deal's first lease has not started (a letter its lease took over is
 *   terminated as reservation_fulfilled; one left active by mistake does not hold either);
 * - lease or renewal: not ended (drafts and unsigned ones included), or expired with the stay still undecided;
 * - broker appointment: not ended and within its 1-year term (D1).
 */
export function holdsAccount(row: AgreementHoldRow, today: string): boolean {
  if (row.status === "cancelled") return false;
  const open = !ENDED.includes(row.status);
  switch (row.formKind) {
    case "reservation":
      return open && !row.leaseStarted;
    case "lease":
    case "renewal":
      return open || leaseStillHeld(row);
    case "broker_appointment":
      return open && !!row.startDate && brokerAppointmentValid(String(row.startDate), today);
    default:
      return false;
  }
}
