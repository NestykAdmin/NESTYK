// Viewing requests on the guest web, step 2 (project-docs/nestyk-guest-viewing-request-plan-20261123.md, Mos picked
// 23 Nov 2026: a dialog / bottom sheet form, a list page with a room card and a 3-step bar, 5 simple stages;
// then form E: one day from a 7-day strip or a calendar, a time every 30 minutes under morning / afternoon / evening tabs).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTs(file) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)((id) => {
    throw new Error(`unexpected import ${id}`);
  }, mod, mod.exports);
  return mod.exports;
}

const web = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(web, ...p), 'utf8');
const V = loadTs(path.join(__dirname, 'guest-viewing-requests.ts'));

test('same rules as the API: one day from tomorrow up to 60 days ahead, 08:00–20:00 every 30 minutes, 10 open requests', () => {
  const api = fs.readFileSync(path.join(web, '..', 'api', 'src', 'viewing-requests', 'viewing-request-rules.ts'), 'utf8');
  assert.equal(V.VIEWING_MIN_DAYS_AHEAD, 1);
  assert.equal(V.VIEWING_MAX_DAYS_AHEAD, 60);
  assert.equal(V.VIEWING_OPEN_LIMIT, 10);
  const times = V.viewingTimes();
  assert.equal(times.length, 25);
  assert.equal(times[0], '08:00');
  assert.equal(times[1], '08:30');
  assert.equal(times.at(-1), '20:00');
  assert.match(api, /const MIN_DAYS_AHEAD = 1;/);
  assert.match(api, /const MAX_DAYS_AHEAD = 60;/);
  assert.match(api, /const FIRST_MINUTE = 8 \* 60;/);
  assert.match(api, /const LAST_MINUTE = 20 \* 60;/);
  assert.match(api, /const STEP_MINUTES = 30;/);
  assert.match(api, /export const OPEN_LIMIT = 10;/);
});

