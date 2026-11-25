import type { AdminViewingRequest, ViewingRequestStatus } from '@nestyk/types';

/**
 * Admin web: the viewing request queue (project-docs/nestyk-guest-viewing-request-plan-20261123.md step 3; Mos picked
 * 24 Nov 2026: split view, the existing admin API with counting and search done on the web, a menu item with a count).
 * Pure rules only (type imports), so lib/admin-viewing-requests.test.cjs loads this file bare.
 * The buttons follow the API's state table (apps/api/src/viewing-requests/viewing-request-rules.ts decide()).
 */
export type AdminVrTab = 'new' | 'waiting' | 'handling' | 'scheduled' | 'ended';
export const ADMIN_VR_TABS: readonly AdminVrTab[] = ['new', 'waiting', 'handling', 'scheduled', 'ended'];

export type AdminVrAction = 'forward' | 'take' | 'schedule' | 'reschedule' | 'viewed' | 'cancel' | 'close';

/** The API keeps close reasons up to this many characters (validateReason). */
export const ADMIN_VR_REASON_MAX = 500;

const TAB_OF: Record<ViewingRequestStatus, AdminVrTab> = {
  new: 'new',
  awaiting_agent: 'waiting',
  agent_handling: 'handling',
  admin_handling: 'handling',
  scheduled: 'scheduled',
  viewed: 'ended',
  cancelled: 'ended',
  closed: 'ended',
};

export function tabOf(status: ViewingRequestStatus): AdminVrTab {
  return TAB_OF[status];
}

export function countByTab(list: readonly Pick<AdminViewingRequest, 'status'>[]): Record<AdminVrTab, number> {
  const counts: Record<AdminVrTab, number> = { new: 0, waiting: 0, handling: 0, scheduled: 0, ended: 0 };
  for (const request of list) counts[tabOf(request.status)] += 1;
  return counts;
}

export type AdminVrGroup = 'open' | 'ended';

/**
 * The queue loads open requests (the API's default `status=open`) and the ended ones only on the Ended tab, so ended
 * requests never push open ones past the API's 200-row cap (review R1, 24 Nov 2026).
 */
export function groupOf(status: ViewingRequestStatus): AdminVrGroup {
  return tabOf(status) === 'ended' ? 'ended' : 'open';
}

function newestFirst(a: Pick<AdminViewingRequest, 'id' | 'createdAt'>, b: Pick<AdminViewingRequest, 'id' | 'createdAt'>): number {
  const byTime = Date.parse(b.createdAt) - Date.parse(a.createdAt);
  return byTime !== 0 ? byTime : b.id - a.id;
}

/** Puts these requests in the list (an action's result, a fresh load), replacing the same ids; newest first. */
export function mergeRequests<T extends AdminViewingRequest>(list: readonly T[], incoming: readonly T[]): T[] {
  const ids = new Set(incoming.map((request) => request.id));
  return [...list.filter((request) => !ids.has(request.id)), ...incoming].sort(newestFirst);
}

/** A fresh load of one group: drops the old rows of that group, keeps the other group, then adds the fresh rows. */
export function replaceGroup<T extends AdminViewingRequest>(list: readonly T[], fresh: readonly T[], group: AdminVrGroup): T[] {
  return mergeRequests(
    list.filter((request) => groupOf(request.status) !== group),
    fresh,
  );
}

export type AdminVrEventKind = 'created' | 'status' | 'reschedule' | 'note';

/**
 * How a timeline row reads. A reschedule writes scheduled to scheduled with no note (review R5); a note keeps the
 * status. A reschedule sent with a note reads as a note: the event has no field that tells them apart yet.
 */
export function eventKind(event: { fromStatus: ViewingRequestStatus | null; toStatus: ViewingRequestStatus; note: string | null }): AdminVrEventKind {
  if (event.fromStatus == null) return 'created';
  if (event.fromStatus !== event.toStatus) return 'status';
  return event.toStatus === 'scheduled' && event.note == null ? 'reschedule' : 'note';
}

export function requestCode(id: number): string {
  return `VR-${id}`;
}

const digits = (value: string) => value.replace(/\D/g, '');

function matches(request: AdminViewingRequest, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const text = [request.contact.name, request.contact.phone, request.contact.email ?? '', request.room.title, request.room.number ?? '', requestCode(request.id)]
    .join(' ')
    .toLowerCase();
  if (text.includes(q)) return true;
  // A phone typed with other spacing or dashes: compare digits only, when the query has no letters.
  const qDigits = digits(q);
  return !/[a-z฀-๿]/i.test(q) && qDigits.length >= 3 && digits(request.contact.phone).includes(qDigits);
}

/** The requests of one tab that match the search box, in the API's order (newest first). */
export function filterRequests<T extends AdminViewingRequest>(list: readonly T[], tab: AdminVrTab, query: string): T[] {
  return list.filter((request) => tabOf(request.status) === tab && matches(request, query));
}

/** Keeps the selected request when it is still listed, else the first one in the list (or none). */
export function pickSelection(list: readonly AdminViewingRequest[], tab: AdminVrTab, query: string, currentId: number | null): number | null {
  const shown = filterRequests(list, tab, query);
  if (currentId != null && shown.some((request) => request.id === currentId)) return currentId;
  return shown[0]?.id ?? null;
}

const OPEN: ReadonlySet<ViewingRequestStatus> = new Set(['new', 'awaiting_agent', 'agent_handling', 'admin_handling', 'scheduled']);

/** What admin can do now. `primary` moves the request on; `secondary` ends it (cancel, close). */
export function actionsFor(request: Pick<AdminViewingRequest, 'status' | 'handledBy' | 'isAgentRoom'>): {
  primary: AdminVrAction[];
  secondary: AdminVrAction[];
} {
  const primary: AdminVrAction[] = [];
  switch (request.status) {
    case 'new':
      if (request.isAgentRoom) primary.push('forward');
      primary.push('take');
      break;
    case 'awaiting_agent':
      primary.push('take');
      break;
    case 'admin_handling':
      primary.push('schedule');
      break;
    case 'scheduled':
      if (request.handledBy === 'admin') primary.push('viewed', 'reschedule');
      break;
    default:
      break;
  }
  return { primary, secondary: OPEN.has(request.status) ? ['cancel', 'close'] : [] };
}

/** The booked time sent to the API: Bangkok day and time with the offset, so no device zone can shift it. */
export function scheduleIso(day: string, time: string): string {
  return `${day}T${time}:00+07:00`;
}

export type ScheduleProblem = 'needTime' | 'past';

export function scheduleProblem(day: string, time: string, now: number): ScheduleProblem | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) return 'needTime';
  const at = Date.parse(scheduleIso(day, time));
  if (Number.isNaN(at)) return 'needTime';
  return at < now ? 'past' : null;
}

/** The reason sent when closing: the picked reason, then the typed detail; "other" stands on the detail alone. */
export function closeReasonText(label: string, detail: string, isOther: boolean): string | null {
  const extra = detail.trim();
  const text = isOther ? extra : [label.trim(), extra].filter(Boolean).join(' · ');
  if (!text) return null;
  return text.slice(0, ADMIN_VR_REASON_MAX);
}
