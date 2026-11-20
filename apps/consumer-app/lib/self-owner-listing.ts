import type { AgentRoomDetail, CreateRoomWizardSubmitData } from '@nestyk/feature-listing';
import type { SelfOwnerRoom, SelfOwnerRoomOptions } from './self-owner-rooms';

/**
 * Self owner listing form (UI round, 20 Nov 2026, ClickUp z8rcteng6c / z8rcteng6d). The form is the agent listing
 * wizard; every `/agent/*` endpoint it normally reads is `@Roles('agent')`, so this file gives it demo choices and maps
 * its data to and from a self owner room. No network: swap for the self owner API later.
 */
export const SELF_OWNER_DEMO_OPTIONS: SelfOwnerRoomOptions = {
  propertyTypes: [
    { id: 1, code: 'condo' },
    { id: 2, code: 'apartment' },
    { id: 3, code: 'house' },
  ],
  contractTypes: [
    { id: 1, code: 'six_months', termMonths: 6 },
    { id: 2, code: 'twelve_months', termMonths: 12 },
  ],
  roomTypes: [
    { id: 1, code: 'studio', bedroomCount: 0 },
    { id: 2, code: 'one_bedroom', bedroomCount: 1 },
    { id: 3, code: 'two_bedroom', bedroomCount: 2 },
    { id: 4, code: 'three_bedroom', bedroomCount: 3 },
  ],
  facilities: [
    { code: 'bed_mattress', groupCode: 'furniture' },
    { code: 'wardrobe', groupCode: 'furniture' },
    { code: 'air_conditioner', groupCode: 'appliances' },
    { code: 'wifi', groupCode: 'appliances' },
    { code: 'parking', groupCode: 'parking' },
    { code: 'swimming_pool', groupCode: 'project_facilities' },
    { code: 'elevator', groupCode: 'project_facilities' },
    { code: 'security', groupCode: 'security_services' },
  ],
};

const YEAR_CONTRACT = SELF_OWNER_DEMO_OPTIONS.contractTypes.find((type) => type.termMonths === 12)!;
const yearContractId = (options: SelfOwnerRoomOptions) => options.contractTypes.find((type) => type.termMonths === 12)?.id;

/**
 * What the owner last saved in the form, by room id, so editing a room they added shows every field again.
 * Lives as long as the room store (gone on reload).
 */
export const selfOwnerListingDrafts = new Map<string, CreateRoomWizardSubmitData>();

