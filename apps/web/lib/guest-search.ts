import type { PropertyType, PublicMoveIn, PublicRoomSearchQuery } from '@nestyk/types';
import { criteriaToSearchParams, type GuestQuickFilter, type GuestSearchCriteria } from '@nestyk/feature-search';
import { formatPublicPrice, publicSearchParams } from '@nestyk/feature-listing/public';

/**
 * Search page rules (S4.2, design v2.3 SearchWebV23 / SearchMobileV22 / SearchSheetV22).
 * Pure helpers: lib/guest-search.test.cjs loads this file bare, so no React or Next here.
 */

/** Orders offered on the page. "distance" needs a location search, which the page does not have yet. */
export const SEARCH_SORT_OPTIONS = ['recommended', 'price_asc', 'price_desc', 'newest'] as const;
/** Bedroom chips: studio, 1, 2 and 3+ (the API reads 3 as "3 or more"). */
export const BEDROOM_FILTERS = [0, 1, 2, 3] as const;
export const BEDROOMS_OR_MORE = 3;
export const MOVE_IN_OPTIONS: readonly PublicMoveIn[] = ['now', '30d', '90d'];
/** "อื่น ๆ" checkboxes. "พร้อมเข้าอยู่" is the move-in choice "now" (Mos 12 Nov 2026, Q3). */
export const OTHER_FILTERS = ['nearTransit', 'petFriendly', 'shortTerm'] as const;
/** Townhome joins when the database has that type (plan K5); the home page shows it as "เร็ว ๆ นี้" until then. */
export const SEARCH_PROPERTY_TYPES: readonly PropertyType[] = ['condo', 'apartment', 'house'];
/** Deepest page the API serves (apps/api public-search.ts SEARCH_PAGE_MAX). */
export const SEARCH_PAGE_MAX = 50;
/** The first page load shows at most this many rooms (the API page-size cap). */
export const SEARCH_FIRST_LOAD_MAX = 48;

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/**
 * One way to say each filter: the home "พร้อมเข้าอยู่" chip (quick=moveInReady) becomes move-in "now", and bedroom
 * counts above 3 fold into "3+". A location (lat/lng) is dropped: the page cannot show or remove it until the map
 * search (S4.3), so it would be a hidden filter (review L3).
 */
export function normalizeSearchCriteria(criteria: GuestSearchCriteria): GuestSearchCriteria {
  const next: GuestSearchCriteria = {
    ...criteria,
    quick: criteria.quick.filter((code) => code !== 'moveInReady'),
    nearGps: undefined,
  };
  if (criteria.quick.includes('moveInReady')) next.moveIn = 'now';
  if (criteria.bedrooms?.length) {
    next.bedrooms = [...new Set(criteria.bedrooms.map((count) => Math.min(count, BEDROOMS_OR_MORE)))].sort((a, b) => a - b);
  }
  return next;
}

/** "/search?…" for these criteria (values equal to the defaults are left out). */
export function searchHref(criteria: Partial<GuestSearchCriteria>): string {
  const query = criteriaToSearchParams(criteria).toString();
  return query ? `/search?${query}` : '/search';
}

/** Criteria with some filters changed. Any change starts again from the first page. */
export function withFilters(criteria: GuestSearchCriteria, patch: Partial<GuestSearchCriteria>): GuestSearchCriteria {
  return { ...criteria, ...patch, page: 1 };
}

export interface SearchTitleLabels {
  titleAll: string;
  titleAllNearTransit: string;
  titleType: string;
  titleTypeNearTransit: string;
  titleKeyword: string;
  propertyType: Record<PropertyType, string>;
}

/** Page heading from the filters: the keyword, else one property type, plus "near transit" when that chip is on. */
export function searchTitle(criteria: GuestSearchCriteria, labels: SearchTitleLabels): string {
  if (criteria.keyword) return fill(labels.titleKeyword, { keyword: criteria.keyword });
  const nearTransit = criteria.quick.includes('nearTransit');
  const types = criteria.propertyType ?? [];
  if (types.length === 1) {
    return fill(nearTransit ? labels.titleTypeNearTransit : labels.titleType, { type: labels.propertyType[types[0]] });
  }
  return nearTransit ? labels.titleAllNearTransit : labels.titleAll;
}

export interface FilterChipLabels {
  propertyType: Record<PropertyType, string>;
  quick: Record<GuestQuickFilter, string>;
  priceUnder: string;
  priceBetween: string;
  priceOver: string;
  studio: string;
  bedroomOne: string;
  bedroomMany: string;
  threePlus: string;
  moveIn: Record<PublicMoveIn, string>;
  durationChip: string;
}

export interface FilterChip {
  key: string;
  label: string;
  /** The search without this filter. */
  href: string;
}

export function priceRangeLabel(min: number | undefined, max: number | undefined, labels: Pick<FilterChipLabels, 'priceUnder' | 'priceBetween' | 'priceOver'>): string | null {
  const low = min !== undefined ? formatPublicPrice(min) : null;
  const high = max !== undefined ? formatPublicPrice(max) : null;
  if (low && high) return fill(labels.priceBetween, { min: low, max: high });
  if (high) return fill(labels.priceUnder, { max: high });
  if (low) return fill(labels.priceOver, { min: low });
  return null;
}

