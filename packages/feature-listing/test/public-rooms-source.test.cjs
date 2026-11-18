const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { createInMemoryPublicRoomsSource, createApiPublicRoomsSource, createPublicRoomsSource, PUBLIC_ROOM_CARD_KEYS } = require('../src/public-rooms-source.ts');
const { SAMPLE_PUBLIC_ROOMS } = require('../src/public-rooms-sample.ts');

const TODAY = '2026-11-11';
let seq = 0;
const room = (over = {}) => {
  seq += 1;
  return {
    id: `r${seq}`, title: `Room ${seq}`, propertyType: 'condo', projectName: null, district: null,
    priceFrom: 10000, bedrooms: 1, bathrooms: 1, areaSqm: 30, coverImageUrl: null,
    latitude: null, longitude: null, nearestStation: null, availableFrom: null,
    petFriendly: false, shortTermAvailable: false, isNew: false,
    description: '', imageUrls: [], amenityCodes: [], floor: null,
    priceOptions: [{ durationMonths: 12, pricePerMonth: 10000, depositAmount: 20000 }],
    ...over,
  };
};
const query = (over = {}) => ({ mode: 'rent', quick: [], sortBy: 'newest', page: 1, limit: 12, ...over });
const make = (rooms, options = {}) => createInMemoryPublicRoomsSource(rooms, { today: () => TODAY, ...options });
const ids = (result) => result.items.map((r) => r.id);

test('search matches the keyword against title, project, district and station, ignoring case', async () => {
  const source = make([
    room({ id: 'a', title: 'Nest Haus studio' }),
    room({ id: 'b', projectName: 'The NEST Ari' }),
    room({ id: 'c', district: 'Nestville' }),
    room({ id: 'd', nearestStation: { type: 'BTS', name: 'nest station', distanceMeters: 100 } }),
    room({ id: 'e', title: 'Other' }),
  ]);
  assert.deepEqual(ids(await source.search(query({ keyword: 'NEST' }))), ['a', 'b', 'c', 'd']);
});

test('search keeps rooms inside the price range, limits included, and drops rooms without a price', async () => {
  const source = make([room({ id: 'a', priceFrom: 8000 }), room({ id: 'b', priceFrom: 10000 }), room({ id: 'c', priceFrom: 20000 }), room({ id: 'd', priceFrom: 25000 }), room({ id: 'x', priceFrom: null })]);
  assert.deepEqual(ids(await source.search(query({ minPrice: 10000, maxPrice: 20000 }))), ['b', 'c']);
  assert.deepEqual(ids(await source.search(query({ maxPrice: 9000 }))), ['a']);
});

test('search by property type and bedroom count, where 0 means studio', async () => {
  const source = make([room({ id: 'a', bedrooms: 0 }), room({ id: 'b', bedrooms: 2 }), room({ id: 'c', bedrooms: 2, propertyType: 'house' })]);
  assert.deepEqual(ids(await source.search(query({ bedrooms: [0] }))), ['a']);
  assert.deepEqual(ids(await source.search(query({ bedrooms: [2], propertyType: ['house'] }))), ['c']);
});

test('search by station type and name', async () => {
  const source = make([
    room({ id: 'a', nearestStation: { type: 'BTS', name: 'อโศก', distanceMeters: 200 } }),
    room({ id: 'b', nearestStation: { type: 'MRT', name: 'อโศก', distanceMeters: 300 } }),
    room({ id: 'c', nearestStation: { type: 'BTS', name: 'อารีย์', distanceMeters: 200 } }),
  ]);
  assert.deepEqual(ids(await source.search(query({ stationType: 'BTS' }))), ['a', 'c']);
  assert.deepEqual(ids(await source.search(query({ stationType: 'BTS', stationName: 'อโศก' }))), ['a']);
});

test('search by duration needs a price option for that duration', async () => {
  const source = make([
    room({ id: 'a', priceOptions: [{ durationMonths: 3, pricePerMonth: 9000, depositAmount: null }] }),
    room({ id: 'b', priceOptions: [{ durationMonths: 12, pricePerMonth: 8000, depositAmount: null }] }),
  ]);
  assert.deepEqual(ids(await source.search(query({ durationMonths: 3 }))), ['a']);
});

