const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);

const search = require('./guest-search.ts');
const { criteriaFromSearchParams } = require('../../../packages/feature-search/src/criteria.ts');

const parse = (qs) => search.normalizeSearchCriteria(criteriaFromSearchParams(new URLSearchParams(qs)));

const labels = {
  titleAll: 'ห้องเช่าทั้งหมด',
  titleAllNearTransit: 'ห้องเช่าใกล้รถไฟฟ้า',
  titleType: '{type}ให้เช่า',
  titleTypeNearTransit: '{type}ให้เช่า ใกล้รถไฟฟ้า',
  titleKeyword: 'ผลการค้นหา “{keyword}”',
  propertyType: { condo: 'คอนโด', apartment: 'อพาร์ทเมนต์', house: 'บ้าน', townhome: 'ทาวน์โฮม' },
  quick: { nearTransit: 'ใกล้ BTS/MRT', moveInReady: 'พร้อมเข้าอยู่', petFriendly: 'เลี้ยงสัตว์ได้', shortTerm: 'เช่าระยะสั้น' },
  priceUnder: 'ไม่เกิน {max}',
  priceBetween: '{min}–{max}',
  priceOver: 'มากกว่า {min}',
  studio: 'สตูดิโอ',
  bedroomOne: '{count} ห้องนอน',
  bedroomMany: '{count} ห้องนอน',
  threePlus: '3 ห้องนอนขึ้นไป',
  moveIn: { now: 'เข้าอยู่ได้ทันที', '30d': 'ภายใน 1 เดือน', '90d': 'ภายใน 3 เดือน' },
  durationChip: 'สัญญา {count} เดือน',
};

test('the move-in chip from the home page becomes "move in now", and 4+ bedrooms fold into 3+', () => {
  const c = parse('quick=moveInReady,petFriendly&beds=0,3,4,5,10');
  assert.equal(c.moveIn, 'now');
  assert.deepEqual(c.quick, ['petFriendly']);
  assert.deepEqual(c.bedrooms, [0, 3]);
  assert.equal(parse('quick=moveInReady&movein=90d').moveIn, 'now', 'the chip wins: it is the narrower ask');
});

test('the page title follows the filters: keyword, one type, near transit, or all rooms', () => {
  assert.equal(search.searchTitle(parse(''), labels), 'ห้องเช่าทั้งหมด');
  assert.equal(search.searchTitle(parse('quick=nearTransit'), labels), 'ห้องเช่าใกล้รถไฟฟ้า');
  assert.equal(search.searchTitle(parse('type=condo'), labels), 'คอนโดให้เช่า');
  assert.equal(search.searchTitle(parse('type=condo&quick=nearTransit'), labels), 'คอนโดให้เช่า ใกล้รถไฟฟ้า');
  assert.equal(search.searchTitle(parse('type=condo,house'), labels), 'ห้องเช่าทั้งหมด');
  assert.equal(search.searchTitle(parse('q=อโศก&type=condo'), labels), 'ผลการค้นหา “อโศก”');
});

test('filter links keep the other filters, drop the page and keep the default URL clean', () => {
  const c = parse('q=อโศก&type=condo&page=3&sort=newest');
  assert.equal(search.searchHref(search.withFilters(c, { propertyType: undefined })), '/search?q=%E0%B8%AD%E0%B9%82%E0%B8%A8%E0%B8%81&sort=newest');
  assert.equal(search.searchHref(search.withFilters(parse(''), {})), '/search');
});

test('each active filter becomes a chip whose link removes only that filter', () => {
  const c = parse('q=อโศก&type=condo,house&min=10000&max=20000&beds=0,3&movein=30d&quick=nearTransit,petFriendly&dur=6&st=BTS&station=Asok');
  const chips = search.activeFilterChips(c, labels);
  assert.deepEqual(chips.map((chip) => chip.label), [
    'อโศก', 'คอนโด', 'บ้าน', '฿10,000–฿20,000', 'สตูดิโอ', '3 ห้องนอนขึ้นไป', 'ภายใน 1 เดือน',
    'ใกล้ BTS/MRT', 'เลี้ยงสัตว์ได้', 'BTS Asok', 'สัญญา 6 เดือน',
  ]);
  const byLabel = Object.fromEntries(chips.map((chip) => [chip.label, new URLSearchParams(chip.href.split('?')[1] ?? '')]));
  assert.equal(byLabel['คอนโด'].get('type'), 'house');
  assert.equal(byLabel['บ้าน'].get('type'), 'condo');
  assert.equal(byLabel['฿10,000–฿20,000'].get('min'), null);
  assert.equal(byLabel['฿10,000–฿20,000'].get('max'), null);
  assert.equal(byLabel['สตูดิโอ'].get('beds'), '3');
  assert.equal(byLabel['อโศก'].get('q'), null);
  assert.equal(byLabel['อโศก'].get('type'), 'condo,house');
  assert.equal(byLabel['BTS Asok'].get('st'), null);
  assert.equal(byLabel['BTS Asok'].get('station'), null);
  assert.equal(new Set(chips.map((chip) => chip.key)).size, chips.length, 'keys are unique');
  assert.deepEqual(search.activeFilterChips(parse(''), labels), []);
});

