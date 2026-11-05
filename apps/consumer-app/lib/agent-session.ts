import { apiPost } from './api';

export type AuthSyncResponse = {
  id: number;
  email: string;
  roles: string[];
};

let ensurePromise: Promise<AuthSyncResponse> | null = null;

/** The newest profile sync the sign-in code made, so the agent check does not ask the API for the same thing again. */
let recentSync: { at: number; promise: Promise<AuthSyncResponse> } | null = null;
const RECENT_SYNC_MS = 30_000;

/**
 * AuthContext calls this for every POST /auth/sync it makes (restore on page load, sign-in, refresh). The next agent
 * check reuses that answer while it is fresh: one request fewer per page load. A new sync also drops the previous
 * agent check, so a different account signing in on the same page is checked again (T2, 5 Nov 2026).
 */
export function noteProfileSync(promise: Promise<AuthSyncResponse>): void {
  recentSync = { at: Date.now(), promise };
  ensurePromise = null;
  promise.catch(() => {
    if (recentSync?.promise === promise) recentSync = null;
  });
}

/** Sign out or expiry: nothing about the old account is reused. */
export function resetAgentSession(): void {
  recentSync = null;
  ensurePromise = null;
}

/**
 * The other order: a screen can ask for the agent check before AuthContext's restore has synced (rooms and tenants do
 * this on mount). AuthContext's restore, and only restore, takes this answer when it is still fresh, so the page load
 * makes one POST /auth/sync either way. Never used for refreshProfile or sign-in, which need a new answer.
 */
export function takeRecentSync<T>(): Promise<T> | null {
  if (recentSync && Date.now() - recentSync.at < RECENT_SYNC_MS) return recentSync.promise as unknown as Promise<T>;
  return null;
}

async function currentSync(): Promise<AuthSyncResponse> {
  if (recentSync && Date.now() - recentSync.at < RECENT_SYNC_MS) {
    try {
      return await recentSync.promise;
    } catch {
      // The earlier request failed: ask again below.
    }
  }
  const request = apiPost<AuthSyncResponse>('/auth/sync', {});
  const mine = { at: Date.now(), promise: request };
  recentSync = mine;
  request.catch(() => {
    if (recentSync === mine) recentSync = null;
  });
  return request;
}

/** AGENT_ROLE_REQUIRED: the signed-in account has no agent role (e.g. a tenant who typed an /agent URL). */
export const AGENT_ROLE_REQUIRED = 'AGENT_ROLE_REQUIRED';

async function syncAndGrantAgent(): Promise<AuthSyncResponse> {
  const synced = await currentSync();
  if (synced.roles?.includes('agent')) {
    return synced;
  }
  // Self-registered accounts get the agent role from the API on their first sync (auth.service.ts
  // SELF_REGISTRATION_ROLES). The app asks for a role only in a dev build that opts in; the API refuses it anyway
  // outside NODE_ENV=development (QA web role URL bug, 4 Nov 2026). Same switch as ensureAdminRole (AuthContext.tsx).
  if (!(typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_ALLOW_DEV_ROLE_GRANT === 'true')) {
    recentSync = null; // a "no agent role" answer is never kept: the next check asks the API again
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
