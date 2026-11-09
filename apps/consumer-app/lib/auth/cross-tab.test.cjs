// Web: other tabs follow sign in / sign out (Mos 4 Nov 2026). Rules + wiring; mobile stays a no-op.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const load = (file) => {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)(() => { throw new Error(`${file} must stay dependency free`); }, mod, mod.exports);
  return mod.exports;
};
const { crossTabAction, SESSION_STORAGE_KEY, AUTH_EVENT_KEY, EXPIRED_AT_KEY, EXPIRY_NOTICE_MS, recentExpiry } = load('cross-tab-rules.ts');
const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const saved = (userId) => JSON.stringify({ mode: 'supabase', accessToken: 't', email: 'a@nestyk.test', userId, firstName: '', lastName: '', roles: ['agent'] });
const ev = (over) => ({ currentUserId: 'u1', key: SESSION_STORAGE_KEY, newValue: null, reasonRaw: null, ...over });

test('sign out in another tab: this tab signs out too, with the same reason', () => {
  assert.deepEqual(crossTabAction(ev({ reasonRaw: 'signedOut' })), { kind: 'signOut', reason: 'signedOut' });
  assert.deepEqual(crossTabAction(ev({ reasonRaw: 'expired' })), { kind: 'signOut', reason: 'expired' });
  assert.deepEqual(crossTabAction(ev({ reasonRaw: null })), { kind: 'signOut', reason: 'signedOut' });
  assert.deepEqual(crossTabAction(ev({ key: null })), { kind: 'signOut', reason: 'signedOut' }); // localStorage.clear()
  assert.deepEqual(crossTabAction(ev({ newValue: '{broken' })), { kind: 'signOut', reason: 'signedOut' });
  assert.deepEqual(crossTabAction(ev({ currentUserId: null })), { kind: 'none' });
});

test('sign in in another tab: adopt it; a different user reloads; other keys are ignored', () => {
  assert.deepEqual(crossTabAction(ev({ currentUserId: null, newValue: saved('u2') })), { kind: 'adopt', userId: 'u2' });
  assert.deepEqual(crossTabAction(ev({ newValue: saved('u1') })), { kind: 'adopt', userId: 'u1' });
  assert.deepEqual(crossTabAction(ev({ newValue: saved('u2') })), { kind: 'reload' });
  assert.deepEqual(crossTabAction(ev({ key: 'nestyk.web.lastRole', newValue: 'agent' })), { kind: 'none' });
  assert.deepEqual(crossTabAction(ev({ key: AUTH_EVENT_KEY, newValue: 'signedOut' })), { kind: 'none' });
});

