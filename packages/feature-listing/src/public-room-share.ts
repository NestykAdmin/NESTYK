import type { AgentRoomDetail } from './agent-room-detail';
import type { RoomShareVisibility } from './share-completeness';

/** The existing public API deliberately omits private Agent fields. */
export type PublicRoomShare = Pick<AgentRoomDetail,
  'id' | 'promoTitle' | 'description' | 'roomStatusCode' | 'roomTypeCode' | 'layout'
> & {
  availableFromDate: string | null;
  expiresAt: string;
  shareSections: RoomShareVisibility;
  medias?: AgentRoomDetail['medias'];
  prices?: AgentRoomDetail['prices'];
  advanceRentMonths?: number;
  depositMonths?: number;
  facilities?: string[];
  facilityItems?: AgentRoomDetail['facilityItems'];
  customFacilities?: string[];
  nearbyPlaces?: AgentRoomDetail['nearbyPlaces'];
  latitude?: string | null;
  longitude?: string | null;
  property?: (Partial<NonNullable<AgentRoomDetail['property']>> & { name: string }) | null;
  contacts?: Array<Omit<AgentRoomDetail['contacts'][number], 'note'> & { note?: null }>;
};

/** Adapt only data returned by the public endpoint; never fetch Agent data. */
export function toPublicRoomDetail(data: PublicRoomShare): AgentRoomDetail {
  const visible = data.shareSections;
  const property = data.property;
  return {
    id: data.id,
    promoTitle: data.promoTitle,
    description: data.description,
    roomStatusCode: data.roomStatusCode,
    roomTypeCode: data.roomTypeCode,
    availableFromDate: data.availableFromDate ?? '',
    layout: data.layout ?? [],
    medias: visible.photos ? data.medias ?? [] : [],
    prices: visible.price ? data.prices ?? [] : [],
    advanceRentMonths: visible.price ? data.advanceRentMonths ?? 0 : 0,
    depositMonths: visible.price ? data.depositMonths ?? 0 : 0,
    facilityItems: visible.facilities ? data.facilityItems ?? [] : [],
    facilities: visible.facilities
      ? (data.facilities ?? []).filter(code => !data.customFacilities?.includes(code))
      : [],
    customFacilities: visible.facilities ? data.customFacilities ?? [] : [],
    nearbyPlaces: visible.location ? data.nearbyPlaces ?? [] : [],
    latitude: visible.location ? data.latitude ?? null : null,
    longitude: visible.location ? data.longitude ?? null : null,
    property: property ? {
      id: property.id ?? 0,
      name: property.name,
      propertyTypeId: null,
      propertyTypeCode: property.propertyTypeCode ?? null,
      address: visible.location ? property.address ?? '' : '',
      subdistrict: visible.location ? property.subdistrict ?? '' : '',
      district: visible.location ? property.district ?? '' : '',
      province: visible.location ? property.province ?? '' : '',
      postalCode: visible.location ? property.postalCode ?? '' : '',
      latitude: visible.location ? property.latitude ?? null : null,
      longitude: visible.location ? property.longitude ?? null : null,
    } : null,
    contacts: visible.contact ? (data.contacts ?? []).map(contact => ({
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      lineId: contact.lineId,
      facebook: contact.facebook,
      isPrimary: contact.isPrimary,
      note: null,
    })) : [],
    listingTitle: null,
    roomId: null,
    visibility: null,
    roomTypeId: null,
    listingSourceCode: null,
    waterRatePerUnit: null,
    electricRatePerUnit: null,
    nearbyOther: null,
    documents: [],
  };
}
