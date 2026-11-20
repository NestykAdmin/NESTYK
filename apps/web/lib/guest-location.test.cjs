// Location search (Mos 20 Nov 2026): the keyword box suggests "near me", areas whose name or places match, and the
// typed text as a free keyword. Areas come from the copy (guest.areaNames / guest.areaInfo) in the page's language.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);

const loc = require('./guest-location.ts');

const NAMES = {
  'ratchada-rama9': 'รัชดาฯ – พระราม 9',
  sukhumvit: 'สุขุมวิท',
  'ladprao-chatuchak': 'ลาดพร้าว – จตุจักร',
  'bangna-udomsuk': 'บางนา – อุดมสุข',
  'ari-phayathai': 'อารีย์ – พญาไท',
  'silom-sathorn': 'สามย่าน – สีลม – สาทร',
  chiangmai: 'เชียงใหม่',
};
const INFO = {
  sukhumvit: { places: 'อโศก · ทองหล่อ · เอกมัย · อ่อนนุช' },
  'silom-sathorn': { places: 'สามย่าน · สีลม · สาทร · ช่องนนทรี' },
  chiangmai: { places: 'นิมมานเหมินท์ · สันติธรรม · รอบ มช. · หางดง' },
};
const areas = loc.locationAreas(NAMES, INFO);

test('the area list keeps the copy order and carries each area\'s places', () => {
  assert.deepEqual(areas.map((area) => area.slug), Object.keys(NAMES));
  assert.equal(areas[1].places, 'อโศก · ทองหล่อ · เอกมัย · อ่อนนุช');
  assert.equal(areas[0].places, '', 'an area without places text still works');
});

test('an empty box offers "near me" and the first popular areas', () => {
  const list = loc.locationSuggestions('  ', areas);
  assert.deepEqual(list[0], { kind: 'nearMe' });
  assert.deepEqual(list.slice(1).map((item) => item.slug), Object.keys(NAMES).slice(0, loc.LOCATION_POPULAR_LIMIT));
  assert.equal(loc.LOCATION_POPULAR_LIMIT, 5);
  assert.ok(!list.some((item) => item.kind === 'keyword'));
});

test('a place inside an area finds the area ("อโศก" → สุขุมวิท), and the text is still offered as a keyword', () => {
  const list = loc.locationSuggestions('อโศก', areas);
  assert.deepEqual(list.map((item) => item.kind), ['nearMe', 'area', 'keyword']);
  assert.equal(list[1].slug, 'sukhumvit');
  assert.deepEqual(list[2], { kind: 'keyword', text: 'อโศก' });
});

test('matching ignores spaces, case, dashes, dots and ฯ', () => {
  assert.equal(loc.locationSuggestions('รัชดา', areas)[1].slug, 'ratchada-rama9');
  assert.equal(loc.locationSuggestions('พระราม9', areas)[1].slug, 'ratchada-rama9');
  assert.equal(loc.locationSuggestions('ลาดพร้าว-จตุจักร', areas)[1].slug, 'ladprao-chatuchak');
  assert.equal(loc.locationSuggestions('รอบ มช', areas)[1].slug, 'chiangmai');
  const en = loc.locationAreas({ sukhumvit: 'Sukhumvit' }, { sukhumvit: { places: 'Asok · Thong Lo' } });
  assert.equal(loc.locationSuggestions('  thong lo ', en)[1].slug, 'sukhumvit');
});

test('a name match ranks above a places match, and at most 5 areas show', () => {
  // "สาทร" is in the silom-sathorn name; "สีลม" also. Build a case where one area matches by name and one by place.
  const list = loc.locationSuggestions('สาม', areas).filter((item) => item.kind === 'area');
  assert.equal(list[0].slug, 'silom-sathorn');
  const many = loc.locationAreas(Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`a${i}`, `ทำเล ${i}`])), {});
  assert.equal(loc.locationSuggestions('ทำเล', many).filter((item) => item.kind === 'area').length, loc.LOCATION_POPULAR_LIMIT);
});

test('text with no area match still offers "near me" and the keyword', () => {
  assert.deepEqual(loc.locationSuggestions('Ideo Mobi', areas), [{ kind: 'nearMe' }, { kind: 'keyword', text: 'Ideo Mobi' }]);
});

