import type { PropertyType } from '@nestyk/types';
import type { SearchFilterParams } from './index';

/**
 * Search criteria for the public (guest) listing pages.
 * Extends SearchFilterParams with the guest-only controls and converts to/from a URL query string,
 * so a search page can be shared, bookmarked and rendered on the server.
 */

export type GuestListingMode = 'rent' | 'buy';
export type GuestSearchView = 'list' | 'map';

/** Popular filter chips shown above the results, in display order. */
export const GUEST_QUICK_FILTERS = ['nearTransit', 'moveInReady', 'petFriendly', 'shortTerm'] as const;
export type GuestQuickFilter = (typeof GUEST_QUICK_FILTERS)[number];

export interface GuestSearchCriteria extends SearchFilterParams {
  mode: GuestListingMode;
  view: GuestSearchView;
  quick: GuestQuickFilter[];
  page: number;
  limit: number;
  sortBy: NonNullable<SearchFilterParams['sortBy']>;
}

export const GUEST_PAGE_SIZE_DEFAULT = 12;
export const GUEST_PAGE_SIZE_MAX = 48;
export const GUEST_KEYWORD_MAX_LENGTH = 100;
export const GUEST_GPS_RADIUS_DEFAULT_KM = 5;
export const GUEST_GPS_RADIUS_MAX_KM = 50;

const MODES: readonly GuestListingMode[] = ['rent', 'buy'];
const VIEWS: readonly GuestSearchView[] = ['list', 'map'];
const PROPERTY_TYPES: readonly PropertyType[] = ['condo', 'apartment', 'house', 'townhome'];
const STATION_TYPES = ['BTS', 'MRT'] as const;
const DURATIONS = [1, 3, 6, 12] as const;
const SORTS = ['price_asc', 'price_desc', 'newest', 'distance'] as const;
const MAX_BEDROOMS = 10;

export type GuestSearchParamsInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

export function defaultGuestCriteria(): GuestSearchCriteria {
  return {
    mode: 'rent',
    view: 'list',
    quick: [],
    page: 1,
    limit: GUEST_PAGE_SIZE_DEFAULT,
    sortBy: 'newest',
  };
}

function pick<T extends string | number>(value: string | undefined, allowed: readonly T[]): T | undefined {
  if (value === undefined) return undefined;
  return allowed.find((item) => String(item) === value);
}

function toNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toList(value: string | undefined): string[] {
  return value ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

export function criteriaFromSearchParams(input: GuestSearchParamsInput): GuestSearchCriteria {
  const get = (key: string): string | undefined => {
    if (input instanceof URLSearchParams) return input.get(key) ?? undefined;
    const raw = input[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };

  const criteria = defaultGuestCriteria();
  criteria.mode = pick(get('mode'), MODES) ?? criteria.mode;
  criteria.view = pick(get('view'), VIEWS) ?? criteria.view;
  criteria.sortBy = pick(get('sort'), SORTS) ?? criteria.sortBy;

  const page = toNumber(get('page'));
  if (page !== undefined && Number.isInteger(page) && page >= 1) criteria.page = page;
  const limit = toNumber(get('limit'));
  if (limit !== undefined && Number.isInteger(limit) && limit >= 1) {
    criteria.limit = Math.min(limit, GUEST_PAGE_SIZE_MAX);
  }

  const quickRequested = new Set(toList(get('quick')));
  criteria.quick = GUEST_QUICK_FILTERS.filter((code) => quickRequested.has(code));

  const keyword = get('q')?.trim().slice(0, GUEST_KEYWORD_MAX_LENGTH).trim();
  if (keyword) criteria.keyword = keyword;

  const types = toList(get('type')).filter((t): t is PropertyType => PROPERTY_TYPES.includes(t as PropertyType));
  if (types.length) criteria.propertyType = PROPERTY_TYPES.filter((t) => types.includes(t));

  let min = toNumber(get('min'));
  let max = toNumber(get('max'));
  if (min !== undefined && min < 0) min = undefined;
  if (max !== undefined && max < 0) max = undefined;
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
  if (min !== undefined) criteria.minPrice = min;
  if (max !== undefined) criteria.maxPrice = max;

  const beds = [...new Set(
    toList(get('beds')).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= MAX_BEDROOMS),
  )].sort((a, b) => a - b);
  if (beds.length) criteria.bedrooms = beds;

  const stationType = pick(get('st'), STATION_TYPES);
  if (stationType) criteria.stationType = stationType;
  const stationName = get('station')?.trim();
  if (stationName) criteria.stationName = stationName;

  const lat = toNumber(get('lat'));
  const lng = toNumber(get('lng'));
  if (lat !== undefined && lng !== undefined && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    const r = toNumber(get('r'));
    const radiusKm = r !== undefined && r > 0 ? Math.min(r, GUEST_GPS_RADIUS_MAX_KM) : GUEST_GPS_RADIUS_DEFAULT_KM;
    criteria.nearGps = { latitude: lat, longitude: lng, radiusKm };
  }

  const duration = pick(get('dur'), DURATIONS);
  if (duration) criteria.durationMonths = duration;

  return criteria;
}

/** Only values that differ from the defaults are written, so the default search has a clean URL. */
export function criteriaToSearchParams(criteria: Partial<GuestSearchCriteria>): URLSearchParams {
  const defaults = defaultGuestCriteria();
  const params = new URLSearchParams();
  const set = (key: string, value: string | number | undefined) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  };

  if (criteria.mode && criteria.mode !== defaults.mode) set('mode', criteria.mode);
  if (criteria.view && criteria.view !== defaults.view) set('view', criteria.view);
  set('q', criteria.keyword?.trim());
  if (criteria.propertyType?.length) set('type', criteria.propertyType.join(','));
  set('min', criteria.minPrice);
  set('max', criteria.maxPrice);
  if (criteria.bedrooms?.length) set('beds', criteria.bedrooms.join(','));
  set('st', criteria.stationType);
  set('station', criteria.stationName);
  if (criteria.nearGps) {
    set('lat', criteria.nearGps.latitude);
    set('lng', criteria.nearGps.longitude);
    if (criteria.nearGps.radiusKm !== GUEST_GPS_RADIUS_DEFAULT_KM) set('r', criteria.nearGps.radiusKm);
  }
  set('dur', criteria.durationMonths);
  if (criteria.quick?.length) set('quick', criteria.quick.join(','));
  if (criteria.sortBy && criteria.sortBy !== defaults.sortBy) set('sort', criteria.sortBy);
  if (criteria.page && criteria.page !== defaults.page) set('page', criteria.page);
  if (criteria.limit && criteria.limit !== defaults.limit) set('limit', criteria.limit);
  return params;
}
