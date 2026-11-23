import { NextResponse } from 'next/server';
import {
  autocompleteBody,
  callerOf,
  createRateLimit,
  isSameSite,
  PLACE_RATE_LIMIT,
  PLACES_AUTOCOMPLETE_URL,
  PLACES_TIMEOUT_MS,
  readAutocompleteInput,
  readSuggestions,
} from '../../../lib/guest-places';

const allow = createRateLimit(PLACE_RATE_LIMIT);
const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Place suggestions for the keyword box (location search, Mos 20 Nov 2026). POST { input, session, lang } →
 * { places: [{ id, name, secondary, station }] }. 503 when this deploy has no Places key: the box then hides the group.
 */
export async function POST(request: Request) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return NextResponse.json({ error: 'disabled' }, { status: 503, headers: NO_STORE });
  if (!isSameSite(request.headers)) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: NO_STORE });
  if (!allow(callerOf(request.headers))) return NextResponse.json({ error: 'busy' }, { status: 429, headers: NO_STORE });
  const input = readAutocompleteInput(await request.json().catch(() => null));
  if (!input) return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: NO_STORE });
  try {
    const response = await fetch(PLACES_AUTOCOMPLETE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
      body: JSON.stringify(autocompleteBody(input)),
      signal: AbortSignal.timeout(PLACES_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!response.ok) {
      console.error('[place-search] autocomplete failed:', response.status);
      return NextResponse.json({ error: 'upstream' }, { status: 502, headers: NO_STORE });
    }
    return NextResponse.json({ places: readSuggestions(await response.json()) }, { headers: NO_STORE });
  } catch (error) {
    console.error('[place-search] autocomplete failed:', error);
    return NextResponse.json({ error: 'upstream' }, { status: 502, headers: NO_STORE });
  }
}
