// Place search (Mos 20 Nov 2026): the keyword box asks Google Places (New) through this site's own routes
// (/place-search/...), so the key stays on the server. These are the pure parts: input checks, the requests sent to
// Google, reading its answers, and the guards (same site, rate limit).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);

const places = require('./guest-places.ts');
const SESSION = '3f2b8c1e-9a4d-4e2f-8b1c-5d6e7f8a9b0c';

test('only short real text, a known language and a UUID session go to Google', () => {
  assert.deepEqual(places.readAutocompleteInput({ input: '  Central World ', session: SESSION, lang: 'en' }), { input: 'Central World', session: SESSION, lang: 'en' });
  assert.equal(places.readAutocompleteInput({ input: 'a', session: SESSION, lang: 'th' }), null, 'one letter is too short');
  assert.equal(places.readAutocompleteInput({ input: 'x'.repeat(61), session: SESSION, lang: 'th' }), null);
  assert.equal(places.readAutocompleteInput({ input: 'Asok', session: 'abc', lang: 'th' }), null);
  assert.equal(places.readAutocompleteInput({ input: 'Asok', session: SESSION, lang: 'fr' }).lang, 'th', 'unknown language falls back to Thai');
  assert.equal(places.readAutocompleteInput(null), null);
  assert.deepEqual(places.readDetailsInput({ id: 'ChIJ_abc-123XYZ', session: SESSION }), { id: 'ChIJ_abc-123XYZ', session: SESSION });
  assert.equal(places.readDetailsInput({ id: '../secrets', session: SESSION }), null);
  assert.equal(places.readDetailsInput({ id: 'ChIJ_abc-123XYZ', session: '' }), null);
});

test('the autocomplete request: Thailand only, the page language, biased to Bangkok, with the session token', () => {
  const body = places.autocompleteBody({ input: 'อโศก', session: SESSION, lang: 'th' });
  assert.equal(body.input, 'อโศก');
  assert.equal(body.sessionToken, SESSION);
  assert.equal(body.languageCode, 'th');
  assert.deepEqual(body.includedRegionCodes, ['th']);
  assert.ok(body.locationBias.circle.radius <= 50000);
});

test('Google suggestions become name, second line and whether it is a station (at most 5)', () => {
  const answer = {
    suggestions: [
      { placePrediction: { placeId: 'ChIJ1', text: { text: 'BTS Asok, Bangkok' }, structuredFormat: { mainText: { text: 'BTS Asok' }, secondaryText: { text: 'Sukhumvit Rd, Bangkok' } }, types: ['transit_station', 'subway_station'] } },
      { placePrediction: { placeId: 'ChIJ2', text: { text: 'Terminal 21 Asok' }, types: ['shopping_mall'] } },
      { queryPrediction: { text: { text: 'asok condo' } } },
      { placePrediction: { text: { text: 'no id' } } },
      ...Array.from({ length: 6 }, (_, i) => ({ placePrediction: { placeId: `ChIJx${i}`, text: { text: `Place ${i}` } } })),
    ],
  };
  const list = places.readSuggestions(answer);
  assert.equal(list.length, places.PLACE_SUGGESTION_LIMIT);
  assert.deepEqual(list[0], { id: 'ChIJ1', name: 'BTS Asok', secondary: 'Sukhumvit Rd, Bangkok', station: true });
  assert.deepEqual(list[1], { id: 'ChIJ2', name: 'Terminal 21 Asok', secondary: '', station: false });
  assert.deepEqual(places.readSuggestions({}), []);
  assert.deepEqual(places.readSuggestions(null), []);
});

test('place details give the position and the station flag, or nothing', () => {
  assert.deepEqual(places.readDetails({ location: { latitude: 13.7371, longitude: 100.5604 }, types: ['subway_station'] }), { latitude: 13.7371, longitude: 100.5604, station: true });
  assert.equal(places.readDetails({ location: { latitude: 'x' } }), null);
  assert.equal(places.readDetails({ location: { latitude: 120, longitude: 100 } }), null);
  assert.equal(places.readDetails(null), null);
  assert.equal(places.DETAILS_FIELD_MASK, 'location,types', 'Essentials fields only');
});

test('only this site may call the routes: the Origin (or Sec-Fetch-Site) must be ours', () => {
  const headers = (h) => ({ get: (name) => h[name.toLowerCase()] ?? null });
  assert.equal(places.isSameSite(headers({ origin: 'https://nestyk.com', host: 'nestyk.com' })), true);
  assert.equal(places.isSameSite(headers({ origin: 'http://127.0.0.1:3000', host: '127.0.0.1:3000' })), true);
  assert.equal(places.isSameSite(headers({ origin: 'https://evil.example', host: 'nestyk.com' })), false);
  assert.equal(places.isSameSite(headers({ 'sec-fetch-site': 'same-origin', host: 'nestyk.com' })), true);
  assert.equal(places.isSameSite(headers({ 'sec-fetch-site': 'cross-site', host: 'nestyk.com' })), false);
  assert.equal(places.isSameSite(headers({ host: 'nestyk.com' })), false, 'no Origin and no Sec-Fetch-Site: refused');
});

test('a simple rate limit per caller: 60 a minute, then refused until the minute passes', () => {
  const limit = places.createRateLimit({ max: 3, windowMs: 1000 });
  assert.equal(limit('1.1.1.1', 0), true);
  assert.equal(limit('1.1.1.1', 10), true);
  assert.equal(limit('1.1.1.1', 20), true);
  assert.equal(limit('1.1.1.1', 30), false);
  assert.equal(limit('2.2.2.2', 30), true, 'each caller has its own count');
  assert.equal(limit('1.1.1.1', 1001), true, 'a new window');
  assert.deepEqual(places.PLACE_RATE_LIMIT, { max: 60, windowMs: 60000 });
});

test('the routes exist, read the server-only key and never send it to the browser', () => {
  const auto = fs.readFileSync(path.join(__dirname, '..', 'app/place-search/autocomplete/route.ts'), 'utf8');
  const details = fs.readFileSync(path.join(__dirname, '..', 'app/place-search/details/route.ts'), 'utf8');
  for (const route of [auto, details]) {
    assert.match(route, /process\.env\.GOOGLE_PLACES_API_KEY/);
    assert.doesNotMatch(route, /NEXT_PUBLIC_/);
    assert.match(route, /isSameSite\(/);
    assert.match(route, /export async function POST/);
    assert.match(route, /status: 503/, 'no key on this deploy: the place group is hidden');
  }
  const middleware = fs.readFileSync(path.join(__dirname, '..', 'middleware.ts'), 'utf8');
  assert.match(middleware, /place-search/, 'the language middleware leaves the routes alone');
});
