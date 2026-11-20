/**
 * Place search (Mos 20 Nov 2026): the keyword box asks Google Places API (New) through this site's own routes
 * (app/place-search/*), so the key (GOOGLE_PLACES_API_KEY) stays on the server and the browser loads nothing from
 * Google. Autocomplete and the closing Place Details call share one session token, which is how Google bills a search.
 * Place Details asks only for Essentials fields (location, types).
 * Pure helpers: lib/guest-places.test.cjs loads this file bare.
 */

export const PLACE_SUGGESTION_LIMIT = 5;
export const PLACE_INPUT_MIN = 2;
export const PLACE_INPUT_MAX = 60;
export const DETAILS_FIELD_MASK = 'location,types';
/** Per caller and server instance; the daily cap in Google Cloud is the real ceiling. */
export const PLACE_RATE_LIMIT = { max: 60, windowMs: 60000 } as const;
export const PLACES_AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
export const PLACES_DETAILS_URL = 'https://places.googleapis.com/v1/places/';
export const PLACES_TIMEOUT_MS = 5000;

const LANGS = ['th', 'en', 'ja', 'zh'] as const;
type Lang = (typeof LANGS)[number];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLACE_ID = /^[A-Za-z0-9_-]{4,300}$/;
/** Bangkok: results lean here, but other provinces still come up (Thailand only). */
const BANGKOK = { latitude: 13.7563, longitude: 100.5018 };
const BIAS_RADIUS_M = 50000;
const STATION_TYPES = ['subway_station', 'train_station', 'light_rail_station'];

export interface AutocompleteInput {
  input: string;
  session: string;
  lang: Lang;
}

export interface PlaceSuggestion {
  id: string;
  name: string;
  secondary: string;
  station: boolean;
}

export interface PlaceLocation {
  latitude: number;
  longitude: number;
  station: boolean;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string {
  const box = record(value);
  return typeof box?.text === 'string' ? box.text : '';
}

function isStation(types: unknown): boolean {
  return Array.isArray(types) && types.some((type) => typeof type === 'string' && STATION_TYPES.includes(type));
}

export function readAutocompleteInput(body: unknown): AutocompleteInput | null {
  const data = record(body);
  if (!data || typeof data.input !== 'string' || typeof data.session !== 'string') return null;
  const input = data.input.trim();
  if (input.length < PLACE_INPUT_MIN || input.length > PLACE_INPUT_MAX || !UUID.test(data.session)) return null;
  const lang = LANGS.find((code) => code === data.lang) ?? 'th';
  return { input, session: data.session, lang };
}

export function readDetailsInput(body: unknown): { id: string; session: string } | null {
  const data = record(body);
  if (!data || typeof data.id !== 'string' || typeof data.session !== 'string') return null;
  if (!PLACE_ID.test(data.id) || !UUID.test(data.session)) return null;
  return { id: data.id, session: data.session };
}

/** Body of POST places:autocomplete. */
export function autocompleteBody({ input, session, lang }: AutocompleteInput) {
  return {
    input,
    sessionToken: session,
    languageCode: lang,
    includedRegionCodes: ['th'],
    locationBias: { circle: { center: BANGKOK, radius: BIAS_RADIUS_M } },
  };
}

/** Place predictions only (query predictions are not places), at most five. */
export function readSuggestions(answer: unknown): PlaceSuggestion[] {
  const list = record(answer)?.suggestions;
  if (!Array.isArray(list)) return [];
  const out: PlaceSuggestion[] = [];
  for (const item of list) {
    const prediction = record(record(item)?.placePrediction);
    const id = prediction?.placeId;
    if (!prediction || typeof id !== 'string' || !PLACE_ID.test(id)) continue;
    const format = record(prediction.structuredFormat);
    const name = text(format?.mainText) || text(prediction.text);
    if (!name) continue;
    out.push({ id, name, secondary: text(format?.secondaryText), station: isStation(prediction.types) });
    if (out.length >= PLACE_SUGGESTION_LIMIT) break;
  }
  return out;
}

export function readDetails(answer: unknown): PlaceLocation | null {
  const location = record(record(answer)?.location);
  const latitude = location?.latitude;
  const longitude = location?.longitude;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude, station: isStation(record(answer)?.types) };
}

/** True when the request comes from a page of this site (Origin matches Host, or the browser says same-origin). */
export function isSameSite(headers: { get(name: string): string | null }): boolean {
  const host = headers.get('host');
  const origin = headers.get('origin');
  if (origin && host) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return headers.get('sec-fetch-site') === 'same-origin';
}

/** Fixed-window counter per caller. Returns false once the caller is over the limit in this window. */
export function createRateLimit({ max, windowMs }: { max: number; windowMs: number }) {
  const windows = new Map<string, { start: number; count: number }>();
  return (caller: string, now: number = Date.now()): boolean => {
    const current = windows.get(caller);
    if (!current || now - current.start >= windowMs) {
      if (windows.size > 10000) windows.clear();
      windows.set(caller, { start: now, count: 1 });
      return true;
    }
    current.count += 1;
    return current.count <= max;
  };
}

/** Caller key for the rate limit: the first address in X-Forwarded-For (Vercel sets it), else one shared key. */
export function callerOf(headers: { get(name: string): string | null }): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}
