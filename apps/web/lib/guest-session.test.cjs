// AUTH-2.2 (nestyk-guest-session-plan-20261112.md, B2): the guest web reads the sign-in the account pages (consumer-app)
// saved on this same site. Same keys and the same rules as consumer-app, checked against its own files here.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTs(file, deps = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)((id) => {
    if (id in deps) return deps[id];
    throw new Error(`unexpected import ${id} in ${file}`);
  }, mod, mod.exports);
  return mod.exports;
}

const session = loadTs(path.join(__dirname, 'guest-session.ts'));
const authDir = path.join(__dirname, '..', '..', 'consumer-app', 'lib', 'auth');
const crossTab = loadTs(path.join(authDir, 'cross-tab-rules.ts'));
const idle = loadTs(path.join(authDir, 'idle-rules.ts'));
const storage = loadTs(path.join(authDir, 'session-storage.ts'), { '@react-native-async-storage/async-storage': { default: {} } });

const saved = (over = {}) => JSON.stringify({
  mode: 'supabase', accessToken: 'token-not-read', email: 'mary@example.com', userId: 'u-1',
  firstName: 'Mary', lastName: 'Ann', avatarUrl: 'https://img.example/a.png', roles: ['guest', 'agent'], ...over,
});

test('same storage keys and idle limit as the consumer-app', () => {
  assert.equal(session.SESSION_STORAGE_KEY, crossTab.SESSION_STORAGE_KEY);
  assert.equal(session.AUTH_EVENT_KEY, crossTab.AUTH_EVENT_KEY);
  assert.equal(session.ACTIVITY_KEY, idle.ACTIVITY_KEY);
  assert.equal(session.IDLE_LIMIT_MS, idle.IDLE_LIMIT_MS);
  assert.equal(session.ACTIVITY_WRITE_MS, idle.ACTIVITY_WRITE_MS);
});

test('the saved copy gives the profile for the header, never the token', () => {
  const profile = session.readGuestProfile(saved());
  assert.deepEqual(profile, {
    userId: 'u-1', email: 'mary@example.com', firstName: 'Mary', lastName: 'Ann',
    displayName: 'Mary Ann', initials: 'MA', avatarUrl: 'https://img.example/a.png', roles: ['guest', 'agent'],
  });
  assert.ok(!('accessToken' in profile));
});

test('a copy is used only when the consumer-app would use it (token, email and user id present)', () => {
  for (const bad of [null, '', 'not json', '{}', saved({ accessToken: '' }), saved({ email: '' }), saved({ userId: '' }), '[]', 'null']) {
    assert.equal(session.readGuestProfile(bad), null, String(bad));
  }
  const odd = session.readGuestProfile(saved({ roles: 'agent', avatarUrl: 'javascript:alert(1)', firstName: 5 }));
  assert.deepEqual(odd.roles, [], 'roles must be a list');
  assert.equal(odd.avatarUrl, null, 'only http(s) pictures');
  assert.equal(odd.firstName, '');
});

test('name and initials read the same as in the consumer-app', () => {
  for (const [first, last, email] of [['Mary', 'Ann', 'm@x.co'], ['', '', 'somchai@x.co'], ['  ', 'Lee', 'l@x.co'], ['สมชาย', '', 's@x.co']]) {
    const profile = session.readGuestProfile(saved({ firstName: first, lastName: last, email }));
    assert.equal(profile.displayName, storage.displayNameFrom(first, last, email), `${first} ${last}`);
    assert.equal(profile.initials, storage.initialsFromName(first, last, email), `${first} ${last}`);
  }
});

test('another tab or the account pages changed the sign-in: same decision as the consumer-app tabs', () => {
  const kinds = { none: 'none', signOut: 'signedOut', reload: 'switchedUser' };
  const cases = [
    { currentUserId: 'u-1', key: session.SESSION_STORAGE_KEY, newValue: null },
    { currentUserId: 'u-1', key: null, newValue: null },
    { currentUserId: null, key: null, newValue: null },
    { currentUserId: null, key: session.SESSION_STORAGE_KEY, newValue: saved() },
    { currentUserId: 'u-1', key: session.SESSION_STORAGE_KEY, newValue: saved() },
    { currentUserId: 'u-1', key: session.SESSION_STORAGE_KEY, newValue: saved({ userId: 'u-2' }) },
    { currentUserId: 'u-1', key: 'other.key', newValue: 'x' },
    { currentUserId: null, key: session.SESSION_STORAGE_KEY, newValue: 'broken' },
  ];
  for (const c of cases) {
    const app = crossTab.crossTabAction({ ...c, reasonRaw: null });
    const expected = app.kind === 'adopt' ? (c.currentUserId ? 'updated' : 'signedIn') : kinds[app.kind];
    assert.equal(session.guestSessionChange(c), expected, JSON.stringify(c));
  }
});

test('8 hours with no use signs out here too, by the shared last-activity time', () => {
  const now = 1_800_000_000_000;
  for (const last of [null, now, now - 1000, now - idle.IDLE_LIMIT_MS + 1, now - idle.IDLE_LIMIT_MS, now - idle.IDLE_LIMIT_MS - 5, now + 60_000]) {
    const raw = last === null ? null : String(last);
    assert.equal(session.idleExpired(raw, now), idle.idlePhase(idle.parseLastActivity(raw), now) === 'expired', String(last));
  }
  assert.equal(session.idleExpired('garbage', now), false);
});

test('the guest web keeps to pure rules here (no React, no browser globals): the provider does the I/O', () => {
  const source = fs.readFileSync(path.join(__dirname, 'guest-session.ts'), 'utf8');
  assert.doesNotMatch(source, /^import /m);
  assert.doesNotMatch(source, /\b(window|localStorage|document)\./);
});

test('the account menu links to the role pages the account has (agent, landlord, tenant), never admin or guest', () => {
  assert.deepEqual(session.roleSiteLinks(['guest', 'tenant', 'agent']), [
    { role: 'agent', path: '/agent' },
    { role: 'tenant', path: '/tenant' },
  ]);
  assert.deepEqual(session.roleSiteLinks(['admin', 'guest']), []);
  assert.deepEqual(session.roleSiteLinks(['landlord', 'landlord', 'x']), [{ role: 'landlord', path: '/landlord' }]);
  assert.deepEqual(session.roleSiteLinks(undefined), []);
});
