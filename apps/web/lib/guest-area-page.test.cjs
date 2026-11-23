// SEO-1 area pages /rent/<slug> and /areas (Mos 20 Nov 2026, design A on the canvas page "area").
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const AREA_PAGE = 'app/[locale]/(marketplace)/rent/[area]/page.tsx';
const LIST_PAGE = 'app/[locale]/(marketplace)/areas/page.tsx';

test('the area page is kept 5 minutes like the other guest pages', () => {
  assert.match(read(AREA_PAGE), /export const revalidate = 300;/);
  assert.match(read(LIST_PAGE), /export const revalidate = 300;/);
  assert.match(read('lib/guest-area-data.ts'), /AREA_DATA_REVALIDATE_SECONDS = 300;/);
});

test('an unknown slug is a 404; a known area with no rooms is open but not indexed', () => {
  const page = read(AREA_PAGE);
  assert.match(page, /isKnownArea\(/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /index: areaPageIndex\(/);
  assert.match(page, /<EmptyState/);
});

test('an API failure throws, so a failed regeneration keeps the last good page (as the room page)', () => {
  for (const file of [AREA_PAGE, LIST_PAGE]) {
    const page = read(file);
    assert.doesNotMatch(page, /<ErrorState/, file);
    assert.match(page, /throw new Error\(/, file);
  }
  assert.match(read('app/[locale]/(marketplace)/rent/[area]/error.tsx'), /<ErrorState/);
  assert.match(read('app/[locale]/(marketplace)/areas/error.tsx'), /<ErrorState/);
});

test('the area page has its breadcrumb in JSON-LD, hreflang for the 4 languages and the cover as the shared picture', () => {
  const page = read(AREA_PAGE);
  assert.match(page, /jsonLdScript\(jsonLd\)/);
  assert.match(page, /areaJsonLd\(/);
  assert.doesNotMatch(page, /hreflang: false/, 'all 4 languages are indexed (Mos 20 Nov 2026)');
  assert.match(page, /image: /);
});

test('"see all" and the search button open the search for this area', () => {
  const page = read(AREA_PAGE);
  assert.match(page, /searchHref\(\{ area: slug \}\)/);
  assert.match(page, /AREA_PAGE_ROOM_LIMIT|loadAreaRooms\(/);
});

test('the area list splits Bangkok and the province zones and hides a group with no areas', () => {
  const page = read(LIST_PAGE);
  assert.match(page, /splitByRegion\(/);
  assert.match(page, /bangkok\.length \?/);
  assert.match(page, /province\.length \?/);
  assert.match(page, /path: '\/areas'/);
});

test('the header menu opens /areas, and the area pages are turned on', () => {
  const site = read('lib/guest-site.ts');
  assert.match(site, /areas: true,/);
  assert.match(site, /rent: true,/);
  assert.match(site, /\{ key: 'areas', href: '\/areas' \}/);
});

// Mos 20 Nov 2026 (canvas HomeZonesWeb): home "ทำเลยอดนิยม" is the Bangkok group with "ดูทุกทำเล"; the province zones
// get their own row with "ดูทุกโซน", hidden when no zone has rooms. The home loads every area to split them.
test('the home page splits Bangkok areas and province zones and links to /areas', () => {
  const home = read('app/[locale]/(marketplace)/page.tsx');
  assert.match(home, /homeAreaGroups\(/);
  assert.match(home, /copy\.areaPage\.seeAllAreas/);
  assert.match(home, /copy\.areaPage\.seeAllZones/);
  assert.match(home, /province\.length \?/);
  assert.match(home, /<ZoneCard/);
  assert.match(read('app/[locale]/(marketplace)/areas/page.tsx'), /<ZoneCard/);
  assert.match(read('lib/guest-rooms.ts'), /HOME_AREA_LIMIT = 20;/);
});

// SEO-1 (Mos 20 Nov 2026): /areas and the area pages that have rooms are in the sitemap in all 4 languages.
test('the sitemap adds /areas and the area pages with rooms, every language, and survives an API failure', () => {
  const sitemap = read('app/sitemap.ts');
  assert.match(sitemap, /areaSitemapPaths\(/);
  assert.match(sitemap, /sitemapEntries\(origin, indexable, areaPaths\)/);
  assert.match(sitemap, /\[sitemap\] public areas failed/);
});
