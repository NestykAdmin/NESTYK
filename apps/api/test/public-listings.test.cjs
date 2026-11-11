const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename,
  }).outputText, filename);
};
const { NotFoundException, BadRequestException } = require('@nestjs/common');
const { toPublicRoomCard, toPublicRoomDetail, nearestRailStation } = require('../src/public-listings/public-room-mapper.ts');
const { PUBLIC_AREAS, areaOfDistrict } = require('../src/public-listings/public-areas.ts');
const { PublicRoomsService, pickRail } = require('../src/public-listings/public-rooms.service.ts');
const { PublicRoomsController, PublicAreasController, PUBLIC_CACHE_CONTROL } = require('../src/public-listings/public-rooms.controller.ts');

const NOW = new Date('2026-11-11T10:00:00.000Z');

/** A published room as TypeORM loads it, with every private field filled so a leak is visible. */
function roomRow(overrides = {}) {
  return {
    id: 41,
    room_id: 'A-1203',
    listing_title: 'INTERNAL agent note: owner wants quick deal',
    promo_title: 'คอนโดใกล้ BTS อโศก วิวเมือง',
    listing_description: 'ห้องสวย พร้อมเข้าอยู่',
    available_from_date: '2026-11-01',
    latitude: '13.7368000',
    longitude: '100.5602000',
    nearby_places: [
      { placeId: 'p1', name: 'Terminal 21', type: 'shopping_mall', distanceMeters: 120, latitude: 1, longitude: 1 },
      { placeId: 'p2', name: 'MRT Sukhumvit', type: 'subway_station', distanceMeters: 400, latitude: 1, longitude: 1 },
      { placeId: 'p3', name: 'Asok', type: 'train_station', vicinity: 'BTS Skytrain', distanceMeters: 250, latitude: 1, longitude: 1 },
      { placeId: 'p4', name: 'Bus stop Asok', type: 'bus_station', distanceMeters: 30, latitude: 1, longitude: 1 },
    ],
    owner_identity_number: '1103700000000',
    owner_bank_name: 'SECRET BANK',
    owner_bank_account: '123-4-56789-0',
    created_by_user_id: 7,
    property_owner_id: 3,
    owner_id: null,
    is_scout_room: true,
    visibility: 'published',
    view_count: 99,
    custom_facilities: ['owner phone 081-000-0000'],
    deposit_months: 2,
    advance_rent_months: 1,
    created_at: new Date('2026-11-05T00:00:00.000Z'),
    updated_at: new Date('2026-11-10T00:00:00.000Z'),
    property: {
      name: 'Ashton Asoke', district: 'วัฒนา', subdistrict: 'คลองเตยเหนือ', address: '115 Sukhumvit 21 SECRET',
      province: 'กรุงเทพมหานคร', latitude: '13.7370000', longitude: '100.5600000',
      property_type: { code: 'condo' },
    },
    room_type: { code: 'one_bedroom', bedroom_count: 1 },
    room_status: { code: 'available' },
    medias: [
      { id: 2, media_url: 'https://cdn/x/second.jpg', media_type: 'image', is_cover: false, sort_order: 1 },
      { id: 3, media_url: 'https://cdn/x/video.mp4', media_type: 'video', is_cover: false, sort_order: 0 },
      { id: 1, media_url: 'https://cdn/x/cover.jpg', media_type: 'image', is_cover: true, sort_order: 2 },
    ],
    price_rows: [
      { price: '18000.00', contract_type: { code: 'monthly_6', term_months: 6 } },
      { price: '15000.00', contract_type: { code: 'monthly_12', term_months: 12 } },
    ],
    layout_values: [
      { layout: { code: 'bedroom' }, value: '1' },
      { layout: { code: 'bathroom' }, value: '1' },
      { layout: { code: 'room_size' }, value: '35.5' },
      { layout: { code: 'floor' }, value: '12' },
      { layout: { code: 'building' }, value: 'Tower B' },
    ],
    facilities: [{ facility: { code: 'pet_friendly' } }, { facility: { code: 'pool' } }],
    room_contacts: [{ contact: { name: 'Owner', phone: '0810000000' } }],
    documents: [{ media_url: 'https://cdn/secret/title-deed.pdf' }],
    ...overrides,
  };
}

