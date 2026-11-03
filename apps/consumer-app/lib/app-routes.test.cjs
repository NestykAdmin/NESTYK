// Route plan R1 (Mos 3 Nov 2026): path <-> role rules for the web app (nestyk-route-rules.md).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, 'app-routes.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', source)(() => { throw new Error('app-routes must stay dependency free'); }, mod, mod.exports);
const {
  parseAppPath, roleHomePath, safeNextPath, loginPathFor, pickLandingRole, postLoginPath,
  stateToRoute, routeToState, routeEntryKey, isParentRoute, normalizeHref, parseQuery,
} = mod.exports;

test('"/" is guest; each role owns its path; the rest of the path is kept for later steps', () => {
  assert.deepEqual(parseAppPath('/'), { kind: 'app', role: 'guest', rest: [] });
  assert.deepEqual(parseAppPath(''), { kind: 'app', role: 'guest', rest: [] });
  assert.deepEqual(parseAppPath('/agent'), { kind: 'app', role: 'agent', rest: [] });
  assert.deepEqual(parseAppPath('/agent/'), { kind: 'app', role: 'agent', rest: [] });
  assert.deepEqual(parseAppPath('/Agent/Leads/12'), { kind: 'app', role: 'agent', rest: ['leads', '12'] });
  assert.deepEqual(parseAppPath('/tenant/bills'), { kind: 'app', role: 'tenant', rest: ['bills'] });
  assert.deepEqual(parseAppPath('/landlord'), { kind: 'app', role: 'landlord', rest: [] });
  assert.deepEqual(parseAppPath('/admin'), { kind: 'app', role: 'admin', rest: [] });
  assert.deepEqual(parseAppPath('/search'), { kind: 'app', role: 'guest', rest: ['search'] });
  assert.deepEqual(parseAppPath('/services'), { kind: 'app', role: 'guest', rest: ['services'] });
});

test('old /owner links go to /landlord with the rest of the path', () => {
  assert.deepEqual(parseAppPath('/owner'), { kind: 'redirect', to: '/landlord' });
  assert.deepEqual(parseAppPath('/owner/contracts/4'), { kind: 'redirect', to: '/landlord/contracts/4' });
});

test('auth screens and unknown paths are not app paths', () => {
  for (const p of ['/login', '/register', '/reset-password', '/LOGIN/']) assert.deepEqual(parseAppPath(p), { kind: 'auth' }, p);
  for (const p of ['/agents', '/foo', '/agentx/leads']) assert.deepEqual(parseAppPath(p), { kind: 'notFound' }, p);
});

test('role home paths go back through the parser to the same role', () => {
  for (const role of ['guest', 'agent', 'tenant', 'landlord', 'admin']) {
    assert.equal(parseAppPath(roleHomePath(role)).role, role);
  }
  assert.equal(roleHomePath('guest'), '/');
  assert.equal(roleHomePath('agent'), '/agent');
});

test('next only accepts an in-app path (no open redirect, no loop back to login)', () => {
  for (const ok of ['/agent', '/agent/leads/12?view=work', '/tenant#x', '/', '/owner/x']) assert.equal(safeNextPath(ok), ok, ok);
  assert.equal(safeNextPath(['/agent', '/x']), '/agent');
  for (const bad of [undefined, null, '', 12, 'agent', 'https://evil.example', '//evil.example', '/\\evil.example',
    '/javascript:alert(1)', '/login', '/register?x=1', '/nope', '/agent\n', 'x'.repeat(600)]) {
    assert.equal(safeNextPath(bad), null, String(bad));
  }
});

test('login path carries next only when it is safe and not the guest home', () => {
  assert.equal(loginPathFor('/agent/leads/12?view=work'), '/login?next=%2Fagent%2Fleads%2F12%3Fview%3Dwork');
  assert.equal(loginPathFor('/'), '/login');
  assert.equal(loginPathFor('https://evil.example'), '/login');
  assert.equal(loginPathFor(undefined), '/login');
});

