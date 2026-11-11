const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);

const home = require('./guest-home.ts');

const labels = {
  titleFallback: '{name} · {rooms}',
  roomFallback: 'ห้องเช่า',
  propertyType: { condo: 'คอนโด', apartment: 'อพาร์ทเมนต์', house: 'บ้าน', townhome: 'ทาวน์โฮม' },
};

test('a card with a public headline shows it as is', () => {
  assert.equal(home.roomDisplayTitle({ title: 'คอนโดวิวสวย', projectName: 'X', propertyType: 'condo' }, labels, '1 ห้องนอน'), 'คอนโดวิวสวย');
});

test('without a headline the title is built from the project (or type) and the room size, never the agent note', () => {
  assert.equal(home.roomDisplayTitle({ title: null, projectName: 'Ashton Asoke', propertyType: 'condo' }, labels, '1 ห้องนอน'), 'Ashton Asoke · 1 ห้องนอน');
  assert.equal(home.roomDisplayTitle({ title: null, projectName: null, propertyType: 'condo' }, labels, 'สตูดิโอ'), 'คอนโด · สตูดิโอ');
  assert.equal(home.roomDisplayTitle({ title: null, projectName: null, propertyType: null }, labels, null), 'ห้องเช่า');
  assert.equal(home.roomDisplayTitle({ title: '  ', projectName: 'P', propertyType: null }, labels, null), 'P');
});

test('the search box sends the guest to /search with only the values that were chosen', () => {
  assert.equal(home.homeSearchHref({}), '/search');
  assert.equal(home.homeSearchHref({ keyword: '  อโศก ', type: 'condo', price: '10to20k', bedrooms: 'one', quick: ['nearTransit', 'petFriendly'] }),
    '/search?q=%E0%B8%AD%E0%B9%82%E0%B8%A8%E0%B8%81&type=condo&min=10000&max=20000&beds=1&quick=nearTransit%2CpetFriendly');
  assert.equal(home.homeSearchHref({ price: 'under10k', bedrooms: 'threePlus' }), '/search?max=10000&beds=3%2C4%2C5%2C6%2C7%2C8%2C9%2C10');
  assert.equal(home.homeSearchHref({ price: 'over40k', bedrooms: 'studio' }), '/search?min=40000&beds=0');
  // Values that are not in the lists (a tampered form) are dropped.
  assert.equal(home.homeSearchHref({ type: 'castle', price: 'free', bedrooms: 'many', quick: ['hack'] }), '/search');
});

test('price and bedroom choices match the design', () => {
  assert.deepEqual(home.PRICE_RANGES.map((r) => r.id), ['under10k', '10to20k', '20to40k', 'over40k']);
  assert.deepEqual(home.BEDROOM_CHOICES.map((r) => r.id), ['studio', 'one', 'two', 'threePlus']);
  assert.deepEqual(home.HOME_RAILS, ['recommended', 'near_transit', 'new']);
});

test('the location line joins the district and the nearest station', () => {
  assert.equal(home.roomLocationLine({ district: 'วัฒนา', nearestStation: { type: 'BTS', name: 'Asok', distanceMeters: 250 } }), 'วัฒนา · BTS Asok 250 m');
  assert.equal(home.roomLocationLine({ district: null, nearestStation: { type: 'MRT', name: 'Sukhumvit', distanceMeters: 1240 } }), 'MRT Sukhumvit 1.2 km');
  assert.equal(home.roomLocationLine({ district: 'บางนา', nearestStation: null }), 'บางนา');
  assert.equal(home.roomLocationLine({ district: null, nearestStation: null }), null);
});

test('the public API address comes from API_URL (server only), with /api/v1 added', () => {
  assert.equal(home.publicApiBase('https://nestyk-dev.up.railway.app'), 'https://nestyk-dev.up.railway.app/api/v1');
  assert.equal(home.publicApiBase('http://localhost:4000/'), 'http://localhost:4000/api/v1');
  assert.equal(home.publicApiBase(undefined), 'http://localhost:4000/api/v1');
  assert.equal(home.publicApiBase('not a url'), 'http://localhost:4000/api/v1');
});

