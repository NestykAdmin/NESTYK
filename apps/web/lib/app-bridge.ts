import { guestProfileFromFields, type GuestProfile } from './guest-session';

/**
 * The guest web inside the NESTYK app (W1, nestyk-guest-app-webview-plan-20261124.md; Mos 24 Nov 2026).
 * The app keeps the sign-in and refreshes it; this page never stores or refreshes a token there. It asks the app
 * who is signed in and, for each API call, for the current access token. The app answers only our own origin.
 * Pure rules only; lib/app-bridge-client.ts does the talking. The app's side: apps/consumer-app/lib/guest-web-bridge.ts.
 */

/** The app adds this to the WebView's user agent (same as the app's APP_UA_MARK). */
export const APP_UA_MARK = 'NestykApp/1';
/** Set by the app before the page loads, on our own origin only. */
export const APP_FLAG = '__NESTYK_APP__';
/** The function the app calls with each reply. */
export const APP_RECEIVE = '__nestykAppReceive';
/** How long a request waits for the app before giving up (then: not signed in). */
export const APP_REPLY_TIMEOUT_MS = 8000;

export type WebToApp = { type: 'session.get'; id: string } | { type: 'token.get'; id: string } | { type: 'auth.signOut' };

export type AppToWeb =
  | { type: 'session'; id: string | null; profile: GuestProfile | null }
  | { type: 'token'; id: string; token: string | null; userId: string | null }
  | { type: 'session.changed' };

/** Inside the app only when the app's bridge exists and the app marked the page (flag or user agent). */
export function isInApp(input: { hasBridge: boolean; flag: unknown; userAgent: string }): boolean {
  if (!input.hasBridge) return false;
  const flagged = Boolean(input.flag && typeof input.flag === 'object' && (input.flag as { v?: unknown }).v === 1);
  return flagged || input.userAgent.includes(APP_UA_MARK);
}

export function webMessage(message: WebToApp): string {
  return JSON.stringify(message);
}

/** A reply from the app, or null for anything this page does not trust or know. */
export function parseAppMessage(raw: unknown): AppToWeb | null {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const message = value as Record<string, unknown>;
  if (message.type === 'session.changed') return { type: 'session.changed' };
  if (message.type === 'session') {
    const id = typeof message.id === 'string' ? message.id : null;
    const fields = message.profile && typeof message.profile === 'object' ? (message.profile as Record<string, unknown>) : null;
    return { type: 'session', id, profile: fields ? guestProfileFromFields(fields) : null };
  }
  if (message.type === 'token') {
    if (typeof message.id !== 'string') return null;
    if (message.token !== null && typeof message.token !== 'string') return null;
    const token = typeof message.token === 'string' && message.token ? message.token : null;
    const userId = token && typeof message.userId === 'string' && message.userId ? message.userId : null;
    return { type: 'token', id: message.id, token: userId ? token : null, userId };
  }
  return null;
}
