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
const { parseAppPath, roleHomePath, safeNextPath, loginPathFor, pickLandingRole, postLoginPath } = mod.exports;

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
