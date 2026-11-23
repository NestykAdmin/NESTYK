import React, { useMemo, useSyncExternalStore } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Platform, useWindowDimensions } from 'react-native';
import {
  MobileCreateListingWizardBody,
  defaultOwnerListingConfig,
  type CreateRoomWizardSubmitData,
  type RoomPhoto,
} from '@nestyk/feature-listing';
import { localizedError, useLocale } from '@nestyk/i18n';
import { interpolate } from '@nestyk/feature-listing';
import { selfOwnerRoomErrorCode, selfOwnerRoomStore, type SelfOwnerRoom } from '../../lib/self-owner-rooms';
import {
  SELF_OWNER_DEMO_OPTIONS,
  nextSelfOwnerRoomId,
  roomFromWizard,
  selfOwnerListingDrafts,
  wizardDataFromRoom,
} from '../../lib/self-owner-listing';

/**
 * Self owner "add / edit room" (UI round, 20 Nov 2026, ClickUp z8rcteng6c / z8rcteng6d): the agent listing wizard
 * with the owner preset (no "who is listing" picker). Connected to the self owner API (the room store's backend,
 * 20 Nov 2026) it takes the API choices, uploads photos and saves there; otherwise demo choices and the in-memory store.
 * Place search, nearby, AI copy, photo enhance and the contact list stay off because they are `/agent/*` today.
 */
export interface SelfOwnerListingEditorProps {
  /** Room to edit; omit to add a new one. */
  room?: SelfOwnerRoom;
  onDone: (room: SelfOwnerRoom) => void;
  /** Edit: called after the owner confirms leaving with unsaved changes. */
  onCancel?: () => void;
  backHandlerRef?: React.MutableRefObject<(() => boolean) | null>;
  onHeaderTitleChange?: (title: string) => void;
  /** The owner's name and phone from their profile: the room's only contact (Jom 20 Nov 2026). */
  ownerContact?: { name: string; phone: string };
}

/** Photos from the device (same picker settings as the agent). */
async function pickLocalPhotos(limit: number): Promise<RoomPhoto[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: limit,
    quality: 0.8,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (result.canceled) return [];
  return result.assets.slice(0, limit).map((asset) => ({
    uri: asset.uri,
    name: asset.fileName ?? 'room-photo.jpg',
    mimeType: asset.mimeType ?? 'image/jpeg',
    file: asset.file,
  }));
}

export function SelfOwnerListingEditor({ room, onDone, onCancel, backHandlerRef, onHeaderTitleChange, ownerContact }: SelfOwnerListingEditorProps) {
  const { t, locale } = useLocale();
  const copy = t.selfOwnerRooms;
  const initialData = useMemo(
    () => (room ? wizardDataFromRoom(room, selfOwnerListingDrafts.get(room.id)) : undefined),
    [room],
  );

  // The wizard asks with Alert before dropping unsaved edits; Alert does nothing on react-native-web, so ask here.
  const cr = t.agent.createRoom;
  const confirmLeave =
    Platform.OS === 'web'
      ? (discard: () => void) => {
          if (typeof globalThis.confirm === 'function' && globalThis.confirm(`${cr.setupUnsavedLeaveTitle}\n${cr.setupUnsavedLeaveBody}`)) discard();
        }
      : undefined;

  // Owner words for the agent's "listing name" and "listing source" (the wizard keeps the agent words by default).
  const copyOverrides = useMemo(
    () => ({
      listingTitle: copy.titleField,
      listingTitleHint: copy.titleFieldHint,
      listingTitlePlaceholder: copy.titlePlaceholder,
      sourceSection: copy.contactSection,
      contactStepTitle: copy.contactSection,
      visibilityPrivateHint: copy.privateHint,
    }),
    [copy],
  );
  // Wide web gets the desktop form (dialogs, buttons at their own width), like the web shell (768 and up).
  const { width } = useWindowDimensions();
  const desktopLayout = Platform.OS === 'web' && width >= 768;

  // Re-render when the app connects the store: a page opened straight on "add room" renders before that happens.
  const source = useSyncExternalStore(selfOwnerRoomStore.subscribe, selfOwnerRoomStore.getState, selfOwnerRoomStore.getState).source;
  // Read at call time, so a list asked after the store connects goes to the API.
  const options = () => {
    const live = selfOwnerRoomStore.backend();
    return live ? live.options() : Promise.resolve(SELF_OWNER_DEMO_OPTIONS);
  };

  const save = async (submitted: CreateRoomWizardSubmitData) => {
    const backend = selfOwnerRoomStore.backend();
    // The room name may be blank: "ห้อง {เลขห้อง}", else the project name.
    const roomNumber = submitted.roomId?.trim();
    const data = submitted.listingTitle.trim()
      ? submitted
      : {
          ...submitted,
          listingTitle: roomNumber ? interpolate(copy.autoTitle, { room: roomNumber }) : submitted.property.name.trim(),
        };
    const previous = room ? selfOwnerRoomStore.get().find((item) => item.id === room.id) ?? room : undefined;
    let id = room?.id ?? nextSelfOwnerRoomId(selfOwnerRoomStore.get());
    let choices = SELF_OWNER_DEMO_OPTIONS;
    if (backend) {
      try {
        id = await backend.save(room?.id, data);
      } catch (caught) {
        // A refusal with a reason code fails with the owner's own words (the wizard shows the error's message).
        const err = selfOwnerRoomErrorCode(caught) === 'LISTED_ROOM_NEEDS_PHOTOS' ? new Error(copy.listedNeedsPhotos) : caught;
        // The wizard reports a failed save with Alert, which does nothing on react-native-web.
        if (Platform.OS === 'web' && typeof globalThis.alert === 'function') {
          globalThis.alert(`${cr.saveError}\n${localizedError(err, t.common.errorGeneric, locale)}`);
        }
        throw err;
      }
      // Saved: from here on nothing may fail the submit (the owner would save again and add the room twice).
      choices = await backend.options().catch(() => SELF_OWNER_DEMO_OPTIONS);
    }
    const saved = roomFromWizard(data, { id, now: new Date(), previous, options: choices });
    selfOwnerListingDrafts.set(id, data);
    if (previous) selfOwnerRoomStore.update(id, saved);
    else selfOwnerRoomStore.add(saved);
    if (backend) void selfOwnerRoomStore.refresh();
    onDone(saved);
  };

  return (
    <MobileCreateListingWizardBody
      // The form starts again on the API choices when the store connects (nothing is typed that early).
      key={`${room?.id ?? 'new'}-${source}`}
      config={defaultOwnerListingConfig}
      presetListingSource="owner"
      copyOverrides={copyOverrides}
      listingTitleOptional
      ownerContact={ownerContact}
      desktopLayout={desktopLayout}
      initialData={initialData}
      title={room ? copy.editTitle : copy.createTitle}
      backHandlerRef={backHandlerRef}
      onHeaderTitleChange={onHeaderTitleChange}
      onAbandonUnsaved={onCancel}
      confirmLeave={confirmLeave}
      pickPhotos={pickLocalPhotos}
      uploadPhoto={async (photo) => {
        const live = selfOwnerRoomStore.backend();
        return live ? live.uploadPhoto(photo) : photo.uri;
      }}
      listPropertyTypes={async () => (await options()).propertyTypes}
      listContractTypes={async () => (await options()).contractTypes}
      listRoomTypes={async () => (await options()).roomTypes}
      listFacilities={async () => (await options()).facilities}
      mapsApiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}
      onSubmitListing={save}
    />
  );
}