export function bedroomLabel(count: number, labels: Pick<FilterChipLabels, 'studio' | 'bedroomOne' | 'bedroomMany' | 'threePlus'>): string {
  if (count === 0) return labels.studio;
  if (count >= BEDROOMS_OR_MORE) return labels.threePlus;
  return fill(count === 1 ? labels.bedroomOne : labels.bedroomMany, { count });
}

/** The filters in use, each with a link that removes only that one (design: chips above the results). */
export function activeFilterChips(criteria: GuestSearchCriteria, labels: FilterChipLabels): FilterChip[] {
  const chips: FilterChip[] = [];
  const add = (key: string, label: string, patch: Partial<GuestSearchCriteria>) =>
    chips.push({ key, label, href: searchHref(withFilters(criteria, patch)) });
  const without = <T>(list: readonly T[] | undefined, item: T): T[] | undefined => {
    const rest = (list ?? []).filter((value) => value !== item);
    return rest.length ? rest : undefined;
  };

  if (criteria.keyword) add('keyword', criteria.keyword, { keyword: undefined });
  for (const type of criteria.propertyType ?? []) {
    add(`type-${type}`, labels.propertyType[type], { propertyType: without(criteria.propertyType, type) });
  }
  const price = priceRangeLabel(criteria.minPrice, criteria.maxPrice, labels);
  if (price) add('price', price, { minPrice: undefined, maxPrice: undefined });
  for (const count of criteria.bedrooms ?? []) {
    add(`beds-${count}`, bedroomLabel(count, labels), { bedrooms: without(criteria.bedrooms, count) });
  }
  if (criteria.moveIn) add('movein', labels.moveIn[criteria.moveIn], { moveIn: undefined });
  for (const code of criteria.quick) add(`quick-${code}`, labels.quick[code], { quick: criteria.quick.filter((value) => value !== code) });
  if (criteria.stationType || criteria.stationName) {
    add('station', [criteria.stationType, criteria.stationName].filter(Boolean).join(' '), {
      stationType: undefined,
      stationName: undefined,
    });
  }
  if (criteria.durationMonths) {
    add('duration', fill(labels.durationChip, { count: criteria.durationMonths }), { durationMonths: undefined });
  }
  return chips;
}

/** Number on the mobile "ตัวกรอง" button: every filter in the sheet (the keyword has its own box). */
export function activeFilterCount(criteria: GuestSearchCriteria): number {
  return (
    (criteria.propertyType?.length ?? 0) +
    (criteria.minPrice !== undefined || criteria.maxPrice !== undefined ? 1 : 0) +
    (criteria.bedrooms?.length ?? 0) +
    (criteria.moveIn ? 1 : 0) +
    criteria.quick.length +
    (criteria.stationType || criteria.stationName ? 1 : 0) +
    (criteria.durationMonths ? 1 : 0)
  );
}

/**
 * The server's first request. "Load more" keeps the page number in the URL, so a shared link opens with the same
 * pages showing, up to SEARCH_FIRST_LOAD_MAX rooms in one request; later pages are loaded on demand.
 */
export function firstLoad(criteria: Pick<GuestSearchCriteria, 'page' | 'limit'>): { page: 1; limit: number; loadedPages: number } {
  const maxPages = Math.max(1, Math.floor(SEARCH_FIRST_LOAD_MAX / criteria.limit));
  const loadedPages = Math.min(criteria.page, maxPages);
  return { page: 1, limit: loadedPages * criteria.limit, loadedPages };
}

export function toPublicQuery(criteria: GuestSearchCriteria, page: number, limit: number): PublicRoomSearchQuery {
  return {
    mode: criteria.mode,
    keyword: criteria.keyword,
    propertyType: criteria.propertyType,
    minPrice: criteria.minPrice,
    maxPrice: criteria.maxPrice,
    bedrooms: criteria.bedrooms,
    stationType: criteria.stationType,
    stationName: criteria.stationName,
    nearGps: criteria.nearGps,
    durationMonths: criteria.durationMonths,
    moveIn: criteria.moveIn,
    quick: criteria.quick,
    sortBy: criteria.sortBy,
    page,
    limit,
  };
}

/** Same-site URL for the browser: next.config rewrites /api/* to the API (API_URL/api/v1/*). */
export function publicSearchUrl(query: PublicRoomSearchQuery): string {
  return `/api/public/rooms/search?${publicSearchParams(query).toString()}`;
}

/** Every filter off. The keyword and the order stay unless `keyword` is set ("ล้างตัวกรอง" on an empty result). */
export function clearedFilters(criteria: GuestSearchCriteria, options: { keyword?: boolean } = {}): GuestSearchCriteria {
  return withFilters(criteria, {
    keyword: options.keyword ? undefined : criteria.keyword,
    propertyType: undefined,
    minPrice: undefined,
    maxPrice: undefined,
    bedrooms: undefined,
    moveIn: undefined,
    quick: [],
    stationType: undefined,
    stationName: undefined,
    nearGps: undefined,
    durationMonths: undefined,
  });
}
