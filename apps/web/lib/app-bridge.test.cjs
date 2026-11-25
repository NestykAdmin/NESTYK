// W1 (nestyk-guest-app-webview-plan-20261124.md): the guest web inside the NESTYK app asks the app for the sign-in.
// Both sides of the messages are checked here against each other: apps/web/lib/app-bridge.ts (the page) and
// apps/consumer-app/lib/guest-web-bridge.ts (the app).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTs(file, deps = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)((id) => {
    if (id in deps) return deps[id];
    throw new Error(`unexpected import ${id} in ${file}`);
  }, mod, mod.exports);
  return mod.exports;
}

const session = loadTs(path.join(__dirname, 'guest-session.ts'));
const web = loadTs(path.join(__dirname, 'app-bridge.ts'), { './guest-session': session });
const app = loadTs(path.join(__dirname, '..', '..', 'consumer-app', 'lib', 'guest-web-bridge.ts'));

const ORIGIN = 'http://192.168.1.20:3000';

test('the page and the app use the same marks: user agent, flag and receiver', () => {
  assert.equal(web.APP_UA_MARK, app.APP_UA_MARK);
  assert.match(app.bootScript(ORIGIN), new RegExp(`window\\.${web.APP_FLAG}\\b`));
  assert.match(app.receiveScript({ type: 'session.changed' }, ORIGIN), new RegExp(`window\\.${web.APP_RECEIVE}\\b`));
});

test('in the app only with the app bridge and the flag or the user agent mark', () => {
  const ua = `Mozilla/5.0 (iPhone) Mobile ${web.APP_UA_MARK}`;
  assert.equal(web.isInApp({ hasBridge: true, flag: { v: 1 }, userAgent: 'Mozilla/5.0' }), true);
  assert.equal(web.isInApp({ hasBridge: true, flag: undefined, userAgent: ua }), true);
  assert.equal(web.isInApp({ hasBridge: false, flag: { v: 1 }, userAgent: ua }), false, 'no bridge, nobody to ask');
  assert.equal(web.isInApp({ hasBridge: true, flag: undefined, userAgent: 'Mozilla/5.0' }), false);
});

test('the boot script marks only our own page', () => {
  const run = (origin) => {
    const win = {};
    new Function('window', 'location', app.bootScript(ORIGIN))(win, { origin });
    return win[web.APP_FLAG];
  };
  assert.deepEqual(run(ORIGIN), { v: 1 });
  assert.equal(run('https://evil.example'), undefined);
});

test("the app's replies reach the page and read as the same profile (no token)", () => {
  const received = [];
  const win = { [web.APP_RECEIVE]: (raw) => received.push(web.parseAppMessage(raw)) };
  const profile = app.profileForWeb({
    mode: 'supabase', accessToken: 'secret-token', email: 'mary@example.com', userId: 'u-1',
    firstName: 'Mary', lastName: 'Ann', avatarUrl: 'https://img.example/a.png', roles: ['guest', 'agent'],
  });
  assert.equal(JSON.stringify(profile).includes('secret-token'), false, 'the profile never carries the token');
  new Function('window', 'location', app.receiveScript({ type: 'session', id: 'r1', profile }, ORIGIN))(win, { origin: ORIGIN });
  new Function('window', 'location', app.receiveScript({ type: 'token', id: 'r2', token: 'abc', userId: 'u-1' }, ORIGIN))(win, { origin: ORIGIN });
  new Function('window', 'location', app.receiveScript({ type: 'session.changed' }, ORIGIN))(win, { origin: ORIGIN });
  assert.equal(received[0].type, 'session');
  assert.equal(received[0].id, 'r1');
  assert.equal(received[0].profile.displayName, 'Mary Ann');
  assert.equal(received[0].profile.initials, 'MA');
  assert.deepEqual(received[0].profile.roles, ['guest', 'agent']);
  assert.deepEqual(received[1], { type: 'token', id: 'r2', token: 'abc', userId: 'u-1' });
  assert.deepEqual(received[2], { type: 'session.changed' });
});

