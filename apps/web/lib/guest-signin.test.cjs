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
  assert.match(prompt, /guestAccountUrl\('signIn'\)/);
  assert.match(prompt, /guestAccountUrl\('register'\)/);
  assert.match(prompt, /\.later\b/);
  assert.match(prompt, /focus\(\)/, 'focus moves into the dialog and back');
});

test('saved rooms ask the guest to sign in first, with both account links', () => {
  const page = read(path.join(__dirname, '..', 'app', '[locale]', '(marketplace)', 'saved', 'page.tsx'));
  assert.match(page, /gateTitle/);
  assert.match(page, /gateBody/);
  assert.match(page, /guestAccountUrl\('signIn'\)/);
  assert.match(page, /guestAccountUrl\('register'\)/);
});
