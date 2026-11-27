/**
 * Pull to refresh in the NESTYK app (Mos 25 Nov 2026, canvas page "ptr", design A). Phone browsers have their own,
 * so this runs only inside the app (GuestPullRefresh). Plain rules here; the touch handling is in the component.
 */

/** Event a pull sends to the page's lists (saved rooms, viewing requests) so they load again. */
export const PULL_EVENT = 'nk:refresh';
/** The page moves this far (px) before letting go reloads. */
export const PULL_THRESHOLD = 72;
/** The page never moves further than this. */
export const PULL_MAX = 120;
/** Where the page waits while it reloads. */
export const PULL_LOADING = 56;
/** The page moves half as far as the finger. */
export const PULL_RESIST = 0.5;
/** Finger travel before a downward drag counts as a pull (a tap or a sideways swipe stays as it is). */
export const PULL_START = 8;

const LOCALE = /^\/(?:en|ja|zh)(?=\/|$)/;

/** Pages with lists: home, search results (not the map), saved rooms, viewing requests and a room page. */
export function pullAllowed(pathname: string, search = ''): boolean {
  const path = pathname.replace(LOCALE, '') || '/';
  if (path === '/' || path === '/saved' || path === '/viewing-requests') return true;
  if (path === '/search') return new URLSearchParams(search).get('view') !== 'map';
  return /^\/rooms\/[^/]+$/.test(path);
}

/** How far the page moves for a finger that moved `fingerDy` px down. */
export function pullOffset(fingerDy: number): number {
  if (!(fingerDy > 0)) return 0;
  return Math.min(PULL_MAX, Math.round(fingerDy * PULL_RESIST));
}

/** How full the smile is (0–1) for a page moved `offset` px. */
export function pullProgress(offset: number): number {
  return Math.max(0, Math.min(1, offset / PULL_THRESHOLD));
}

export type RefreshDetail = { waitFor: Promise<boolean>[] };

/** Ask every list on the page to load again; true when all of them did (or none is listening). */
export async function requestRefresh(target: EventTarget): Promise<boolean> {
  const detail: RefreshDetail = { waitFor: [] };
  target.dispatchEvent(new CustomEvent<RefreshDetail>(PULL_EVENT, { detail }));
  const results = await Promise.all(detail.waitFor.map((done) => done.catch(() => false)));
  return results.every(Boolean);
}

/** A list joins the pull: `load` runs on every pull and says whether it loaded. Returns the way to leave. */
export function onRefresh(target: EventTarget, load: () => Promise<boolean>): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<RefreshDetail>).detail;
    detail?.waitFor.push(load());
  };
  target.addEventListener(PULL_EVENT, listener);
  return () => target.removeEventListener(PULL_EVENT, listener);
}