test('quick filters: near transit means a station within 800 m', async () => {
  const source = make([
    room({ id: 'near', nearestStation: { type: 'BTS', name: 'x', distanceMeters: 800 } }),
    room({ id: 'far', nearestStation: { type: 'BTS', name: 'x', distanceMeters: 801 } }),
    room({ id: 'none' }),
  ]);
  assert.deepEqual(ids(await source.search(query({ quick: ['nearTransit'] }))), ['near']);
});

test('quick filters: move-in ready excludes rooms that free up after today', async () => {
  const source = make([room({ id: 'unknown' }), room({ id: 'past', availableFrom: '2026-10-01' }), room({ id: 'today', availableFrom: TODAY }), room({ id: 'later', availableFrom: '2026-12-01' })]);
  assert.deepEqual(ids(await source.search(query({ quick: ['moveInReady'] }))), ['unknown', 'past', 'today']);
});

test('quick filters: pet friendly and short term, and several chips must all match', async () => {
  const source = make([room({ id: 'a', petFriendly: true }), room({ id: 'b', shortTermAvailable: true }), room({ id: 'c', petFriendly: true, shortTermAvailable: true })]);
  assert.deepEqual(ids(await source.search(query({ quick: ['petFriendly'] }))), ['a', 'c']);
  assert.deepEqual(ids(await source.search(query({ quick: ['petFriendly', 'shortTerm'] }))), ['c']);
});

test('sorting by price puts rooms without a price last', async () => {
  const source = make([room({ id: 'mid', priceFrom: 15000 }), room({ id: 'none', priceFrom: null }), room({ id: 'low', priceFrom: 9000 }), room({ id: 'high', priceFrom: 30000 })]);
  assert.deepEqual(ids(await source.search(query({ sortBy: 'price_asc' }))), ['low', 'mid', 'high', 'none']);
  assert.deepEqual(ids(await source.search(query({ sortBy: 'price_desc' }))), ['high', 'mid', 'low', 'none']);
});

test('newest keeps the order the rooms were given in', async () => {
  const source = make([room({ id: 'first' }), room({ id: 'second' }), room({ id: 'third' })]);
  assert.deepEqual(ids(await source.search(query())), ['first', 'second', 'third']);
});

test('recommended puts rooms with a photo first and keeps the given order within each group', async () => {
  const source = make([room({ id: 'a' }), room({ id: 'b', coverImageUrl: 'x' }), room({ id: 'c' }), room({ id: 'd', coverImageUrl: 'y' })]);
  assert.deepEqual(ids(await source.search(query({ sortBy: 'recommended' }))), ['b', 'd', 'a', 'c']);
});

test('move-in: now, within 30 days or within 90 days; no date means now', async () => {
  const source = make([
    room({ id: 'none', availableFrom: null }), room({ id: 'past', availableFrom: '2026-10-01' }),
    room({ id: 'd20', availableFrom: '2026-12-01' }), room({ id: 'd70', availableFrom: '2027-01-20' }),
    room({ id: 'd200', availableFrom: '2027-06-01' }),
  ]);
  assert.deepEqual(ids(await source.search(query({ moveIn: 'now' }))), ['none', 'past']);
  assert.deepEqual(ids(await source.search(query({ moveIn: '30d' }))), ['none', 'past', 'd20']);
  assert.deepEqual(ids(await source.search(query({ moveIn: '90d' }))), ['none', 'past', 'd20', 'd70']);
});

test('three bedrooms also matches bigger rooms (3+)', async () => {
  const source = make([room({ id: 'two', bedrooms: 2 }), room({ id: 'three', bedrooms: 3 }), room({ id: 'five', bedrooms: 5 })]);
  assert.deepEqual(ids(await source.search(query({ bedrooms: [3] }))), ['three', 'five']);
});

test('nearby GPS keeps rooms inside the radius, sorted by distance when asked', async () => {
  const origin = { latitude: 13.7367, longitude: 100.5608 };
  const source = make([
    room({ id: 'far', latitude: 13.8, longitude: 100.6 }),
    room({ id: 'close', latitude: 13.7370, longitude: 100.5610 }),
    room({ id: 'mid', latitude: 13.7500, longitude: 100.5700 }),
    room({ id: 'nocoords' }),
  ]);
  const result = await source.search(query({ nearGps: { ...origin, radiusKm: 3 }, sortBy: 'distance' }));
  assert.deepEqual(ids(result), ['close', 'mid']);
});

