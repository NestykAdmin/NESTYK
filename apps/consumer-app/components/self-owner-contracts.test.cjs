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

// Self owner contracts API data layer (26 Nov 2026): plans/2026-11-26-self-owner-contracts-api.md Task 5.
const TODAY = '2026-11-26';
const party = (over = {}) => ({
  id: 41, tenantId: 7, leadId: 3, rentRoomId: null, selfOwnerRoomId: 5, agreementTypeName: 'สัญญาเช่า', formKind: 'lease',
  reservationFee: null, status: 'awaiting_signatures', startDate: '2026-12-01', endDate: '2027-11-30', bookingDate: null, moveInDate: null,
  monthlyRent: 15000, deposit: 30000, endReasonCode: null, ownerSignedAt: null, tenantSignedAt: '2026-11-25T05:00:00.000Z', agentSignedAt: null,
  data: { tenantPhone: '081-234-5678', advanceMonths: '1', depositMonths: '2' },
  property: 'The Line', room: 'ห้อง 2101', tenant: 'คุณกานต์', myParties: ['owner'], ...over,
});
const fakeBackend = (over = {}) => ({
  list: async () => [party()],
  sign: async () => party({ status: 'awaiting_agent_review', ownerSignedAt: '2026-11-26T03:00:00.000Z' }),
  documentUrl: async (id) => `https://files.test/${id}.pdf`,
  ...over,
});
const storeOf = () => load().selfOwnerContractStore;
const copyOf = (l) => loadFile(path.join(__dirname, `../../../packages/i18n/src/locales/${l}.ts`))[l];
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('maps an awaiting lease with the tenant signed', () => {
  const c = load().fromPartyContract(party(), TODAY);
  assert.deepEqual(
    [c.id, c.apiId, c.kind, c.roomId, c.roomTitle, c.project, c.tenantName, c.tenantPhone, c.monthlyRent, c.advanceRentMonths, c.depositMonths, c.status, c.startDate, c.endDate],
    ['41', 41, 'lease', '5', 'ห้อง 2101', 'The Line', 'คุณกานต์', '081-234-5678', 15000, 1, 2, 'awaiting_signature', '2026-12-01', '2027-11-30'],
  );
  assert.deepEqual(c.signatures, { tenant: '2026-11-25' });
  const bare = load().fromPartyContract(party({ data: {} }), TODAY);
  assert.deepEqual([bare.tenantPhone, bare.advanceRentMonths, bare.depositMonths], ['', 0, 0]);
});

test('signed by both maps to processing', () => {
  const { fromPartyContract } = load();
  for (const status of ['awaiting_agent_review', 'awaiting_deposit', 'awaiting_handover']) {
    const c = fromPartyContract(party({ status, ownerSignedAt: '2026-11-26T20:00:00.000Z' }), TODAY);
    assert.equal(c.status, 'processing', status);
    assert.equal(c.signatures.owner, '2026-11-27', 'Bangkok day');
  }
});

test('active maps to active, ending soon, or ended past its end date', () => {
  const { fromPartyContract } = load();
  const active = (endDate) => fromPartyContract(party({ status: 'active', endDate }), TODAY);
  assert.equal(active('2027-11-30').status, 'active');
  const soon = active('2027-01-20');
  assert.deepEqual([soon.status, soon.daysLeft], ['ending_soon', 55]);
  assert.equal(active('2026-11-25').status, 'ended');
  assert.equal(fromPartyContract(party({ status: 'expired' }), TODAY).status, 'ended');
  assert.equal(fromPartyContract(party({ status: 'terminated' }), TODAY).status, 'ended');
});

test('tenant rows are dropped', () => {
  assert.equal(load().fromPartyContract(party({ myParties: ['tenant'] }), TODAY), null);
});
test('agent room rows are dropped', () => {
  assert.equal(load().fromPartyContract(party({ selfOwnerRoomId: null }), TODAY), null);
  assert.equal(load().fromPartyContract(party({ selfOwnerRoomId: undefined }), TODAY), null);
});
test('cancelled is dropped', () => {
  assert.equal(load().fromPartyContract(party({ status: 'cancelled' }), TODAY), null);
});

