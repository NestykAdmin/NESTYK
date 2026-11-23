const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { criteriaFromSearchParams, criteriaToSearchParams, defaultGuestCriteria, GUEST_QUICK_FILTERS } = require('../src/criteria.ts');

const parse = (qs) => criteriaFromSearchParams(new URLSearchParams(qs));

test('empty query gives the default guest criteria', () => {
  assert.deepEqual(parse(''), { mode: 'rent', view: 'list', quick: [], page: 1, limit: 12, sortBy: 'recommended' });
  assert.deepEqual(defaultGuestCriteria(), parse(''));
});

test('default criteria serialize to an empty query string', () => {
  assert.equal(criteriaToSearchParams(defaultGuestCriteria()).toString(), '');
});

test('every field survives criteria -> query string -> criteria', () => {
  const full = {
    mode: 'buy', view: 'map', quick: ['nearTransit', 'moveInReady', 'petFriendly', 'shortTerm'],
    keyword: 'อโศก', propertyType: ['condo', 'apartment'], minPrice: 8000, maxPrice: 25000,
    bedrooms: [0, 1, 2], stationType: 'BTS', stationName: 'อโศก',
    nearGps: { latitude: 13.7367, longitude: 100.5608, radiusKm: 3 },
    durationMonths: 12, moveIn: '30d', sortBy: 'price_asc', page: 3, limit: 24,
  };
  const query = criteriaToSearchParams(full).toString();
  assert.deepEqual(criteriaFromSearchParams(new URLSearchParams(query)), full);
});

test('unknown enum values fall back to defaults and are dropped from lists', () => {
  const c = parse('mode=lease&view=3d&sort=cheapest&type=villa,condo&st=SRT&dur=5&movein=soon');
  assert.equal(c.mode, 'rent');
  assert.equal(c.view, 'list');
  assert.equal(c.sortBy, 'recommended');
  assert.equal(c.moveIn, undefined);
  assert.deepEqual(c.propertyType, ['condo']);
  assert.equal(c.stationType, undefined);
  assert.equal(c.durationMonths, undefined);
});

test('page must be a positive integer and limit is clamped to 1..48', () => {
  assert.equal(parse('page=0').page, 1);
  assert.equal(parse('page=-2').page, 1);
  assert.equal(parse('page=abc').page, 1);
  assert.equal(parse('page=2.5').page, 1);
  assert.equal(parse('limit=1000').limit, 48);
  assert.equal(parse('limit=0').limit, 12);
  assert.equal(parse('limit=24').limit, 24);
});

test('price range ignores junk, and swaps min and max when reversed', () => {
  const swapped = parse('min=30000&max=10000');
  assert.equal(swapped.minPrice, 10000);
  assert.equal(swapped.maxPrice, 30000);
  const junk = parse('min=-5&max=abc');
  assert.equal(junk.minPrice, undefined);
  assert.equal(junk.maxPrice, undefined);
});

test('nearby GPS needs a valid latitude and longitude, radius defaults to 5 km', () => {
  assert.equal(parse('lat=13.7').nearGps, undefined);
  assert.equal(parse('lat=91&lng=100').nearGps, undefined);
  assert.equal(parse('lat=13.7&lng=181').nearGps, undefined);
  assert.deepEqual(parse('lat=13.7&lng=100.5').nearGps, { latitude: 13.7, longitude: 100.5, radiusKm: 5 });
  assert.equal(parse('lat=13.7&lng=100.5&r=500').nearGps.radiusKm, 50);
});

test('quick filters are de-duplicated, unknown ones dropped, and kept in canonical order', () => {
  assert.deepEqual(parse('quick=shortTerm,bogus,nearTransit,shortTerm').quick, ['nearTransit', 'shortTerm']);
  assert.deepEqual([...GUEST_QUICK_FILTERS], ['nearTransit', 'moveInReady', 'petFriendly', 'shortTerm']);
});

test('bedrooms accept studio (0), drop non-integers and duplicates, and come back sorted', () => {
  assert.deepEqual(parse('beds=2,0,x,2,1.5,-1').bedrooms, [0, 2]);
  assert.equal(parse('beds=x').bedrooms, undefined);
});

test('keyword is trimmed, empty keyword is dropped, long keyword is cut to 100 characters', () => {
  assert.equal(parse('q=%20%20ทองหล่อ%20').keyword, 'ทองหล่อ');
  assert.equal(parse('q=%20%20').keyword, undefined);
  assert.equal(parse('q=' + 'a'.repeat(150)).keyword.length, 100);
});

