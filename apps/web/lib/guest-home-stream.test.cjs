// Home in parts (Mos 27 Nov 2026): the hero, search and type tiles show at once; the recommended rooms and the areas
// follow when the API answers, with outlines meanwhile (Next streaming). A cached page (ISR) still comes whole.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const page = read('app/[locale]/(marketplace)/page.tsx');

test('the home page asks the API once and does not wait for it before the top of the page', () => {
  assert.match(page, /const data = loadHomeData\(\);/);
  assert.doesNotMatch(page, /await loadHomeData\(\)/);
  assert.match(page, /import React, \{ Suspense \} from 'react';/);
});

test('the rooms and the areas wait in their own parts, each with an outline; the headings show at once', () => {
  assert.match(page, /<Suspense fallback=\{<HomeListingsSkeleton \/>\}>\s*<HomeListings data=\{data\}/);
  assert.match(page, /<Suspense fallback=\{<HomeAreasSkeleton \/>\}>\s*<HomeAreas data=\{data\}/);
  const listings = page.slice(page.indexOf('data-testid="guestHome.listings"'), page.indexOf('<Suspense fallback={<HomeListingsSkeleton />}>'));
  assert.match(listings, /copy\.home\.featuredTitle/, 'the heading is outside the waiting part');
  for (const name of ['HomeListings', 'HomeAreas']) {
    assert.match(page, new RegExp(`async function ${name}\\(\\{\\s*data,[\\s\\S]*?\\) \\{\\s*const \\{ [a-z, ]+ \\} = await data;`), name);
  }
});

test('home outlines: busy for screen readers, the room card outline and area card outlines', () => {
  const code = read('app/components/guest/PageSkeletons.tsx');
  for (const [name, id] of [['HomeListingsSkeleton', 'home.listings'], ['HomeAreasSkeleton', 'home.areas']]) {
    const body = code.slice(code.indexOf(`export function ${name}`));
    assert.match(body.slice(0, 900), new RegExp(`aria-busy="true" data-testid="skeleton\\.${id.replace('.', '\\.')}"`), name);
  }
  assert.match(code, /className="nk-area nk-area--skeleton"/);
});

test('photos of room and area cards shine while they load, for a few seconds at most, never with reduced motion', () => {
  const css = read('app/[locale]/guest.css');
  const block = css.slice(css.indexOf('/* ===== Page outlines'), css.indexOf('/* ===== End page outlines'));
  assert.match(block, /\.nk-room__media,\s*\.nk-area__media \{[^}]*animation: nk-skel-shine 1\.2s linear 4;/);
  assert.match(block, /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.nk-room__media,\s*\.nk-area__media/);
});
