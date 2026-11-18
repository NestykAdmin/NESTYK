import type { SupportedLocale } from "@nestyk/i18n";

const LOCALE_TAG: Record<SupportedLocale, string> = { th: "th-TH-u-ca-gregory", en: "en-GB", zh: "zh-CN", ja: "ja-JP" };

export function billFormatters(locale: SupportedLocale) {
  const tag = LOCALE_TAG[locale];
  return {
    date: (value: string) =>
      new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(`${value.slice(0, 10)}T12:00:00`),
      ),
    month: (period: string) =>
      new Intl.DateTimeFormat(tag, { month: "long", year: "numeric" }).format(new Date(`${period}-15T12:00:00`)),
    amount: (amount: number) => `${new Intl.NumberFormat(tag, { maximumFractionDigits: 2 }).format(amount)} ฿`,
  };
}

/** QA Aof 16 Nov 2026 (Q8): YYYY-MM-DD that is also a real calendar day (not 2026-13-45 or 2026-02-30). */
export function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value;
}
