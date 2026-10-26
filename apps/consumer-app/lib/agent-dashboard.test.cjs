const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

let current, respond;
const calls = [];
const hooks = {
  useState(initial) {
    const h = current, i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = typeof initial === 'function' ? initial() : initial;
    return [h.slots[i], value => { h.slots[i] = typeof value === 'function' ? value(h.slots[i]) : value; }];
  },
  useEffect(effect, deps) {
    const h = current, i = h.cursor++, previous = h.effects[i];
    if (!previous || deps.some((value, n) => !Object.is(value, previous.deps[n]))) {
      previous?.cleanup?.();
      h.pending.push(() => { h.effects[i] = { deps, cleanup: effect() }; });
    }
  },
};
let loaded;
function load() {
  if (loaded) return loaded;
  const module = { exports: {} };
  const filename = path.join(__dirname, 'agent-dashboard.ts');
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', output)(name => {
    if (name === 'react') return hooks;
    if (name === './api') return { apiGet: async (...args) => { calls.push(args); return respond(...args); } };
    throw new Error(`Unexpected runtime dependency: ${name}`);
  }, module, module.exports);
  return loaded = module.exports;
}
function fixture() {
  return {
    generatedAt: '2026-10-31T18:30:00Z',
    business: { status: 'available', availableListings: 67, totalListings: 81, openLeads: 9, currentClients: 6, tenantsCount: 4, commissionPending: 0, currency: 'THB' },
    actionRequired: { status: 'available', items: [] }, schedule: { status: 'available', items: [] },
    inventory: { status: 'available', available: 67, unavailable: 14, published: 70, private: 11, preview: [] },
    clients: { status: 'available', draft: 1, signing: 1, tenants: 4, renewal: null },
    rent: { status: 'available', periodYear: 2026, periodMonth: 11, totalDue: 90000, received: 30000, overdue: 10000, currency: 'THB' },
    commission: { status: 'not_configured', periodYear: 2026, periodMonth: 11, total: 0, received: 0, pending: 0, currency: 'THB' },
    activity: { status: 'available', items: [] },
  };
}
function harness(extra = {}) {
  calls.length = 0;
  const h = { cursor: 0, slots: [], effects: [], pending: [], props: { enabled: true, accountId: 'account-a', refreshToken: 0, greetingName: 'Agent A', locale: 'en', ...extra } };
  h.render = () => {
    current = h; h.cursor = 0;
    const value = load().useAgentDashboard(h.props);
    h.pending.splice(0).forEach(effect => effect());
    return value;
  };
  return h;
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('both dashboard presentations receive live agent data with Bangkok date and a single authenticated API request', async () => {
  respond = async () => fixture();
  const h = harness();
  assert.equal(h.render().business.status, 'loading');
  await flush();
  const snapshot = h.render();
  assert.deepEqual(calls, [['/agent/dashboard']]);
  assert.equal(snapshot.isDemoPreview, false);
  assert.equal(snapshot.business.totalListings, 81);
  assert.equal(snapshot.rent.received, 30000);
  assert.equal(snapshot.greetingName, 'Agent A');
  assert.match(snapshot.localDateLabel, /1 November 2026/);
  assert.equal(snapshot.commission.status, 'not_configured');
});

test('failed requests display errors and cannot fall back to fabricated demo totals', async () => {
  respond = async () => { throw new Error('offline'); };
  const h = harness();
  h.render(); await flush();
  const snapshot = h.render();
  for (const key of ['business', 'inventory', 'actionRequired', 'schedule', 'clients', 'rent', 'activity']) assert.equal(snapshot[key].status, 'error');
  assert.equal(snapshot.isDemoPreview, false);
  assert.equal(snapshot.commission.status, 'not_configured');
});

test('switching accounts immediately hides old data and ignores the old account response', async () => {
  const requests = [];
  respond = () => new Promise(resolve => requests.push(resolve));
  const h = harness();
  h.render();
  h.props = { ...h.props, accountId: 'account-b', greetingName: 'Agent B' };
  assert.equal(h.render().business.status, 'loading');
  requests[1]({ ...fixture(), business: { ...fixture().business, totalListings: 2 } });
  await flush();
  assert.equal(h.render().business.totalListings, 2);
  requests[0](fixture()); await flush();
  assert.equal(h.render().business.totalListings, 2);
  assert.equal(h.render().greetingName, 'Agent B');
});

test('refresh completion belongs to its current request and role changes hide all previous account data', async () => {
  const requests = [], settled = [];
  respond = () => new Promise(resolve => requests.push(resolve));
  const h = harness({ refreshToken: 1, onSettled: token => settled.push(token) });
  h.render();
  h.props = { ...h.props, refreshToken: 2 };
  h.render();
  requests[0](fixture()); await flush();
  assert.deepEqual(settled, []);
  assert.equal(h.render().business.status, 'loading');
  requests[1](fixture()); await flush();
  assert.deepEqual(settled, [2]);
  assert.equal(h.render().business.status, 'available');
  h.props = { ...h.props, enabled: false };
  assert.equal(h.render().business.status, 'loading');
  assert.equal(calls.length, 2);
});

test('locale changes use the same response and never issue an extra request', async () => {
  respond = async () => fixture();
  const h = harness();
  h.render(); await flush();
  h.props = { ...h.props, locale: 'th' };
  const snapshot = h.render();
  assert.match(snapshot.localDateLabel, /พฤศจิกายน/);
  assert.equal(calls.length, 1);
});
