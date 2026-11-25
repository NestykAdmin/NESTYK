// Self owner Dashboard (UI round, 19 Nov 2026, ClickUp z8rcteng6b): demo snapshot, summaries and the hook.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const file = path.join(__dirname, '../lib/self-owner-dashboard.ts');
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
const now = new Date('2026-11-19T04:00:00Z');
const bangkokDay = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date(iso));

test('fixture is demo and deterministic', () => {
  const { createSelfOwnerDashboardDemoFixture } = load();
  const a = createSelfOwnerDashboardDemoFixture({ greetingName: 'Jom', localDateLabel: 'Today', now });
  const b = createSelfOwnerDashboardDemoFixture({ greetingName: 'Jom', localDateLabel: 'Today', now });
  assert.deepEqual(a, b);
  assert.equal(a.isDemoPreview, true);
  for (const key of ['rooms', 'rent', 'todo', 'viewings']) assert.equal(a[key].status, 'demo', key);
});

test('rooms cover every state, one long title, and the summary counts them', () => {
  const { createSelfOwnerDashboardDemoFixture, summarizeRooms } = load();
  const s = createSelfOwnerDashboardDemoFixture({ greetingName: 'Jom', localDateLabel: 'Today', now });
  assert.deepEqual([...new Set(s.rooms.items.map((r) => r.state))].sort(), ['listed', 'occupied', 'unlisted']);
  assert.ok(s.rooms.items.some((r) => r.title.length >= 40));
  const sum = summarizeRooms(s.rooms.items);
  assert.equal(sum.total, s.rooms.items.length);
  assert.equal(sum.occupied, s.rooms.items.filter((r) => r.state === 'occupied').length);
  assert.equal(sum.vacant, sum.total - sum.occupied);
  assert.ok(s.rooms.items.filter((r) => r.state === 'occupied').every((r) => r.tenantName && r.leaseEndsAt));
});

test('rent rows match occupied rooms and the summary adds up', () => {
  const { createSelfOwnerDashboardDemoFixture, summarizeRent } = load();
  const s = createSelfOwnerDashboardDemoFixture({ greetingName: 'Jom', localDateLabel: 'Today', now });
  assert.equal(s.rent.items.length, s.rooms.items.filter((r) => r.state === 'occupied').length);
  assert.deepEqual([...new Set(s.rent.items.map((r) => r.state))].sort(), ['due', 'overdue', 'paid']);
  const sum = summarizeRent(s.rent.items);
  assert.equal(sum.total, s.rent.items.reduce((n, r) => n + r.amount, 0));
  assert.equal(sum.received, s.rent.items.filter((r) => r.state === 'paid').reduce((n, r) => n + r.amount, 0));
  assert.equal(sum.overdue, s.rent.items.filter((r) => r.state === 'overdue').reduce((n, r) => n + r.amount, 0));
  assert.deepEqual([s.rent.periodYear, s.rent.periodMonth], [2026, 11]);
  assert.ok(s.rent.items.filter((r) => r.state === 'overdue').every((r) => r.overdueDays > 0));
});

test('todo counts agree with rooms and rent', () => {
  const { createSelfOwnerDashboardDemoFixture } = load();
  const s = createSelfOwnerDashboardDemoFixture({ greetingName: 'Jom', localDateLabel: 'Today', now });
  const count = (kind) => s.todo.items.find((i) => i.kind === kind)?.count;
  assert.deepEqual(s.todo.items.map((i) => i.kind).sort(), ['awaiting_signature', 'new_interest', 'overdue_rent', 'renewal']);
  assert.equal(count('overdue_rent'), s.rent.items.filter((r) => r.state === 'overdue').length);
  assert.equal(count('new_interest'), s.rooms.items.reduce((n, r) => n + (r.interestCount ?? 0), 0));
});

// Contract kinds (Jom 24 Nov 2026, plan self-owner-contract-kinds Task 2): a room whose lease ends soon but already has
// a renewal awaiting signature needs no renewal; "awaiting signature" counts every kind.
test('contract to-dos: renewal skips rooms with a renewal waiting; awaiting counts every kind', () => {
  const { createSelfOwnerDashboardDemoFixture } = load();
  const contractsLib = loadFile(path.join(__dirname, '../lib/self-owner-contracts.ts'));
  const s = createSelfOwnerDashboardDemoFixture({ greetingName: 'Jom', localDateLabel: 'Today', now });
  const count = (kind) => s.todo.items.find((i) => i.kind === kind)?.count;
  const list = contractsLib.createSelfOwnerContractsDemo(now);
  const awaiting = list.filter((c) => c.status === 'awaiting_signature');
  assert.ok(awaiting.some((c) => c.id === 'c-r2-renewal') && awaiting.some((c) => c.id === 'c-r5'));
  assert.equal(count('awaiting_signature'), awaiting.length);
  const rooms = contractsLib.groupSelfOwnerContracts(list);
  const needRenewal = rooms.filter((g) => g.status === 'ending_soon' && !g.contracts.some((c) => c.kind === 'renewal' && c.status === 'awaiting_signature'));
  assert.ok(!needRenewal.some((g) => g.roomId === 'r2'), '805 already has a renewal waiting');
  assert.equal(count('renewal'), needRenewal.length);
});

test('viewings are today in Bangkok and sorted', () => {
  const { createSelfOwnerDashboardDemoFixture } = load();
  const s = createSelfOwnerDashboardDemoFixture({ greetingName: 'Jom', localDateLabel: 'Today', now });
  assert.ok(s.viewings.items.length >= 2);
  assert.ok(s.viewings.items.every((v) => bangkokDay(v.startsAt) === bangkokDay(now.toISOString())));
  const times = s.viewings.items.map((v) => Date.parse(v.startsAt));
  assert.deepEqual(times, [...times].sort((x, y) => x - y));
});

test('the hook builds the date label and makes no network call', () => {
  const { useSelfOwnerDashboard } = load();
  const s = useSelfOwnerDashboard({ greetingName: 'Jom', locale: 'th' });
  assert.equal(s.greetingName, 'Jom');
  assert.match(s.localDateLabel, /\d{4}/);
  const code = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(code, /from ['"][^'"]*\/api/);
  assert.doesNotMatch(code, /fetch\(/);
});
