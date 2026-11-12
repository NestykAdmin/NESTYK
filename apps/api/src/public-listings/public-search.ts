import type {
  PropertyType,
  PublicMoveIn,
  PublicRoomDuration,
  PublicRoomSearchQuery,
  PublicRoomSort,
  PublicRoomStation,
  PublicRoomStationType,
} from '@nestyk/types';
import { nearestRailStation, publicPosition } from './public-room-mapper';

/**
 * Guest search (S6): reading the query and the rules that pick and order rooms.
 * Pure functions, so every rule is tested without a database. The service reads one summary row per public room
 * (SEARCH_CANDIDATES at most), these functions filter, sort and page them, then only the rooms on the page are loaded.
 * Stations come from the saved nearby places (JSON), which is why this runs in code rather than SQL.
 */

export const SEARCH_PAGE_SIZE_DEFAULT = 12;
export const SEARCH_PAGE_SIZE_MAX = 48;
/** Deeper pages than this are not useful to a person and only cost the database. */
export const SEARCH_PAGE_MAX = 50;
export const SEARCH_KEYWORD_MAX = 100;
export const SEARCH_RADIUS_DEFAULT_KM = 5;
export const SEARCH_RADIUS_MAX_KM = 50;
/**
 * Smallest radius a search may ask for. With positions rounded like the cards (about 100 m, R2) this keeps a home
 * from being pinned by asking ever smaller circles (review R1, 12 Nov 2026).
 */
export const SEARCH_RADIUS_MIN_KM = 0.5;
/** Every search reads the same summary rows; they are kept this long so filters and live counts stay cheap. */
export const SEARCH_CACHE_MS = 30_000;
/** Most public rooms one search reads. Revisit with stored station columns when rooms grow (plan R1). */
export const SEARCH_CANDIDATES = 2000;
/** "Near transit": a BTS or MRT station within this many metres (same as the home rail). */
export const SEARCH_NEAR_TRANSIT_METERS = 800;
/** A requested bedroom count of this value also matches larger rooms ("3+"). */
export const SEARCH_BEDROOMS_OR_MORE = 3;

export const SEARCH_QUICK_FILTERS = ['nearTransit', 'moveInReady', 'petFriendly', 'shortTerm'] as const;
const PROPERTY_TYPES: readonly PropertyType[] = ['condo', 'apartment', 'house', 'townhome'];
const STATION_TYPES: readonly PublicRoomStationType[] = ['BTS', 'MRT'];
const DURATIONS: readonly PublicRoomDuration[] = [1, 3, 6, 12];
const SORTS: readonly PublicRoomSort[] = ['recommended', 'price_asc', 'price_desc', 'newest', 'distance'];
const MOVE_INS: readonly PublicMoveIn[] = ['now', '30d', '90d'];
const MOVE_IN_DAYS: Record<PublicMoveIn, number> = { now: 0, '30d': 30, '90d': 90 };
const MAX_BEDROOMS = 10;
const EARTH_RADIUS_KM = 6371;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RawSearchQuery = Record<string, string | string[] | undefined>;

function first(raw: RawSearchQuery, key: string): string | undefined {
  const value = raw[key];
  const text = Array.isArray(value) ? value[0] : value;
  return typeof text === 'string' ? text : undefined;
}

