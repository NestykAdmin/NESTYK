import { AUTH_EVENT_KEY, EXPIRED_AT_KEY, crossTabAction, recentExpiry, type AuthEventReason, type CrossTabAction } from './cross-tab-rules';
import { ACTIVITY_KEY } from './idle-rules';

/** Write why this tab is about to clear the saved session, before clearing it (see cross-tab-rules.ts). */
export function markAuthEvent(reason: AuthEventReason): void {
  try {
    window.localStorage.setItem(AUTH_EVENT_KEY, reason);
    if (reason === 'expired') window.localStorage.setItem(EXPIRED_AT_KEY, String(Date.now()));
    else window.localStorage.removeItem(EXPIRED_AT_KEY);
    // Review F6 (5 Nov 2026): the idle clock belongs to this sign-in; the next one starts its own.
    window.localStorage.removeItem(ACTIVITY_KEY);
  } catch {
    // Blocked storage: other tabs treat it as a sign out.
  }
}

/**
 * A new sign-in (password, Google/Facebook return, sign-up, password reset): start the 8-hour idle clock now.
 * Review F6: without this, a Google sign-in (full page load) read yesterday's time and was signed out at once.
 */
export function markFreshSignIn(): void {
  try {
    window.localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
  } catch {
    // Blocked storage: the idle gate keeps this tab's own clock.
  }
}

/** A tab that loads signed out: true (once) when the last session ran out recently, so it shows "session expired". */
export function takeExpiryNotice(): boolean {
  try {
    const raw = window.localStorage.getItem(EXPIRED_AT_KEY);
    window.localStorage.removeItem(EXPIRED_AT_KEY);
    return recentExpiry(raw, Date.now());
  } catch {
    return false;
  }
}

/** Signed in again: an older expiry is no longer news. */
export function clearExpiryNotice(): void {
  try {
    window.localStorage.removeItem(EXPIRED_AT_KEY);
  } catch {
    // ignore
  }
}

/** Calls `onAction` when another tab of this browser signs in or out. Returns the unsubscribe function. */
export function subscribeCrossTab(
  onAction: (action: CrossTabAction, raw: string | null) => void,
  currentUserId: () => string | null,
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const listener = (event: StorageEvent) => {
    if (event.storageArea && event.storageArea !== window.localStorage) return;
    let reasonRaw: string | null = null;
    try {
      reasonRaw = window.localStorage.getItem(AUTH_EVENT_KEY);
    } catch {
      // ignore
    }
    const action = crossTabAction({ currentUserId: currentUserId(), key: event.key, newValue: event.newValue, reasonRaw });
    if (action.kind !== 'none') onAction(action, event.newValue);
  };
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}