test('the 7-day strip starts tomorrow; the calendar allows tomorrow up to 60 days ahead (Bangkok days)', () => {
  assert.deepEqual(V.stripDays('2026-11-23'), ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30']);
  assert.equal(V.isPickableDay('2026-11-23', '2026-11-23'), false, 'not today');
  assert.equal(V.isPickableDay('2026-11-23', '2026-11-24'), true);
  assert.equal(V.isPickableDay('2026-11-23', '2027-01-22'), true);
  assert.equal(V.isPickableDay('2026-11-23', '2027-01-23'), false);
  assert.equal(V.lastPickableDay('2026-11-23'), '2027-01-22');
});

test('the calendar: the months that hold a pickable day, each laid out from Sunday', () => {
  assert.deepEqual(V.calendarMonths('2026-11-23'), ['2026-11', '2026-12', '2027-01']);
  assert.deepEqual(V.calendarMonths('2026-12-31'), ['2027-01', '2027-02', '2027-03'], 'tomorrow is already January');
  const nov = V.monthGrid('2026-11');
  assert.equal(nov.length, 30, '1 Nov 2026 is a Sunday: no blanks');
  assert.equal(nov[0], '2026-11-01');
  const dec = V.monthGrid('2026-12');
  assert.deepEqual(dec.slice(0, 3), [null, null, '2026-12-01'], '1 Dec 2026 is a Tuesday');
  assert.equal(dec.at(-1), '2026-12-31');
});

test('time tabs: morning 08:00–11:30, afternoon 12:00–16:30, evening 17:00–20:00', () => {
  assert.deepEqual(V.VIEWING_PERIODS, ['morning', 'afternoon', 'evening']);
  assert.equal(V.timesOf('morning').length, 8);
  assert.equal(V.timesOf('afternoon').length, 10);
  assert.equal(V.timesOf('evening').length, 7);
  assert.deepEqual([V.timesOf('afternoon')[0], V.timesOf('afternoon').at(-1)], ['12:00', '16:30']);
  assert.equal(V.periodOf('11:30'), 'morning');
  assert.equal(V.periodOf('12:00'), 'afternoon');
  assert.equal(V.periodOf('17:00'), 'evening');
  assert.equal(V.periodRange('evening'), '17:00–20:00');
});

test('the moment sent to the API is Bangkok time with its offset', () => {
  assert.equal(V.preferredAt('2026-11-24', '14:30'), '2026-11-24T14:30:00+07:00');
});

test('form check before sending: a day, a time, a phone, and "+" numbers in international form (as the API)', () => {
  const ok = { day: '2026-11-24', time: '14:30' };
  assert.equal(V.formProblem({ day: null, time: null, phone: '0812345678' }), 'needDate');
  assert.equal(V.formProblem({ day: '2026-11-24', time: null, phone: '0812345678' }), 'needTime');
  assert.equal(V.formProblem({ ...ok, phone: '  ' }), 'needPhone');
  assert.equal(V.formProblem({ ...ok, phone: '+12' }), 'badPhone');
  assert.equal(V.formProblem({ ...ok, phone: 'x'.repeat(51) }), 'badPhone');
  assert.equal(V.formProblem({ ...ok, phone: '+66 81-234-5678' }), null);
  assert.equal(V.formProblem({ ...ok, phone: '081 234 5678' }), null);
});

test('what sending did: the API answers become a small set of results the form can show', () => {
  const request = { id: 4, status: 'new' };
  assert.deepEqual(V.sendResult(201, request), { kind: 'ok', request });
  assert.deepEqual(V.sendResult(409, { code: 'REQUEST_EXISTS', requestId: 9 }), { kind: 'exists', requestId: 9 });
  assert.deepEqual(V.sendResult(409, { code: 'REQUEST_LIMIT' }), { kind: 'limit' });
  assert.deepEqual(V.sendResult(409, { code: 'OWN_ROOM' }), { kind: 'ownRoom' });
  assert.deepEqual(V.sendResult(404, { message: 'Room not found' }), { kind: 'gone' });
  assert.deepEqual(V.sendResult(404, { message: 'Cannot POST /api/v1/me/viewing-requests' }), { kind: 'failed' }, 'API not deployed');
  assert.deepEqual(V.sendResult(401, {}), { kind: 'signedOut' });
  assert.deepEqual(V.sendResult(400, { message: 'phone is required' }), { kind: 'invalid' });
  assert.deepEqual(V.sendResult(500, {}), { kind: 'failed' });
  assert.deepEqual(V.sendResult(201, null), { kind: 'failed' });
});

test('5 stages for the guest (Mos 23 Nov 2026): who coordinates stays behind the scenes', () => {
  assert.equal(V.guestStage('new'), 'sent');
  for (const s of ['awaiting_agent', 'agent_handling', 'admin_handling']) assert.equal(V.guestStage(s), 'coordinating', s);
  assert.equal(V.guestStage('scheduled'), 'scheduled');
  assert.equal(V.guestStage('viewed'), 'viewed');
  assert.equal(V.guestStage('cancelled'), 'ended');
  assert.equal(V.guestStage('closed'), 'ended');
  assert.deepEqual(['sent', 'coordinating', 'scheduled', 'viewed', 'ended'].map(V.progressStep), [1, 2, 3, 3, 0]);
});

test('the list page splits open requests from finished ones, keeping the API order', () => {
  const list = [{ id: 3, status: 'viewed' }, { id: 2, status: 'scheduled' }, { id: 1, status: 'new' }, { id: 0, status: 'closed' }];
  const { open, ended } = V.splitRequests(list);
  assert.deepEqual(open.map((r) => r.id), [2, 1]);
  assert.deepEqual(ended.map((r) => r.id), [3, 0]);
});

test('calls: same-site /api, the tab token, never cached, no cookies; errors come back as values', async () => {
  const calls = [];
  const fake = (status, body) => async (url, init) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  const sent = await V.sendViewingRequest('tok', { roomId: '31', preferredAt: '2026-11-24T14:30:00+07:00', phone: '081', message: null }, fake(201, { id: 1 }));
  assert.equal(sent.kind, 'ok');
  assert.equal(calls[0].url, '/api/me/viewing-requests');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok');
  assert.equal(calls[0].init.cache, 'no-store');
  assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(JSON.parse(calls[0].init.body).preferredAt, '2026-11-24T14:30:00+07:00');

  assert.deepEqual(await V.fetchMyViewingRequests('tok', fake(200, [{ id: 1, roomId: '31', status: 'new' }, { bad: true }])), [{ id: 1, roomId: '31', status: 'new' }]);
  assert.equal(await V.fetchMyViewingRequests('tok', fake(500, {})), null);
  assert.equal(await V.fetchMyViewingRequests('tok', async () => { throw new Error('offline'); }), null);

  assert.equal(await V.cancelViewingRequest('tok', 7, fake(201, null)), 'ok');
  assert.equal(calls.at(-1).url, '/api/me/viewing-requests/7/cancel');
  assert.equal(await V.cancelViewingRequest('tok', 7, fake(409, { code: 'WRONG_STATUS' })), 'closed');
  assert.equal(await V.cancelViewingRequest('tok', 7, fake(401, {})), 'signedOut');
  assert.equal(await V.cancelViewingRequest('tok', 0, fake(201, null)), 'failed', 'a bad id never reaches the API');
});

test('the room page button opens the form when signed in and the sign-in prompt when not', () => {
  const term = read('app', 'components', 'guest', 'room', 'RoomTerm.tsx');
  assert.doesNotMatch(term, /disabled\s*\n\s*aria-disabled="true"\s*\n\s*data-testid="roomPage.viewing"/, 'no longer "coming soon"');
  assert.match(term, /<ViewingRequestDialog /);
  assert.match(term, /<SignInPrompt[^>]*reason="viewing"/);
  const page = read('app', '[locale]', '(marketplace)', 'rooms', '[id]', 'page.tsx');
  assert.equal((page.match(/<RoomViewingButton [^>]*room=\{viewingRoom\}/g) ?? []).length, 2, 'closing band + phone bar');
  assert.match(page, /<RoomViewingCard [^>]*room=\{viewingRoom\}/);
  const prompt = read('app', 'components', 'guest', 'SignInPrompt.tsx');
  assert.match(prompt, /viewingTitle/);
});

test('the requests page is open: menu, profile and the page itself', () => {
  const site = read('lib', 'guest-site.ts');
  assert.match(site, /viewingRequests: true,/);
  const menu = read('app', 'components', 'guest', 'AccountMenu.tsx');
  assert.match(menu, /href="\/viewing-requests"/);
  const profile = read('app', '[locale]', '(marketplace)', 'profile', 'page.tsx');
  assert.match(profile, /localePath\(locale, '\/viewing-requests'\)/);
  const pageFile = read('app', '[locale]', '(marketplace)', 'viewing-requests', 'page.tsx');
  assert.match(pageFile, /index: false/, 'personal page, not for search engines');
  assert.match(pageFile, /<ViewingRequestsList /);
});
