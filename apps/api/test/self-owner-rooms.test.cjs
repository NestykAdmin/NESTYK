// Self owner rooms API (D4 decided 20 Nov 2026: own tables apart from the agent rooms, QA Aof's proposal).
// Only the owner sees or changes a room; create starts private; publishing needs 5 photos (same rule as the agent).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require('reflect-metadata');
// The auth guard's avatar storage loads sharp; nothing here resizes images, so a stand-in keeps the test runnable where
// the native binary is missing (the Linux VM).
const Module = require('node:module');
const load = Module._load;
Module._load = function (request, ...rest) { return request === 'sharp' ? () => ({}) : load.call(this, request, ...rest); };
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename,
  }).outputText, filename);
};
const { BadRequestException, ConflictException, NotFoundException } = require('@nestjs/common');
const { FindOperator } = require('typeorm');
const E = require('../src/entities/index.ts');
const { SelfOwnerRoomsService } = require('../src/self-owner/rooms/self-owner-rooms.service.ts');
const { SelfOwnerRoomsController } = require('../src/self-owner/rooms/self-owner-rooms.controller.ts');

const A = { id: 41 };
const B = { id: 42 };
const OWN_PHOTO = (user, n) => `https://cdn.test/property-images/${user.id}/${String(n).padStart(8, '0')}-aaaa-bbbb-cccc-dddddddddddd.jpg`;

/** A tiny in-memory database that answers the manager calls the service makes. */
function fakeDb() {
  const tables = new Map();
  const ids = new Map();
  const rows = (entity) => { if (!tables.has(entity)) tables.set(entity, []); return tables.get(entity); };
  const matches = (row, where = {}) => Object.entries(where).every(([key, want]) => {
    if (want instanceof FindOperator) return want.type === 'in' ? want.value.includes(row[key]) : false;
    if (want && typeof want === 'object' && !(want instanceof Date)) return matches(row[key] ?? {}, want);
    return row[key] === want;
  });
  const manager = {
    create: (entity, data) => ({ ...data }),
    async save(entity, data) {
      const list = rows(entity);
      const saved = { ...data };
      if (saved.id == null) { const next = (ids.get(entity) ?? 0) + 1; ids.set(entity, next); saved.id = next; }
      saved.updated_at = new Date(Date.now() + list.length);
      saved.created_at = saved.created_at ?? saved.updated_at;
      const i = list.findIndex((r) => r.id === saved.id);
      if (i >= 0) list[i] = { ...list[i], ...saved }; else list.push(saved);
      return { ...saved };
    },
    async find(entity, opts = {}) {
      const where = Array.isArray(opts.where) ? opts.where : [opts.where ?? {}];
      const found = rows(entity).filter((r) => where.some((w) => matches(r, w))).map((r) => ({ ...r }));
      const order = Object.entries(opts.order ?? {}).filter(([, dir]) => typeof dir === 'string');
      return found.sort((x, y) => {
        for (const [key, dir] of order) {
          const a = x[key] instanceof Date ? x[key].getTime() : x[key];
          const b = y[key] instanceof Date ? y[key].getTime() : y[key];
          if (a !== b) return (a < b ? -1 : 1) * (dir.toUpperCase() === 'DESC' ? -1 : 1);
        }
        return 0;
      });
    },
    async findOne(entity, opts = {}) { return (await manager.find(entity, opts))[0] ?? null; },
    async delete(entity, where) { tables.set(entity, rows(entity).filter((r) => !matches(r, where))); },
  };
  const db = { manager, rows, transaction: async (fn) => fn(manager) };
  rows(E.MasterPropertyTypeEntity).push({ id: 1, code: 'condo' });
  rows(E.MasterContractTypeEntity).push({ id: 1, code: 'six_months', term_months: 6, is_active: true, sort_order: 2 },
    { id: 2, code: 'twelve_months', term_months: 12, is_active: true, sort_order: 1 });
  rows(E.MasterRoomTypeEntity).push({ id: 2, code: 'one_bedroom', bedroom_count: 1, is_active: true, sort_order: 1 });
  rows(E.MasterFacilityEntity).push({ id: 10, code: 'air_conditioner', group_id: 3, group: { code: 'appliances' }, is_extra_charge: false },
    { id: 11, code: 'wifi', group_id: 3, group: { code: 'appliances' }, is_extra_charge: true });
  rows(E.MasterRoomStatusEntity).push({ id: 1, code: 'available' }, { id: 2, code: 'rented' });
  return db;
}