test('reservation and broker appointment map their own fields', () => {
  const { fromPartyContract } = load();
  const r = fromPartyContract(party({ formKind: 'reservation', reservationFee: 15000, moveInDate: '2026-12-01', endDate: null }), TODAY);
  assert.deepEqual(r.reservation, { moveInDate: '2026-12-01', bookingFee: 15000 });
  assert.equal(r.endDate, '2026-12-01');
  const b = fromPartyContract(party({ formKind: 'broker_appointment', endDate: null, tenant: '', agentSignedAt: '2026-11-20T05:00:00.000Z', data: { brokerCompany: 'Urban Nest', brokerContact: 'Jenny', brokerPhone: '02-660-7171', commissionMonths: '1' } }), TODAY);
  assert.deepEqual(b.broker, { company: 'Urban Nest', contact: 'Jenny', phone: '02-660-7171', commission: { months: 1 } });
  assert.equal(b.signatures.broker, '2026-11-20');
});

test('store: connect loads, then status available', async () => {
  const lib = load();
  const store = lib.selfOwnerContractStore;
  assert.equal(store.getState().status, 'demo');
  store.connect(fakeBackend({ list: async () => [party(), party({ id: 42, myParties: ['tenant'] }), party({ id: 43, selfOwnerRoomId: null })] }), 'u1');
  assert.deepEqual([store.getState().status, store.getState().source, store.getState().contracts.length], ['loading', 'api', 0]);
  await tick();
  const s = store.getState();
  assert.deepEqual([s.status, s.contracts.map((c) => c.id)], ['available', ['41']]);
  const hook = lib.useSelfOwnerContracts();
  assert.deepEqual([hook.status, hook.isDemoPreview, hook.contracts.length], ['available', false, 1]);
});

test('store: list failure gives error', async () => {
  const store = storeOf();
  store.connect(fakeBackend({ list: async () => { throw new Error('boom'); } }), 'u1');
  await tick();
  assert.equal(store.getState().status, 'error');
});

test('store: sign success refreshes the contract', async () => {
  const store = storeOf();
  const calls = [];
  store.connect(fakeBackend({ sign: async (id, png) => { calls.push([id, png]); return party({ status: 'awaiting_agent_review', ownerSignedAt: '2026-11-26T03:00:00.000Z' }); } }), 'u1');
  await tick();
  assert.deepEqual(await store.sign('41', 'data:image/png;base64,AAAA'), { ok: true });
  assert.deepEqual(calls, [[41, 'data:image/png;base64,AAAA']]);
  const c = store.getState().contracts[0];
  assert.deepEqual([c.status, c.signatures.owner], ['processing', '2026-11-26']);
});

test('store: sign failure returns the API message and keeps the contract unsigned', async () => {
  const store = storeOf();
  const fail = (message, extra = {}) => Object.assign(new Error(message), extra);
  let error = fail('ฝ่ายนี้ลงนามแล้ว', { status: 400 });
  store.connect(fakeBackend({ sign: async () => { throw error; } }), 'u1');
  await tick();
  assert.deepEqual(await store.sign('41', 'png'), { ok: false, message: 'ฝ่ายนี้ลงนามแล้ว' });
  assert.deepEqual([store.getState().contracts[0].status, store.getState().contracts[0].signatures.owner], ['awaiting_signature', undefined]);
  error = fail('Failed to fetch', { status: 0, code: 'NETWORK_ERROR' });
  assert.deepEqual(await store.sign('41', 'png', 'ลองใหม่'), { ok: false, message: 'ลองใหม่' });
  error = fail('', { status: 500 });
  assert.equal((await store.sign('41', 'png', 'ลองใหม่')).message, 'ลองใหม่');
  error = 'not an error object';
  assert.equal((await store.sign('41', 'png')).ok, false);
  assert.equal((await store.sign('999', 'png')).ok, false, 'unknown contract');
  assert.equal(store.getState().contracts[0].status, 'awaiting_signature');
});