function number(text: string | undefined): number | undefined {
  if (text === undefined || text.trim() === '') return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

function list(text: string | undefined): string[] {
  return text ? text.split(',').map((item) => item.trim()).filter(Boolean) : [];
}

function pick<T extends string | number>(text: string | undefined, allowed: readonly T[]): T | undefined {
  return text === undefined ? undefined : allowed.find((item) => String(item) === text.trim());
}

/** Reads the query string of GET /public/rooms/search. Anything unknown or out of range is dropped, never an error. */
export function parsePublicSearch(raw: RawSearchQuery = {}): PublicRoomSearchQuery {
  const query: PublicRoomSearchQuery = {
    mode: first(raw, 'mode') === 'buy' ? 'buy' : 'rent',
    quick: [],
    sortBy: pick(first(raw, 'sort'), SORTS) ?? 'recommended',
    page: 1,
    limit: SEARCH_PAGE_SIZE_DEFAULT,
  };

  const page = number(first(raw, 'page'));
  if (page !== undefined && Number.isInteger(page) && page >= 1) query.page = Math.min(page, SEARCH_PAGE_MAX);
  const limit = number(first(raw, 'limit'));
  if (limit !== undefined && Number.isInteger(limit) && limit >= 1) query.limit = Math.min(limit, SEARCH_PAGE_SIZE_MAX);

  const keyword = first(raw, 'q')?.trim().slice(0, SEARCH_KEYWORD_MAX).trim();
  if (keyword) query.keyword = keyword;

  const types = list(first(raw, 'type'));
  const propertyType = PROPERTY_TYPES.filter((type) => types.includes(type));
  if (propertyType.length) query.propertyType = propertyType;

  let min = number(first(raw, 'min'));
  let max = number(first(raw, 'max'));
  if (min !== undefined && min < 0) min = undefined;
  if (max !== undefined && max < 0) max = undefined;
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
  if (min !== undefined) query.minPrice = min;
  if (max !== undefined) query.maxPrice = max;

  const bedrooms = [...new Set(list(first(raw, 'beds')).map(Number))]
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= MAX_BEDROOMS)
    .sort((a, b) => a - b);
  if (bedrooms.length) query.bedrooms = bedrooms;

  const stationType = pick(first(raw, 'station_type'), STATION_TYPES);
  if (stationType) query.stationType = stationType;
  const stationName = first(raw, 'station')?.trim().slice(0, SEARCH_KEYWORD_MAX).trim();
  if (stationName) query.stationName = stationName;

  const latitude = number(first(raw, 'lat'));
  const longitude = number(first(raw, 'lng'));
  if (latitude !== undefined && longitude !== undefined && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
    const radius = number(first(raw, 'radius_km'));
    const radiusKm =
      radius !== undefined && radius > 0
        ? Math.min(Math.max(radius, SEARCH_RADIUS_MIN_KM), SEARCH_RADIUS_MAX_KM)
        : SEARCH_RADIUS_DEFAULT_KM;
    query.nearGps = { latitude, longitude, radiusKm };
  }

  const duration = pick(first(raw, 'duration'), DURATIONS.map(String));
  if (duration) query.durationMonths = Number(duration) as PublicRoomDuration;
  const moveIn = pick(first(raw, 'movein'), MOVE_INS);
  if (moveIn) query.moveIn = moveIn;

  const quick = new Set(list(first(raw, 'quick')));
  query.quick = SEARCH_QUICK_FILTERS.filter((code) => quick.has(code));
  return query;
}

/** One row of the summary query, named as the service selects it. */
export interface SearchCandidateRow {
  id: number | string;
  created_at: Date | string | null;
  price_from: string | number | null;
  bedroom_layout: string | null;
  bedroom_count: number | string | null;
  room_lat: string | number | null;
  room_lng: string | number | null;
  property_lat: string | number | null;
  property_lng: string | number | null;
  nearby_places: unknown;
  available_from: string | null;
  pet_friendly: boolean | null;
  short_term: boolean | null;
  has_cover: boolean | null;
  property_type: string | null;
  /** Contract lengths (months) that have a price. */
  durations: Array<number | string> | null;
  project_name: string | null;
  district: string | null;
  subdistrict: string | null;
  promo_title: string | null;
}