const SECRETS = [
  'INTERNAL agent note', 'A-1203', '1103700000000', 'SECRET BANK', '123-4-56789-0', '115 Sukhumvit 21 SECRET',
  'owner phone', '0810000000', 'title-deed', 'Tower B', 'video.mp4',
];

function assertNoSecrets(value) {
  const text = JSON.stringify(value);
  for (const secret of SECRETS) assert.ok(!text.includes(secret), `leaked: ${secret}`);
}

test('a public card carries only whitelisted fields and nothing private', () => {
  const card = toPublicRoomCard(roomRow(), NOW);
  assert.deepEqual(Object.keys(card).sort(), [
    'areaSqm', 'availableFrom', 'bathrooms', 'bedrooms', 'coverImageUrl', 'district', 'id', 'isNew', 'latitude',
    'longitude', 'nearestStation', 'petFriendly', 'priceFrom', 'projectName', 'propertyType', 'shortTermAvailable', 'title',
  ]);
  assertNoSecrets(card);
  assert.equal(card.id, '41');
  assert.equal(card.title, 'คอนโดใกล้ BTS อโศก วิวเมือง');
  assert.equal(card.propertyType, 'condo');
  assert.equal(card.projectName, 'Ashton Asoke');
  assert.equal(card.district, 'วัฒนา');
  assert.equal(card.priceFrom, 15000);
  assert.equal(card.bedrooms, 1);
  assert.equal(card.bathrooms, 1);
  assert.equal(card.areaSqm, 35.5);
  assert.equal(card.coverImageUrl, 'https://cdn/x/cover.jpg');
  // Rounded to 3 decimals (about 100 m) so a house is never pinned to its door (R2, Mos 11 Nov 2026).
  assert.equal(card.latitude, 13.737);
  assert.equal(card.longitude, 100.56);
  assert.equal(card.availableFrom, '2026-11-01');
  assert.equal(card.petFriendly, true);
  assert.equal(card.shortTermAvailable, true);
  assert.equal(card.isNew, true);
});

test('a detail adds the description, photos, amenities, price options and floor, still nothing private', () => {
  const detail = toPublicRoomDetail(roomRow(), NOW);
  assertNoSecrets(detail);
  assert.equal(detail.description, 'ห้องสวย พร้อมเข้าอยู่');
  assert.deepEqual(detail.imageUrls, ['https://cdn/x/cover.jpg', 'https://cdn/x/second.jpg']);
  assert.deepEqual(detail.amenityCodes, ['pet_friendly', 'pool']);
  assert.deepEqual(detail.priceOptions, [
    { durationMonths: 6, pricePerMonth: 18000, depositAmount: 36000 },
    { durationMonths: 12, pricePerMonth: 15000, depositAmount: 30000 },
  ]);
  assert.equal(detail.floor, 12);
});

test('without a public headline the title is left empty for the web to build from the project and room type', () => {
  for (const promo of [null, '', '   ']) {
    const card = toPublicRoomCard(roomRow({ promo_title: promo }), NOW);
    assert.equal(card.title, null);
    assertNoSecrets(card);
  }
});

test('missing data gives nulls, not invented values', () => {
  const card = toPublicRoomCard(roomRow({
    medias: [], layout_values: [], room_type: null, nearby_places: [], facilities: [],
    latitude: null, longitude: null, price_rows: [{ price: '9000.00', contract_type: { term_months: 12 } }],
    property: { name: 'P', district: 'บางนา', property_type: null, latitude: '13.6', longitude: '100.6' },
    created_at: new Date('2026-09-01T00:00:00.000Z'),
  }), NOW);
  assert.equal(card.coverImageUrl, null);
  assert.equal(card.bedrooms, null);
  assert.equal(card.bathrooms, null);
  assert.equal(card.areaSqm, null);
  assert.equal(card.propertyType, null);
  assert.equal(card.nearestStation, null);
  assert.equal(card.latitude, 13.6, 'falls back to the building position');
  assert.equal(card.petFriendly, false);
  assert.equal(card.shortTermAvailable, false);
  assert.equal(card.isNew, false);
  assert.equal(card.bedrooms, null);
});

