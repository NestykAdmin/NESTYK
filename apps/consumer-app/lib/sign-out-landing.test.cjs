// Sign out lands on the guest home on the web, the sign-in screen on mobile (Mos 4 Nov 2026).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const index = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.tsx'), 'utf8');

test('web sign out goes to "/", mobile keeps /login', () => {
  assert.match(index, /const AFTER_SIGN_OUT_PATH = Platform\.OS === 'web' \? '\/' : '\/login';/);
  const handler = index.slice(index.indexOf('const handleAuthAction'), index.indexOf('const handleSignOutEverywhere'));
  assert.equal((handler.match(/router\.replace\(AFTER_SIGN_OUT_PATH\)/g) || []).length, 2);
  assert.doesNotMatch(handler, /router\.replace\('\/login'\)/);
});
