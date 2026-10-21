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
/**
 * Loads api.ts with a fake saved session (`stored`) and a fake Supabase client.
 * `live` is the session Supabase returns from getSession(); `refresh` is what refreshSession() returns.
 */
function makeApi({ stored = { mode: 'supabase', accessToken: 'stale-token' }, configured = true, live = null, refresh } = {}) {
  const calls = { getSession: 0, refreshSession: 0 };
  const client = {
    auth: {
      getSession: async () => { calls.getSession += 1; return { data: { session: live }, error: null }; },
      refreshSession: async () => {
        calls.refreshSession += 1;
        return refresh ?? { data: { session: null }, error: { name: 'AuthSessionMissingError' } };
      },
    },
  };
  const api = load('api.ts', {
    './config': { APP_CONFIG: { apiUrl: 'https://api.test' }, toDeviceUrls: (s) => s, toServerUrls: (s) => s },
    './dev-identity': { getOrCreateDevIdentity: async () => ({ uuid: 'u', email: 'e' }), toDevBearer: () => 'dev' },
    './auth/session-storage': { loadAuthSession: async () => stored },
    './auth/supabase': { getSupabaseClient: () => (configured ? client : null) },
  });
  return { api, calls };
}
const { api } = makeApi({ stored: { mode: 'supabase', accessToken: 'token' } });

/** Replaces fetch with a list of responses (one per call) and records what was sent. */
async function withFetch(responses, fn) {
  const realFetch = global.fetch;
  const sent = [];
  global.fetch = async (url, init) => {
    sent.push({ url, method: init.method, body: init.body, auth: init.headers.Authorization });
    const next = responses[sent.length - 1];
    if (!next) throw new Error(`unexpected fetch #${sent.length}`);
    return { ok: next.status < 400, status: next.status, text: async () => JSON.stringify(next.body ?? {}) };
  };
  try {
    await fn(sent);
  } finally {
    global.fetch = realFetch;
  }
}

const OK = { status: 200, body: { ok: true } };
const EXPIRED = { status: 401, body: { message: 'Invalid or expired token', error: 'Unauthorized', statusCode: 401 } };
const liveSession = (token) => ({ access_token: token });
const refreshed = (token) => ({ data: { session: liveSession(token) }, error: null });
const refreshFailed = (name) => ({ data: { session: null }, error: { name } });

test('API errors keep the status, the message and the machine-readable code from the body', async () => {
  const realFetch = global.fetch;
  try {
    global.fetch = async () => ({ ok: false, status: 400, text: async () => JSON.stringify({ code: 'BROKER_APPOINTMENT_REQUIRED', message: 'ห้องนี้ยังไม่มีสัญญาแต่งตั้งนายหน้าที่มีผล' }) });
    await assert.rejects(() => api.apiRequest('/agent/contracts', { method: 'POST', body: '{}' }), (e) =>
      e instanceof api.ApiError && e.status === 400 && e.code === 'BROKER_APPOINTMENT_REQUIRED' && e.message === 'ห้องนี้ยังไม่มีสัญญาแต่งตั้งนายหน้าที่มีผล');
    // A body without a code, or a non-JSON body, leaves the code empty.
    global.fetch = async () => ({ ok: false, status: 500, text: async () => 'Internal error' });
    await assert.rejects(() => api.apiRequest('/x'), (e) => e.status === 500 && e.code === undefined && e.message === 'Internal error');
  } finally {
    global.fetch = realFetch;
  }
});

// --- Session renewal (session-expired handling) ---

test('uses the current Supabase token, not the copy saved at sign-in', async () => {
  const { api, calls } = makeApi({ live: liveSession('live-token') });
  await withFetch([OK], async (sent) => {
    assert.deepEqual(await api.apiGet('/me'), { ok: true });
    assert.equal(sent[0].auth, 'Bearer live-token');
  });
  assert.equal(calls.getSession, 1);
});

test('dev login keeps its own token and never asks Supabase', async () => {
  const { api, calls } = makeApi({ stored: { mode: 'dev', accessToken: 'dev|uuid|a@b.c' }, live: liveSession('live-token') });
  await withFetch([OK], async (sent) => {
    await api.apiGet('/me');
    assert.equal(sent[0].auth, 'Bearer dev|uuid|a@b.c');
  });
  assert.deepEqual(calls, { getSession: 0, refreshSession: 0 });
});

test('401: renews the token once and sends the same request again', async () => {
  const { api, calls } = makeApi({ live: liveSession('old-token'), refresh: refreshed('new-token') });
  let expired = 0;
  api.setSessionExpiredHandler(() => { expired += 1; });
  await withFetch([EXPIRED, OK], async (sent) => {
    assert.deepEqual(await api.apiPost('/agent/leads', { name: 'A' }), { ok: true });
    assert.equal(sent.length, 2);
    assert.deepEqual(sent.map((r) => r.auth), ['Bearer old-token', 'Bearer new-token']);
    assert.deepEqual(sent.map((r) => r.method), ['POST', 'POST']);
    assert.equal(sent[1].body, sent[0].body, 'same body is sent again');
    assert.equal(sent[1].url, sent[0].url);
  });
  assert.equal(calls.refreshSession, 1);
  assert.equal(expired, 0);
});

