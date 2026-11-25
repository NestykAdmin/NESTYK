// W1 (nestyk-guest-app-webview-plan-20261124.md): the app's side of the guest web shown in the app.
// The page side and the messages both ways are checked in apps/web/lib/app-bridge.test.cjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)((id) => {
    throw new Error(`${file} must not import ${id}`);
  }, mod, mod.exports);
  return mod.exports;
}
const B = load('guest-web-bridge.ts');
const ORIGIN = 'http://192.168.1.20:3000';

test('the guest web address: its origin, Thai without a prefix, other languages with one', () => {
  assert.equal(B.guestWebOrigin('http://192.168.1.20:3000/'), ORIGIN);
  assert.equal(B.guestWebOrigin('https://nestyk.com'), 'https://nestyk.com');
  assert.equal(B.guestWebOrigin('ftp://x'), null);
  assert.equal(B.guestWebOrigin('not a url'), null);
  assert.equal(B.guestWebUrl(`${ORIGIN}/`, 'th', '/'), `${ORIGIN}/`);
  assert.equal(B.guestWebUrl(ORIGIN, 'th', '/search'), `${ORIGIN}/search`);
  assert.equal(B.guestWebUrl(ORIGIN, 'en', '/'), `${ORIGIN}/en`);
  assert.equal(B.guestWebUrl(ORIGIN, 'ja', '/search'), `${ORIGIN}/ja/search`);
  assert.equal(B.guestWebUrl(ORIGIN, 'xx', '/search'), `${ORIGIN}/search`, 'unknown language: Thai');
});

test('where the page may go: our site in the view, other sites in the browser, scripts and files never', () => {
  const go = (url, top = true) => B.navigationDecision(url, ORIGIN, top);
  assert.equal(go(`${ORIGIN}/rooms/31`), 'allow');
  assert.equal(go('about:blank'), 'allow');
  assert.equal(go('https://www.google.com/maps/embed?x', false), 'allow', 'the area map iframe');
  assert.equal(go('https://www.facebook.com/nestyk'), 'external');
  assert.equal(go('http://192.168.1.20.evil.com:3000/'), 'external', 'a look-alike host is another site');
  assert.equal(go(`${ORIGIN}.evil.com/`), 'block', 'not a valid address');
  assert.equal(go('tel:+66812345678'), 'external');
  assert.equal(go('mailto:hi@nestyk.com'), 'external');
  assert.equal(go('javascript:alert(1)'), 'block');
  assert.equal(go('file:///etc/passwd'), 'block');
  assert.equal(go('data:text/html,hi'), 'block');
  assert.equal(go('intent://x#Intent;end'), 'block');
  assert.equal(go('not a url'), 'block');
});

test('the app answers only our own page', () => {
  assert.equal(B.fromGuestWeb(`${ORIGIN}/saved`, ORIGIN), true);
  assert.equal(B.fromGuestWeb('https://evil.example/', ORIGIN), false);
  assert.equal(B.fromGuestWeb(`${ORIGIN}.evil.com/`, ORIGIN), false);
  assert.equal(B.fromGuestWeb(undefined, ORIGIN), false);
  assert.equal(B.fromGuestWeb(`${ORIGIN}/`, null), false, 'no guest web configured');
});

test('the profile the page gets: who is signed in, never the token', () => {
  assert.equal(B.profileForWeb(null), null);
  const profile = B.profileForWeb({
    mode: 'supabase', accessToken: 't', email: 'a@b.c', userId: 'u-9', firstName: 'A', lastName: '', avatarUrl: null, roles: ['guest'],
  });
  assert.deepEqual(profile, { userId: 'u-9', email: 'a@b.c', firstName: 'A', lastName: '', avatarUrl: null, roles: ['guest'] });
});

test('the reply script stays one safe call even with quotes and line breaks in the data', () => {
  const calls = [];
  const win = { __nestykAppReceive: (raw) => calls.push(raw) };
  const tricky = { type: 'session', id: 'r', profile: { userId: 'u', email: 'a@b.c', firstName: '"); alert(1); ("', lastName: ' </script>', avatarUrl: null, roles: [] } };
  new Function('window', 'location', B.receiveScript(tricky, ORIGIN))(win, { origin: ORIGIN });
  assert.deepEqual(calls[0], tricky);
  new Function('window', 'location', B.receiveScript({ type: 'session.changed' }, ORIGIN))({}, { origin: ORIGIN }); // no receiver yet: nothing breaks
});

test('a reply reaches only a page of our own origin, even if the view moved on meanwhile (review R5)', () => {
  const calls = [];
  const win = { __nestykAppReceive: (raw) => calls.push(raw) };
  new Function('window', 'location', B.receiveScript({ type: 'token', id: 'r', token: 't', userId: 'u' }, ORIGIN))(win, { origin: 'https://evil.example' });
  assert.equal(calls.length, 0);
  new Function('window', 'location', B.receiveScript({ type: 'token', id: 'r', token: 't', userId: 'u' }, null))(win, { origin: ORIGIN });
  assert.equal(calls.length, 0, 'no guest web configured: nothing is sent');
});

