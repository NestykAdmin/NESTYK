import type { PublicAreaSummary, PublicFeaturedRail, PublicRoomCard, PublicRoomDetail, PublicRoomSearchQuery, PublicRoomSearchResult } from '@nestyk/types';
import { createApiPublicRoomsSource } from '@nestyk/feature-listing/public';
import { apiUrlMissing, HOME_RAIL_LIMIT, HOME_RAILS, keepPreviousHomePage, PUBLIC_API_TIMEOUT_MS, publicApiBase } from './guest-home';
import { collectRoomIds } from './guest-room-seo';

/**
 * Rooms for the guest pages, read on the server from the public API (S6, apps/api/src/public-listings).
 * Next keeps each answer for 5 minutes (Mos 11 Nov 2026, H8), so visitors do not each call the API.
 * A failed call never breaks a page that is already cached: Next keeps the last good page (R3). When there is none
 * yet (build, dev) the section shows "โหลดไม่สำเร็จ" instead.
 */
export const PUBLIC_DATA_REVALIDATE_SECONDS = 300;
/** Search results change with every filter: kept for 30 seconds, like the API's own cache header (plan A3). */
export const SEARCH_REVALIDATE_SECONDS = 30;
export const HOME_AREA_LIMIT = 6;

let warnedApiUrl = false;

function publicRooms(revalidate: number = PUBLIC_DATA_REVALIDATE_SECONDS) {
  if (!warnedApiUrl && apiUrlMissing(process.env.API_URL, process.env.NODE_ENV)) {
    warnedApiUrl = true;
    console.warn('[guest home] API_URL is not set: the public API is called on http://localhost:4000');
  }
  return createApiPublicRoomsSource({
    baseUrl: publicApiBase(),
    fetchImpl: (url) =>
      fetch(url, {
        next: { revalidate },
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

/** One page of search results (S4.2). Throws when the API cannot be reached; the page shows the error state. */
export async function loadSearchResults(query: PublicRoomSearchQuery): Promise<PublicRoomSearchResult> {
  return publicRooms(SEARCH_REVALIDATE_SECONDS).search(query);
}

/**
 * One room for /rooms/<id> (S7.3). Null when the API answers 404 (not public, rented or never existed). Throws when
 * the API cannot be reached; the page then shows the error state. Kept for 5 minutes like the home page.
 */
export async function loadRoomDetail(id: string): Promise<PublicRoomDetail | null> {
  return publicRooms().detail(id);
}

/** Rooms shown under "ห้องอื่นใกล้ ..." on a room page. */
export const NEARBY_ROOM_LIMIT = 4;

/**
 * Other rooms near the same station (or in the same district when the room has no station), without this room.
 * Never throws: the section is left out when the API fails.
 */
export async function loadNearbyRooms(room: PublicRoomDetail): Promise<PublicRoomCard[]> {
  const station = room.nearestStation;
  if (!station && !room.district) return [];
  const query: PublicRoomSearchQuery = {
    mode: 'rent',
    quick: [],
    sortBy: 'recommended',
    page: 1,
    limit: NEARBY_ROOM_LIMIT + 1,
    ...(station ? { stationType: station.type, stationName: station.name } : { keyword: room.district ?? undefined }),
  };
  try {
    const result = await publicRooms().search(query);
    return result.items.filter((item) => item.id !== room.id).slice(0, NEARBY_ROOM_LIMIT);
  } catch (error) {
    console.error('[guest room] nearby rooms failed:', error);
    return [];
  }
}

/** sitemap.xml is rebuilt hourly (SEO-1); its API calls are kept as long. */
export const SITEMAP_REVALIDATE_SECONDS = 3600;
/** The API's largest search page (apps/api public-search.ts SEARCH_PAGE_SIZE_MAX). */
const SITEMAP_PAGE_SIZE = 48;
/** Guard: at most 2,400 rooms in the sitemap. Raise it (or split the sitemap) when there are more. */
const SITEMAP_MAX_PAGES = 50;

/** Ids of every public room, newest first, for sitemap.xml. Throws when the API cannot be reached. */
export async function loadRoomIdsForSitemap(): Promise<string[]> {
  const rooms = publicRooms(SITEMAP_REVALIDATE_SECONDS);
  return collectRoomIds(
    (page) => rooms.search({ mode: 'rent', quick: [], sortBy: 'newest', page, limit: SITEMAP_PAGE_SIZE }),
    SITEMAP_PAGE_SIZE,
    SITEMAP_MAX_PAGES,
  );
}
