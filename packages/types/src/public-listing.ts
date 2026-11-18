import type { PropertyType } from './listing';

/**
 * Public (guest) listing contracts — what the website may show to someone who is not signed in.
 * Every field is an explicit whitelist: no owner, unit number, contact, internal note or document.
 */

export type PublicRoomStationType = 'BTS' | 'MRT';
export type PublicRoomDuration = 1 | 3 | 6 | 12;
/** recommended: rooms with photos first, then newest (the default order, Mos 12 Nov 2026). */
export type PublicRoomSort = 'recommended' | 'price_asc' | 'price_desc' | 'newest' | 'distance';
/** Move-in filter: available now, or within 30 / 90 days (Mos 12 Nov 2026). */
export type PublicMoveIn = 'now' | '30d' | '90d';
export type PublicRoomMode = 'rent' | 'buy';
/** Lists on the home page: recommended (photos first), near BTS/MRT, newest. */
export type PublicFeaturedRail = 'recommended' | 'near_transit' | 'new';
/** Transit lines an area is known for; labels come from i18n (guest.transitLines). */
export type PublicTransitLineCode = 'bts_sukhumvit' | 'bts_silom' | 'mrt_blue' | 'mrt_purple' | 'mrt_pink' | 'arl';

export interface PublicRoomStation {
  type: PublicRoomStationType;
  name: string;
  distanceMeters: number;
}

export interface PublicRoomPriceOption {
  durationMonths: PublicRoomDuration;
  pricePerMonth: number;
  depositAmount: number | null;
}

/** One card in the search results, the featured list and the map pins. */
export interface PublicRoomCard {
  id: string;
  /** The listing's public headline. Null when the agent left it empty: show one built from project and size. */
  title: string | null;
  /** Null when the building has no property type. */
  propertyType: PropertyType | null;
  projectName: string | null;
  district: string | null;
  /** Lowest monthly price across the price options (THB). */
  priceFrom: number | null;
  /** 0 means studio. */
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqm: number | null;
  coverImageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  nearestStation: PublicRoomStation | null;
  /** ISO date (YYYY-MM-DD); null when the room is available now or the date is unknown. */
  availableFrom: string | null;
  petFriendly: boolean;
  shortTermAvailable: boolean;
  /** Listed within the last two weeks ("ใหม่" badge). */
  isNew: boolean;
}

export interface PublicRoomDetail extends PublicRoomCard {
  description: string;
  imageUrls: string[];
  amenityCodes: string[];
  priceOptions: PublicRoomPriceOption[];
  floor: number | null;
}

export interface PublicRoomSearchQuery {
  mode: PublicRoomMode;
  keyword?: string;
  propertyType?: PropertyType[];
  minPrice?: number;
  maxPrice?: number;
  /** 0 is a studio; 3 also matches rooms with more than three bedrooms ("3+"). */
  bedrooms?: number[];
  stationType?: PublicRoomStationType;
  stationName?: string;
  nearGps?: { latitude: number; longitude: number; radiusKm: number };
  durationMonths?: PublicRoomDuration;
  moveIn?: PublicMoveIn;
  /** Popular filter chips, by code. */
  quick: string[];
  sortBy: PublicRoomSort;
  page: number;
  limit: number;
}

export interface PublicRoomSearchResult {
  items: PublicRoomCard[];
  total: number;
  page: number;
  limit: number;
}

/** Popular-area card on the home page. */
export interface PublicAreaSummary {
  slug: string;
  /** Fallback name (Thai). The web shows the name for the reader's language by slug (guest.areaNames). */
  name: string;
  /** Transit lines the area is known for, as codes (labels in guest.transitLines). */
  transitLines: PublicTransitLineCode[];
  roomCount: number;
  priceFrom: number | null;
  coverImageUrl: string | null;
}

/** GET /me/saved-rooms/ids (AUTH-3): ids of the account's saved rooms that are still public, newest first. */
export interface SavedRoomIds {
  ids: string[];
}

/** Error code of PUT /me/saved-rooms/:roomId (409) when the account already has the most saved rooms. */
export type SavedRoomsErrorCode = 'SAVED_ROOMS_LIMIT';