test('the page ignores replies it cannot trust', () => {
  assert.equal(web.parseAppMessage('not json'), null);
  assert.equal(web.parseAppMessage({ type: 'other' }), null);
  assert.equal(web.parseAppMessage({ type: 'token', token: 'abc' }), null, 'a token reply needs the request id');
  assert.equal(web.parseAppMessage({ type: 'token', id: 'r', token: 42 }), null);
  assert.deepEqual(web.parseAppMessage({ type: 'token', id: 'r', token: null }), { type: 'token', id: 'r', token: null, userId: null });
  assert.equal(web.parseAppMessage({ type: 'session', id: 'r', profile: { email: 'x@y.z' } }).profile, null, 'no user id: signed out');
  assert.equal(web.parseAppMessage({ type: 'session', id: 'r', profile: null }).profile, null);
});

test("the page's requests read in the app; anything else is dropped", () => {
  assert.deepEqual(app.parseWebMessage(web.webMessage({ type: 'token.get', id: 'a1' })), { type: 'token.get', id: 'a1' });
  assert.deepEqual(app.parseWebMessage(web.webMessage({ type: 'session.get', id: 'a2' })), { type: 'session.get', id: 'a2' });
  assert.deepEqual(app.parseWebMessage(web.webMessage({ type: 'auth.signOut' })), { type: 'auth.signOut' });
  assert.equal(app.parseWebMessage('{"type":"token.get"}'), null, 'no id');
  assert.equal(app.parseWebMessage('{"type":"wipe"}'), null);
  assert.equal(app.parseWebMessage('<html>'), null);
  assert.equal(app.parseWebMessage(JSON.stringify({ type: 'token.get', id: 'x'.repeat(65) })), null, 'ids stay short');
});

// Step 2 (design W): the page's app bar opens the app's side menu and notifications; sign-in and legal links open
// the app's own screens; the app's side menu moves the page.
test("the page's app requests read in the app", () => {
  assert.deepEqual(app.parseWebMessage(web.webMessage({ type: 'app.menu' })), { type: 'app.menu' });
  assert.deepEqual(app.parseWebMessage(web.webMessage({ type: 'app.notifications' })), { type: 'app.notifications' });
  for (const page of ['signIn', 'register', 'privacy', 'terms', 'cookies']) {
    const appPage = web.appPageFor(page);
    assert.deepEqual(app.parseWebMessage(web.webMessage({ type: 'app.open', page: appPage })), { type: 'app.open', page: appPage }, page);
  }
  assert.equal(web.appPageFor('cookies'), 'privacy', 'the cookie notes are on the privacy page');
  assert.equal(web.appPageFor('signIn'), 'signIn');
});

test('the boot script and the page agree on the in-app mark', () => {
  const attrs = {};
  const doc = { documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, style: { setProperty() {} } } };
  new Function('window', 'location', 'document', app.bootScript(ORIGIN, { top: 0, bottom: 0 }))({}, { origin: ORIGIN }, doc);
  assert.equal(attrs[web.APP_ATTR], '1');
});

test('the app moves the page only to an in-site path', () => {
  const received = [];
  const win = { [web.APP_RECEIVE]: (raw) => received.push(web.parseAppMessage(raw)) };
  new Function('window', 'location', app.receiveScript({ type: 'navigate', path: app.guestWebPathForMenu('/favorites') }, ORIGIN))(win, { origin: ORIGIN });
  assert.deepEqual(received[0], { type: 'navigate', path: '/saved' });
  for (const path of ['https://evil.example/', '//evil.example', '/\\evil', 'javascript:alert(1)', '', '/a b', '/x'.repeat(200)]) {
    assert.equal(web.parseAppMessage({ type: 'navigate', path }), null, path);
  }
  assert.deepEqual(web.parseAppMessage({ type: 'navigate', path: '/viewing-requests' }), { type: 'navigate', path: '/viewing-requests' });
});
