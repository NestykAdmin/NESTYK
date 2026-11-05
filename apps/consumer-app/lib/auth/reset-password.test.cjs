const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const ts = require('typescript');

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, 'reset-password.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', source)(() => { throw new Error('unexpected import'); }, mod, mod.exports);
const { requestPasswordReset, verifyRecoveryLink, recoveryTokenHash, saveResetPassword, RECOVERY_SESSION_MISSING } = mod.exports;

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
  await requestPasswordReset(auth, 'jom@nestyk.com', 'hcaptcha-token');
  assert.deepEqual(auth.calls, [['request', 'jom@nestyk.com', { captchaToken: 'hcaptcha-token' }]]);
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
