import type { NearbyPlace } from '@nestyk/types';

export type AgentRoomDetail = {
  id: number;
  listingTitle: string | null;
  /** Public share headline. */
  promoTitle?: string | null;
  description: string | null;
  roomId: string | null;
  visibility: 'private' | 'published' | null;
  roomStatusCode: string | null;
  /** D8: a soon-vacant room is free from this day (null otherwise). */
  vacantFrom?: string | null;
  roomTypeCode: string | null;
  roomTypeId: number | null;
  listingSourceCode: string | null;
  availableFromDate: string;
  property: {
    id: number;
    propertyTypeId: number | null;
    latitude: string | null;
    longitude: string | null;
    name: string;
    address: string;
    subdistrict: string;
    district: string;
    province: string;
    postalCode: string;
    propertyTypeCode: string | null;
  } | null;
  latitude: string | null;
  longitude: string | null;
  prices: {
    contractTypeId?: number;
    contractTypeCode: string;
    termMonths: number | null;
    price: number;
    advanceRentMonths?: number;
    depositMonths?: number;
  }[];
  advanceRentMonths: number;
  depositMonths: number;
  waterRatePerUnit: string | null;
  electricRatePerUnit: string | null;
  medias: { id: number; mediaUrl: string; mediaType: string; isCover: boolean }[];
  layout: { code: string; value: string }[];
  facilities: string[];
  nearbyOther: string | null;
  facilityItems?: { code: string; groupCode?: string | null }[];
  customFacilities?: string[];
  nearbyPlaces?: NearbyPlace[];
  /** Client-only warning when listing copy may be out of date. */
  promoCopyStale?: boolean;
  documents?: {
    kind: 'id_passport' | 'bookbank' | 'ownership' | 'other';
    mediaUrl: string;
    sortOrder: number;
  }[];
  contacts: {
    id: number;
    name: string;
    phone: string;
    email: string | null;
    lineId?: string | null;
    facebook?: string | null;
    note: string | null;
    isPrimary: boolean;
  }[];
};
