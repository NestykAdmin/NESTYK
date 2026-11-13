import type { PublicRoomCard, SavedRoomIds, SavedRoomsErrorCode } from '@nestyk/types';

/**
 * Saved rooms of the signed-in account, browser side (AUTH-3, nestyk-auth3-saved-rooms-plan-20261113.md 2.3).
 * The API is /me/saved-rooms (apps/api/src/me), reached through this site's /api rewrite. Each call carries the
 * Supabase access token of this tab; nothing is kept beyond the call. Errors come back as values, never thrown.
 */
export const SAVED_ROOMS_URL = '/api/me/saved-rooms';
export const SAVED_ROOM_IDS_URL = `${SAVED_ROOMS_URL}/ids`;
/** Most rooms one account can save; same as the API (apps/api/src/me/saved-rooms.service.ts, Mos S1). */
export const SAVED_ROOMS_LIMIT = 200;

/** What a heart press did: the button keeps the new state only on "ok". */
export type SavedToggleResult = 'ok' | 'limit' | 'gone' | 'signedOut' | 'failed';

type FetchLike = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

const ROOM_ID = /^[1-9]\d{0,9}$/;
const LIMIT_CODE: SavedRoomsErrorCode = 'SAVED_ROOMS_LIMIT';
/** Message of the API's 404 (apps/api/src/me/saved-rooms.service.ts). */
const ROOM_NOT_FOUND = 'Room not found';
const MAX_ROOM_ID = 2147483647;

/** Same rule as the API (parseSavedRoomId): a positive whole number that fits a Postgres integer. */
export function isSavedRoomId(value: unknown): value is string {
  return typeof value === 'string' && ROOM_ID.test(value) && Number(value) <= MAX_ROOM_ID;
}

export function savedRoomUrl(roomId: string): string {
  if (!isSavedRoomId(roomId)) throw new Error(`Invalid room id: ${String(roomId)}`);
  return `${SAVED_ROOMS_URL}/${roomId}`;
}

export function parseSavedIds(body: unknown): string[] {
  const ids = body && typeof body === 'object' ? (body as Partial<Record<keyof SavedRoomIds, unknown>>).ids : null;
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter(isSavedRoomId))];
}

export function toggleResult(status: number, body: unknown): SavedToggleResult {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 401) return 'signedOut';
  const fields = body && typeof body === 'object' ? (body as { code?: unknown; message?: unknown }) : {};
  // Only the API's own answer means the room is gone; a 404 for the route itself (API not deployed) is a failure.
  if (status === 404) return fields.message === ROOM_NOT_FOUND ? 'gone' : 'failed';
  if (status === 409 && fields.code === LIMIT_CODE) return 'limit';
  return 'failed';
}

/** A new set with the room saved or not; the same set when nothing changes. */
export function withSaved(ids: ReadonlySet<string>, roomId: string, isSaved: boolean): ReadonlySet<string> {
  if (ids.has(roomId) === isSaved) return ids;
  const next = new Set(ids);
  if (isSaved) next.add(roomId);
  else next.delete(roomId);
  return next;
}

function requestInit(token: string, method: 'GET' | 'PUT' | 'DELETE', signal?: AbortSignal): RequestInit {
  return {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    // Personal answers: never from a cache, and the API needs no cookies (the token is the sign-in).
    cache: 'no-store',
    credentials: 'omit',
    signal,
  };
}

async function readJson(response: { json: () => Promise<unknown> }): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

const browserFetch: FetchLike = (url, init) => fetch(url, init);

/** Ids of the saved rooms that are still public, or null when they could not be read. */
export async function fetchSavedIds(token: string, fetchImpl: FetchLike = browserFetch, signal?: AbortSignal): Promise<string[] | null> {
  try {
    const response = await fetchImpl(SAVED_ROOM_IDS_URL, requestInit(token, 'GET', signal));
    if (!response.ok) return null;
    return parseSavedIds(await readJson(response));
  } catch {
    return null;
  }
}

/** Cards of the saved rooms, newest first (the API's order), or null when they could not be read. */
export async function fetchSavedRooms(
  token: string,
  fetchImpl: FetchLike = browserFetch,
  signal?: AbortSignal,
): Promise<PublicRoomCard[] | null> {
  try {
    const response = await fetchImpl(SAVED_ROOMS_URL, requestInit(token, 'GET', signal));
    if (!response.ok) return null;
    const body = await readJson(response);
    if (!Array.isArray(body)) return null;
    return body.filter((card): card is PublicRoomCard => !!card && typeof card === 'object' && isSavedRoomId((card as PublicRoomCard).id));
  } catch {
    return null;
  }
}

/** Save (PUT) or unsave (DELETE) one room. Both are safe to repeat. */
export async function setRoomSaved(
  token: string,
  roomId: string,
  isSaved: boolean,
  fetchImpl: FetchLike = browserFetch,
): Promise<SavedToggleResult> {
  if (!isSavedRoomId(roomId)) return 'failed';
  try {
    const response = await fetchImpl(savedRoomUrl(roomId), requestInit(token, isSaved ? 'PUT' : 'DELETE'));
    return toggleResult(response.status, response.ok ? undefined : await readJson(response));
  } catch {
    return 'failed';
  }
}
