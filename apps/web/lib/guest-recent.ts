import { BEDROOM_CHOICES, HOME_PROPERTY_TYPES, homeSearchHref, type HomeSearchInput } from './guest-home';

/**
 * Recent searches of the mobile search page /find (Mos 25 Nov 2026, canvas page "searchnew"). Kept on this device only
 * (localStorage, RECENT_KEY), never sent anywhere; "near me" alone is not kept, so no position of the guest is stored.
 * Pure rules: lib/guest-recent.test.cjs loads this file bare.
 */

export const RECENT_KEY = 'nestyk.guest.recentSearches.v1';
export const RECENT_MAX = 5;
/** Set by the home search bar's link (SearchPanel): ✕ on /find then goes back there instead of to another site. */
export const FIND_FROM_SITE = 'nestyk.find.fromSite';

export type RecentSearch = Pick<HomeSearchInput, 'keyword' | 'area' | 'placeName' | 'nearGps' | 'type' | 'minPrice' | 'maxPrice' | 'bedrooms'>;

const BEDROOM_IDS = BEDROOM_CHOICES.map((choice) => choice.id);

function text(value: unknown, max = 120): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : undefined;
}

function amount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : undefined;
}

function position(value: unknown): RecentSearch['nearGps'] {
  if (!value || typeof value !== 'object') return undefined;
  const { latitude, longitude, radiusKm } = value as Record<string, unknown>;
  const ok = (n: unknown, limit: number) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= limit;
  return ok(latitude, 90) && ok(longitude, 180) && typeof radiusKm === 'number' && radiusKm > 0 && radiusKm <= 50
    ? { latitude: latitude as number, longitude: longitude as number, radiusKm }
    : undefined;
}

/** Only the known fields with sane values; null when nothing is left or only "near me" (no place name) remains. */
function clean(value: unknown): RecentSearch | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const out: RecentSearch = {};
  const keyword = text(raw.keyword);
  const area = text(raw.area, 60);
  const placeName = text(raw.placeName);
  const nearGps = position(raw.nearGps);
  const type = HOME_PROPERTY_TYPES.find((item) => item === raw.type);
  const bedrooms = BEDROOM_IDS.find((item) => item === raw.bedrooms);
  const minPrice = amount(raw.minPrice);
  const maxPrice = amount(raw.maxPrice);
  if (keyword) out.keyword = keyword;
  if (area) out.area = area;
  if (placeName && nearGps) {
    out.placeName = placeName;
    out.nearGps = nearGps;
  }
  if (type) out.type = type;
  if (minPrice !== undefined) out.minPrice = minPrice;
  if (maxPrice !== undefined) out.maxPrice = maxPrice;
  if (bedrooms) out.bedrooms = bedrooms;
  return Object.keys(out).length ? out : null;
}

/** The list after a search: this one first, no repeats (same results link), at most RECENT_MAX. */
export function addRecentSearch(list: readonly RecentSearch[], search: HomeSearchInput): RecentSearch[] {
  // "Near me" with other filters: kept without the place it would be a different search (review R7), so not kept.
  if (search.nearGps && !search.placeName) return [...list];
  const item = clean(search);
  if (!item) return [...list];
  const href = homeSearchHref(item);
  return [item, ...list.filter((other) => homeSearchHref(other) !== href)].slice(0, RECENT_MAX);
}

/** What localStorage holds, checked again: anything unknown or malformed is dropped. */
export function parseRecentSearches(raw: string | null | undefined): RecentSearch[] {
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map(clean)
    .filter((item): item is RecentSearch => {
      if (!item) return false;
      const href = homeSearchHref(item);
      if (seen.has(href)) return false;
      seen.add(href);
      return true;
    })
    .slice(0, RECENT_MAX);
}

export interface RecentWords {
  areaNames: Record<string, string>;
  nearMe: string;
  anywhere: string;
  propertyType: Record<string, string>;
  bedroom: Record<string, string>;
  price: (min: number | undefined, max: number | undefined) => string | null;
}

/** "สุขุมวิท · คอนโด · ฿10k–20k · 1 ห้องนอน" (the place, then whatever else was chosen). */
export function recentSearchLabel(search: RecentSearch, words: RecentWords): string {
  const place = search.placeName ?? (search.area ? (words.areaNames[search.area] ?? search.area) : search.keyword) ?? (search.nearGps ? words.nearMe : null);
  const parts = [
    place ?? words.anywhere,
    search.type ? words.propertyType[search.type] : null,
    words.price(search.minPrice, search.maxPrice),
    search.bedrooms ? words.bedroom[search.bedrooms] : null,
  ];
  return parts.filter((part): part is string => Boolean(part)).join(' · ');
}
