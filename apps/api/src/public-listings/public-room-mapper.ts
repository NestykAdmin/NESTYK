import type {
  PropertyType,
  PublicRoomCard,
  PublicRoomDetail,
  PublicRoomDuration,
  PublicRoomPriceOption,
  PublicRoomStation,
} from '@nestyk/types';
import type { RentRoomEntity } from '../entities/rent-room.entity';
import { detectRailSystem, isTransitNearbyType } from '../agent/places/nearby-places';

/**
 * Rooms as the public sees them (guest web, no sign-in).
 * WHITELIST ONLY: every field below is picked by name. Never spread an entity into the result.
 * Left out on purpose: listing_title (the agent's own name), room_id, owner identity and bank, the address
 * line, contacts, documents, custom facility text, videos, view counts and who created the room.
 */

/** Relations a public room needs; nothing else is loaded. */
export const PUBLIC_ROOM_RELATIONS = [
  'property',
  'property.property_type',
  'room_type',
  'medias',
  'price_rows',
  'price_rows.contract_type',
  'layout_values',
  'layout_values.layout',
  'facilities',
  'facilities.facility',
] as const;

/** "ใหม่" badge: listed within this many days. */
export const NEW_LISTING_DAYS = 14;

const PROPERTY_TYPES: readonly PropertyType[] = ['condo', 'apartment', 'house', 'townhome'];
const DURATIONS: readonly PublicRoomDuration[] = [1, 3, 6, 12];

type NearbyLike = { name?: unknown; type?: unknown; vicinity?: unknown; distanceMeters?: unknown };

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Public positions keep 3 decimals (about 100 m): enough for a map pin, never a front door (R2, Mos 11 Nov 2026). */
export const PUBLIC_POSITION_DECIMALS = 3;

function publicPosition(value: unknown): number | null {
  const number = toNumber(value);
  if (number === null) return null;
  const scale = 10 ** PUBLIC_POSITION_DECIMALS;
  return Math.round(number * scale) / scale;
}

function layoutValue(room: RentRoomEntity, code: string): string | null {
  const row = (room.layout_values ?? []).find((value) => value.layout?.code === code);
  return row ? row.value : null;
}

function imageUrls(room: RentRoomEntity): string[] {
  return [...(room.medias ?? [])]
    .filter((media) => media.media_type === 'image')
    .sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order || a.id - b.id)
    .map((media) => media.media_url);
}

type PriceRow = { months: number | null; price: number };

function prices(room: RentRoomEntity): PriceRow[] {
  const rows: PriceRow[] = [];
  for (const row of room.price_rows ?? []) {
    const price = toNumber(row.price);
    if (price !== null && price > 0) rows.push({ months: row.contract_type?.term_months ?? null, price });
  }
  return rows;
}

function stationName(raw: string): string {
  return raw
    .replace(/^(BTS|MRT)\s+/i, '')
    .replace(/^(สถานี(รถไฟฟ้า)?|Station)\s+/i, '')
    .replace(/\s*(BTS|MRT)?\s*(Station|สถานี)?$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** The closest BTS or MRT station among the places saved with the room. Bus stops and other lines are left out. */
export function nearestRailStation(places: unknown): PublicRoomStation | null {
  if (!Array.isArray(places)) return null;
  let best: PublicRoomStation | null = null;
  for (const place of places as NearbyLike[]) {
    const type = typeof place?.type === 'string' ? place.type : '';
    const name = typeof place?.name === 'string' ? place.name : '';
    const distance = toNumber(place?.distanceMeters);
    if (!name || distance === null || distance < 0 || !isTransitNearbyType(type) || type === 'bus_station') continue;
    const vicinity = typeof place?.vicinity === 'string' ? place.vicinity : undefined;
    const system = detectRailSystem(name, vicinity);
    if (system !== 'BTS' && system !== 'MRT') continue;
    const rounded = Math.round(distance);
    if (!best || rounded < best.distanceMeters) {
      best = { type: system, name: stationName(name) || name, distanceMeters: rounded };
    }
  }
  return best;
}

export function toPublicRoomCard(room: RentRoomEntity, now: Date = new Date()): PublicRoomCard {
  const property = room.property;
  const typeCode = property?.property_type?.code;
  const priceList = prices(room);
  const bedroomLayout = toNumber(layoutValue(room, 'bedroom'));
  const created = room.created_at ? new Date(room.created_at).getTime() : NaN;
  const promo = room.promo_title?.trim();

  return {
    id: String(room.id),
    // Empty headline: the web builds one from the project name and room size in the reader's language.
    title: promo ? promo : null,
    propertyType: PROPERTY_TYPES.includes(typeCode as PropertyType) ? (typeCode as PropertyType) : null,
    projectName: property?.name?.trim() || null,
    district: property?.district?.trim() || null,
    priceFrom: priceList.length ? Math.min(...priceList.map((row) => row.price)) : null,
    bedrooms: bedroomLayout ?? room.room_type?.bedroom_count ?? null,
    bathrooms: toNumber(layoutValue(room, 'bathroom')),
    areaSqm: toNumber(layoutValue(room, 'room_size')),
    coverImageUrl: imageUrls(room)[0] ?? null,
    latitude: publicPosition(room.latitude) ?? publicPosition(property?.latitude),
    longitude: publicPosition(room.longitude) ?? publicPosition(property?.longitude),
    nearestStation: nearestRailStation(room.nearby_places),
    availableFrom: room.available_from_date ?? null,
    petFriendly: (room.facilities ?? []).some((row) => row.facility?.code === 'pet_friendly'),
    shortTermAvailable: priceList.some((row) => row.months !== null && row.months < 12),
    isNew: Number.isFinite(created) && now.getTime() - created <= NEW_LISTING_DAYS * 24 * 60 * 60 * 1000,
  };
}

export function toPublicRoomDetail(room: RentRoomEntity, now: Date = new Date()): PublicRoomDetail {
  const depositMonths = toNumber(room.deposit_months);
  const priceOptions: PublicRoomPriceOption[] = prices(room)
    .filter((row) => DURATIONS.includes(row.months as PublicRoomDuration))
    .sort((a, b) => (a.months ?? 0) - (b.months ?? 0))
    .map((row) => ({
      durationMonths: row.months as PublicRoomDuration,
      pricePerMonth: row.price,
      depositAmount: depositMonths === null ? null : row.price * depositMonths,
    }));
  const floor = layoutValue(room, 'floor');
  const floorNumber = floor !== null && /^\d{1,3}$/.test(floor.trim()) ? Number(floor.trim()) : null;

  return {
    ...toPublicRoomCard(room, now),
    description: room.listing_description?.trim() ?? '',
    imageUrls: imageUrls(room),
    amenityCodes: (room.facilities ?? []).map((row) => row.facility?.code).filter((code): code is string => !!code),
    priceOptions,
    floor: floorNumber,
  };
}
