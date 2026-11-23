// Self owner rooms from the API (20 Nov 2026, D4: own tables). The room store keeps the demo rooms until the app
// connects it to the self owner API; then it lists, (un)lists and saves through /self-owner/rooms.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

let calls = [];
let answers = {};
const fakeApi = {
  ApiError: class ApiError extends Error { constructor(m, s) { super(m); this.status = s; } },
  apiGet: async (p) => { calls.push(['GET', p]); return answers[`GET ${p}`]; },
  apiPost: async (p, b) => { calls.push(['POST', p, b]); return answers[`POST ${p}`]; },
  apiPatch: async (p, b) => { calls.push(['PATCH', p, b]); return answers[`PATCH ${p}`]; },
};
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const localRequire = (name) => {
    if (name === 'react') return { useMemo: (fn) => fn(), useSyncExternalStore: (_s, get) => get() };
    if (name === './api') return fakeApi;
    if (name === './room-photos') return { uploadRoomPhotoTo: async (p, photo) => { calls.push(['UPLOAD', p, photo.uri]); return 'https://cdn/x.jpg'; } };
    if (name.startsWith('.')) {
      const base = path.resolve(path.dirname(file), name);
      return load([`${base}.ts`, base].find((f) => fs.existsSync(f)));
    }
    return require(name);
  };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
  return module.exports;
}
const rooms = () => load(path.join(__dirname, '../lib/self-owner-rooms.ts'));
const api = () => load(path.join(__dirname, '../lib/self-owner-rooms-api.ts'));
const now = new Date('2026-11-20T04:00:00Z');
const flush = () => new Promise((r) => setImmediate(r));
const summary = (over = {}) => ({ id: 7, title: 'ห้อง 3305', project: 'Ideo Q', monthlyRent: 19000, state: 'unlisted', visibility: 'private', bedrooms: 1, sizeSqm: 33.5, coverUrl: null, updatedAt: '2026-11-20T03:00:00.000Z', ...over });

function fakeBackend(list) {
  const seen = [];
  return {
    seen,
    list: async () => { seen.push('list'); if (list instanceof Error) throw list; return list; },
    setVisibility: async (id, v) => { seen.push(['visibility', id, v]); if (v === 'published' && id === 'fail') throw new Error('nope'); return v === 'published' ? 'listed' : 'unlisted'; },
  };
}

beforeEach(() => { calls = []; answers = {}; rooms().selfOwnerRoomStore.reset(now); });

test('until connected the store is the demo; connected it loads my rooms from the backend', async () => {
  const store = rooms().selfOwnerRoomStore;
  assert.equal(rooms().useSelfOwnerRooms().isDemoPreview, true);
  const backend = fakeBackend([{ id: '7', title: 'ห้อง 3305', project: 'Ideo Q', monthlyRent: 19000, state: 'unlisted', bedrooms: 1, sizeSqm: 33.5, updatedAt: now.toISOString() }]);
  store.connect(backend, 'user-41');
  assert.deepEqual(rooms().useSelfOwnerRooms(), { status: 'loading', rooms: [], isDemoPreview: false });
  await flush();
  const hook = rooms().useSelfOwnerRooms();
  assert.equal(hook.status, 'available');
  assert.deepEqual(hook.rooms.map((r) => r.id), ['7']);
  assert.equal(store.backend(), backend);
  store.connect(backend, 'user-41');
  assert.deepEqual(backend.seen, ['list'], 'the same account is not loaded twice');
  store.connect(backend, 'user-42');
  await flush();
  assert.deepEqual(backend.seen, ['list', 'list'], 'another account loads its own rooms');
  await store.refresh();
  assert.equal(backend.seen.length, 3);
  store.disconnect(now);
  assert.equal(store.backend(), null);
  assert.equal(rooms().useSelfOwnerRooms().isDemoPreview, true);
  assert.equal(store.get().length, 14);
});

