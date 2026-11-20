// Self owner listing (UI round, 20 Nov 2026, ClickUp z8rcteng6c / z8rcteng6d): demo room store shared by the
// Dashboard and the rooms page, and the room <-> listing wizard data mapping.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const localRequire = (name) => {
    if (name === 'react') return { useMemo: (fn) => fn(), useSyncExternalStore: (_subscribe, get) => get() };
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
const roomsFile = path.join(__dirname, '../lib/self-owner-rooms.ts');
const listingFile = path.join(__dirname, '../lib/self-owner-listing.ts');
const dashboardFile = path.join(__dirname, '../lib/self-owner-dashboard.ts');
const rooms = () => load(roomsFile);
const listing = () => load(listingFile);
const dashboard = () => load(dashboardFile);
const now = new Date('2026-11-20T04:00:00Z');
const byId = (id) => rooms().selfOwnerRoomStore.get().find((room) => room.id === id);

beforeEach(() => rooms().selfOwnerRoomStore.reset(now));

function newRoomData() {
  const { SELF_OWNER_DEMO_OPTIONS } = listing();
  return {
    visibility: 'private',
    listingTitle: 'ห้อง 3305',
    listingSourceCode: 'owner',
    isScoutRoom: true,
    property: { name: 'Ideo Q จุฬา-สามย่าน', address: 'ถนนพระราม 4', district: 'ปทุมวัน', province: 'กรุงเทพมหานคร', propertyTypeId: SELF_OWNER_DEMO_OPTIONS.propertyTypes[0].id },
    roomTypeId: SELF_OWNER_DEMO_OPTIONS.roomTypes.find((r) => r.bedroomCount === 1).id,
    prices: [
      { contractTypeId: SELF_OWNER_DEMO_OPTIONS.contractTypes.find((c) => c.termMonths === 6).id, price: 21000 },
      { contractTypeId: SELF_OWNER_DEMO_OPTIONS.contractTypes.find((c) => c.termMonths === 12).id, price: 19000 },
    ],
    advanceRentMonths: 1,
    depositMonths: 2,
    layout: [{ code: 'bedroom', value: '1' }, { code: 'bathroom', value: '1' }, { code: 'room_size', value: '33' }],
    facilities: [],
    medias: [],
    documents: [],
  };
}

test('store starts with the 14 demo rooms and notifies on add', () => {
  const store = rooms().selfOwnerRoomStore;
  assert.equal(store.get().length, 14);
  let calls = 0;
  const unsubscribe = store.subscribe(() => { calls += 1; });
  store.add(listing().roomFromWizard(newRoomData(), { id: 'r15', now }));
  unsubscribe();
  assert.equal(calls, 1);
  assert.equal(store.get().length, 15);
});

test('dashboard and rooms page agree after add', () => {
  const store = rooms().selfOwnerRoomStore;
  store.add(listing().roomFromWizard(newRoomData(), { id: 'r15', now }));
  assert.equal(rooms().useSelfOwnerRooms().rooms.length, 15);
  const snapshot = dashboard().useSelfOwnerDashboard({ greetingName: 'Jom', locale: 'th' });
  assert.equal(snapshot.rooms.items.length, store.get().length);
});

test('toggle flips listed and unlisted only', () => {
  const { toggleListing, canToggleListing } = rooms();
  toggleListing('r5', now);
  assert.equal(byId('r5').state, 'unlisted');
  assert.equal(byId('r5').updatedAt, now.toISOString());
  toggleListing('r5', now);
  assert.equal(byId('r5').state, 'listed');
  toggleListing('r1', now);
  assert.equal(byId('r1').state, 'occupied');
  assert.equal(canToggleListing(byId('r1')), false);
  assert.equal(canToggleListing(byId('r6')), true);
});

test('round trip keeps the room', () => {
  const { roomFromWizard, wizardDataFromRoom } = listing();
  for (const id of ['r5', 'r6', 'r8']) {
    const before = byId(id);
    const data = wizardDataFromRoom(before);
    assert.equal(data.listingSourceCode, 'owner');
    assert.equal(data.isScoutRoom, true);
    assert.equal(data.visibility, before.state === 'listed' ? 'published' : 'private');
    const after = roomFromWizard(data, { id, now, previous: before });
    for (const key of ['title', 'project', 'monthlyRent', 'bedrooms', 'sizeSqm', 'state']) {
      assert.equal(after[key], before[key], `${id}.${key}`);
    }
  }
});

test('new room is unlisted with next id and reads the 12-month price', () => {
  const { nextSelfOwnerRoomId, roomFromWizard } = listing();
  assert.equal(nextSelfOwnerRoomId(rooms().selfOwnerRoomStore.get()), 'r15');
  const room = roomFromWizard(newRoomData(), { id: 'r15', now });
  assert.equal(room.state, 'unlisted');
  assert.equal(room.title, 'ห้อง 3305');
  assert.equal(room.project, 'Ideo Q จุฬา-สามย่าน');
  assert.equal(room.monthlyRent, 19000);
  assert.equal(room.bedrooms, 1);
  assert.equal(room.sizeSqm, 33);
  assert.equal(room.updatedAt, now.toISOString());
});

test('editing an occupied room keeps tenant', () => {
  const { roomFromWizard, wizardDataFromRoom } = listing();
  const before = byId('r1');
  const data = wizardDataFromRoom(before);
  data.prices = data.prices.map((p) => ({ ...p, price: 18500 }));
  const after = roomFromWizard(data, { id: 'r1', now, previous: before });
  assert.equal(after.monthlyRent, 18500);
  assert.equal(after.state, 'occupied');
  assert.equal(after.tenantName, before.tenantName);
  assert.equal(after.leaseEndsAt, before.leaseEndsAt);
});

test('no network', () => {
  for (const file of [roomsFile, listingFile]) {
    const code = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(code, /from ['"][^'"]*(\/api|agent-listings|places-api|room-photos)/);
    assert.doesNotMatch(code, /fetch\(/);
  }
});
