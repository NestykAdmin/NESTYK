const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = path.join(__dirname, '..', 'app');
const read = (...parts) => fs.readFileSync(path.join(app, ...parts), 'utf8');

test('the guest web uses the shared cookie panel (design B, Mos 11-12 Nov 2026)', () => {
  const shell = read('components', 'guest', 'GuestShell.tsx');
  assert.match(shell, /from '@nestyk\/ui\/cookie-consent-panel'/);
  assert.match(shell, /import '@nestyk\/ui\/cookie-consent\.css';/);
  assert.match(shell, /<CookieConsentPanel[\s\S]*site="guest"/);
  assert.doesNotMatch(shell, /GuestCookieBar/);
});

test('guest colours for the panel come from guest tokens, and the old bar styles are gone', () => {
  const css = read('[locale]', 'guest.css');
  assert.doesNotMatch(css, /\.nk-cookie/);
  for (const name of ['--ck-ink', '--ck-surface', '--ck-text', '--ck-muted', '--ck-border', '--ck-accent']) {
    assert.match(css, new RegExp(`${name}: var\\(--nk-`), name);
  }
  assert.match(css, /--ck-reserve/, 'the page keeps room for the docked panel on phones');
});