// Step 2 (design W, Mos 24 Nov 2026): the web is the guest's whole screen in the app; the app keeps the side menu,
// the notifications and its own sign-in / legal screens.
test('the page can open the side menu, the notifications and the sign-in / legal screens of the app', () => {
  assert.deepEqual(B.parseWebMessage('{"type":"app.menu"}'), { type: 'app.menu' });
  assert.deepEqual(B.parseWebMessage('{"type":"app.notifications"}'), { type: 'app.notifications' });
  for (const page of ['signIn', 'register', 'resetPassword', 'privacy', 'terms']) {
    assert.deepEqual(B.parseWebMessage(JSON.stringify({ type: 'app.open', page })), { type: 'app.open', page });
  }
  assert.equal(B.parseWebMessage('{"type":"app.open","page":"admin"}'), null, 'only the known screens');
  assert.equal(B.parseWebMessage('{"type":"app.open","page":"/login"}'), null);
  assert.equal(B.parseWebMessage('{"type":"app.open"}'), null);
  assert.deepEqual(B.APP_PAGE_ROUTE, { signIn: '/login', register: '/register', resetPassword: '/reset-password', privacy: '/privacy', terms: '/terms' });
});

test('an account page of our site opens the app screen; other account paths never load in the view', () => {
  const go = (url, top = true) => B.navigationDecision(url, ORIGIN, top);
  assert.equal(go(`${ORIGIN}/login`), 'app');
  assert.equal(go(`${ORIGIN}/login?next=%2Frooms%2F31`), 'app');
  assert.equal(go(`${ORIGIN}/register`), 'app');
  assert.equal(go(`${ORIGIN}/reset-password`), 'app');
  assert.equal(go(`${ORIGIN}/privacy#cookies`), 'app');
  assert.equal(go(`${ORIGIN}/terms`), 'app');
  for (const p of ['/agent', '/agent/leads', '/landlord', '/tenant/bills', '/admin', '/self-owner', '/owner', '/no-access']) {
    assert.equal(go(`${ORIGIN}${p}`), 'block', p);
  }
  assert.equal(go(`${ORIGIN}/loginx`), 'allow', 'only whole path parts');
  assert.equal(go(`${ORIGIN}/en/search`), 'allow');
  assert.equal(go('https://other.example/login'), 'external', 'another site is still another site');
  assert.equal(B.appPageOf(`${ORIGIN}/login?next=%2F`, ORIGIN), 'signIn');
  assert.equal(B.appPageOf(`${ORIGIN}/privacy#cookies`, ORIGIN), 'privacy');
  assert.equal(B.appPageOf(`${ORIGIN}/reset-password`, ORIGIN), 'resetPassword');
  assert.equal(B.appPageOf(`${ORIGIN}/agent`, ORIGIN), null);
  assert.equal(B.appPageOf('https://other.example/login', ORIGIN), null);
});

test('guest side-menu items open the matching page of the web', () => {
  assert.equal(B.guestWebPathForMenu('/favorites'), '/saved');
  assert.equal(B.guestWebPathForMenu('/viewings'), '/viewing-requests');
  assert.equal(B.guestWebPathForMenu('/landlord/tenants'), null);
});

test('the boot script marks the page as in the app and gives it the screen edges, on our own origin only', () => {
  const run = (origin, insets) => {
    const attrs = {};
    const props = {};
    const doc = { documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, style: { setProperty: (k, v) => { props[k] = v; } } } };
    const win = {};
    new Function('window', 'location', 'document', B.bootScript(ORIGIN, insets))(win, { origin }, doc);
    return { flag: win.__NESTYK_APP__, attrs, props };
  };
  const ok = run(ORIGIN, { top: 47, bottom: 34 });
  assert.deepEqual(ok.flag, { v: 1 });
  assert.equal(ok.attrs['data-nk-app'], '1');
  assert.deepEqual(ok.props, { '--nk-app-top': '47px', '--nk-app-bottom': '34px' });
  const odd = run(ORIGIN, { top: Number.NaN, bottom: 9999 });
  assert.deepEqual(odd.props, { '--nk-app-top': '0px', '--nk-app-bottom': '200px' }, 'bad numbers stay sane');
  const other = run('https://evil.example', { top: 47, bottom: 34 });
  assert.equal(other.flag, undefined);
  assert.deepEqual(other.attrs, {});
});

test('the app can send the page to one of its own paths, never another site', () => {
  const calls = [];
  const win = { __nestykAppReceive: (raw) => calls.push(raw) };
  new Function('window', 'location', B.receiveScript({ type: 'navigate', path: '/saved' }, ORIGIN))(win, { origin: ORIGIN });
  assert.deepEqual(calls[0], { type: 'navigate', path: '/saved' });
});
