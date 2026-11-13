// AUTH-3 UI (nestyk-auth3-saved-rooms-plan-20261113.md 2.3; Mos 13 Nov 2026: red filled heart, a toast after every
// press, a card unsaved on /saved stays until the page is left).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = path.join(__dirname, '..', 'app');
const guest = path.join(app, 'components', 'guest');
const read = (file) => fs.readFileSync(file, 'utf8');

test('the guest shell gives every page the saved rooms, inside the sign-in', () => {
  const shell = read(path.join(guest, 'GuestShell.tsx'));
  const session = shell.indexOf('<GuestSessionProvider>');
  const saved = shell.indexOf('<SavedRoomsProvider>');
  assert.ok(session >= 0 && saved > session, 'SavedRoomsProvider sits inside GuestSessionProvider');
  assert.ok(shell.indexOf('</SavedRoomsProvider>') < shell.indexOf('</GuestSessionProvider>'));
});

test('signed out, the heart still opens the sign-in prompt; signed in, it is a pressed/unpressed toggle', () => {
  const heart = read(path.join(guest, 'FavoriteButton.tsx'));
  assert.match(heart, /useSavedRooms\(\)/);
  assert.match(heart, /status === 'off'/, 'the prompt is for the signed-out case');
  assert.match(heart, /<SignInPrompt/);
  assert.match(heart, /aria-pressed=\{/);
  assert.match(heart, /aria-busy=\{/);
  assert.match(heart, /\.toggle\(roomId, event\.currentTarget\)/, 'the pressed heart gets the focus back from the toast');
  assert.match(heart, /unsaveLabel/, 'a saved heart says it will remove the room');
});

test('every room card tells its heart which room it is', () => {
  const card = read(path.join(guest, 'RoomCard.tsx'));
  assert.match(card, /<FavoriteButton[\s\S]*?roomId=\{card\.id\}/);
  assert.match(card, /unsaveLabel=\{fillTemplate\(copy\.card\.unsaveNamed/);
});

test('one toast after every press: polite, pauses while hovered or focused, and names the 200-room limit', () => {
  const saved = read(path.join(guest, 'SavedRooms.tsx'));
  assert.match(saved, /role="status"/);
  assert.match(saved, /aria-live="polite"/);
  for (const key of ['toastSaved', 'toastRemoved', 'toastFailed', 'toastLimit', 'toastGone', 'toastSignIn', 'viewSaved']) {
    assert.match(saved, new RegExp(`copy\\.${key}\\b`), key);
  }
  assert.match(saved, /SAVED_ROOMS_LIMIT/);
  assert.match(saved, /onMouseEnter=/);
  assert.match(saved, /onFocus=/);
  assert.match(saved, /href=\{savedHref\}|<Link[^>]*href="\/saved"/, 'the "saved" toast links to the list');
});

test('/saved: sign-in gate when signed out, the list or an empty state when signed in, retry on error', () => {
  const page = read(path.join(app, '[locale]', '(marketplace)', 'saved', 'page.tsx'));
  assert.match(page, /<SavedRoomsList\b/);
  const list = read(path.join(guest, 'SavedRoomsList.tsx'));
  assert.match(list, /^'use client';/);
  assert.match(list, /gateTitle/);
  assert.match(list, /<AccountLink[^>]*page="signIn"/);
  assert.match(list, /<AccountLink[^>]*page="register"/);
  assert.match(list, /fetchSavedRooms\(/);
  assert.match(list, /<RoomCard\b/);
  assert.match(list, /emptyTitle/);
  assert.match(list, /saved\.errorTitle/);
  assert.match(list, /retry/);
  assert.doesNotMatch(list, /isSaved\([^)]*\)\s*\?\s*<RoomCard|\.filter\(\(card\) => saved\.isSaved/, 'an unsaved card stays until the page is left');
});

test('the saved heart is filled red; the toast respects reduced motion', () => {
  const css = read(path.join(app, '[locale]', 'guest.css'));
  assert.match(css, /\.nk-fav\[aria-pressed='true'\][^{]*\{[^}]*color: var\(--nk-color-danger\)/);
  assert.match(css, /\.nk-fav\[aria-pressed='true'\] svg[^{]*\{[^}]*fill: currentColor/);
  assert.match(css, /\.nk-toast\b/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*\.nk-toast/);
});

test('review R5/R9: no press while the hearts load; a failed load is tried again on the next press; the token must belong to the account that pressed', () => {
  const saved = read(path.join(guest, 'SavedRooms.tsx'));
  assert.match(saved, /status === 'loading'\)? return 'busy'|if \(statusRef\.current === 'loading'\) return 'busy'/);
  assert.match(saved, /statusRef\.current === 'error'/);
  assert.match(saved, /guestSessionToken\(\)/);
  assert.match(saved, /auth\.userId !== owner/);
  const heart = read(path.join(guest, 'FavoriteButton.tsx'));
  assert.match(heart, /saved\.status === 'loading'/);
});

test('review R6: problems are announced as alerts, removing has its own failure text, closing returns focus to the heart', () => {
  const saved = read(path.join(guest, 'SavedRooms.tsx'));
  assert.match(saved, /role="alert"/);
  assert.match(saved, /copy\.toastRemoveFailed/);
  assert.match(saved, /returnFocus/);
});

test('review R12: the saved list is a labelled section', () => {
  const list = read(path.join(guest, 'SavedRoomsList.tsx'));
  assert.match(list, /<section className="nk-room-grid" aria-label=/);
});