test('pagination slices the matches but total counts all of them', async () => {
  const source = make(Array.from({ length: 5 }, (_, i) => room({ id: `p${i}` })));
  const page2 = await source.search(query({ page: 2, limit: 2 }));
  assert.deepEqual(ids(page2), ['p2', 'p3']);
  assert.equal(page2.total, 5);
  assert.equal(page2.page, 2);
  assert.equal(page2.limit, 2);
  assert.deepEqual(ids(await source.search(query({ page: 9, limit: 2 }))), []);
});

test('buy mode returns nothing because there are no sale listings yet', async () => {
  const source = make([room({ id: 'a' })]);
  const result = await source.search(query({ mode: 'buy' }));
  assert.deepEqual(result, { items: [], total: 0, page: 1, limit: 12 });
});

test('cards leave out the detail-only fields', async () => {
  const source = make([room({ id: 'a', description: 'secret-ish', imageUrls: ['x.jpg'] })]);
  const [card] = (await source.search(query())).items;
  assert.deepEqual(Object.keys(card).sort(), [...PUBLIC_ROOM_CARD_KEYS].sort());
});

test('featured returns the first rooms up to the limit', async () => {
  const source = make([room({ id: 'a' }), room({ id: 'b' }), room({ id: 'c' })]);
  assert.deepEqual((await source.featured('new', 2)).map((r) => r.id), ['a', 'b']);
});

test('featured rails: recommended puts rooms with photos first, near transit keeps stations within 800 m nearest first', async () => {
  const source = make([
    room({ id: 'a', coverImageUrl: null, nearestStation: { type: 'BTS', name: 'A', distanceMeters: 900 } }),
    room({ id: 'b', coverImageUrl: 'b.jpg', nearestStation: { type: 'MRT', name: 'B', distanceMeters: 400 } }),
    room({ id: 'c', coverImageUrl: 'c.jpg', nearestStation: { type: 'BTS', name: 'C', distanceMeters: 100 } }),
  ]);
  assert.deepEqual((await source.featured('recommended', 3)).map((r) => r.id), ['b', 'c', 'a']);
  assert.deepEqual((await source.featured('near_transit', 3)).map((r) => r.id), ['c', 'b']);
  assert.deepEqual((await source.featured()).map((r) => r.id), ['b', 'c', 'a']);
});

test('detail returns the full room, or null for an unknown id', async () => {
  const source = make([room({ id: 'a', description: 'full text', imageUrls: ['x.jpg'] })]);
  const detail = await source.detail('a');
  assert.equal(detail.description, 'full text');
  assert.deepEqual(detail.imageUrls, ['x.jpg']);
  assert.equal(await source.detail('missing'), null);
});

test('areas are keyed by English slug, count rooms and take the lowest price per area, most rooms first', async () => {
  const meta = {
    'ladprao-chatuchak': { name: 'ลาดพร้าว จตุจักร', districts: ['ลาดพร้าว'], transitLines: ['mrt_blue'] },
    'sukhumvit-asok': { name: 'สุขุมวิท อโศก', districts: ['อโศก', 'ทองหล่อ'], transitLines: ['bts_sukhumvit', 'mrt_blue'] },
  };
  for (const slug of Object.keys(meta)) assert.match(slug, /^[a-z-]+$/);
  const source = make([
    room({ district: 'อโศก', priceFrom: 12000 }), room({ district: 'ทองหล่อ', priceFrom: 9000 }), room({ district: 'ลาดพร้าว', priceFrom: 15000 }),
    room({ district: 'ไม่มีข้อมูลย่าน', priceFrom: 5000 }),
  ], { areaMeta: meta });
  const areas = await source.areas();
  assert.deepEqual(areas.map((a) => [a.slug, a.roomCount, a.priceFrom]), [['sukhumvit-asok', 2, 9000], ['ladprao-chatuchak', 1, 15000]]);
  assert.deepEqual(areas[0].transitLines, ['bts_sukhumvit', 'mrt_blue']);
  assert.equal(areas[0].name, 'สุขุมวิท อโศก');
  assert.equal((await source.areas(1)).length, 1);
});

test('sample rooms only carry whitelisted fields and have unique ids', () => {
  const allowed = new Set([...PUBLIC_ROOM_CARD_KEYS, 'description', 'imageUrls', 'amenityCodes', 'priceOptions', 'floor']);
  for (const r of SAMPLE_PUBLIC_ROOMS) {
    for (const key of Object.keys(r)) assert.ok(allowed.has(key), `unexpected field ${key}`);
  }
  assert.equal(new Set(SAMPLE_PUBLIC_ROOMS.map((r) => r.id)).size, SAMPLE_PUBLIC_ROOMS.length);
  assert.ok(SAMPLE_PUBLIC_ROOMS.length >= 8);
});

