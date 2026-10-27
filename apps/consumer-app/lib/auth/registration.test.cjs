const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

function setup({ confirmation = false, signupError, syncError, testSignupError, development = true } = {}) {
  const calls = { signup: [], sync: [], saved: [], signout: [], testSignup: [] };
  const credentials = { firstName: 'Mary Ann', lastName: 'Van Buren', email: `${randomUUID()}@example.test`, password: randomBytes(16).toString('hex') };
  const user = { id: randomUUID() };
  const session = { access_token: randomBytes(24).toString('hex') };
  const profile = { id: 1, email: credentials.email, firstName: credentials.firstName, lastName: credentials.lastName, roles: ['guest', 'tenant', 'landlord', 'agent', 'admin'] };
  const supabase = { auth: {
    signUp: async body => { calls.signup.push(body); return { data: { user, session: confirmation ? null : session }, error: signupError ?? null }; },
    signInWithPassword: async () => ({ data: { user, session }, error: null }),
    signOut: async options => { calls.signout.push(options); },
  } };
  const deps = {
    react: { ...React, useState: value => [value, () => {}], useRef: current => ({ current }), useEffect() {}, useMemo: fn => fn(), useCallback: fn => fn },
    '../api': { apiPost: async (route, body) => {
      if (route === '/auth/dev/register') {
        calls.testSignup.push(body);
        if (testSignupError) throw testSignupError;
        return { created: true };
      }
      calls.sync.push(route); if (syncError) throw syncError; return profile;
    }, setSessionExpiredHandler() {} },
    './dev-auth': { DEV_AUTH_CONFIG: { enabled: false } },
    './session-expiry': {},
    './supabase': { getSupabaseClient: () => supabase, isSupabaseConfigured: () => true },
    './session-storage': { saveAuthSession: async next => calls.saved.push(next), displayNameFrom: () => '', initialsFromName: () => '' },
  };
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, 'AuthContext.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', '__DEV__', source)(id => { if (!(id in deps)) throw new Error(id); return deps[id]; }, mod, mod.exports, development);
  return { auth: mod.exports.AuthProvider({ children: null }).props.value, credentials, calls };
}

test('signup uses real Supabase flow with normalized email and a registration source, then loads permissions', async () => {
  const { auth, credentials, calls } = setup();
  const result = await auth.signUp(`  ${credentials.email.toUpperCase()}  `, credentials.password, ` ${credentials.firstName} `, ` ${credentials.lastName} `);
  assert.equal(result.needsEmailConfirmation, false);
  assert.equal(calls.signup[0].email, credentials.email);
  assert.equal(calls.signup[0].password, credentials.password);
  assert.deepEqual(calls.signup[0].options.data, {
    first_name: credentials.firstName, last_name: credentials.lastName,
    full_name: `${credentials.firstName} ${credentials.lastName}`, registration_source: 'self_service',
  });
  assert.deepEqual(calls.sync, ['/auth/sync']);
  assert.equal(calls.saved.length, 1);
  assert.equal(calls.saved[0].roles.length, 5);
});

test('email confirmation required: no API profile or application session is created yet', async () => {
  const { auth, credentials, calls } = setup({ confirmation: true });
  assert.equal((await auth.signUp(credentials.email, credentials.password, credentials.firstName, credentials.lastName)).needsEmailConfirmation, true);
  assert.deepEqual(calls.sync, []);
  assert.deepEqual(calls.saved, []);
});

test('Supabase rejection is propagated without creating an app session', async () => {
  const error = new Error('Registration rejected');
  const { auth, credentials, calls } = setup({ signupError: error });
  await assert.rejects(auth.signUp(credentials.email, credentials.password, credentials.firstName, credentials.lastName), error);
  assert.equal(calls.saved.length, 0);
});

test('API provisioning failure undoes the Supabase login and does not leave an app session', async () => {
  const error = new Error('Profile unavailable');
  const { auth, credentials, calls } = setup({ syncError: error });
  await assert.rejects(auth.signUp(credentials.email, credentials.password, credentials.firstName, credentials.lastName), error);
  assert.equal(calls.saved.length, 0);
  assert.ok(calls.signout.some(options => options?.scope === 'local'));
});

test('test signup calls the backend, skips Supabase signup email, and uses normal Supabase login and profile sync', async () => {
  const { auth, credentials: c, calls } = setup({ confirmation: true });
  const result = await auth.signUp(` ${c.email.toUpperCase()} `, c.password, ` ${c.firstName} `, ` ${c.lastName} `, true);
  assert.equal(result.needsEmailConfirmation, false);
  assert.deepEqual(calls.testSignup, [{ email: c.email, password: c.password, firstName: c.firstName, lastName: c.lastName }]);
  assert.deepEqual(calls.signup, []);
  assert.deepEqual(calls.sync, ['/auth/sync']);
  assert.equal(calls.saved.length, 1);
});

test('a disabled test endpoint does not fall back to normal signup or save a session', async () => {
  const error = Object.assign(new Error('Unavailable'), { code: 'TEST_REGISTRATION_UNAVAILABLE' });
  const { auth, credentials: c, calls } = setup({ testSignupError: error });
  await assert.rejects(auth.signUp(c.email, c.password, c.firstName, c.lastName, true), error);
  assert.deepEqual(calls.signup, []);
  assert.deepEqual(calls.sync, []);
  assert.deepEqual(calls.saved, []);
});

test('a production client refuses a requested test signup before making requests', async () => {
  const { auth, credentials: c, calls } = setup({ development: false });
  await assert.rejects(auth.signUp(c.email, c.password, c.firstName, c.lastName, true), e => e.code === 'TEST_REGISTRATION_UNAVAILABLE');
  assert.deepEqual(calls.testSignup, []);
  assert.deepEqual(calls.signup, []);
  assert.deepEqual(calls.saved, []);
});
