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
 * Errors whose message is for developers, never for users (QA web role URL bug, 4 Nov 2026):
 * - a 403 in English: the API's role checks ("Required role: landlord", "agent role required",
 *   "Dev role grant is disabled"). The API's 403s meant for users are written in Thai.
 * - AGENT_ROLE_REQUIRED from lib/agent-session.ts (an account without the agent role).
 * - "HTTP 409" and the like: the API sent no message (lib/api.ts).
 */
function developerOnly(error: Error, message: string): boolean {
  const { status, code } = error as Error & { status?: unknown; code?: unknown };
  if (code === 'AGENT_ROLE_REQUIRED') return true;
  if (/^HTTP \d{3}$/.test(message)) return true;
  return status === 403 && !THAI.test(message);
}

/**
 * Message to show for a caught error: its own message when that is already in the
 * selected language, otherwise the translated `fallback`. Developer-only messages always get `fallback`.
 */
export function localizedError(error: unknown, fallback: string, locale: SupportedLocale): string {
  const message = error instanceof Error ? error.message.trim() : '';
  if (!message || developerOnly(error as Error, message)) return fallback;
  return isInLocale(message, locale) ? message : fallback;
}
