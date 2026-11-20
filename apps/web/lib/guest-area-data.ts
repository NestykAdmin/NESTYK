import type { PublicAreaSummary, PublicRoomSearchResult } from '@nestyk/types';
import { createApiPublicRoomsSource } from '@nestyk/feature-listing/public';
import { PUBLIC_API_TIMEOUT_MS, publicApiBase } from './guest-home';
import { AREA_PAGE_ROOM_LIMIT } from './guest-areas';

/**
 * Data of the area pages (SEO-1), read on the server from the public API and kept 5 minutes like the home page.
 * Both loaders throw when the API cannot be reached: the page then keeps its last good version (ISR) or shows the
 * error state.
 */
export const AREA_DATA_REVALIDATE_SECONDS = 300;
/** Every area of the API table (10 Bangkok + 10 province zones); the API lists only those with rooms. */
export const AREA_LIST_LIMIT = 20;

function source() {
  return createApiPublicRoomsSource({
    baseUrl: publicApiBase(),
    fetchImpl: (url) =>
      fetch(url, {
        next: { revalidate: AREA_DATA_REVALIDATE_SECONDS },
        signal: AbortSignal.timeout(PUBLIC_API_TIMEOUT_MS),
      }),
  });
}

export async function loadAreas(): Promise<PublicAreaSummary[]> {
  return source().areas(AREA_LIST_LIMIT);
}

/** The first rooms of an area, recommended order; total is the whole area (for "see all N rooms"). */
export async function loadAreaRooms(slug: string): Promise<PublicRoomSearchResult> {
  return source().search({ mode: 'rent', area: slug, quick: [], sortBy: 'recommended', page: 1, limit: AREA_PAGE_ROOM_LIMIT });
}
