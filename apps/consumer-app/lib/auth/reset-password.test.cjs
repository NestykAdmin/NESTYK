const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const ts = require('typescript');

/** Loads a lib/auth file bare; only ./auth-error (itself import-free) may be imported. */
function load(file) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)((id) => {
    if (id === './auth-error') return load('auth-error.ts');
    throw new Error(`unexpected import ${id}`);
  }, mod, mod.exports);
  return mod.exports;
}
const mod = { exports: load('reset-password.ts') };
const { requestPasswordReset, verifyRecoveryLink, recoveryTokenHash, saveResetPassword, RECOVERY_SESSION_MISSING } = mod.exports;
const { signInErrorKind } = load('auth-error.ts');

function client(overrides = {}) {
  const calls = [];
  return {
    calls,
    auth: {
      resetPasswordForEmail: async (email, options) => { calls.push(['request', email, options ?? null]); return { error: overrides.requestError ?? null }; },
      verifyOtp: async (args) => { calls.push(['verify', args]); return { data: { session: overrides.session === false ? null : { access_token: 'tok' } }, error: overrides.verifyError ?? null }; },
      updateUser: async (args) => { calls.push(['update', args]); return { error: overrides.updateError ?? null }; },
      signOut: async (args) => { calls.push(['sign-out', args]); },
    },
  };
}

test('requesting a reset sends the trimmed lowercase email and does not say whether the account exists', async () => {
  const auth = client();
  await requestPasswordReset(auth, '  Jom@Nestyk.com ');
  assert.deepEqual(auth.calls, [['request', 'jom@nestyk.com', null]]);
});

test('a reset link opens the new-password page', async () => {
  const auth = client();
  await requestPasswordReset(auth, 'jom@nestyk.com', undefined, 'http://127.0.0.1:8081/reset-password');
  assert.deepEqual(auth.calls, [['request', 'jom@nestyk.com', { redirectTo: 'http://127.0.0.1:8081/reset-password' }]]);
});

test('the email link is recognized as a recovery landing', () => {
  const { isRecoveryLanding } = mod.exports;
  assert.equal(isRecoveryLanding('http://127.0.0.1:8081/reset-password#access_token=abc&type=recovery'), true);
  assert.equal(isRecoveryLanding('http://127.0.0.1:8081/reset-password?code=abc'), true);
  assert.equal(isRecoveryLanding('http://127.0.0.1:8081/reset-password'), false);
});

test('the token_hash link is a recovery landing, and its token is read only for recovery', () => {
  const { isRecoveryLanding } = mod.exports;
  const link = 'https://app.nestyk.com/reset-password?token_hash=pkce_abc123&type=recovery';
  assert.equal(isRecoveryLanding(link), true);
  assert.equal(recoveryTokenHash(link), 'pkce_abc123');
  assert.equal(recoveryTokenHash('https://app.nestyk.com/reset-password?token_hash=abc&type=signup'), null);
  assert.equal(recoveryTokenHash('https://app.nestyk.com/reset-password?code=abc'), null);
  assert.equal(recoveryTokenHash('https://app.nestyk.com/reset-password?token_hash=&type=recovery'), null);
  assert.equal(recoveryTokenHash(''), null);
});

test('a reset link is checked with its token hash alone, so no saved PKCE verifier is needed', async () => {
  const auth = client();
  await verifyRecoveryLink(auth, 'abc123');
  assert.deepEqual(auth.calls, [['verify', { token_hash: 'abc123', type: 'recovery' }]]);
});

test('a used or expired reset link is rejected and sets no password', async () => {
  const auth = client({ verifyError: { message: 'Email link is invalid or has expired' } });
  await assert.rejects(() => verifyRecoveryLink(auth, 'used'), /invalid or has expired/);
  const noSession = client({ session: false });
  await assert.rejects(() => verifyRecoveryLink(noSession, 'abc'));
  assert.deepEqual(auth.calls.map((call) => call[0]), ['verify']);
});

test('a reset request includes the captcha token when one was solved', async () => {
  const auth = client();
  await requestPasswordReset(auth, 'jom@nestyk.com', 'captcha-token');
  assert.deepEqual(auth.calls, [['request', 'jom@nestyk.com', { captchaToken: 'captcha-token' }]]);
});

test('the 6-digit recovery code path is gone (the email link replaced it, Mos 4 Nov 2026)', () => {
  assert.equal(mod.exports.verifyRecoveryCode, undefined);
});

test('saving a new password signs the other devices out', async () => {
  const auth = client();
  await saveResetPassword(auth, 'Abcdefg1');
  assert.deepEqual(auth.calls, [
    ['update', { password: 'Abcdefg1' }],
    ['sign-out', { scope: 'others' }],
  ]);
});

