const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE.test(value) || Number(value.slice(0, 4)) < 1900)
    return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function bangkokDateKey(at = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(at);
}

/** Keep in step with apps/api/src/agent/contracts/lease-term.ts. */
export function shiftIsoDate(iso: string, days: number) {
  const match = DATE.exec(iso);
  if (!match) return iso;
  const dt = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

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

/** End before the anniversary, or on month-end when that anniversary does not exist. */
export function leaseTermEnd(start: string, months: number) {
  const anniversary = addCalendarMonths(start, months);
  return anniversary.slice(8, 10) < start.slice(8, 10)
    ? anniversary
    : shiftIsoDate(anniversary, -1);
}

export function positiveMonths(value: string) {
  const months = Number(value.trim());
  return /^\d{1,3}$/.test(value.trim()) && months > 0 ? months : null;
}
