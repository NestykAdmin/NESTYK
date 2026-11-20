import { BadRequestException } from '@nestjs/common';
import type { NearbyPlace } from '@nestyk/types';
import { validateRoomInput } from '../../agent/rooms/room-input';
import { validateNearbyPlaces, validCoordinates } from '../../agent/places/nearby-places';

/** What the listing form sends (same shape as the agent form's submit data; agent-only fields are ignored). */
export interface SelfOwnerRoomBody {
  listingTitle: string;
  roomId?: string;
  roomTypeId?: number;
  property: {
    name?: string;
    address: string;
    subdistrict?: string;
    district: string;
    province: string;
    postalCode?: string;
    propertyTypeId: number;
    latitude?: number;
    longitude?: number;
  };
  layout: Array<{ code: string; value: string }>;
  prices: Array<{ contractTypeId: number; price: number; advanceRentMonths?: number; depositMonths?: number }>;
  advanceRentMonths?: number;
  depositMonths?: number;
  waterRatePerUnit?: number | null;
  electricRatePerUnit?: number | null;
  availableFromDate?: string;
  latitude?: number;
  longitude?: number;
  facilities?: Array<{ code: string; groupCode?: string }>;
  customFacilities?: string[];
  nearbyPlaces?: NearbyPlace[];
  medias?: Array<{ mediaUrl: string; isCover?: boolean; sortOrder?: number; mediaType?: 'image'; category?: 'room' }>;
  promoTitle?: string;
  listingDescription?: string;
  contact: { name: string; phone: string; lineId?: string; facebook?: string };
}

export const SELF_OWNER_LAYOUT_CODES = ['bedroom', 'bathroom', 'room_size', 'floor', 'building'] as const;
export const MAX_SELF_OWNER_ROOM_PHOTOS = 12;
export const MIN_PUBLISHED_PHOTOS = 5;

const filled = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const months = (v: unknown) => v == null || (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 12);

/** Refuse a malformed form before any lookup or write; numbers come back as the columns store them. */
export function validateSelfOwnerRoomBody(input: unknown): asserts input is SelfOwnerRoomBody {
  validateRoomInput(input);
  const body = input as SelfOwnerRoomBody;
  if (!filled(body.listingTitle)) throw new BadRequestException('listingTitle is required');

  const contact = body.contact as SelfOwnerRoomBody['contact'] | undefined;
  if (!contact || !filled(contact.name) || !filled(contact.phone)) throw new BadRequestException('contact name and phone are required');

  const p = body.property as SelfOwnerRoomBody['property'] | undefined;
  if (!p || !filled(p.address) || !filled(p.district) || !filled(p.province) || p.propertyTypeId == null) {
    throw new BadRequestException('property address, district, province and propertyTypeId are required');
  }
  if ((body.latitude !== undefined || body.longitude !== undefined) && !validCoordinates(body.latitude, body.longitude)) {
    throw new BadRequestException('Valid latitude and longitude required');
  }

  const layout = new Map<string, string>();
  for (const item of body.layout ?? []) {
    if (!(SELF_OWNER_LAYOUT_CODES as readonly string[]).includes(item.code)) throw new BadRequestException(`Unknown layout code: ${item.code}`);
    if (layout.has(item.code)) throw new BadRequestException(`Duplicate layout code: ${item.code}`);
    layout.set(item.code, String(item.value ?? '').trim());
  }
  for (const code of ['bedroom', 'bathroom']) {
    const value = layout.get(code) ?? '';
    if (!/^\d{1,2}$/.test(value) || Number(value) > 20) throw new BadRequestException(`layout ${code} must be a whole number from 0 to 20`);
  }
  const size = layout.get('room_size');
  if (size && (!/^\d+(\.\d{1,2})?$/.test(size) || !(Number(size) > 0) || Number(size) >= 1e6)) throw new BadRequestException('layout room_size must be a positive area');
  if ((layout.get('floor') ?? '').length > 20) throw new BadRequestException('layout floor must be up to 20 characters');

  if (!body.prices?.length) throw new BadRequestException('At least one price is required');
  if (new Set(body.prices.map((r) => r.contractTypeId)).size !== body.prices.length) throw new BadRequestException('One price per lease length');
  for (const row of [body, ...body.prices]) {
    if (!months(row.advanceRentMonths) || !months(row.depositMonths)) throw new BadRequestException('advanceRentMonths and depositMonths must be whole months from 0 to 12');
  }

  if (body.availableFromDate !== undefined) {
    const date = body.availableFromDate;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
      throw new BadRequestException('availableFromDate must be a valid YYYY-MM-DD date');
    }
  }
  if (body.customFacilities !== undefined && (!Array.isArray(body.customFacilities) || body.customFacilities.length > 50 || body.customFacilities.some((v) => typeof v !== 'string' || !v.trim() || v.length > 100))) {
    throw new BadRequestException('customFacilities must contain at most 50 names, up to 100 characters each');
  }
  if (body.facilities !== undefined && (body.facilities.length > 100 || body.facilities.some((v) => !filled(v?.code) || v.code.length > 64 || (v.groupCode !== undefined && (!filled(v.groupCode) || v.groupCode.length > 64))))) {
    throw new BadRequestException('Invalid facilities');
  }

  const medias = body.medias ?? [];
  if (medias.length > MAX_SELF_OWNER_ROOM_PHOTOS) throw new BadRequestException(`At most ${MAX_SELF_OWNER_ROOM_PHOTOS} room photos allowed`);
  if (medias.some((m) => !filled(m.mediaUrl))) throw new BadRequestException('each media needs mediaUrl');
  if (new Set(medias.map((m) => m.mediaUrl)).size !== medias.length) throw new BadRequestException('Room photos must be different files');
  if (body.nearbyPlaces !== undefined) validateNearbyPlaces(body.nearbyPlaces);
}
