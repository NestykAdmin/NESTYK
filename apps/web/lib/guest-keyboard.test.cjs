// /find on phones (Mos 25 Nov 2026, canvas "findsummary"): the bottom bar (filter summary + "ล้าง / ดูห้อง") rides
// above the on-screen keyboard. iOS (Safari and the app's WebView) keeps the page height when the keyboard opens and
// only the visual viewport shrinks, so a bar fixed to the bottom ends up under the keyboard.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);

const { keyboardOffset, KEYBOARD_MIN } = require('./guest-keyboard.ts');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('keyboard open: its height, and how far the bar goes up from the bottom of the page', () => {
  assert.deepEqual(keyboardOffset({ innerHeight: 956, height: 609, offsetTop: 0, scale: 1 }), { height: 347, lift: 347 });
  assert.deepEqual(keyboardOffset({ innerHeight: 956, height: 609.4, offsetTop: 0, scale: 1 }), { height: 347, lift: 347 }, 'whole pixels');
});

test('keyboard open and the guest scrolled the visible area down: still open, the bar goes up less', () => {
  // Seen in the iPhone simulator (Mos 25 Nov 2026): a swipe on the suggestions moved offsetTop to about 244; the old
  // formula fell under KEYBOARD_MIN, said "no keyboard" and dropped the bar back under the keyboard.
  assert.deepEqual(keyboardOffset({ innerHeight: 956, height: 609, offsetTop: 244, scale: 1 }), { height: 347, lift: 103 });
  assert.deepEqual(keyboardOffset({ innerHeight: 956, height: 609, offsetTop: 347, scale: 1 }), { height: 347, lift: 0 });
  assert.deepEqual(keyboardOffset({ innerHeight: 956, height: 609, offsetTop: 400, scale: 1 }), { height: 347, lift: 0 }, 'never below 0');
});

test('no keyboard: 0, also for small changes such as Safari\'s address bar', () => {
  assert.deepEqual(keyboardOffset({ innerHeight: 844, height: 844, offsetTop: 0, scale: 1 }), { height: 0, lift: 0 });
  assert.deepEqual(keyboardOffset({ innerHeight: 844, height: 844 - (KEYBOARD_MIN - 1), offsetTop: 0, scale: 1 }), { height: 0, lift: 0 });
  assert.deepEqual(keyboardOffset({ innerHeight: 844, height: 900, offsetTop: 0, scale: 1 }), { height: 0, lift: 0 });
  assert.equal(KEYBOARD_MIN, 120);
});

test('zoomed in: 0 (a pinch shrinks the visible area too, it is not a keyboard)', () => {
  assert.deepEqual(keyboardOffset({ innerHeight: 844, height: 422, offsetTop: 0, scale: 2 }), { height: 0, lift: 0 });
});

test('/find lifts its bottom bar above the keyboard and keeps room under the list for the bar and the keyboard', () => {
  const page = read('app/components/guest/SearchStart.tsx');
  assert.match(page, /const viewport = window\.visualViewport;\s*if \(!viewport \|\| !node \|\| !bar\) return;/);
  assert.match(page, /viewport\.addEventListener\('resize', update\);\s*viewport\.addEventListener\('scroll', update\);/);
  assert.match(page, /const \{ height, lift \} = keyboardOffset\(\{ innerHeight: window\.innerHeight, height: viewport\.height, offsetTop: viewport\.offsetTop, scale: viewport\.scale \}\);\s*node\.style\.setProperty\('--nk-find-kb', `\$\{height\}px`\);\s*node\.style\.setProperty\('--nk-find-lift', `\$\{lift\}px`\);\s*node\.toggleAttribute\('data-keyboard', height > 0\);/);
  assert.equal(/TEMP-KB-DEBUG|kbdebug/.test(page), false, 'no debug readout left in the page');
  assert.match(page, /new ResizeObserver\(\(\) => node\.style\.setProperty\('--nk-find-bar', `\$\{bar\.offsetHeight\}px`\)\)/);
  assert.match(page, /viewport\.removeEventListener\('resize', update\);\s*viewport\.removeEventListener\('scroll', update\);\s*resize\.disconnect\(\);/);
  const css = read('app/[locale]/guest.css');
  assert.match(css, /\.nk-find \{[^}]*padding-bottom: calc\(var\(--nk-find-bar, 96px\) \+ var\(--nk-find-kb, 0px\) \+ var\(--nk-safe-bottom\)\);/);
  assert.match(css, /\.nk-find__bar \{\s*position: fixed;\s*left: 0;\s*right: 0;\s*bottom: var\(--nk-find-lift, 0px\);/, 'the bar follows the visible area');
  assert.match(css, /\.nk-find\[data-keyboard\] \.nk-find__bar \{\s*padding-bottom: var\(--nk-space-3\);/, 'the keyboard covers the home bar edge');
  assert.match(css, /@media \(min-width: 961px\) \{\s*\.nk-find \{[^}]*padding-bottom: var\(--nk-space-8\);/, 'wide screens keep the bar in the flow');
});
