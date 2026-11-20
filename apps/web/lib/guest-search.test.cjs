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
    mode: 'rent', keyword: 'อโศก', area: undefined, propertyType: ['condo'], minPrice: 10000, maxPrice: undefined, bedrooms: [3],
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

// Location search (Mos 20 Nov 2026): "near me" puts the position in the URL; the page shows it as a heading and a
// chip that removes it (until then it was dropped, review L3).
test('a location in the URL is kept, titled "near you" and shown as a chip that removes it', () => {
  const c = parse('lat=13.737&lng=100.56&type=condo');
  assert.deepEqual(c.nearGps, { latitude: 13.737, longitude: 100.56, radiusKm: 5 });
  assert.equal(search.searchHref(c), '/search?type=condo&lat=13.737&lng=100.56');
  assert.equal(search.toPublicQuery(c, 1, 12).nearGps.radiusKm, 5);
  const titles = { ...labels, nearMeTitle: 'ห้องเช่าใกล้ตำแหน่งของคุณ' };
  assert.equal(search.searchTitle(c, titles), 'ห้องเช่าใกล้ตำแหน่งของคุณ');
  assert.equal(search.searchTitle(parse('lat=13.737&lng=100.56&q=Ideo'), titles), 'ผลการค้นหา “Ideo”', 'a keyword still names the search');
  const chips = search.activeFilterChips(c, { ...labels, nearMeChip: 'ใกล้ตำแหน่งของฉัน' });
  assert.equal(chips[0].key, 'near');
  assert.equal(chips[0].label, 'ใกล้ตำแหน่งของฉัน');
  assert.equal(chips[0].href, '/search?type=condo');
});

test('a picked place is named in the heading and chip; removing the chip drops the place and its name', () => {
  const c = parse('lat=13.7466&lng=100.5393&r=3&place=Central%20World&type=condo');
  const titles = { ...labels, nearMeTitle: 'ใกล้คุณ', nearPlaceTitle: 'ห้องเช่าใกล้ {place}' };
  assert.equal(search.searchTitle(c, titles), 'ห้องเช่าใกล้ Central World');
  const chips = search.activeFilterChips(c, { ...labels, nearMeChip: 'ใกล้ฉัน', nearPlaceChip: 'ใกล้ {place} · {km} กม.' });
  assert.equal(chips[0].label, 'ใกล้ Central World · 3 กม.');
  assert.equal(chips[0].href, '/search?type=condo');
  assert.equal(search.searchHref(search.clearedFilters(c)), '/search');
});

test('price slider runs 0 – 100,000 in steps of 1,000; the far ends mean "no limit"', () => {
  assert.deepEqual(search.PRICE_SLIDER, { min: 0, max: 100000, step: 1000 });
  assert.deepEqual(search.sliderFromPrice(undefined, undefined), [0, 100000]);
  assert.deepEqual(search.sliderFromPrice(15000, 30000), [15000, 30000]);
  assert.deepEqual(search.sliderFromPrice(15500, 250000), [15000, 100000], 'typed values snap to the track');
  assert.deepEqual(search.priceFromSlider(0, 100000), { minPrice: undefined, maxPrice: undefined });
  assert.deepEqual(search.priceFromSlider(12000, 100000), { minPrice: 12000, maxPrice: undefined });
  assert.deepEqual(search.priceFromSlider(0, 40000), { minPrice: undefined, maxPrice: 40000 });
});

test('the two handles never cross: each keeps at least one step from the other', () => {
  assert.deepEqual(search.moveSliderHandle([20000, 30000], 'min', 45000), [29000, 30000]);
  assert.deepEqual(search.moveSliderHandle([20000, 30000], 'max', 5000), [20000, 21000]);
  assert.deepEqual(search.moveSliderHandle([20000, 30000], 'min', 12000), [12000, 30000]);
});

test('slider text: "฿x – ฿y", the top end reads "฿100,000+"', () => {
  assert.equal(search.sliderText([0, 100000], '{max}+'), '฿0 – ฿100,000+');
  assert.equal(search.sliderText([15000, 30000], '{max}+'), '฿15,000 – ฿30,000');
});

test('a lower bound alone reads "from", not "more than" (the bound is included)', () => {
  const chip = search.activeFilterChips(parse('min=18000'), { ...labels, priceOver: 'ตั้งแต่ {min}' })[0];
  assert.equal(chip.label, 'ตั้งแต่ ฿18,000');
});

test('price presets read short: all, "up to ฿10k", "฿10k–฿20k", "from ฿50k"', () => {
  const words = { priceAny: 'ทุกช่วงราคา', priceUnder: 'ไม่เกิน {max}', priceBetween: '{min}–{max}', priceOver: 'ตั้งแต่ {min}' };
  assert.deepEqual(search.RENT_PRESET_CHOICES.map((preset) => search.presetLabel(preset, words)),
    ['ทุกช่วงราคา', 'ไม่เกิน ฿10k', '฿10k–฿20k', '฿20k–฿30k', '฿30k–฿50k', 'ตั้งแต่ ฿50k']);
});

test('the price button on the home search shows the chosen range, or "any price"', () => {
  const words = { priceAny: 'ทุกช่วงราคา', priceUnder: 'ไม่เกิน {max}', priceBetween: '{min}–{max}', priceOver: 'ตั้งแต่ {min}' };
  assert.equal(search.priceButtonText(undefined, undefined, words), 'ทุกช่วงราคา');
  assert.equal(search.priceButtonText(12000, 30000, words), '฿12,000–฿30,000');
  assert.equal(search.priceButtonText(12000, undefined, words), 'ตั้งแต่ ฿12,000');
});

// SEO-1 area pages (Mos 20 Nov 2026) and review R3: "see all rooms" on an area page opens /search?area=<slug>.
// The area reaches the API, shows as a removable chip and in the title, and "clear filters" drops it.
test('area: sent to the API, shown as a chip and in the title, cleared with the other filters', () => {
  const areaLabels = { ...labels, areaChip: 'ทำเล: {name}', areaTitle: 'ห้องเช่า {name}', areaNames: { sukhumvit: 'สุขุมวิท' } };
  const c = parse('area=sukhumvit&type=condo');
  assert.equal(search.toPublicQuery(c, 1, 12).area, 'sukhumvit');
  const chips = search.activeFilterChips(c, areaLabels);
  assert.equal(chips[0].label, 'ทำเล: สุขุมวิท');
  assert.equal(chips[0].href, '/search?type=condo');
  assert.equal(search.searchTitle(parse('area=sukhumvit'), areaLabels), 'ห้องเช่า สุขุมวิท');
  assert.equal(search.searchTitle(parse('area=sukhumvit&q=อโศก'), areaLabels), 'ผลการค้นหา “อโศก”', 'a keyword still wins');
  assert.equal(search.searchHref(search.clearedFilters(c)), '/search');
  // An unknown slug keeps its own text rather than an empty chip.
  assert.equal(search.activeFilterChips(parse('area=old-area'), areaLabels)[0].label, 'ทำเล: old-area');
});
