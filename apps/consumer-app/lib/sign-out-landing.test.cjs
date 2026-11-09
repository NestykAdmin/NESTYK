// Where "Sign out" lands. Web (Mos 9 Nov 2026): a setting, so it can change later without code —
// EXPO_PUBLIC_WEB_SIGN_OUT_TO = guest ("/") | login ("/login"); unset = guest on portal "all", login on a role
// portal (agent.nestyk.com). Mobile (frozen) always opens /login, as before.
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
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

test('the setting reads guest or login; anything else means "use the default"', () => {
  assert.equal(access.signOutLandingFrom('guest'), 'guest');
  assert.equal(access.signOutLandingFrom(' LOGIN '), 'login');
  for (const raw of [undefined, '', 'agent', '/agent', 'https://evil.example']) assert.equal(access.signOutLandingFrom(raw), null, String(raw));
});

test('default: guest home on portal "all", the sign-in page on a role portal', () => {
  assert.equal(access.afterSignOutPath('all', null), '/');
  assert.equal(access.afterSignOutPath('agent', null), '/login');
  assert.equal(access.afterSignOutPath('landlord', null), '/login');
});

test('the setting wins on every portal', () => {
  assert.equal(access.afterSignOutPath('all', 'login'), '/login');
  assert.equal(access.afterSignOutPath('agent', 'guest'), '/');
  assert.equal(access.afterSignOutPath('agent', 'login'), '/login');
});

test('web reads the env once; mobile keeps /login', () => {
  const web = read('web-routes.web.ts');
  assert.match(web, /afterSignOutPath\(WEB_PORTAL, signOutLandingFrom\(process\.env\.EXPO_PUBLIC_WEB_SIGN_OUT_TO\)\)/);
  assert.match(web, /export function afterSignOutHref\(\): string \{/);
  const native = read('web-routes.ts');
  assert.match(native, /export function afterSignOutHref\(\): string \{\s*return '\/login';\s*\}/);
});

test('both sign-out buttons use it', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.tsx'), 'utf8');
  assert.match(index, /const AFTER_SIGN_OUT_PATH = afterSignOutHref\(\);/);
  const handler = index.slice(index.indexOf('const handleAuthAction'), index.indexOf('const handleSignOutEverywhere'));
  assert.equal((handler.match(/router\.replace\(AFTER_SIGN_OUT_PATH\)/g) || []).length, 2);
  assert.doesNotMatch(handler, /router\.replace\('\/login'\)/);
  const everywhere = index.slice(index.indexOf('const handleSignOutEverywhere'), index.indexOf('const handleRequireAuth'));
  assert.match(everywhere, /router\.replace\(AFTER_SIGN_OUT_PATH\)/);
});

test('a sign out in another tab lands in the same place; "continue as guest" on the login page does not', () => {
  const gate = read('auth/role-gate.ts');
  assert.match(gate, /export function requestSignOutLanding\(\): void \{\s*requestGuestBrowse\(\);\s*signedOutElsewhere = true;\s*\}/);
  assert.match(gate, /export function consumeSignOutLanding\(\): boolean/);
  const auth = read('auth/AuthContext.tsx');
  assert.match(auth, /if \(action\.reason === 'signedOut'\) \{\s*requestSignOutLanding\(\);/);
  const login = fs.readFileSync(path.join(__dirname, '..', 'app', 'login.tsx'), 'utf8');
  assert.doesNotMatch(login, /requestSignOutLanding/);
  const index = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.tsx'), 'utf8');
  assert.match(index, /if \(consumeGuestBrowse\(\)\) \{[\s\S]{0,300}const landElsewhere = consumeSignOutLanding\(\) && AFTER_SIGN_OUT_PATH !== '\/';[\s\S]{0,300}if \(landElsewhere\) router\.replace\(AFTER_SIGN_OUT_PATH as never\);/);
});

test('.env.example documents the setting', () => {
  const env = fs.readFileSync(path.join(__dirname, '..', '..', '..', '.env.example'), 'utf8');
  assert.match(env, /# EXPO_PUBLIC_WEB_SIGN_OUT_TO=/);
});

test('sign out to /login holds the shell move to "/" instead of pushing it over the login page', () => {
  // A0.1 9 Nov 2026: Sign Out reset the shell to guest and replaced to /login in one step; the route sync ran before
  // the router moved and pushed "/" on top, so /login never showed. The sign-out code now holds that one move.
  const web = read('web-routes.web.ts');
  const sync = web.slice(web.indexOf('export function useAppRouteSync'));
  const shellMove = sync.slice(sync.indexOf('if (!routeHref || routeHref === synced.current) return;'));
  assert.ok(shellMove.indexOf('heldShellMove === routeHref') < shellMove.indexOf('router.push(routeHref'), 'held before any push');
  assert.match(sync, /heldShellMove = null; \/\/ a new URL from outside/);
  assert.match(read('web-routes.ts'), /export function holdShellMove\(_href: string\): void \{\}/, 'mobile no-op');

  const index = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.tsx'), 'utf8');
  assert.match(index, /if \(AFTER_SIGN_OUT_PATH !== '\/'\) holdShellMove\(roleHomePath\('guest'\)\);/);
  const auth = index.slice(index.indexOf('const handleAuthAction = async'), index.indexOf('const handleRequireAuth'));
  assert.equal((auth.match(/holdGuestHomeForSignOut\(\);\n\s+setActiveRole\('guest'\);/g) || []).length, 3, 'sign out (ok + fail) and sign out everywhere');
  assert.match(index, /if \(landElsewhere\) holdGuestHomeForSignOut\(\);\n\s+setActiveRole\('guest'\);/, 'another tab');

  // The held href is exactly what the shell produces for the guest home.
  const home = routes.routeToState('/', {});
  assert.equal(routes.stateToRoute({ ...home.state, partyInbox: null }), routes.roleHomePath('guest'));
});
