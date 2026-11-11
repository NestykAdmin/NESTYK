import type { PublicAreaSummary, PublicFeaturedRail, PublicRoomCard } from '@nestyk/types';
import { createApiPublicRoomsSource } from '@nestyk/feature-listing/public';
import { apiUrlMissing, HOME_RAIL_LIMIT, HOME_RAILS, keepPreviousHomePage, PUBLIC_API_TIMEOUT_MS, publicApiBase } from './guest-home';

/**
 * Rooms for the guest pages, read on the server from the public API (S6, apps/api/src/public-listings).
 * Next keeps each answer for 5 minutes (Mos 11 Nov 2026, H8), so visitors do not each call the API.
 * A failed call never breaks a page that is already cached: Next keeps the last good page (R3). When there is none
 * yet (build, dev) the section shows "โหลดไม่สำเร็จ" instead.
 */
export const PUBLIC_DATA_REVALIDATE_SECONDS = 300;
export const HOME_AREA_LIMIT = 6;

let warnedApiUrl = false;

function publicRooms() {
  if (!warnedApiUrl && apiUrlMissing(process.env.API_URL, process.env.NODE_ENV)) {
    warnedApiUrl = true;
    console.warn('[guest home] API_URL is not set: the public API is called on http://localhost:4000');
  }
  return createApiPublicRoomsSource({
    baseUrl: publicApiBase(),
    fetchImpl: (url) =>
      fetch(url, {
        next: { revalidate: PUBLIC_DATA_REVALIDATE_SECONDS },
        signal: AbortSignal.timeout(PUBLIC_API_TIMEOUT_MS),
      }),
  });
}

export interface HomeData {
  /** Null when the API could not be reached. */
  rails: Record<PublicFeaturedRail, PublicRoomCard[]> | null;
  areas: PublicAreaSummary[] | null;
}

export async function loadHomeData(): Promise<HomeData> {
  const rooms = publicRooms();
  const [rails, areas] = await Promise.allSettled([
    Promise.all(HOME_RAILS.map((rail) => rooms.featured(rail, HOME_RAIL_LIMIT))),
    rooms.areas(HOME_AREA_LIMIT),
  ]);
  if (rails.status === 'rejected') console.error('[guest home] featured rooms failed:', rails.reason);
  if (areas.status === 'rejected') console.error('[guest home] areas failed:', areas.reason);
  if (
    keepPreviousHomePage({
      railsFailed: rails.status === 'rejected',
      areasFailed: areas.status === 'rejected',
      nodeEnv: process.env.NODE_ENV,
      nextPhase: process.env.NEXT_PHASE,
    })
  ) {
    throw new Error('Public API unavailable: keeping the last good home page');
  }
  return {
    rails:
      rails.status === 'fulfilled'
        ? (Object.fromEntries(HOME_RAILS.map((rail, index) => [rail, rails.value[index] ?? []])) as HomeData['rails'])
        : null,
    areas: areas.status === 'fulfilled' ? areas.value : null,
  };
}
