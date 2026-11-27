// Self owner income on real bills (plan 2026-11-27-self-owner-bills-api, Task 4): rows per month from
// GET /bills/received, the slip date as the paid date, and "awaiting review" before "overdue".
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

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
const load = () => loadFile(path.join(__dirname, '../lib/self-owner-contracts.ts'));
const copyOf = (l) => loadFile(path.join(__dirname, `../../../packages/i18n/src/locales/${l}.ts`))[l];
const tick = () => new Promise((resolve) => setImmediate(resolve));
const TODAY = '2026-11-26';

function bill(patch = {}) {
  return {
    id: 7, leaseContractId: 42, contractNo: 'LS1', tenantName: 'QA Tenant', property: 'Ideo Q', room: '805',
    period: '2026-11', documentNo: 'RB', issueDate: '2026-10-27', dueDate: '2026-11-01', graceUntil: '2026-11-06',
    amount: 21000, reservationCredit: null, lateDays: 0, lateFeePerDay: null, lateFee: null, status: 'pending',
    leaseActive: true, paidAt: null, hasPaymentSlip: false, slipSubmitted: false, slipReturnReason: null, payTo: null,
    slipSubmittedAt: null, awaitingReview: false, selfOwnerRoomId: 40, ...patch,
  };
}

test('maps paid with the slip date (Bangkok day) as the paid date', () => {
  const [row] = load().rentRowsFromBills([bill({ status: 'paid', slipSubmittedAt: '2026-10-31T18:30:00.000Z', paidAt: '2026-11-02T03:00:00.000Z' })], 2026, 11, TODAY);
  assert.deepEqual([row.state, row.paidAt, row.amount, row.roomTitle, row.project, row.tenantName, row.dueDate], ['paid', '2026-11-01', 21000, '805', 'Ideo Q', 'QA Tenant', '2026-11-01']);
});

test('paid without a slip uses paidAt', () => {
  const [row] = load().rentRowsFromBills([bill({ status: 'paid', paidAt: '2026-11-02T03:00:00.000Z' })], 2026, 11, TODAY);
  assert.deepEqual([row.state, row.paidAt], ['paid', '2026-11-02']);
});

test('awaiting review beats overdue, with the slip date shown', () => {
  const [row] = load().rentRowsFromBills([bill({ status: 'overdue', awaitingReview: true, slipSubmitted: true, slipSubmittedAt: '2026-11-08T03:00:00.000Z' })], 2026, 11, TODAY);
  assert.deepEqual([row.state, row.paidAt, row.overdueDays], ['awaiting_review', '2026-11-08', undefined]);
});

test('overdue days count from the due date; pending is due', () => {
  const lib = load();
  const [late] = lib.rentRowsFromBills([bill({ status: 'overdue' })], 2026, 11, TODAY);
  assert.deepEqual([late.state, late.overdueDays], ['overdue', 25]);
  const [soon] = lib.rentRowsFromBills([bill({ period: '2026-12', dueDate: '2026-12-01', graceUntil: '2026-12-06', issueDate: '2026-11-26' })], 2026, 12, TODAY);
  assert.equal(soon.state, 'due');
});

test('drops bills of agent rooms and keeps only the chosen month', () => {
  const rows = load().rentRowsFromBills([bill(), bill({ id: 8, selfOwnerRoomId: null }), bill({ id: 9, period: '2026-10' })], 2026, 11, TODAY);
  assert.deepEqual(rows.map((r) => r.id), ['b-7']);
});

test('months from the oldest period to this month, never after it', () => {
  const lib = load();
  const months = lib.incomeMonthsFromBills([bill({ period: '2026-08' }), bill({ period: '2026-12' }), bill({ period: '2026-10', selfOwnerRoomId: null })], new Date(`${TODAY}T03:00:00Z`));
  assert.deepEqual(months.map((m) => `${m.year}-${m.month}`), ['2026-8', '2026-9', '2026-10', '2026-11']);
  assert.deepEqual(lib.incomeMonthsFromBills([], new Date(`${TODAY}T03:00:00Z`)).map((m) => `${m.year}-${m.month}`), ['2026-11']);
});

