import type { PropertyType, PublicFeaturedRail, PublicRoomCard } from '@nestyk/types';
import { criteriaToSearchParams, GUEST_QUICK_FILTERS, type GuestQuickFilter } from '@nestyk/feature-search';
import { formatStationDistance } from '@nestyk/feature-listing/public';

/**
 * Home page rules (S4.1, design v2.3 HomeWebV23 / MobileHomeV23). Pure helpers: lib/guest-home.test.cjs loads this
 * file bare, so no React, Next or env reads except publicApiBase's default argument.
 */

/** The three lists of "ประกาศแนะนำสำหรับคุณ", in tab order. */
export const HOME_RAILS: readonly PublicFeaturedRail[] = ['recommended', 'near_transit', 'new'];
export const HOME_RAIL_LIMIT = 8;
export const HOME_PROPERTY_TYPES: readonly PropertyType[] = ['condo', 'apartment', 'house', 'townhome'];

/** Bedroom choices of the search box. The search reads 3 as "3 or more". */
export const BEDROOM_CHOICES: readonly { id: string; beds: number[] }[] = [
  { id: 'studio', beds: [0] },
  { id: 'one', beds: [1] },
  { id: 'two', beds: [2] },
  { id: 'threePlus', beds: [3] },
];

export interface HomeSearchInput {
  keyword?: string;
  type?: string;
  /** Monthly rent bounds from the price slider (THB); a missing end means no limit. */
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: string;
  quick?: readonly string[];
}

/** "/search?…" for the home search box. Values outside the lists above are dropped. */
export function homeSearchHref(input: HomeSearchInput): string {
  const bound = (value: number | undefined) =>
    value !== undefined && Number.isFinite(value) && value > 0 ? Math.round(value) : undefined;
  const bedrooms = BEDROOM_CHOICES.find((choice) => choice.id === input.bedrooms);
  const type = HOME_PROPERTY_TYPES.find((value) => value === input.type);
  const quick = (input.quick ?? []).filter((code): code is GuestQuickFilter =>
    (GUEST_QUICK_FILTERS as readonly string[]).includes(code),
  );
  const params = criteriaToSearchParams({
    keyword: input.keyword?.trim() || undefined,
    propertyType: type ? [type] : undefined,
    minPrice: bound(input.minPrice),
    maxPrice: bound(input.maxPrice),
    bedrooms: bedrooms?.beds,
    quick,
  });
  const query = params.toString();
  return query ? `/search?${query}` : '/search';
}

export interface RoomTitleLabels {
  titleFallback: string;
  roomFallback: string;
  propertyType: Record<PropertyType, string>;
}

/**
 * The card title. The public headline when the agent wrote one; otherwise "<project or type> · <rooms>" in the
 * reader's language (Mos 11 Nov 2026, H6). The agent's own listing name is never sent by the API.
 */
export function roomDisplayTitle(
  card: Pick<PublicRoomCard, 'title' | 'projectName' | 'propertyType'>,
  labels: RoomTitleLabels,
  roomsText: string | null,
): string {
  const headline = card.title?.trim();
  if (headline) return headline;
  const name = card.projectName?.trim() || (card.propertyType ? labels.propertyType[card.propertyType] : '') || labels.roomFallback;
  return roomsText ? labels.titleFallback.replace('{name}', name).replace('{rooms}', roomsText) : name;
}

/** "วัฒนา · BTS Asok 250 m" (district and nearest station, whichever is known). */
export function roomLocationLine(card: Pick<PublicRoomCard, 'district' | 'nearestStation'>): string | null {
  const parts: string[] = [];
  if (card.district) parts.push(card.district);
  const station = card.nearestStation;
  if (station) {
    const distance = formatStationDistance(station.distanceMeters);
    parts.push([station.type, station.name, distance].filter(Boolean).join(' '));
  }
  return parts.length ? parts.join(' · ') : null;
}

const LOCAL_API = 'http://localhost:4000';

/** Base of the public API for server-side calls: API_URL (the same value next.config uses for /api) + /api/v1. */
export function publicApiBase(value: string | undefined = process.env.API_URL): string {
  const text = (value ?? '').trim();
  let origin = LOCAL_API;
  if (/^https?:\/\//i.test(text)) {
    try {
      origin = new URL(text).origin;
    } catch {
      origin = LOCAL_API;
    }
  }
  return `${origin}/api/v1`;
}

/**
 * Link to /search, or null while the search page is not built (R4, Mos 11 Nov 2026). Callers pass
 * isGuestPageReady('search') so the links open by themselves when S4.2 turns the page on.
 */
export function searchHrefIfReady(params: Parameters<typeof homeSearchHref>[0], ready: boolean): string | null {
  return ready ? homeSearchHref(params) : null;
}

const BANGKOK_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Today in Bangkok as YYYY-MM-DD, for "พร้อมเข้าอยู่" (R5: the server clock is UTC). */
export function bangkokToday(now: Date = new Date()): string {
  return BANGKOK_DATE.format(now);
}

/** A slow public API must not hold the page: give up after this long and show the section error (R3). */
export const PUBLIC_API_TIMEOUT_MS = 8000;

/**
 * True when the home page should throw so Next keeps the last good page (R3). Throwing during a background
 * revalidation keeps the cached page and tries again on the next visit. At build time and in dev the page
 * renders with the section error instead, so a build never fails because the API is down.
 */
export function keepPreviousHomePage(input: {
  railsFailed: boolean;
  areasFailed: boolean;
  nodeEnv: string | undefined;
  nextPhase: string | undefined;
}): boolean {
  if (!input.railsFailed && !input.areasFailed) return false;
  return input.nodeEnv === 'production' && input.nextPhase !== 'phase-production-build';
}

/** True when a production server has no usable API_URL (it would quietly call localhost). */
export function apiUrlMissing(value: string | undefined, nodeEnv: string | undefined): boolean {
  if (nodeEnv !== 'production') return false;
  return !/^https?:\/\//i.test((value ?? '').trim());
}
