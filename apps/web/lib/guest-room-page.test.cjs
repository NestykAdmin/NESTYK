// S7.3 room page (project-docs/nestyk-guest-room-detail-s73-plan-20261119.md) and its review fixes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const ROOM_DIR = 'app/[locale]/(marketplace)/rooms/[id]';

// Review R1 (Mos 19 Nov 2026: "ลิงก์เข้าหน้าห้องโหลดหน้าใหม่"). The browser keeps the CSP of the document it first
// loaded; a client-side move would keep the strict guest policy and block the room map. Room links load the page.
test('R1: links into and out of a room page load the page, so each page gets its own CSP', () => {
  const card = read('app/components/guest/RoomCard.tsx');
  assert.match(card, /<a href=\{href\} className="nk-stretch">/);
  assert.doesNotMatch(card, /<Link href=\{href\}/);
  const page = read(`${ROOM_DIR}/page.tsx`);
  assert.doesNotMatch(page, /from 'next\/link'/, 'the room page leaves through plain links too');
});

// Review R2: an API failure while the page regenerates must not replace a good cached page with an error page.
test('R2: the room page throws when the API fails; error.tsx shows the error state', () => {
  const page = read(`${ROOM_DIR}/page.tsx`);
  assert.doesNotMatch(page, /<ErrorState/);
  assert.match(page, /throw new Error\(/);
  const error = read(`${ROOM_DIR}/error.tsx`);
  assert.match(error, /^'use client';/);
  assert.match(error, /<ErrorState/);
  assert.match(read(`${ROOM_DIR}/not-found.tsx`), /notFoundTitle/);
});

test('the "near BTS/MRT" tag uses the same distance as the search filter', () => {
  assert.match(read(`${ROOM_DIR}/page.tsx`), /NEAR_TRANSIT_METERS/);
  assert.doesNotMatch(read(`${ROOM_DIR}/page.tsx`), /= 800;/);
});

// Mos 19 Nov 2026: the section tabs show where the reader is (scrollspy), on one page (no separate tab pages).
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const sections = require('./guest-room-sections.ts');

test('scrollspy: the active section is the last one whose top has passed the line under the sticky bars', () => {
  const list = [{ id: 'overview', top: 300 }, { id: 'price', top: 900 }, { id: 'amenities', top: 1400 }];
  assert.equal(sections.activeSectionId(list, 140), 'overview', 'before any section reaches the line: the first');
  assert.equal(sections.activeSectionId([{ id: 'overview', top: 100 }, { id: 'price', top: 120 }, { id: 'amenities', top: 600 }], 140), 'price');
  assert.equal(sections.activeSectionId([{ id: 'overview', top: -900 }, { id: 'price', top: -300 }, { id: 'amenities', top: 140 }], 140), 'amenities', 'exactly on the line counts');
  assert.equal(sections.activeSectionId([], 140), null);
});

test('scrollspy: at the very bottom of the page the last section is active, even if it is short', () => {
  const list = [{ id: 'overview', top: -1200 }, { id: 'location', top: 400 }];
  assert.equal(sections.activeSectionId(list, 140, true), 'location');
});

test('the room page tabs are the scrollspy component, marked with aria-current, and styled when chosen', () => {
  const page = read(`${ROOM_DIR}/page.tsx`);
  assert.match(page, /<RoomSectionTabs/);
  const tabs = read('app/components/guest/room/RoomSectionTabs.tsx');
  assert.match(tabs, /^'use client';/);
  assert.match(tabs, /aria-current=\{active === section\.id \? 'location' : undefined\}/);
  assert.match(tabs, /prefers-reduced-motion/);
  assert.match(tabs, /activeSectionId\(/);
  const css = read('app/[locale]/guest.css');
  assert.match(css, /\.nk-rp-tabs a\[aria-current='location'\]/);
});

// Mos 19 Nov 2026: a cut amenity group shows that it has more by fading its last row, with no count ("ดูคลีน ๆ").
// The button has no count either, and "show fewer" brings the reader back to the section heading.
test('amenities: cut groups fade their last row, the button has no count, and collapsing returns to the heading', () => {
  const amenities = read('app/components/guest/room/RoomAmenities.tsx');
  assert.match(amenities, /nk-rp-amenities__group--more/);
  assert.doesNotMatch(amenities, /seeAllAmenities, \{ count/);
  assert.match(amenities, /ChevronDownIcon/);
  assert.match(amenities, /ChevronUpIcon/);
  assert.match(amenities, /scrollIntoView\(/);
  assert.match(amenities, /prefers-reduced-motion/);
  const css = read('app/[locale]/guest.css');
  assert.match(css, /\.nk-rp-amenities__group--more \.nk-rp-amenities__list \{[^}]*-webkit-mask-image:[^}]*mask-image:/);
  for (const locale of ['th', 'en', 'ja', 'zh']) {
    const src = fs.readFileSync(path.join(__dirname, '../../../packages/i18n/src/locales/guest', `${locale}.ts`), 'utf8');
    const line = src.match(/seeAllAmenities: '([^']*)'/);
    assert.ok(line, `${locale} has seeAllAmenities`);
    assert.doesNotMatch(line[1], /\{count\}/, `${locale}: no count on the button`);
  }
});

// Mos 19 Nov 2026: the room's highlight tags were a cool grey that blended into the white page. They are white with a
// border and a yellow brand tick now. Not brand-soft: that fill means "selected" elsewhere on the site.
test('room highlight tags are white with a border and a yellow tick, not grey', () => {
  const css = read('app/[locale]/guest.css');
  const tag = css.match(/\.nk-rp-tags li \{([^}]*)\}/);
  assert.ok(tag, 'the tag rule exists');
  assert.match(tag[1], /background: var\(--nk-color-surface\)/);
  assert.match(tag[1], /border: 1px solid var\(--nk-color-border\)/);
  assert.doesNotMatch(tag[1], /neutral-bg|brand-soft/);
  assert.match(css, /\.nk-rp-tags svg \{[^}]*color: var\(--nk-color-brand\)/);
});

// SEO-1, room page part (Mos 19 Nov 2026): JSON-LD in the page, the cover as the shared picture, no hreflang.
test('the room page writes its JSON-LD through the escaping helper and shares its cover picture', () => {
  const page = read(`${ROOM_DIR}/page.tsx`);
  assert.match(page, /type="application\/ld\+json"/);
  assert.match(page, /dangerouslySetInnerHTML=\{\{ __html: jsonLdScript\(/);
  assert.match(page, /roomJsonLd\(/);
  assert.match(page, /hreflang: false/);
  assert.match(page, /image: /);
  // The only raw HTML on the page is the escaped JSON-LD.
  assert.equal((page.match(/dangerouslySetInnerHTML/g) || []).length, 1);
});

// Mos 23 Nov 2026: React warned "Each child in a list should have a unique key" (RoomGallery, child from RoomPage):
// server JSX handed to a client component as a prop. The phone overlay (back, share, heart) now sits beside the
// gallery in a positioned wrapper instead of going through a prop.
test('the room page puts the phone overlay beside the gallery, not through a RoomGallery prop', () => {
  const page = read(`${ROOM_DIR}/page.tsx`);
  assert.match(page, /<div className="nk-rp-media">\s*<RoomGallery images=\{room\.imageUrls\} title=\{title\} \/>\s*<div className="nk-rp-overlay">/);
  assert.doesNotMatch(page, /overlay=\{/);
  const gallery = read('app/components/guest/room/RoomGallery.tsx');
  assert.doesNotMatch(gallery, /overlay/);
  const css = read('app/[locale]/guest.css');
  assert.match(css, /\.nk-rp-media \{\s*position: relative;/);
});
