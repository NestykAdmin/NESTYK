// Mobile search page /find (Mos 25 Nov 2026, canvas page "searchnew", dropdown boards D2–D6): recent searches kept on
// this device only (localStorage), shown as one line each, tapping one opens its results.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);

const recent = require('./guest-recent.ts');

const sukhumvit = { area: 'sukhumvit', type: 'condo', minPrice: 10000, maxPrice: 20000, bedrooms: 'one' };

test('a new search goes first, the same search is not kept twice, at most 5', () => {
  const asok = { placeName: 'BTS อโศก', nearGps: { latitude: 13.7371, longitude: 100.5605, radiusKm: 1.5 } };
  let list = [];
  list = recent.addRecentSearch(list, asok);
  list = recent.addRecentSearch(list, sukhumvit);
  assert.deepEqual(list.map((item) => item.area ?? item.placeName), ['sukhumvit', 'BTS อโศก']);
  list = recent.addRecentSearch(list, { ...asok, placeName: ' BTS อโศก ' });
  assert.deepEqual(list.map((item) => item.area ?? item.placeName), ['BTS อโศก', 'sukhumvit'], 'the same search moves to the top');
  for (let i = 0; i < 7; i += 1) list = recent.addRecentSearch(list, { area: `a${i}` });
  assert.equal(list.length, recent.RECENT_MAX);
  assert.equal(recent.RECENT_MAX, 5);
});

// Mos 27 Nov 2026: a search always has a place, so a recent search without one (typed text, filters only) is not kept.
test('nothing chosen, no place, or only "near me", is not kept (no position of the guest is stored)', () => {
  assert.deepEqual(recent.addRecentSearch([], {}), []);
  assert.deepEqual(recent.addRecentSearch([], { keyword: 'อโศก' }), [], 'typed text is not a place');
  assert.deepEqual(recent.addRecentSearch([], { type: 'condo', bedrooms: 'one' }), [], 'filters without a place');
  assert.deepEqual(recent.addRecentSearch([], { nearGps: { latitude: 13.7, longitude: 100.5, radiusKm: 5 } }), []);
  assert.deepEqual(recent.addRecentSearch([], { nearGps: { latitude: 13.7, longitude: 100.5, radiusKm: 5 }, type: 'condo' }), [], 'near me + filters: not kept as a different search (review R7)');
  const station = { nearGps: { latitude: 13.7466, longitude: 100.5393, radiusKm: 1 }, placeName: 'BTS อโศก' };
  assert.equal(recent.addRecentSearch([], station).length, 1, 'a named place or station is a public place');
});

test('what is read back from the device is checked: bad entries and fields are dropped', () => {
  assert.deepEqual(recent.parseRecentSearches('not json'), []);
  assert.deepEqual(recent.parseRecentSearches(JSON.stringify({ a: 1 })), []);
  const raw = JSON.stringify([
    sukhumvit,
    { keyword: 42 },
    { type: 'castle', area: 'ari-phayathai' },
    { nearGps: { latitude: 'a', longitude: 1, radiusKm: 1 }, placeName: 'P' },
    null,
    { area: 'silom-sathorn', extra: '<script>' },
    { keyword: 'สีลม', type: 'condo' },
  ]);
  const list = recent.parseRecentSearches(raw);
  assert.deepEqual(list[0], sukhumvit);
  assert.deepEqual(list[1], { area: 'ari-phayathai' }, 'unknown type dropped, the rest kept');
  assert.deepEqual(list[2], { area: 'silom-sathorn' }, 'unknown fields dropped');
  assert.equal(list.length, 3, 'an old entry without a place is dropped (Mos 27 Nov 2026)');
  assert.equal(recent.parseRecentSearches(JSON.stringify([sukhumvit, sukhumvit])).length, 1, 'repeats dropped (review R7)');
});

test('one line per search in the reader language', () => {
  const words = {
    areaNames: { sukhumvit: 'สุขุมวิท' },
    nearMe: 'ใกล้ฉัน',
    propertyType: { condo: 'คอนโด', apartment: 'อพาร์ทเมนต์', house: 'บ้าน', townhome: 'ทาวน์โฮม' },
    bedroom: { studio: 'สตูดิโอ', one: '1 ห้องนอน', two: '2 ห้องนอน', threePlus: '3 ห้องนอนขึ้นไป' },
    price: (min, max) => (min || max ? `฿${min ?? 0}–${max ?? '∞'}` : null),
    anywhere: 'ทุกทำเล',
  };
  assert.equal(recent.recentSearchLabel(sukhumvit, words), 'สุขุมวิท · คอนโด · ฿10000–20000 · 1 ห้องนอน');
  assert.equal(recent.recentSearchLabel({ keyword: 'อารีย์', bedrooms: 'studio' }, words), 'อารีย์ · สตูดิโอ');
  assert.equal(recent.recentSearchLabel({ placeName: 'BTS อโศก', nearGps: { latitude: 1, longitude: 2, radiusKm: 1 } }, words), 'BTS อโศก');
  assert.equal(recent.recentSearchLabel({ type: 'house' }, words), 'ทุกทำเล · บ้าน');
  assert.equal(recent.recentSearchLabel({ area: 'unknown-slug' }, words), 'unknown-slug');
});
