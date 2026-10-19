import type { AgentDashboardData, DashboardWorkKind, DashboardWorkPage } from '@nestyk/types';
import { apiGet } from './api';
import { ensureAgentSession } from './agent-session';
export async function fetchAgentDashboard(): Promise<AgentDashboardData> {
  await ensureAgentSession();
  return apiGet('/agent/dashboard');
}
export async function fetchDashboardWork(kind: DashboardWorkKind, period: string, q: string, page: number): Promise<DashboardWorkPage> {
  await ensureAgentSession();
  const query = new URLSearchParams({ kind, period, q: q.trim(), page: String(page), limit: '20' });
  return apiGet(`/agent/dashboard/work-items?${query}`);
}
