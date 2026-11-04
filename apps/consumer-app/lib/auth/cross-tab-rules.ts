/**
 * Web: keep every tab of one browser on the same sign-in (Mos 4 Nov 2026, review
 * nestyk-web-auth-session-check-20261104 item 3). Pure rules, no React, no imports, so tests load it bare.
 *
 * The saved session ("nestyk.auth.session.v1") lives in localStorage, which all tabs share, and the browser tells
 * the other tabs when it changes (the "storage" event). Before a tab clears it, it writes why ("signedOut" or
 * "expired") under AUTH_EVENT_KEY, so the other tabs can land in the same place:
 *   signed out → guest home "/" · expired → /login with the notice (rule from item 1).
 */
export const SESSION_STORAGE_KEY = 'nestyk.auth.session.v1';
export const AUTH_EVENT_KEY = 'nestyk.web.authEvent';

export type AuthEventReason = 'signedOut' | 'expired';

export type CrossTabAction =
  /** Nothing for this tab to do. */
  | { kind: 'none' }
  /** Another tab signed out (or its session ran out): drop the session here too. */
  | { kind: 'signOut'; reason: AuthEventReason }
  /** Another tab signed in (this tab was signed out), or the same user's profile changed: use the saved copy. */
  | { kind: 'adopt'; userId: string }
  /** Another tab signed in as a different user: reload, so nothing of the previous user stays on screen. */
  | { kind: 'reload' };

function userIdOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { userId?: unknown; accessToken?: unknown; email?: unknown };
    return typeof parsed?.userId === 'string' && parsed.userId && parsed.accessToken && parsed.email ? parsed.userId : null;
  } catch {
    return null;
  }
}

export function readAuthEventReason(raw: string | null | undefined): AuthEventReason {
  return raw === 'expired' ? 'expired' : 'signedOut';
}

/**
 * What this tab does when another tab changed the saved session.
 * `currentUserId`: who this tab shows now (null = signed out). `key` / `newValue`: from the storage event
 * (key null = localStorage.clear()). `reasonRaw`: the AUTH_EVENT_KEY value at that moment.
 */
export function crossTabAction(input: {
  currentUserId: string | null;
  key: string | null;
  newValue: string | null;
  reasonRaw: string | null;
}): CrossTabAction {
  if (input.key !== null && input.key !== SESSION_STORAGE_KEY) return { kind: 'none' };
  const nextUserId = input.key === null ? null : userIdOf(input.newValue);
  if (!nextUserId) {
    return input.currentUserId ? { kind: 'signOut', reason: readAuthEventReason(input.reasonRaw) } : { kind: 'none' };
  }
  if (!input.currentUserId || input.currentUserId === nextUserId) return { kind: 'adopt', userId: nextUserId };
  return { kind: 'reload' };
}
