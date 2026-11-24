// Self owner contracts and income (UI round, 24 Nov 2026, ClickUp z8rcteng6e / z8rcteng6f): demo contracts and monthly rent.
// Plan: Project plans/2026-11-24-self-owner-contracts-income.md Task 1.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const file = path.join(__dirname, '../lib/self-owner-contracts.ts');
function loadFile(target) {
  const module = { exports: {} };
  const localRequire = (name) => {
    if (name === 'react') return { useMemo: (fn) => fn(), useSyncExternalStore: (_subscribe, get) => get() };
    if (name.startsWith('.')) return loadFile(`${path.resolve(path.dirname(target), name)}.ts`);
    return require(name);
  };
  const source = ts.transpileModule(fs.readFileSync(target, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
  return module.exports;
}
const load = () => loadFile(file);
const rooms = (now) => loadFile(path.join(__dirname, '../lib/self-owner-rooms.ts')).createSelfOwnerRoomsDemo(now);
const now = new Date('2026-11-24T03:00:00Z');
const byRoom = (list, title) => list.filter((c) => c.roomTitle === title);

test('demo is deterministic and covers every status', () => {
  const { createSelfOwnerContractsDemo } = load();
  const a = createSelfOwnerContractsDemo(now);
  assert.deepEqual(a, createSelfOwnerContractsDemo(now));
  assert.equal(a.length, 11);
  assert.deepEqual([...new Set(a.map((c) => c.status))].sort(), ['active', 'awaiting_signature', 'ended', 'ending_soon']);
  assert.equal(new Set(a.map((c) => c.tenantPhone)).size, a.length, 'phones differ');
  assert.ok(a.every((c) => c.advanceRentMonths === 1 && c.depositMonths === 2 && c.monthlyRent > 0));
});

test('every occupied room has one contract ending on its lease end', () => {
  const { createSelfOwnerContractsDemo } = load();
  const list = createSelfOwnerContractsDemo(now);
  for (const room of rooms(now).filter((r) => r.state === 'occupied')) {
    const mine = list.filter((c) => c.roomId === room.id);
    assert.equal(mine.length, 1, room.id);
    assert.equal(mine[0].endDate, room.leaseEndsAt, room.id);
    assert.equal(mine[0].tenantName, room.tenantName, room.id);
  }
  assert.equal(byRoom(list, 'ห้อง 2101')[0].status, 'awaiting_signature');
  assert.equal(byRoom(list, 'ห้อง 2101')[0].tenantName, 'คุณกานต์');
  assert.equal(byRoom(list, 'ห้อง 2101')[0].startDate, '2026-12-01');
  assert.equal(byRoom(list, 'ห้อง 309')[0].status, 'ended');
});

test('ending soon is 60 days or less', () => {
  const { createSelfOwnerContractsDemo, SELF_OWNER_ENDING_SOON_DAYS } = load();
  assert.equal(SELF_OWNER_ENDING_SOON_DAYS, 60);
  const list = createSelfOwnerContractsDemo(now);
  const c805 = byRoom(list, 'ห้อง 805')[0];
  assert.equal(c805.status, 'ending_soon');
  assert.equal(c805.daysLeft, 37);
  const dayMs = 86_400_000;
  const left = (c) => Math.round((Date.parse(`${c.endDate}T00:00:00Z`) - Date.parse('2026-11-24T00:00:00Z')) / dayMs);
  assert.ok(list.filter((c) => c.status === 'active').every((c) => left(c) > 60));
  assert.ok(list.filter((c) => c.status !== 'ending_soon').every((c) => c.daysLeft === undefined));
});

test('no contract starts after today unless awaiting signature', () => {
  const { createSelfOwnerContractsDemo } = load();
  for (const [when, today] of [[now, '2026-11-24'], [new Date('2027-01-15T03:00:00Z'), '2027-01-15']]) {
    const list = createSelfOwnerContractsDemo(when);
    assert.ok(list.filter((c) => c.status !== 'awaiting_signature').every((c) => c.startDate <= today), today);
    assert.ok(list.every((c) => c.startDate < c.endDate));
  }
});

test('filter and search', () => {
  const { createSelfOwnerContractsDemo, countSelfOwnerContracts, filterSelfOwnerContracts } = load();
  const list = createSelfOwnerContractsDemo(now);
  const counts = countSelfOwnerContracts(list);
  assert.equal(counts.all, 11);
  assert.equal(counts.active + counts.ending_soon + counts.awaiting_signature + counts.ended, counts.all);
  assert.deepEqual(filterSelfOwnerContracts(list, '  emily ', 'all').map((c) => c.roomTitle), ['ห้อง 805']);
  assert.deepEqual(filterSelfOwnerContracts(list, 'zzz', 'all'), []);
  assert.equal(filterSelfOwnerContracts(list, '', 'ended').length, counts.ended);
  const all = filterSelfOwnerContracts(list, '', 'all');
  assert.deepEqual(all.map((c) => c.status).filter((s, i, a) => a.indexOf(s) === i), ['awaiting_signature', 'ending_soon', 'active', 'ended']);
  const active = all.filter((c) => c.status === 'active').map((c) => c.endDate);
  assert.deepEqual(active, [...active].sort());
  assert.equal(list.length, 11, 'input not mutated');
});

test('this month rent follows the dashboard plan', () => {
  const { createSelfOwnerContractsDemo, selfOwnerRentForMonth } = load();
  const rows = selfOwnerRentForMonth(createSelfOwnerContractsDemo(now), 2026, 11, now);
  const row = (title) => rows.find((r) => r.roomTitle === title);
  assert.equal(rows.length, 9);
  assert.deepEqual([row('ห้อง 805').state, row('ห้อง 805').overdueDays], ['overdue', 23]);
  assert.deepEqual([row('ห้อง 612').state, row('ห้อง 612').overdueDays], ['overdue', 14]);
  assert.equal(row('ห้อง 417').state, 'due');
  assert.equal(row('ห้อง 2208').state, 'due');
  assert.equal(row('ห้อง 417').dueDate, '2026-11-25');
  const paid = rows.filter((r) => r.state === 'paid');
  assert.equal(paid.length, 5);
  assert.ok(paid.every((r) => r.paidAt === '2026-11-03' && r.dueDate === '2026-11-05'));
  assert.equal(row('ห้อง 2101'), undefined);
  assert.equal(row('ห้อง 309'), undefined);
});

test('early in the month nothing is paid ahead', () => {
  const { createSelfOwnerContractsDemo, selfOwnerRentForMonth } = load();
  const early = new Date('2026-12-02T03:00:00Z');
  const rows = selfOwnerRentForMonth(createSelfOwnerContractsDemo(early), 2026, 12, early);
  assert.ok(rows.length > 0);
  assert.ok(rows.filter((r) => r.state === 'paid').every((r) => r.dueDate <= '2026-12-02'));
  assert.ok(rows.filter((r) => r.dueDate > '2026-12-02').every((r) => r.state === 'due'));
});

test('past months are all paid, future months empty, months run oldest to newest', () => {
  const { createSelfOwnerContractsDemo, selfOwnerRentForMonth, selfOwnerIncomeMonths } = load();
  const list = createSelfOwnerContractsDemo(now);
  const october = selfOwnerRentForMonth(list, 2026, 10, now);
  assert.ok(october.length > 0);
  assert.ok(october.every((r) => r.state === 'paid' && r.paidAt === '2026-10-03'));
  assert.deepEqual(selfOwnerRentForMonth(list, 2026, 12, now), []);
  const months = selfOwnerIncomeMonths(list, now);
  assert.deepEqual(months.at(-1), { year: 2026, month: 11 });
  const keys = months.map((m) => m.year * 12 + m.month);
  assert.deepEqual(keys, [...keys].sort((x, y) => x - y));
  assert.equal(new Set(keys).size, keys.length);
  const first = months[0];
  assert.ok(selfOwnerRentForMonth(list, first.year, first.month, now).length > 0, 'the first month has rent');
});

// Jom 24 Nov 2026: an owner can have rooms in several projects, so each rent row says which project the room is in.
test('rent rows carry the contract project', () => {
  const { createSelfOwnerContractsDemo, selfOwnerRentForMonth } = load();
  const contracts = createSelfOwnerContractsDemo(now);
  const rows = selfOwnerRentForMonth(contracts, 2026, 11, now);
  assert.ok(rows.length > 0);
  for (const r of rows) {
    const c = contracts.find(x => x.roomTitle === r.roomTitle);
    assert.equal(r.project, c.project, r.roomTitle);
    assert.ok(r.project, r.roomTitle);
  }
});

test('hooks make no network call', () => {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /from ['"][^'"]*\/api/);
  assert.doesNotMatch(source, /fetch\(/);
  const { useSelfOwnerContracts, useSelfOwnerIncome } = load();
  const c = useSelfOwnerContracts();
  assert.equal(c.status, 'demo');
  assert.equal(c.isDemoPreview, true);
  assert.equal(c.contracts.length, 11);
  const i = useSelfOwnerIncome();
  assert.equal(i.contracts.length, 11);
  assert.ok(i.months.length > 0);
});
