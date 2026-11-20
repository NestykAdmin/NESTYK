import { NextResponse } from 'next/server';
import {
  callerOf,
  createRateLimit,
  DETAILS_FIELD_MASK,
  isSameSite,
  PLACE_RATE_LIMIT,
  PLACES_DETAILS_URL,
  PLACES_TIMEOUT_MS,
  readDetails,
  readDetailsInput,
} from '../../../lib/guest-places';

const allow = createRateLimit(PLACE_RATE_LIMIT);
const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Position of a picked place (location search, Mos 20 Nov 2026). POST { id, session } → { latitude, longitude,
 * station }. Ends the Google session; asks only for Essentials fields. 503 when this deploy has no Places key.
 */
export async function POST(request: Request) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return NextResponse.json({ error: 'disabled' }, { status: 503, headers: NO_STORE });
  if (!isSameSite(request.headers)) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: NO_STORE });
  if (!allow(callerOf(request.headers))) return NextResponse.json({ error: 'busy' }, { status: 429, headers: NO_STORE });
  const input = readDetailsInput(await request.json().catch(() => null));
  if (!input) return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: NO_STORE });
  try {
    const url = `${PLACES_DETAILS_URL}${encodeURIComponent(input.id)}?sessionToken=${encodeURIComponent(input.session)}`;
    const response = await fetch(url, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': DETAILS_FIELD_MASK },
      signal: AbortSignal.timeout(PLACES_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!response.ok) {
      console.error('[place-search] details failed:', response.status);
      return NextResponse.json({ error: 'upstream' }, { status: 502, headers: NO_STORE });
    }
    const place = readDetails(await response.json());
    if (!place) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
    return NextResponse.json(place, { headers: NO_STORE });
  } catch (error) {
    console.error('[place-search] details failed:', error);
    return NextResponse.json({ error: 'upstream' }, { status: 502, headers: NO_STORE });
  }
}
