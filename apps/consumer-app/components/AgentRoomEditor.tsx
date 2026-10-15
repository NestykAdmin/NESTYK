import React, { useMemo } from 'react';
import { AgentRoomDetail, CreateRoomWizardSubmitData, MobileCreateListingWizardBody, defaultAgentListingConfig } from '@nestyk/feature-listing';
import { useLocale } from '@nestyk/i18n';
import { pickRoomPhotos, uploadRoomPhoto, enhanceRoomPhoto } from '../lib/room-photos';
import { fetchAgentContacts, fetchAgentPropertyTypes, fetchAgentContractTypes, fetchAgentRoomTypes, fetchAgentFacilities, updateAgentRoom, generateListingPromo } from '../lib/agent-listings-api';
import { searchPlaces, getPlaceDetails, searchNearbyPlaces } from '../lib/places-api';

export function AgentRoomEditor({
  room,
  onSaved,
  onBusy,
  backHandlerRef,
  onHeaderTitleChange,
  onCancelEdit,
}: {
  room: AgentRoomDetail;
  onSaved: (result?: { promoCopyStale?: boolean }) => void;
  onBusy: (busy: boolean) => void;
  backHandlerRef?: React.MutableRefObject<(() => boolean) | null>;
  onHeaderTitleChange?: (title: string) => void;
  onCancelEdit?: () => void;
}) {
  const { t, locale } = useLocale();
  const initialData = useMemo<CreateRoomWizardSubmitData>(() => ({
    visibility: room.visibility ?? 'private', isScoutRoom: true,
    listingTitle: room.listingTitle ?? '',
    promoTitle: room.promoTitle ?? undefined,
    listingDescription: room.description ?? undefined,
    availableFromDate: room.availableFromDate,
    listingSourceCode: room.listingSourceCode === 'owner' ? 'owner' : 'co_agent',
    roomId: room.roomId ?? undefined, roomTypeId: room.roomTypeId ?? undefined,
    property: {
      name: room.property?.name ?? '', address: room.property?.address ?? '', district: room.property?.district ?? '',
      province: room.property?.province ?? '', subdistrict: room.property?.subdistrict,
      postalCode: room.property?.postalCode, propertyTypeId: room.property?.propertyTypeId ?? 0,
      latitude: room.property?.latitude == null ? undefined : Number(room.property.latitude),
      longitude: room.property?.longitude == null ? undefined : Number(room.property.longitude),
    },
    contactId: room.contacts.find((c) => c.isPrimary)?.id ?? room.contacts[0]?.id,
    selectedContacts: [...room.contacts]
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
      .slice(0, 2)
      .map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        lineId: c.lineId ?? undefined,
        facebook: c.facebook ?? undefined,
      })),
    contactIds: [...room.contacts]
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
      .slice(0, 2)
      .map((c) => c.id),
    layout: room.layout,
    prices: room.prices.filter((p) => p.contractTypeId != null).map((p) => ({ contractTypeId: p.contractTypeId!, price: p.price, advanceRentMonths: p.advanceRentMonths, depositMonths: p.depositMonths })),
    advanceRentMonths: room.advanceRentMonths, depositMonths: room.depositMonths,
    waterRatePerUnit: room.waterRatePerUnit == null ? undefined : Number(room.waterRatePerUnit),
    electricRatePerUnit: room.electricRatePerUnit == null ? undefined : Number(room.electricRatePerUnit),
    medias: room.medias.filter((m) => m.mediaType === 'image').map((m, index) => ({ mediaUrl: m.mediaUrl, category: 'room', isCover: m.isCover, sortOrder: index })),
    facilities: (room.facilityItems ?? []).map(item => ({ ...item, groupCode: item.groupCode ?? undefined })), customFacilities: room.customFacilities ?? [],
    nearbyOther: room.nearbyOther ?? '', nearbyPlaces: room.nearbyPlaces,
    documents: [],
    promoCopyStale: room.promoCopyStale,
    latitude: room.latitude == null ? undefined : Number(room.latitude),
    longitude: room.longitude == null ? undefined : Number(room.longitude),
  }), [room]);
  return (
    <MobileCreateListingWizardBody
      config={defaultAgentListingConfig}
      initialData={initialData}
      title={t.agent.listings.editRoom}
      submitLabel={t.agent.listings.saveChanges}
      backHandlerRef={backHandlerRef}
      onAbandonUnsaved={onCancelEdit}
      onHeaderTitleChange={onHeaderTitleChange}
      onSubmittingChange={onBusy}
      pickPhotos={pickRoomPhotos}
      uploadPhoto={uploadRoomPhoto}
      enhancePhoto={enhanceRoomPhoto}
      listContacts={fetchAgentContacts}
      listPropertyTypes={fetchAgentPropertyTypes}
      listContractTypes={fetchAgentContractTypes}
      listRoomTypes={fetchAgentRoomTypes}
      listFacilities={fetchAgentFacilities}
      mapsApiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}
      searchNearby={(lat, lng) => searchNearbyPlaces(lat, lng, locale)}
      searchPlaces={(q) => searchPlaces(q, locale)}
      getPlaceDetails={(id) => getPlaceDetails(id, locale)}
      generateListingPromo={generateListingPromo}
      onSubmitListing={async (data) => {
        await updateAgentRoom(room.id, data);
        onSaved({ promoCopyStale: data.promoCopyStale });
      }}
    />
  );
}
