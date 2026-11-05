// QA web role URL bug (4 Nov 2026): a tenant typed /agent/rooms, /landlord/income or /admin and saw those pages.
// app/index.tsx now sends a signed-in account quietly to its own home when the page belongs to a role it does not have:
// applyRoute (a URL from outside) and an effect (a page opened before the saved sign-in loaded, a default role).
// The real handlers are read out of index.tsx and run with stand-ins, like sign-out-navigation.test.cjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.resolve(__dirname, '../app/index.tsx'), 'utf8');
const ast = ts.createSourceFile('index.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let applyRoute, guard;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'applyRoute') {
    applyRoute = node.initializer.arguments[0].getText(ast);
  }
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.arguments[0].getText(ast).includes('landingRoleFor(signedInRoles)')) {
    guard = node.arguments[0].getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(applyRoute, 'index.tsx has applyRoute');
assert.ok(guard, 'index.tsx has the role guard effect');
const js = (code) => ts.transpile(code, { target: ts.ScriptTarget.ES2022 }).trim().replace(/;$/, '');

const routes = (() => {
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpile(fs.readFileSync(path.join(__dirname, '../lib/app-routes.ts'), 'utf8'), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }))(() => { throw new Error('none'); }, mod, mod.exports);
  return mod.exports;
})();

function setup({ roles, os = 'web', activeRole = 'guest' }) {
  const calls = [];
  const set = (name) => (value) => calls.push([name, value]);
  const deps = {
    Platform: { OS: os },
    router: { replace: (href) => calls.push(['replace', href]), push: (href) => calls.push(['push', href]) },
    signedInRolesRef: { current: roles },
    signedInRoles: roles,
    activeRole,
    canOpenRole: routes.canOpenRole,
    roleHomePath: routes.roleHomePath,
    landingRoleFor: (r) => routes.pickLandingRole(r),
    // Portal "all" stand-in for lib/web-routes roleRedirect (portal rules: lib/route-access.test.cjs).
    roleRedirect: (role, r) => (!r || routes.canOpenRole(role, r) ? null : routes.roleHomePath(routes.pickLandingRole(r))),
    getDefaultTabForRole: (role) => `${role}-home`,
    calendarDateKey: () => '2026-11-04',
  };
  for (const name of ['setDrawerOpen', 'setPartyInbox', 'setContractHistory', 'setSelectedPartyRoom', 'setOpenedPartyContract',
    'setBillHistory', 'setSelectedBillRoom', 'setLeadsWorkFilter', 'setClientsWorkFilter', 'setSecondaryReturnTab', 'setLeadEdit',
    'setMatchRoomId', 'setMatchRoomPreview', 'setCreatingTenant', 'setCalendarSelectedDate', 'setCalendarMonth', 'setActiveRole', 'setActiveTab']) {
    deps[name] = set(name);
  }
  const make = (code) => new Function(...Object.keys(deps), `return (${js(code)});`)(...Object.values(deps));
  return { apply: make(applyRoute), guard: make(guard), calls };
}

const tenant = ['guest', 'tenant'];

test('a tenant who types another role\'s URL goes to /tenant, and that page never opens', () => {
  for (const role of ['agent', 'landlord', 'admin']) {
    const { apply, calls } = setup({ roles: tenant });
    apply({ role, tab: 'home' });
    assert.deepEqual(calls, [['replace', '/tenant']], role);
  }
});

test('a page of a role the account has, or a guest page, opens as before', () => {
  for (const role of ['tenant', 'guest']) {
    const { apply, calls } = setup({ roles: tenant });
    apply({ role, tab: 'bills' });
    assert.ok(calls.some(([name, value]) => name === 'setActiveRole' && value === role), role);
    assert.ok(!calls.some(([name]) => name === 'replace'), role);
  }
});

test('before the saved sign-in has loaded (no roles yet) the URL opens; the effect corrects it once roles arrive', () => {
  const early = setup({ roles: null });
  early.apply({ role: 'agent', tab: 'home' });
  assert.ok(early.calls.some(([name, value]) => name === 'setActiveRole' && value === 'agent'));
  const loaded = setup({ roles: tenant, activeRole: 'agent' });
  loaded.guard();
  assert.deepEqual(loaded.calls, [['replace', '/tenant']], 'web: replace, so back does not return to the refused page');
});

test('mobile: a role the account does not have (default role, pending role) switches to its own role', () => {
  const { guard, calls } = setup({ roles: ['guest', 'landlord'], os: 'ios', activeRole: 'agent' });
  guard();
  assert.deepEqual(calls.filter(([name]) => name === 'setActiveRole' || name === 'setActiveTab'),
    [['setActiveRole', 'landlord'], ['setActiveTab', 'landlord-home']]);
  assert.ok(!calls.some(([name]) => name === 'replace'));
});

test('the effect does nothing for an allowed role or a signed-out visitor', () => {
  const allowed = setup({ roles: tenant, activeRole: 'tenant' });
  allowed.guard();
  assert.deepEqual(allowed.calls, []);
  const visitor = setup({ roles: null, activeRole: 'agent' });
  visitor.guard();
  assert.deepEqual(visitor.calls, []);
});
