export const BILL_LEAD_DAYS = 5;
export const BILL_GRACE_DAYS = 5;

export type RentPeriod = {
  period: string;
  issueDate: string;
  dueDate: string;
  graceUntil: string;
};

export type RentScheduleInput = {
  /** Move-in date (falls back to lease start) — `YYYY-MM-DD`. */
  anchorDate: string;
  endDate: string | null;
  /** Day of month from the lease form (`rentDueDay`); blank uses the anchor day. */
  dueDay?: unknown;
  /** Contract's grace deadline as a day of month; blank preserves the five-day default. */
  graceDay?: unknown;
  /** Months already paid in advance at signing; those periods are skipped. */
  advanceMonths?: number;
  /**
   * D12 (AC-7.2): only the periods after the first. A new lease bills its first period on its own (the reservation
   * is taken off it), so the advance covers that period and skips `advanceMonths - 1` periods after it.
   */
  afterFirst?: boolean;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function bangkokToday(at = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function parseDueDay(value: unknown): number | null {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^\d{1,2}$/.test(text)) return null;
  const day = Number(text);
  return day >= 1 && day <= 31 ? day : null;
}

export function parseAdvanceMonths(
  advanceMonths: unknown,
  advanceRent: string | number | null | undefined,
  monthlyRent: string | number | null | undefined,
) {
  const text = typeof advanceMonths === "number" ? String(advanceMonths) : typeof advanceMonths === "string" ? advanceMonths.trim() : "";
  if (/^\d{1,2}$/.test(text)) return Number(text);
  const advance = Number(advanceRent ?? 0);
  const rent = Number(monthlyRent ?? 0);
  if (advance > 0 && rent > 0) return Math.round(advance / rent);
  return 0;
}

/** Clamps to the month's last day so a 31st anchor lands on 28/29/30 in short months. */
function monthDate(year: number, monthIndex: number, day: number) {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(day, last)))
    .toISOString()
    .slice(0, 10);
}

export function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function scheduleStart(input: RentScheduleInput) {
  if (!DATE_PATTERN.test(input.anchorDate)) return null;
  const [year, month, anchorDay] = input.anchorDate.split("-").map(Number);
  const day = parseDueDay(input.dueDay) ?? anchorDay;
  const first = monthDate(year, month - 1, day) < input.anchorDate ? 1 : 0;
  return { year, month, day, first };
}

function periodAt(input: RentScheduleInput, year: number, month: number, day: number, index: number): RentPeriod {
  const dueDate = monthDate(year, month - 1 + index, day);
  const graceDay = parseDueDay(input.graceDay);
  let graceUntil = addDays(dueDate, BILL_GRACE_DAYS);
  if (graceDay !== null) {
    graceUntil = monthDate(year, month - 1 + index, graceDay);
    if (graceUntil < dueDate) graceUntil = monthDate(year, month + index, graceDay);
  }
  return { period: dueDate.slice(0, 7), issueDate: addDays(dueDate, -BILL_LEAD_DAYS), dueDate, graceUntil };
}

/** D15 (AC-8.2): a signed renewal is in force on its start date, or the day after signing when that signing is not early. */
export function renewalActiveOn(startDate: string, signedOn: string) {
  if (!DATE_PATTERN.test(startDate) || !DATE_PATTERN.test(signedOn)) return startDate;
  return signedOn < startDate ? startDate : addDays(signedOn, 1);
}

/** The first due day strictly after `signedOn`, stepping a month at a time from `dueDate`. */
export function shiftDueAfter(signedOn: string, dueDay: number, dueDate: string) {
  let [year, month] = dueDate.split("-").map(Number);
  let due = dueDate;
  while (due <= signedOn) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    due = monthDate(year, month - 1, dueDay);
  }
  return due;
}

/** Grace day for a due date: the contract's day of month, or five days when it is blank. */
export function graceUntilFor(dueDate: string, graceDay: number | null) {
  if (graceDay == null) return addDays(dueDate, BILL_GRACE_DAYS);
  const [year, month] = dueDate.split("-").map(Number);
  let grace = monthDate(year, month - 1, graceDay);
  if (grace < dueDate) grace = monthDate(year, month, graceDay);
  return grace;
}

/** AC-7.1: days from the move-in through the day before the first due date, over the real length of the move-in month, half up to a baht. A start that is already the due day stays a full month. */
export function proratedFirstRent(monthlyRent: number, anchorDate: string, dueDate: string): number {
  if (!(monthlyRent > 0) || !DATE_PATTERN.test(anchorDate) || !DATE_PATTERN.test(dueDate) || anchorDate >= dueDate)
    return monthlyRent;
  const lastDay = addDays(dueDate, -1);
  const days = Math.round((Date.parse(`${lastDay}T00:00:00Z`) - Date.parse(`${anchorDate}T00:00:00Z`)) / 86_400_000) + 1;
  const [year, month] = anchorDate.split("-").map(Number);
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (days <= 0 || length <= 0) return monthlyRent;
  return Math.floor((monthlyRent * days * 2 + length) / (length * 2));
}

/** The first rent period of the stay (the advance is ignored), or null when the lease ends before it is due. */
export function firstRentPeriod(input: RentScheduleInput): RentPeriod | null {
  const start = scheduleStart(input);
  if (!start) return null;
  const period = periodAt(input, start.year, start.month, start.day, start.first);
  return input.endDate && period.dueDate > input.endDate ? null : period;
}

/** Periods whose bill should already be issued by `until` (issue date = due − 5 days). */
export function rentPeriodsUntil(input: RentScheduleInput, until: string): RentPeriod[] {
  const start = scheduleStart(input);
  if (!start) return [];
  const { year, month, day } = start;
  const advance = Math.max(0, input.advanceMonths ?? 0);
  let index = start.first + (input.afterFirst ? Math.max(1, advance) : advance);
  // Legacy monetary advances may imply a very large number of prepaid periods.
  // Nothing is due within the supported calendar in that case; avoid an invalid Date.
  if (!Number.isSafeInteger(index) || year * 12 + month - 1 + index > 9999 * 12 + 11) return [];
  const periods: RentPeriod[] = [];
  for (;;) {
    const period = periodAt(input, year, month, day, index);
    if (input.endDate && period.dueDate > input.endDate) break;
    if (period.issueDate > until) break;
    periods.push(period);
    index += 1;
  }
  return periods;
}
