// Self owner rooms page like the agent's (Jom 20 Nov 2026): filters the demo rooms have (bedrooms, rent range),
// 24 rooms a page on the web, and a room shown in the agent room detail.
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
    if (name === 'react') return { useMemo: (fn) => fn(), useSyncExternalStore: (_s, get) => get() };
    if (name.startsWith('.')) {
      const base = path.resolve(path.dirname(file), name);
      return load([`${base}.ts`, base].find((f) => fs.existsSync(f)));
    }
    return require(name);
  };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText)(localRequire, module, module.exports);
  return module.exports;
}
const rooms = () => load(path.join(__dirname, '../lib/self-owner-rooms.ts'));
const listing = () => load(path.join(__dirname, '../lib/self-owner-listing.ts'));
const now = new Date('2026-11-20T04:00:00Z');
const demo = () => rooms().createSelfOwnerRoomsDemo(now);
const ids = (list) => list.map((r) => r.id).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

beforeEach(() => { rooms().selfOwnerRoomStore.reset(now); listing().selfOwnerListingDrafts.clear(); });

test('no filter keeps every room; the web shows 24 a page like the agent', () => {
  const { applySelfOwnerRoomFilters, EMPTY_SELF_OWNER_FILTERS, SELF_OWNER_ROOMS_WEB_PAGE_SIZE, activeSelfOwnerFilterCount } = rooms();
  assert.equal(applySelfOwnerRoomFilters(demo(), EMPTY_SELF_OWNER_FILTERS).length, 14);
  assert.equal(SELF_OWNER_ROOMS_WEB_PAGE_SIZE, 24);
  assert.equal(activeSelfOwnerFilterCount(EMPTY_SELF_OWNER_FILTERS), 0);
});

test('bedrooms: studio is 0, 4 means 4 or more, like the agent filter', () => {
  const { applySelfOwnerRoomFilters, EMPTY_SELF_OWNER_FILTERS, SELF_OWNER_BEDROOM_FILTERS } = rooms();
  assert.deepEqual(SELF_OWNER_BEDROOM_FILTERS, ['0', '1', '2', '3', '4']);
  const by = (bedrooms) => ids(applySelfOwnerRoomFilters(demo(), { ...EMPTY_SELF_OWNER_FILTERS, bedrooms }));
  assert.deepEqual(by('0'), ['r6', 'r8']);
  assert.deepEqual(by('2'), ['r5', 'r10']);
  assert.deepEqual(by('3'), ['r3']);
  assert.deepEqual(by('4'), []);
  const big = [...demo(), { ...demo()[0], id: 'r20', bedrooms: 5 }];
  assert.deepEqual(ids(applySelfOwnerRoomFilters(big, { ...EMPTY_SELF_OWNER_FILTERS, bedrooms: '4' })), ['r20']);
});

test('rent range: either end may be blank; both ends count as one filter', () => {
  const { applySelfOwnerRoomFilters, EMPTY_SELF_OWNER_FILTERS, activeSelfOwnerFilterCount } = rooms();
  const range = (minPrice, maxPrice) => applySelfOwnerRoomFilters(demo(), { ...EMPTY_SELF_OWNER_FILTERS, minPrice, maxPrice });
  assert.ok(range('20000', '').every((r) => r.monthlyRent >= 20000));
  assert.ok(range('', '15500').every((r) => r.monthlyRent <= 15500));
  assert.deepEqual(ids(range('15500', '16000')), ['r4', 'r11']);
  assert.equal(activeSelfOwnerFilterCount({ bedrooms: '1', minPrice: '1000', maxPrice: '' }), 2);
  assert.equal(activeSelfOwnerFilterCount({ bedrooms: '', minPrice: '', maxPrice: '9000' }), 1);
  // A value that is not a number (should not reach here: the dialog blocks it) filters nothing.
  assert.equal(range('abc', '').length, 14);
});

test('room detail: the agent detail shape from a demo room', () => {
  const r5 = demo().find((r) => r.id === 'r5');
  const d = listing().roomDetailFromSelfOwner(r5);
  assert.equal(d.id, 5);
  assert.equal(d.listingTitle, r5.title);
  assert.equal(d.property.name, r5.project);
  assert.equal(d.visibility, 'published');
  assert.equal(d.roomStatusCode, 'available');
  assert.equal(d.listingSourceCode, 'owner');
  assert.deepEqual(d.prices.map((p) => [p.termMonths, p.price]), [[12, r5.monthlyRent]]);
  assert.equal(d.roomTypeCode, 'two_bedroom');
  assert.deepEqual(d.medias, []);
  assert.deepEqual(d.contacts, []);
  const r1 = listing().roomDetailFromSelfOwner(demo().find((r) => r.id === 'r1'));
  assert.equal(r1.roomStatusCode, 'rented');
  assert.equal(r1.visibility, 'private');
});

test('room detail: a room the owner added shows what they saved (photos, facilities, contact)', () => {
  const { SELF_OWNER_DEMO_OPTIONS, wizardDataFromRoom, roomDetailFromSelfOwner } = listing();
  const room = { ...demo()[5], id: 'r15', state: 'unlisted' };
  const saved = {
    ...wizardDataFromRoom(room),
    listingDescription: 'ห้องมุม วิวสวน',
    medias: [{ mediaUrl: 'file:///a.jpg', category: 'room', isCover: true, sortOrder: 0 }],
    facilities: [SELF_OWNER_DEMO_OPTIONS.facilities[2]],
    contacts: [{ name: 'Jom', phone: '0812345678' }],
    property: { ...wizardDataFromRoom(room).property, latitude: 13.75, longitude: 100.5, district: 'ปทุมวัน' },
  };
  const d = roomDetailFromSelfOwner(room, saved);
  assert.equal(d.id, 15);
  assert.equal(d.description, 'ห้องมุม วิวสวน');
  assert.deepEqual(d.medias, [{ id: 1, mediaUrl: 'file:///a.jpg', mediaType: 'image', isCover: true }]);
  assert.deepEqual(d.facilities, ['air_conditioner']);
  assert.deepEqual(d.contacts.map((c) => [c.name, c.phone, c.isPrimary]), [['Jom', '0812345678', true]]);
  assert.equal(d.property.district, 'ปทุมวัน');
  assert.equal(d.property.latitude, '13.75');
  assert.equal(d.visibility, 'private');
});
