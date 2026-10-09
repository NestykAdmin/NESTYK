import type { SupportedLocale } from './types';

const THAI = /[\u0E00-\u0E7F]/;
const KANA = /[\u3040-\u30FF]/;
const HAN = /[\u4E00-\u9FFF]/;
const LATIN = /[A-Za-z]/;

/** Whether `text` is written in the script of `locale`; API and device errors arrive in Thai or English only. */
export function isInLocale(text: string, locale: SupportedLocale): boolean {
  switch (locale) {
    case 'th':
      return THAI.test(text);
    case 'ja':
      return KANA.test(text);
    case 'zh':
      return HAN.test(text) && !KANA.test(text);
    default:
      return LATIN.test(text) && !THAI.test(text) && !HAN.test(text) && !KANA.test(text);
  }
}

/**
 * Message to show for a caught error: its own message when that is already in the
 * selected language, otherwise the translated `fallback`.
 */
export function localizedError(error: unknown, fallback: string, locale: SupportedLocale): string {
  const message = error instanceof Error ? error.message.trim() : '';
  return message && isInLocale(message, locale) ? message : fallback;
}
