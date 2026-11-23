// Map search (S4.3, design SearchMapWebV23 / MapMobileV22, Mos 20 Nov 2026): price pins, one pin for rooms at one
// spot, the map's view as a search circle, and the view-switch rules.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);

const map = require('./guest-map.ts');
const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const room = (id, latitude, longitude, priceFrom) => ({ id, latitude, longitude, priceFrom });

test('rooms at one spot share a pin with their price range and count; rooms without a position get none', () => {
  const pins = map.roomPins([
    room('a', 13.7371, 100.5605, 25000),
    room('b', 13.7371, 100.5605, 10000),
    room('c', 13.7371, 100.5605, 13000),
    room('d', 13.75, 100.54, 18500),
    room('e', null, 100.5, 9000),
    room('f', 13.76, 100.53, null),
  ]);
  assert.equal(pins.length, 3);
  assert.deepEqual(pins[0], { id: '13.7371,100.5605', latitude: 13.7371, longitude: 100.5605, roomIds: ['a', 'b', 'c'], label: '฿10,000–25,000', count: 3 });
  assert.deepEqual(pins[1], { id: '13.7500,100.5400', latitude: 13.75, longitude: 100.54, roomIds: ['d'], label: '฿18,500', count: 1 });
  assert.equal(pins[2].label, '฿–', 'a room with no price still has a pin');
});

test('the map view becomes a search circle that covers it, between 0.5 and 50 km', () => {
  const view = { north: 13.76, south: 13.72, east: 100.58, west: 100.54 };
  const circle = map.circleFromBounds(view);
  assert.deepEqual([circle.latitude, circle.longitude], [13.74, 100.56]);
  assert.ok(circle.radiusKm >= 3.1 && circle.radiusKm <= 3.2, `covers the corners: ${circle.radiusKm}`);
  assert.equal(map.circleFromBounds({ north: 13.7401, south: 13.74, east: 100.5601, west: 100.56 }).radiusKm, 0.5);
  assert.equal(map.circleFromBounds({ north: 15, south: 12, east: 102, west: 99 }).radiusKm, 50);
});

test('a circle gives the box to show it whole, and a point is in a box or not', () => {
  const box = map.boundsOfCircle({ latitude: 13.74, longitude: 100.56, radiusKm: 1.5 });
  assert.ok(box.north > 13.753 && box.north < 13.754 && box.south < 13.727 && box.south > 13.726);
  assert.ok(box.east > 100.5738 && box.west < 100.5462);
  assert.equal(map.inBounds({ latitude: 13.74, longitude: 100.56 }, box), true);
  assert.equal(map.inBounds({ latitude: 13.8, longitude: 100.56 }, box), false);
  assert.equal(map.inBounds({ latitude: null, longitude: 100.56 }, box), false);
});

test('the pins box covers every pin, and none without pins', () => {
  assert.deepEqual(map.boundsOfPins([{ latitude: 13.7, longitude: 100.5 }, { latitude: 13.8, longitude: 100.6 }]), { north: 13.8, south: 13.7, east: 100.6, west: 100.5 });
  assert.equal(map.boundsOfPins([]), null);
});

test('the map loads at most 4 pages of 48 rooms', () => {
  assert.equal(map.MAP_PAGE_SIZE, 48);
  assert.equal(map.MAP_MAX_PAGES, 4);
  assert.equal(map.MAP_ROOM_LIMIT, 192);
  assert.equal(map.SEARCH_AS_MOVE_DELAY_MS, 600);
});

