// Plan step 4 (Mos 4 Nov 2026): rules of the agent web Rooms page (filters, sort, paging, price, status text).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTs(file) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)(() => { throw new Error('agent-room-filters must stay dependency free'); }, mod, mod.exports);
  return mod.exports;
}
const rules = loadTs(path.join(__dirname, 'agent-room-filters.ts'));
const empty = rules.EMPTY_ROOM_FILTERS;

test('filter count: each filter once, the price range once', () => {
  assert.equal(rules.activeFilterCount(empty), 0);
  assert.equal(rules.activeFilterCount({ ...empty, roomStatus: 'available', visibility: 'published' }), 2);
  assert.equal(rules.activeFilterCount({ ...empty, minPrice: '10000', maxPrice: '20000' }), 1);
  assert.equal(rules.activeFilterCount({ ...empty, maxPrice: '20000', bedrooms: '2', listingSource: 'owner', propertyType: 'condo', roomType: 'two_bedroom' }), 5);
});

test('room type sets its bedrooms; a bedroom count that does not fit clears the room type', () => {
  assert.deepEqual(rules.withRoomType(empty, 'two_bedroom'), { ...empty, roomType: 'two_bedroom', bedrooms: '2' });
  assert.deepEqual(rules.withRoomType({ ...empty, bedrooms: '3' }, 'duplex'), { ...empty, roomType: 'duplex', bedrooms: '3' });
  assert.deepEqual(rules.withRoomType({ ...empty, roomType: 'studio', bedrooms: '0' }, ''), { ...empty, bedrooms: '0' });
  assert.deepEqual(rules.withBedrooms({ ...empty, roomType: 'two_bedroom', bedrooms: '2' }, '3'), { ...empty, bedrooms: '3' });
  assert.deepEqual(rules.withBedrooms({ ...empty, roomType: 'two_bedroom', bedrooms: '2' }, '2'), { ...empty, roomType: 'two_bedroom', bedrooms: '2' });
  assert.deepEqual(rules.withBedrooms({ ...empty, roomType: 'penthouse' }, '4'), { ...empty, roomType: 'penthouse', bedrooms: '4' });
  assert.deepEqual(rules.withBedrooms({ ...empty, roomType: 'studio', bedrooms: '0' }, ''), { ...empty, roomType: 'studio', bedrooms: '' });
});

test('table sort and API sort map both ways', () => {
  for (const api of ['updated_desc', 'updated_asc', 'price_asc', 'price_desc']) {
    assert.equal(rules.toApiSort(rules.fromApiSort(api)), api);
  }
  assert.deepEqual(rules.fromApiSort('price_asc'), { key: 'price', direction: 'asc' });
});

test('page range and page buttons', () => {
  assert.deepEqual(rules.pageRange(1, 24, 36), { from: 1, to: 24, pages: 2 });
  assert.deepEqual(rules.pageRange(2, 24, 36), { from: 25, to: 36, pages: 2 });
  assert.deepEqual(rules.pageRange(9, 24, 36), { from: 25, to: 36, pages: 2 });
  assert.deepEqual(rules.pageRange(1, 24, 0), { from: 0, to: 0, pages: 1 });
  assert.deepEqual(rules.pageButtons(1, 3), [1, 2, 3]);
  assert.deepEqual(rules.pageButtons(1, 10), [1, 2, null, 10]);
  assert.deepEqual(rules.pageButtons(5, 10), [1, null, 4, 5, 6, null, 10]);
  assert.deepEqual(rules.pageButtons(10, 10), [1, null, 9, 10]);
  assert.deepEqual(rules.pageButtons(2, 8), [1, 2, 3, null, 8]);
});

test('list price is the lowest real price, as the app cards', () => {
  assert.equal(rules.listPrice([]), null);
  assert.equal(rules.listPrice([{ price: 15000 }, { price: 12000 }]), 12000);
  assert.equal(rules.listPrice([{ price: 0 }, { price: NaN }]), null);
});

test('status text: soon vacant shows the day; unknown code falls back', () => {
  const copy = { available: 'Available', soon_vacant: 'Soon vacant', soonVacantFrom: 'Soon vacant (free {date})', notSpecified: 'Not specified' };
  assert.equal(rules.roomStatusText(copy, 'available', null, 'en'), 'Available');
  assert.match(rules.roomStatusText(copy, 'soon_vacant', '2027-11-01', 'en'), /^Soon vacant \(free .*2027\)$/);
  assert.equal(rules.roomStatusText(copy, 'soon_vacant', 'bad', 'en'), 'Soon vacant');
  assert.equal(rules.roomStatusText(copy, 'weird', null, 'en'), 'weird');
  assert.equal(rules.roomStatusText(copy, null, null, 'en'), 'Not specified');
});
