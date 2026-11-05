// Route access by role and portal (project-docs/nestyk-route-access-design.md, Mos 5 Nov 2026).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, deps = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)((id) => {
    if (id in deps) return deps[id];
    throw new Error(`${file} must not import ${id}`);
  }, mod, mod.exports);
  return mod.exports;
}
const routes = load('app-routes.ts');
const access = load('route-access.ts', { './app-routes': routes });
const { decideAccess, decideRoleAccess, landingFor, switcherRoles, portalFrom, portalHome, ROLE_ACCESS, PORTAL_ROLES } = access;

const ctx = (portal, signedIn, accountRoles, lastRole) => ({ portal, signedIn, accountRoles, lastRole });
const AGENT = ['guest', 'agent'];
const TENANT = ['guest', 'tenant'];
const BOTH = ['guest', 'agent', 'tenant'];
const SUPER = ['guest', 'agent', 'tenant', 'landlord', 'admin'];

test('guest pages are public for everyone on every portal (Mos: "guest เข้าได้ทุกคน")', () => {
  for (const portal of Object.keys(PORTAL_ROLES)) {
    for (const p of ['/', '/search', '/services']) {
      for (const c of [ctx(portal, false, null), ctx(portal, true, TENANT), ctx(portal, true, AGENT)]) {
        assert.deepEqual(decideAccess(p, '', c), { kind: 'allow' }, `${portal} ${p}`);
      }
    }
  }
});

test('auth, legal and unknown paths are not decided here', () => {
  for (const p of ['/login', '/register', '/reset-password', '/privacy', '/terms', '/nope']) {
    assert.deepEqual(decideAccess(p, '', ctx('agent', true, TENANT)), { kind: 'allow' }, p);
  }
});

test('all portal (dev, QA, localhost): same behaviour as before', () => {
  assert.deepEqual(decideAccess('/agent/leads', '?view=work', ctx('all', false, null)),
    { kind: 'login', to: '/login?next=%2Fagent%2Fleads%3Fview%3Dwork' });
  assert.deepEqual(decideAccess('/agent/leads', '', ctx('all', true, AGENT)), { kind: 'allow' });
  assert.deepEqual(decideAccess('/agent', '', ctx('all', true, TENANT)), { kind: 'redirect', to: '/tenant' });
  assert.deepEqual(decideAccess('/tenant', '', ctx('all', true, AGENT)), { kind: 'redirect', to: '/agent' });
  assert.deepEqual(decideAccess('/admin', '', ctx('all', true, AGENT)), { kind: 'redirect', to: '/agent' });
  assert.deepEqual(decideAccess('/admin', '', ctx('all', true, SUPER)), { kind: 'allow' });
  assert.deepEqual(decideAccess('/agent', '', ctx('all', true, ['guest'])), { kind: 'redirect', to: '/' });
  assert.deepEqual(decideAccess('/owner/contracts', '', ctx('all', true, ['guest', 'landlord'])), { kind: 'allow' });
});

test('agent portal (agent.nestyk.com): only agent pages; other roles go to /agent; no agent role = no access page', () => {
  const portal = 'agent';
  assert.deepEqual(decideAccess('/agent/rooms', '', ctx(portal, false, null)),
    { kind: 'login', to: '/login?next=%2Fagent%2Frooms' });
  assert.deepEqual(decideAccess('/agent/rooms', '', ctx(portal, true, AGENT)), { kind: 'allow' });
  for (const p of ['/tenant', '/landlord/income', '/admin', '/owner/x']) {
    assert.deepEqual(decideAccess(p, '', ctx(portal, false, null)), { kind: 'redirect', to: '/agent' }, p);
    assert.deepEqual(decideAccess(p, '', ctx(portal, true, SUPER)), { kind: 'redirect', to: '/agent' }, p);
  }
  assert.deepEqual(decideAccess('/agent', '', ctx(portal, true, TENANT)), { kind: 'noRole', portal: 'agent' });
  assert.deepEqual(decideAccess('/agent', '', ctx(portal, true, ['guest'])), { kind: 'noRole', portal: 'agent' });
});

test('landing after sign-in respects the portal and the remembered role', () => {
  assert.equal(landingFor('all', BOTH, 'tenant'), 'tenant');
  assert.equal(landingFor('all', BOTH, null), 'agent');
  assert.equal(landingFor('all', SUPER, 'admin'), 'agent', 'admin is never picked automatically');
  assert.equal(landingFor('all', ['guest'], null), 'guest');
  assert.equal(landingFor('agent', BOTH, 'tenant'), 'agent', 'tenant is not in the agent portal');
  assert.equal(landingFor('agent', TENANT, null), null);
  assert.equal(landingFor('admin', SUPER, null), 'admin');
});

test('the role switcher lists only the portal roles the account has', () => {
  assert.deepEqual(switcherRoles('all', BOTH), ['guest', 'agent', 'tenant']);
  assert.deepEqual(switcherRoles('agent', SUPER), ['agent']);
  assert.deepEqual(switcherRoles('agent', TENANT), []);
});

test('portal from env: unknown or missing is all; homes', () => {
  assert.equal(portalFrom(undefined), 'all');
  assert.equal(portalFrom(' Agent '), 'agent');
  assert.equal(portalFrom('owner'), 'all');
  assert.equal(portalFrom('guest'), 'all');
  assert.equal(portalHome('all'), '/');
  assert.equal(portalHome('agent'), '/agent');
});

