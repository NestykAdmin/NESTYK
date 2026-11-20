// Mos 20 Nov 2026: saved rooms page layout A (card grid + toolbar: count and a sort), plus the header's saved button
// (filled ink heart instead of a yellow fill) and the account avatar (ink with a 2px yellow ring).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);

const sorting = require('./guest-saved-sort.ts');
const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const card = (id, priceFrom) => ({ id, priceFrom });

test('saved rooms sort: newest saved keeps the API order; price sorts put rooms with no price last', () => {
  const cards = [card('a', 12000), card('b', null), card('c', 9000), card('d', 12000), card('e', 15000)];
  assert.deepEqual(sorting.SAVED_SORT_OPTIONS, ['saved', 'price_asc', 'price_desc']);
  assert.deepEqual(sorting.sortSavedCards(cards, 'saved').map((c) => c.id), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(sorting.sortSavedCards(cards, 'price_asc').map((c) => c.id), ['c', 'a', 'd', 'e', 'b'], 'ties keep their saved order');
  assert.deepEqual(sorting.sortSavedCards(cards, 'price_desc').map((c) => c.id), ['e', 'a', 'd', 'c', 'b']);
  assert.deepEqual(cards.map((c) => c.id), ['a', 'b', 'c', 'd', 'e'], 'the list given is not changed');
  assert.equal(sorting.isSavedSort('price_asc'), true);
  assert.equal(sorting.isSavedSort('distance'), false);
});

test('the saved list has a toolbar with the room count and a labelled sort, like the search page', () => {
  const list = read('app/components/guest/SavedRoomsList.tsx');
  assert.match(list, /className="nk-search-toolbar nk-saved-toolbar"/);
  assert.match(list, /fillTemplate\(copy\.saved\.count, \{ count:/);
  assert.match(list, /<label htmlFor=\{sortId\} className="nk-search-toolbar__sort">/);
  assert.match(list, /SAVED_SORT_OPTIONS\.map/);
  assert.match(list, /sortSavedCards\(list\.cards, sort\)/);
  assert.match(list, /data-testid="saved\.sort"/);
});

test('the new saved-page copy exists in all 4 languages', () => {
  for (const locale of ['th', 'en', 'ja', 'zh']) {
    const src = read(`../../packages/i18n/src/locales/guest/${locale}.ts`);
    assert.match(src, /\n    count: '[^']*\{count\}[^']*',/, `${locale} saved.count`);
    assert.match(src, /\n    sortSaved: '[^']+',/, `${locale} saved.sortSaved`);
  }
  const types = read('../../packages/i18n/src/locales/guest/types.ts');
  assert.match(types, /sortSaved: string;/);
});

test('header: the current saved button is a filled ink heart (no yellow fill); the avatar has a yellow ring', () => {
  const css = read('app/[locale]/guest.css');
  const current = css.match(/\n\.nk-icon-btn\[aria-current="page"\] \{([^}]*)\}/);
  assert.ok(current);
  assert.doesNotMatch(current[1], /brand-soft/);
  assert.match(css, /\.nk-icon-btn\[aria-current="page"\] svg \{[^}]*fill: currentColor/);
  assert.match(css, /\.nk-header\[data-tone='dark'\] \.nk-icon-btn\[aria-current="page"\] \{[^}]*border-color: var\(--nk-color-surface\)/);
  assert.doesNotMatch(css, /\.nk-header\[data-tone='dark'\] \.nk-icon-btn\[aria-current="page"\] \{[^}]*brand-soft/);
  // Mos 20 Nov 2026 09:53: the ring all the time was too loud. Yellow only on hover or with the menu open.
  assert.doesNotMatch(css, /\n\.nk-account__chip \.nk-avatar-initials \{/);
  assert.match(css, /\.nk-account__chip:is\(:hover, :focus-visible, \[aria-expanded="true"\]\) \.nk-avatar-initials \{[^}]*box-shadow: 0 0 0 2px var\(--nk-color-brand\)/);
  assert.doesNotMatch(css, /\.nk-header\[data-tone='dark'\] \.nk-account__chip \.nk-avatar-initials \{[^}]*background: var\(--nk-color-brand\)/);
});

// Mos 20 Nov 2026 09:53: the three header controls (language, saved, account) share a light border; ink only when
// chosen (hover, menu open, current page), so a dark border means one thing.
test('header controls share a light border and turn ink only when chosen', () => {
  const css = read('app/[locale]/guest.css');
  const chip = css.match(/\n\.nk-account__chip \{([^}]*)\}/);
  assert.ok(chip);
  assert.match(chip[1], /border: 1px solid var\(--nk-color-border\)/);
  assert.match(chip[1], /padding: 0 10px 0 6px/);
  assert.match(css, /\.nk-account__chip:hover,\n\.nk-account__chip\[aria-expanded="true"\] \{[^}]*border-color: var\(--nk-color-ink\)/);
  assert.match(css, /\.nk-header :is\(\.nk-icon-btn, \.nk-lang__button\):hover \{[^}]*border-color: var\(--nk-color-ink\)/);
  // Dark header: the same rule with its own colours.
  assert.match(css, /\.nk-header\[data-tone='dark'\] \.nk-account__chip \{[^}]*border-color: var\(--nk-color-dark-line\)/);
  assert.match(css, /\.nk-header\[data-tone='dark'\] :is\(\.nk-icon-btn, \.nk-lang__button, \.nk-account__chip\):hover,[^{]*\{[^}]*border-color: var\(--nk-color-surface\)/);
});
