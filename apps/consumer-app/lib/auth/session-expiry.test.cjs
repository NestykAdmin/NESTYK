// lib/auth/session-expiry.ts: what the app does at start-up and when a session cannot be renewed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, deps = {}) {
  const loaded = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('module', 'exports', 'require', source)(loaded, loaded.exports, (id) => {
    if (!(id in deps)) throw new Error(`Unexpected dependency: ${id}`);
    return deps[id];
  });
  return loaded.exports;
}
// SESSION_EXPIRED is the ApiError code lib/api.ts throws when a session cannot be renewed.
const { restoreSession, createSessionExpiry } = load('session-expiry.ts', { '../api': { SESSION_EXPIRED: 'SESSION_EXPIRED' } });

const PROFILE = { id: 7, email: 'agent@nestyk.com', firstName: 'A', lastName: 'B', phone: null, avatarUrl: null, roles: ['agent'] };
const STORED = { mode: 'supabase', accessToken: 'saved-token', email: 'agent@nestyk.com', userId: 'user-1', firstName: 'A', lastName: 'B', roles: ['agent'] };

/** Fake Supabase client. `getSession` is the value (or function) getSession() returns. */
function fakeClient(getSession) {
  const calls = { getSession: 0, signOut: [] };
  const client = {
    auth: {
      getSession: async () => {
        calls.getSession += 1;
        return typeof getSession === 'function' ? getSession() : getSession;
      },
      signOut: async (options) => {
        calls.signOut.push(options);
      },
    },
  };
  return { client, calls };
}
const live = (token, userId = 'user-1') => ({ data: { session: { access_token: token, user: { id: userId } } }, error: null });
const noSession = (errorName) => ({ data: { session: null }, error: errorName ? { name: errorName } : null });

/** Fake POST /auth/sync that records the token it was given. */
function fakeSync(result) {
  const tokens = [];
  const sync = async (token) => {
    tokens.push(token);
    if (result instanceof Error) throw result;
    return result;
  };
  return { sync, tokens };
}
const apiError = (status, code) => Object.assign(new Error(`HTTP ${status}`), { status, code });

// --- restoreSession (app start-up) ---

test('nothing saved: signed out, no notice, nothing called', async () => {
  const { client, calls } = fakeClient(live('t'));
  const { sync, tokens } = fakeSync(PROFILE);
  assert.deepEqual(await restoreSession({ stored: null, client, sync }), { kind: 'none' });
  assert.equal(calls.getSession, 0);
  assert.equal(tokens.length, 0);
});

test('Supabase login: profile is loaded with the current token (no saved token is passed)', async () => {
  const { client, calls } = fakeClient(live('fresh-token'));
  const { sync, tokens } = fakeSync(PROFILE);
  const result = await restoreSession({ stored: STORED, client, sync });
  assert.deepEqual(result, { kind: 'synced', mode: 'supabase', accessToken: 'fresh-token', userId: 'user-1', profile: PROFILE });
  assert.deepEqual(tokens, [undefined], 'api.ts picks the token, so it can renew it');
  assert.equal(calls.signOut.length, 0);
});

test('Supabase no longer has the session (signed out elsewhere, password changed): expired + Supabase sign-out on this phone', async () => {
  for (const errorName of [null, 'AuthApiError', 'AuthSessionMissingError']) {
    const { client, calls } = fakeClient(noSession(errorName));
    const { sync, tokens } = fakeSync(PROFILE);
    assert.deepEqual(await restoreSession({ stored: STORED, client, sync }), { kind: 'expired' }, String(errorName));
    assert.deepEqual(calls.signOut, [{ scope: 'local' }], String(errorName));
    assert.equal(tokens.length, 0, String(errorName));
  }
});

test('no network when the app opens (renewal could not reach Supabase): keep the saved profile, no sign-out', async () => {
  const { client, calls } = fakeClient(noSession('AuthRetryableFetchError'));
  const { sync, tokens } = fakeSync(PROFILE);
  assert.deepEqual(await restoreSession({ stored: STORED, client, sync }), { kind: 'cached', session: STORED });
  assert.equal(calls.signOut.length, 0);
  assert.equal(tokens.length, 0);
});

test('getSession() throws: keep the saved profile', async () => {
  const { client, calls } = fakeClient(() => { throw new Error('storage broken'); });
  const { sync } = fakeSync(PROFILE);
  assert.deepEqual(await restoreSession({ stored: STORED, client, sync }), { kind: 'cached', session: STORED });
  assert.equal(calls.signOut.length, 0);
});

test('API answers SESSION_EXPIRED: expired + Supabase sign-out on this phone', async () => {
  const { client, calls } = fakeClient(live('fresh-token'));
  const { sync } = fakeSync(apiError(401, 'SESSION_EXPIRED'));
  assert.deepEqual(await restoreSession({ stored: STORED, client, sync }), { kind: 'expired' });
  assert.deepEqual(calls.signOut, [{ scope: 'local' }]);
});