test('Q5: the remembered role wins if the account has it, else agent, landlord, tenant, guest; admin never auto', () => {
  assert.equal(pickLandingRole(['guest', 'agent', 'tenant'], 'tenant'), 'tenant');
  assert.equal(pickLandingRole(['guest', 'tenant'], 'agent'), 'tenant');
  assert.equal(pickLandingRole(['guest', 'tenant', 'landlord', 'agent', 'admin'], null), 'agent');
  assert.equal(pickLandingRole(['guest', 'landlord', 'tenant'], undefined), 'landlord');
  assert.equal(pickLandingRole(['guest', 'admin'], 'admin'), 'guest');
  assert.equal(pickLandingRole(['guest'], 'agent'), 'guest');
  assert.equal(pickLandingRole(undefined, undefined), 'guest');
});

test('after login: next when the account may open it, else the landing role home', () => {
  const agent = ['guest', 'agent'];
  assert.equal(postLoginPath('/agent/leads/12', agent), '/agent/leads/12');
  assert.equal(postLoginPath('/search', agent), '/search');
  assert.equal(postLoginPath('/tenant/bills', agent), '/agent', 'a tenant page the account cannot open falls back');
  assert.equal(postLoginPath('/owner/contracts', ['guest', 'landlord']), '/landlord/contracts');
  assert.equal(postLoginPath('https://evil.example', agent), '/agent');
  assert.equal(postLoginPath(undefined, ['guest', 'tenant', 'agent'], 'tenant'), '/tenant');
  assert.equal(postLoginPath(undefined, ['guest']), '/');
});

// ---- R2: tab paths (route plan 3.1–3.4) ----

const R2_PAGES = [
  ['/', { role: 'guest', tab: 'home' }],
  ['/search', { role: 'guest', tab: 'search' }],
  ['/services', { role: 'guest', tab: 'services' }],
  ['/agent', { role: 'agent', tab: 'dashboard' }],
  ['/agent/rooms', { role: 'agent', tab: 'listingRoom' }],
  ['/agent/rooms/new', { role: 'agent', tab: 'createListing' }],
  ['/agent/leads', { role: 'agent', tab: 'listingLead' }],
  ['/agent/leads/new', { role: 'agent', tab: 'createLead' }],
  ['/agent/clients', { role: 'agent', tab: 'clients' }],
  ['/agent/clients/new', { role: 'agent', tab: 'clients', creatingTenant: true }],
  ['/agent/contracts', { role: 'agent', tab: 'contracts' }],
  ['/agent/calendar?date=2026-11-03', { role: 'agent', tab: 'calendar', calendarDate: '2026-11-03' }],
  ['/agent/contacts', { role: 'agent', tab: 'contact' }],
  ['/agent/services', { role: 'agent', tab: 'services' }],
  ['/tenant', { role: 'tenant', tab: 'dashboard' }],
  ['/tenant/home', { role: 'tenant', tab: 'living' }],
  ['/tenant/contracts', { role: 'tenant', tab: 'dashboard', partyInbox: 'contracts' }],
  ['/tenant/bills', { role: 'tenant', tab: 'bills' }],
  ['/tenant/bills?history=1', { role: 'tenant', tab: 'bills', billHistory: true }],
  ['/tenant/services', { role: 'tenant', tab: 'services' }],
  ['/landlord', { role: 'landlord', tab: 'dashboard' }],
  ['/landlord/contracts', { role: 'landlord', tab: 'dashboard', partyInbox: 'contracts' }],
  ['/landlord/tenants', { role: 'landlord', tab: 'dashboard', partyInbox: 'tenants' }],
  ['/landlord/income', { role: 'landlord', tab: 'income' }],
  ['/landlord/services', { role: 'landlord', tab: 'services' }],
  ['/admin', { role: 'admin', tab: 'dashboard' }],
];

function open(href) {
  const [p, search = ''] = href.split('?');
  return routeToState(p, parseQuery(search));
}

