const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Reject normalized dates such as 30 February as well as malformed input. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE.test(value) || Number(value.slice(0, 4)) < 1900)
    return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Calendar date from a `YYYY-MM-DD` string or a Date the database driver returned. */
export function asIsoDate(value: unknown) {
  if (typeof value === "string") {
    const day = value.slice(0, 10);
    return DATE.test(day) ? day : "";
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${value.getFullYear()}-${month}-${day}`;
  }
  return "";
}

/** Move a YYYY-MM-DD by whole days, in UTC so the calendar date does not shift. */
export function shiftIsoDate(iso: string, days: number) {
  const match = DATE.exec(iso);
  if (!match) return iso;
  const dt = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Add calendar months, clamping the day to the last day of the target month. */
export function addCalendarMonths(iso: string, months: number) {
  const match = DATE.exec(iso);
  if (!match || !Number.isInteger(months)) return iso;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const total = monthIndex + months;
  const targetYear = year + Math.floor(total / 12);
  const targetMonth = ((total % 12) + 12) % 12;
  const lastDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)),
  )
    .toISOString()
    .slice(0, 10);
}

/**
 * A term of N months ends the day before the same day N months later.
 * If that anniversary does not exist, the term ends on the target month's last day.
 */
export function leaseTermEnd(start: string, months: number) {
  const anniversary = addCalendarMonths(start, months);
  return anniversary.slice(8, 10) < start.slice(8, 10)
    ? anniversary
    : shiftIsoDate(anniversary, -1);
}
