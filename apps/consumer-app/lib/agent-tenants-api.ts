import type {
  AgentTenant,
  CreateAgentTenant,
  TenantLeadOption,
  TenantRoomOption,
  UpdateAgentTenant,
} from "@nestyk/types";
import { apiGet, apiPatch, apiPost } from "./api";
import { ensureAgentSession } from "./agent-session";
export async function listAgentTenants(): Promise<AgentTenant[]> {
  await ensureAgentSession();
  return apiGet("/agent/tenants");
}
export async function getAgentTenant(id: number): Promise<AgentTenant> {
  await ensureAgentSession();
  return apiGet(`/agent/tenants/${id}`);
}
export async function tenantLeadOptions(
  q: string,
): Promise<TenantLeadOption[]> {
  await ensureAgentSession();
  return apiGet(`/agent/tenants/leads?q=${encodeURIComponent(q)}`);
}
/**
 * Rooms to book. `leadId` puts the rooms that lead has a viewing for first; `roomId` makes sure
 * that one room is in the answer even when it is not among the latest 30.
 */
export async function tenantRoomOptions(
  q: string,
  options: { leadId?: number; roomId?: number } = {},
): Promise<TenantRoomOption[]> {
  await ensureAgentSession();
  const params = [`q=${encodeURIComponent(q)}`];
  if (options.leadId) params.push(`leadId=${options.leadId}`);
  if (options.roomId) params.push(`roomId=${options.roomId}`);
  return apiGet(`/agent/tenants/rooms?${params.join("&")}`);
}
export async function createAgentTenant(
  body: CreateAgentTenant,
): Promise<AgentTenant> {
  await ensureAgentSession();
  return apiPost("/agent/tenants", body);
}
export async function updateAgentTenant(
  id: number,
  body: UpdateAgentTenant,
): Promise<AgentTenant> {
  await ensureAgentSession();
  return apiPatch(`/agent/tenants/${id}`, body);
}
