import type { CreateRoomWizardSubmitData, RoomPhoto } from '@nestyk/feature-listing';
import { apiGet, apiPatch, apiPost } from './api';
import { uploadRoomPhotoTo } from './room-photos';
import type { SelfOwnerRoom, SelfOwnerRoomOptions, SelfOwnerRoomState, SelfOwnerRoomsBackend } from './self-owner-rooms';

/**
 * The self owner rooms API (/self-owner/rooms, @Roles('self_owner'); D4 20 Nov 2026: own tables apart from the agent
 * rooms). The app connects the room store to this once a self owner is signed in.
 */
type RoomSummary = Omit<SelfOwnerRoom, 'id' | 'coverUrl' | 'sizeSqm'> & { id: number; sizeSqm: number | null; coverUrl: string | null };
type RoomDetail = Omit<CreateRoomWizardSubmitData, 'isScoutRoom' | 'documents' | 'waterRatePerUnit' | 'electricRatePerUnit'> & {
  id: number;
  state: SelfOwnerRoomState;
  updatedAt: string;
  waterRatePerUnit: number | null;
  electricRatePerUnit: number | null;
};
type SaveResult = { id: number; visibility: 'private' | 'published'; state: SelfOwnerRoomState };

const BASE = '/self-owner/rooms';
let optionsPromise: Promise<SelfOwnerRoomOptions> | null = null;

function roomFromSummary(row: RoomSummary): SelfOwnerRoom {
  return {
    id: String(row.id),
    title: row.title,
    project: row.project,
    monthlyRent: row.monthlyRent,
    state: row.state,
    bedrooms: row.bedrooms,
    sizeSqm: row.sizeSqm ?? 0,
    updatedAt: row.updatedAt,
    coverUrl: row.coverUrl ?? undefined,
  };
}

function formFromDetail(row: RoomDetail): CreateRoomWizardSubmitData {
  const { id: _id, state: _state, updatedAt: _updated, waterRatePerUnit, electricRatePerUnit, ...form } = row;
  return {
    ...form,
    ...(waterRatePerUnit != null ? { waterRatePerUnit } : {}),
    ...(electricRatePerUnit != null ? { electricRatePerUnit } : {}),
    isScoutRoom: true,
    documents: [],
  };
}

/** What the API takes: the form's data minus the agent-only and UI-only fields; the room's one contact. */
function bodyFromForm(data: CreateRoomWizardSubmitData) {
  const {
    isScoutRoom: _scout, promoCopyStale: _stale, documents: _documents, contactId: _contactId, contactIds: _contactIds,
    contacts, selectedContacts, contact, nearbyOther: _nearbyOther, ...body
  } = data;
  const one = contact ?? contacts?.[0] ?? selectedContacts?.[0];
  return { ...body, ...(one ? { contact: { name: one.name, phone: one.phone, lineId: one.lineId, facebook: one.facebook } } : {}) };
}

export const selfOwnerRoomsApi: SelfOwnerRoomsBackend = {
  async list() {
    return (await apiGet<RoomSummary[]>(BASE)).map(roomFromSummary);
  },
  async detail(id) {
    return formFromDetail(await apiGet<RoomDetail>(`${BASE}/${id}`));
  },
  async save(id, data) {
    const result = id == null
      ? await apiPost<SaveResult>(BASE, bodyFromForm(data))
      : await apiPatch<SaveResult>(`${BASE}/${id}`, bodyFromForm(data));
    return String(result.id);
  },
  async setVisibility(id, visibility) {
    return (await apiPatch<SaveResult>(`${BASE}/${id}/visibility`, { visibility })).state;
  },
  options() {
    optionsPromise ??= apiGet<SelfOwnerRoomOptions>(`${BASE}/options`).catch((error) => {
      optionsPromise = null;
      throw error;
    });
    return optionsPromise;
  },
  uploadPhoto(photo: RoomPhoto) {
    return uploadRoomPhotoTo(`${BASE}/media/upload`, photo);
  },
};
