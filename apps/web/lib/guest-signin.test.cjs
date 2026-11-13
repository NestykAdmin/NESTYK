const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const guest = path.join(__dirname, '..', 'app', 'components', 'guest');
const read = (file) => fs.readFileSync(file, 'utf8');

test('the heart opens a sign-in prompt instead of leaving the page (Mos 11 Nov 2026, replaces H3)', () => {
  const heart = read(path.join(guest, 'FavoriteButton.tsx'));
  assert.match(heart, /<button[^>]*type="button"/);
  assert.match(heart, /aria-haspopup="dialog"/);
  assert.doesNotMatch(heart, /href=\{guestAccountUrl/, 'no direct link to the sign-in page');
  assert.match(heart, /<SignInPrompt/);
});

test('the sign-in prompt is an accessible dialog with sign in, register and "not now"', () => {
  const prompt = read(path.join(guest, 'SignInPrompt.tsx'));
  assert.match(prompt, /role="dialog"/);
  assert.match(prompt, /aria-modal="true"/);
  assert.match(prompt, /aria-labelledby=/);
  assert.match(prompt, /'Escape'/, 'Esc closes it');
  assert.match(prompt, /<AccountLink[^>]*page="signIn"/);
  assert.match(prompt, /<AccountLink[^>]*page="register"/);
  assert.match(prompt, /\.later\b/);
  assert.match(prompt, /focus\(\)/, 'focus moves into the dialog and back');
});

test('saved rooms ask the guest to sign in first, with both account links', () => {
  const page = read(path.join(__dirname, '..', 'app', '[locale]', '(marketplace)', 'saved', 'page.tsx'));
  assert.match(page, /gateTitle/);
  assert.match(page, /gateBody/);
  assert.match(page, /<AccountLink[^>]*page="signIn"/);
  assert.match(page, /<AccountLink[^>]*page="register"/);
});

test('every sign-in / sign-up link on the guest web goes through AccountLink, which adds ?next= (AUTH-1.4)', () => {
  const app = path.join(__dirname, '..', 'app');
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) files.push(full);
    }
  };
  walk(app);
  const plain = files.filter((file) => /guestAccountUrl\('(signIn|register)'\)/.test(read(file)) && !file.endsWith('AccountLink.tsx'));
  assert.deepEqual(plain.map((file) => path.relative(app, file)), []);
  // AUTH-2: the header's sign-in button lives in AccountMenu (signed-out state).
  const header = read(path.join(guest, 'AccountMenu.tsx'));
  assert.match(header, /<AccountLink[^>]*page="signIn"/);
  // AUTH-2: the profile page's sign-in card moved into ProfileAccount (signed-out state).
  const profile = read(path.join(guest, 'ProfileAccount.tsx'));
  assert.match(profile, /<AccountLink[^>]*page="signIn"/);
  assert.match(profile, /<AccountLink[^>]*page="register"/);
});

test('AccountLink reads the current page in the browser, also right before the click (search filters change the URL in place)', () => {
  const link = read(path.join(guest, 'AccountLink.tsx'));
  assert.match(link, /^'use client';/);
  assert.match(link, /accountUrlWithNext\(/);
  assert.match(link, /window\.location\.pathname \+ window\.location\.search/);
  assert.match(link, /onClick=/);
  assert.match(link, /usePathname\(/, 'refreshes after client-side page changes');
});

test('next.config.js tells the browser bundle when the account web is on this same site', () => {
  const config = read(path.join(__dirname, '..', 'next.config.js'));
  assert.match(config, /NEXT_PUBLIC_ACCOUNT_SAME_SITE: ACCOUNT_WEB_UPSTREAM \? '1' : ''/);
});