test('the map view: cookie gate first, one map across searches, a moved map searches as a map area', () => {
  const view = read('app/components/guest/SearchMap.tsx');
  assert.match(view, /<MapConsentGate/, 'Google loads only after the maps cookie');
  assert.ok(view.indexOf('<MapConsentGate') < view.indexOf('<APIProvider'));
  assert.match(view, /update\(\{ nearGps: circle, nearMap: true, placeName: undefined, area: undefined \}\)/);
  assert.match(view, /SEARCH_AS_MOVE_DELAY_MS/);
  assert.match(view, /if \(!intent\.current\) return;/, 'a camera move the page makes never searches');
  assert.match(view, /<MapUnavailable/, 'no Maps key: a message, not a broken page');
  assert.doesNotMatch(view, /#[0-9a-fA-F]{3,6}\b/, 'colours come from guest-map.css and MAP_CIRCLE_STYLE');
  const page = read('app/[locale]/(marketplace)/search/page.tsx');
  assert.match(page, /<SearchMap key="map"/);
  assert.match(page, /limit: MAP_PAGE_SIZE/);
  const results = read('app/components/guest/SearchResults.tsx');
  assert.match(results, /onClick=\{\(\) => update\(\{ view: 'map' \}\)\}/);
  assert.doesNotMatch(results, /comingSoon/, 'the map button is no longer "เร็ว ๆ นี้"');
});

// Mos 20 Nov 2026: the card / map switch sits in the same place in both views (right end of the results toolbar),
// beside the same sort. Phones keep the bottom-centre button ("ดูบนแผนที่" / "แสดงรายการ").
test('one view switch and one sort, at the right end of the toolbar in both views', () => {
  const parts = read('app/components/guest/SearchToolbarParts.tsx');
  assert.match(parts, /export function SearchViewSwitch/);
  assert.match(parts, /export function SearchSort/);
  assert.match(parts, /update\(\{ view: target \}\)/);
  for (const file of ['app/components/guest/SearchResults.tsx', 'app/components/guest/SearchMap.tsx']) {
    const src = read(file);
    assert.match(src, /className="nk-search-toolbar"/, file);
    assert.match(src, /<SearchSort /, file);
    assert.ok(src.indexOf('<SearchSort ') < src.indexOf('<SearchViewSwitch '), `${file}: the switch comes last`);
  }
  assert.match(read('app/components/guest/SearchResults.tsx'), /<SearchViewSwitch view="list"/);
  assert.match(read('app/components/guest/SearchMap.tsx'), /<SearchViewSwitch view="map"/);
});

// Mos 20 Nov 2026: no visible heading on the search page (screen readers still get it), and the filter chips sit
// after the count in the toolbar. Place, area and keyword are in the search box with its own ✕, so no chip repeats them.
test('the heading is for screen readers only and the chips sit in the toolbar, without the box\'s place or keyword', () => {
  const page = read('app/[locale]/(marketplace)/search/page.tsx');
  assert.match(page, /<h1 id="search-title" className="nk-sr-only" data-testid="searchPage\.title">/);
  assert.match(page, /const BOX_CHIPS = new Set\(\['near', 'area', 'keyword'\]\);/);
  assert.match(page, /chips\.filter\(\(chip\) => !BOX_CHIPS\.has\(chip\.key\)\)/);
  assert.doesNotMatch(page, /filters=\{/, 'no server-made JSX passed into the client lists');
  for (const file of ['app/components/guest/SearchResults.tsx', 'app/components/guest/SearchMap.tsx']) {
    const src = read(file);
    assert.match(src, /className="nk-search-toolbar__lead"/, file);
    // Chips go across as data, drawn here: JSX made by the server page and passed in a prop lost its keys (React warning).
    assert.match(src, /<SearchFilterChips chips=\{chips\} locale=\{locale\} \/>/, file);
  }
});

// Mos 20 Nov 2026: a button on the map's left edge folds the list away so the map takes the full width, and brings it back.
test('the list can fold away for a full-width map, and come back', () => {
  const view = read('app/components/guest/SearchMap.tsx');
  assert.match(view, /const \[listHidden, setListHidden\] = useState\(false\);/);
  assert.match(view, /className=\{`nk-map-view\$\{listHidden \? ' is-full' : ''\}`\}/);
  assert.match(view, /aria-expanded=\{!listHidden\}/);
  assert.match(view, /aria-label=\{listHidden \? copy\.map\.showListPanel : copy\.map\.hideListPanel\}/);
  const css = read('app/[locale]/guest-map.css');
  assert.match(css, /\.nk-map-view\.is-full \.nk-map-list \{\s*display: none;/);
  assert.match(css, /\.nk-map-view\.is-full \.nk-map-stage \{\s*grid-column: 1 \/ -1;/);
});

// Mos 20 Nov 2026 (card view, wide screens): the filter panel stays put while the rooms scroll (its own scroll when
// taller than the screen), and a "ตัวกรอง" button at the left of the toolbar folds it away and back.
test('the filter panel stays in view and folds away from a toolbar button', () => {
  const nav = read('app/components/guest/SearchNavigation.tsx');
  assert.match(nav, /const \[filtersOpen, setFiltersOpen\] = useState\(true\);/);
  assert.match(nav, /data-filters=\{filtersOpen \? 'open' : 'closed'\}/);
  const parts = read('app/components/guest/SearchToolbarParts.tsx');
  assert.match(parts, /export function SearchFiltersToggle/);
  assert.match(parts, /aria-expanded=\{filtersOpen\}/);
  assert.match(parts, /aria-controls=\{SEARCH_FILTERS_ID\}/);
  assert.match(read('app/components/guest/SearchResults.tsx'), /<SearchFiltersToggle criteria=\{criteria\} \/>/);
  assert.match(read('app/[locale]/(marketplace)/search/page.tsx'), /<aside id=\{SEARCH_FILTERS_ID\} className="nk-search-aside"/);
  const css = read('app/[locale]/guest.css');
  assert.match(css, /\.nk-search-page\[data-filters='closed'\] \.nk-search-aside \{\s*display: none;/);
  assert.match(css, /\.nk-search-aside__panel \{[^}]*max-height: calc\(100dvh/);
});

// Mos 20 Nov 2026: "ใกล้ BTS/MRT" hides until rooms carry their nearest station (every room has none yet, so it always
// found 0). One switch hides it on the side panel, the search bar chips, the home search and the home rail tab.
test('"near BTS/MRT" stays hidden until rooms have station data, everywhere it shows', () => {
  const site = read('lib/guest-site.ts');
  assert.match(site, /export const NEAR_TRANSIT_READY = false;/);
  assert.match(site, /export function shownQuickFilters/);
  assert.match(read('app/components/guest/SearchFilterFields.tsx'), /shownQuickFilters\(OTHER_FILTERS\)\.map/);
  assert.match(read('app/components/guest/SearchKeywordBar.tsx'), /shownQuickFilters\(QUICK_CHIPS\)\.map/);
  assert.match(read('app/components/guest/SearchPanel.tsx'), /shownQuickFilters\(GUEST_QUICK_FILTERS\)\.map/);
  assert.match(read('app/[locale]/(marketplace)/page.tsx'), /HOME_RAILS\.filter\(\(rail\) => NEAR_TRANSIT_READY \|\| rail !== 'near_transit'\)/);
});

test('every filter but the rent range is a dropdown, one open at a time, opening below its button (works inside the phone sheet)', () => {
  const fields = read('app/components/guest/SearchFilterFields.tsx');
  assert.match(fields, /function FilterDropdown/);
  assert.match(fields, /aria-expanded=\{open\}/);
  assert.match(fields, /const \[openId, setOpenId\] = useState<FilterId \| null>\(null\);/);
  assert.match(fields, /className="nk-filter-dd nk-filter-dd--open" data-testid="searchFilters\.price"/, 'the rent range stays open');
  for (const id of ['type', 'beds', 'moveIn', 'more']) assert.match(fields, new RegExp(`\\{\\.\\.\\.props\\('${id}'\\)\\}`), id);
  assert.match(fields, /filterSummaries\(/);
  // Esc closes only the open dropdown (caught on the way down, before the phone sheet closes itself).
  assert.match(fields, /if \(event\.key !== 'Escape'\) return;\s*event\.stopPropagation\(\);/);
  assert.match(fields, /document\.addEventListener\('keydown', onKeyDown, true\)/);
  assert.doesNotMatch(fields, /portal/, 'inline, so the phone sheet keeps focus inside');
});

// Mos 20 Nov 2026: the rent keeps its slider and min/max boxes, and its ready ranges become one dropdown in the panel.
test('the rent range mixes the slider with a dropdown of ready ranges in the filter panel', () => {
  const field = read('app/components/guest/PriceRangeField.tsx');
  assert.match(field, /presets = 'chips'/);
  assert.match(field, /<select[\s\S]*className="nk-input nk-price-field__select"/);
  assert.match(field, /value=\{presetIndex >= 0 \? String\(presetIndex\) : 'custom'\}/);
  assert.match(read('app/components/guest/SearchFilterFields.tsx'), /<PriceRangeField[^\n]*presets="select" \/>/);
});

// Mos 20 Nov 2026: one fixed toolbar row (filters, count … sort, card/list, list/map), the chips on a second row
// with "ล้างทั้งหมด", so the switch never drops down. Clearing there removes only what the chips show.
test('the toolbar keeps one row and puts the chips on the next row with clear-all', () => {
  for (const file of ['app/components/guest/SearchResults.tsx', 'app/components/guest/SearchMap.tsx']) {
    const src = read(file);
    assert.match(src, /className="nk-search-toolbar__row"/, file);
    assert.ok(src.indexOf('nk-search-toolbar__row') < src.indexOf('<SearchFilterChips'), `${file}: chips below the row`);
  }
  const parts = read('app/components/guest/SearchToolbarParts.tsx');
  assert.match(parts, /className="nk-search-toolbar__chips"/);
  assert.match(parts, /data-testid="searchPage\.clearChips"/);
  assert.match(parts, /update\(CHIP_FILTERS_OFF\)/);
  const css = read('app/[locale]/guest.css');
  assert.match(css, /\.nk-search-toolbar__row \{[^}]*flex-wrap: nowrap;/);
});

// Mos 20 Nov 2026: "ค้นหาเมื่อเลื่อนแผนที่" is an on/off switch (a checkbox with role="switch"), not a tick box.
test('search-as-move is a switch after its words', () => {
  const view = read('app/components/guest/SearchMap.tsx');
  assert.match(view, /\{copy\.map\.searchAsMove\}\s*<input\s+type="checkbox"\s+role="switch"\s+className="nk-switch"/);
  assert.match(read('app/[locale]/guest-map.css'), /\.nk-switch:checked \{/);
});

// Mos 20 Nov 2026: the fold button sits with the other map tools (top left, beside the search-as-move switch).
test('the list fold button sits beside the search-as-move switch', () => {
  const view = read('app/components/guest/SearchMap.tsx');
  assert.match(view, /<div className="nk-map-tools">\s*\{leading\}/);
  assert.match(view, /leading=\{foldButton\}/);
});
