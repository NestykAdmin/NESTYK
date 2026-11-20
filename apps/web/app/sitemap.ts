import type { MetadataRoute } from 'next';
import { roomPagePath } from '@nestyk/feature-listing/public';
import { guestSiteIndexable, guestSiteOrigin, INDEXABLE_PATHS, singleLanguageEntries, sitemapEntries } from '../lib/guest-seo';
import { loadRoomIdsForSitemap } from '../lib/guest-rooms';

/** Rebuilt hourly: a room that is rented drops out within the hour (its page already answers 404). */
export const revalidate = 3600;

/**
 * /sitemap.xml. SEO-0: every language of each indexable page. SEO-1: public room pages, Thai only (D2, Mos 19 Nov
 * 2026). Empty on a deploy that is not indexable, without calling the API. When the API fails the rooms are left out
 * and the rest is still served.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = guestSiteOrigin();
  const indexable = guestSiteIndexable();
  if (!indexable || !origin) return [];
  let roomIds: string[] = [];
  try {
    roomIds = await loadRoomIdsForSitemap();
  } catch (error) {
    console.error('[sitemap] public rooms failed:', error);
  }
  return [
    ...sitemapEntries(origin, indexable, INDEXABLE_PATHS),
    ...singleLanguageEntries(origin, indexable, roomIds.map(roomPagePath)),
  ];
}
