import type { CreateViewingRequestInput, GuestViewingRequest, ViewingRequestErrorCode, ViewingRequestStatus } from '@nestyk/types';

/**
 * Viewing requests on the guest web, browser side (project-docs/nestyk-guest-viewing-request-plan-20261123.md, step 2).
 * The API is /me/viewing-requests (apps/api/src/viewing-requests), reached through this site's /api rewrite, with
 * the Supabase access token of this tab (same as saved rooms, lib/guest-saved.ts). Errors come back as values.
 * Type-only imports: lib/guest-viewing-requests.test.cjs loads this file bare.
 */
export const VIEWING_REQUESTS_URL = '/api/me/viewing-requests';
/**
 * Same as the API (apps/api/src/viewing-requests/viewing-request-rules.ts; Mos D2 and form E, 23 Nov 2026):
 * one day from tomorrow up to 60 days ahead, a time 08:00–20:00 Bangkok every 30 minutes, 10 open requests.
 */
export const VIEWING_MIN_DAYS_AHEAD = 1;
export const VIEWING_MAX_DAYS_AHEAD = 60;
export const VIEWING_OPEN_LIMIT = 10;
export const VIEWING_STRIP_DAYS = 7;
const FIRST_MINUTE = 8 * 60;
const LAST_MINUTE = 20 * 60;
const STEP_MINUTES = 30;

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

/** The 7 days shown first: tomorrow onwards (no viewing today). */
export function stripDays(today: string): string[] {
  return Array.from({ length: VIEWING_STRIP_DAYS }, (_, i) => addDays(today, VIEWING_MIN_DAYS_AHEAD + i));
}

export function lastPickableDay(today: string): string {
  return addDays(today, VIEWING_MAX_DAYS_AHEAD);
}

export function isPickableDay(today: string, day: string): boolean {
  return day >= addDays(today, VIEWING_MIN_DAYS_AHEAD) && day <= lastPickableDay(today);
}

/** 'YYYY-MM' of every month that holds a pickable day, in order. */
export function calendarMonths(today: string): string[] {
  const first = addDays(today, VIEWING_MIN_DAYS_AHEAD).slice(0, 7);
  const last = lastPickableDay(today).slice(0, 7);
  const months: string[] = [];
  for (let month = first; month <= last; month = addDays(`${month}-01`, 32).slice(0, 7)) months.push(month);
  return months;
}

/** One month for the calendar: a blank (null) for each weekday before the 1st (weeks start on Sunday), then every day. */
export function monthGrid(month: string): (string | null)[] {
  const [y, m] = month.split('-').map(Number);
  const blanks = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const length = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [
    ...Array.from({ length: blanks }, () => null),
    ...Array.from({ length }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ];
}

export type ViewingPeriod = 'morning' | 'afternoon' | 'evening';
export const VIEWING_PERIODS: readonly ViewingPeriod[] = ['morning', 'afternoon', 'evening'];

function clock(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

/** Every time a guest can pick, 'HH:MM': 08:00, 08:30 … 20:00. */
export function viewingTimes(): string[] {
  const times: string[] = [];
  for (let minute = FIRST_MINUTE; minute <= LAST_MINUTE; minute += STEP_MINUTES) times.push(clock(minute));
  return times;
}

export function periodOf(time: string): ViewingPeriod {
  if (time < '12:00') return 'morning';
  if (time < '17:00') return 'afternoon';
  return 'evening';
}

export function timesOf(period: ViewingPeriod): string[] {
  return viewingTimes().filter((time) => periodOf(time) === period);
}

/** "08:00–11:30" under a tab. */
export function periodRange(period: ViewingPeriod): string {
  const times = timesOf(period);
  return `${times[0]}–${times[times.length - 1]}`;
}

/** The moment sent to the API: the Bangkok day and time with its offset, so no device zone can shift it. */
export function preferredAt(day: string, time: string): string {
  return `${day}T${time}:00+07:00`;
}

export type FormProblem = 'needDate' | 'needTime' | 'needPhone' | 'badPhone';

/** Same phone rule as the API: up to 50 characters; a number starting with "+" must be international (E.164). */
export function formProblem(form: { day: string | null; time: string | null; phone: string }): FormProblem | null {
  if (!form.day) return 'needDate';
  if (!form.time) return 'needTime';
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
