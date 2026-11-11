import type {
  PublicAreaSummary,
  PublicRoomCard,
  PublicRoomDetail,
  PublicRoomSearchQuery,
  PublicRoomSearchResult,
} from '@nestyk/types';
import { getPublicAvailability } from './public-listing';
import { SAMPLE_PUBLIC_ROOMS } from './public-rooms-sample';

/**
 * Where the guest pages get their rooms from: bundled sample data (development only) or the
 * public API. Both sides expose the same four calls so the pages never know the difference.
 */
export interface PublicRoomsSource {
  featured(limit?: number): Promise<PublicRoomCard[]>;
  search(query: PublicRoomSearchQuery): Promise<PublicRoomSearchResult>;
  detail(id: string): Promise<PublicRoomDetail | null>;
  areas(limit?: number): Promise<PublicAreaSummary[]>;
}

/** The only fields a card may carry. Detail-only fields are dropped from every card. */
export const PUBLIC_ROOM_CARD_KEYS = [
  'id', 'title', 'propertyType', 'projectName', 'district', 'priceFrom', 'bedrooms', 'bathrooms',
  'areaSqm', 'coverImageUrl', 'latitude', 'longitude', 'nearestStation', 'availableFrom',
  'petFriendly', 'shortTermAvailable',
] as const satisfies readonly (keyof PublicRoomCard)[];

/** "Near transit" quick filter: a station within this many metres. */
export const NEAR_TRANSIT_METERS = 800;

const DEFAULT_FEATURED_LIMIT = 6;
const EARTH_RADIUS_KM = 6371;

export type PublicAreaMeta = Record<string, { slug: string; transitLine: string | null }>;

/** Popular areas of the sample data, keyed by district name. */
export const SAMPLE_AREA_META: PublicAreaMeta = {
  อโศก: { slug: 'asok', transitLine: 'BTS สุขุมวิท / MRT สายสีน้ำเงิน' },
  อารีย์: { slug: 'ari', transitLine: 'BTS สุขุมวิท' },
  ลาดพร้าว: { slug: 'lat-phrao', transitLine: 'MRT สายสีน้ำเงิน' },
  ทองหล่อ: { slug: 'thonglor', transitLine: 'BTS สุขุมวิท' },
  อ่อนนุช: { slug: 'on-nut', transitLine: 'BTS สุขุมวิท' },
};

export interface InMemoryPublicRoomsOptions {
  /** Today as YYYY-MM-DD; injected so tests are deterministic. */
  today?: () => string;
  areaMeta?: PublicAreaMeta;
}

