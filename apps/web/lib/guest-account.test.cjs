// AUTH-2.1 / 2.3 / 2.4 / 2.5 (nestyk-guest-session-plan-20261112.md B1–B6, Mos picked menu design B 13 Nov 2026).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const web = path.join(__dirname, '..');
const guest = path.join(web, 'app', 'components', 'guest');
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');

test('the guest web uses the same supabase-js as the consumer-app, with the same public settings', () => {
  const pkg = JSON.parse(read(web, 'package.json'));
  const app = JSON.parse(read(web, '..', 'consumer-app', 'package.json'));
  assert.equal(pkg.dependencies['@supabase/supabase-js'], app.dependencies['@supabase/supabase-js']);
  const config = read(web, 'next.config.js');
  assert.match(config, /NEXT_PUBLIC_SUPABASE_URL:\s*process\.env\.NEXT_PUBLIC_SUPABASE_URL \|\| process\.env\.EXPO_PUBLIC_SUPABASE_URL/);
  assert.match(config, /NEXT_PUBLIC_SUPABASE_ANON_KEY:\s*process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY \|\| process\.env\.EXPO_PUBLIC_SUPABASE_ANON_KEY/);
  const client = read(web, 'lib', 'guest-supabase.ts');
  assert.match(client, /detectSessionInUrl: false/, 'sign-in only happens on the account pages');
  assert.match(client, /persistSession: true/);
  assert.match(client, /autoRefreshToken: true/);
  assert.match(client, /flowType: 'pkce'/);
});

test('the provider reads the sign-in in the browser only, follows other tabs and the 8h idle rule', () => {
  const provider = read(guest, 'GuestSession.tsx');
  assert.match(provider, /^'use client';/);
  assert.match(provider, /readGuestProfile\(/);
  assert.match(provider, /addEventListener\('storage'/);
  assert.match(provider, /guestSessionChange\(/);
  assert.match(provider, /idleExpired\(/);
  assert.match(provider, /ACTIVITY_KEY/);
  assert.match(provider, /status: 'checking'/, 'server render and first paint do not know the sign-in yet');
  // Review R5: supabase-js loads only for someone with a sign-in copy (public pages stay light).
  assert.match(read(web, 'lib', 'guest-supabase.ts'), /await import\('@supabase\/supabase-js'\)/);
  assert.doesNotMatch(read(web, 'lib', 'guest-supabase.ts'), /^import \{ createClient/m);
  // Review R6: the answer is checked against the copy as it is then, not as it was at the start.
  assert.match(provider, /readGuestProfile\(readKey\(SESSION_STORAGE_KEY\)\)[\s\S]*getSession\(\)[\s\S]*readGuestProfile\(readKey\(SESSION_STORAGE_KEY\)\)/);
  const shell = read(guest, 'GuestShell.tsx');
  assert.match(shell, /<GuestSessionProvider>/);
});

test('sign-out from the guest web follows the consumer-app order and stays on the page', () => {
  // consumer-app AuthContext endSession: Supabase (this device) → reason for other tabs → profile copy (review R3).
  const provider = read(guest, 'GuestSession.tsx');
  const body = provider.slice(provider.indexOf('const signOut = useCallback'));
  const shown = body.indexOf('setState(SIGNED_OUT)');
  const supa = body.indexOf("signOut({ scope: 'local' })");
  const reason = body.indexOf('setItem(AUTH_EVENT_KEY');
  const copy = body.indexOf('removeItem(SESSION_STORAGE_KEY');
  assert.ok(shown > -1 && supa > shown, 'the header changes at once, then the network call');
  assert.ok(reason > supa && copy > reason, 'supabase local sign-out → reason → copy');
  assert.doesNotMatch(provider, /location\.(assign|replace|href\s*=)/, 'no page change on sign-out (public page)');
});

test('header: sign-in button when signed out, design B chip + menu when signed in, a same-size gap while checking', () => {
  const header = read(guest, 'GuestHeader.tsx');
  assert.match(header, /<AccountMenu \/>/);
  assert.doesNotMatch(header, /<AccountLink/);
  const menu = read(guest, 'AccountMenu.tsx');
  assert.match(menu, /useGuestSession\(\)/);
  assert.match(menu, /nk-account--checking/);
  assert.match(menu, /<AccountLink page="signIn" className="nk-signin" data-testid="guest\.signIn">/);
  // Review R7: a disclosure (links and buttons), not an ARIA menu without arrow keys.
  assert.doesNotMatch(menu, /role="menu(item)?"|aria-haspopup/);
  assert.match(menu, /aria-expanded=\{open\}/);
  assert.match(menu, /aria-controls=\{panelId\}/);
  assert.match(menu, /'Escape'/);
  assert.match(menu, /onBlur=/, 'closes when focus leaves it');
  assert.match(menu, /onError=/, 'a picture that fails shows the initials (review R8)');
  assert.match(menu, /roleSiteLinks\(/);
  assert.match(menu, /data-testid="guest\.account"/);
  assert.match(menu, /data-testid="guest\.signOut"/);
  assert.match(menu, /t\.roles\[/, 'role names come from the shared role copy');
});

test('mobile: the profile tab shows the initials, the profile page shows the account card and sign-out', () => {
  const tabs = read(guest, 'GuestTabBar.tsx');
  assert.match(tabs, /useGuestSession\(\)/);
  assert.match(tabs, /nk-tab__avatar/);
  const page = read(web, 'app', '[locale]', '(marketplace)', 'profile', 'page.tsx');
  assert.match(page, /<ProfileAccount /);
  const card = read(guest, 'ProfileAccount.tsx');
  assert.match(card, /data-testid="profile\.signInCard"/);
  assert.match(card, /data-testid="profile\.accountCard"/);
  assert.match(card, /data-testid="profile\.signOut"/);
  assert.match(card, /roleSiteLinks\(/);
});
