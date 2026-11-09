import type { UserRole } from '@nestyk/types';

/**
 * In-memory auth navigation helpers (session-scoped, not persisted).
 * Used so login / continue-as-guest can coordinate with the home shell role gate.
 */

let pendingRole: UserRole | null = null;
let preferGuestBrowse = false;

/** After login, home applies this role (e.g. user picked Agent while logged out). */
export function setPendingRole(role: UserRole): void {
  pendingRole = role;
  preferGuestBrowse = false;
}

export function consumePendingRole(): UserRole | null {
  const next = pendingRole;
  pendingRole = null;
  return next;
}

/** Continue as guest from login — force Seeker (guest) mode on home. */
export function requestGuestBrowse(): void {
  preferGuestBrowse = true;
  pendingRole = null;
}

export function consumeGuestBrowse(): boolean {
  const next = preferGuestBrowse;
  preferGuestBrowse = false;
  return next;
}

let signedOutElsewhere = false;

/** Web: another tab signed out. Guest here too, then the page "Sign out" lands on (EXPO_PUBLIC_WEB_SIGN_OUT_TO). */
export function requestSignOutLanding(): void {
  requestGuestBrowse();
  signedOutElsewhere = true;
}

export function consumeSignOutLanding(): boolean {
  const next = signedOutElsewhere;
  signedOutElsewhere = false;
  return next;
}

export function roleRequiresAuth(role: UserRole): boolean {
  return role !== 'guest';
}
