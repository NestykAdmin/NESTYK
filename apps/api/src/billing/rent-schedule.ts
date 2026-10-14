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

/** Periods whose bill should already be issued by `until` (issue date = due − 5 days). */
export function rentPeriodsUntil(input: RentScheduleInput, until: string): RentPeriod[] {
  if (!DATE_PATTERN.test(input.anchorDate)) return [];
  const [year, month, anchorDay] = input.anchorDate.split("-").map(Number);
  const day = parseDueDay(input.dueDay) ?? anchorDay;
  let index = monthDate(year, month - 1, day) < input.anchorDate ? 1 : 0;
  index += Math.max(0, input.advanceMonths ?? 0);
  // Legacy monetary advances may imply a very large number of prepaid periods.
  // Nothing is due within the supported calendar in that case; avoid an invalid Date.
  if (!Number.isSafeInteger(index) || year * 12 + month - 1 + index > 9999 * 12 + 11) return [];
  const periods: RentPeriod[] = [];
  for (;;) {
    const dueDate = monthDate(year, month - 1 + index, day);
    if (input.endDate && dueDate >= input.endDate) break;
    const issueDate = addDays(dueDate, -BILL_LEAD_DAYS);
    if (issueDate > until) break;
    const graceDay = parseDueDay(input.graceDay);
    let graceUntil = addDays(dueDate, BILL_GRACE_DAYS);
    if (graceDay !== null) {
      graceUntil = monthDate(year, month - 1 + index, graceDay);
      if (graceUntil < dueDate) graceUntil = monthDate(year, month + index, graceDay);
    }
    periods.push({
      period: dueDate.slice(0, 7),
      issueDate,
      dueDate,
      graceUntil,
    });
    index += 1;
  }
  return periods;
}
