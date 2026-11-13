/**
 * Sign-in on the guest web (AUTH-2.2, nestyk-guest-session-plan-20261112.md B2).
 * nestyk.com is one site (AUTH-1): the account pages (consumer-app) sign in and keep a copy of the profile in
 * the browser's local storage; the guest web reads that copy for the header and follows the same cross-tab and idle rules.
 * Pure rules only (no React, no browser globals); GuestSessionProvider does the reading and listening.
 * Keys and rules are checked against the consumer-app's own files in guest-session.test.cjs.
 */

/** consumer-app lib/auth/cross-tab-rules.ts SESSION_STORAGE_KEY: the saved profile copy (with its token). */
export const SESSION_STORAGE_KEY = 'nestyk.auth.session.v1';
/** consumer-app AUTH_EVENT_KEY: why the last sign-out happened ("signedOut" | "expired"), written before clearing. */
export const AUTH_EVENT_KEY = 'nestyk.web.authEvent';
/** consumer-app lib/auth/idle-rules.ts: last activity time shared by every tab, and the 8-hour limit (Mos D4). */
export const ACTIVITY_KEY = 'nestyk.web.lastActivity';
export const IDLE_LIMIT_MS = 8 * 60 * 60 * 1000;
export const ACTIVITY_WRITE_MS = 15 * 1000;

/** What the guest web shows of the signed-in account. The token is never read out of the copy here. */
export interface GuestProfile {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  initials: string;
  avatarUrl: string | null;
  roles: string[];
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** Same as consumer-app session-storage displayNameFrom. */
function displayNameFrom(firstName: string, lastName: string, email: string): string {
  const full = [firstName, lastName].filter(Boolean).join(' ').trim();
  return full || email.split('@')[0] || 'User';
}

/** Same as consumer-app session-storage initialsFromName. */
function initialsFrom(firstName: string, lastName: string, email: string): string {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  if (a || b) return `${a}${b}`.toUpperCase() || email.slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase() || 'U';
}

/** The saved copy as a profile, or null when the consumer-app would not use it (no token, email or user id). */
export function readGuestProfile(raw: string | null | undefined): GuestProfile | null {
  if (!raw) return null;
  let parsed: Record<string, unknown>;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    parsed = value as Record<string, unknown>;
  } catch {
    return null;
  }
  const userId = text(parsed.userId);
  const email = text(parsed.email);
  if (!userId || !email || !text(parsed.accessToken)) return null;
  const firstName = text(parsed.firstName);
  const lastName = text(parsed.lastName);
  const avatar = text(parsed.avatarUrl);
  return {
    userId,
    email,
    firstName,
    lastName,
    displayName: displayNameFrom(firstName, lastName, email),
    initials: initialsFrom(firstName, lastName, email),
    avatarUrl: /^https?:\/\//i.test(avatar) ? avatar : null,
    roles: Array.isArray(parsed.roles) ? parsed.roles.filter((role): role is string => typeof role === 'string') : [],
  };
}

export type GuestSessionChange = 'none' | 'signedIn' | 'signedOut' | 'switchedUser' | 'updated';

function userIdOf(raw: string | null): string | null {
  return readGuestProfile(raw)?.userId ?? null;
}

/**
 * What a storage event means for the guest web (same decisions as consumer-app crossTabAction).
 * `key` null = the whole storage was cleared. Switched user: reload, so nothing of the previous account stays on screen.
 */
export function guestSessionChange(input: { currentUserId: string | null; key: string | null; newValue: string | null }): GuestSessionChange {
  if (input.key !== null && input.key !== SESSION_STORAGE_KEY) return 'none';
  const nextUserId = input.key === null ? null : userIdOf(input.newValue);
  if (!nextUserId) return input.currentUserId ? 'signedOut' : 'none';
  if (!input.currentUserId) return 'signedIn';
  return input.currentUserId === nextUserId ? 'updated' : 'switchedUser';
}

/** 8 hours since the last activity of any tab. No saved time, a broken one, or one ahead of this clock: not expired. */
export function idleExpired(lastActivityRaw: string | null | undefined, now: number): boolean {
  const last = Number(lastActivityRaw);
  if (!lastActivityRaw || !Number.isFinite(last) || last <= 0 || last > now) return false;
  return now - last >= IDLE_LIMIT_MS;
}
