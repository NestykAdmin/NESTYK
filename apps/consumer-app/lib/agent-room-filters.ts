/**
 * Room list rules for the agent web Rooms page (plan step 4, D1 ข: the web page calls the API and keeps its rules here).
 * Same filters and API sorts as the app screen (`components/AgentRoomsScreen.tsx`, frozen); no React, no imports.
 */

export type RoomVisibilityFilter = '' | 'private' | 'published';
/** D8: the status from the deals (the API filters on it). */
export type RoomStatusFilter = '' | 'available' | 'booked' | 'rented' | 'soon_vacant' | 'pending_verification' | 'needs_edit';
export type RoomSourceFilter = '' | 'owner' | 'co_agent';

export type RoomFilters = {
  visibility: RoomVisibilityFilter;
  roomStatus: RoomStatusFilter;
  listingSource: RoomSourceFilter;
  propertyType: string;
  roomType: string;
  bedrooms: string;
  minPrice: string;
  maxPrice: string;
};

export const EMPTY_ROOM_FILTERS: RoomFilters = {
  visibility: '',
  roomStatus: '',
  listingSource: '',
  propertyType: '',
  roomType: '',
  bedrooms: '',
  minPrice: '',
  maxPrice: '',
};

export const ROOM_STATUS_FILTERS: Array<Exclude<RoomStatusFilter, "">> = [
  'available',
  'booked',
  'rented',
  'soon_vacant',
  'pending_verification',
  'needs_edit',
];

/** '0' = studio, '4' = 4 or more (as the app). */
export const BEDROOM_FILTERS = ['0', '1', '2', '3', '4'];

/** Matches master_room_types.bedroom_count; null = flexible (duplex / penthouse). */
export const ROOM_TYPE_BEDROOMS: Record<string, string | null> = {
  studio: '0',
  one_bedroom: '1',
  one_bedroom_plus: '1',
  two_bedroom: '2',
  three_bedroom: '3',
  four_bedroom: '4',
  duplex: null,
  penthouse: null,
};

/** How many filters are on (the price range counts once). */
export function activeFilterCount(filters: RoomFilters): number {
  let count = 0;
  for (const key of ['visibility', 'roomStatus', 'listingSource', 'propertyType', 'roomType', 'bedrooms'] as const) {
    if (filters[key]) count += 1;
  }
  if (filters.minPrice || filters.maxPrice) count += 1;
  return count;
}

/** Choosing a room type also sets its bedroom count (when the type has a fixed one). */
export function withRoomType(filters: RoomFilters, roomType: string): RoomFilters {
  const beds = roomType ? ROOM_TYPE_BEDROOMS[roomType] : undefined;
  return { ...filters, roomType, bedrooms: typeof beds === 'string' ? beds : filters.bedrooms };
}

/** Choosing a bedroom count that does not fit the chosen room type clears the room type. */
export function withBedrooms(filters: RoomFilters, bedrooms: string): RoomFilters {
  const locked = filters.roomType ? ROOM_TYPE_BEDROOMS[filters.roomType] : undefined;
  const conflicts = !!filters.roomType && locked != null && bedrooms !== '' && bedrooms !== locked;
  return { ...filters, bedrooms, roomType: conflicts ? '' : filters.roomType };
}

export type RoomsApiSort = 'updated_desc' | 'updated_asc' | 'price_asc' | 'price_desc';
export type RoomsSortColumn = 'updated' | 'price';
export type RoomsTableSort = { key: RoomsSortColumn; direction: 'asc' | 'desc' };

/** Table header sort → the API's sort. Only price and updated can be sorted by the API. */
export function toApiSort(sort: RoomsTableSort): RoomsApiSort {
  return `${sort.key}_${sort.direction}` as RoomsApiSort;
}

export function fromApiSort(sort: RoomsApiSort): RoomsTableSort {
  const [key, direction] = sort.split('_') as [RoomsSortColumn, 'asc' | 'desc'];
  return { key, direction };
}

/** "Showing 25–36 of 36": 1-based row numbers of a page. {0,0} when there are no rows. */
export function pageRange(page: number, pageSize: number, total: number): { from: number; to: number; pages: number } {
  if (total <= 0) return { from: 0, to: 0, pages: 1 };
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  return { from: (current - 1) * pageSize + 1, to: Math.min(total, current * pageSize), pages };
}

/**
 * Page buttons to show: first, last, the current page and its neighbours; null = a gap ("…").
 * 7 pages or fewer: all of them.
 */
export function pageButtons(page: number, pages: number): Array<number | null> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: Array<number | null> = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
}

/** The rent shown in the list: the lowest price, as the app's room cards. null when the room has no price. */
export function listPrice(prices: Array<{ price: number }>): number | null {
  const valid = prices.map((p) => p.price).filter((n) => Number.isFinite(n) && n > 0);
  return valid.length ? Math.min(...valid) : null;
}

/** D8 status text; "soon vacant (free 1 Nov 2027)" when the day is known (same rule as the app's room cards). */
export function roomStatusText(
  copy: Record<string, unknown> & { soonVacantFrom: string; notSpecified: string },
  code: string | null,
  vacantFrom: string | null | undefined,
  locale: string,
): string {
  const day = vacantFrom && /^\d{4}-\d{2}-\d{2}$/.test(vacantFrom) ? new Date(`${vacantFrom}T00:00:00Z`) : null;
  if (code === 'soon_vacant' && day && !Number.isNaN(day.getTime())) {
    const date = new Intl.DateTimeFormat(locale === 'th' ? 'th-TH' : locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(day);
    return copy.soonVacantFrom.replace('{date}', date);
  }
  const label = code ? copy[code] : undefined;
  return typeof label === 'string' ? label : code || copy.notSpecified;
}
