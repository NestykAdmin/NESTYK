import { apiPost } from './api';

export type AuthSyncResponse = {
  id: number;
  email: string;
  roles: string[];
};

let ensurePromise: Promise<AuthSyncResponse> | null = null;

/** AGENT_ROLE_REQUIRED: the signed-in account has no agent role (e.g. a tenant who typed an /agent URL). */
export const AGENT_ROLE_REQUIRED = 'AGENT_ROLE_REQUIRED';

async function syncAndGrantAgent(): Promise<AuthSyncResponse> {
  const synced = await apiPost<AuthSyncResponse>('/auth/sync', {});
  if (synced.roles?.includes('agent')) {
    return synced;
  }
  // Self-registered accounts get the agent role from the API on their first sync (auth.service.ts
  // SELF_REGISTRATION_ROLES). The app asks for a role only in a dev build that opts in; the API refuses it anyway
  // outside NODE_ENV=development (QA web role URL bug, 4 Nov 2026). Same switch as ensureAdminRole (AuthContext.tsx).
  if (!(typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_ALLOW_DEV_ROLE_GRANT === 'true')) {
    throw Object.assign(new Error('Agent role required'), { code: AGENT_ROLE_REQUIRED });
  }
  return apiPost<AuthSyncResponse>('/auth/dev/roles', { role: 'agent' });
}

/** Syncs the profile and checks the agent role (idempotent). Throws AGENT_ROLE_REQUIRED without it. */
export function ensureAgentSession(): Promise<AuthSyncResponse> {
  if (!ensurePromise) {
    ensurePromise = syncAndGrantAgent().catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  return ensurePromise;
}