test('the home page keeps rooms as long as the room loader (Next needs a literal in the page)', () => {
  const page = fs.readFileSync(path.join(__dirname, '../app/[locale]/(marketplace)/page.tsx'), 'utf8');
  const loader = fs.readFileSync(path.join(__dirname, 'guest-rooms.ts'), 'utf8');
  const pageSeconds = Number(page.match(/export const revalidate = (\d+);/)[1]);
  const loaderSeconds = Number(loader.match(/PUBLIC_DATA_REVALIDATE_SECONDS = (\d+);/)[1]);
  assert.equal(pageSeconds, loaderSeconds);
});

test('the home page has no roles section and no reviews or articles (Mos 11 Nov 2026)', () => {
  const page = fs.readFileSync(path.join(__dirname, '../app/[locale]/(marketplace)/page.tsx'), 'utf8');
  for (const id of ['guestHome.roles', 'guestHome.reviews', 'guestHome.articles']) assert.ok(!page.includes(id), id);
});

test('links to /search stay closed until the search page is ready (R4, Mos 11 Nov 2026)', () => {
  assert.equal(home.searchHrefIfReady({ type: 'condo' }, false), null);
  assert.equal(home.searchHrefIfReady({ type: 'condo' }, true), '/search?type=condo');
  assert.equal(home.searchHrefIfReady({}, true), '/search');
  const root = path.join(__dirname, '..', 'app');
  const files = [
    path.join(root, '[locale]', '(marketplace)', 'page.tsx'),
    path.join(root, 'components', 'guest', 'SearchPanel.tsx'),
    path.join(root, 'components', 'guest', 'PropertyTypeTiles.tsx'),
  ];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.ok(!/homeSearchHref\(|'\/search'/.test(source), `${path.basename(file)} must use searchHrefIfReady`);
    assert.match(source, /isGuestPageReady\('search'\)/, path.basename(file));
  }
});

test('"today" for move-in dates is the date in Bangkok, not UTC (R5)', () => {
  assert.equal(home.bangkokToday(new Date('2026-11-11T16:59:00.000Z')), '2026-11-11');
  assert.equal(home.bangkokToday(new Date('2026-11-11T17:00:00.000Z')), '2026-11-12', '00:00 in Bangkok');
  assert.equal(home.bangkokToday(new Date('2026-12-31T20:00:00.000Z')), '2027-01-01');
});

test('a failed API call never replaces a good cached home page in production, but still renders in dev and at build (R3)', () => {
  const prod = { nodeEnv: 'production', nextPhase: 'phase-production-server' };
  assert.equal(home.keepPreviousHomePage({ railsFailed: true, areasFailed: false, ...prod }), true);
  assert.equal(home.keepPreviousHomePage({ railsFailed: false, areasFailed: true, ...prod }), true);
  assert.equal(home.keepPreviousHomePage({ railsFailed: false, areasFailed: false, ...prod }), false);
  assert.equal(home.keepPreviousHomePage({ railsFailed: true, areasFailed: true, nodeEnv: 'production', nextPhase: 'phase-production-build' }), false);
  assert.equal(home.keepPreviousHomePage({ railsFailed: true, areasFailed: true, nodeEnv: 'development', nextPhase: undefined }), false);
  assert.ok(home.PUBLIC_API_TIMEOUT_MS >= 3000 && home.PUBLIC_API_TIMEOUT_MS <= 10000);
  const loader = fs.readFileSync(path.join(__dirname, 'guest-rooms.ts'), 'utf8');
  assert.match(loader, /AbortSignal\.timeout\(PUBLIC_API_TIMEOUT_MS\)/);
  assert.match(loader, /keepPreviousHomePage\(/);
});

test('a production server without API_URL is reported, not silently pointed at localhost (R3)', () => {
  assert.equal(home.apiUrlMissing(undefined, 'production'), true);
  assert.equal(home.apiUrlMissing('not a url', 'production'), true);
  assert.equal(home.apiUrlMissing('https://api.nestyk.com', 'production'), false);
  assert.equal(home.apiUrlMissing(undefined, 'development'), false);
});
