const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

process.env.TZ = 'Asia/Bangkok';
let current, respond;
const calls = [];
const cache = new Map();
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
function load(filename = path.join(__dirname, 'agent-calendar-viewings.ts')) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', output)(name => {
    if (name === 'react') return hooks;
    if (name === './agent-leads-api') return { listAgentViewings: async (...args) => { calls.push(args); return respond(...args); } };
    if (name === './agent-calendar-demo') return load(path.join(__dirname, 'agent-calendar-demo.ts'));
    throw new Error(`Unexpected runtime dependency: ${name}`);
  }, module, module.exports);
  return module.exports;
}
const viewing = (overrides = {}) => ({
  id: 41, leadId: 12, leadName: 'Lead', rentRoomId: 32, roomTitle: 'Condo', roomNumber: '1208',
  scheduledAt: '2026-10-22T10:30:00+07:00', status: 'scheduled', note: null, createdAt: '2026-10-20T00:00:00Z', ...overrides,
});
function harness(extra = {}) {
  calls.length = 0;
  const h = { cursor: 0, slots: [], effects: [], pending: [], props: { enabled: true, accountId: 'account-a', visibleMonth: '2026-10-01', refreshToken: 0, ...extra } };
  h.render = () => {
    current = h; h.cursor = 0;
    const value = load().useAgentCalendarViewings(h.props);
    h.pending.splice(0).forEach(effect => effect());
    return value;
  };
  return h;
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('calendar events preserve the actual viewing and completed status for management permissions', () => {
  const record = viewing({ status: 'done' });
  const event = load().viewingToCalendarEvent(record);
  assert.equal(event.status, 'done');
  assert.deepEqual(event.viewing, record);
  assert.equal(event.date, '2026-10-22');
  assert.equal(event.time, '10:30');
  assert.equal(event.location, 'Condo · 1208');
});

test('month ranges cover boundary weeks including leap years without exceeding the API cap', () => {
  assert.deepEqual(load().calendarViewingRange('2028-02-01'), {
    from: '2028-01-24T17:00:00.000Z', to: '2028-03-07T17:00:00.000Z',
  });
  assert.deepEqual(load().calendarViewingRange('2026-12-01'), {
    from: '2026-11-23T17:00:00.000Z', to: '2027-01-07T17:00:00.000Z',
  });
});

test('calendar loads only real viewings, excludes cancelled records, and exposes loading and failure separately from empty', async () => {
  respond = async () => [viewing(), viewing({ id: 42, status: 'cancelled' })];
  const h = harness();
  assert.equal(h.render().status, 'loading');
  await flush();
  assert.deepEqual(h.render().viewings.map(row => row.id), [41]);
  assert.equal(h.render().status, 'available');
  assert.deepEqual(calls, [['2026-09-23T17:00:00.000Z', '2026-11-07T17:00:00.000Z']]);
  respond = async () => { throw new Error('offline'); };
  h.props = { ...h.props, refreshToken: 1 };
  assert.deepEqual(h.render().viewings, []);
  await flush();
  assert.equal(h.render().status, 'error');
  assert.deepEqual(h.render().viewings, []);
  respond = async () => [];
  h.props = { ...h.props, refreshToken: 2 };
  h.render(); await flush();
  assert.equal(h.render().status, 'available');
  assert.deepEqual(h.render().viewings, []);
});

test('switching months and accounts hides old rows immediately and ignores stale responses', async () => {
  const requests = [];
  respond = () => new Promise(resolve => requests.push(resolve));
  const h = harness();
  h.render();
  h.props = { ...h.props, visibleMonth: '2026-11-01' };
  assert.deepEqual(h.render().viewings, []);
  requests[1]([viewing({ id: 51 })]); await flush();
  assert.equal(h.render().viewings[0].id, 51);
  requests[0]([viewing()]); await flush();
  assert.equal(h.render().viewings[0].id, 51);
  h.props = { ...h.props, accountId: 'account-b' };
  assert.deepEqual(h.render().viewings, []);
  requests[2]([viewing({ id: 61 })]); await flush();
  assert.equal(h.render().viewings[0].id, 61);
  h.props = { ...h.props, enabled: false };
  assert.deepEqual(h.render().viewings, []);
  assert.equal(calls.length, 3);
});

test('refresh completion only settles the active request, and unauthenticated calendars never fetch', async () => {
  const requests = [], settled = [];
  respond = () => new Promise(resolve => requests.push(resolve));
  const h = harness({ onSettled: token => settled.push(token) });
  h.render();
  h.props = { ...h.props, refreshToken: 1 };
  h.render();
  requests[0]([viewing()]); await flush();
  assert.deepEqual(settled, []);
  requests[1]([viewing()]); await flush();
  assert.deepEqual(settled, [1]);
  h.props = { ...h.props, accountId: null };
  assert.deepEqual(h.render().viewings, []);
  assert.equal(calls.length, 2);
});
