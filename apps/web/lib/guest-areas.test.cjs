// SEO-1 area pages /rent/<slug> and the area list /areas (Mos 20 Nov 2026, design A on the S7.1 canvas, page "area").
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);

const areas = require('./guest-areas.ts');
const SITE = 'https://nestyk.com';
const summary = (slug, region = 'bangkok', roomCount = 3) => ({ slug, name: slug, region, transitLines: [], roomCount, priceFrom: 9000, coverImageUrl: null });

test('an area slug is known only when it has a name in the copy (the API areas table)', () => {
  const names = { sukhumvit: 'สุขุมวิท', chonburi: 'ชลบุรี' };
  assert.equal(areas.isKnownArea('sukhumvit', names), true);
  for (const bad of ['sukhumvit-asok', '', 'constructor', '__proto__', 'toString']) assert.equal(areas.isKnownArea(bad, names), false, bad);
  assert.equal(areas.areaPagePath('sukhumvit'), '/rent/sukhumvit');
});

test('areas split into Bangkok areas and province zones, keeping the API order', () => {
  const list = [summary('sukhumvit'), summary('chonburi', 'province'), summary('silom-sathorn'), summary('phuket', 'province')];
  const { bangkok, province } = areas.splitByRegion(list);
  assert.deepEqual(bangkok.map((a) => a.slug), ['sukhumvit', 'silom-sathorn']);
  assert.deepEqual(province.map((a) => a.slug), ['chonburi', 'phuket']);
});

test('other areas on an area page: same region, not this one, at most four', () => {
  const list = ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => summary(s)).concat([summary('p', 'province')]);
  assert.deepEqual(areas.otherAreas(list, 'b').map((a) => a.slug), ['a', 'c', 'd', 'e']);
  assert.deepEqual(areas.otherAreas(list, 'p').map((a) => a.slug), [], 'no other province zone with rooms');
  assert.deepEqual(areas.otherAreas(list, 'missing', 'province').map((a) => a.slug), ['p'], 'an area with no rooms uses its region');
});

test('an area page is indexed only when it has rooms; the sitemap lists /areas and those pages', () => {
  assert.equal(areas.areaPageIndex(3), true);
  assert.equal(areas.areaPageIndex(0), false);
  const list = [summary('sukhumvit'), summary('chonburi', 'province', 0)];
  assert.deepEqual(areas.areaSitemapPaths(list), ['/areas', '/rent/sukhumvit']);
});

test('area breadcrumb JSON-LD: home, popular areas, this area; none without a site address', () => {
  const data = areas.areaJsonLd({ origin: SITE, locale: 'en', slug: 'sukhumvit', name: 'Sukhumvit', homeName: 'Home', listName: 'Popular areas' });
  const crumbs = data['@graph'][0].itemListElement;
  assert.deepEqual(crumbs.map((c) => [c.position, c.name, c.item]), [
    [1, 'Home', `${SITE}/en`],
    [2, 'Popular areas', `${SITE}/en/areas`],
    [3, 'Sukhumvit', `${SITE}/en/rent/sukhumvit`],
  ]);
  assert.equal(areas.areaJsonLd({ origin: '', locale: 'th', slug: 'x', name: 'x', homeName: 'h', listName: 'l' }), null);
});

// Mos 20 Nov 2026 (canvas HomeZonesWeb): the home page shows up to 6 Bangkok areas and up to 6 province zones.
test('the home page takes up to 6 areas of each group, in the API order', () => {
  const list = [
    ...['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((slug) => summary(slug)),
    ...['p1', 'p2'].map((slug) => summary(slug, 'province')),
  ];
  const groups = areas.homeAreaGroups(list);
  assert.deepEqual(groups.bangkok.map((area) => area.slug), ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.deepEqual(groups.province.map((area) => area.slug), ['p1', 'p2']);
  assert.equal(areas.HOME_GROUP_LIMIT, 6);
  assert.deepEqual(areas.homeAreaGroups([]), { bangkok: [], province: [] });
});
