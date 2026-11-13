const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);

const site = require('./guest-site.ts');

test('sign-in goes to the account web set in NEXT_PUBLIC_ACCOUNT_WEB_ORIGIN', () => {
  assert.equal(site.accountWebOrigin('https://nestyk.com', 'production'), 'https://nestyk.com');
  assert.equal(site.accountWebOrigin('https://sit.nestyk.com/', 'production'), 'https://sit.nestyk.com');
  assert.equal(site.accountWebOrigin(' https://dev.nestyk.com/some/path ', 'development'), 'https://dev.nestyk.com');
  assert.equal(site.accountUrl('signIn', 'https://nestyk.com'), 'https://nestyk.com/login');
  assert.equal(site.accountUrl('register', 'https://nestyk.com'), 'https://nestyk.com/register');
  assert.equal(site.accountUrl('privacy', 'https://nestyk.com'), 'https://nestyk.com/privacy');
  assert.equal(site.accountUrl('terms', 'https://nestyk.com'), 'https://nestyk.com/terms');
  assert.equal(site.accountUrl('cookies', 'https://nestyk.com'), 'https://nestyk.com/privacy#cookies');
});

test('without the env value, local dev uses the consumer-app on this machine and a build uses the same site', () => {
  assert.equal(site.accountWebOrigin(undefined, 'development'), 'http://localhost:8081');
  assert.equal(site.accountWebOrigin('', 'test'), 'http://localhost:8081');
  assert.equal(site.accountWebOrigin(undefined, 'production'), '');
  assert.equal(site.accountUrl('signIn', ''), '/login');
});

test('an env value that is not an http(s) address is ignored', () => {
  for (const bad of ['javascript:alert(1)', 'ftp://nestyk.com', 'nestyk.com', '//evil.example', 'not a url']) {
    assert.equal(site.accountWebOrigin(bad, 'production'), '', bad);
    assert.equal(site.accountWebOrigin(bad, 'development'), 'http://localhost:8081', bad);
  }
});

test('with the account web on this same site (ACCOUNT_WEB_UPSTREAM set), account links stay on this site', () => {
  // AUTH-1.4: next.config.js turns NEXT_PUBLIC_ACCOUNT_SAME_SITE on when it hands /login across.
  assert.equal(site.accountOrigin('1', 'http://localhost:8081', 'development'), '');
  assert.equal(site.accountOrigin('1', undefined, 'development'), '');
  assert.equal(site.accountOrigin('', 'https://nestyk.com', 'production'), 'https://nestyk.com');
  assert.equal(site.accountOrigin(undefined, undefined, 'development'), 'http://localhost:8081', 'unset = as before');
});

test('sign-in and sign-up links carry the page the guest is on, so login brings them back (AUTH-1.4)', () => {
  assert.equal(site.accountUrlWithNext('signIn', '', '/en/search?beds=1&sort=price'), '/login?next=%2Fen%2Fsearch%3Fbeds%3D1%26sort%3Dprice');
  assert.equal(site.accountUrlWithNext('register', '', '/saved'), '/register?next=%2Fsaved');
  assert.equal(site.accountUrlWithNext('signIn', '', '/'), '/login?next=%2F');
  assert.equal(site.accountUrlWithNext('signIn', 'http://localhost:8081', '/ja/search'), 'http://localhost:8081/login?next=%2Fja%2Fsearch');
  assert.equal(site.accountUrlWithNext('signIn', '', '/search#top'), '/login?next=%2Fsearch', 'no hash');
});

test('only an in-site path becomes `next`; anything else leaves the link plain', () => {
  assert.equal(site.safeGuestNext('/en/search?beds=1'), '/en/search?beds=1');
  for (const bad of [undefined, '', 'search', '//evil.example/x', '/\\evil.example', 'https://evil.example/', 'javascript:alert(1)', '/a\nb']) {
    assert.equal(site.safeGuestNext(bad), null, String(bad));
  }
  assert.equal(site.accountUrlWithNext('signIn', '', '//evil.example'), '/login');
  assert.equal(site.safeGuestNext('/' + 'x'.repeat(2100)), null, 'very long paths are dropped');
});

test('the header menu has the 5 items of design v2.3 in order, and pages not built yet are "coming soon"', () => {
  assert.deepEqual(site.GUEST_NAV.map((item) => item.key), ['search', 'areas', 'commute', 'articles', 'about']);
  for (const item of site.GUEST_NAV) {
    assert.equal(typeof item.href, 'string');
    assert.ok(item.href.startsWith('/'), `${item.key} href is an in-site path`);
  }
  // The search page is built (S4.2, 12 Nov 2026); areas, commute, articles and about are not there yet.
  assert.equal(site.isGuestPageReady('search'), true);
  for (const key of ['areas', 'commute', 'articles', 'about']) assert.equal(site.isGuestPageReady(key), false, key);
});