test('filters and counts include awaiting review; the summary keeps it out of received and overdue', () => {
  const lib = load();
  assert.deepEqual(lib.SELF_OWNER_RENT_FILTERS, ['all', 'overdue', 'awaiting_review', 'due', 'paid']);
  const rows = lib.rentRowsFromBills([
    bill({ id: 1, status: 'paid', paidAt: '2026-11-01T03:00:00.000Z' }),
    bill({ id: 2, status: 'overdue', awaitingReview: true, slipSubmittedAt: '2026-11-08T03:00:00.000Z' }),
    bill({ id: 3, status: 'overdue' }),
  ], 2026, 11, TODAY);
  const counts = lib.countSelfOwnerRent(rows);
  assert.deepEqual([counts.all, counts.paid, counts.awaiting_review, counts.overdue, counts.due], [3, 1, 1, 1, 0]);
  assert.deepEqual(lib.filterSelfOwnerRent(rows, 'awaiting_review').map((r) => r.id), ['b-2']);
  const { summarizeRent } = loadFile(path.join(__dirname, '../lib/self-owner-dashboard.ts'));
  assert.deepEqual(summarizeRent(rows), { total: 63000, received: 21000, overdue: 21000 });
});

function backend(over = {}) {
  const calls = [];
  return { calls, refresh: async () => { calls.push('refresh'); }, list: async () => { calls.push('list'); return [bill()]; }, ...over };
}

test('store: connect refreshes then lists; failures of refresh are ignored; status available', async () => {
  const lib = load();
  const store = lib.selfOwnerIncomeStore;
  const b = backend({ refresh: async () => { b.calls.push('refresh'); throw new Error('offline'); } });
  store.connect(b, 'u1');
  assert.equal(store.getState().status, 'loading');
  await tick(); await tick();
  assert.deepEqual(b.calls, ['refresh', 'list']);
  const s = store.getState();
  assert.deepEqual([s.status, s.source, s.bills.length], ['available', 'api', 1]);
  const hook = lib.useSelfOwnerIncome();
  assert.equal(hook.isDemoPreview, false);
  assert.deepEqual(hook.rowsFor(2026, 11).map((r) => r.id), ['b-7']);
});

test('store: list failure gives error; disconnect goes back to the demo', async () => {
  const store = load().selfOwnerIncomeStore;
  store.connect(backend({ list: async () => { throw new Error('boom'); } }), 'u1');
  await tick(); await tick();
  assert.equal(store.getState().status, 'error');
  store.disconnect();
  assert.deepEqual([store.getState().status, store.getState().source], ['demo', 'demo']);
});

test('store: a list for the previous account is dropped after an account switch', async () => {
  const store = load().selfOwnerIncomeStore;
  let release;
  store.connect(backend({ list: () => new Promise((r) => { release = () => r([bill({ id: 99 })]); }) }), 'u1');
  await tick();
  store.connect(backend({ list: async () => [bill({ id: 5 })] }), 'u2');
  await tick(); await tick();
  release(); await tick();
  assert.deepEqual(store.getState().bills.map((b) => b.id), [5]);
});

test('demo hook: rows come from the demo contracts', () => {
  const lib = load();
  const hook = lib.useSelfOwnerIncome();
  assert.equal(hook.isDemoPreview, true);
  const last = hook.months[hook.months.length - 1];
  assert.ok(hook.rowsFor(last.year, last.month).length > 0);
});

test('i18n: awaiting review in 4 languages, th has no English', () => {
  for (const l of ['th', 'en', 'ja', 'zh']) {
    const inc = copyOf(l).selfOwnerIncome;
    assert.ok(typeof inc.awaiting_review === 'string' && inc.awaiting_review.trim(), `${l}.awaiting_review`);
  }
  const th = copyOf('th').selfOwnerIncome.awaiting_review;
  assert.equal(th, 'รอยืนยัน');
});