test('401 and Supabase cannot renew (signed out elsewhere, password changed): session expired, no second request', async () => {
  for (const name of ['AuthApiError', 'AuthSessionMissingError']) {
    const { api } = makeApi({ live: null, refresh: refreshFailed(name) });
    let expired = 0;
    api.setSessionExpiredHandler(() => { expired += 1; });
    await withFetch([EXPIRED], async (sent) => {
      await assert.rejects(() => api.apiGet('/agent/leads'), (e) =>
        e instanceof api.ApiError && e.status === 401 && e.code === api.SESSION_EXPIRED);
      assert.equal(sent.length, 1);
      assert.equal(sent[0].auth, 'Bearer stale-token', 'falls back to the saved copy when Supabase has no session');
    });
    assert.equal(expired, 1, name);
  }
});

test('401 again with a freshly renewed token (account removed on the API side): session expired', async () => {
  const { api } = makeApi({ live: liveSession('old-token'), refresh: refreshed('new-token') });
  let expired = 0;
  api.setSessionExpiredHandler(() => { expired += 1; });
  await withFetch([EXPIRED, EXPIRED], async (sent) => {
    await assert.rejects(() => api.apiGet('/agent/leads'), (e) => e.status === 401 && e.code === api.SESSION_EXPIRED);
    assert.equal(sent.length, 2);
  });
  assert.equal(expired, 1);
});

test('401 while Supabase cannot be reached: not treated as expired, user stays signed in', async () => {
  const { api } = makeApi({ live: liveSession('old-token'), refresh: refreshFailed('AuthRetryableFetchError') });
  let expired = 0;
  api.setSessionExpiredHandler(() => { expired += 1; });
  await withFetch([EXPIRED], async (sent) => {
    await assert.rejects(() => api.apiGet('/agent/leads'), (e) => e.status === 401 && e.code !== api.SESSION_EXPIRED);
    assert.equal(sent.length, 1);
  });
  assert.equal(expired, 0);
});

test('no renewal and no expiry notice for: a token passed in by the caller, a guest, dev login, or Supabase not set up', async () => {
  const cases = [
    { label: 'token passed in (sign-in / start-up sync)', setup: {}, call: (api) => api.apiPost('/auth/sync', {}, 'given-token'), auth: 'Bearer given-token' },
    { label: 'guest (nothing saved, no Supabase session)', setup: { stored: null }, call: (api) => api.apiGet('/x'), auth: 'Bearer dev' },
    { label: 'dev login', setup: { stored: { mode: 'dev', accessToken: 'dev|u|e' } }, call: (api) => api.apiGet('/x'), auth: 'Bearer dev|u|e' },
    { label: 'Supabase not configured', setup: { configured: false }, call: (api) => api.apiGet('/x'), auth: 'Bearer stale-token' },
  ];
  for (const c of cases) {
    const { api, calls } = makeApi({ refresh: refreshed('new-token'), ...c.setup });
    let expired = 0;
    api.setSessionExpiredHandler(() => { expired += 1; });
    await withFetch([EXPIRED], async (sent) => {
      await assert.rejects(() => c.call(api), (e) => e.status === 401 && e.code !== api.SESSION_EXPIRED, c.label);
      assert.equal(sent.length, 1, c.label);
      assert.equal(sent[0].auth, c.auth, c.label);
    });
    assert.equal(calls.refreshSession, 0, c.label);
    assert.equal(expired, 0, c.label);
  }
});

test('other errors (403, 404, 500) do not renew the token or sign the user out', async () => {
  for (const status of [403, 404, 500]) {
    const { api, calls } = makeApi({ live: liveSession('live-token'), refresh: refreshed('new-token') });
    let expired = 0;
    api.setSessionExpiredHandler(() => { expired += 1; });
    await withFetch([{ status, body: { message: 'nope' } }], async (sent) => {
      await assert.rejects(() => api.apiGet('/x'), (e) => e.status === status);
      assert.equal(sent.length, 1);
    });
    assert.equal(calls.refreshSession, 0, String(status));
    assert.equal(expired, 0, String(status));
  }
});

test('no handler registered: still throws SESSION_EXPIRED without crashing', async () => {
  const { api } = makeApi({ live: null, refresh: refreshFailed('AuthApiError') });
  api.setSessionExpiredHandler(null);
  await withFetch([EXPIRED], async () => {
    await assert.rejects(() => api.apiGet('/x'), (e) => e.code === api.SESSION_EXPIRED);
  });
});
