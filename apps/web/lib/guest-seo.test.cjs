const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);

const seo = require('./guest-seo.ts');

const SITE = 'https://nestyk.com';
const APP_DIR = path.join(__dirname, '../app');

test('the site address comes from NEXT_PUBLIC_SITE_ORIGIN; unset means this machine in dev and none in a build', () => {
  assert.equal(seo.siteOrigin('https://nestyk.com', 'production'), 'https://nestyk.com');
  assert.equal(seo.siteOrigin(' https://sit.nestyk.com/some/path/ ', 'production'), 'https://sit.nestyk.com');
  assert.equal(seo.siteOrigin(undefined, 'development'), 'http://localhost:3000');
  assert.equal(seo.siteOrigin('', 'test'), 'http://localhost:3000');
  assert.equal(seo.siteOrigin(undefined, 'production'), '');
  for (const bad of ['javascript:alert(1)', 'nestyk.com', '//nestyk.com', 'ftp://nestyk.com']) {
    assert.equal(seo.siteOrigin(bad, 'production'), '', bad);
  }
});

test('search engines may index the site only when it is switched on AND the address is https', () => {
  assert.equal(seo.isIndexableSite('true', 'https://nestyk.com'), true);
  assert.equal(seo.isIndexableSite(' TRUE ', 'https://nestyk.com'), true);
  // Default is closed: dev, sit and a prod that forgot the setting stay out of search results.
  assert.equal(seo.isIndexableSite(undefined, 'https://nestyk.com'), false);
  assert.equal(seo.isIndexableSite('', 'https://nestyk.com'), false);
  assert.equal(seo.isIndexableSite('1', 'https://nestyk.com'), false);
  assert.equal(seo.isIndexableSite('yes', 'https://nestyk.com'), false);
  assert.equal(seo.isIndexableSite('true', 'http://localhost:3000'), false);
  assert.equal(seo.isIndexableSite('true', ''), false);
});