// An area or "near me" replaces the place (and the typed text that led to it); a keyword only sets the keyword, so it
// narrows an area or "near me" already chosen, as the search box did before (both show as chips on /search).
// The position is rounded to about 100 m before it goes into the URL (the link can be shared or kept in history).
test('a choice becomes the search: an area or "near me" replaces the place, a keyword narrows it', () => {
  assert.deepEqual(loc.locationPatch({ kind: 'area', slug: 'sukhumvit' }), { area: 'sukhumvit', keyword: undefined, nearGps: undefined, placeName: undefined });
  assert.deepEqual(loc.locationPatch({ kind: 'keyword', text: '  Ideo  ' }), { keyword: 'Ideo' });
  assert.deepEqual(loc.locationPatch({ kind: 'keyword', text: '   ' }), { keyword: undefined });
  assert.deepEqual(loc.locationPatch({ kind: 'nearMe', latitude: 13.73712, longitude: 100.56012 }), {
    nearGps: { latitude: 13.737, longitude: 100.56, radiusKm: loc.NEAR_ME_RADIUS_KM },
    placeName: undefined,
    keyword: undefined,
    area: undefined,
  });
  assert.equal(loc.NEAR_ME_RADIUS_KM, 5);
});

// Place search (Mos 20 Nov 2026): a station searches 1.5 km around it, any other place 3 km. A place's position is
// public (it is the place, not the person), so it is kept at 4 decimals (about 10 m).
test('a picked place searches around it: 1.5 km for a station, 3 km otherwise, with its name', () => {
  assert.deepEqual(loc.locationPatch({ kind: 'place', name: ' BTS Asok ', latitude: 13.737123, longitude: 100.560456, station: true }), {
    nearGps: { latitude: 13.7371, longitude: 100.5605, radiusKm: 1.5 },
    placeName: 'BTS Asok',
    keyword: undefined,
    area: undefined,
  });
  assert.equal(loc.locationPatch({ kind: 'place', name: 'Central World', latitude: 13.7466, longitude: 100.5393, station: false }).nearGps.radiusKm, 3);
  assert.equal(loc.PLACE_RADIUS_KM, 3);
  assert.equal(loc.STATION_RADIUS_KM, 1.5);
});

test('Google place types that mean a rail station', () => {
  assert.equal(loc.isStationType(['subway_station', 'transit_station']), true);
  assert.equal(loc.isStationType(['train_station']), true);
  assert.equal(loc.isStationType(['light_rail_station']), true);
  assert.equal(loc.isStationType(['bus_station', 'transit_station']), false);
  assert.equal(loc.isStationType(['shopping_mall']), false);
  assert.equal(loc.isStationType(undefined), false);
});

const path = require('node:path');
const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