/** `r15` after the highest `r<n>` id. */
export function nextSelfOwnerRoomId(rooms: SelfOwnerRoom[]): string {
  const top = rooms.reduce((max, room) => {
    const match = /^r(\d+)$/.exec(room.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `r${top + 1}`;
}

function layoutNumber(data: CreateRoomWizardSubmitData, code: string): number | null {
  const text = data.layout.find((item) => item.code === code)?.value?.trim() ?? '';
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : null;
}

/**
 * Wizard data -> room. A new room starts unlisted (the wizard creates private rooms). Editing keeps the tenant,
 * lease and interest of `previous`; a rented room stays rented.
 */
export function roomFromWizard(
  data: CreateRoomWizardSubmitData,
  input: { id: string; now: Date; previous?: SelfOwnerRoom; options?: SelfOwnerRoomOptions },
): SelfOwnerRoom {
  const { id, now, previous, options = SELF_OWNER_DEMO_OPTIONS } = input;
  const roomType = options.roomTypes.find((type) => type.id === data.roomTypeId);
  const yearPrice = data.prices.find((price) => price.contractTypeId === yearContractId(options));
  const size = layoutNumber(data, 'room_size');
  const state: SelfOwnerRoom['state'] =
    previous?.state === 'occupied' ? 'occupied' : previous && data.visibility === 'published' ? 'listed' : 'unlisted';
  return {
    ...previous,
    id,
    title: data.listingTitle.trim() || previous?.title || data.roomId?.trim() || '',
    project: data.property.name.trim() || previous?.project || '',
    monthlyRent: (yearPrice ?? data.prices[0])?.price ?? previous?.monthlyRent ?? 0,
    bedrooms: roomType?.bedroomCount ?? layoutNumber(data, 'bedroom') ?? previous?.bedrooms ?? 0,
    sizeSqm: size && size > 0 ? size : previous?.sizeSqm ?? 0,
    state,
    updatedAt: now.toISOString(),
  };
}

/** Room -> wizard data for editing: what the owner saved before, else a form filled from the room. */
export function wizardDataFromRoom(room: SelfOwnerRoom, saved?: CreateRoomWizardSubmitData): CreateRoomWizardSubmitData {
  const visibility = room.state === 'listed' ? 'published' : 'private';
  if (saved) return { ...saved, visibility };
  const roomType = SELF_OWNER_DEMO_OPTIONS.roomTypes.find((type) => type.bedroomCount === room.bedrooms);
  return {
    visibility,
    listingTitle: room.title,
    listingSourceCode: 'owner',
    isScoutRoom: true,
    property: {
      name: room.project,
      address: room.project,
      district: '',
      province: 'กรุงเทพมหานคร',
      propertyTypeId: SELF_OWNER_DEMO_OPTIONS.propertyTypes[0].id,
    },
    ...(roomType ? { roomTypeId: roomType.id } : {}),
    prices: [{ contractTypeId: YEAR_CONTRACT.id, price: room.monthlyRent }],
    advanceRentMonths: 1,
    depositMonths: 2,
    layout: [
      { code: 'bedroom', value: String(room.bedrooms) },
      { code: 'bathroom', value: '1' },
      { code: 'room_size', value: String(room.sizeSqm) },
    ],
    facilities: [],
    medias: [],
    documents: [],
  };
}

/**
 * Room -> the agent room detail shape, so the self owner modal shows the same detail page as the agent
 * (Jom 20 Nov 2026). Uses what the owner saved when there is one; demo rooms show what the room has.
 */
export function roomDetailFromSelfOwner(
  room: SelfOwnerRoom,
  saved?: CreateRoomWizardSubmitData,
  options: SelfOwnerRoomOptions = SELF_OWNER_DEMO_OPTIONS,
): AgentRoomDetail {
  const data = wizardDataFromRoom(room, saved);
  const numericId = Number(room.id.replace(/^\D+/, '')) || 0;
  const roomType = options.roomTypes.find((type) => type.id === data.roomTypeId);
  const propertyType = options.propertyTypes.find((type) => type.id === data.property.propertyTypeId);
  const text = (value: number | undefined) => (value == null ? null : String(value));
  const latitude = data.property.latitude ?? data.latitude;
  const longitude = data.property.longitude ?? data.longitude;
  const contacts = data.contacts?.length ? data.contacts : data.selectedContacts?.length ? data.selectedContacts : data.contact ? [data.contact] : [];
  return {
    id: numericId,
    listingTitle: data.listingTitle || room.title,
    promoTitle: data.promoTitle ?? null,
    description: data.listingDescription ?? null,
    roomId: data.roomId ?? null,
    visibility: data.visibility,
    roomStatusCode: room.state === 'occupied' ? 'rented' : 'available',
    vacantFrom: null,
    roomTypeCode: roomType?.code ?? null,
    roomTypeId: roomType?.id ?? null,
    listingSourceCode: 'owner',
    availableFromDate: data.availableFromDate ?? '',
    property: {
      id: numericId,
      propertyTypeId: data.property.propertyTypeId || null,
      latitude: text(latitude),
      longitude: text(longitude),
      name: data.property.name,
      address: data.property.address,
      subdistrict: data.property.subdistrict ?? '',
      district: data.property.district,
      province: data.property.province,
      postalCode: data.property.postalCode ?? '',
      propertyTypeCode: propertyType?.code ?? null,
    },
    latitude: text(latitude),
    longitude: text(longitude),
    prices: data.prices.map((price) => {
      const contract = options.contractTypes.find((type) => type.id === price.contractTypeId);
      return {
        contractTypeId: price.contractTypeId,
        contractTypeCode: contract?.code ?? '',
        termMonths: contract?.termMonths ?? null,
        price: price.price,
        advanceRentMonths: price.advanceRentMonths ?? data.advanceRentMonths,
        depositMonths: price.depositMonths ?? data.depositMonths,
      };
    }),
    advanceRentMonths: data.advanceRentMonths,
    depositMonths: data.depositMonths,
    waterRatePerUnit: text(data.waterRatePerUnit),
    electricRatePerUnit: text(data.electricRatePerUnit),
    medias: data.medias.map((media, index) => ({ id: index + 1, mediaUrl: media.mediaUrl, mediaType: 'image', isCover: !!media.isCover })),
    layout: data.layout,
    facilities: data.facilities.map((facility) => facility.code),
    facilityItems: data.facilities.map((facility) => ({ code: facility.code, groupCode: facility.groupCode ?? null })),
    customFacilities: data.customFacilities ?? [],
    nearbyPlaces: data.nearbyPlaces ?? [],
    nearbyOther: null,
    contacts: contacts.map((contact, index) => ({
      id: index + 1,
      name: contact.name,
      phone: contact.phone,
      email: null,
      lineId: contact.lineId ?? null,
      facebook: contact.facebook ?? null,
      note: ('note' in contact ? contact.note : undefined) ?? null,
      isPrimary: index === 0,
    })),
  };
}