test('SEO languages are the URL languages, with Thai as the default', () => {
  const routing = fs.readFileSync(path.join(__dirname, '../i18n/routing.ts'), 'utf8');
  const locales = JSON.parse(routing.match(/locales:\s*(\[[^\]]*\])/)[1].replace(/'/g, '"'));
  assert.deepEqual([...seo.SEO_LOCALES], locales);
  assert.equal(seo.DEFAULT_SEO_LOCALE, routing.match(/defaultLocale:\s*'(\w+)'/)[1]);
});

test('an indexable page has its own canonical and the full hreflang set, x-default on the Thai page', () => {
  const home = seo.pageSeo({ origin: SITE, indexable: true, locale: 'th', path: '/' });
  assert.equal(home.canonical, 'https://nestyk.com/');
  assert.deepEqual(home.languages, {
    th: 'https://nestyk.com/',
    en: 'https://nestyk.com/en',
    ja: 'https://nestyk.com/ja',
    zh: 'https://nestyk.com/zh',
    'x-default': 'https://nestyk.com/',
  });
  assert.deepEqual(home.robots, { index: true, follow: true });

  const area = seo.pageSeo({ origin: SITE, indexable: true, locale: 'en', path: '/rent/asok' });
  assert.equal(area.canonical, 'https://nestyk.com/en/rent/asok');
  assert.equal(area.languages.th, 'https://nestyk.com/rent/asok');
  assert.equal(area.languages.ja, 'https://nestyk.com/ja/rent/asok');
  assert.equal(area.languages['x-default'], 'https://nestyk.com/rent/asok');
});

test('a private page (saved, profile) is noindex even on the live site, and lists no hreflang', () => {
  const saved = seo.pageSeo({ origin: SITE, indexable: true, locale: 'ja', path: '/saved', index: false });
  assert.deepEqual(saved.robots, { index: false, follow: true });
  assert.equal(saved.canonical, 'https://nestyk.com/ja/saved');
  assert.equal(saved.languages, null);
});

test('on a site that is not indexable (dev, sit) every page is noindex, nofollow', () => {
  const home = seo.pageSeo({ origin: 'https://sit.nestyk.com', indexable: false, locale: 'th', path: '/' });
  assert.deepEqual(home.robots, { index: false, follow: false });
  assert.equal(home.canonical, 'https://sit.nestyk.com/');
  // hreflang is still written, so the real page head can be checked on dev and sit before going live.
  assert.equal(home.languages.en, 'https://sit.nestyk.com/en');
  assert.equal(home.languages['x-default'], 'https://sit.nestyk.com/');
  const saved = seo.pageSeo({ origin: 'https://sit.nestyk.com', indexable: false, locale: 'th', path: '/saved', index: false });
  assert.deepEqual(saved.robots, { index: false, follow: false });
  assert.equal(saved.languages, null);
});

test('without a site address there is no canonical or hreflang, and the page is noindex', () => {
  const home = seo.pageSeo({ origin: '', indexable: false, locale: 'th', path: '/' });
  assert.equal(home.canonical, null);
  assert.equal(home.languages, null);
  assert.deepEqual(home.robots, { index: false, follow: false });
});

test('page metadata carries canonical, hreflang, robots and Open Graph for the language', () => {
  const data = seo.pageSeo({ origin: SITE, indexable: true, locale: 'ja', path: '/' });
  const meta = seo.toMetadata(data, { locale: 'ja', title: 'T', description: 'D' });
  assert.equal(meta.title, 'T');
  assert.equal(meta.description, 'D');
  assert.equal(meta.alternates.canonical, 'https://nestyk.com/ja');
  assert.equal(meta.alternates.languages['x-default'], 'https://nestyk.com/');
  assert.deepEqual(meta.robots, { index: true, follow: true });
  assert.equal(meta.openGraph.url, 'https://nestyk.com/ja');
  assert.equal(meta.openGraph.locale, 'ja_JP');
  assert.equal(meta.openGraph.siteName, 'NESTYK');
  assert.equal(meta.openGraph.type, 'website');

  // A page that gives no title keeps the title of the layout (the key is left out, not set to undefined).
  const bare = seo.toMetadata(seo.pageSeo({ origin: '', indexable: false, locale: 'th', path: '/' }), { locale: 'th' });
  assert.equal('title' in bare, false);
  assert.equal('description' in bare, false);
  assert.equal(bare.alternates, undefined);
  assert.equal(bare.openGraph.locale, 'th_TH');
  assert.equal('url' in bare.openGraph, false);
});

test('the sitemap lists every language of each indexable page, and is empty on a site that is not indexable', () => {
  assert.deepEqual(seo.sitemapEntries('https://sit.nestyk.com', false, ['/']), []);
  assert.deepEqual(seo.sitemapEntries('', false, ['/']), []);
  const entries = seo.sitemapEntries(SITE, true, ['/', '/rent/asok']);
  assert.deepEqual(entries.map((entry) => entry.url), [
    'https://nestyk.com/', 'https://nestyk.com/en', 'https://nestyk.com/ja', 'https://nestyk.com/zh',
    'https://nestyk.com/rent/asok', 'https://nestyk.com/en/rent/asok', 'https://nestyk.com/ja/rent/asok', 'https://nestyk.com/zh/rent/asok',
  ]);
  assert.equal(entries[1].alternates.languages['x-default'], 'https://nestyk.com/');
  assert.equal(entries[5].alternates.languages.th, 'https://nestyk.com/rent/asok');
});

test('robots.txt lets pages be crawled (so noindex is seen), keeps /api out, and names the sitemap only when indexable', () => {
  const open = seo.robotsRules(SITE, true);
  assert.deepEqual(open.rules, [{ userAgent: '*', allow: '/', disallow: ['/api/'] }]);
  assert.equal(open.sitemap, 'https://nestyk.com/sitemap.xml');
  const closed = seo.robotsRules('https://sit.nestyk.com', false);
  assert.deepEqual(closed.rules, [{ userAgent: '*', allow: '/', disallow: ['/api/'] }]);
  assert.equal('sitemap' in closed, false);
});

function pagesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return pagesUnder(full);
    return entry.name === 'page.tsx' ? [full] : [];
  });
}

test('every guest page sets its canonical and robots through guestPageMetadata', () => {
  const pages = pagesUnder(path.join(APP_DIR, '[locale]'));
  assert.ok(pages.length >= 4, 'expected the guest pages');
  for (const file of pages) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /guestPageMetadata\(/, `${path.relative(APP_DIR, file)} has no guestPageMetadata`);
    assert.doesNotMatch(source, /^'use client'/, `${path.relative(APP_DIR, file)} must be a server component to set metadata`);
  }
});

test('pages people keep to themselves are never indexed', () => {
  for (const page of ['[locale]/(marketplace)/saved/page.tsx', '[locale]/(marketplace)/profile/page.tsx', '[locale]/dev/ui-kit/page.tsx']) {
    assert.match(fs.readFileSync(path.join(APP_DIR, page), 'utf8'), /index:\s*false/, page);
  }
  const share = fs.readFileSync(path.join(APP_DIR, '(share)/layout.tsx'), 'utf8');
  assert.match(share, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/, 'share and signing links');
});

test('hreflang has one source: the page head, not the Link header of the language middleware', () => {
  assert.match(fs.readFileSync(path.join(__dirname, '../i18n/routing.ts'), 'utf8'), /alternateLinks:\s*false/);
});

test('robots.txt and sitemap.xml exist and use the shared rules', () => {
  assert.match(fs.readFileSync(path.join(APP_DIR, 'robots.ts'), 'utf8'), /robotsRules\(/);
  assert.match(fs.readFileSync(path.join(APP_DIR, 'sitemap.ts'), 'utf8'), /sitemapEntries\(/);
});