test('wiring: same storage key, reason written before clearing, mobile is a no-op', () => {
  assert.match(read('session-storage.ts'), new RegExp(`SESSION_KEY = '${SESSION_STORAGE_KEY.replace(/\./g, '\\.')}'`));
  const ctx = read('AuthContext.tsx');
  assert.match(ctx, /markAuthEvent\(reason\);[^\n]*\n\s*await clearAuthSession\(\);/);
  assert.match(ctx, /markAuthEvent\('expired'\);[^\n]*\n\s*await clearAuthSession\(\);/);
  assert.match(ctx, /subscribeCrossTab\(/);
  // 9 Nov 2026: signed out in another tab = guest, then where "Sign out" lands (EXPO_PUBLIC_WEB_SIGN_OUT_TO).
  assert.match(ctx, /requestSignOutLanding\(\);/);
  const native = read('cross-tab.ts');
  assert.match(native, /export function markAuthEvent\(_reason: AuthEventReason\): void \{\}/);
  assert.match(native, /return \(\) => undefined;/);
  assert.match(read('cross-tab.web.ts'), /addEventListener\('storage', listener\)/);
});

// QA web test (4 Nov 2026) item 5: two tabs, the other tab's session ran out first; this tab then reloaded, found no
// session, and showed the sign-in page with no reason. Now it shows "session expired" once.
test('an expiry is news for a day; a future, broken or missing time is not', () => {
  const now = 1_800_000_000_000;
  assert.equal(recentExpiry(String(now - 1000), now), true);
  assert.equal(recentExpiry(String(now - EXPIRY_NOTICE_MS + 1), now), true);
  assert.equal(recentExpiry(String(now - EXPIRY_NOTICE_MS), now), false);
  assert.equal(recentExpiry(String(now + 60_000), now), false);
  for (const raw of [null, undefined, '', 'abc', '0', '-5']) assert.equal(recentExpiry(raw, now), false, String(raw));
});

function webTabs() {
  const store = new Map();
  global.window = { localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  } };
  const source = ts.transpileModule(read('cross-tab.web.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const rules = load('cross-tab-rules.ts');
  const mod = { exports: {} };
  const idle = load('idle-rules.ts');
  const deps = { './cross-tab-rules': rules, './idle-rules': idle };
  new Function('require', 'module', 'exports', source)((id) => { if (deps[id]) return deps[id]; throw new Error(id); }, mod, mod.exports);
  return { ...mod.exports, store };
}

test('a tab that loads after another tab expired is told once; a sign out or a new sign-in clears it', () => {
  const web = webTabs();
  web.markAuthEvent('expired'); // the other tab ran out
  assert.equal(web.store.get(AUTH_EVENT_KEY), 'expired');
  assert.ok(web.store.has(EXPIRED_AT_KEY));
  assert.equal(web.takeExpiryNotice(), true, 'the reloaded tab shows the notice');
  assert.equal(web.takeExpiryNotice(), false, 'only once');
  web.markAuthEvent('expired');
  web.markAuthEvent('signedOut');
  assert.equal(web.takeExpiryNotice(), false, 'a later sign out replaces it');
  web.markAuthEvent('expired');
  web.clearExpiryNotice(); // signed in again
  assert.equal(web.takeExpiryNotice(), false);
});

test('review F6: a new sign-in starts the idle clock now; a sign out or expiry clears it', () => {
  const web = webTabs();
  const KEY = 'nestyk.web.lastActivity';
  web.store.set(KEY, '1000'); // left over from yesterday
  const before = Date.now();
  web.markFreshSignIn();
  assert.ok(Number(web.store.get(KEY)) >= before, 'Google return page does not read the old time');
  web.markAuthEvent('signedOut');
  assert.equal(web.store.has(KEY), false);
  web.markFreshSignIn();
  web.markAuthEvent('expired');
  assert.equal(web.store.has(KEY), false);
});

test('review F6 wiring: only new sign-ins start the clock (restore and profile refresh keep the saved time)', () => {
  const ctx = read('AuthContext.tsx');
  assert.match(ctx, /if \(fresh\) markFreshSignIn\(\);/);
  assert.match(ctx, /result\.profile\), !stored\);/, 'restore: only an adopted Google/Facebook return is fresh');
  assert.match(ctx, /await applySession\(result\.session\);/, 'cached restore is not fresh');
  assert.match(ctx, /const next = sessionFromSync\(session\.mode[^\n]*\n\s*await applySession\(next\);/, 'refreshProfile is not fresh');
  const fresh = (ctx.match(/await applySession\([\s\S]*?\);/g) || []).filter((call) => /,\s*true,?\s*\);$/.test(call));
  assert.equal(fresh.length, 5, 'password, dev, OAuth, sign-up, reset');
  assert.match(read('cross-tab.ts'), /export function markFreshSignIn\(\): void \{\}/);
});

test('wiring: a signed-out load asks once; signing in clears it; mobile never tells', () => {
  const ctx = read('AuthContext.tsx');
  assert.match(ctx, /else if \(!stored && takeExpiryNotice\(\)\) setSessionExpired\(true\);/);
  assert.match(ctx, /await saveAuthSession\(next\);\n\s*clearExpiryNotice\(\);/);
  const native = read('cross-tab.ts');
  assert.match(native, /export function takeExpiryNotice\(\): boolean \{\n\s*return false;/);
});
