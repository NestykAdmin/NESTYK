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
const { AgentListingsService } = require('../src/agent/listings/agent-listings.service.ts');
const { AgentListingsController } = require('../src/agent/listings/agent-listings.controller.ts');
const { AuthService } = require('../src/auth/auth.service.ts');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const room = {
  id: 22, created_by_user_id: 7, is_scout_room: true, listing_title: 'Test room',
  visibility: 'private', prices: [{ contractTypeCode: 'monthly_12', price: 999 }],
  price_rows: [
    { contract_type_id: 1, price: '15000.00', contract_type: { code: 'monthly_12', term_months: 12 } },
    { contract_type_id: 2, price: '18000.00', contract_type: { code: 'monthly_6', term_months: 6 } },
  ],
  medias: [{ id: 1, media_url: 'first.jpg', media_type: 'image', is_cover: false, sort_order: 0 },
    { id: 2, media_url: 'cover.jpg', media_type: 'image', is_cover: true, sort_order: 1 }],
  room_contacts: [
    { is_primary: true, contact: { id: 3, created_by_user_id: 7, name: 'Own contact', phone: '123' } },
    { is_primary: false, contact: { id: 4, created_by_user_id: 8, name: 'Other agent secret', phone: '456' } },
  ],
  layout_values: [
    { layout: { code: 'bedroom' }, value: '1' },
    { layout: { code: 'room_size' }, value: '35' },
  ],
  room_type: { bedroom_count: 1 },
  updated_at: new Date('2026-01-15T10:00:00.000Z'),
  facilities: [], custom_facilities: [],
  owner_identity_number: 'must-not-leak', documents: [{ id: 1, kind: 'ownership', media_url: 'https://example.com/ownership.pdf', sort_order: 0 }],
};

test('room filters apply before count and pagination, including zero and 4+ bedrooms', async () => {
  const calls = [];
  const qb = {};
  for (const method of ['leftJoin', 'where', 'andWhere', 'select', 'addSelect', 'groupBy', 'orderBy', 'addOrderBy', 'offset', 'limit']) {
    qb[method] = (...args) => { calls.push([method, ...args]); return qb; };
  }
  qb.clone = () => qb;
  qb.getCount = async () => { calls.push(['count']); return 0; };
  qb.getRawMany = async () => [];
  const service = new AgentListingsService({ createQueryBuilder: () => qb });
  await service.listMine(7, { propertyType: 'condo', roomType: 'duplex', bedrooms: '4', minPrice: '0', maxPrice: '25000' });
  const countIndex = calls.findIndex(([method]) => method === 'count');
  for (const key of ['propertyType', 'roomType', 'bedrooms', 'minPrice', 'maxPrice']) {
    const index = calls.findIndex(([method, sql, params]) => method === 'andWhere' && params && key in params);
    assert.ok(index >= 0 && index < countIndex, key);
  }
  assert.ok(calls.some(([method, sql, params]) => params?.bedrooms === 4 && sql.includes('>= :bedrooms')));
  calls.length = 0;
  await service.listMine(7, { bedrooms: '0' });
  assert.ok(calls.some(([method, sql, params]) => params?.bedrooms === 0 && sql.includes('= :bedrooms')));
  for (const query of [{ minPrice: '30000', maxPrice: '10000' }, { minPrice: '-1' }, { maxPrice: 'NaN' }, { bedrooms: '5 OR 1=1' }]) {
    await assert.rejects(service.listMine(7, query), (error) => error.getStatus() === 400);
  }
});

test('detail returns independent lease terms and falls back for legacy rooms', async () => {
  const source = { ...room, advance_rent_months: 1, deposit_months: 2, prices: [
    { contractTypeId: 1, contractTypeCode: 'monthly_12', price: 15000, advanceRentMonths: 0, depositMonths: 3 },
    { contractTypeId: 2, contractTypeCode: 'monthly_6', price: 18000, advanceRentMonths: 2, depositMonths: 1 },
  ] };
  const service = new AgentListingsService({ findOne: async () => source });
  const result = await service.viewMine(7, 22);
  assert.deepEqual(result.prices.map((p) => [p.contractTypeId, p.advanceRentMonths, p.depositMonths]), [[2, 2, 1], [1, 0, 3]]);
  source.prices = [];
  const legacy = await service.viewMine(7, 22);
  assert.ok(legacy.prices.every((p) => p.advanceRentMonths === 1 && p.depositMonths === 2));
});

