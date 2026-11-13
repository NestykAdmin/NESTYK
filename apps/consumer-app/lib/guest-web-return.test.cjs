// AUTH-1.5 / 1.6 (nestyk-guest-session-plan-20261112.md, A5–A6): on nestyk.com the guest pages live in the guest web
// (apps/web). Sign-in / sign-up started there comes back to the same guest page with a full page load.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, 'app-routes.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', source)(() => { throw new Error('app-routes must stay dependency free'); }, mod, mod.exports);
const { guestWebBase, guestWebPath, signInTarget, withNextParam, guestWebUrlFor, authPageLocale, GUEST_WEB_PAGES, GUEST_WEB_TREES, GUEST_WEB_LOCALES } = mod.exports;
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('EXPO_PUBLIC_GUEST_WEB_URL: unset = off, "/" = this same site, an http(s) address = that site', () => {
  for (const off of [undefined, '', '  ', 'nestyk.com', 'javascript:alert(1)', '//evil.example', 'ftp://x.example']) {
    assert.equal(guestWebBase(off), null, String(off));
  }
  assert.equal(guestWebBase('/'), '');
  assert.equal(guestWebBase('http://localhost:3000'), 'http://localhost:3000');
  assert.equal(guestWebBase('https://nestyk.com/some/path/'), 'https://nestyk.com');
});

test('guest web pages (with or without a language prefix) are accepted as `next`, query kept', () => {
  for (const ok of ['/', '/search', '/en', '/en/search?beds=1&sort=price', '/ja/saved', '/zh/profile', '/rooms/abc-123', '/en/rent/asok']) {
    assert.equal(guestWebPath(ok), ok, ok);
  }
  // Review R7: the guest web's paths are lower case; the query keeps its case.
  assert.equal(guestWebPath('/EN/Search?Q=Asok'), '/en/search?Q=Asok');
});

test('anything else is not a guest web page (open redirect and role pages stay out)', () => {
  for (const bad of [undefined, '', 'search', '//evil.example', '/\\evil', 'https://evil.example', '/en/search:x', '/a\nb',
    '/agent', '/agent/leads', '/login', '/en/login', '/fr/search', '/rooms', '/rooms/a/b', '/en/en/search', '/services', '/' + 'x'.repeat(600)]) {
    assert.equal(guestWebPath(bad), null, String(bad));
  }
  assert.equal(guestWebPath(['/en/search', '/agent']), '/en/search', 'first value of a repeated param');
});

test('the list matches the pages the guest web really has', () => {
  const dir = path.join(__dirname, '..', '..', 'web', 'app', '[locale]', '(marketplace)');
  const pages = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  for (const page of pages) assert.ok(GUEST_WEB_PAGES.includes(page) || GUEST_WEB_TREES.includes(page), `guest web page ${page} missing`);
  const routing = fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'i18n', 'routing.ts'), 'utf8');
  const locales = routing.match(/locales:\s*\[([^\]]+)\]/)[1].match(/'(\w+)'/g).map((s) => s.slice(1, -1));
  assert.deepEqual([...GUEST_WEB_LOCALES].sort(), locales.filter((l) => l !== 'th').sort(), 'Thai has no prefix');
});

test('after sign-in: a guest web `next` goes back there with a page load; role pages stay in this app', () => {
  assert.deepEqual(signInTarget('/en/search?beds=1', '', '/agent'), { kind: 'guestWeb', url: '/en/search?beds=1' });
  assert.deepEqual(signInTarget('/ja/saved', 'http://localhost:3000', '/agent'), { kind: 'guestWeb', url: 'http://localhost:3000/ja/saved' });
  assert.deepEqual(signInTarget('/agent/leads', '', '/agent/leads'), { kind: 'app', href: '/agent/leads' });
  assert.deepEqual(signInTarget(undefined, '', '/agent'), { kind: 'app', href: '/agent' });
});

test('an account that lands on the guest home goes to the guest web home, not the old guest shell', () => {
  assert.deepEqual(signInTarget(undefined, '', '/'), { kind: 'guestWeb', url: '/' });
  assert.deepEqual(signInTarget('//evil.example', 'http://localhost:3000', '/'), { kind: 'guestWeb', url: 'http://localhost:3000/' });
  assert.deepEqual(signInTarget(undefined, '', '/search?q=1'), { kind: 'guestWeb', url: '/search?q=1' });
  assert.deepEqual(signInTarget(undefined, '', '/services'), { kind: 'guestWeb', url: '/' }, 'no such page on the guest web');
});

test('without EXPO_PUBLIC_GUEST_WEB_URL nothing changes (agent.nestyk.com, mobile)', () => {
  assert.deepEqual(signInTarget('/en/search', null, '/agent'), { kind: 'app', href: '/agent' });
  assert.deepEqual(signInTarget(undefined, null, '/'), { kind: 'app', href: '/' });
});

test('moving between sign-in and sign-up keeps a safe `next`', () => {
  assert.equal(withNextParam('/register', '/en/search?beds=1'), '/register?next=%2Fen%2Fsearch%3Fbeds%3D1');
  assert.equal(withNextParam('/login', '/agent/leads'), '/login?next=%2Fagent%2Fleads');
  assert.equal(withNextParam('/login', ['/ja/saved']), '/login?next=%2Fja%2Fsaved');
  for (const bad of [undefined, '', '//evil.example', 'https://evil.example', '/login']) assert.equal(withNextParam('/register', bad), '/register', String(bad));
});