test('API unreachable or failing (no network, 500, 401 while Supabase is down): keep the saved profile with the current token', async () => {
  for (const error of [new TypeError('Network request failed'), apiError(500), apiError(401)]) {
    const { client, calls } = fakeClient(live('fresh-token'));
    const { sync } = fakeSync(error);
    assert.deepEqual(
      await restoreSession({ stored: STORED, client, sync }),
      { kind: 'cached', session: { ...STORED, accessToken: 'fresh-token' } },
      error.message,
    );
    assert.equal(calls.signOut.length, 0, error.message);
  }
});

test('Supabase session is now another account: the result carries the current user id, not the saved one', async () => {
  const { client } = fakeClient(live('fresh-token', 'someone-else'));
  const { sync } = fakeSync(PROFILE);
  const result = await restoreSession({ stored: STORED, client, sync });
  assert.equal(result.kind, 'synced');
  assert.equal(result.userId, 'someone-else');
  assert.equal(result.accessToken, 'fresh-token');
});

test('saved profile belongs to another account and the API fails: drop both, no notice', async () => {
  const { client, calls } = fakeClient(live('fresh-token', 'someone-else'));
  const { sync } = fakeSync(apiError(500));
  assert.deepEqual(await restoreSession({ stored: STORED, client, sync }), { kind: 'none' });
  assert.deepEqual(calls.signOut, [{ scope: 'local' }]);
});

test('dev login and "Supabase not set up": saved token is used as before, Supabase is not asked', async () => {
  const dev = { ...STORED, mode: 'dev', accessToken: 'dev|uuid|a@b.c', userId: 'uuid' };
  {
    const { client, calls } = fakeClient(live('fresh-token'));
    const { sync, tokens } = fakeSync(PROFILE);
    assert.deepEqual(await restoreSession({ stored: dev, client, sync }), { kind: 'synced', mode: 'dev', accessToken: 'dev|uuid|a@b.c', userId: 'uuid', profile: PROFILE });
    assert.deepEqual(tokens, ['dev|uuid|a@b.c']);
    assert.equal(calls.getSession, 0);
  }
  {
    const { sync, tokens } = fakeSync(PROFILE);
    assert.equal((await restoreSession({ stored: STORED, client: null, sync })).kind, 'synced');
    assert.deepEqual(tokens, ['saved-token']);
  }
  // As before, a failing sync signs out quietly (no "expired" notice for these modes).
  for (const stored of [dev, STORED]) {
    const { client } = fakeClient(live('fresh-token'));
    const { sync } = fakeSync(apiError(401));
    assert.deepEqual(await restoreSession({ stored, client: stored.mode === 'dev' ? client : null, sync }), { kind: 'none' });
  }
});

test('a failing Supabase sign-out does not change the result', async () => {
  const { client } = fakeClient(noSession('AuthApiError'));
  client.auth.signOut = async () => { throw new Error('offline'); };
  const { sync } = fakeSync(PROFILE);
  assert.deepEqual(await restoreSession({ stored: STORED, client, sync }), { kind: 'expired' });
});

// --- createSessionExpiry (handler api.ts calls) ---

function expiryHarness({ signedIn = true } = {}) {
  const log = [];
  const { client, calls } = fakeClient(live('t'));
  const state = { signedIn };
  const expire = createSessionExpiry({
    isSignedIn: () => state.signedIn,
    clearStored: async () => { log.push('clearStored'); },
    client: () => client,
    onExpired: () => { log.push('onExpired'); state.signedIn = false; },
  });
  return { expire, log, calls, state, client };
}

test('expiry while signed in: saved session cleared, Supabase signed out on this phone, notice shown', async () => {
  const { expire, log, calls } = expiryHarness();
  await expire();
  assert.deepEqual(log, ['clearStored', 'onExpired']);
  assert.deepEqual(calls.signOut, [{ scope: 'local' }]);
});

test('several requests expiring at once: the work is done once', async () => {
  const { expire, log, calls } = expiryHarness();
  await Promise.all([expire(), expire(), expire()]);
  assert.deepEqual(log, ['clearStored', 'onExpired']);
  assert.equal(calls.signOut.length, 1);
});

test('not signed in (guest, dev login, already expired): nothing happens', async () => {
  const { expire, log, calls } = expiryHarness({ signedIn: false });
  await expire();
  assert.deepEqual(log, []);
  assert.equal(calls.signOut.length, 0);
});

test('a later expiry after signing in again works again (not stuck after the first one)', async () => {
  const { expire, log, state } = expiryHarness();
  await expire();
  state.signedIn = true; // user signed in again
  await expire();
  assert.deepEqual(log, ['clearStored', 'onExpired', 'clearStored', 'onExpired']);
});

test('errors inside the handler never reach api.ts, and sign-out and the notice still happen', async () => {
  const log = [];
  const expire = createSessionExpiry({
    isSignedIn: () => true,
    clearStored: async () => { throw new Error('storage broken'); },
    client: () => ({ auth: { signOut: async (options) => { log.push(`signOut:${options.scope}`); throw new Error('offline'); } } }),
    onExpired: () => { log.push('onExpired'); },
  });
  await expire();
  assert.deepEqual(log, ['signOut:local', 'onExpired']);

  const throwing = createSessionExpiry({
    isSignedIn: () => true,
    clearStored: async () => {},
    client: () => null,
    onExpired: () => { throw new Error('render bug'); },
  });
  await throwing(); // must not reject
});
