import { apiGet, apiRequest } from './api';
import { ensureAgentSession } from './agent-session';
import {
  fetchAgentContact, updateAgentContact,
  type AgentContactDetail, type AgentOwnerContact,
} from './agent-listings-api';

export type AgentDirectoryKind = 'owner' | 'landlord' | 'lead' | 'tenant' | 'coAgent';

export type AgentContactsPage = { items: AgentOwnerContact[]; total: number; page: number; limit: number };
export const CONTACT_PAGE_SIZE = 20;

export async function listDirectoryContacts(kind: AgentDirectoryKind, query = '', page = 1): Promise<AgentContactsPage> {
  await ensureAgentSession();
  const paths: Record<AgentDirectoryKind, string> = {
    owner: '/agent/rooms/owner-contacts', landlord: '/agent/rooms/landlord-contacts',
    coAgent: '/agent/rooms/co-agent-contacts', lead: '/agent/contacts/lead', tenant: '/agent/contacts/tenant',
  };
  const params = new URLSearchParams({ q: query.trim(), page: String(page), limit: String(CONTACT_PAGE_SIZE) });
  return apiGet(`${paths[kind]}?${params}`);
}

export async function fetchDirectoryContact(kind: AgentDirectoryKind, id: number): Promise<AgentContactDetail> {
  if (kind === 'owner' || kind === 'landlord' || kind === 'coAgent') return fetchAgentContact(id);
  await ensureAgentSession();
  return apiGet(`/agent/contacts/${kind}/${id}`);
}

export async function updateDirectoryContact(kind: AgentDirectoryKind, id: number, input: Omit<AgentContactDetail, 'id'>): Promise<AgentContactDetail> {
  if (kind === 'owner' || kind === 'landlord' || kind === 'coAgent') return updateAgentContact(id, input);
  await ensureAgentSession();
  return apiRequest(`/agent/contacts/${kind}/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function createCoAgentContact(input: Omit<AgentContactDetail, 'id'>): Promise<AgentContactDetail> {
  await ensureAgentSession();
  return apiRequest('/agent/rooms/co-agent-contacts', { method: 'POST', body: JSON.stringify(input) });
}

export type AgentContactRoom = {
  id: number;
  roomId: string | null;
  listingTitle: string | null;
  propertyName: string | null;
  district: string | null;
  province: string | null;
  roomStatusCode: string | null;
  roomTypeCode: string | null;
  bedroomCount: string | null;
  roomSizeSqm: string | null;
  floor: string | null;
  minRent: number | null;
};

export async function fetchContactRooms(id: number): Promise<AgentContactRoom[]> {
  await ensureAgentSession();
  return apiGet(`/agent/rooms/contacts/${id}/rooms`);
}
