// Home "recommended" rail on phones, compact A (Mos 24 Nov 2026): narrower cards, shorter photo, tighter text, the
// first card 16px in from the edge. Search results (.nk-search-list) keep their own stacked layout.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'app', '[locale]', 'guest.css'), 'utf8');

test('the phone rail: compact cards, every rule scoped away from the search list', () => {
  const start = css.indexOf('/* Sideways room rails (home "recommended"), compact A');
  assert.ok(start > 0);
  const block = css.slice(start, css.indexOf('.nk-area-grid', start));
  assert.match(block, /\.nk-room-grid:not\(\.nk-search-list\) \{\s*scroll-padding-inline: var\(--nk-space-4\);/);
  assert.match(block, /> \.nk-room \{\s*width: 66%;\s*max-width: 260px;/);
  assert.match(block, /\.nk-room__media \{\s*aspect-ratio: 3 \/ 2;/);
  assert.match(block, /\.nk-room__title \{[^}]*min-height: calc\(2 \* 1\.45em\);/);
  for (const rule of block.match(/^\s+\.nk-room-grid[^{]*\{/gm)) assert.match(rule, /:not\(\.nk-search-list\)/, rule);
  const media = css.lastIndexOf('@media', start);
  assert.match(css.slice(media, media + 40), /@media \(max-width: 960px\)/, 'phones and small tablets only');
});

test('phones: form boxes are 16px so iPhone does not zoom the page on focus', () => {
  assert.match(css, /@media \(max-width: 960px\) \{\s*:is\(input, select, textarea\)\.nk-input \{\s*font-size: 16px;/);
});

