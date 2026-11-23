// Viewing requests on the guest web, step 2 (project-docs/nestyk-guest-viewing-request-plan-20261123.md, Mos picked
// 23 Nov 2026: a dialog / bottom sheet form, a list page with a room card and a 3-step bar, 5 simple stages).
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

test('same limits as the API: 3 days, today to 60 days ahead, 10 open requests', () => {
  const api = fs.readFileSync(path.join(web, '..', 'api', 'src', 'viewing-requests', 'viewing-request-rules.ts'), 'utf8');
  assert.equal(V.VIEWING_MAX_DATES, 3);
  assert.equal(V.VIEWING_MAX_DAYS_AHEAD, 60);
  assert.equal(V.VIEWING_OPEN_LIMIT, 10);
  assert.match(api, /const MAX_DATES = 3;/);
  assert.match(api, /const MAX_DAYS_AHEAD = 60;/);
  assert.match(api, /export const OPEN_LIMIT = 10;/);
});

test('the days a guest can pick: today and the next 60 days, Bangkok calendar', () => {
  const days = V.pickableDays('2026-11-23');
  assert.equal(days.length, 61);
  assert.equal(days[0], '2026-11-23');
  assert.equal(days[1], '2026-11-24');
  assert.equal(days.at(-1), '2027-01-22');
});

test('picking days: up to 3, sorted; a picked day is unpicked; a 4th is ignored', () => {
  let picked = [];
  picked = V.toggleDay(picked, '2026-11-26');
  picked = V.toggleDay(picked, '2026-11-24');
  assert.deepEqual(picked, ['2026-11-24', '2026-11-26']);
  picked = V.toggleDay(picked, '2026-11-25');
  assert.deepEqual(V.toggleDay(picked, '2026-11-27'), picked, 'full: no change');
  assert.deepEqual(V.toggleDay(picked, '2026-11-24'), ['2026-11-25', '2026-11-26']);
});

test('form check before sending: a day, a phone, and "+" numbers in international form (as the API)', () => {
  assert.equal(V.formProblem({ dates: [], phone: '0812345678' }), 'needDate');
  assert.equal(V.formProblem({ dates: ['2026-11-24'], phone: '  ' }), 'needPhone');
  assert.equal(V.formProblem({ dates: ['2026-11-24'], phone: '+12' }), 'badPhone');
  assert.equal(V.formProblem({ dates: ['2026-11-24'], phone: 'x'.repeat(51) }), 'badPhone');
  assert.equal(V.formProblem({ dates: ['2026-11-24'], phone: '+66 81-234-5678' }), null);
  assert.equal(V.formProblem({ dates: ['2026-11-24'], phone: '081 234 5678' }), null);
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
  const sent = await V.sendViewingRequest('tok', { roomId: '31', preferredDates: ['2026-11-24'], preferredSlot: 'any', phone: '081', message: null }, fake(201, { id: 1 }));
  assert.equal(sent.kind, 'ok');
  assert.equal(calls[0].url, '/api/me/viewing-requests');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok');
  assert.equal(calls[0].init.cache, 'no-store');
  assert.equal(calls[0].init.credentials, 'omit');
  assert.deepEqual(JSON.parse(calls[0].init.body).preferredDates, ['2026-11-24']);

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
