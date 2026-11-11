import type { PropertyType } from './listing';

/**
 * Public (guest) listing contracts — what the website may show to someone who is not signed in.
 * Every field is an explicit whitelist: no owner, unit number, contact, internal note or document.
 */

export type PublicRoomStationType = 'BTS' | 'MRT';
export type PublicRoomDuration = 1 | 3 | 6 | 12;
export type PublicRoomSort = 'price_asc' | 'price_desc' | 'newest' | 'distance';
export type PublicRoomMode = 'rent' | 'buy';

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
  title: string;
  propertyType: PropertyType;
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
  bedrooms?: number[];
  stationType?: PublicRoomStationType;
  stationName?: string;
  nearGps?: { latitude: number; longitude: number; radiusKm: number };
  durationMonths?: PublicRoomDuration;
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
  name: string;
  /** Transit line the area is known for, e.g. "BTS Sukhumvit". */
  transitLine: string | null;
  roomCount: number;
  priceFrom: number | null;
  coverImageUrl: string | null;
}
