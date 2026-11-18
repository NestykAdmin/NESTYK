// AUTH-3 (project-docs/nestyk-auth3-saved-rooms-plan-20261113.md, Mos approved S1–S4 13 Nov 2026):
// any signed-in account (D5) saves public rooms; at most 200; unpublished rooms stay saved but are not shown.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename,
  }).outputText, filename);
};
const { BadRequestException, ConflictException, NotFoundException, UnauthorizedException } = require('@nestjs/common');
const { SavedRoomsService, parseSavedRoomId, SAVED_ROOMS_LIMIT } = require('../src/me/saved-rooms.service.ts');
const { SavedRoomsController, SAVED_ROOMS_CACHE_CONTROL } = require('../src/me/saved-rooms.controller.ts');

/** In-memory saved_rooms rows + the set of rooms that are public now. */
function setup({ rows = [], publicIds = [1, 2, 3, 4, 5] } = {}) {
  const store = rows.map((row, i) => ({ id: i + 1, created_at: new Date(2026, 10, 1, 0, i), ...row }));
  const repo = {
    async find({ where, order }) {
      const list = store.filter((r) => r.user_id === where.user_id);
      return order?.created_at === 'DESC' ? [...list].sort((a, b) => b.created_at - a.created_at) : list;
    },
    async count({ where }) {
      return store.filter((r) => r.user_id === where.user_id).length;
    },
    async exists({ where }) {
      return store.some((r) => r.user_id === where.user_id && r.rent_room_id === where.rent_room_id);
    },
    async insertIgnore(row) {
      if (!store.some((r) => r.user_id === row.user_id && r.rent_room_id === row.rent_room_id)) {
        store.push({ id: store.length + 1, created_at: new Date(2026, 10, 2, 0, store.length), ...row });
      }
    },
    async delete(where) {
      for (let i = store.length - 1; i >= 0; i -= 1) {
        if (store[i].user_id === where.user_id && store[i].rent_room_id === where.rent_room_id) store.splice(i, 1);
      }
    },
  };
  const rooms = {
    async publicIdsAmong(ids) {
      return ids.filter((id) => publicIds.includes(id));
    },
    async cardsFor(ids) {
      return ids.map((id) => ({ id: String(id) }));
    },
  };
  return { store, service: new SavedRoomsService(repo, rooms) };
}

test('room ids: a positive whole number that fits the column, else 400', () => {
  assert.equal(parseSavedRoomId('41'), 41);
  for (const bad of ['', '0', '-1', '1.5', 'abc', '01', ' 4', '2147483648', undefined]) {
    assert.throws(() => parseSavedRoomId(bad), BadRequestException, String(bad));
  }
});

test('saving: only a public room (404 otherwise); saving again changes nothing', async () => {
  const { store, service } = setup({ publicIds: [1, 2] });
  await service.save(7, '1');
  await service.save(7, '1');
  assert.deepEqual(store.map((r) => [r.user_id, r.rent_room_id]), [[7, 1]]);
  await assert.rejects(service.save(7, '9'), NotFoundException);
});

test('S1: at most 200 rooms per account (409 SAVED_ROOMS_LIMIT); a room already saved is still fine', async () => {
  assert.equal(SAVED_ROOMS_LIMIT, 200);
  const many = Array.from({ length: 200 }, (_, i) => ({ user_id: 7, rent_room_id: 1000 + i }));
  const { service } = setup({ rows: many, publicIds: [1, ...many.map((r) => r.rent_room_id)] });
  await assert.rejects(service.save(7, '1'), (e) => e instanceof ConflictException && e.getResponse().code === 'SAVED_ROOMS_LIMIT');
  await service.save(7, '1000');
});

test('S2: lists show only rooms that are public now, newest first; unpublished rows stay', async () => {
  const { store, service } = setup({
    rows: [{ user_id: 7, rent_room_id: 1 }, { user_id: 7, rent_room_id: 9 }, { user_id: 7, rent_room_id: 2 }, { user_id: 8, rent_room_id: 3 }],
    publicIds: [1, 2, 3],
  });
  assert.deepEqual(await service.ids(7), { ids: ['2', '1'] });
  assert.deepEqual(await service.list(7), [{ id: '2' }, { id: '1' }]);
  assert.equal(store.length, 4, 'nothing is removed by reading');
});

test('each account sees and changes only its own rooms; removing is safe to repeat', async () => {
  const { store, service } = setup({ rows: [{ user_id: 7, rent_room_id: 1 }, { user_id: 8, rent_room_id: 1 }] });
  assert.deepEqual(await service.ids(8), { ids: ['1'] });
  await service.remove(7, '1');
  await service.remove(7, '1');
  assert.deepEqual(store.map((r) => r.user_id), [8]);
});