test('login and sign-up use the shared helpers (web: page load to the guest web; mobile: "/" as before)', () => {
  const login = read('app/login.tsx');
  assert.match(login, /goAfterSignIn\(router, next, session\?\.roles\)/);
  assert.match(login, /goToGuestHome\(router\)/);
  assert.match(login, /withNextParam\('\/register', next\)/);
  const register = read('app/register.tsx');
  assert.match(register, /useLocalSearchParams/);
  // Review R1 (13 Nov 2026): only the signed-in effect decides on the web (it has the roles); after sign-up and code
  // check the handlers move only on mobile, like login.tsx.
  assert.equal((register.match(/goAfterSignIn\(router, next, session\?\.roles\)/g) || []).length, 1, 'the signed-in effect only');
  assert.equal((register.match(/if \(Platform\.OS !== 'web'\) router\.replace\('\/'\);/g) || []).length, 2, 'signed up, code verified');
  assert.match(register, /withNextParam\('\/login', next\)/);

  const web = read('lib/web-routes.web.ts');
  assert.match(web, /guestWebBase\(process\.env\.EXPO_PUBLIC_GUEST_WEB_URL\)/);
  assert.match(web, /window\.location\.assign\(target\.url\)/);
  const native = read('lib/web-routes.ts');
  assert.match(native, /export function goAfterSignIn\([^)]*\): void \{\s*router\.replace\('\/' as never\);/);
  assert.match(native, /export function goToGuestHome\([^)]*\): void \{\s*router\.replace\('\/' as never\);/);
});

test('review R4: with the guest web on, any move of this app to a guest page loads the guest web instead', () => {
  assert.equal(guestWebUrlFor('/', ''), '/');
  assert.equal(guestWebUrlFor('/search?q=asok', 'http://localhost:3000'), 'http://localhost:3000/search?q=asok');
  assert.equal(guestWebUrlFor('/services', ''), '/', 'no such page there: its home');
  for (const role of ['/agent', '/agent/leads', '/landlord', '/tenant/bills', '/login', '/privacy']) assert.equal(guestWebUrlFor(role, ''), null, role);
  for (const href of ['/', '/search']) assert.equal(guestWebUrlFor(href, null), null, 'off without EXPO_PUBLIC_GUEST_WEB_URL');
});

test('the web route sync hands guest pages to the guest web (sign-out, logo, switch to Guest, another tab signing out)', () => {
  const web = read('lib/web-routes.web.ts');
  const sync = web.slice(web.indexOf('export function useAppRouteSync'));
  assert.match(sync, /const guestWeb = guestWebUrlFor\(routeHref, GUEST_WEB_BASE\);/);
  assert.ok(sync.indexOf('guestWebUrlFor(') < sync.indexOf('router.replace(routeHref'), 'before any in-app move');
  // Review R2 (AUTH-2): a URL that changes to a guest page from outside the shell (router.replace('/'), Back) too.
  const first = sync.slice(0, sync.indexOf('applyRoute(target.state)'));
  assert.match(first, /guestWebUrlFor\(target\.href, GUEST_WEB_BASE\)/);
  assert.match(sync, /leaveToGuestWeb\(/);
  assert.match(web, /window\.location\.pathname === new URL\(url, window\.location\.href\)\.pathname[\s\S]*window\.location\.replace\(url\)/, 'no second history entry for the same page');
});

test('D6 (Mos 13 Nov 2026): sign-in / sign-up opened from a guest page shows the language of that page', () => {
  assert.equal(authPageLocale('/login', '?next=%2Fen%2Fsearch%3Fbeds%3D1'), 'en');
  assert.equal(authPageLocale('/register', '?next=%2Fja%2Fsaved'), 'ja');
  assert.equal(authPageLocale('/login', '?next=%2Fzh'), 'zh');
  assert.equal(authPageLocale('/login', '?next=%2Fsearch'), 'th', 'Thai pages have no prefix');
  assert.equal(authPageLocale('/reset-password', '?next=%2F'), 'th');
  assert.equal(authPageLocale('/login', '?lang=ja&next=%2Fen%2Fsearch'), 'ja', 'an explicit lang wins');
});

test('D6: anything else keeps the language the app remembers', () => {
  assert.equal(authPageLocale('/login', ''), null);
  assert.equal(authPageLocale('/login', '?next=%2Fagent%2Fleads'), null, 'role pages: their own language setting');
  assert.equal(authPageLocale('/login', '?next=%2F%2Fevil.example'), null);
  assert.equal(authPageLocale('/login', '?lang=fr'), null);
  assert.equal(authPageLocale('/agent', '?next=%2Fen'), null, 'only the sign-in pages');
  assert.equal(authPageLocale('/search', '?lang=en'), null);
});

test('D6: the root layout uses it on the web before the saved language', () => {
  const layout = read('app/_layout.tsx');
  assert.match(layout, /authPageLocale\(window\.location\.pathname, window\.location\.search\)/);
  assert.match(layout, /setInitialLocale\(fromUrl \?\? saved \?\? deviceLocale\)/);
});
