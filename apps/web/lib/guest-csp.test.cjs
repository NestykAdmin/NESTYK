// AUTH-2.6 (nestyk-guest-session-plan-20261112.md B7, review R9): Content-Security-Policy for the guest pages.
// One site shares one sign-in, so a script on a guest page could read it: only our own scripts run, and the page
// may talk only to this site and Supabase. The account and role pages (consumer-app) are left to their own setup.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const csp = require('./guest-csp.js');
const routes = require('./account-routes.js');

const parse = (policy) => Object.fromEntries(policy.split(';').map((p) => p.trim()).filter(Boolean).map((p) => {
  const [name, ...values] = p.split(/\s+/);
  return [name, values];
}));

test('production: own scripts only, connections to this site and the Supabase project only, no framing', () => {
  const p = parse(csp.guestCsp({ supabaseUrl: 'https://abc.supabase.co/', dev: false }));
  assert.deepEqual(p['default-src'], ["'self'"]);
  assert.deepEqual(p['script-src'], ["'self'", "'unsafe-inline'"], 'Next inline bootstrap; no other host, no eval');
  assert.deepEqual(p['connect-src'], ["'self'", 'https://abc.supabase.co']);
  assert.deepEqual(p['frame-ancestors'], ["'none'"]);
  assert.deepEqual(p['object-src'], ["'none'"]);
  assert.deepEqual(p['base-uri'], ["'self'"]);
  assert.deepEqual(p['form-action'], ["'self'"]);
  assert.ok(p['img-src'].includes('https:'), 'room photos come from the API host');
});

test('local dev adds only what Next dev needs (eval for refresh, its websocket)', () => {
  const p = parse(csp.guestCsp({ supabaseUrl: 'http://127.0.0.1:54321', dev: true }));
  assert.ok(p['script-src'].includes("'unsafe-eval'"));
  assert.ok(p['connect-src'].includes('ws:'));
  assert.ok(p['connect-src'].includes('http://127.0.0.1:54321'));
});

test('a broken or missing Supabase URL adds nothing', () => {
  for (const bad of [undefined, '', 'not a url', 'javascript:alert(1)']) {
    assert.deepEqual(parse(csp.guestCsp({ supabaseUrl: bad, dev: false }))['connect-src'], ["'self'"], String(bad));
  }
});

test('the policy covers guest pages only: never the account and role pages, the API or Next files', () => {
  assert.equal(csp.GUEST_CSP_SOURCE, `/:path${csp.GUEST_CSP_GROUP}`);
  const re = new RegExp(`^/${csp.GUEST_CSP_GROUP}$`);
  for (const p of ['/', '/search', '/en/search', '/ja/saved', '/profile', '/agents-guide', '/roomsx']) assert.ok(re.test(p), p);
  // S7.3 (plan D1): room pages get their own policy with Google Maps; two policies on one page would block the map.
  for (const p of ['/rooms/x', '/en/rooms/x', '/zh/rooms/12']) assert.ok(!re.test(p), p);
  // Review R1 (AUTH-2): the room share and signing pages load Maps / call the API by full URL, like the middleware skips them.
  for (const p of [...routes.ACCOUNT_PATHS, '/agent/leads', '/api/public/rooms', '/_next/static/x.js', '/_expo/x.js', '/owner/rooms', '/s/abc', '/sign/abc']) {
    assert.ok(!re.test(p), p);
  }
});

test('next.config.js sends the policy on guest pages', () => {
  const config = fs.readFileSync(path.join(__dirname, '..', 'next.config.js'), 'utf8');
  assert.match(config, /async headers\(\)/);
  assert.match(config, /source: GUEST_CSP_SOURCE/);
  assert.match(config, /source: '\/'/, 'the home page too');
  assert.match(config, /key: 'Content-Security-Policy'/);
});

// S7.3 plan D1 (Mos 19 Nov 2026): Google Maps loads on room pages only, after the person allows the maps cookie.
// Hosts from Google's Maps JavaScript API allowlist CSP guide; nothing else is added.
test('room pages: the guest policy plus Google Maps hosts, and nothing else', () => {
  const base = parse(csp.guestCsp({ supabaseUrl: 'https://abc.supabase.co/', dev: false }));
  const room = parse(csp.guestCsp({ supabaseUrl: 'https://abc.supabase.co/', dev: false, maps: true }));
  for (const host of ['https://*.googleapis.com', 'https://*.gstatic.com']) {
    assert.ok(room['script-src'].includes(host), `script-src ${host}`);
    assert.ok(room['connect-src'].includes(host), `connect-src ${host}`);
    assert.ok(!base['script-src'].includes(host), `not on other guest pages: ${host}`);
  }
  assert.ok(room['connect-src'].includes('https://abc.supabase.co'), 'sign-in refresh still works');
  for (const directive of ['script-src', 'connect-src', 'frame-src', 'img-src']) {
    assert.ok(!room[directive].includes('*') && !room[directive].includes('http:'), `${directive} has no open source`);
  }
  assert.ok(!room['script-src'].includes("'unsafe-eval'"), 'no eval in production');
  assert.deepEqual(room['frame-ancestors'], ["'none'"]);
  assert.deepEqual(room['object-src'], ["'none'"]);
  for (const host of Object.values(room).flat()) {
    assert.ok(!/^https:\/\/\*\.(com|net|org)$/.test(host), `no bare wildcard domain: ${host}`);
  }
});

test('the room policy is sent on room pages in every language', () => {
  const re = new RegExp(`^${csp.GUEST_ROOM_CSP_SOURCES.map((s) => s.replace(':locale(en|ja|zh)', '(en|ja|zh)').replace('/:id*', '/[^?#]*')).join('|^')}$`);
  for (const p of ['/rooms/12', '/en/rooms/12', '/ja/rooms/a-b', '/zh/rooms/9']) assert.ok(re.test(p), p);
  for (const p of ['/search', '/fr/rooms/12', '/s/abc']) assert.ok(!re.test(p), p);
  const config = fs.readFileSync(path.join(__dirname, '..', 'next.config.js'), 'utf8');
  assert.match(config, /GUEST_ROOM_CSP_SOURCES\.map/);
  assert.match(config, /maps: true/);
});
