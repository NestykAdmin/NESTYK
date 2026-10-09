import { APP_CONFIG, toDeviceUrls, toServerUrls } from './config';
import { getOrCreateDevIdentity, toDevBearer } from './dev-identity';
import { loadAuthSession } from './auth/session-storage';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function authHeader(overrideToken?: string): Promise<Record<string, string>> {
  if (overrideToken) {
    return { Authorization: `Bearer ${overrideToken}` };
  }
  const session = await loadAuthSession();
  if (session?.accessToken) {
    return { Authorization: `Bearer ${session.accessToken}` };
  }
  const identity = await getOrCreateDevIdentity();
  return { Authorization: `Bearer ${toDevBearer(identity)}` };
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
  const headers = {
    Accept: 'application/json',
    ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(await authHeader(accessToken)),
    ...(init?.headers as Record<string, string> | undefined),
  };

  const body = typeof init?.body === 'string' ? toServerUrls(init.body) : init?.body;
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

  if (!res.ok) {
    throw new ApiError(messageFromBody(parsed, `HTTP ${res.status}`), res.status);
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
