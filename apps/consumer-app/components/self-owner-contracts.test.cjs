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

// Contract kinds (Jom 24 Nov 2026): a room has many contracts over time, of 4 kinds; the page lists rooms.
// Plan: Project plans/2026-11-24-self-owner-contract-kinds.md Task 1.
const roomOf = (groups, title) => groups.find((g) => g.roomTitle === title);

test('demo is deterministic: 17 contracts of 4 kinds in 11 rooms', () => {
  const { createSelfOwnerContractsDemo, groupSelfOwnerContracts } = load();
  const a = createSelfOwnerContractsDemo(now);
  assert.deepEqual(a, createSelfOwnerContractsDemo(now));
  assert.equal(a.length, 17);
  assert.deepEqual([...new Set(a.map((c) => c.kind))].sort(), ['broker_appointment', 'lease', 'renewal', 'reservation']);
  assert.deepEqual([...new Set(a.map((c) => c.status))].sort(), ['active', 'awaiting_signature', 'ended', 'ending_soon']);
  assert.equal(new Set(a.map((c) => c.id)).size, a.length, 'ids differ');
  assert.equal(groupSelfOwnerContracts(a).length, 11);
  const rent = a.filter((c) => c.kind === 'lease' || c.kind === 'renewal');
  assert.ok(rent.every((c) => c.advanceRentMonths === 1 && c.depositMonths === 2 && c.monthlyRent > 0));
  assert.ok(a.filter((c) => c.kind === 'broker_appointment').every((c) => c.broker && c.broker.company && c.broker.contact));
  assert.ok(a.filter((c) => c.kind === 'reservation').every((c) => c.reservation && c.reservation.bookingFee > 0 && c.reservation.moveInDate));
});

