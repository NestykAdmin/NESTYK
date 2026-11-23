import type { CreateViewingRequestInput, GuestViewingRequest, ViewingRequestErrorCode, ViewingRequestStatus } from '@nestyk/types';

/**
 * Viewing requests on the guest web, browser side (project-docs/nestyk-guest-viewing-request-plan-20261123.md, step 2).
 * The API is /me/viewing-requests (apps/api/src/viewing-requests), reached through this site's /api rewrite, with
 * the Supabase access token of this tab (same as saved rooms, lib/guest-saved.ts). Errors come back as values.
 * Type-only imports: lib/guest-viewing-requests.test.cjs loads this file bare.
 */
export const VIEWING_REQUESTS_URL = '/api/me/viewing-requests';
/** Same as the API (apps/api/src/viewing-requests/viewing-request-rules.ts, Mos D2 23 Nov 2026). */
export const VIEWING_MAX_DATES = 3;
export const VIEWING_MAX_DAYS_AHEAD = 60;
export const VIEWING_OPEN_LIMIT = 10;

const OPEN: ReadonlySet<ViewingRequestStatus> = new Set(['new', 'awaiting_agent', 'agent_handling', 'admin_handling', 'scheduled']);
const E164_PATTERN = /^\+[1-9]\d{6,14}$/;
const ROOM_NOT_FOUND = 'Room not found';

/** What the guest sees (Mos 23 Nov 2026: 5 simple stages; who coordinates stays behind the scenes). */
export type GuestStage = 'sent' | 'coordinating' | 'scheduled' | 'viewed' | 'ended';

export function guestStage(status: ViewingRequestStatus): GuestStage {
  if (status === 'new') return 'sent';
  if (status === 'awaiting_agent' || status === 'agent_handling' || status === 'admin_handling') return 'coordinating';
  if (status === 'scheduled') return 'scheduled';
  if (status === 'viewed') return 'viewed';
  return 'ended';
}

/** Steps done on the 3-step bar (ส่งแล้ว · ประสานงาน · นัดแล้ว); 0 = no bar (cancelled or closed). */
export function progressStep(stage: GuestStage): number {
  return { sent: 1, coordinating: 2, scheduled: 3, viewed: 3, ended: 0 }[stage];
}

export function isOpenRequest(status: ViewingRequestStatus): boolean {
  return OPEN.has(status);
}

export function splitRequests<T extends { status: ViewingRequestStatus }>(list: T[]): { open: T[]; ended: T[] } {
  return { open: list.filter((r) => isOpenRequest(r.status)), ended: list.filter((r) => !isOpenRequest(r.status)) };
}

/** Calendar day plus n days, 'YYYY-MM-DD'. */
function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Today (Bangkok, 'YYYY-MM-DD') and every day up to 60 days ahead. */
export function pickableDays(today: string): string[] {
  return Array.from({ length: VIEWING_MAX_DAYS_AHEAD + 1 }, (_, i) => addDays(today, i));
}

/** Picks or unpicks a day; at most 3, kept in date order. A 4th pick changes nothing. */
export function toggleDay(picked: readonly string[], day: string): string[] {
  if (picked.includes(day)) return picked.filter((d) => d !== day);
  if (picked.length >= VIEWING_MAX_DATES) return [...picked];
  return [...picked, day].sort();
}

export type FormProblem = 'needDate' | 'needPhone' | 'badPhone';

/** Same phone rule as the API: up to 50 characters; a number starting with "+" must be international (E.164). */
export function formProblem(form: { dates: readonly string[]; phone: string }): FormProblem | null {
  if (!form.dates.length) return 'needDate';
  const phone = form.phone.trim();
  if (!phone) return 'needPhone';
  if (phone.length > 50) return 'badPhone';
  if (phone.startsWith('+') && !E164_PATTERN.test(phone.replace(/[\s().-]/g, ''))) return 'badPhone';
  return null;
}

export type SendResult =
  | { kind: 'ok'; request: GuestViewingRequest }
  | { kind: 'exists'; requestId: number | null }
  | { kind: 'limit' | 'ownRoom' | 'gone' | 'signedOut' | 'invalid' | 'failed' };

export function sendResult(status: number, body: unknown): SendResult {
  const fields = body && typeof body === 'object' ? (body as { code?: unknown; message?: unknown; requestId?: unknown }) : {};
  if (status >= 200 && status < 300) {
    return body && typeof body === 'object' && typeof (body as { id?: unknown }).id === 'number'
      ? { kind: 'ok', request: body as GuestViewingRequest }
      : { kind: 'failed' };
  }
  if (status === 401) return { kind: 'signedOut' };
  if (status === 400) return { kind: 'invalid' };
  // Only the API's own answer means the room is gone; a 404 for the route itself (API not deployed) is a failure.
  if (status === 404) return { kind: fields.message === ROOM_NOT_FOUND ? 'gone' : 'failed' };
  if (status === 409) {
    const code = fields.code as ViewingRequestErrorCode | undefined;
    if (code === 'REQUEST_EXISTS') return { kind: 'exists', requestId: typeof fields.requestId === 'number' ? fields.requestId : null };
    if (code === 'REQUEST_LIMIT') return { kind: 'limit' };
    if (code === 'OWN_ROOM') return { kind: 'ownRoom' };
  }
  return { kind: 'failed' };
}

type FetchLike = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

const browserFetch: FetchLike = (url, init) => fetch(url, init);

function requestInit(token: string, method: 'GET' | 'POST', body?: unknown): RequestInit {
  return {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    // Personal answers: never from a cache, and the API needs no cookies (the token is the sign-in).
    cache: 'no-store',
    credentials: 'omit',
  };
}

async function readJson(response: { json: () => Promise<unknown> }): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export async function sendViewingRequest(token: string, input: CreateViewingRequestInput, fetchImpl: FetchLike = browserFetch): Promise<SendResult> {
  try {
    const response = await fetchImpl(VIEWING_REQUESTS_URL, requestInit(token, 'POST', input));
    return sendResult(response.status, await readJson(response));
  } catch {
    return { kind: 'failed' };
  }
}

/** The account's requests, newest first (the API's order), or null when they could not be read. */
export async function fetchMyViewingRequests(token: string, fetchImpl: FetchLike = browserFetch): Promise<GuestViewingRequest[] | null> {
  try {
    const response = await fetchImpl(VIEWING_REQUESTS_URL, requestInit(token, 'GET'));
    if (!response.ok) return null;
    const body = await readJson(response);
    if (!Array.isArray(body)) return null;
    return body.filter(
      (row): row is GuestViewingRequest =>
        !!row && typeof row === 'object' && typeof (row as GuestViewingRequest).id === 'number' && typeof (row as GuestViewingRequest).status === 'string',
    );
  } catch {
    return null;
  }
}

export type CancelResult = 'ok' | 'closed' | 'signedOut' | 'failed';

/** Cancels one of the account's own open requests. 'closed' = it already finished (seen as cancelled or done). */
export async function cancelViewingRequest(token: string, id: number, fetchImpl: FetchLike = browserFetch): Promise<CancelResult> {
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) return 'failed';
  try {
    const response = await fetchImpl(`${VIEWING_REQUESTS_URL}/${id}/cancel`, requestInit(token, 'POST'));
    if (response.ok) return 'ok';
    if (response.status === 401) return 'signedOut';
    if (response.status === 409) return 'closed';
    return 'failed';
  } catch {
    return 'failed';
  }
}
