import type { SupportedLocale } from "@nestyk/i18n";

const LOCALE_TAG: Record<SupportedLocale, string> = { th: "th-TH", en: "en-GB", zh: "zh-CN", ja: "ja-JP" };

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
