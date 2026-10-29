const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const ts = require('typescript');

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, 'google-oauth.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', source)(() => { throw new Error('unexpected import'); }, mod, mod.exports);
const { providerRedirectPending, redirectParams, startGoogleOAuth } = mod.exports;

test('a provider return is recognized from the code or the token, and a normal page is not', () => {
  assert.equal(providerRedirectPending(null), false);
  assert.equal(providerRedirectPending('http://localhost:8081/'), false);
  assert.equal(providerRedirectPending('http://localhost:8081/?code=abc'), true);
  assert.equal(providerRedirectPending('nestyk://auth#access_token=tok&refresh_token=ref'), true);
  assert.equal(providerRedirectPending('http://localhost:8081/?error=access_denied'), true);
});

test('web Google sign-in redirects without opening a second browser or creating a password', async () => {
  const calls = [];
  const supabase = { auth: {
    signInWithOAuth: async (args) => { calls.push(args); return { data: { url: 'https://accounts.google.com' }, error: null }; },
  } };
  const opened = [];
  const session = await startGoogleOAuth(supabase, {
    platform: 'web',
    redirectTo: 'http://localhost:8081',
    openAuthSession: async (url) => { opened.push(url); return { type: 'success', url }; },
  });
  assert.equal(session, null);
  assert.deepEqual(opened, []);
  assert.equal(calls[0].provider, 'google');
  assert.equal(calls[0].options.redirectTo, 'http://localhost:8081');
  assert.equal(calls[0].options.skipBrowserRedirect, false);
  assert.equal(calls[0].options.password, undefined);
});

test('Facebook sign-in asks Supabase for the facebook provider and stores no password', async () => {
  const calls = [];
  const supabase = { auth: {
    signInWithOAuth: async (args) => { calls.push(args); return { data: { url: 'https://www.facebook.com' }, error: null }; },
  } };
  const session = await startGoogleOAuth(supabase, {
    platform: 'web',
    redirectTo: 'http://localhost:8081',
    provider: 'facebook',
    openAuthSession: async () => { throw new Error('web should not open a browser'); },
  });
  assert.equal(session, null);
  assert.equal(calls[0].provider, 'facebook');
  assert.equal(calls[0].options.redirectTo, 'http://localhost:8081');
  assert.equal(calls[0].options.skipBrowserRedirect, false);
  assert.equal(calls[0].options.password, undefined);
});

test('native Google sign-in exchanges the code and stores no password', async () => {
  const calls = [];
  const supabase = { auth: {
    signInWithOAuth: async (args) => { calls.push(['start', args]); return { data: { url: 'https://accounts.google.com/start' }, error: null }; },
    exchangeCodeForSession: async (code) => { calls.push(['code', code]); return { data: { session: { access_token: 'tok', user: { id: 'user-1' } } }, error: null }; },
  } };
  const session = await startGoogleOAuth(supabase, {
    platform: 'native',
    redirectTo: 'nestyk://auth',
    openAuthSession: async (url, redirectTo) => {
      calls.push(['open', url, redirectTo]);
      return { type: 'success', url: 'nestyk://auth?code=auth-code' };
    },
  });
  assert.deepEqual(session, { access_token: 'tok', user: { id: 'user-1' } });
  assert.deepEqual(calls[0][1].options, { redirectTo: 'nestyk://auth', skipBrowserRedirect: true });
  assert.deepEqual(calls[2], ['code', 'auth-code']);
  assert.equal(redirectParams('nestyk://auth?code=auth-code').code, 'auth-code');
});

test('closing the Google browser does not create a session', async () => {
  const supabase = { auth: {
    signInWithOAuth: async () => ({ data: { url: 'https://accounts.google.com/start' }, error: null }),
    exchangeCodeForSession: async () => { throw new Error('should not exchange'); },
  } };
  const session = await startGoogleOAuth(supabase, {
    platform: 'native',
    redirectTo: 'nestyk://auth',
    openAuthSession: async () => ({ type: 'cancel' }),
  });
  assert.equal(session, null);
});