test('a rejected new password does not sign anyone out', async () => {
  const auth = client({ updateError: { message: 'Password is too weak' } });
  await assert.rejects(() => saveResetPassword(auth, 'weak'));
  assert.deepEqual(auth.calls.map((call) => call[0]), ['update']);
});

test('no reset session (a link without a token, a bad ?code=) is reported as RECOVERY_SESSION_MISSING, not shown raw', async () => {
  const missing = client({ updateError: { name: 'AuthSessionMissingError', message: 'Auth session missing!' } });
  await assert.rejects(() => saveResetPassword(missing, 'Abcdefg1'), (e) => e.code === RECOVERY_SESSION_MISSING);
  assert.deepEqual(missing.calls.map((call) => call[0]), ['update'], 'nobody is signed out');
  const weak = client({ updateError: { message: 'Password is too weak' } });
  await assert.rejects(() => saveResetPassword(weak, 'weak'), (e) => e.code === undefined && e.message === 'Password is too weak');
});

test('QA 4 Nov 2026 item 4: "?type=recovery" alone is not a reset link; it is a broken one', () => {
  const { isRecoveryLanding, brokenRecoveryLanding } = mod.exports;
  const base = 'http://localhost:8081/reset-password';
  for (const bad of [`${base}?type=recovery`, `${base}#type=recovery`, `${base}?token_hash=&type=recovery`]) {
    assert.equal(isRecoveryLanding(bad), false, bad);
    assert.equal(brokenRecoveryLanding(bad), true, bad);
  }
  for (const good of [`${base}?token_hash=abc&type=recovery`, `${base}?code=abc`, `${base}#access_token=abc&type=recovery`]) {
    assert.equal(isRecoveryLanding(good), true, good);
    assert.equal(brokenRecoveryLanding(good), false, good);
  }
  assert.equal(brokenRecoveryLanding(base), false, 'the plain forgot-password page is not a link at all');
  assert.equal(brokenRecoveryLanding(''), false);
});

// QA Aof 10 Nov 2026 (item 5, B1-B3): the forgot-password page showed the general text for 429 and a dropped
// connection, because both calls re-threw `new Error(error.message)` and lost Supabase's name, status and code.
/** An error as supabase-js returns it in `{ error }`. */
const supabaseError = (name, status, code, message) => ({ name, status, code, message });
const failures = [
  ['too many emails (429)', supabaseError('AuthApiError', 429, 'over_email_send_rate_limit', 'email rate limit exceeded'), 'rateLimited'],
  ['too many requests (429, no code)', supabaseError('AuthApiError', 429, undefined, 'Too Many Requests'), 'rateLimited'],
  ['Supabase unreachable', supabaseError('AuthRetryableFetchError', 0, undefined, 'Failed to fetch'), 'network'],
  ['Supabase 503', supabaseError('AuthRetryableFetchError', 503, undefined, 'Service Unavailable'), 'network'],
  ['same password as before', supabaseError('AuthApiError', 422, 'same_password', 'New password should be different from the old password.'), 'generic'],
];

for (const [name, error, kind] of failures) {
  test(`QA Aof 10 Nov 2026: sending the reset link, ${name} -> ${kind}`, async () => {
    const thrown = await requestPasswordReset(client({ requestError: error }), 'jom@nestyk.com').then(() => null, (e) => e);
    assert.ok(thrown instanceof Error);
    assert.equal(signInErrorKind(thrown), kind);
    assert.equal(thrown.message, error.message, 'message kept for logs');
  });

  test(`QA Aof 10 Nov 2026: saving the new password, ${name} -> ${kind}`, async () => {
    const auth = client({ updateError: error });
    const thrown = await saveResetPassword(auth, 'Abcdefg1').then(() => null, (e) => e);
    assert.ok(thrown instanceof Error);
    assert.equal(signInErrorKind(thrown), kind);
    assert.notEqual(thrown.code, RECOVERY_SESSION_MISSING);
    assert.deepEqual(auth.calls.map((c) => c[0]), ['update'], 'a failed save signs no one out');
  });
}

test('QA Aof 10 Nov 2026: no reset session still throws RECOVERY_SESSION_MISSING with Supabase\'s name kept', async () => {
  const thrown = await saveResetPassword(client({ updateError: supabaseError('AuthSessionMissingError', 400, undefined, 'Auth session missing!') }), 'Abcdefg1').then(() => null, (e) => e);
  assert.equal(thrown.code, RECOVERY_SESSION_MISSING);
  assert.equal(thrown.name, 'AuthSessionMissingError');
});
