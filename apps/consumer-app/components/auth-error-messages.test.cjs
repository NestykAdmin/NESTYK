// QA 9 Nov 2026 (login network error): the sign-in screens pick the wrong-password / wrong-code text only for that cause.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const login = read('../app/login.tsx');
const register = read('../app/register.tsx');
const reset = read('../app/reset-password.tsx');
const auth = read('../lib/auth/AuthContext.tsx');

test('signIn keeps Supabase\'s error code instead of a bare message', () => {
  const signIn = auth.match(/const signIn = useCallback\([\s\S]*?\[finishSupabaseSession\]/)[0];
  assert.match(signIn, /throw signInFailure\(error\)/);
  assert.doesNotMatch(signIn, /throw new Error\(error\?\.message/);
});

test('login picks one of our texts by cause and never passes a raw message through', () => {
  const submit = login.match(/const onSubmit = async \(\) => \{[\s\S]*?finally \{/)[0];
  assert.match(submit, /signInErrorKind\(e\)/);
  assert.doesNotMatch(submit, /localizedError\(e/);
  for (const text of ['t.mobile.auth.invalidCredentials', 't.mobile.auth.networkError', 't.mobile.auth.emailNotConfirmed', 't.mobile.auth.tooManyAttempts', 't.common.errorGeneric']) {
    assert.ok(login.includes(text), text);
  }
});

test('the three new login texts exist in all four languages and in the types', () => {
  const i18n = (p) => fs.readFileSync(path.join(__dirname, '../../../packages/i18n/src', p), 'utf8');
  for (const key of ['networkError', 'emailNotConfirmed', 'tooManyAttempts']) {
    for (const lang of ['th', 'en', 'zh', 'ja']) {
      assert.match(i18n(`locales/${lang}.ts`), new RegExp(`\\n\\s+${key}: (?:'(?:[^'\\\\]|\\\\.){8,}'|"[^"]{8,}")`), `${lang}.${key}`);
    }
    assert.match(i18n('types.ts'), new RegExp(`\\n\\s+${key}: string;`), `types.${key}`);
  }
});

/** The register and reset password calls of authErrorText, with the given fallback text. */
const authText = (fallback) =>
  new RegExp(`authErrorText\\(e, \\{ network: t\\.mobile\\.auth\\.networkError, rateLimited: t\\.mobile\\.auth\\.tooManyAttempts, fallback: ${fallback.replace(/\./g, '\\.')} \\}\\)`, 'g');

test('sign-up shows only our texts (QA reply item 3); Google/Facebook buttons left as they are', () => {
  assert.equal((register.match(authText('copy.registrationFailed')) || []).length, 2, 'sign up + send code again');
  assert.match(register, new RegExp(`isInvalidOtp\\(e\\)\\s*\\?\\s*copy\\.otpInvalid\\s*:\\s*${authText('t.common.errorGeneric').source}`));
  const raw = register.match(/localizedError\(e/g) || [];
  assert.equal(raw.length, 1, 'only the social buttons (one shared catch since Mos 9 Nov 2026) still pass the message through');
  assert.equal((register.match(/\.catch\(\(e\) => setError\(localizedError\(e, copy\.registrationFailed, locale\)\)\)/g) || []).length, 1);
  assert.doesNotMatch(register, /localizedError\(e, copy\.otpInvalid/);
});

test('reset password shows only our texts and no sign-up text', () => {
  assert.doesNotMatch(reset, /registrationFailed/);
  assert.doesNotMatch(reset, /localizedError/);
  assert.equal((reset.match(authText('t.common.errorGeneric')) || []).length, 2, 'ask for the link + save the new password');
  assert.match(reset, /missing \? copy\.resetLinkInvalid : authErrorText\(e/);
});
