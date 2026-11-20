import type { PropertyType, PublicRoomDetail } from '@nestyk/types';
import { localePath } from './guest-site';

/**
 * JSON-LD of a room page (SEO-1, Mos 19 Nov 2026; project-docs/nestyk-guest-seo-plan-20261111.md item 5).
 * A RealEstateListing plus the page breadcrumb. Google has no rich result for monthly rentals, so this helps it read
 * the page; it does not make a special card. Never VacationRental. Never the position: the page shows a rough area.
 */
export interface RoomJsonLdInput {
  /** Site address (guestSiteOrigin). Empty: no JSON-LD, because every item needs a full URL. */
  origin: string;
  locale: string;
  /** Room page path without the language prefix (roomPagePath). */
  path: string;
  /** The title shown on the page. */
  title: string;
  /** Name of the home page in this language (first breadcrumb). */
  homeName: string;
  room: PublicRoomDetail;
}

const PLACE_TYPE: Record<PropertyType, string> = {
  condo: 'Apartment',
  apartment: 'Apartment',
  house: 'House',
  townhome: 'House',
};

const MAX_IMAGES = 10;

export function roomJsonLd({ origin, locale, path, title, homeName, room }: RoomJsonLdInput): Record<string, unknown> | null {
  if (!origin) return null;
  const url = `${origin}${localePath(locale, path)}`;
  const images = httpsOnly(room.imageUrls);
  const image = images.length ? images.slice(0, MAX_IMAGES) : httpsOnly(room.coverImageUrl ? [room.coverImageUrl] : []);
  const description = room.description?.trim();
  const price = room.priceFrom != null && room.priceFrom > 0 ? room.priceFrom : null;

  const listing = compact({
    '@type': 'RealEstateListing',
    '@id': `${url}#listing`,
    url,
    name: title,
    description: description || undefined,
    // No inLanguage: the title and description are the agent's own text (usually Thai) on every language page.
    image: image.length ? image : undefined,
    offers: price
      ? compact({
          '@type': 'Offer',
          price,
          priceCurrency: 'THB',
          priceSpecification: { '@type': 'UnitPriceSpecification', price, priceCurrency: 'THB', unitCode: 'MON' },
          availabilityStarts: room.availableFrom ?? undefined,
        })
      : undefined,
    about: compact({
      '@type': (room.propertyType && PLACE_TYPE[room.propertyType]) || 'Accommodation',
      numberOfBedrooms: room.bedrooms ?? undefined,
      numberOfBathroomsTotal: room.bathrooms ?? undefined,
      floorSize: room.areaSqm != null ? { '@type': 'QuantitativeValue', value: room.areaSqm, unitCode: 'MTK' } : undefined,
      floorLevel: room.floor != null ? String(room.floor) : undefined,
      petsAllowed: room.petFriendly,
      address: room.district ? { '@type': 'PostalAddress', addressLocality: room.district, addressCountry: 'TH' } : undefined,
    }),
  });

  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: homeName, item: `${origin}${localePath(locale, '/')}` },
      { '@type': 'ListItem', position: 2, name: title, item: url },
    ],
  };

  return { '@context': 'https://schema.org', '@graph': [listing, breadcrumb] };
}

/**
 * The text of a <script type="application/ld+json">. "<" is written as \u003c, so text typed by an agent
 * (the description) can never close the tag; JSON.parse gives the same text back.
 */
export function jsonLdScript(data: unknown): string {
  // U+2028 / U+2029 too (older JSON readers treat them as line ends). Built with fromCharCode: no raw separator in source.
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .split(String.fromCharCode(0x2028))
    .join('\\u2028')
    .split(String.fromCharCode(0x2029))
    .join('\\u2029');
}

function httpsOnly(urls: readonly string[]): string[] {
  return urls.filter((value) => /^https:\/\//i.test(value));
}

function compact(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null));
}

/** A page of public room search results, as far as the sitemap needs it. */
export interface RoomIdPage {
  items: readonly { id: string }[];
  total: number;
}

/**
 * Ids of every public room for sitemap.xml: pages through the search (the API gives at most 48 per page) until the
 * total is reached or a page comes back short, without repeats, and never past maxPages (a guard against a total
 * that keeps growing). Throws when a page fails; the sitemap then lists no rooms.
 */
export async function collectRoomIds(
  fetchPage: (page: number) => Promise<RoomIdPage>,
  pageSize: number,
  maxPages: number,
): Promise<string[]> {
  const ids = new Set<string>();
  for (let page = 1; page <= maxPages; page += 1) {
    const result = await fetchPage(page);
    for (const item of result.items) ids.add(item.id);
    if (result.items.length < pageSize || page * pageSize >= result.total) break;
  }
  return [...ids];
}