test('price chips read "up to" or "over" when one side is open', () => {
  assert.equal(search.activeFilterChips(parse('max=10000'), labels)[0].label, 'ไม่เกิน ฿10,000');
  assert.equal(search.activeFilterChips(parse('min=40000'), labels)[0].label, 'มากกว่า ฿40,000');
});

test('the filter count leaves out the keyword', () => {
  assert.equal(search.activeFilterCount(parse('')), 0);
  assert.equal(search.activeFilterCount(parse('q=x')), 0);
  assert.equal(search.activeFilterCount(parse('type=condo,house&min=1&beds=1&movein=now&quick=petFriendly&dur=6')), 7);
});

test('the first load shows every page up to the one in the URL, at most 48 rooms; "load more" asks for the next', () => {
  assert.deepEqual(search.firstLoad(parse('')), { page: 1, limit: 12, loadedPages: 1 });
  assert.deepEqual(search.firstLoad(parse('page=3')), { page: 1, limit: 36, loadedPages: 3 });
  assert.deepEqual(search.firstLoad(parse('page=20')), { page: 1, limit: 48, loadedPages: 4 });
  assert.deepEqual(search.firstLoad(parse('limit=48&page=2')), { page: 1, limit: 48, loadedPages: 1 });
});

test('the API query carries every filter, the page and the size', () => {
  const c = parse('q=อโศก&type=condo&min=10000&beds=3&movein=30d&quick=petFriendly&sort=price_asc');
  const query = search.toPublicQuery(c, 2, 12);
  assert.deepEqual(query, {
    mode: 'rent', keyword: 'อโศก', propertyType: ['condo'], minPrice: 10000, maxPrice: undefined, bedrooms: [3],
    stationType: undefined, stationName: undefined, nearGps: undefined, durationMonths: undefined, moveIn: '30d',
    quick: ['petFriendly'], sortBy: 'price_asc', page: 2, limit: 12,
  });
  const url = search.publicSearchUrl(query);
  assert.ok(url.startsWith('/api/public/rooms/search?'));
  const params = new URLSearchParams(url.split('?')[1]);
  assert.equal(params.get('movein'), '30d');
  assert.equal(params.get('page'), '2');
  assert.equal(params.get('sort'), 'price_asc');
});

test('sort choices on the page follow the design; nearest is left out until there is a location search', () => {
  assert.deepEqual([...search.SEARCH_SORT_OPTIONS], ['recommended', 'price_asc', 'price_desc', 'newest']);
  assert.deepEqual([...search.BEDROOM_FILTERS], [0, 1, 2, 3]);
  assert.deepEqual([...search.MOVE_IN_OPTIONS], ['now', '30d', '90d']);
  assert.deepEqual([...search.OTHER_FILTERS], ['nearTransit', 'petFriendly', 'shortTerm']);
});

test('the page URL after "load more" remembers how many pages are open', () => {
  assert.equal(search.searchHref({ ...parse('type=condo'), page: 3 }), '/search?type=condo&page=3');
});

test('clearing the filters keeps the keyword and the order unless asked to drop the keyword too', () => {
  const c = parse('q=อโศก&type=condo&min=1&beds=1&movein=now&quick=petFriendly&dur=6&st=BTS&sort=newest&page=2');
  assert.equal(search.searchHref(search.clearedFilters(c)), '/search?q=%E0%B8%AD%E0%B9%82%E0%B8%A8%E0%B8%81&sort=newest');
  assert.equal(search.searchHref(search.clearedFilters(c, { keyword: true })), '/search?sort=newest');
});

test('townhome stays off the filters until rooms of that type exist, as on the home page', () => {
  assert.deepEqual([...search.SEARCH_PROPERTY_TYPES], ['condo', 'apartment', 'house']);
});

test('a location in the URL is dropped: the page has no way to show or remove it yet (S4.3)', () => {
  assert.equal(parse('lat=13.7&lng=100.5&r=2').nearGps, undefined);
  assert.equal(search.searchHref(parse('lat=13.7&lng=100.5&type=condo')), '/search?type=condo');
});