test('detail endpoint scopes access, returns all prices and cover first, excludes sensitive fields', async (t) => {
  process.env.ALLOW_DEV_AUTH = 'true';
  const service = new AgentListingsService({ findOne: async ({ where }) =>
    where.id === 22 && where.created_by_user_id === 7 && where.is_scout_room ? room : null });
  class TestModule {}
  Module({ controllers: [AgentListingsController], providers: [
    { provide: AgentListingsService, useValue: service },
    { provide: AuthService, useValue: {
      findBySupabaseUserId: async (id) => ({ id: Number(id) }),
      loadUserWithRoles: async (id) => ({ id, roleNames: ['agent'] }),
    } },
  ] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  t.after(() => app.close());
  app.setGlobalPrefix('api/v1');
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const get = (id, agent = 7) => fetch(`${base}/api/v1/agent/listings/${id}`, { headers: { Authorization: `Bearer dev|${agent}|test@example.invalid` } });
  assert.equal((await fetch(`${base}/api/v1/agent/listings/22`)).status, 401);
  assert.equal((await get('abc')).status, 400);
  assert.equal((await get(22, 8)).status, 404);
  assert.equal((await get(99)).status, 404);
  const response = await get(22);
  assert.equal(response.status, 200);
  const detail = await response.json();
  assert.deepEqual(detail.prices.map((p) => p.price), [18000, 15000]);
  assert.equal(detail.medias[0].mediaUrl, 'cover.jpg');
  assert.equal(detail.contacts.length, 1);
  assert.equal(detail.layout[0].value, '1');
  assert.deepEqual(detail.documents, [{ kind: 'ownership', mediaUrl: 'https://example.com/ownership.pdf', sortOrder: 0 }]);
  assert.deepEqual(detail.facilityItems, []);
  assert.deepEqual(detail.customFacilities, []);
  assert.equal(detail.owner_identity_number, undefined);
});

test('list paginates distinct room IDs and uses all normalized prices', async () => {
  const calls = [];
  const qb = {};
  for (const name of ['leftJoin','where','andWhere','select','addSelect','distinct','groupBy','orderBy','addOrderBy','offset','limit']) qb[name] = (...args) => { calls.push([name, ...args]); return qb; };
  qb.clone = () => qb;
  qb.getCount = async () => 41;
  qb.getRawMany = async () => [{ id: 22 }];
  const service = new AgentListingsService({ createQueryBuilder: () => qb, find: async ({ where }) => {
    assert.equal(where.created_by_user_id, 7); return [room];
  } });
  const result = await service.listMine(7, { page: 2, limit: 20, q: 'test', visibility: 'private' });
  assert.equal(result.total, 41);
  assert.equal(result.items[0].prices.length, 2);
  assert.equal(result.items[0].coverMediaUrl, 'cover.jpg');
  assert.equal(result.items[0].bedroomCount, '1');
  assert.equal(result.items[0].roomSizeSqm, '35');
  assert.ok(calls.some(([name, col]) => name === 'groupBy' && col === 'room.id'));
  assert.ok(calls.some(([name, col]) => name === 'addSelect' && col === 'MAX(room.updated_at)'));
  assert.ok(calls.some(([name, col]) => name === 'orderBy' && col === 'sort_key'));
  assert.ok(calls.some(([name, value]) => name === 'offset' && value === 20));
  assert.ok(calls.some(([name, sql, params]) => name === 'andWhere' && params?.q === '%test%'));
});

test('list cards expose room coordinates, falling back to the building pin', async () => {
  const qb = {};
  for (const name of ['leftJoin','where','andWhere','select','addSelect','groupBy','orderBy','addOrderBy','offset','limit']) qb[name] = () => qb;
  qb.clone = () => qb;
  qb.getCount = async () => 3;
  qb.getRawMany = async () => [{ id: 1 }, { id: 2 }, { id: 3 }];
  const rows = [
    { ...room, id: 1, latitude: '13.7370000', longitude: '100.5600000', property: { id: 1, latitude: '1', longitude: '1' } },
    { ...room, id: 2, latitude: null, longitude: null, property: { id: 2, latitude: '13.7200000', longitude: '100.5500000' } },
    { ...room, id: 3, latitude: '13.7', longitude: null, property: { id: 3, latitude: null, longitude: null } },
  ];
  rows[0].room_type = { code: 'studio', bedroom_count: 0 };
  rows[1].room_type = null;
  rows[0].available_from_date = '2026-10-15';
  rows[1].available_from_date = null;
  const service = new AgentListingsService({ createQueryBuilder: () => qb, find: async () => rows });
  const { items } = await service.listMine(7, {});
  assert.deepEqual(items.map((i) => [i.latitude, i.longitude]), [[13.737, 100.56], [13.72, 100.55], [null, null]]);
  assert.deepEqual(items.slice(0, 2).map((i) => i.roomTypeCode), ['studio', null]);
  assert.deepEqual(items.slice(0, 2).map((i) => i.availableFromDate), ['2026-10-15', null]);
});

test('match candidates leave out rooms a lead has already booked', async () => {
  const calls = []; const qb = {};
  for (const k of ['select', 'leftJoin', 'innerJoin', 'where', 'andWhere', 'setParameters']) qb[k] = (...args) => { calls.push([k, ...args]); return qb; };
  qb.getRawMany = async () => [];
  const service = new AgentListingsService({ createQueryBuilder: () => qb });
  const box = { minLat: 13, maxLat: 14, minLng: 100, maxLng: 101 };
  assert.deepEqual(await service.matchCandidates(7, { maxPrice: 20000, boxes: [box] }), []);
  const filters = calls.filter((c) => c[0] === 'andWhere').map((c) => c[1]);
  assert.ok(filters.includes("roomStatus.code = 'available'"));
  assert.ok(filters.includes("NOT EXISTS (SELECT 1 FROM leads booked WHERE booked.rent_room_id = room.id AND booked.status = 'booked')"));
});