test('a Next.js style searchParams record is read the same as a URLSearchParams', () => {
  const fromRecord = criteriaFromSearchParams({ q: ['สยาม', 'ignored'], type: 'condo,house', view: 'map', quick: undefined });
  assert.equal(fromRecord.keyword, 'สยาม');
  assert.deepEqual(fromRecord.propertyType, ['condo', 'house']);
  assert.equal(fromRecord.view, 'map');
  assert.deepEqual(fromRecord.quick, []);
});

test('serializing leaves out values that equal the defaults', () => {
  const query = criteriaToSearchParams({ ...defaultGuestCriteria(), keyword: 'บางนา', page: 2 }).toString();
  assert.equal(query, 'q=%E0%B8%9A%E0%B8%B2%E0%B8%87%E0%B8%99%E0%B8%B2&page=2');
});

test('recommended is the default order, so only another order is written to the URL', () => {
  assert.equal(criteriaToSearchParams({ ...defaultGuestCriteria(), sortBy: 'recommended' }).toString(), '');
  assert.equal(criteriaToSearchParams({ ...defaultGuestCriteria(), sortBy: 'newest' }).toString(), 'sort=newest');
  assert.equal(parse('sort=newest').sortBy, 'newest');
});

test('move-in accepts now, 30 days or 90 days', () => {
  for (const value of ['now', '30d', '90d']) assert.equal(parse(`movein=${value}`).moveIn, value);
  assert.equal(criteriaToSearchParams({ ...defaultGuestCriteria(), moveIn: 'now' }).toString(), 'movein=now');
});

// SEO-1 area pages (Mos 20 Nov 2026): /search?area=<slug> from "see all rooms" on an area page.
test('area survives the URL; a value that is not a slug is dropped', () => {
  assert.equal(parse('area=sukhumvit-asok').area, 'sukhumvit-asok');
  assert.equal(criteriaToSearchParams({ ...defaultGuestCriteria(), area: 'silom-sathorn' }).toString(), 'area=silom-sathorn');
  for (const bad of ['Asok', 'a b', '-x', 'x-', '../etc', 'a'.repeat(41)]) {
    assert.equal(parse(`area=${encodeURIComponent(bad)}`).area, undefined, bad);
  }
  assert.equal('area' in parse(''), false);
});

// Place search (Mos 20 Nov 2026): a place picked in the keyword box keeps its name for the heading and the chip.
// The name only means something with a position, so it is dropped without one.
test('a place name rides with lat/lng, is trimmed to 80 characters and dropped without a position', () => {
  const c = parse('lat=13.7466&lng=100.5393&r=3&place=%20Central%20World%20');
  assert.equal(c.placeName, 'Central World');
  assert.deepEqual(c.nearGps, { latitude: 13.7466, longitude: 100.5393, radiusKm: 3 });
  assert.equal(criteriaToSearchParams(c).toString(), 'lat=13.7466&lng=100.5393&r=3&place=Central+World');
  assert.equal(parse(`lat=13.7&lng=100.5&place=${'x'.repeat(120)}`).placeName.length, 80);
  assert.equal(parse('place=Central%20World').placeName, undefined);
  assert.equal(criteriaToSearchParams({ ...defaultGuestCriteria(), placeName: 'Central World' }).toString(), '', 'no position: no name');
});

// Map search (S4.3, Mos 20 Nov 2026): an area the map was moved to rides as near=map, so the page says "บริเวณแผนที่"
// and not "ใกล้ตำแหน่งของฉัน". A place name wins over it; without a position it means nothing.
test('near=map marks a map area, needs a position and gives way to a place name', () => {
  const c = parse('view=map&lat=13.74&lng=100.56&r=2.3&near=map');
  assert.equal(c.view, 'map');
  assert.equal(c.nearMap, true);
  assert.deepEqual(c.nearGps, { latitude: 13.74, longitude: 100.56, radiusKm: 2.3 });
  assert.equal(criteriaToSearchParams(c).toString(), 'view=map&lat=13.74&lng=100.56&r=2.3&near=map');
  assert.equal(parse('near=map').nearMap, undefined, 'no position');
  assert.equal(parse('lat=13.7&lng=100.5&near=x').nearMap, undefined);
  const named = parse('lat=13.7&lng=100.5&place=BTS%20Asok&near=map');
  assert.equal(named.placeName, 'BTS Asok');
  assert.equal(named.nearMap, undefined, 'a picked place is not a map area');
  assert.equal(criteriaToSearchParams({ ...defaultGuestCriteria(), nearMap: true }).toString(), '', 'no position: no flag');
});