function setup() {
  const db = fakeDb();
  const photoChecks = [];
  const photos = {
    async validateRoomPhotos(userId, medias) {
      photoChecks.push(userId);
      for (const m of medias) if (!m.mediaUrl.includes(`/${userId}/`)) throw new BadRequestException('Upload room photos before saving');
    },
    async upload(userId) { return { mediaUrl: OWN_PHOTO({ id: userId }, 99) }; },
  };
  return { db, photos, photoChecks, service: new SelfOwnerRoomsService(db, photos) };
}

function body(user, overrides = {}) {
  return {
    listingTitle: 'ห้อง 3305',
    roomId: '3305',
    roomTypeId: 2,
    property: { name: 'Ideo Q จุฬา-สามย่าน', address: 'ถนนพระราม 4', district: 'ปทุมวัน', province: 'กรุงเทพมหานคร', propertyTypeId: 1, latitude: 13.73, longitude: 100.52 },
    layout: [{ code: 'bedroom', value: '1' }, { code: 'bathroom', value: '1' }, { code: 'room_size', value: '33.5' }, { code: 'floor', value: '33' }, { code: 'building', value: 'A' }],
    prices: [{ contractTypeId: 2, price: 19000, advanceRentMonths: 1, depositMonths: 2 }, { contractTypeId: 1, price: 21000 }],
    advanceRentMonths: 1, depositMonths: 2,
    waterRatePerUnit: 18, electricRatePerUnit: 7,
    availableFromDate: '2026-12-01',
    facilities: [{ code: 'air_conditioner', groupCode: 'appliances' }],
    customFacilities: ['ตู้เย็นใหญ่'],
    medias: [{ mediaUrl: OWN_PHOTO(user, 1), isCover: true, sortOrder: 0 }, { mediaUrl: OWN_PHOTO(user, 2), sortOrder: 1 }],
    contact: { name: 'กฤษณพงศ์', phone: '0812345678', lineId: 'jom', facebook: '' },
    listingSourceCode: 'owner', isScoutRoom: true, visibility: 'published', documents: [],
    ...overrides,
  };
}

test('create stores the room for its owner only, private and available, with prices, facilities, photos and contact', async () => {
  const { db, service, photoChecks } = setup();
  const { id } = await service.create(A, body(A));
  const [room] = db.rows(E.SelfOwnerRoomEntity);
  assert.equal(room.id, id);
  assert.equal(room.owner_user_id, A.id);
  assert.equal(room.visibility, 'private', 'a new room starts unlisted even if the body says published');
  assert.equal(room.room_status_id, 1);
  assert.equal(room.room_name, 'ห้อง 3305');
  assert.equal(room.room_number, '3305');
  assert.deepEqual([room.bedrooms, room.bathrooms, room.size_sqm, room.floor, room.building], [1, 1, '33.5', '33', 'A']);
  assert.deepEqual([room.contact_name, room.contact_phone, room.contact_line_id, room.contact_facebook], ['กฤษณพงศ์', '0812345678', 'jom', null]);
  assert.deepEqual(db.rows(E.SelfOwnerRoomPriceEntity).map((p) => [p.contract_type_id, p.price]), [[2, '19000'], [1, '21000']]);
  assert.deepEqual(db.rows(E.SelfOwnerRoomFacilityEntity).map((f) => f.facility_id), [10]);
  assert.deepEqual(db.rows(E.SelfOwnerRoomMediaEntity).map((m) => [m.is_cover, m.sort_order]), [[true, 0], [false, 1]]);
  assert.equal(db.rows(E.PropertyEntity).length, 1);
  assert.deepEqual(photoChecks, [A.id], 'photos are checked against the owner\'s own upload folder');
  assert.equal(db.rows(E.RentRoomEntity).length, 0, 'never writes the agent rooms');
});

test('invalid input is refused before anything is saved', async () => {
  const { db, service } = setup();
  const cases = [
    { listingTitle: '  ' },
    { contact: { name: 'x', phone: ' ' } },
    { contact: undefined },
    { layout: [{ code: 'bathroom', value: '1' }] },
    { prices: [] },
    { prices: [{ contractTypeId: 2, price: 0 }] },
    { prices: [{ contractTypeId: 2, price: 100 }, { contractTypeId: 2, price: 200 }] },
    { prices: [{ contractTypeId: 99, price: 100 }] },
    { facilities: [{ code: 'jacuzzi' }] },
    { roomTypeId: 77 },
    { property: { address: 'x', district: '', province: 'กทม', propertyTypeId: 1 } },
    { medias: Array.from({ length: 13 }, (_, i) => ({ mediaUrl: OWN_PHOTO(A, i) })) },
    { medias: [{ mediaUrl: OWN_PHOTO(B, 1) }] },
    { availableFromDate: '2026-02-30' },
  ];
  for (const overrides of cases) {
    await assert.rejects(service.create(A, body(A, overrides)), BadRequestException, JSON.stringify(overrides));
  }
  assert.equal(db.rows(E.SelfOwnerRoomEntity).length, 0);
});

