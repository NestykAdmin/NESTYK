/**
 * Locale tag for formatting dates. Plain Thai tags give the Buddhist year (2569);
 * NESTYK shows the Gregorian year in Thai too, with Thai month names (Mos 11 Nov 2026).
 * Other tags pass through unchanged so each screen keeps its current English / Japanese /
 * Chinese format. Numbers are not affected by the calendar extension.
 */
export const THAI_DATE_LOCALE = 'th-TH-u-ca-gregory';

export function dateLocale(locale: string): string {
  return /^th(-th)?$/i.test(locale) ? THAI_DATE_LOCALE : locale;
}