test('bedrooms come from the room type when the layout has no bedroom value', () => {
  const card = toPublicRoomCard(roomRow({ layout_values: [], room_type: { bedroom_count: 0 } }), NOW);
  assert.equal(card.bedrooms, 0);
});

test('the nearest station is the closest BTS or MRT, never a bus stop or another place', () => {
  assert.deepEqual(nearestRailStation(roomRow().nearby_places), { type: 'BTS', name: 'Asok', distanceMeters: 250 });
  assert.equal(nearestRailStation([{ name: 'Bus stop', type: 'bus_station', distanceMeters: 10 }]), null);
  assert.equal(nearestRailStation([{ name: 'Airport Rail Link Makkasan', type: 'train_station', distanceMeters: 10 }]), null);
  assert.equal(nearestRailStation(null), null);
  assert.deepEqual(
    nearestRailStation([{ name: 'MRT Phetchaburi', type: 'subway_station', distanceMeters: 640.4 }]),
    { type: 'MRT', name: 'Phetchaburi', distanceMeters: 640 },
  );
});

test('popular areas have English slugs and match the district names stored for buildings', () => {
  for (const area of PUBLIC_AREAS) assert.match(area.slug, /^[a-z0-9-]+$/, area.slug);
  assert.equal(new Set(PUBLIC_AREAS.map((area) => area.slug)).size, PUBLIC_AREAS.length);
  assert.equal(areaOfDistrict('วัฒนา')?.slug, 'sukhumvit-asok');
  assert.equal(areaOfDistrict(' เขตวัฒนา ')?.slug, 'sukhumvit-asok');
  assert.equal(areaOfDistrict('Watthana')?.slug, 'sukhumvit-asok');
  assert.equal(areaOfDistrict('ที่ไม่มีในรายการ'), null);
  assert.equal(areaOfDistrict(null), null);
});

test('rails: recommended puts rooms with photos first, near transit keeps stations within 800 m nearest first, new keeps the newest', () => {
  const cards = [
    { id: '1', coverImageUrl: null, nearestStation: { type: 'BTS', name: 'A', distanceMeters: 900 } },
    { id: '2', coverImageUrl: 'x', nearestStation: { type: 'MRT', name: 'B', distanceMeters: 300 } },
    { id: '3', coverImageUrl: null, nearestStation: null },
    { id: '4', coverImageUrl: 'y', nearestStation: { type: 'BTS', name: 'C', distanceMeters: 100 } },
  ];
  assert.deepEqual(pickRail(cards, 'recommended', 3).map((c) => c.id), ['2', '4', '1']);
  assert.deepEqual(pickRail(cards, 'near_transit', 8).map((c) => c.id), ['4', '2']);
  assert.deepEqual(pickRail(cards, 'new', 2).map((c) => c.id), ['1', '2']);
});

/**
 * Repository double. The query builder records every call; getRawMany/getRawOne give the ids of `rows`
 * (or `raw` when given, for the areas summary). find() returns the matching rows in REVERSE order so a test
 * can see that the service puts them back in the order of the ids.
 */
function fakeRepo(rows, { raw, failFind = 0 } = {}) {
  const calls = [];
  const finds = [];
  let failures = failFind;
  const qb = {};
  for (const method of ['innerJoin', 'leftJoin', 'leftJoinAndSelect', 'where', 'andWhere', 'orderBy', 'addOrderBy', 'take', 'limit', 'select', 'addSelect']) {
    qb[method] = (...args) => { calls.push([method, ...args]); return qb; };
  }
  const rawRows = () => raw ?? rows.map((row) => ({ id: row.id }));
  qb.getMany = async () => rows;
  qb.getOne = async () => rows[0] ?? null;
  qb.getRawMany = async () => { calls.push(['getRawMany']); return rawRows(); };
  qb.getRawOne = async () => { calls.push(['getRawOne']); return rawRows()[0]; };
  const repo = {
    createQueryBuilder: (alias) => { calls.push(['createQueryBuilder', alias]); return qb; },
    find: async (options) => {
      finds.push(options);
      if (failures > 0) { failures -= 1; throw new Error('database down'); }
      const ids = options.where.id.value.map(Number);
      return rows.filter((row) => ids.includes(Number(row.id))).reverse();
    },
  };
  return { calls, finds, repo };
}

