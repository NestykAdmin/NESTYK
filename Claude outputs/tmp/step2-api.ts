import { APP_CONFIG, toDeviceUrls, toServerUrls } from './config';
import { getOrCreateDevIdentity, toDevBearer } from './dev-identity';
import { loadAuthSession } from './auth/session-storage';
import { getSupabaseClient } from './auth/supabase';

export class ApiError extends Error {
  status: number;
  /** Machine-readable reason some endpoints send next to `message` (e.g. `BROKER_APPOINTMENT_REQUIRED`). */
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function codeFromBody(body: unknown): string | undefined {
  const code = body && typeof body === 'object' ? (body as { code?: unknown }).code : undefined;
  return typeof code === 'string' && code ? code : undefined;
}

/** `code` of the ApiError thrown when a signed-in user's session can no longer be renewed. */
export const SESSION_EXPIRED = 'SESSION_EXPIRED';

let onSessionExpired: (() => void) | null = null;

/** AuthContext registers here to sign the user out and show the "session expired" notice. */
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

type AuthInfo = {
  headers: Record<string, string>;
  /** The request carries a Supabase login token, so a 401 may mean the session ran out. */
  supabase: boolean;
};

async function authHeader(overrideToken?: string): Promise<AuthInfo> {
  if (overrideToken) {
    return { headers: bearer(overrideToken), supabase: false };
  }
  const session = await loadAuthSession();
  const client = session?.mode === 'dev' ? null : getSupabaseClient();
  if (client) {
    // The token saved at sign-in is never updated, so ask Supabase for the current one.
    // getSession() also renews the access token first when it has expired (or is about to).
    const { data } = await client.auth.getSession();
    const token = data.session?.access_token;
    if (token) return { headers: bearer(token), supabase: true };
  }
  if (session?.accessToken) {
    return { headers: bearer(session.accessToken), supabase: Boolean(client) };
  }
  const identity = await getOrCreateDevIdentity();
  return { headers: bearer(toDevBearer(identity)), supabase: false };
}

/**
 * After a 401: ask Supabase for a new access token once.
 * `offline` means the refresh could not reach Supabase (no network, server down); the session may
 * still be fine, so the user is not signed out.
 */
async function renewAfterUnauthorized(): Promise<{ token?: string; offline: boolean }> {
  const client = getSupabaseClient();
  if (!client) return { offline: false };
  const { data, error } = await client.auth.refreshSession();
  const token = data.session?.access_token;
  if (token) return { token, offline: false };
  return { offline: error?.name === 'AuthRetryableFetchError' };
}

function messageFromBody(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const msg = (body as { message?: unknown }).message;
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (Array.isArray(msg)) return msg.map(String).join('\n');
  return fallback;
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  accessToken?: string,
): Promise<T> {
  const body = typeof init?.body === 'string' ? toServerUrls(init.body) : init?.body;
  const send = async (auth: Record<string, string>) => {
    const headers = {
      Accept: 'application/json',
      ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...auth,
      ...(init?.headers as Record<string, string> | undefined),
    };
    const res = await fetch(`${APP_CONFIG.apiUrl}${path}`, { ...init, body, headers });
    const text = toDeviceUrls(await res.text());
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { message: text };
      }
    }
    return { res, parsed };
  };

  const auth = await authHeader(accessToken);
  let { res, parsed } = await send(auth.headers);

  if (res.status === 401 && auth.supabase) {
    // The API checks the token before doing anything, so sending the same request again is safe.
    const renewed = await renewAfterUnauthorized();
    if (renewed.token) ({ res, parsed } = await send(bearer(renewed.token)));
    if (res.status === 401 && !renewed.offline) {
      onSessionExpired?.();
      throw new ApiError(messageFromBody(parsed, 'HTTP 401'), 401, SESSION_EXPIRED);
    }
  }

  if (!res.ok) {
    throw new ApiError(messageFromBody(parsed, `HTTP ${res.status}`), res.status, codeFromBody(parsed));
  }
  return parsed as T;
}

export function apiGet<T>(path: string, accessToken?: string): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' }, accessToken);
}

export function apiPost<T>(path: string, body: unknown, accessToken?: string): Promise<T> {
  return apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) }, accessToken);
}

export function apiPatch<T>(path: string, body: unknown, accessToken?: string): Promise<T> {
  return apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, accessToken);
}
