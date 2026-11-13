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
const { guestWebBase, guestWebPath, signInTarget, withNextParam, GUEST_WEB_PAGES, GUEST_WEB_TREES, GUEST_WEB_LOCALES } = mod.exports;
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