export interface SearchCandidate {
  id: number;
  propertyType: string | null;
  durations: number[];
  createdMs: number;
  priceFrom: number | null;
  bedrooms: number | null;
  latitude: number | null;
  longitude: number | null;
  station: PublicRoomStation | null;
  availableFrom: string | null;
  petFriendly: boolean;
  shortTerm: boolean;
  hasCover: boolean;
  /** Lower-case text a keyword is matched against. */
  text: string[];
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

/**
 * Same rules as the room card: bedrooms from the layout, else the room type; position of the room, else the
 * building, rounded the same way as the card so a search never knows more than a card shows (R1).
 */
export function toSearchCandidate(row: SearchCandidateRow): SearchCandidate {
  const station = nearestRailStation(row.nearby_places);
  const roomLat = publicPosition(row.room_lat);
  const roomLng = publicPosition(row.room_lng);
  const hasRoomPosition = roomLat !== null && roomLng !== null;
  const created = row.created_at ? new Date(row.created_at).getTime() : NaN;
  return {
    id: Number(row.id),
    propertyType: row.property_type ?? null,
    durations: (Array.isArray(row.durations) ? row.durations : []).map(Number).filter(Number.isFinite),
    createdMs: Number.isFinite(created) ? created : 0,
    priceFrom: toNumber(row.price_from),
    bedrooms: toNumber(row.bedroom_layout) ?? toNumber(row.bedroom_count),
    latitude: hasRoomPosition ? roomLat : publicPosition(row.property_lat),
    longitude: hasRoomPosition ? roomLng : publicPosition(row.property_lng),
    station,
    availableFrom: typeof row.available_from === 'string' && row.available_from ? row.available_from.slice(0, 10) : null,
    petFriendly: row.pet_friendly === true,
    shortTerm: row.short_term === true,
    hasCover: row.has_cover === true,
    text: [row.project_name, row.district, row.subdistrict, row.promo_title, station?.name]
      .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
      .map((item) => item.toLowerCase()),
  };
}

function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const h =
    Math.sin(rad(bLat - aLat) / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** No date, or a date on or before the limit, means the room can be moved into by then. */
function availableBy(room: SearchCandidate, lastDay: string): boolean {
  return room.availableFrom === null || room.availableFrom <= lastDay;
}

function matchesQuick(room: SearchCandidate, code: string, today: string): boolean {
  switch (code) {
    case 'nearTransit':
      return !!room.station && room.station.distanceMeters <= SEARCH_NEAR_TRANSIT_METERS;
    case 'moveInReady':
      return availableBy(room, today);
    case 'petFriendly':
      return room.petFriendly;
    case 'shortTerm':
      return room.shortTerm;
    default:
      return true;
  }
}

function matchesBedrooms(bedrooms: number | null, wanted: number[]): boolean {
  if (bedrooms === null) return false;
  return wanted.includes(bedrooms) || (wanted.includes(SEARCH_BEDROOMS_OR_MORE) && bedrooms >= SEARCH_BEDROOMS_OR_MORE);
}

function matches(room: SearchCandidate, query: PublicRoomSearchQuery, today: string): boolean {
  if (query.propertyType?.length && !query.propertyType.includes(room.propertyType as PropertyType)) return false;
  if (query.durationMonths && !room.durations.includes(query.durationMonths)) return false;
  if (query.keyword) {
    const needle = query.keyword.toLowerCase();
    if (!room.text.some((text) => text.includes(needle))) return false;
  }
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    if (room.priceFrom === null) return false;
    if (query.minPrice !== undefined && room.priceFrom < query.minPrice) return false;
    if (query.maxPrice !== undefined && room.priceFrom > query.maxPrice) return false;
  }
  if (query.bedrooms?.length && !matchesBedrooms(room.bedrooms, query.bedrooms)) return false;
  if (query.stationType && room.station?.type !== query.stationType) return false;
  if (query.stationName && room.station?.name.toLowerCase() !== query.stationName.toLowerCase()) return false;
  if (query.moveIn && !availableBy(room, addDays(today, MOVE_IN_DAYS[query.moveIn]))) return false;
  if (query.nearGps) {
    if (room.latitude === null || room.longitude === null) return false;
    const km = distanceKm(query.nearGps.latitude, query.nearGps.longitude, room.latitude, room.longitude);
    if (km > query.nearGps.radiusKm) return false;
  }
  return query.quick.every((code) => matchesQuick(room, code, today));
}

const newestFirst = (a: SearchCandidate, b: SearchCandidate) => b.createdMs - a.createdMs || b.id - a.id;

function order(rooms: SearchCandidate[], query: PublicRoomSearchQuery): SearchCandidate[] {
  const sorted = [...rooms];
  switch (query.sortBy) {
    case 'price_asc':
    case 'price_desc': {
      const direction = query.sortBy === 'price_asc' ? 1 : -1;
      return sorted.sort((a, b) => {
        if (a.priceFrom === null || b.priceFrom === null) {
          return Number(a.priceFrom === null) - Number(b.priceFrom === null) || newestFirst(a, b);
        }
        return (a.priceFrom - b.priceFrom) * direction || newestFirst(a, b);
      });
    }
    case 'distance': {
      const gps = query.nearGps;
      if (!gps) return sorted.sort(newestFirst);
      const away = (room: SearchCandidate) =>
        room.latitude === null || room.longitude === null
          ? Number.POSITIVE_INFINITY
          : distanceKm(gps.latitude, gps.longitude, room.latitude, room.longitude);
      return sorted.sort((a, b) => away(a) - away(b) || newestFirst(a, b));
    }
    case 'newest':
      return sorted.sort(newestFirst);
    case 'recommended':
    default:
      return sorted.sort((a, b) => Number(b.hasCover) - Number(a.hasCover) || newestFirst(a, b));
  }
}

/** Filters, orders and pages the candidates. `total` counts every match; `ids` are the rooms on the asked page. */
export function searchCandidates(
  rooms: readonly SearchCandidate[],
  query: PublicRoomSearchQuery,
  today: string,
): { ids: number[]; total: number } {
  const found = order(rooms.filter((room) => matches(room, query, today)), query);
  const start = (query.page - 1) * query.limit;
  return { ids: found.slice(start, start + query.limit).map((room) => room.id), total: found.length };
}
