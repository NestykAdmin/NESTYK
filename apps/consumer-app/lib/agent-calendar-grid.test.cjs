// W13 (Mos 6 Nov 2026): rules of the agent web calendar (month grid, viewing state, filters, grouping).
process.env.TZ = 'Asia/Bangkok';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', source)((name) => {
    if (name === './agent-leads-api') return {};
    if (!name.startsWith('.')) return require(name);
    const base = path.resolve(path.dirname(file), name);
    return load([`${base}.ts`, `${base}.tsx`].find((f) => fs.existsSync(f)));
  }, mod, mod.exports);
  return mod.exports;
}
const grid = load(path.join(__dirname, 'agent-calendar-grid.ts'));
const { viewingToCalendarEvent } = load(path.join(__dirname, 'agent-calendar-viewings.ts'));
const { viewingIntent } = load(path.join(__dirname, '../components/agent-web/ui/statusIntent.ts'));

const NOW = new Date('2026-11-03T12:00:00+07:00');
const viewing = (over = {}) => ({
  id: 1, leadId: 12, leadName: 'Nalin K.', rentRoomId: 32, roomTitle: 'Ari Garden', roomNumber: '1204',
  scheduledAt: '2026-11-04T10:30:00+07:00', status: 'scheduled', note: null, createdAt: '2026-10-20T00:00:00Z', ...over,
});
const event = (over) => viewingToCalendarEvent(viewing(over));
const ALL = new Set(['scheduled', 'done', 'overdue']);

test('month grid Nov 2026, Sunday first: 5 rows from 1 Nov', () => {
  const cells = grid.buildMonthGrid('2026-11-01', 0, NOW);
  assert.equal(cells.length, 35);
  assert.deepEqual(cells[0], { dateKey: '2026-11-01', day: 1, inMonth: true, isToday: false });
  assert.equal(cells[34].dateKey, '2026-12-05');
  assert.equal(cells[34].inMonth, false);
});

test('month grid Nov 2026, Monday first: 6 rows, nothing cut', () => {
  const cells = grid.buildMonthGrid('2026-11-01', 1, NOW);
  assert.equal(cells.length, 42);
  assert.deepEqual(cells[0], { dateKey: '2026-10-26', day: 26, inMonth: false, isToday: false });
  assert.equal(cells[41].dateKey, '2026-12-06');
  assert.equal(cells.filter((c) => c.inMonth).length, 30);
});

test('grid marks today only once, and not in another month', () => {
  const cells = grid.buildMonthGrid('2026-11-01', 1, NOW);
  assert.deepEqual(cells.filter((c) => c.isToday).map((c) => c.dateKey), ['2026-11-03']);
  assert.equal(grid.buildMonthGrid('2027-01-01', 1, NOW).some((c) => c.isToday), false);
});

test('a February that starts on the week start has 4 rows', () => {
  const cells = grid.buildMonthGrid('2027-02-01', 1, NOW);
  assert.equal(cells.length, 28);
  assert.equal(cells[0].dateKey, '2027-02-01');
  assert.equal(cells[27].dateKey, '2027-02-28');
});

test('shiftMonth moves across years', () => {
  assert.equal(grid.shiftMonth('2026-11-01', -1), '2026-10-01');
  assert.equal(grid.shiftMonth('2026-12-01', 1), '2027-01-01');
  assert.equal(grid.shiftMonth('2027-01-15', -1), '2026-12-01');
});

test('viewing state: upcoming, overdue, done; cancelled has none; overdue matches the attn intent', () => {
  assert.equal(grid.viewingStateKey(viewing(), NOW), 'scheduled');
  assert.equal(grid.viewingStateKey(viewing({ scheduledAt: '2026-11-02T17:00:00+07:00' }), NOW), 'overdue');
  assert.equal(grid.viewingStateKey(viewing({ status: 'done', scheduledAt: '2026-11-02T14:00:00+07:00' }), NOW), 'done');
  assert.equal(grid.viewingStateKey(viewing({ status: 'cancelled' }), NOW), null);
  for (const v of [viewing(), viewing({ scheduledAt: '2026-11-01T09:00:00+07:00' })]) {
    assert.equal(grid.viewingStateKey(v, NOW) === 'overdue', viewingIntent(v.status, v.scheduledAt, NOW) === 'attn');
  }
});

test('filter by state and by lead or room text; cancelled never passes', () => {
  const rows = [
    event({ id: 1 }),
    event({ id: 2, status: 'done', leadName: 'Kenji T.', roomTitle: 'Ekkamai Nest', roomNumber: '908' }),
    event({ id: 3, scheduledAt: '2026-11-02T17:00:00+07:00', roomTitle: 'Sathorn Haus' }),
    event({ id: 4, status: 'cancelled' }),
  ];
  const ids = (list) => list.map((e) => e.viewing.id);
  assert.deepEqual(ids(grid.filterCalendarEvents(rows, { states: ALL, query: '', now: NOW })), [1, 2, 3]);
  assert.deepEqual(ids(grid.filterCalendarEvents(rows, { states: new Set(['overdue']), query: '', now: NOW })), [3]);
  assert.deepEqual(ids(grid.filterCalendarEvents(rows, { states: ALL, query: '  KENJI ', now: NOW })), [2]);
  assert.deepEqual(ids(grid.filterCalendarEvents(rows, { states: ALL, query: '908', now: NOW })), [2]);
  assert.deepEqual(ids(grid.filterCalendarEvents(rows, { states: new Set(), query: '', now: NOW })), []);
});

test('group by date: dates ascending, times ascending inside a day', () => {
  const groups = grid.groupEventsByDate([
    event({ id: 1, scheduledAt: '2026-11-06T14:00:00+07:00' }),
    event({ id: 2, scheduledAt: '2026-11-03T16:00:00+07:00' }),
    event({ id: 3, scheduledAt: '2026-11-06T09:30:00+07:00' }),
  ]);
  assert.deepEqual([...groups.keys()], ['2026-11-03', '2026-11-06']);
  assert.deepEqual(groups.get('2026-11-06').map((e) => e.time), ['09:30', '14:00']);
});

test('month only: rows outside the visible month are left out of counts', () => {
  const rows = [
    event({ id: 1 }),
    event({ id: 2, status: 'done', scheduledAt: '2026-11-02T14:00:00+07:00' }),
    event({ id: 3, scheduledAt: '2026-11-02T17:00:00+07:00' }),
    event({ id: 4, scheduledAt: '2026-10-30T10:00:00+07:00' }),
    event({ id: 5, scheduledAt: '2026-12-02T10:00:00+07:00' }),
  ];
  const month = grid.eventsInMonth(rows, '2026-11-01');
  assert.deepEqual(month.map((e) => e.viewing.id), [1, 2, 3]);
  assert.deepEqual(grid.countByState(month, NOW), { scheduled: 1, done: 1, overdue: 1 });
});