function toCard(room: PublicRoomDetail): PublicRoomCard {
  const card: Record<string, unknown> = {};
  for (const key of PUBLIC_ROOM_CARD_KEYS) card[key] = room[key];
  return card as unknown as PublicRoomCard;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function matchesKeyword(room: PublicRoomDetail, keyword: string): boolean {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return true;
  return [room.title, room.projectName, room.district, room.nearestStation?.name].some(
    (text) => typeof text === 'string' && text.toLowerCase().includes(needle),
  );
}

function matchesQuick(room: PublicRoomDetail, code: string, today: string): boolean {
  switch (code) {
    case 'nearTransit':
      return room.nearestStation != null && room.nearestStation.distanceMeters <= NEAR_TRANSIT_METERS;
    case 'moveInReady':
      return getPublicAvailability(room.availableFrom, today).status === 'now';
    case 'petFriendly':
      return room.petFriendly;
    case 'shortTerm':
      return room.shortTermAvailable;
    default:
      // Unknown chip codes (for example from an old shared link) do not hide every room.
      return true;
  }
}

export function createInMemoryPublicRoomsSource(
  rooms: readonly PublicRoomDetail[],
  options: InMemoryPublicRoomsOptions = {},
): PublicRoomsSource {
  const today = options.today ?? (() => new Date().toISOString().slice(0, 10));
  const areaMeta = options.areaMeta ?? SAMPLE_AREA_META;

  return {
    async featured(limit = DEFAULT_FEATURED_LIMIT) {
      return rooms.slice(0, Math.max(0, limit)).map(toCard);
    },

    async search(query) {
      const page = query.page;
      const limit = query.limit;
      // No sale listings exist yet, so "buy" is an honest empty result rather than rent rooms.
      if (query.mode === 'buy') return { items: [], total: 0, page, limit };

      const todayValue = today();
      const hasPriceBound = query.minPrice != null || query.maxPrice != null;
      let matches = rooms.filter((room) => {
        if (query.keyword && !matchesKeyword(room, query.keyword)) return false;
        if (query.propertyType?.length && !query.propertyType.includes(room.propertyType)) return false;
        if (hasPriceBound) {
          if (room.priceFrom == null) return false;
          if (query.minPrice != null && room.priceFrom < query.minPrice) return false;
          if (query.maxPrice != null && room.priceFrom > query.maxPrice) return false;
        }
        if (query.bedrooms?.length && (room.bedrooms == null || !query.bedrooms.includes(room.bedrooms))) return false;
        if (query.stationType && room.nearestStation?.type !== query.stationType) return false;
        if (query.stationName && room.nearestStation?.name !== query.stationName) return false;
        if (query.durationMonths && !room.priceOptions.some((o) => o.durationMonths === query.durationMonths)) return false;
        if (query.nearGps) {
          if (room.latitude == null || room.longitude == null) return false;
          const km = haversineKm(query.nearGps.latitude, query.nearGps.longitude, room.latitude, room.longitude);
          if (km > query.nearGps.radiusKm) return false;
        }
        return query.quick.every((code) => matchesQuick(room, code, todayValue));
      });

      if (query.sortBy === 'price_asc' || query.sortBy === 'price_desc') {
        const direction = query.sortBy === 'price_asc' ? 1 : -1;
        matches = [...matches].sort((a, b) => {
          if (a.priceFrom == null && b.priceFrom == null) return 0;
          if (a.priceFrom == null) return 1;
          if (b.priceFrom == null) return -1;
          return (a.priceFrom - b.priceFrom) * direction;
        });
      } else if (query.sortBy === 'distance' && query.nearGps) {
        const { latitude, longitude } = query.nearGps;
        const distanceOf = (room: PublicRoomDetail) =>
          haversineKm(latitude, longitude, room.latitude ?? latitude, room.longitude ?? longitude);
        matches = [...matches].sort((a, b) => distanceOf(a) - distanceOf(b));
      }

      const start = Math.max(0, (page - 1) * limit);
      return { items: matches.slice(start, start + limit).map(toCard), total: matches.length, page, limit };
    },

    async detail(id) {
      return rooms.find((room) => room.id === id) ?? null;
    },

    async areas(limit) {
      const groups = new Map<string, PublicRoomDetail[]>();
      for (const room of rooms) {
        if (!room.district || !areaMeta[room.district]) continue;
        const list = groups.get(room.district) ?? [];
        list.push(room);
        groups.set(room.district, list);
      }
      const areas: PublicAreaSummary[] = [...groups.entries()].map(([district, list]) => {
        const prices = list.map((r) => r.priceFrom).filter((p): p is number => p != null);
        return {
          slug: areaMeta[district].slug,
          name: district,
          transitLine: areaMeta[district].transitLine,
          roomCount: list.length,
          priceFrom: prices.length ? Math.min(...prices) : null,
          coverImageUrl: list.find((r) => r.coverImageUrl)?.coverImageUrl ?? null,
        };
      });
      areas.sort((a, b) => b.roomCount - a.roomCount || a.name.localeCompare(b.name));
      return limit == null ? areas : areas.slice(0, Math.max(0, limit));
    },
  };
}

type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface ApiPublicRoomsOptions {
  baseUrl: string;
  fetchImpl?: FetchLike;
}

function searchParamsOf(query: PublicRoomSearchQuery): URLSearchParams {
  const params = new URLSearchParams();
  const set = (key: string, value: string | number | undefined | null) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  };
  set('mode', query.mode);
  set('q', query.keyword?.trim());
  if (query.propertyType?.length) set('type', query.propertyType.join(','));
  set('min', query.minPrice);
  set('max', query.maxPrice);
  if (query.bedrooms?.length) set('beds', query.bedrooms.join(','));
  set('station_type', query.stationType);
  set('station', query.stationName);
  if (query.nearGps) {
    set('lat', query.nearGps.latitude);
    set('lng', query.nearGps.longitude);
    set('radius_km', query.nearGps.radiusKm);
  }
  set('duration', query.durationMonths);
  if (query.quick.length) set('quick', query.quick.join(','));
  set('sort', query.sortBy);
  set('page', query.page);
  set('limit', query.limit);
  return params;
}

export function createApiPublicRoomsSource(options: ApiPublicRoomsOptions): PublicRoomsSource {
  const base = options.baseUrl.replace(/\/+$/, '');
  const fetchImpl: FetchLike = options.fetchImpl ?? ((url) => fetch(url));

  async function get<T>(path: string, allowNotFound = false): Promise<T | null> {
    const response = await fetchImpl(`${base}${path}`);
    if (allowNotFound && response.status === 404) return null;
    if (!response.ok) throw new Error(`Public rooms API error ${response.status}`);
    return (await response.json()) as T;
  }
  const withLimit = (path: string, limit?: number) => (limit == null ? path : `${path}?limit=${limit}`);

  return {
    async featured(limit) {
      return (await get<PublicRoomCard[]>(withLimit('/public/rooms/featured', limit))) as PublicRoomCard[];
    },
    async search(query) {
      return (await get<PublicRoomSearchResult>(`/public/rooms/search?${searchParamsOf(query).toString()}`)) as PublicRoomSearchResult;
    },
    async detail(id) {
      return get<PublicRoomDetail>(`/public/rooms/${encodeURIComponent(id)}`, true);
    },
    async areas(limit) {
      return (await get<PublicAreaSummary[]>(withLimit('/public/areas', limit))) as PublicAreaSummary[];
    },
  };
}

export type PublicRoomsSourceConfig =
  | { kind: 'sample' }
  | { kind: 'api'; baseUrl: string; fetchImpl?: FetchLike };

export interface CreatePublicRoomsSourceOptions {
  /** Defaults to NODE_ENV === 'production'. */
  isProduction?: boolean;
  today?: () => string;
}

function detectProduction(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.NODE_ENV === 'production';
}

export function createPublicRoomsSource(
  config: PublicRoomsSourceConfig,
  options: CreatePublicRoomsSourceOptions = {},
): PublicRoomsSource {
  const isProduction = options.isProduction ?? detectProduction();
  if (config.kind === 'api') {
    if (!config.baseUrl?.trim()) throw new Error('Public rooms API source needs a baseUrl');
    return createApiPublicRoomsSource({ baseUrl: config.baseUrl, fetchImpl: config.fetchImpl });
  }
  if (isProduction) throw new Error('The sample public rooms source cannot be used in production');
  return createInMemoryPublicRoomsSource(SAMPLE_PUBLIC_ROOMS, { today: options.today });
}