test('routes: /me/saved-rooms for any signed-in account (no role check), never cached', () => {
  const routePath = (target, key) => Reflect.getMetadata('path', key ? target.prototype[key] : target);
  const method = (key) => Reflect.getMetadata('method', SavedRoomsController.prototype[key]);
  assert.equal(routePath(SavedRoomsController), 'me/saved-rooms');
  const guards = Reflect.getMetadata('__guards__', SavedRoomsController).map((g) => g.name);
  assert.deepEqual(guards, ['AuthGuard'], 'D5: every role');
  assert.equal(routePath(SavedRoomsController, 'ids'), 'ids');
  assert.equal(routePath(SavedRoomsController, 'save'), ':roomId');
  assert.equal(method('save'), 2, 'PUT');
  assert.equal(method('remove'), 3, 'DELETE');
  assert.equal(SAVED_ROOMS_CACHE_CONTROL, 'private, no-store');
});

test('DB: entity and migration match (names, cascades, RLS, public.)', () => {
  const root = path.join(__dirname, '..', '..', '..');
  const files = fs.readdirSync(path.join(root, 'supabase', 'migrations')).filter((f) => /_saved_rooms\.sql$/.test(f));
  assert.equal(files.length, 1);
  const sql = fs.readFileSync(path.join(root, 'supabase', 'migrations', files[0]), 'utf8');
  const entity = fs.readFileSync(path.join(__dirname, '..', 'src', 'entities', 'saved-room.entity.ts'), 'utf8');
  assert.match(sql, /CREATE TABLE public\.saved_rooms/);
  assert.match(sql, /ALTER TABLE public\.saved_rooms ENABLE ROW LEVEL SECURITY;/);
  for (const name of ['saved_rooms_user_room_key', 'saved_rooms_user_id_fkey', 'saved_rooms_rent_room_id_fkey', 'idx_saved_rooms_user_created', 'idx_saved_rooms_rent_room_id']) {
    assert.ok(sql.includes(name), `sql ${name}`);
    assert.ok(entity.includes(name), `entity ${name}`);
  }
  assert.equal((sql.match(/ON DELETE CASCADE/g) || []).length, 2);
  assert.doesNotMatch(sql, /CONCURRENTLY/);
  const index = fs.readFileSync(path.join(__dirname, '..', 'src', 'entities', 'index.ts'), 'utf8');
  assert.match(index, /SavedRoomEntity/);
});

test('Nest can build SavedRoomsService: every constructor argument names a real provider', () => {
  const { SavedRoomsStore } = require('../src/me/saved-rooms.service.ts');
  const { PublicRoomsService } = require('../src/public-listings/public-rooms.service.ts');
  const types = Reflect.getMetadata('design:paramtypes', SavedRoomsService) ?? [];
  const injected = Reflect.getMetadata('self:paramtypes', SavedRoomsService) ?? [];
  const tokenAt = (index) => injected.find((entry) => entry.index === index)?.param ?? types[index];
  // A union type (A | B) compiles to Object, which Nest cannot resolve: the API would not start.
  assert.equal(tokenAt(0), SavedRoomsStore);
  assert.equal(tokenAt(1), PublicRoomsService);
});

test('S1 (Mos 13 Nov 2026, review R1): only rooms still shown count; hidden rooms never block a new save', async () => {
  const many = Array.from({ length: 200 }, (_, i) => ({ user_id: 7, rent_room_id: 1000 + i }));
  const visible = many.map((r) => r.rent_room_id);
  // 200 saved, one of them now rented out (hidden): the account sees 199 and can save one more.
  const hidden = setup({ rows: many, publicIds: [1, ...visible.slice(1)] });
  await hidden.service.save(7, '1');
  assert.equal(hidden.store.length, 201);
  // 200 saved and all shown: full.
  const full = setup({ rows: many, publicIds: [1, ...visible] });
  await assert.rejects(full.service.save(7, '1'), (e) => e instanceof ConflictException && e.getResponse().code === 'SAVED_ROOMS_LIMIT');
});

test('review R2: a token whose account is not synced yet gets 401, never a crash (500)', async () => {
  const { service } = setup();
  const controller = new SavedRoomsController(service);
  for (const call of [() => controller.ids(undefined), () => controller.list(undefined), () => controller.save(undefined, '1'), () => controller.remove(undefined, '1')]) {
    await assert.rejects(async () => call(), UnauthorizedException);
  }
});
