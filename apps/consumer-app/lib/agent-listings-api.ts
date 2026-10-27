import { CreateRoomWizardSubmitData } from '@nestyk/feature-listing';
import { apiGet, apiPost, apiRequest } from './api';
import { ensureAgentSession } from './agent-session';

export type AgentListingCard = {
  id: number;
  listingTitle: string | null;
  visibility: 'private' | 'published' | null;
  isScoutRoom: boolean;
  listingSourceCode?: 'co_agent' | 'owner' | null;
  /** D8: in the agent's views, the status from the deals: available, booked, rented, soon_vacant, pending_verification, needs_edit. */
  roomStatusCode: string | null;
  /** D8: a soon-vacant room is free from this day. */
  vacantFrom?: string | null;
  property: {
    id: number;
    name: string;
    district: string;
    province: string;
  } | null;
  contact?: {
    id: number;
    name: string;
    phone: string;
  } | null;
  propertyOwner: {
    id: number;
    name: string;
    phone: string;
  } | null;
  prices: Array<{ contractTypeId?: number; contractTypeCode: string; termMonths?: number | null; price: number; advanceRentMonths?: number; depositMonths?: number }>;
  coverMediaUrl: string | null;
  roomTypeCode?: string | null;
  availableFromDate?: string | null;
  bedroomCount?: string | null;
  roomSizeSqm?: string | null;
  floor?: string | null;
  /** Room pin, falling back to the building pin. */
  latitude?: number | null;
  longitude?: number | null;
  updatedAt?: string | null;
};

export type AgentListingsSort = 'updated_desc' | 'updated_asc' | 'price_asc' | 'price_desc';

export type AgentListingsResponse = {
  items: AgentListingCard[];
  total: number;
  page: number;
  limit: number;
};

export type CreateRoomResponse = {
  id: number;
  propertyId: number;
  contactId: number;
  contactIds?: number[];
  listingSourceCode: 'co_agent' | 'owner';
  isScoutRoom: true;
  visibility: 'private' | 'published';
};

export async function fetchMyAgentListings(query: {
  page?: number;
  /** 1–50, default 20. */
  limit?: number;
  q?: string;
  visibility?: string;
  roomStatus?: string;
  listingSource?: string;
  sort?: AgentListingsSort;
  propertyType?: string;
  roomType?: string;
  bedrooms?: string;
  minPrice?: string;
  maxPrice?: string;
} = {}): Promise<AgentListingsResponse> {
  await ensureAgentSession();
  const params = new URLSearchParams({ page: String(query.page ?? 1), limit: String(query.limit ?? 20) });
  if (query.q) params.set('q', query.q);
  if (query.visibility) params.set('visibility', query.visibility);
  if (query.roomStatus) params.set('roomStatus', query.roomStatus);
  if (query.listingSource) params.set('listingSource', query.listingSource);
  if (query.sort) params.set('sort', query.sort);
  for (const key of ['propertyType', 'roomType', 'bedrooms', 'minPrice', 'maxPrice'] as const) {
    if (query[key]) params.set(key, query[key]);
  }
  return apiGet<AgentListingsResponse>(`/agent/listings?${params}`);
}

export async function fetchAgentPropertyTypes(): Promise<
  Array<{ id: number; code: string }>
> {
  await ensureAgentSession();
  return apiGet('/agent/rooms/property-types');
}

export async function fetchAgentContacts(): Promise<
  Array<{
    id: number;
    name: string;
    phone: string;
    lineId?: string | null;
    facebook?: string | null;
    note: string | null;
    roomCount: number;
  }>
> {
  await ensureAgentSession();
  return apiGet('/agent/rooms/contacts');
}

export async function fetchAgentContractTypes(): Promise<
  Array<{ id: number; code: string; termMonths: number }>
> {
  await ensureAgentSession();
  return apiGet('/agent/rooms/contract-types');
}

export async function fetchAgentRoomTypes(): Promise<
  Array<{ id: number; code: string; bedroomCount: number | null }>
> {
  await ensureAgentSession();
  return apiGet('/agent/rooms/room-types');
}

export async function createAgentScoutRoom(
  data: CreateRoomWizardSubmitData,
): Promise<CreateRoomResponse> {
  await ensureAgentSession();
  const { isScoutRoom: _scout, promoCopyStale: _stale, ...body } = data;
  return apiPost<CreateRoomResponse>('/agent/rooms', body);
}

export async function generateListingPromo(input: {
  locale: string;
  /** Listing copy language — defaults to locale when omitted. */
  outputLocale?: string;
  listing: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<{ listingTitle: string; listingDescription: string }> {
  await ensureAgentSession();
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  input.signal?.addEventListener('abort', onExternalAbort);
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const outputLocale = input.outputLocale || input.locale;
    const result = await apiRequest<{
      listingTitle?: string;
      listingDescription?: string;
    }>('/agent/rooms/generate-listing-promo', {
      method: 'POST',
      body: JSON.stringify({
        locale: input.locale,
        outputLocale,
        listing: input.listing,
      }),
      signal: controller.signal,
    });
    const listingTitle = result?.listingTitle?.trim() ?? '';
    const listingDescription = result?.listingDescription?.trim() ?? '';
    if (!listingTitle || !listingDescription) {
      throw new Error('AI returned empty listing title or description');
    }
    return { listingTitle, listingDescription };
  } catch (err) {
    if (input.signal?.aborted) {
      const cancelled = new Error('cancelled');
      cancelled.name = 'AbortError';
      throw cancelled;
    }
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('AI generation timed out — please try again');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener('abort', onExternalAbort);
  }
}

export async function fetchAgentRoom(id: number): Promise<import('@nestyk/feature-listing').AgentRoomDetail> {
  await ensureAgentSession();
  return apiGet(`/agent/listings/${id}`);
}

export async function updateAgentRoom(id: number, data: CreateRoomWizardSubmitData): Promise<CreateRoomResponse> {
  await ensureAgentSession();
  const { isScoutRoom: _scout, promoCopyStale: _stale, ...body } = data;
  return apiRequest(`/agent/rooms/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function fetchAgentFacilities(): Promise<import('@nestyk/types').FacilityOption[]> {
  await ensureAgentSession();
  return apiGet('/agent/rooms/facilities');
}

export type RoomShareSections = {
  photos: boolean;
  price: boolean;
  facilities: boolean;
  location: boolean;
  contact: boolean;
};

export type RoomShareLinkCreated = {
  id: number;
  url: string;
  expiresAt: string;
  shareSections: RoomShareSections;
  contactId: number | null;
  status: 'active';
};

export type RoomShareLinkMeta = {
  id: number;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  shareSections: RoomShareSections;
  contactId: number | null;
  status: 'active' | 'expired' | 'revoked';
};

export async function createRoomShareLink(
  roomId: number,
  body: {
    expiresInDays?: number;
    shareSections?: RoomShareSections;
    contactId?: number | null;
  },
): Promise<RoomShareLinkCreated> {
  await ensureAgentSession();
  return apiRequest(`/agent/listings/${roomId}/share-links`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listRoomShareLinks(roomId: number): Promise<{ items: RoomShareLinkMeta[] }> {
  await ensureAgentSession();
  return apiGet(`/agent/listings/${roomId}/share-links`);
}

export async function revokeRoomShareLink(roomId: number, linkId: number) {
  await ensureAgentSession();
  return apiRequest(`/agent/listings/${roomId}/share-links/${linkId}`, {
    method: 'DELETE',
  });
}
