import type {
  AgentLead,
  AgentLeadsPage,
  AgentLeadsSort,
  CreateLeadInput,
  LeadFilters,
  LeadLocationCatalog,
  LeadMatchSettings,
  LeadMatchSettingsResponse,
  LeadViewing,
  CreateLeadViewingInput,
  UpdateLeadViewingInput,
} from '@nestyk/types';
import { apiGet, apiPost, apiRequest } from './api';
import { ensureAgentSession } from './agent-session';
import type { LeadMatchRunResult } from './lead-match-preview';

export type { AgentLeadsSort };

export async function listAgentLeads(q: string, page: number, filters: LeadFilters = {}): Promise<AgentLeadsPage> {
  await ensureAgentSession();
  const params = new URLSearchParams({ q, page: String(page), limit: '20' });
  if (filters.province) params.set('province', filters.province);
  if (filters.locations?.length) params.set('locations', JSON.stringify(filters.locations));
  if (filters.includeUnspecified) params.set('includeUnspecified', 'true');
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.status) params.set('status', filters.status);
  return apiGet(`/agent/leads?${params}`);
}

export async function getAgentLead(id: number): Promise<AgentLead> {
  await ensureAgentSession();
  return apiGet(`/agent/leads/${id}`);
}

export async function createAgentLead(body: CreateLeadInput): Promise<AgentLead> {
  await ensureAgentSession();
  return apiPost('/agent/leads', body);
}

export async function fetchAgentVisaTypes(): Promise<Array<{ id: number; code: string }>> {
  await ensureAgentSession();
  return apiGet('/agent/leads/visa-types');
}

export async function fetchLeadLocations(): Promise<LeadLocationCatalog> {
  await ensureAgentSession();
  return apiGet('/agent/leads/locations');
}

export async function updateAgentLead(id: number, body: CreateLeadInput): Promise<AgentLead> {
  await ensureAgentSession();
  return apiRequest(`/agent/leads/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function markAgentLeadInProgress(id: number): Promise<AgentLead> {
  await ensureAgentSession();
  return apiPost(`/agent/leads/${id}/mark-inprogress`, {});
}

export async function markAgentLeadLost(id: number, lostReason: string): Promise<AgentLead> {
  await ensureAgentSession();
  return apiPost(`/agent/leads/${id}/mark-lost`, { lostReason });
}

export async function getLeadMatchSettings(id: number): Promise<LeadMatchSettingsResponse> {
  await ensureAgentSession();
  return apiGet(`/agent/leads/${id}/match-settings`);
}

export async function saveLeadMatchSettings(
  id: number,
  body: Partial<LeadMatchSettings>,
): Promise<LeadMatchSettingsResponse> {
  await ensureAgentSession();
  return apiRequest(`/agent/leads/${id}/match-settings`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function runLeadMatch(id: number): Promise<LeadMatchRunResult> {
  await ensureAgentSession();
  return apiPost(`/agent/leads/${id}/match-runs`, {});
}

export async function clearLeadMatches(id: number): Promise<void> {
  await ensureAgentSession();
  await apiRequest(`/agent/leads/${id}/match-runs`, { method: 'DELETE' });
}

export async function fetchLatestLeadMatch(id: number): Promise<LeadMatchRunResult> {
  await ensureAgentSession();
  return apiGet(`/agent/leads/${id}/match-runs/latest`);
}

export async function listLeadViewings(leadId: number): Promise<LeadViewing[]> {
  await ensureAgentSession();
  return apiGet(`/agent/leads/${leadId}/viewings`);
}

export async function createLeadViewing(leadId: number, body: CreateLeadViewingInput): Promise<LeadViewing> {
  await ensureAgentSession();
  return apiPost(`/agent/leads/${leadId}/viewings`, body);
}

export async function updateLeadViewing(id: number, body: UpdateLeadViewingInput): Promise<LeadViewing> {
  await ensureAgentSession();
  return apiRequest(`/agent/viewings/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

/** Agent calendar range (ISO date-times, at most 62 days); cancelled viewings are left out. */
export async function listAgentViewings(from: string, to: string): Promise<LeadViewing[]> {
  await ensureAgentSession();
  const params = new URLSearchParams({ from, to });
  return apiGet(`/agent/viewings?${params}`);
}