test('room 1204 has all 4 kinds, newest first, the renewal follows the lease', () => {
  const { createSelfOwnerContractsDemo, groupSelfOwnerContracts } = load();
  const g = roomOf(groupSelfOwnerContracts(createSelfOwnerContractsDemo(now)), 'ห้อง 1204');
  assert.deepEqual(g.contracts.map((c) => c.kind), ['renewal', 'lease', 'reservation', 'broker_appointment']);
  const [renewal, lease, reservation, broker] = g.contracts;
  assert.equal(g.current.id, renewal.id);
  assert.equal(g.status, 'active');
  assert.equal(renewal.renewsContractId, lease.id);
  const dayAfter = new Date(Date.parse(`${lease.endDate}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  assert.equal(renewal.startDate, dayAfter);
  assert.equal(lease.status, 'ended');
  assert.equal(reservation.reservation.moveInDate, lease.startDate);
  assert.equal(broker.status, 'ended');
  assert.equal(broker.broker.contact, 'สมชาย ใจดี');
});

test('current contract: occupied rooms end on the lease end; 2101 awaits signature; 805 ends soon with a renewal waiting', () => {
  const { createSelfOwnerContractsDemo, groupSelfOwnerContracts } = load();
  const groups = groupSelfOwnerContracts(createSelfOwnerContractsDemo(now));
  for (const room of rooms(now).filter((r) => r.state === 'occupied')) {
    const g = groups.find((x) => x.roomId === room.id);
    assert.equal(g.current.endDate, room.leaseEndsAt, room.id);
    assert.equal(g.current.tenantName, room.tenantName, room.id);
    assert.ok(['lease', 'renewal'].includes(g.current.kind), room.id);
  }
  const r2101 = roomOf(groups, 'ห้อง 2101');
  assert.equal(r2101.contracts.length, 3);
  assert.deepEqual([r2101.current.kind, r2101.current.status, r2101.current.tenantName, r2101.current.startDate], ['lease', 'awaiting_signature', 'คุณกานต์', '2026-12-01']);
  assert.equal(r2101.status, 'awaiting_signature');
  const r805 = roomOf(groups, 'ห้อง 805');
  assert.deepEqual([r805.current.kind, r805.status, r805.current.daysLeft], ['lease', 'ending_soon', 37]);
  assert.ok(r805.contracts.some((c) => c.kind === 'renewal' && c.status === 'awaiting_signature'));
  assert.equal(roomOf(groups, 'ห้อง 309').status, 'ended');
});

// The system's word (agent side, migration 20261103110000): a booking letter whose lease is in force is "ใช้แล้ว" —
// status terminated with end reason reservation_fulfilled (Jom 24 Nov 2026).
test('a reservation whose lease started is used (reservation_fulfilled); others are not', () => {
  const { createSelfOwnerContractsDemo, isFulfilledReservation } = load();
  for (const when of [now, new Date('2027-01-15T03:00:00Z')]) {
    const list = createSelfOwnerContractsDemo(when);
    const used = list.find((c) => c.id === 'c-r1-reservation');
    assert.deepEqual([used.status, used.endReason], ['ended', 'reservation_fulfilled']);
    assert.equal(isFulfilledReservation(used), true);
    assert.equal(isFulfilledReservation(list.find((c) => c.id === 'c-r1-lease')), false, 'an ended lease is not "used"');
    assert.equal(list.filter((c) => c.endReason).length, 1, 'only that reservation');
  }
  const waiting = createSelfOwnerContractsDemo(now).find((c) => c.id === 'c-r5-reservation');
  assert.equal(waiting.status, 'active');
  assert.equal(isFulfilledReservation(waiting), false);
});

test('a room with only a broker appointment and a reservation shows the newest of them', () => {
  const { createSelfOwnerContractsDemo, groupSelfOwnerContracts } = load();
  const base = createSelfOwnerContractsDemo(now).filter((c) => c.roomId === 'r5' && c.kind !== 'lease');
  const [g] = groupSelfOwnerContracts(base);
  assert.equal(g.contracts.length, 2);
  assert.equal(g.current.kind, 'reservation');
});

test('ending soon is 60 days or less, and only for leases and renewals', () => {
  const { createSelfOwnerContractsDemo, SELF_OWNER_ENDING_SOON_DAYS } = load();
  assert.equal(SELF_OWNER_ENDING_SOON_DAYS, 60);
  const list = createSelfOwnerContractsDemo(now);
  const dayMs = 86_400_000;
  const left = (c) => Math.round((Date.parse(`${c.endDate}T00:00:00Z`) - Date.parse('2026-11-24T00:00:00Z')) / dayMs);
  assert.ok(list.filter((c) => c.status === 'ending_soon').every((c) => c.kind === 'lease' || c.kind === 'renewal'));
  assert.ok(list.filter((c) => c.status === 'active' && (c.kind === 'lease' || c.kind === 'renewal')).every((c) => left(c) > 60));
  assert.ok(list.filter((c) => c.status !== 'ending_soon').every((c) => c.daysLeft === undefined));
});

test('no contract starts after today unless awaiting signature', () => {
  const { createSelfOwnerContractsDemo } = load();
  for (const [when, today] of [[now, '2026-11-24'], [new Date('2027-01-15T03:00:00Z'), '2027-01-15']]) {
    const list = createSelfOwnerContractsDemo(when);
    assert.ok(list.filter((c) => c.status !== 'awaiting_signature').every((c) => c.startDate <= today), today);
    assert.ok(list.every((c) => c.startDate < c.endDate), today);
  }
});

test('rooms: count, filter by the current status, search every contract', () => {
  const { createSelfOwnerContractsDemo, groupSelfOwnerContracts, countSelfOwnerRooms, filterSelfOwnerRooms } = load();
  const groups = groupSelfOwnerContracts(createSelfOwnerContractsDemo(now));
  const counts = countSelfOwnerRooms(groups);
  assert.equal(counts.all, 11);
  assert.equal(counts.active + counts.ending_soon + counts.awaiting_signature + counts.ended, counts.all);
  assert.deepEqual(filterSelfOwnerRooms(groups, '  emily ', 'all').map((g) => g.roomTitle), ['ห้อง 805']);
  assert.deepEqual(filterSelfOwnerRooms(groups, 'สมชาย', 'all').map((g) => g.roomTitle), ['ห้อง 1204'], 'broker contact');
  assert.deepEqual(filterSelfOwnerRooms(groups, 'zzz', 'all'), []);
  assert.deepEqual(filterSelfOwnerRooms(groups, '', 'ended').map((g) => g.roomTitle), ['ห้อง 309']);
  const all = filterSelfOwnerRooms(groups, '', 'all');
  assert.equal(all[0].roomTitle, 'ห้อง 2101');
  assert.deepEqual(all.map((g) => g.status).filter((s, i, a) => a.indexOf(s) === i), ['awaiting_signature', 'ending_soon', 'active', 'ended']);
  const active = all.filter((g) => g.status === 'active').map((g) => g.current.endDate);
  assert.deepEqual(active, [...active].sort());
  assert.equal(groups.length, 11, 'input not mutated');
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

test('rent comes only from leases and renewals; row ids are unique per contract', () => {
  const { createSelfOwnerContractsDemo, selfOwnerRentForMonth } = load();
  const list = createSelfOwnerContractsDemo(now);
  for (const [y, m] of [[2026, 11], [2026, 10], [2025, 4]]) {
    const rows = selfOwnerRentForMonth(list, y, m, now);
    assert.equal(new Set(rows.map((r) => r.id)).size, rows.length, `${y}-${m}`);
  }
  // Two leases of one room in one month (a change mid-month) plus a broker appointment: two rows, different ids.
  const lease = list.find((c) => c.roomId === 'r1' && c.kind === 'renewal');
  const old = { ...lease, id: 'c-old', kind: 'lease', startDate: '2025-10-16', endDate: '2026-10-15', status: 'ended' };
  const cur = { ...lease, id: 'c-new', startDate: '2026-10-16', endDate: '2027-10-15', status: 'active' };
  const broker = list.find((c) => c.kind === 'broker_appointment' && c.status === 'active');
  const rows = selfOwnerRentForMonth([old, cur, { ...broker, startDate: '2026-10-01' }], 2026, 10, now);
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].id, rows[1].id);
});

test('income months start at the oldest lease, not at a broker appointment or reservation', () => {
  const { createSelfOwnerContractsDemo, selfOwnerIncomeMonths } = load();
  const list = createSelfOwnerContractsDemo(now);
  const oldestRent = list.filter((c) => (c.kind === 'lease' || c.kind === 'renewal') && c.status !== 'awaiting_signature').map((c) => c.startDate).sort()[0];
  const [y, m] = oldestRent.split('-').map(Number);
  assert.deepEqual(selfOwnerIncomeMonths(list, now)[0], { year: y, month: m });
  assert.ok(list.some((c) => c.kind === 'broker_appointment' && c.startDate < oldestRent), 'a broker appointment is older');
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
    const c = contracts.find(x => x.roomTitle === r.roomTitle && (x.kind === 'lease' || x.kind === 'renewal'));
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
  assert.equal(c.contracts.length, 17);
  const i = useSelfOwnerIncome();
  assert.equal(i.contracts.length, 17);
  assert.ok(i.months.length > 0);
});
