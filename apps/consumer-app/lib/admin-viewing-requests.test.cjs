// Admin web: viewing request queue (project-docs/nestyk-guest-viewing-request-plan-20261123.md step 3; Mos picked
// 24 Nov 2026: split view, the existing admin API with counting and search on the web, a menu item with a count).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)((id) => {
    throw new Error(`${file} must not import ${id}`);
  }, mod, mod.exports);
  return mod.exports;
}
const V = load('admin-viewing-requests.ts');

const req = (over = {}) => ({
  id: 1, status: 'new', handledBy: null, isAgentRoom: true, agent: null,
  room: { id: 31, title: 'Ideo Q Ari', number: 'A-1203' },
  contact: { name: 'Mint Suk', phone: '081-234-5678', email: 'mint@example.com' },
  preferredAt: '2026-11-27T07:30:00.000Z', scheduledAt: null, message: null, closeReason: null, cancelledBy: null,
  createdAt: '2026-11-24T03:55:00.000Z', updatedAt: '2026-11-24T03:55:00.000Z', ...over,
});

test('tabs: new, waiting for the agent, being handled (agent or NESTYK), scheduled, ended', () => {
  assert.deepEqual(V.ADMIN_VR_TABS, ['new', 'waiting', 'handling', 'scheduled', 'ended']);
  const map = { new: 'new', awaiting_agent: 'waiting', agent_handling: 'handling', admin_handling: 'handling', scheduled: 'scheduled', viewed: 'ended', cancelled: 'ended', closed: 'ended' };
  for (const [status, tab] of Object.entries(map)) assert.equal(V.tabOf(status), tab, status);
  const list = ['new', 'new', 'awaiting_agent', 'admin_handling', 'agent_handling', 'scheduled', 'closed'].map((status, i) => req({ id: i + 1, status }));
  assert.deepEqual(V.countByTab(list), { new: 2, waiting: 1, handling: 2, scheduled: 1, ended: 1 });
});

test('search: guest name, phone (with or without dashes), room title or number, request code; order kept', () => {
  const list = [
    req({ id: 7, contact: { name: 'Mint Suk', phone: '081-234-5678', email: null } }),
    req({ id: 8, room: { id: 2, title: 'Circle Living', number: null }, contact: { name: 'Bee Wong', phone: '+66 89 555 0101', email: null } }),
    req({ id: 9, status: 'closed' }),
  ];
  const ids = (tab, q) => V.filterRequests(list, tab, q).map((r) => r.id);
  assert.deepEqual(ids('new', ''), [7, 8]);
  assert.deepEqual(ids('new', 'mint'), [7]);
  assert.deepEqual(ids('new', '0812345678'), [7]);
  assert.deepEqual(ids('new', '555 0101'), [8]);
  assert.deepEqual(ids('new', 'circle'), [8]);
  assert.deepEqual(ids('new', 'a-1203'), [7]);
  assert.deepEqual(ids('new', 'VR-8'), [8]);
  assert.deepEqual(ids('ended', ''), [9]);
  assert.equal(V.requestCode(42), 'VR-42');
});

test('buttons follow the API state table: only moves the API accepts are offered', () => {
  const acts = (over) => {
    const a = V.actionsFor(req(over));
    return [a.primary.join(','), a.secondary.join(',')].join(' | ');
  };
  assert.equal(acts({ status: 'new', isAgentRoom: true }), 'forward,take | cancel,close');
  assert.equal(acts({ status: 'new', isAgentRoom: false }), 'take | cancel,close', 'no agent to forward to');
  assert.equal(acts({ status: 'awaiting_agent' }), 'take | cancel,close');
  assert.equal(acts({ status: 'agent_handling', handledBy: 'agent' }), ' | cancel,close', 'the agent books it');
  assert.equal(acts({ status: 'admin_handling', handledBy: 'admin' }), 'schedule | cancel,close');
  assert.equal(acts({ status: 'scheduled', handledBy: 'admin' }), 'viewed,reschedule | cancel,close');
  assert.equal(acts({ status: 'scheduled', handledBy: 'agent' }), ' | cancel,close', 'booked by the agent');
  for (const status of ['viewed', 'cancelled', 'closed']) assert.equal(acts({ status }), ' | ', status);
});

test('the schedule time is Bangkok time with its offset and not in the past', () => {
  assert.equal(V.scheduleIso('2026-11-28', '09:00'), '2026-11-28T09:00:00+07:00');
  const now = Date.parse('2026-11-24T06:00:00Z'); // 13:00 in Bangkok
  assert.equal(V.scheduleProblem('', '09:00', now), 'needTime');
  assert.equal(V.scheduleProblem('2026-11-28', '', now), 'needTime');
  assert.equal(V.scheduleProblem('2026-11-24', '12:30', now), 'past');
  assert.equal(V.scheduleProblem('2026-11-24', '13:30', now), null);
  assert.equal(V.scheduleProblem('2026-11-28', '09:00', now), null);
});