test('a failed load shows the error state', async () => {
  const store = rooms().selfOwnerRoomStore;
  store.connect(fakeBackend(new Error('down')), 'u');
  await flush();
  assert.equal(rooms().useSelfOwnerRooms().status, 'error');
});

test('connected, (un)listing goes through the backend; a refusal leaves the room as it was', async () => {
  const { selfOwnerRoomStore: store, toggleListing } = rooms();
  const backend = fakeBackend([
    { id: '7', title: 'a', project: 'p', monthlyRent: 1, state: 'unlisted', bedrooms: 1, sizeSqm: 30, updatedAt: now.toISOString() },
    { id: 'fail', title: 'b', project: 'p', monthlyRent: 1, state: 'unlisted', bedrooms: 1, sizeSqm: 30, updatedAt: now.toISOString() },
    { id: '9', title: 'c', project: 'p', monthlyRent: 1, state: 'occupied', bedrooms: 1, sizeSqm: 30, updatedAt: now.toISOString() },
  ]);
  store.connect(backend, 'u');
  await flush();
  assert.deepEqual(await toggleListing('7', now), { ok: true });
  assert.equal(store.get().find((r) => r.id === '7').state, 'listed');
  const failed = await toggleListing('fail', now);
  assert.equal(failed.ok, false);
  assert.equal(failed.error.message, 'nope');
  assert.equal(store.get().find((r) => r.id === 'fail').state, 'unlisted');
  assert.equal((await toggleListing('9', now)).ok, false);
  assert.deepEqual(backend.seen.slice(1), [['visibility', '7', 'published'], ['visibility', 'fail', 'published']]);
});

test('api: list maps the summary; detail becomes the form data; save posts or patches', async () => {
  answers['GET /self-owner/rooms'] = [summary(), summary({ id: 8, coverUrl: 'https://cdn/c.jpg', state: 'listed' })];
  const backend = api().selfOwnerRoomsApi;
  const list = await backend.list();
  assert.deepEqual(list[0], { id: '7', title: 'ห้อง 3305', project: 'Ideo Q', monthlyRent: 19000, state: 'unlisted', bedrooms: 1, sizeSqm: 33.5, updatedAt: '2026-11-20T03:00:00.000Z', coverUrl: undefined });
  assert.equal(list[1].coverUrl, 'https://cdn/c.jpg');

  answers['GET /self-owner/rooms/7'] = {
    id: 7, state: 'listed', visibility: 'published', listingSourceCode: 'owner', listingTitle: 'ห้อง 3305', roomId: '3305', roomTypeId: 2,
    property: { name: 'Ideo Q', address: 'x', district: 'd', province: 'p', propertyTypeId: 1 },
    layout: [{ code: 'bedroom', value: '1' }], prices: [{ contractTypeId: 2, price: 19000, advanceRentMonths: 1, depositMonths: 2 }],
    advanceRentMonths: 1, depositMonths: 2, waterRatePerUnit: null, electricRatePerUnit: 7, availableFromDate: '2026-12-01',
    facilities: [{ code: 'wifi', groupCode: 'appliances' }], customFacilities: [], nearbyPlaces: [],
    medias: [{ mediaUrl: 'https://cdn/1.jpg', mediaType: 'image', category: 'room', isCover: true, sortOrder: 0 }],
    contact: { name: 'Jom', phone: '081' }, updatedAt: '2026-11-20T03:00:00.000Z',
  };
  const form = await backend.detail('7');
  assert.equal(form.visibility, 'published');
  assert.equal(form.isScoutRoom, true);
  assert.deepEqual(form.documents, []);
  assert.equal(form.waterRatePerUnit, undefined);
  assert.equal(form.electricRatePerUnit, 7);
  assert.deepEqual(form.contact, { name: 'Jom', phone: '081' });
  assert.equal('id' in form || 'state' in form || 'updatedAt' in form, false);

  answers['POST /self-owner/rooms'] = { id: 12, visibility: 'private', state: 'unlisted' };
  const data = { ...form, promoCopyStale: true, isScoutRoom: true, documents: [] };
  assert.equal(await backend.save(undefined, data), '12');
  answers['PATCH /self-owner/rooms/12'] = { id: 12, visibility: 'private', state: 'unlisted' };
  assert.equal(await backend.save('12', data), '12');
  const [post, patch] = calls.filter(([m]) => m === 'POST' || m === 'PATCH');
  assert.equal(post[1], '/self-owner/rooms');
  assert.equal('promoCopyStale' in post[2] || 'isScoutRoom' in post[2], false);
  assert.equal(patch[1], '/self-owner/rooms/12');

  answers['PATCH /self-owner/rooms/12/visibility'] = { id: 12, visibility: 'published', state: 'listed' };
  assert.equal(await backend.setVisibility('12', 'published'), 'listed');
  assert.deepEqual(calls.at(-1), ['PATCH', '/self-owner/rooms/12/visibility', { visibility: 'published' }]);

  assert.equal(await backend.uploadPhoto({ uri: 'file://a.jpg' }), 'https://cdn/x.jpg');
  assert.deepEqual(calls.at(-1), ['UPLOAD', '/self-owner/rooms/media/upload', 'file://a.jpg']);

  answers['GET /self-owner/rooms/options'] = { propertyTypes: [], contractTypes: [{ id: 5, code: 'twelve_months', termMonths: 12 }], roomTypes: [], facilities: [] };
  const first = await backend.options();
  await backend.options();
  assert.equal(first.contractTypes[0].id, 5);
  assert.equal(calls.filter(([m, p]) => p === '/self-owner/rooms/options').length, 1, 'choices are fetched once');
});