// The box is Ariakit's combobox (Mos 20 Nov 2026: keyboard, screen readers, and a popover that flips or shrinks at the
// edge of the screen) used on the home page and the search page; phones get a full-screen dialog instead.
test('the location box is an Ariakit combobox shared by the home and search pages', () => {
  const box = read('app/components/guest/LocationCombobox.tsx');
  assert.match(box, /from '@ariakit\/react'/);
  for (const part of ['ComboboxProvider', 'Combobox', 'ComboboxPopover', 'ComboboxItem', 'ComboboxGroup', 'ComboboxGroupLabel', 'ComboboxList', 'Dialog']) {
    assert.match(box, new RegExp(`<Ariakit\\.${part}[\\s>]`), part);
  }
  assert.match(box, /fitViewport/, 'the list never runs off the screen');
  // type="search" lets Chrome empty the box on Escape while the search still has its place; our ✕ clears instead.
  assert.doesNotMatch(box, /type="search"/);
  assert.match(box, /enterKeyHint="search"/);
  assert.match(box, /PHONE_QUERY = '\(max-width: 960px\)'/);
  assert.match(box, /locationSuggestions\(/);
  assert.match(box, /navigator\.geolocation\.getCurrentPosition/);
  assert.doesNotMatch(box, /role="listbox"|role: 'option'/, 'Ariakit sets the roles; no hand-made listbox');
  assert.match(read('app/components/guest/SearchPanel.tsx'), /<LocationCombobox/);
  assert.match(read('app/components/guest/SearchKeywordBar.tsx'), /<LocationCombobox/);
});

test('the search page names a "near me" search and shows its chip', () => {
  const page = read('app/[locale]/(marketplace)/search/page.tsx');
  assert.match(page, /nearMeTitle: t\.location\.nearMeTitle/);
  assert.match(page, /nearMeChip: t\.location\.nearMeChip/);
});

// Place search (Mos 20 Nov 2026): Google places through this site's routes, one session per search, the "Google Maps"
// credit under the group, and the search page names the place.
test('the box asks the site routes for places, ends the session on a pick and shows the Google credit', () => {
  const box = read('app/components/guest/LocationCombobox.tsx');
  assert.match(box, /'\/place-search\/autocomplete'/);
  assert.match(box, /'\/place-search\/details'/);
  assert.match(box, /PLACE_DEBOUNCE_MS = 300/);
  assert.match(box, /if \(code === 503\) placesOn\.current = false;/);
  assert.match(box, /session\.current = null;/);
  assert.match(box, />\s*Google Maps\s*</);
  assert.doesNotMatch(box, /googleapis\.com/, 'the browser never calls Google itself');
  const page = read('app/[locale]/(marketplace)/search/page.tsx');
  assert.match(page, /nearPlaceTitle: t\.location\.nearPlaceTitle/);
  assert.match(page, /nearPlaceChip: t\.location\.nearPlaceChip/);
});

// The search page keeps the chosen place in the box (Mos 20 Nov 2026): a station, a Google place, "near me", an area
// or the keyword, with the matching icon.
test('locationLabel names what the search is about, in the same order as the page heading', () => {
  const labels = { nearMe: 'ใกล้ตำแหน่งของฉัน', areaNames: NAMES };
  const near = { latitude: 13.7, longitude: 100.5, radiusKm: 1.5 };
  assert.deepEqual(loc.locationLabel({ keyword: 'ideo' }, labels), { kind: 'keyword', text: 'ideo' });
  assert.deepEqual(loc.locationLabel({ nearGps: near, placeName: 'MRT ไฟฉาย' }, labels), { kind: 'station', text: 'MRT ไฟฉาย' });
  assert.deepEqual(loc.locationLabel({ nearGps: near, placeName: 'BTS Asok' }, labels), { kind: 'station', text: 'BTS Asok' });
  assert.deepEqual(loc.locationLabel({ nearGps: near, placeName: 'สยามพารากอน' }, labels), { kind: 'place', text: 'สยามพารากอน' });
  assert.deepEqual(loc.locationLabel({ nearGps: near }, labels), { kind: 'nearMe', text: 'ใกล้ตำแหน่งของฉัน' });
  assert.deepEqual(loc.locationLabel({ area: 'ratchada-rama9' }, labels), { kind: 'area', text: 'รัชดาฯ – พระราม 9' });
  assert.deepEqual(loc.locationLabel({ area: 'old-slug' }, labels), { kind: 'area', text: 'old-slug' }, 'an old link shows its slug');
  assert.deepEqual(loc.locationLabel({}, labels), { kind: 'none', text: '' });
});

test('the search bar shows the label, its icon and a clear button that drops the place too', () => {
  const bar = read('app/components/guest/SearchKeywordBar.tsx');
  assert.match(bar, /locationLabel\(criteria,/);
  assert.match(bar, /data-testid="searchPage\.clear"/);
  assert.match(bar, /update\(\{ keyword: undefined, \.\.\.NO_PLACE \}\)/);
  // Submitting the label unchanged keeps the place search instead of turning it into a keyword.
  assert.match(bar, /if \(text === label\.text\) return;/);
  // New text in the box replaces the place it showed (typed and submitted, or the "ค้นหา “…”" row).
  assert.match(bar, /const NO_PLACE = \{ area: undefined, nearGps: undefined, placeName: undefined \} as const;/);
  assert.match(bar, /update\(\{ \.\.\.locationPatch\(\{ kind: 'keyword', text \}\), \.\.\.NO_PLACE \}\)/);
  assert.match(bar, /choice\.kind === 'keyword' \? \{ \.\.\.locationPatch\(choice\), \.\.\.NO_PLACE \} : locationPatch\(choice\)/);
});