test('the tab bar has 4 tabs like the app, and every ready tab opens a page that exists', () => {
  assert.deepEqual(site.GUEST_TABS.map((tab) => tab.key), ['home', 'search', 'saved', 'profile']);
  assert.deepEqual(site.GUEST_TABS.map((tab) => tab.href), ['/', '/search', '/saved', '/profile']);
  for (const key of ['home', 'search', 'saved', 'profile']) assert.equal(site.isGuestPageReady(key), true, key);
});

test('the active tab follows the path, and a deeper page keeps its section active', () => {
  assert.equal(site.activeTabKey('/'), 'home');
  assert.equal(site.activeTabKey('/saved'), 'saved');
  assert.equal(site.activeTabKey('/profile'), 'profile');
  assert.equal(site.activeTabKey('/search'), 'search');
  assert.equal(site.activeTabKey('/search/map'), 'search');
  assert.equal(site.activeTabKey('/rooms/sample-asok-01'), null);
});

test('the 4 languages match the URL locales and use their own names', () => {
  const routing = fs.readFileSync(path.join(__dirname, '../i18n/routing.ts'), 'utf8');
  const locales = JSON.parse(routing.match(/locales:\s*(\[[^\]]*\])/)[1].replace(/'/g, '"'));
  assert.deepEqual(site.LANGUAGE_OPTIONS.map((option) => option.code), locales);
  assert.deepEqual(site.LANGUAGE_OPTIONS.map((option) => option.name), ['ไทย', 'English', '日本語', '中文']);
  assert.deepEqual(site.LANGUAGE_OPTIONS.map((option) => option.short), ['TH', 'EN', 'JA', 'ZH']);
  assert.equal(site.languageName('ja'), '日本語');
  assert.equal(site.languageName('xx'), 'ไทย');
});

test('contact data is the real company contact, with a phone link that works from abroad', () => {
  assert.equal(site.GUEST_CONTACT.phone, '097-824-2922');
  assert.equal(site.GUEST_CONTACT.email, 'contact@nestyk.com');
  assert.equal(site.telHref('097-824-2922'), 'tel:+66978242922');
  assert.equal(site.mailHref('contact@nestyk.com'), 'mailto:contact@nestyk.com');
  assert.equal(
    site.mapsUrl('138 ถนนวิทยุ'),
    'https://www.google.com/maps/search/?api=1&query=138%20%E0%B8%96%E0%B8%99%E0%B8%99%E0%B8%A7%E0%B8%B4%E0%B8%97%E0%B8%A2%E0%B8%B8',
  );
});

test('social icons cover the 7 channels and an icon without a real https link is not shown', () => {
  assert.deepEqual(site.GUEST_SOCIAL.map((item) => item.id), ['facebook', 'instagram', 'youtube', 'tiktok', 'line', 'whatsapp', 'linkedin']);
  const list = [
    { id: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/nestyk' },
    { id: 'instagram', label: 'Instagram', url: '' },
    { id: 'youtube', label: 'YouTube', url: 'http://youtube.com/x' },
    { id: 'line', label: 'LINE', url: 'javascript:alert(1)' },
  ];
  assert.deepEqual(site.visibleSocialLinks(list).map((item) => item.id), ['facebook']);
});

test('every NESTYK channel has its real link (Mos 12 Nov 2026), so all 7 icons show', () => {
  assert.deepEqual(site.visibleSocialLinks(site.GUEST_SOCIAL).map((item) => item.id), site.GUEST_SOCIAL.map((item) => item.id));
  const url = Object.fromEntries(site.GUEST_SOCIAL.map((item) => [item.id, item.url]));
  assert.equal(url.line, 'https://line.me/R/ti/p/@370llprm', 'no tracking parameters');
  assert.equal(url.whatsapp, 'https://wa.me/66978242922', 'international number, or WhatsApp cannot find it');
  for (const item of site.GUEST_SOCIAL) assert.doesNotMatch(item.url, /[?&](ts|oat_content|utm_\w+)=/, item.id);
});

test('links built on the server carry the language prefix of the URL rules (Thai has none)', () => {
  assert.equal(site.localePath('th', '/profile'), '/profile');
  assert.equal(site.localePath('th', '/'), '/');
  assert.equal(site.localePath('en', '/'), '/en');
  assert.equal(site.localePath('en', '/profile'), '/en/profile');
  assert.equal(site.localePath('ja', '/search?type=condo'), '/ja/search?type=condo');
  assert.equal(site.localePath('zh', '/#areas'), '/zh#areas');
  assert.equal(site.localePath('en', '/?tab=new'), '/en?tab=new');
});