function whereText(calls) {
  return calls.filter(([m]) => m === 'where' || m === 'andWhere').map(([, sql, params]) => `${sql} ${JSON.stringify(params ?? {})}`).join(' | ');
}

test('every public query keeps to published, available rooms of agents that have a price', async () => {
  for (const run of [
    (service) => service.featured('recommended', 4),
    (service) => service.detail('41'),
    (service) => service.areas(6),
  ]) {
    const { calls, repo } = fakeRepo([roomRow()]);
    await run(new PublicRoomsService(repo, () => NOW));
    const where = whereText(calls);
    assert.match(where, /room\.is_scout_room = TRUE/);
    assert.match(where, /room\.visibility = :published.*"published":"published"/);
    assert.match(where, /roomStatus\.code = :available.*"available":"available"/);
    // A price of 0 is not a price (R6).
    assert.match(where, /EXISTS \(SELECT 1 FROM rent_room_prices price WHERE price\.rent_room_id = room\.id AND price\.price > 0\)/);
  }
});

test('a room that is not public (rented, private, unknown or a bad id) is a 404', async () => {
  const empty = new PublicRoomsService(fakeRepo([]).repo, () => NOW);
  await assert.rejects(() => empty.detail('41'), NotFoundException);
  for (const bad of ['abc', '-1', '0', '41; drop', '99999999999', '']) {
    const { calls, repo } = fakeRepo([roomRow()]);
    await assert.rejects(() => new PublicRoomsService(repo, () => NOW).detail(bad), NotFoundException, bad);
    assert.equal(calls.length, 0, `no query for ${bad}`);
  }
});

test('featured caps the number of rooms and rejects an unknown rail', async () => {
  const rows = Array.from({ length: 30 }, (_, i) => roomRow({ id: i + 1 }));
  const service = new PublicRoomsService(fakeRepo(rows).repo, () => NOW);
  assert.equal((await service.featured('recommended', 500)).length, 12);
  assert.equal((await service.featured('new', undefined)).length, 8);
  assert.equal((await service.featured(undefined, 3)).length, 3);
  await assert.rejects(() => service.featured('popular', 4), BadRequestException);
});

test('areas count rooms and the lowest price per popular area from one summary query, and skip areas with no rooms', async () => {
  const raw = [
    { id: 1, district: 'วัฒนา', price_from: '15000.00', cover: null },
    { id: 2, district: 'เขตวัฒนา', price_from: '12000.00', cover: 'https://cdn/x/cover.jpg' },
    { id: 3, district: 'นอกรายการ', price_from: '5000.00', cover: 'https://cdn/x/other.jpg' },
    { id: 4, district: 'สาทร', price_from: null, cover: null },
  ];
  const { calls, finds, repo } = fakeRepo([], { raw });
  const areas = await new PublicRoomsService(repo, () => NOW).areas(6);
  assert.deepEqual(areas.map((area) => area.slug), ['sukhumvit-asok', 'silom-sathorn']);
  assert.equal(areas[0].roomCount, 2);
  assert.equal(areas[0].priceFrom, 12000);
  assert.equal(areas[0].coverImageUrl, 'https://cdn/x/cover.jpg');
  assert.equal(areas[1].priceFrom, null);
  assert.ok(Array.isArray(areas[0].transitLines));
  // No photos or prices are loaded row by row: the database sums them up (R1).
  assert.equal(calls.filter(([method]) => method === 'leftJoinAndSelect').length, 0);
  assert.equal(finds.length, 0);
  assert.deepEqual(calls.filter(([m]) => m === 'orderBy' || m === 'limit'), [['orderBy', 'room.created_at', 'DESC'], ['limit', 1000]]);
  assert.match(calls.filter(([m]) => m === 'addSelect').map(([, sql]) => sql).join(' '), /MIN\(.*price.*\).*price > 0/s);
  assertNoSecrets(areas);
});