test('R2: every page in the table opens its state, and that state gives the same URL back', () => {
  for (const [href, state] of R2_PAGES) {
    const got = open(href);
    assert.deepEqual(got.state, state, href);
    assert.equal(got.href, href, href);
    assert.equal(stateToRoute(state), href, href);
  }
});

test('R2: the tab under an open contract inbox does not change its URL', () => {
  assert.equal(stateToRoute({ role: 'landlord', tab: 'income', partyInbox: 'contracts' }), '/landlord/contracts');
  assert.equal(stateToRoute({ role: 'tenant', tab: 'bills', partyInbox: 'contracts', billHistory: true }), '/tenant/contracts');
});

test('R2: odd URLs land on a real page with one canonical URL', () => {
  assert.deepEqual(open('/agent/more'), { state: { role: 'agent', tab: 'dashboard' }, href: '/agent' });
  assert.equal(open('/agent/nope/1').href, '/agent');
  assert.equal(open('/tenant/xyz').href, '/tenant');
  assert.equal(open('/Agent/Rooms/').href, '/agent/rooms');
  assert.equal(open('/owner/income').href, '/landlord/income');
  assert.equal(open('/agent/rooms?utm=x').href, '/agent/rooms');
  // A bad or missing date is dropped (the shell then shows today).
  for (const d of ['2026-02-30', '2026-13-01', 'x', '']) assert.equal(open(`/agent/calendar?date=${d}`).href, '/agent/calendar', d);
  assert.equal(open('/tenant/bills?history=yes').href, '/tenant/bills');
  assert.equal(open('/agent/leads?date=2026-11-03').href, '/agent/leads');
  for (const p of ['/login', '/foo']) assert.equal(open(p), null, p);
});

test('R2: detail pages (R3) and tabs without a path give no URL, so the address bar stays on the list', () => {
  assert.equal(stateToRoute({ role: 'agent', tab: 'leadDetail' }), null);
  assert.equal(stateToRoute({ role: 'agent', tab: 'clients', detailOpen: true }), null);
  assert.equal(stateToRoute({ role: 'agent', tab: 'more' }), null);
  assert.equal(stateToRoute({ role: 'agent', tab: 'clients', creatingTenant: false }), '/agent/clients');
  assert.equal(stateToRoute({ role: 'agent', tab: 'listingRoom', creatingTenant: true }), '/agent/rooms');
  assert.equal(stateToRoute({ role: 'tenant', tab: 'dashboard', partyInbox: 'tenants' }), null);
  assert.equal(stateToRoute({ role: 'admin', tab: 'tickets' }), null);
  assert.equal(stateToRoute({ role: 'guest', tab: 'menu' }), null);
});

test('R2: filters replace the history entry, other changes push a new one', () => {
  assert.equal(routeEntryKey('/agent/calendar?date=2026-11-03'), '/agent/calendar');
  assert.equal(routeEntryKey('/agent/clients?filter=renewal&view=all'), '/agent/clients');
  assert.equal(routeEntryKey('/tenant/bills?history=1'), '/tenant/bills?history=1');
  assert.ok(isParentRoute('/agent/rooms', '/agent/rooms/new'));
  assert.ok(isParentRoute('/tenant/bills', '/tenant/bills?history=1'));
  assert.ok(isParentRoute('/landlord', '/landlord/tenants'));
  assert.ok(!isParentRoute('/agent/leads', '/agent/rooms/new'));
  assert.ok(!isParentRoute('/agent/rooms/new', '/agent/rooms'));
});

test('R2: router params are written one way (keys sorted, catch-all arrays read once)', () => {
  assert.equal(normalizeHref('/agent/calendar', { date: '2026-11-03' }), '/agent/calendar?date=2026-11-03');
  assert.equal(normalizeHref('/x', { b: '2', a: ['1', '9'] }), '/x?a=1&b=2');
  assert.equal(normalizeHref('', {}), '/');
  assert.deepEqual(parseQuery('?a=1&a=2&b=%E0%B8%81&c'), { a: '1', b: 'ก', c: '' });
});
