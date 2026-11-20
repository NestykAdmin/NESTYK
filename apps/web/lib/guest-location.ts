import type { GuestSearchCriteria } from '@nestyk/feature-search';

/**
 * Location search (Mos 20 Nov 2026): the keyword box on the home page and the search page suggests "near me", the
 * areas whose name or places match what was typed, and the text itself as a free keyword. Areas come from the copy
 * (guest.areaNames, guest.areaInfo) in the page's language, so no API call is needed while typing.
 * Pure helpers: lib/guest-location.test.cjs loads this file bare.
 */

/** Areas shown for an empty box, and the most areas shown for a typed text. */
export const LOCATION_POPULAR_LIMIT = 5;
/** "Near me" searches this far around the person (the API's own default radius). */
export const NEAR_ME_RADIUS_KM = 5;
/** A picked place (Mos 20 Nov 2026): a rail station 1.5 km (walk or motorbike taxi), any other place 3 km. */
export const STATION_RADIUS_KM = 1.5;
export const PLACE_RADIUS_KM = 3;
/** About 100 m: the person's position is rounded before it goes into the URL, which can be shared or kept in history. */
const NEAR_ME_DECIMALS = 3;
/** About 10 m: a place's position is public, so it keeps more detail. */
const PLACE_DECIMALS = 4;
/** Google place types that mean a rail station (bus stops are not counted, as for a room's nearest station). */
const STATION_TYPES = ['subway_station', 'train_station', 'light_rail_station'];

export interface LocationArea {
  slug: string;
  name: string;
  places: string;
}

export type LocationSuggestion = { kind: 'nearMe' } | ({ kind: 'area' } & LocationArea) | { kind: 'keyword'; text: string };

export type LocationChoice =
  | { kind: 'area'; slug: string }
  | { kind: 'keyword'; text: string }
  | { kind: 'nearMe'; latitude: number; longitude: number }
  | { kind: 'place'; name: string; latitude: number; longitude: number; station: boolean };

export function isStationType(types: readonly string[] | undefined): boolean {
  return !!types?.some((type) => STATION_TYPES.includes(type));
}

/** Every area in the copy order (Bangkok first, then the province zones), with its places text. */
export function locationAreas(names: Record<string, string>, info: Record<string, { places?: string } | undefined>): LocationArea[] {
  return Object.keys(names).map((slug) => ({ slug, name: names[slug], places: info[slug]?.places ?? '' }));
}

/** Lower case without spaces, dashes, dots, middle dots or ฯ, so "รัชดา" finds "รัชดาฯ – พระราม 9". */
function folded(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/[\s\-–—·.,ฯ()]/g, '');
}

/** 0 = name starts with it, 1 = name has it, 2 = a place starts with it, 3 = places have it; null = no match. */
function rank(area: LocationArea, needle: string): number | null {
  const name = folded(area.name);
  if (name.startsWith(needle)) return 0;
  if (name.includes(needle)) return 1;
  const places = area.places.split('·').map(folded);
  if (places.some((place) => place.startsWith(needle))) return 2;
  if (places.some((place) => place.includes(needle))) return 3;
  return null;
}

export function locationSuggestions(query: string, areas: readonly LocationArea[]): LocationSuggestion[] {
  const text = query.trim();
  const needle = folded(text);
  if (!needle) {
    return [{ kind: 'nearMe' }, ...areas.slice(0, LOCATION_POPULAR_LIMIT).map((area) => ({ kind: 'area' as const, ...area }))];
  }
  const matches = areas
    .map((area, index) => ({ area, index, rank: rank(area, needle) }))
    .filter((item): item is { area: LocationArea; index: number; rank: number } => item.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, LOCATION_POPULAR_LIMIT)
    .map(({ area }) => ({ kind: 'area' as const, ...area }));
  return [{ kind: 'nearMe' }, ...matches, { kind: 'keyword', text }];
}

function rounded(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * The search change for a choice. An area or "near me" replaces the place and the text typed to find it; a keyword
 * only sets the keyword, so it narrows a place already chosen (each shows as its own chip on /search).
 */
export function locationPatch(choice: LocationChoice): Partial<Pick<GuestSearchCriteria, 'area' | 'keyword' | 'nearGps' | 'placeName'>> {
  if (choice.kind === 'area') return { area: choice.slug, keyword: undefined, nearGps: undefined, placeName: undefined };
  if (choice.kind === 'nearMe') {
    return {
      nearGps: {
        latitude: rounded(choice.latitude, NEAR_ME_DECIMALS),
        longitude: rounded(choice.longitude, NEAR_ME_DECIMALS),
        radiusKm: NEAR_ME_RADIUS_KM,
      },
      placeName: undefined,
      keyword: undefined,
      area: undefined,
    };
  }
  if (choice.kind === 'place') {
    return {
      nearGps: {
        latitude: rounded(choice.latitude, PLACE_DECIMALS),
        longitude: rounded(choice.longitude, PLACE_DECIMALS),
        radiusKm: choice.station ? STATION_RADIUS_KM : PLACE_RADIUS_KM,
      },
      placeName: choice.name.trim().slice(0, 80) || undefined,
      keyword: undefined,
      area: undefined,
    };
  }
  return { keyword: choice.text.trim().slice(0, 100) || undefined };
}
