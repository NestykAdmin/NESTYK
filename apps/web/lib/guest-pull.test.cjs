// Pull to refresh in the app (Mos 25 Nov 2026, canvas page "ptr", design A): the page follows the finger, the gap
// above is ink with the yellow smile filling up, letting go reloads the page's data without reloading the page.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);

const pull = require('./guest-pull.ts');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('pages with lists can be pulled; the map, /find and the rest cannot', () => {
  for (const [p, q] of [['/', ''], ['/en', ''], ['/search', '?area=sukhumvit'], ['/ja/search', ''], ['/saved', ''], ['/zh/viewing-requests', ''], ['/rooms/31', ''], ['/en/rooms/k3xp9a2m', '']]) {
    assert.equal(pull.pullAllowed(p, q), true, p + q);
  }
  for (const [p, q] of [['/search', '?view=map&area=x'], ['/en/search', '?view=map'], ['/find', ''], ['/en/find', ''], ['/profile', ''], ['/rooms', ''], ['/english', '']]) {
    assert.equal(pull.pullAllowed(p, q), false, p + q);
  }
});

test('the page moves half as far as the finger, up to a limit; past 72 px it reloads', () => {
  assert.equal(pull.pullOffset(-20), 0);
  assert.equal(pull.pullOffset(0), 0);
  assert.equal(pull.pullOffset(100), 50);
  assert.equal(pull.pullOffset(1000), pull.PULL_MAX);
  assert.equal(pull.PULL_THRESHOLD, 72);
  assert.equal(pull.pullProgress(36), 0.5);
  assert.equal(pull.pullProgress(200), 1);
  assert.equal(pull.pullProgress(-5), 0);
});

test('a refresh asks every list on the page and waits for all of them', async () => {
  const target = new EventTarget();
  const seen = [];
  const off1 = pull.onRefresh(target, async () => (seen.push('saved'), true));
  const off2 = pull.onRefresh(target, async () => (seen.push('requests'), true));
  assert.equal(await pull.requestRefresh(target), true);
  assert.deepEqual(seen, ['saved', 'requests']);
  const off3 = pull.onRefresh(target, async () => false);
  assert.equal(await pull.requestRefresh(target), false, 'one list failed');
  off3();
  const off4 = pull.onRefresh(target, async () => { throw new Error('network'); });
  assert.equal(await pull.requestRefresh(target), false, 'a throw counts as failed');
  off4(); off1(); off2();
  assert.equal(await pull.requestRefresh(target), true, 'nothing listening: nothing to fail');
});

test('the pull lives in the guest frame, only in the app, and the lists reload on it', () => {
  assert.match(read('app/components/guest/GuestShell.tsx'), /<main id="main" className="nk-main">\s*\{\/\*[^*]*\*\/\}\s*<GuestPullRefresh \/>\s*\{children\}/, 'inside the page, so it moves with it');
  const comp = read('app/components/guest/GuestPullRefresh.tsx');
  assert.match(comp, /if \(!inApp\(\)\) return;/);
  assert.match(comp, /pullAllowed\(window\.location\.pathname, window\.location\.search\)/);
  assert.match(comp, /window\.scrollY > 0/);
  assert.match(comp, /\[aria-modal="true"\]/, 'not while a dialog or a sheet is open');
  assert.match(comp, /router\.refresh\(\)/);
  assert.match(comp, /requestRefresh\(window\)/);
  assert.match(comp, /addEventListener\('touchmove', move, \{ passive: false \}\)/);
  for (const file of ['SavedRooms.tsx', 'SavedRoomsList.tsx', 'ViewingRequestsList.tsx']) {
    assert.match(read(`app/components/guest/${file}`), /onRefresh\(window,/, file);
  }
  const css = read('app/[locale]/guest.css');
  assert.match(css, /html\[data-nk-app\] \{[^}]*overscroll-behavior-y: none;/);
  assert.match(css, /html\[data-nk-app\]\[data-nk-pull\] \.nk-main \{[^}]*position: relative;[^}]*top: var\(--nk-pull, 0px\);/, 'top, not transform: fixed bars inside the page stay put');
  assert.equal(/data-nk-pull\] \.nk-appbar/.test(css), false, 'the app bar stays put (two parts moving apart looked torn)');
  assert.match(css, /html\[data-nk-app\]\[data-nk-pull\] \.nk-ptr \{[^}]*position: absolute;[^}]*top: calc\(-1 \* var\(--nk-pull, 0px\)\);/, 'the gap opens under the app bar, not under the status bar');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.nk-ptr__arc\.is-loading \.nk-ptr__fill \{\s*animation: none;/);
});

test('every language has the pull words', () => {
  for (const lang of ['th', 'en', 'ja', 'zh']) {
    const copy = read(`../../packages/i18n/src/locales/guest/${lang}.ts`);
    const block = copy.slice(copy.indexOf('  pull: {'));
    for (const key of ['hint', 'release', 'loading', 'done', 'failed']) {
      assert.match(block, new RegExp(`\\n    ${key}: '[^']+',`), `${lang} ${key}`);
    }
  }
});