test('store: a server error or a raw "HTTP ..." message never reaches the owner as English text', async () => {
  const store = storeOf();
  const fail = (message, extra = {}) => Object.assign(new Error(message), extra);
  let error = fail('Internal server error', { status: 500 });
  store.connect(fakeBackend({ sign: async () => { throw error; } }), 'u1');
  await tick();
  assert.equal((await store.sign('41', 'png', 'ลองใหม่')).message, 'ลองใหม่', '5xx');
  error = fail('Bad gateway', { status: 502 });
  assert.equal((await store.sign('41', 'png', 'ลองใหม่')).message, 'ลองใหม่', '502');
  error = fail('HTTP 404', { status: 404 });
  assert.equal((await store.sign('41', 'png', 'ลองใหม่')).message, 'ลองใหม่', 'a message that starts with HTTP');
  error = fail('ฝ่ายนี้ลงนามแล้ว', { status: 409 });
  assert.equal((await store.sign('41', 'png', 'ลองใหม่')).message, 'ฝ่ายนี้ลงนามแล้ว', 'the API Thai message stays');
});

test('store: a 409 sign failure loads the list again', async () => {
  const store = storeOf();
  let loads = 0;
  store.connect(fakeBackend({ list: async () => { loads += 1; return [party()]; }, sign: async () => { throw Object.assign(new Error('สัญญาถูกเปลี่ยนแล้ว กรุณาเปิดใหม่ก่อนลงนาม'), { status: 409 }); } }), 'u1');
  await tick();
  const result = await store.sign('41', 'png');
  await tick();
  assert.equal(result.message, 'สัญญาถูกเปลี่ยนแล้ว กรุณาเปิดใหม่ก่อนลงนาม');
  assert.equal(loads, 2);
});

test('store: document url comes from the API when connected', async () => {
  const store = storeOf();
  store.connect(fakeBackend(), 'u1');
  await tick();
  assert.equal(await store.documentUrl('41'), 'https://files.test/41.pdf');
  await assert.rejects(store.documentUrl('999'));
});

test('store: disconnect goes back to the demo', async () => {
  const store = storeOf();
  store.connect(fakeBackend(), 'u1');
  await tick();
  store.disconnect(now);
  const s = store.getState();
  assert.deepEqual([s.source, s.status, s.contracts.length], ['demo', 'demo', 17]);
  assert.equal(store.backend(), null);
  // A load that answers after the sign out does not bring the account back.
  let release;
  store.connect(fakeBackend({ list: () => new Promise((resolve) => { release = () => resolve([party()]); }) }), 'u2');
  store.disconnect(now);
  release();
  await tick();
  assert.deepEqual([store.getState().status, store.getState().contracts.length], ['demo', 17]);
});

test('processing counts in the filter', () => {
  const { SELF_OWNER_CONTRACT_FILTERS, groupSelfOwnerContracts, countSelfOwnerRooms, filterSelfOwnerRooms, fromPartyContract } = load();
  assert.ok(SELF_OWNER_CONTRACT_FILTERS.includes('processing'));
  assert.deepEqual(SELF_OWNER_CONTRACT_FILTERS, ['all', 'awaiting_signature', 'processing', 'ending_soon', 'active', 'ended']);
  const c = fromPartyContract(party({ status: 'awaiting_deposit', ownerSignedAt: '2026-11-26T03:00:00.000Z' }), TODAY);
  const groups = groupSelfOwnerContracts([c]);
  const counts = countSelfOwnerRooms(groups);
  assert.deepEqual([counts.all, counts.processing, counts.awaiting_signature], [1, 1, 0]);
  assert.equal(filterSelfOwnerRooms(groups, '', 'processing').length, 1);
  assert.equal(filterSelfOwnerRooms(groups, '', 'active').length, 0);
});

