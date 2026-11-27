// Mobile search (Mos 25 Nov 2026, canvas page "searchnew" N1 + D2–D6): home on phones is only a search bar that opens
// /find; /find holds the place box, recent searches and the type / rent / bedrooms dropdowns; only "ดูห้อง" or a recent
// search opens the results. Desktop keeps the full search panel.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const css = read('app/[locale]/guest.css');

test('home on phones: only the search bar, a link to /find; the full row stays for wide screens', () => {
  const panel = read('app/components/guest/SearchPanel.tsx');
  assert.match(panel, /<Link\s+href="\/find"\s+className="nk-search__find"[\s\S]*?sessionStorage\.setItem\(FIND_FROM_SITE, '1'\)[\s\S]*?data-testid="guestHome\.findLink"/);
  assert.match(css, /\n\.nk-search__find \{\s*display: none;/);
  const block = css.slice(css.indexOf('/* ===== Mobile search (Mos 25 Nov 2026'));
  assert.match(block, /@media \(max-width: 960px\) \{[\s\S]*?\.nk-search \.nk-search__find \{\s*min-height: 48px;[\s\S]*?\.nk-search \.nk-search__row,\s*\.nk-search \.nk-search__quick \{\s*display: none;/);
});

test('/find: a pick fills the box only; "ดูห้อง" and recent searches open the results and are remembered', () => {
  const page = read('app/components/guest/SearchStart.tsx');
  const pick = page.slice(page.indexOf('const pickLocation'), page.indexOf('const open = '));
  assert.equal(/router\.push/.test(pick), false, 'picking a place never leaves the page');
  assert.match(page, /const open = \(input: HomeSearchInput\) => \{\s*const next = addRecentSearch\(readRecent\(\), input\);\s*saveRecent\(next\);\s*router\.push\(homeSearchHref\(input\)\);/);
  assert.match(page, /onClick=\{submit\}\s*disabled=\{!place\}[\s\S]*?data-testid="find\.submit"/);
  assert.match(page, /onClick=\{\(\) => open\(item\)\} data-testid="find\.recent"/);
  assert.match(page, /menuRole = 'radiogroup'/);
  assert.match(page, /menuRole=\{customPrice \? 'group' : 'radiogroup'\}/, 'the custom range is not a radio group (review R5)');
  assert.match(page, /aria-controls=\{open \? `\$\{id\}-menu` : undefined\}/);
  assert.match(page, /requestAnimationFrame\(\(\) => toggles\.current\[field\]\?\.focus\(\)\)/, 'a choice gives focus back to its field (review R2)');
  const box = read('app/components/guest/LocationCombobox.tsx');
  assert.match(box, /if \(!isOpen \|\| !suggesting \|\| view !== 'list'/, 'no Google question for a picked name (review R1)');
  assert.match(read('app/[locale]/(marketplace)/find/page.tsx'), /guestPageMetadata\(\{ locale, path: '\/find', title, index: false \}\)/);
  assert.equal(/'\/find'/.test(read('app/sitemap.ts')), false, 'not in the sitemap');
});

test('/find while typing: one line of the filters set sits above "ล้าง / ดูห้อง"; a tap brings the filters back', () => {
  // Mos 25 Nov 2026, canvas page "findsummary" (FindSumA / FindSumB).
  const box = read('app/components/guest/LocationCombobox.tsx');
  assert.match(box, /onSuggestingChange\?\.\(mode === 'page' && suggesting && view === 'list'\)/, 'the box says when its suggestions cover the filters');
  assert.match(box, /useImperativeHandle\(handle, \(\) => \(\{\s*stopTyping: \(\) => \{\s*setTyping\(false\);\s*setView\('list'\);\s*inputRef\.current\?\.blur\(\);/, 'stop typing hides the suggestions and the keyboard');
  assert.match(box, /export const LocationPageBox = forwardRef<LocationPageHandle/);
  const page = read('app/components/guest/SearchStart.tsx');
  assert.match(page, /const summary = \[type \? \(copy\.propertyType as Record<string, string>\)\[type\] : null, priceText, bedrooms \? bedroomLabel\(bedrooms\) : null\]\s*\.filter\(Boolean\)\s*\.join\(' · '\);/);
  const bar = page.slice(page.indexOf('className="nk-find__bar">'), page.indexOf('data-testid="find.clear"'));
  assert.match(bar, /\{suggesting && summary \? \(\s*<button[\s\S]*?className="nk-find__summary"[\s\S]*?aria-label=\{`\$\{find\.editFilters\}: \$\{summary\}`\}[\s\S]*?data-testid="find\.summary"/, 'only while typing and only when a filter is set, before "ล้าง"');
  assert.match(page, /const showFilters = \(\) => \{\s*placeBox\.current\?\.stopTyping\(\);\s*requestAnimationFrame\(\(\) => toggles\.current\.type\?\.focus\(\)\);/, 'focus lands on the first filter, so the keyboard goes down');
  const block = css.slice(css.indexOf('.nk-find__bar {'));
  assert.match(block, /\.nk-find__bar \{[^}]*flex-wrap: wrap;/);
  assert.match(css, /\.nk-find__summary-text \{[^}]*overflow: hidden;[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/);
});

test('every language has the /find words', () => {
  for (const lang of ['th', 'en', 'ja', 'zh']) {
    const copy = read(`../../packages/i18n/src/locales/guest/${lang}.ts`);
    const block = copy.slice(copy.indexOf('  find: {'), copy.indexOf('  appBar: {'));
    for (const key of ['title', 'close', 'recentHeading', 'filtersHeading', 'anywhere', 'customPrice', 'apply', 'clearAll', 'showRooms', 'editFilters']) {
      assert.match(block, new RegExp(`\\n    ${key}: '[^']+',`), `${lang} ${key}`);
    }
  }
});

// Mos 27 Nov 2026: no search without a place. "ดูห้อง" waits for a place, the footer types open /find with the type,
// and no link opens /search without a place (those now go home).
test('/find: "ดูห้อง" is off until a place is picked, and a type from the address is chosen already', () => {
  const page = read('app/components/guest/SearchStart.tsx');
  assert.match(page, /disabled=\{!place\}/);
  assert.match(page, /aria-describedby=\{place \? undefined : `\$\{id\}-need`\}/);
  assert.match(page, /const submit = \(\) => \{\s*if \(!place\) \{\s*openPlaceBox\(`\$\{id\}-place`\);\s*return;\s*\}/);
  assert.match(page, /setType\(findStartType\(window\.location\.search\)\)/);
  assert.match(page, /picked=\{place !== null\}/);
  assert.doesNotMatch(page, /kind === 'keyword'/);
  assert.match(css, /\.nk-find__go:disabled \{/);
  const panel = read('app/components/guest/SearchPanel.tsx');
  assert.match(panel, /if \(!place\) \{\s*openPlaceBox\(`\$\{id\}-q`\);\s*return;\s*\}/, 'desktop "ค้นหา" without a place opens the place list');
  assert.doesNotMatch(panel, /kind === 'keyword'|\{ keyword \}/);
  assert.match(read('app/components/guest/GuestFooter.tsx'), /href: findHref\(type\)/);
});

test('no link opens /search without a place', () => {
  for (const file of [
    'app/components/guest/ViewingRequestsList.tsx',
    'app/[locale]/(marketplace)/areas/page.tsx',
    'app/[locale]/(marketplace)/rooms/[id]/page.tsx',
    'app/[locale]/(marketplace)/rooms/[id]/not-found.tsx',
    'app/components/guest/GuestFooter.tsx',
  ]) {
    assert.doesNotMatch(read(file), /['"`]\/search['"`?]/, file);
  }
  const room = read('app/[locale]/(marketplace)/rooms/[id]/page.tsx');
  assert.match(room, /const nearbySearch = roomNearbySearch\(room\);/);
  assert.doesNotMatch(room, /searchHref\(\{ keyword:/);
});