test('featured and detail pick ids first, then load each relation in its own query, never one join of every list (R1)', async () => {
  const rows = [roomRow({ id: 3 }), roomRow({ id: 2 }), roomRow({ id: 1 })];
  for (const run of [(service) => service.featured('new', 8), (service) => service.detail('3')]) {
    const { calls, finds, repo } = fakeRepo(rows);
    const result = await run(new PublicRoomsService(repo, () => NOW));
    assert.equal(calls.filter(([method]) => method === 'leftJoinAndSelect').length, 0, 'no joined lists');
    assert.equal(finds.length, 1);
    assert.equal(finds[0].relationLoadStrategy, 'query');
    const ordered = JSON.stringify(calls.filter(([m]) => m === 'orderBy' || m === 'addOrderBy' || m === 'limit'));
    for (const relation of ['medias', 'price_rows', 'layout_values', 'facilities']) assert.ok(finds[0].relations.includes(relation), relation);
    if (Array.isArray(result)) {
      assert.deepEqual(result.map((card) => card.id), ['3', '2', '1'], 'newest first, as the ids came');
      // Step 1 picks the newest 120 public rooms (rails choose from these).
      assert.equal(ordered, JSON.stringify([['orderBy', 'room.created_at', 'DESC'], ['addOrderBy', 'room.id', 'DESC'], ['limit', 120]]));
    }
    else assert.equal(result.id, '3');
  }
});

test('the three home rails share one load of the newest rooms for 60 seconds', async () => {
  let clock = NOW.getTime();
  const { calls, finds, repo } = fakeRepo([roomRow({ id: 1 })]);
  const service = new PublicRoomsService(repo, () => new Date(clock));
  await Promise.all([service.featured('recommended', 8), service.featured('near_transit', 8), service.featured('new', 8)]);
  assert.equal(finds.length, 1);
  assert.equal(calls.filter(([method]) => method === 'getRawMany').length, 1);
  clock += 59_000;
  await service.featured('new', 8);
  assert.equal(finds.length, 1, 'still fresh');
  clock += 2_000;
  await service.featured('new', 8);
  assert.equal(finds.length, 2, 'loaded again after 60 seconds');
});

test('a failed load is not kept, so the next visitor tries again', async () => {
  const { finds, repo } = fakeRepo([roomRow({ id: 1 })], { failFind: 1 });
  const service = new PublicRoomsService(repo, () => NOW);
  await assert.rejects(() => service.featured('new', 8), /database down/);
  assert.equal((await service.featured('new', 8)).length, 1);
  assert.equal(finds.length, 2);
});

test('positions are rounded to about 100 m, for the room and for the building it falls back to (R2)', () => {
  const card = toPublicRoomCard(roomRow({ latitude: null, longitude: null,
    property: { name: 'P', district: 'บางนา', latitude: '13.6684719', longitude: '100.6045501' } }), NOW);
  assert.equal(card.latitude, 13.668);
  assert.equal(card.longitude, 100.605);
});

test('public routes need no sign-in and are cached for a short time', () => {
  for (const Controller of [PublicRoomsController, PublicAreasController]) {
    assert.equal(Reflect.getMetadata('__guards__', Controller), undefined, `${Controller.name} has no guard`);
  }
  assert.equal(Reflect.getMetadata('path', PublicRoomsController), 'public/rooms');
  assert.equal(Reflect.getMetadata('path', PublicAreasController), 'public/areas');
  assert.match(PUBLIC_CACHE_CONTROL, /^public, max-age=60, s-maxage=300/);
  const proto = PublicRoomsController.prototype;
  for (const handler of [proto.featured, proto.detail, PublicAreasController.prototype.list]) {
    const headers = Reflect.getMetadata('__headers__', handler) ?? [];
    assert.ok(headers.some((h) => h.name === 'Cache-Control' && h.value === PUBLIC_CACHE_CONTROL), handler.name);
    assert.equal(Reflect.getMetadata('__guards__', handler), undefined, `${handler.name} has no guard`);
  }
});