test('list shows only my rooms, newest first, with the fields the rooms page needs', async () => {
  const { service } = setup();
  const first = await service.create(A, body(A, { prices: [{ contractTypeId: 1, price: 21000 }, { contractTypeId: 2, price: 19000 }] }));
  await service.create(B, body(B, { listingTitle: 'ห้องของคนอื่น' }));
  const second = await service.create(A, body(A, { listingTitle: 'ห้อง 1204', roomId: '1204', medias: [] }));
  const list = await service.list(A);
  assert.deepEqual(list.map((r) => r.id), [second.id, first.id]);
  const [one] = list.slice(-1);
  assert.equal(one.title, 'ห้อง 3305');
  assert.equal(one.project, 'Ideo Q จุฬา-สามย่าน');
  assert.equal(one.monthlyRent, 19000, '12-month rent first, like the app');
  assert.equal(one.state, 'unlisted');
  assert.deepEqual([one.bedrooms, one.sizeSqm], [1, 33.5]);
  assert.equal(one.coverUrl, OWN_PHOTO(A, 1));
  assert.ok(!Number.isNaN(Date.parse(one.updatedAt)));
  assert.equal(list[0].coverUrl, null);
});

test('detail is the form data of my room; another owner gets 404', async () => {
  const { service } = setup();
  const { id } = await service.create(A, body(A));
  const d = await service.detail(A, id);
  assert.equal(d.id, id);
  assert.equal(d.state, 'unlisted');
  assert.equal(d.visibility, 'private');
  assert.equal(d.listingTitle, 'ห้อง 3305');
  assert.equal(d.roomId, '3305');
  assert.equal(d.listingSourceCode, 'owner');
  assert.equal(d.roomTypeId, 2);
  assert.deepEqual(d.layout, [{ code: 'bedroom', value: '1' }, { code: 'bathroom', value: '1' }, { code: 'room_size', value: '33.5' }, { code: 'floor', value: '33' }, { code: 'building', value: 'A' }]);
  assert.deepEqual(d.prices, [{ contractTypeId: 2, price: 19000, advanceRentMonths: 1, depositMonths: 2 }, { contractTypeId: 1, price: 21000, advanceRentMonths: 1, depositMonths: 2 }]);
  assert.deepEqual(d.facilities, [{ code: 'air_conditioner', groupCode: 'appliances' }]);
  assert.deepEqual(d.medias.map((m) => [m.mediaUrl, m.isCover]), [[OWN_PHOTO(A, 1), true], [OWN_PHOTO(A, 2), false]]);
  assert.deepEqual(d.contact, { name: 'กฤษณพงศ์', phone: '0812345678', lineId: 'jom', facebook: undefined });
  assert.equal(d.property.name, 'Ideo Q จุฬา-สามย่าน');
  assert.equal(d.property.latitude, 13.73);
  assert.equal(d.availableFromDate, '2026-12-01');
  await assert.rejects(service.detail(B, id), NotFoundException);
});

test('update replaces prices, facilities and photos; another owner gets 404', async () => {
  const { db, service } = setup();
  const { id } = await service.create(A, body(A));
  await service.update(A, id, body(A, { prices: [{ contractTypeId: 1, price: 25000 }], facilities: [{ code: 'wifi' }], medias: [{ mediaUrl: OWN_PHOTO(A, 2) }] }));
  assert.deepEqual(db.rows(E.SelfOwnerRoomPriceEntity).map((p) => [p.room_id, p.contract_type_id, p.price]), [[id, 1, '25000']]);
  assert.deepEqual(db.rows(E.SelfOwnerRoomFacilityEntity).map((f) => f.facility_id), [11]);
  assert.deepEqual(db.rows(E.SelfOwnerRoomMediaEntity).map((m) => [m.media_url, m.is_cover]), [[OWN_PHOTO(A, 2), true]], 'the first photo becomes the cover');
  assert.equal(db.rows(E.PropertyEntity).length, 1, 'an unchanged address keeps its property');
  await service.update(A, id, body(A, { property: { ...body(A).property, address: 'ถนนบรรทัดทอง' } }));
  assert.equal(db.rows(E.PropertyEntity).length, 2, 'a changed address gets its own property');
  assert.equal(db.rows(E.SelfOwnerRoomEntity)[0].properties_id, 2);
  await assert.rejects(service.update(B, id, body(B)), NotFoundException);
});

