// Mos 9 Nov 2026: Google / Facebook / Apple show "coming soon" until EXPO_PUBLIC_ENABLE_SOCIAL_LOGIN=true
// (Apple always, no provider yet). Pressing still explains it (e2e/mobile login-form.spec.ts checks that notice).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../../..');
const login = fs.readFileSync(path.join(__dirname, '../../app/login.tsx'), 'utf8');

test('login: each social button knows if it is ready; not ready = faded, one "coming soon" line under the row, same label', () => {
  assert.match(login, /ready: socialLoginProvider\(provider, process\.env\.EXPO_PUBLIC_ENABLE_SOCIAL_LOGIN\) !== null,/);
  assert.match(login, /!ready && styles\.socialSoon/);
  assert.match(login, /accessibilityHint=\{ready \? undefined : copy\.socialComingSoon\}/);
  // Sign-in redesign (Mos 17 Nov 2026): one line for the whole row instead of one under each button.
  assert.match(login, /const anySocialSoon = socialProviders\.some\(\(\{ ready \}\) => !ready\);/);
  assert.match(login, /\{anySocialSoon \? \(\s*<Text[^>]*>\s*\{copy\.socialComingSoon\}\s*<\/Text>\s*\) : null\}/);
  assert.equal(login.match(/\{copy\.socialComingSoon\}/g).length, 1, 'one caption, not one per button');
  // The e2e test finds buttons by this label and expects the notice after a tap.
  assert.match(login, /accessibilityLabel=\{copy\.socialLogin\.replace\(\s*"\{provider\}",\s*provider,\s*\)\}/);
  assert.match(login, /setNotice\(copy\.unavailable\);/);
});

test('"coming soon" and "Sign up with Apple" exist in all four languages', () => {
  for (const lang of ['en', 'th', 'ja', 'zh']) {
    const s = fs.readFileSync(path.join(root, `packages/i18n/src/locales/${lang}.ts`), 'utf8');
    for (const key of ['socialComingSoon', 'registerWithApple']) assert.match(s, new RegExp(`\\n      ${key}: ['"][^'"]+['"],`), `${lang}.${key}`);
  }
  const types = fs.readFileSync(path.join(root, 'packages/i18n/src/types.ts'), 'utf8');
  for (const key of ['socialComingSoon', 'registerWithApple']) assert.match(types, new RegExp(`\\n      ${key}: string;`), key);
});
