import type { PublicRoomCard } from '@nestyk/types';

/**
 * Map search (S4.3, design SearchMapWebV23 / MapMobileV22, Mos 20 Nov 2026). Pure helpers: lib/guest-map.test.cjs
 * loads this file bare, so no React, Next or Google here.
 */

/** The map view loads the search in pages of the API's largest size, up to this many pages (192 rooms). */
export const MAP_PAGE_SIZE = 48;
export const MAP_MAX_PAGES = 4;
export const MAP_ROOM_LIMIT = MAP_PAGE_SIZE * MAP_MAX_PAGES;
/** "ค้นหาเมื่อเลื่อนแผนที่": search again once the map has stood still this long (plan D2). */
export const SEARCH_AS_MOVE_DELAY_MS = 600;
/** The search circle the API accepts (GET /public/rooms/search r: 0.5–50 km). */
export const MAP_RADIUS_MIN_KM = 0.5;
export const MAP_RADIUS_MAX_KM = 50;

/**
 * The search circle of a station, place or "near me" on the map. Google draws it, so it takes colour values, not
 * CSS variables: ink edge and a light brand fill (guest.css --nk-color-ink / --nk-color-brand).
 */
export const MAP_CIRCLE_STYLE = {
  strokeColor: '#211E1E',
  strokeOpacity: 0.55,
  strokeWeight: 1.5,
  fillColor: '#F8B615',
  fillOpacity: 0.12,
} as const;

const KM_PER_DEGREE = 111.32;
const EARTH_RADIUS_KM = 6371;

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapCircle {
  latitude: number;
  longitude: number;
  radiusKm: number;
}

export interface RoomPin {
  /** The spot, "13.7371,100.5605". */
  id: string;
  latitude: number;
  longitude: number;
  roomIds: string[];
  /** "฿25,000", or "฿10,000–13,000" for several rooms at one spot. */
  label: string;
  count: number;
}

const baht = (amount: number) => `฿${Math.round(amount).toLocaleString('en-US')}`;
const round = (value: number, decimals: number) => Number(value.toFixed(decimals));

function hasPosition<T extends { latitude: number | null; longitude: number | null }>(
  item: T,
): item is T & { latitude: number; longitude: number } {
  return item.latitude != null && item.longitude != null && Number.isFinite(item.latitude) && Number.isFinite(item.longitude);
}

/**
 * One pin per spot. The API already rounds a room's position to about 100 m, so rooms of one building land on the
 * same spot and share a pin that shows their price range and how many there are.
 */
export function roomPins(cards: readonly Pick<PublicRoomCard, 'id' | 'latitude' | 'longitude' | 'priceFrom'>[]): RoomPin[] {
  const spots = new Map<string, { latitude: number; longitude: number; roomIds: string[]; prices: number[] }>();
  for (const card of cards) {
    if (!hasPosition(card)) continue;
    const id = `${card.latitude.toFixed(4)},${card.longitude.toFixed(4)}`;
    const spot = spots.get(id) ?? { latitude: card.latitude, longitude: card.longitude, roomIds: [], prices: [] };
    spot.roomIds.push(card.id);
    if (card.priceFrom != null && Number.isFinite(card.priceFrom)) spot.prices.push(card.priceFrom);
    spots.set(id, spot);
  }
  return [...spots].map(([id, spot]) => {
    const low = spot.prices.length ? Math.min(...spot.prices) : null;
    const high = spot.prices.length ? Math.max(...spot.prices) : null;
    const label = low == null || high == null ? '฿–' : low === high ? baht(low) : `${baht(low)}–${baht(high).slice(1)}`;
    return { id, latitude: spot.latitude, longitude: spot.longitude, roomIds: spot.roomIds, label, count: spot.roomIds.length };
  });
}

function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** The circle the search sends for the map's view: its middle, out to the corners (so it covers the whole view). */
export function circleFromBounds(bounds: MapBounds): MapCircle {
  const latitude = round((bounds.north + bounds.south) / 2, 4);
  const longitude = round((bounds.east + bounds.west) / 2, 4);
  const corner = distanceKm({ latitude, longitude }, { latitude: bounds.north, longitude: bounds.east });
  const radiusKm = Math.min(MAP_RADIUS_MAX_KM, Math.max(MAP_RADIUS_MIN_KM, Math.ceil(corner * 10) / 10));
  return { latitude, longitude, radiusKm };
}

/** The box that shows a search circle whole (a station's 1.5 km, "near me" 5 km). */
export function boundsOfCircle(circle: MapCircle): MapBounds {
  const dLat = circle.radiusKm / KM_PER_DEGREE;
  const dLng = circle.radiusKm / (KM_PER_DEGREE * Math.cos((circle.latitude * Math.PI) / 180));
  return { north: circle.latitude + dLat, south: circle.latitude - dLat, east: circle.longitude + dLng, west: circle.longitude - dLng };
}

/** The box around every pin, or null with no pins (the map then opens on Bangkok). */
export function boundsOfPins(pins: readonly { latitude: number; longitude: number }[]): MapBounds | null {
  if (!pins.length) return null;
  return {
    north: Math.max(...pins.map((pin) => pin.latitude)),
    south: Math.min(...pins.map((pin) => pin.latitude)),
    east: Math.max(...pins.map((pin) => pin.longitude)),
    west: Math.min(...pins.map((pin) => pin.longitude)),
  };
}

/** True when a room is inside the map's view (the list beside the map shows only those). */
export function inBounds(point: { latitude: number | null; longitude: number | null }, bounds: MapBounds): boolean {
  if (!hasPosition(point)) return false;
  return point.latitude <= bounds.north && point.latitude >= bounds.south && point.longitude <= bounds.east && point.longitude >= bounds.west;
}