test('closing needs a reason: a picked reason, plus the detail; "other" needs the detail', () => {
  assert.equal(V.closeReasonText('Room already rented', '', false), 'Room already rented');
  assert.equal(V.closeReasonText('Room already rented', '  rented on 20 Nov ', false), 'Room already rented · rented on 20 Nov');
  assert.equal(V.closeReasonText('Other', '', true), null);
  assert.equal(V.closeReasonText('Other', 'duplicate request', true), 'duplicate request');
  assert.equal(V.closeReasonText('', '', false), null);
  assert.equal(V.closeReasonText('x', 'y'.repeat(600), false).length, 500, 'the API takes up to 500 characters');
});

test('after an action the same request stays selected when it is still in the tab, else the first one', () => {
  const list = [req({ id: 1 }), req({ id: 2 }), req({ id: 3, status: 'admin_handling' })];
  assert.equal(V.pickSelection(list, 'new', '', 2), 2);
  assert.equal(V.pickSelection(list, 'new', '', 3), 1, 'moved to another tab');
  assert.equal(V.pickSelection(list, 'scheduled', '', 1), null, 'empty tab');
});

test('status colours: admin must act on new requests and on the ones NESTYK handles', () => {
  const ui = load('../components/agent-web/ui/statusIntent.ts');
  const intents = ['new', 'awaiting_agent', 'agent_handling', 'admin_handling', 'scheduled', 'viewed', 'cancelled', 'closed'].map(ui.viewingRequestIntent);
  assert.deepEqual(intents, ['attn', 'prog', 'prog', 'attn', 'prog', 'done', 'neutral', 'neutral']);
});

test('the queue loads open requests first and ended ones on their own tab; a fresh load replaces only its group', () => {
  assert.equal(V.groupOf('new'), 'open');
  assert.equal(V.groupOf('scheduled'), 'open');
  for (const status of ['viewed', 'cancelled', 'closed']) assert.equal(V.groupOf(status), 'ended', status);
  const at = (h) => `2026-11-24T0${h}:00:00.000Z`;
  const list = [req({ id: 1, createdAt: at(1) }), req({ id: 2, status: 'closed', createdAt: at(2) })];
  // Open reload: request 1 was taken by someone else, request 3 came in; the ended one stays.
  const open = V.replaceGroup(list, [req({ id: 3, createdAt: at(3) }), req({ id: 1, status: 'admin_handling', createdAt: at(1) })], 'open');
  assert.deepEqual(open.map((r) => [r.id, r.status]), [[3, 'new'], [2, 'closed'], [1, 'admin_handling']], 'newest first');
  // Ended load: the open ones stay.
  const ended = V.replaceGroup(open, [req({ id: 4, status: 'viewed', createdAt: at(4) })], 'ended');
  assert.deepEqual(ended.map((r) => r.id), [4, 3, 1], 'the old ended row is replaced by the fresh ended list');
  // An open request that ended elsewhere is dropped by the open reload.
  assert.deepEqual(V.replaceGroup(list, [], 'open').map((r) => r.id), [2]);
});

test('an action result replaces its request (or adds it) and keeps newest first', () => {
  const at = (h) => `2026-11-24T0${h}:00:00.000Z`;
  const list = [req({ id: 2, createdAt: at(2) }), req({ id: 1, createdAt: at(1) })];
  assert.deepEqual(V.mergeRequests(list, [req({ id: 1, status: 'closed', createdAt: at(1) })]).map((r) => [r.id, r.status]), [[2, 'new'], [1, 'closed']]);
  assert.deepEqual(V.mergeRequests(list, [req({ id: 5, createdAt: at(5) })]).map((r) => r.id), [5, 2, 1]);
});

test('timeline: created, a status change, a reschedule (scheduled to scheduled, no note) and a note', () => {
  assert.equal(V.eventKind({ fromStatus: null, toStatus: 'new', note: null }), 'created');
  assert.equal(V.eventKind({ fromStatus: 'new', toStatus: 'admin_handling', note: null }), 'status');
  assert.equal(V.eventKind({ fromStatus: 'scheduled', toStatus: 'scheduled', note: null }), 'reschedule');
  assert.equal(V.eventKind({ fromStatus: 'scheduled', toStatus: 'scheduled', note: 'called back' }), 'note');
  assert.equal(V.eventKind({ fromStatus: 'admin_handling', toStatus: 'admin_handling', note: 'no answer' }), 'note');
});
