import type { PublicAreaRegion, PublicAreaSummary } from '@nestyk/types';
import { localePath } from './guest-site';

/**
 * SEO-1 area pages /rent/<slug> and the area list /areas (Mos 20 Nov 2026; design A, canvas page "area").
 * Areas come from GET /public/areas, which lists only areas that have rooms; the names, places and texts come from
 * i18n by slug. Pure helpers: lib/guest-areas.test.cjs loads this file bare.
 */

/** Rooms shown on an area page; "see all" opens the search for the area. */
export const AREA_PAGE_ROOM_LIMIT = 8;
/** Other areas of the same region at the foot of an area page. */
export const OTHER_AREA_LIMIT = 4;

/** Known = the copy has a name for it (the copy test keeps it in step with the API areas table). */
export function isKnownArea(slug: string, names: Record<string, string>): boolean {
  return Object.prototype.hasOwnProperty.call(names, slug) && typeof names[slug] === 'string';
}

export function areaPagePath(slug: string): string {
  return `/rent/${encodeURIComponent(slug)}`;
}

export function splitByRegion(areas: readonly PublicAreaSummary[]): { bangkok: PublicAreaSummary[]; province: PublicAreaSummary[] } {
  return {
    bangkok: areas.filter((area) => area.region !== 'province'),
    province: areas.filter((area) => area.region === 'province'),
  };
}

/** Same region as this area (its own region when it has no rooms and so is not in the list), up to four. */
export function otherAreas(
  areas: readonly PublicAreaSummary[],
  slug: string,
  fallbackRegion: PublicAreaRegion = 'bangkok',
): PublicAreaSummary[] {
  const region = areas.find((area) => area.slug === slug)?.region ?? fallbackRegion;
  return areas.filter((area) => area.slug !== slug && area.region === region).slice(0, OTHER_AREA_LIMIT);
}

/** An area with no rooms is a thin page: open, but not for search engines. */
export function areaPageIndex(roomCount: number): boolean {
  return roomCount > 0;
}

/** /areas, and each area page that has rooms (every language; sitemapEntries adds them). */
export function areaSitemapPaths(areas: readonly PublicAreaSummary[]): string[] {
  return ['/areas', ...areas.filter((area) => areaPageIndex(area.roomCount)).map((area) => areaPagePath(area.slug))];
}

export interface AreaJsonLdInput {
  origin: string;
  locale: string;
  slug: string;
  name: string;
  homeName: string;
  listName: string;
}

/** BreadcrumbList of an area page (matches the page breadcrumb). Null without a site address. */
export function areaJsonLd({ origin, locale, slug, name, homeName, listName }: AreaJsonLdInput): Record<string, unknown> | null {
  if (!origin) return null;
  const url = (path: string) => `${origin}${localePath(locale, path)}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: homeName, item: url('/') },
          { '@type': 'ListItem', position: 2, name: listName, item: url('/areas') },
          { '@type': 'ListItem', position: 3, name, item: url(areaPagePath(slug)) },
        ],
      },
    ],
  };
}