test('update keeps the listing state; a listed room cannot drop below 5 photos', async () => {
  const { db, service } = setup();
  const five = [1, 2, 3, 4, 5].map((n) => ({ mediaUrl: OWN_PHOTO(A, n) }));
  const { id } = await service.create(A, body(A, { medias: five }));
  await service.setVisibility(A, id, 'published');
  await service.update(A, id, body(A, { medias: five.slice().reverse(), visibility: 'private' }));
  assert.equal(db.rows(E.SelfOwnerRoomEntity)[0].visibility, 'published', 'publishing is its own action');
  await assert.rejects(service.update(A, id, body(A, { medias: five.slice(0, 4) })), BadRequestException);
  assert.equal(db.rows(E.SelfOwnerRoomMediaEntity).length, 5);
  await service.setVisibility(A, id, 'private');
  await service.update(A, id, body(A, { medias: five.slice(0, 1) }));
  assert.equal(db.rows(E.SelfOwnerRoomMediaEntity).length, 1);
});

test('publish needs 5 photos; a rented room cannot change; another owner gets 404', async () => {
  const { db, service } = setup();
  const few = await service.create(A, body(A));
  await assert.rejects(service.setVisibility(A, few.id, 'published'), BadRequestException);
  const five = await service.create(A, body(A, { medias: [1, 2, 3, 4, 5].map((n) => ({ mediaUrl: OWN_PHOTO(A, n) })) }));
  assert.deepEqual(await service.setVisibility(A, five.id, 'published'), { id: five.id, visibility: 'published', state: 'listed' });
  assert.equal((await service.setVisibility(A, five.id, 'private')).state, 'unlisted');
  await assert.rejects(service.setVisibility(A, five.id, 'everyone'), BadRequestException);
  await assert.rejects(service.setVisibility(B, five.id, 'published'), NotFoundException);
  db.rows(E.SelfOwnerRoomEntity).find((r) => r.id === five.id).room_status_id = 2;
  await assert.rejects(service.setVisibility(A, five.id, 'private'), ConflictException);
  assert.equal((await service.list(A)).find((r) => r.id === five.id).state, 'occupied');
});

test('options: the four choice lists of the form, same shapes as the agent form', async () => {
  const { service } = setup();
  const o = await service.options();
  assert.deepEqual(o.propertyTypes, [{ id: 1, code: 'condo' }]);
  assert.deepEqual(o.contractTypes.map((c) => [c.id, c.code, c.termMonths]), [[2, 'twelve_months', 12], [1, 'six_months', 6]]);
  assert.deepEqual(o.roomTypes, [{ id: 2, code: 'one_bedroom', bedroomCount: 1 }]);
  assert.deepEqual(o.facilities, [{ code: 'air_conditioner', groupCode: 'appliances', isExtraCharge: false }, { code: 'wifi', groupCode: 'appliances', isExtraCharge: true }]);
});

test('controller: self owner role only, under /self-owner/rooms, never the agent routes', () => {
  assert.equal(Reflect.getMetadata('path', SelfOwnerRoomsController), 'self-owner/rooms');
  assert.deepEqual(Reflect.getMetadata('roles', SelfOwnerRoomsController), ['self_owner']);
  const routes = Object.getOwnPropertyNames(SelfOwnerRoomsController.prototype).filter((k) => k !== 'constructor')
    .map((k) => [Reflect.getMetadata('method', SelfOwnerRoomsController.prototype[k]), Reflect.getMetadata('path', SelfOwnerRoomsController.prototype[k])]);
  assert.deepEqual(routes.sort(), [[0, '/'], [0, ':id'], [0, 'options'], [1, '/'], [1, 'media/upload'], [4, ':id'], [4, ':id/visibility']].sort());
  const agentRooms = fs.readFileSync(path.join(__dirname, '../src/agent/rooms/agent-rooms.controller.ts'), 'utf8');
  assert.match(agentRooms, /@Roles\('agent'\)/);
  assert.doesNotMatch(agentRooms, /self_owner/);
});

// Review fix (20 Nov 2026): TypeORM only writes updated_at when a room column changes; a rent- or photo-only edit
// must still move the room to the top of "last changed first".
test('every save stamps the room as changed, even when only prices or photos change', async () => {
  const { db, service } = setup();
  const stamps = [];
  const save = db.manager.save;
  db.manager.save = async (entity, data) => {
    if (entity === E.SelfOwnerRoomEntity) stamps.push(data.updated_at);
    return save(entity, data);
  };
  const { id } = await service.create(A, body(A));
  await service.update(A, id, body(A, { prices: [{ contractTypeId: 2, price: 18500 }] }));
  assert.equal(stamps.length, 2);
  assert.ok(stamps.every((at) => at instanceof Date), 'updated_at is set by the service');
});
