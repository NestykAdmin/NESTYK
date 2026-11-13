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
  for (const p of ['/', '/search', '/en/search', '/ja/saved', '/profile', '/rooms/x', '/agents-guide']) assert.ok(re.test(p), p);
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
