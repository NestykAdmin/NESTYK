/**
 * Web idle sign out (Mos 4 Nov 2026): 8 hours with no input signs this device out, with a 2-minute warning.
 * Pure rules, no imports (tests load it bare). The last activity time is shared by every tab through localStorage,
 * so one tab in use keeps the others signed in. Mobile has no idle sign out.
 */
export const IDLE_LIMIT_MS = 8 * 60 * 60 * 1000;
export const IDLE_WARN_MS = 2 * 60 * 1000;
/** How often a tab writes "still active" while the user works (fewer writes, same result). */
export const ACTIVITY_WRITE_MS = 15 * 1000;
/** How often a tab checks the clock. */
export const IDLE_CHECK_MS = 15 * 1000;
export const ACTIVITY_KEY = 'nestyk.web.lastActivity';

export type IdlePhase = 'active' | 'warn' | 'expired';

/** The saved time, or null when missing or unreadable. */
export function parseLastActivity(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** No saved time, or a time ahead of this clock (clock changed), counts as active now. */
export function idlePhase(lastActivity: number | null, now: number): IdlePhase {
  if (lastActivity === null || lastActivity > now) return 'active';
  const idle = now - lastActivity;
  if (idle >= IDLE_LIMIT_MS) return 'expired';
  if (idle >= IDLE_LIMIT_MS - IDLE_WARN_MS) return 'warn';
  return 'active';
}

/** Time left before the sign out, "1:05". */
export function countdownLabel(lastActivity: number | null, now: number): string {
  const left = lastActivity === null ? IDLE_WARN_MS : Math.max(0, lastActivity + IDLE_LIMIT_MS - now);
  const seconds = Math.ceil(left / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