test('connected, the Dashboard rooms section is the API rooms with their load state (rent and viewings stay demo)', async () => {
  const dashboard = load(path.join(__dirname, '../lib/self-owner-dashboard.ts'));
  const store = rooms().selfOwnerRoomStore;
  store.connect({ list: async () => [{ id: '7', title: 'a', project: 'p', monthlyRent: 1, state: 'unlisted', bedrooms: 1, sizeSqm: 30, updatedAt: now.toISOString() }] }, 'u');
  assert.equal(dashboard.useSelfOwnerDashboard({ greetingName: 'Jom', locale: 'th' }).rooms.status, 'loading');
  await flush();
  const snapshot = dashboard.useSelfOwnerDashboard({ greetingName: 'Jom', locale: 'th' });
  assert.equal(snapshot.rooms.status, 'available');
  assert.deepEqual(snapshot.rooms.items.map((r) => r.id), ['7']);
  assert.equal(snapshot.rent.status, 'demo');
  store.reset(now);
  assert.equal(dashboard.useSelfOwnerDashboard({ greetingName: 'Jom', locale: 'th' }).rooms.status, 'demo');
});

// Follow-up (23 Nov 2026): a room list that was already on its way must not undo a change made while it travelled.
test('a list load that started before a toggle keeps the toggle; the next load takes the server again', async () => {
  const store = rooms().selfOwnerRoomStore;
  const room = (state) => ({ id: '7', title: 'a', project: 'p', monthlyRent: 1, state, bedrooms: 1, sizeSqm: 30, updatedAt: now.toISOString() });
  let release;
  const lists = [() => Promise.resolve([room('unlisted')])];
  const backend = {
    list: () => (lists.shift() ?? (() => Promise.resolve([room('unlisted')])))(),
    setVisibility: async () => 'listed',
  };
  store.connect(backend, 'u');
  await flush();
  lists.push(() => new Promise((r) => { release = r; }));
  const loading = store.refresh();
  assert.deepEqual(await rooms().toggleListing('7', now), { ok: true });
  assert.equal(store.get()[0].state, 'listed');
  release([room('unlisted')]); // read before the toggle reached the server
  await loading;
  assert.equal(store.get()[0].state, 'listed', 'the toggle made during the load stays');
  await store.refresh();
  assert.equal(store.get()[0].state, 'unlisted', 'a load started afterwards is the server again');
});
