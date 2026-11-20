// Self owner rooms list (UI round, 19 Nov 2026, ClickUp z8rcteng6c): one demo room set, search, filter, sort, pages.
const { test } = require('node:test');
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
const rooms = () => load(path.join(__dirname, '../lib/self-owner-rooms.ts'));
const now = new Date('2026-11-19T04:00:00Z');
const ids = (list) => list.map((room) => room.id);

test('one demo set of 14 rooms covers every state and a long title', () => {
  const list = rooms().createSelfOwnerRoomsDemo(now);
  assert.equal(list.length, 14);
  assert.deepEqual([...new Set(list.map((r) => r.state))].sort(), ['listed', 'occupied', 'unlisted']);
  assert.ok(list.some((r) => r.title.length >= 40));
  assert.ok(list.every((r) => r.bedrooms >= 0 && r.sizeSqm > 0 && !Number.isNaN(Date.parse(r.updatedAt))));
  assert.deepEqual(list, rooms().createSelfOwnerRoomsDemo(now));
});

test('search trims, ignores case and matches room, project or tenant', () => {
  const { createSelfOwnerRoomsDemo, filterSelfOwnerRooms } = rooms();
  const list = createSelfOwnerRoomsDemo(now);
  assert.deepEqual(ids(filterSelfOwnerRooms(list, '  1204 ', 'all', 'updated_desc')), ['r1']);
  assert.deepEqual(ids(filterSelfOwnerRooms(list, 'emily', 'all', 'updated_desc')), ['r2']);
  const byProject = filterSelfOwnerRooms(list, 'noble', 'all', 'updated_desc');
  assert.ok(byProject.length >= 1 && byProject.every((r) => r.project.toLowerCase().includes('noble')));
  assert.equal(filterSelfOwnerRooms(list, 'ไม่มีห้องนี้แน่นอน', 'all', 'updated_desc').length, 0);
});

test('filter by state and counts per state', () => {
  const { createSelfOwnerRoomsDemo, filterSelfOwnerRooms, countSelfOwnerRooms } = rooms();
  const list = createSelfOwnerRoomsDemo(now);
  const counts = countSelfOwnerRooms(list);
  assert.equal(counts.all, 14);
  assert.equal(counts.occupied + counts.listed + counts.unlisted, 14);
  for (const state of ['occupied', 'listed', 'unlisted']) {
    const out = filterSelfOwnerRooms(list, '', state, 'updated_desc');
    assert.equal(out.length, counts[state], state);
    assert.ok(out.every((r) => r.state === state));
  }
});

test('three sorts', () => {
  const { createSelfOwnerRoomsDemo, filterSelfOwnerRooms } = rooms();
  const list = createSelfOwnerRoomsDemo(now);
  const updated = filterSelfOwnerRooms(list, '', 'all', 'updated_desc').map((r) => Date.parse(r.updatedAt));
  assert.deepEqual(updated, [...updated].sort((a, b) => b - a));
  const asc = filterSelfOwnerRooms(list, '', 'all', 'rent_asc').map((r) => r.monthlyRent);
  assert.deepEqual(asc, [...asc].sort((a, b) => a - b));
  const desc = filterSelfOwnerRooms(list, '', 'all', 'rent_desc').map((r) => r.monthlyRent);
  assert.deepEqual(desc, [...desc].sort((a, b) => b - a));
  const oldest = filterSelfOwnerRooms(list, '', 'all', 'updated_asc').map((r) => Date.parse(r.updatedAt));
  assert.deepEqual(oldest, [...oldest].sort((a, b) => a - b));
  assert.equal(list.length, 14, 'input list is not mutated');
});

test('table column sort maps to the room sort and back (agent pattern: sort from the column headers)', () => {
  const { sortToColumn, columnToSort } = rooms();
  for (const sort of ['updated_desc', 'updated_asc', 'rent_asc', 'rent_desc']) {
    const column = sortToColumn(sort);
    assert.equal(columnToSort(column.key, column.direction), sort, sort);
  }
  assert.deepEqual(sortToColumn('updated_desc'), { key: 'updated', direction: 'desc' });
  assert.deepEqual(sortToColumn('rent_asc'), { key: 'rent', direction: 'asc' });
  assert.equal(columnToSort('room', 'asc'), 'updated_desc', 'a column without a sort falls back to newest first');
});

test('clampPage keeps the page inside the results', () => {
  const { clampPage, SELF_OWNER_ROOMS_PAGE_SIZE } = rooms();
  assert.equal(SELF_OWNER_ROOMS_PAGE_SIZE, 10);
  assert.equal(clampPage(3, 4), 1);
  assert.equal(clampPage(2, 14), 2);
  assert.equal(clampPage(5, 14), 2);
  assert.equal(clampPage(0, 14), 1);
  assert.equal(clampPage(2, 0), 1);
});

test('dashboard and rooms page use the same rooms; the hook is demo with no network', () => {
  const dashboard = load(path.join(__dirname, '../lib/self-owner-dashboard.ts'));
  const snapshot = dashboard.createSelfOwnerDashboardDemoFixture({ greetingName: 'Jom', localDateLabel: 'x', now });
  assert.deepEqual(snapshot.rooms.items, rooms().createSelfOwnerRoomsDemo(now));
  const hook = rooms().useSelfOwnerRooms();
  assert.equal(hook.status, 'demo');
  assert.equal(hook.isDemoPreview, true);
  assert.equal(hook.rooms.length, 14);
  const code = fs.readFileSync(path.join(__dirname, '../lib/self-owner-rooms.ts'), 'utf8');
  assert.doesNotMatch(code, /from ['"][^'"]*\/api/);
  assert.doesNotMatch(code, /fetch\(/);
});

test('page buttons like the agent pager: all pages up to 7, else first, around current, last with gaps', () => {
  const { pageButtons } = rooms();
  assert.deepEqual(pageButtons(1, 1), [1]);
  assert.deepEqual(pageButtons(2, 7), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(pageButtons(1, 12), [1, 2, 3, null, 12]);
  assert.deepEqual(pageButtons(6, 12), [1, null, 5, 6, 7, null, 12]);
  assert.deepEqual(pageButtons(12, 12), [1, null, 10, 11, 12]);
});
