import type { MetadataRoute } from 'next';
import { roomPagePath } from '@nestyk/feature-listing/public';
import { guestSiteIndexable, guestSiteOrigin, INDEXABLE_PATHS, singleLanguageEntries, sitemapEntries } from '../lib/guest-seo';
import { loadRoomIdsForSitemap } from '../lib/guest-rooms';
import { loadAreas } from '../lib/guest-area-data';
import { areaSitemapPaths } from '../lib/guest-areas';

/** Rebuilt hourly: a room that is rented drops out within the hour (its page already answers 404). */
export const revalidate = 3600;

/**
 * /sitemap.xml. SEO-0: every language of each indexable page. SEO-1: public room pages, Thai only (D2, Mos 19 Nov
 * 2026), and /areas with the area pages that have rooms, every language (Mos 20 Nov 2026). Empty on a deploy that is
 * not indexable, without calling the API. When the API fails the rooms or areas are left out and the rest is served.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = guestSiteOrigin();
  const indexable = guestSiteIndexable();
  if (!indexable || !origin) return [];
  const [rooms, areas] = await Promise.allSettled([loadRoomIdsForSitemap(), loadAreas()]);
  if (rooms.status === 'rejected') console.error('[sitemap] public rooms failed:', rooms.reason);
  if (areas.status === 'rejected') console.error('[sitemap] public areas failed:', areas.reason);
  const roomIds = rooms.status === 'fulfilled' ? rooms.value : [];
  const areaPaths = areaSitemapPaths(areas.status === 'fulfilled' ? areas.value : []);
  return [
    ...sitemapEntries(origin, indexable, INDEXABLE_PATHS),
    ...sitemapEntries(origin, indexable, areaPaths),
    ...singleLanguageEntries(origin, indexable, roomIds.map(roomPagePath)),
  ];
}
