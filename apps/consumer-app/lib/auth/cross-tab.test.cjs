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
const { crossTabAction, SESSION_STORAGE_KEY, AUTH_EVENT_KEY } = load('cross-tab-rules.ts');
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
  assert.match(ctx, /requestGuestBrowse\(\);/);
  const native = read('cross-tab.ts');
  assert.match(native, /export function markAuthEvent\(_reason: AuthEventReason\): void \{\}/);
  assert.match(native, /return \(\) => undefined;/);
  assert.match(read('cross-tab.web.ts'), /addEventListener\('storage', listener\)/);
});