test('the sample source refuses to run in production', () => {
  assert.throws(() => createPublicRoomsSource({ kind: 'sample' }, { isProduction: true }), /production/i);
  assert.ok(createPublicRoomsSource({ kind: 'sample' }, { isProduction: false }));
});

test('the API source needs a base URL', () => {
  assert.throws(() => createPublicRoomsSource({ kind: 'api', baseUrl: '' }, { isProduction: true }), /baseUrl/);
});

function fakeFetch(handler) {
  const calls = [];
  const impl = async (url) => { calls.push(String(url)); return handler(String(url)); };
  return { impl, calls };
}
const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('the API source sends the search as query parameters and reads the result', async () => {
  const payload = { items: [], total: 0, page: 2, limit: 24 };
  const { impl, calls } = fakeFetch(() => json(payload));
  const source = createApiPublicRoomsSource({ baseUrl: 'https://api.example.test/', fetchImpl: impl });
  const result = await source.search(query({ keyword: 'อโศก', propertyType: ['condo'], minPrice: 8000, bedrooms: [0, 1], quick: ['petFriendly'], moveIn: '30d', sortBy: 'price_asc', page: 2, limit: 24 }));
  assert.deepEqual(result, payload);
  const url = new URL(calls[0]);
  assert.equal(url.origin + url.pathname, 'https://api.example.test/public/rooms/search');
  assert.equal(url.searchParams.get('q'), 'อโศก');
  assert.equal(url.searchParams.get('type'), 'condo');
  assert.equal(url.searchParams.get('min'), '8000');
  assert.equal(url.searchParams.get('beds'), '0,1');
  assert.equal(url.searchParams.get('quick'), 'petFriendly');
  assert.equal(url.searchParams.get('sort'), 'price_asc');
  assert.equal(url.searchParams.get('movein'), '30d');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(url.searchParams.get('limit'), '24');
});

test('the API source returns null for a missing room and throws on server errors', async () => {
  const notFound = createApiPublicRoomsSource({ baseUrl: 'https://api.example.test', fetchImpl: fakeFetch(() => json({}, 404)).impl });
  assert.equal(await notFound.detail('abc'), null);
  const broken = createApiPublicRoomsSource({ baseUrl: 'https://api.example.test', fetchImpl: fakeFetch(() => json({}, 500)).impl });
  await assert.rejects(() => broken.featured(), /500/);
});

test('the API source encodes the room id in the path', async () => {
  const { impl, calls } = fakeFetch(() => json(room({ id: 'a/b' })));
  const source = createApiPublicRoomsSource({ baseUrl: 'https://api.example.test', fetchImpl: impl });
  await source.detail('a/b c');
  assert.equal(calls[0], 'https://api.example.test/public/rooms/a%2Fb%20c');
});

test('the API source asks for the rail and limit of the featured list', async () => {
  const { impl, calls } = fakeFetch(() => json([]));
  const source = createApiPublicRoomsSource({ baseUrl: 'https://api.example.test/', fetchImpl: impl });
  await source.featured('near_transit', 4);
  await source.featured();
  await source.areas(6);
  assert.equal(calls[0], 'https://api.example.test/public/rooms/featured?rail=near_transit&limit=4');
  assert.equal(calls[1], 'https://api.example.test/public/rooms/featured?rail=recommended');
  assert.equal(calls[2], 'https://api.example.test/public/areas?limit=6');
});

test('sample areas use English slugs and transit line codes', () => {
  const { SAMPLE_AREA_META } = require('../src/public-rooms-source.ts');
  for (const [slug, area] of Object.entries(SAMPLE_AREA_META)) {
    assert.match(slug, /^[a-z0-9-]+$/, slug);
    for (const code of area.transitLines) assert.match(code, /^(bts|mrt|arl)_?[a-z]*$/, code);
  }
});

test('station name ignores letter case, like the API', async () => {
  const source = make([room({ id: 'a', nearestStation: { type: 'BTS', name: 'Asok', distanceMeters: 200 } })]);
  assert.deepEqual(ids(await source.search(query({ stationName: 'asok' }))), ['a']);
});