test('every role has a rule, and every portal role is a real role path', () => {
  for (const role of ['guest', 'agent', 'tenant', 'landlord', 'admin']) assert.ok(ROLE_ACCESS[role], role);
  for (const roles of Object.values(PORTAL_ROLES)) for (const r of roles) assert.ok(routes.ROLE_PATH[r], r);
  assert.deepEqual(decideRoleAccess('guest', '/', ctx('agent', false, null)), { kind: 'allow' });
});

test('wiring: the home shell, sign-in and role switcher all go through the portal rules', () => {
  const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
  const index = read('../app/index.tsx');
  assert.equal((index.match(/roleRedirect\((activeRole, signedInRoles|route\.role, signedInRolesRef\.current)\)/g) || []).length, 2, 'guard effect + typed URL');
  assert.match(index, /allowedRoles=\{isAuthenticated \? portalSwitcherRoles\(session\?\.roles\) : undefined\}/);
  const web = read('web-routes.web.ts');
  assert.match(web, /WEB_PORTAL: Portal = portalFrom\(process\.env\.EXPO_PUBLIC_WEB_PORTAL\)/);
  assert.match(web, /if \(decision\.kind === 'noRole'\) return NO_ACCESS_PATH;/);
  const native = read('web-routes.ts');
  assert.match(native, /if \(!roles \|\| canOpenRole\(role, roles\)\) return null;/, 'mobile: unchanged behaviour');
  assert.match(read('app-routes.ts'), /'\/no-access'\] as const/);
  assert.ok(fs.existsSync(path.join(__dirname, '../app/no-access.tsx')));
});

test('other portal sites: EXPO_PUBLIC_WEB_PORTAL_URLS is read safely', () => {
  assert.deepEqual(access.portalUrlsFrom(' all=https://app.nestyk.com/ , Tenant=https://tenant.nestyk.com'), {
    all: 'https://app.nestyk.com',
    tenant: 'https://tenant.nestyk.com',
  });
  assert.deepEqual(access.portalUrlsFrom('all=http://127.0.0.1:8081'), { all: 'http://127.0.0.1:8081' });
  for (const bad of [undefined, null, 5, '', 'all', 'boss=https://x.com', 'all=javascript:alert(1)', 'all=https://x.com/path', 'all=//x.com']) {
    assert.deepEqual(access.portalUrlsFrom(bad), {}, String(bad));
  }
});

test('a role this portal does not show opens on its own site, else the full site; never for guest or own roles', () => {
  const urls = { all: 'https://app.nestyk.com', tenant: 'https://tenant.nestyk.com' };
  assert.equal(access.roleElsewhere('agent', 'tenant', urls), 'https://tenant.nestyk.com/tenant');
  assert.equal(access.roleElsewhere('agent', 'landlord', urls), 'https://app.nestyk.com/landlord');
  assert.equal(access.roleElsewhere('agent', 'agent', urls), null);
  assert.equal(access.roleElsewhere('agent', 'guest', urls), null);
  assert.equal(access.roleElsewhere('all', 'tenant', urls), null, 'the full site shows every role');
  assert.equal(access.roleElsewhere('agent', 'tenant', {}), null, 'no site set: not offered');
});

test('one person, several roles: the switcher lists this portal\'s roles, then the ones on other sites', () => {
  const urls = { all: 'https://app.nestyk.com' };
  const roles = ['guest', 'tenant', 'agent', 'landlord'];
  assert.deepEqual(access.switcherRoles('agent', roles), ['agent']);
  assert.deepEqual(access.elsewhereRoles('agent', roles, urls), ['landlord', 'tenant']);
  assert.deepEqual(access.elsewhereRoles('agent', roles, {}), [], 'no site set: switcher shows agent only');
  assert.deepEqual(access.elsewhereRoles('all', roles, urls), []);
  assert.deepEqual(access.elsewhereRoles('agent', ['guest', 'tenant'], urls), ['tenant'], 'no-access page offers it');
});

test('wiring: switching to a role of another portal opens its site (web), mobile unchanged', () => {
  const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
  const index = read('../app/index.tsx');
  assert.match(index, /const handleRoleChange = \(role: UserRole\) => \{\n[^\n]*\n\s*if \(openRoleElsewhere\(role\)\) \{/);
  assert.match(index, /otherSiteRoles=\{isAuthenticated \? otherSiteRoles\(session\?\.roles\) : undefined\}/);
  assert.match(index, /allowedRoles=\{isAuthenticated && session \? portalSwitcherRoles\(session\.roles\) : undefined\}/, 'narrow web drawer too');
  assert.match(read('web-routes.web.ts'), /portalUrlsFrom\(process\.env\.EXPO_PUBLIC_WEB_PORTAL_URLS\)/);
  assert.match(read('web-routes.ts'), /export function openRoleElsewhere\(_role: UserRole\): boolean \{\n\s*return false;/);
  assert.match(read('../components/agent-web/AgentWorkspace.web.tsx'), /badge: props\.otherSiteRoles\?\.includes\(role\) \? t\.webSession\.otherSite : undefined/);
  assert.match(read('../components/web-access/NoAccessScreen.web.tsx'), /otherSiteRoles\(session\?\.roles\)/);
});
