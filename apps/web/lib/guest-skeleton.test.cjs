// Page outline while a page loads, design A (Mos 27 Nov 2026, canvas page "skeleton"): a page change shows the shape
// of the page that comes in at once (Next loading.tsx), then the real content fills it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const route = (p) => `app/[locale]/(marketplace)/${p}/loading.tsx`;

test('search, room, area and area list pages each have an outline while they load', () => {
  for (const [dir, name] of [['search', 'SearchPageSkeleton'], ['rooms/[id]', 'RoomPageSkeleton'], ['rent/[area]', 'ListPageSkeleton'], ['areas', 'ListPageSkeleton']]) {
    const source = read(route(dir));
    assert.match(source, new RegExp(`import \\{ ${name} \\} from '[./]+components/guest/PageSkeletons';`), dir);
    assert.match(source, new RegExp(`return <${name} />;`), dir);
  }
});

test('outlines are busy for screen readers, say "loading" in the page language, and reuse the room card outline', () => {
  const code = read('app/components/guest/PageSkeletons.tsx');
  for (const id of ['search', 'room', 'list']) assert.match(code, new RegExp(`data-testid="skeleton\\.${id}"`), id);
  // Every outline (pages and the home parts) is busy and says "loading".
  const busy = (code.match(/aria-busy="true"/g) || []).length;
  assert.equal(busy, (code.match(/^export function \w+Skeleton\(/gm) || []).length);
  assert.equal((code.match(/<span className="nk-sr-only">\{t\.guest\.states\.loading\}<\/span>/g) || []).length, busy);
  assert.match(code, /<CardSkeleton key=\{index\} \/>/);
  assert.doesNotMatch(code, /#[0-9a-fA-F]{3,8}\b/);
});

test('outline blocks shine, except when the person asks for less motion', () => {
  const css = read('app/[locale]/guest.css');
  const block = css.slice(css.indexOf('/* ===== Page outlines'), css.indexOf('/* ===== End page outlines'));
  assert.match(block, /\.nk-skel \.nk-skeleton,\s*\.nk-skel__box \{[^}]*animation: nk-skel-shine/);
  assert.match(block, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?animation: none;/);
  assert.match(block, /@keyframes nk-skel-shine/);
  assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}\b/);
});