test('i18n: processing label in 4 languages, th has no English', () => {
  for (const l of ['th', 'en', 'ja', 'zh']) {
    const so = copyOf(l).selfOwnerContracts;
    assert.ok(typeof so.status.processing === 'string' && so.status.processing.trim(), `${l}.status.processing`);
    assert.ok(typeof so.signFailed === 'string' && so.signFailed.trim(), `${l}.signFailed`);
  }
  const th = copyOf('th').selfOwnerContracts;
  assert.equal(th.status.processing, 'เซ็นครบแล้ว รอ NESTYK ดำเนินการ');
  for (const text of [th.status.processing, th.signFailed]) assert.ok(!/[A-Za-z]{3,}/.test(text.replace('NESTYK', '')), `${text} has no English`);
  assert.notEqual(copyOf('en').selfOwnerContracts.status.processing, th.status.processing);
});

// Review fixes (26 Nov 2026): stale loads, account switch during a sign, and day boundaries.
test('store: a load that started before a successful sign cannot undo it', async () => {
  const store = storeOf();
  const late = [];
  let calls = 0;
  store.connect(fakeBackend({ list: () => (++calls === 1 ? Promise.resolve([party()]) : new Promise((resolve) => late.push(() => resolve([party()])))) }), 'u1');
  await tick();
  const refreshing = store.refresh();
  assert.deepEqual(await store.sign('41', 'png'), { ok: true });
  late[0]();
  await refreshing;
  await tick();
  assert.deepEqual([store.getState().contracts[0].status, store.getState().contracts[0].signatures.owner], ['processing', '2026-11-26']);
});

test('store: an account switch during a sign drops the result', async () => {
  const store = storeOf();
  let finish;
  const backend = fakeBackend({
    list: async () => [party()],
    sign: () => new Promise((resolve) => { finish = () => resolve(party({ status: 'awaiting_agent_review', ownerSignedAt: '2026-11-26T03:00:00.000Z' })); }),
  });
  store.connect(backend, 'u1');
  await tick();
  const signing = store.sign('41', 'png');
  store.connect(backend, 'u2');
  await tick();
  finish();
  const result = await signing;
  assert.equal(result.ok, false, 'the result is not applied');
  assert.deepEqual([store.getState().contracts[0].status, store.getState().contracts[0].signatures.owner], ['awaiting_signature', undefined]);
});

test('store: a 409 reload after an account switch is dropped too', async () => {
  const store = storeOf();
  let rejectSign;
  let loads = 0;
  const backend = fakeBackend({ list: async () => { loads += 1; return [party()]; }, sign: () => new Promise((_, reject) => { rejectSign = () => reject(Object.assign(new Error('x'), { status: 409 })); }) });
  store.connect(backend, 'u1');
  await tick();
  const signing = store.sign('41', 'png');
  store.connect(backend, 'u2');
  await tick();
  const before = loads;
  rejectSign();
  await signing;
  await tick();
  assert.equal(loads, before, 'no extra load for the old account');
});

test('ending soon: exactly 60 days left is soon, 61 is active, 0 (ends today) is still in force', () => {
  const { fromPartyContract } = load();
  const at = (endDate) => fromPartyContract(party({ status: 'active', endDate }), TODAY);
  assert.deepEqual([at('2027-01-25').status, at('2027-01-25').daysLeft], ['ending_soon', 60]);
  assert.deepEqual([at('2027-01-26').status, at('2027-01-26').daysLeft], ['active', undefined]);
  assert.deepEqual([at('2026-11-26').status, at('2026-11-26').daysLeft], ['ending_soon', 0]);
  assert.equal(at('2026-11-25').status, 'ended');
});
