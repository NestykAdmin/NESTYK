// QA 9 Nov 2026 (login network error + reply on the error cases): the login page shows only texts we wrote,
// picked by cause. Error shapes below are the ones Supabase (auth-js) and lib/api.ts really throw.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file) {
  const loaded = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('module', 'exports', 'require', source)(loaded, loaded.exports, (id) => {
    throw new Error(`Unexpected dependency: ${id}`);
  });
  return loaded.exports;
}
const { signInFailure, isInvalidCredentials, isInvalidOtp, signInErrorKind, authErrorText } = load('auth-error.ts');

/** Supabase refusing the password sign-in, as AuthContext.signIn throws it. */
const supabase = (name, status, code, message) => signInFailure({ name, status, code, message });
/** lib/api.ts ApiError from POST /auth/sync. */
const api = (status, message, code) => Object.assign(new Error(message), { name: 'ApiError', status, ...(code ? { code } : {}) });

/** The login page's mapping: one text of ours per kind, never the error's own message. */
const TEXT = { invalidCredentials: 'WRONG', network: 'NETWORK', emailNotConfirmed: 'VERIFY', rateLimited: 'WAIT', generic: 'GENERIC' };
const loginText = (error) => TEXT[signInErrorKind(error)];

const CASES = [
  ['3 wrong email or password', supabase('AuthApiError', 400, 'invalid_credentials', 'Invalid login credentials'), 'invalidCredentials'],
  ['16 dev login refusal', new Error('Invalid email or password'), 'invalidCredentials'],
  ['4 email not confirmed', supabase('AuthApiError', 400, 'email_not_confirmed', 'Email not confirmed'), 'emailNotConfirmed'],
  ['5 captcha failed', supabase('AuthApiError', 400, 'captcha_failed', 'captcha protection: request disallowed (timeout-or-duplicate)'), 'generic'],
  ['6 too many attempts', supabase('AuthApiError', 429, 'over_request_rate_limit', 'Request rate limit reached'), 'rateLimited'],
  ['7 banned', supabase('AuthApiError', 400, 'user_banned', 'User is banned'), 'generic'],
  ['8 bad email format', supabase('AuthApiError', 400, 'validation_failed', 'Unable to validate email address: invalid format'), 'generic'],
  ['9 Supabase unreachable', supabase('AuthRetryableFetchError', 0, undefined, 'Failed to fetch'), 'network'],
  ['9 Supabase 503', supabase('AuthRetryableFetchError', 503, undefined, 'Service Unavailable'), 'network'],
  ['10 no session', signInFailure(null), 'generic'],
  ['11 API not answering', api(0, 'Failed to fetch', 'NETWORK_ERROR'), 'network'],
  ['12 proxy 502 page', api(502, '<!DOCTYPE html><title>Application failed to respond</title>'), 'network'],
  ['13 API refuses the token', api(401, 'Invalid or expired token', 'SESSION_EXPIRED'), 'generic'],
  ['14 seed data missing', api(400, 'master_roles.guest is missing — run npm run db:push and db:seed masters'), 'generic'],
  ['15 user missing after sync', api(404, 'User not found after sync'), 'generic'],
  ['bare fetch TypeError', new TypeError('Failed to fetch'), 'network'],
  ['not an Error', 'boom', 'generic'],
];

for (const [name, error, kind] of CASES) {
  test(`login case ${name} → ${kind}`, () => {
    assert.equal(signInErrorKind(error), kind);
  });
}

test('the login page never shows a raw Supabase or API message', () => {
  const ours = new Set(Object.values(TEXT));
  for (const [, error] of CASES) assert.ok(ours.has(loginText(error)), String(error && error.message));
});

test('signInFailure keeps Supabase\'s message, name, status and code', () => {
  const error = supabase('AuthApiError', 400, 'invalid_credentials', 'Invalid login credentials');
  assert.equal(error.message, 'Invalid login credentials');
  assert.equal(error.name, 'AuthApiError');
  assert.equal(error.status, 400);
  assert.equal(error.code, 'invalid_credentials');
  assert.equal(signInFailure(null).message, 'Sign in failed');
  assert.equal(isInvalidCredentials(error), true);
  assert.equal(isInvalidCredentials(api(0, 'Failed to fetch', 'NETWORK_ERROR')), false);
});

test('only an invalid or expired code counts as a wrong sign-up code', () => {
  assert.equal(isInvalidOtp({ name: 'AuthApiError', message: 'Token has expired or is invalid', status: 403, code: 'otp_expired' }), true);
  assert.equal(isInvalidOtp(Object.assign(new Error('Failed to fetch'), { code: 'NETWORK_ERROR' })), false);
  assert.equal(isInvalidOtp(new Error('')), false);
});

// QA reply item 3 (9 Nov 2026): sign-up and reset password use the same rule as login.
const AUTH_TEXTS = { network: 'NETWORK', rateLimited: 'WAIT', fallback: 'FALLBACK' };
const AUTH_CASES = [
  ['captcha failed', supabase('AuthApiError', 400, 'captcha_failed', 'captcha protection: request disallowed (timeout-or-duplicate)'), 'FALLBACK'],
  ['sign-up closed', supabase('AuthApiError', 422, 'signup_disabled', 'Signups not allowed for this instance'), 'FALLBACK'],
  ['too many emails sent', supabase('AuthApiError', 429, 'over_email_send_rate_limit', 'email rate limit exceeded'), 'WAIT'],
  ['new password same as old', supabase('AuthApiError', 422, 'same_password', 'New password should be different from the old password.'), 'FALLBACK'],
  ['Supabase unreachable', supabase('AuthRetryableFetchError', 0, undefined, 'Failed to fetch'), 'NETWORK'],
  ['profile sync not answering', api(0, 'Failed to fetch', 'NETWORK_ERROR'), 'NETWORK'],
  ['profile sync proxy 502 page', api(502, '<!DOCTYPE html><title>Application failed to respond</title>'), 'NETWORK'],
  ['profile sync seed data missing', api(400, 'master_roles.guest is missing — run npm run db:push and db:seed masters'), 'FALLBACK'],
  ['profile sync user missing', api(404, 'User not found after sync'), 'FALLBACK'],
  ['empty error', new Error(), 'FALLBACK'],
];
for (const [name, error, text] of AUTH_CASES) {
  test(`sign-up / reset password: ${name} → ${text}`, () => {
    assert.equal(authErrorText(error, AUTH_TEXTS), text);
  });
}
