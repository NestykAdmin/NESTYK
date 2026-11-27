// Loading screens, design A (Mos 25 Nov 2026, canvas page "loading"): native splash, preload and the guest web's
// loading state are all ink #211E1E, so opening the app never flashes white before the guest page's ink header.
// The preload enters the app by itself once loading is done (no "tap to enter").
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const preload = read('../../packages/ui/src/components/MobilePreloadScreen.tsx');

test('preload: ink background, the logo for dark backgrounds, smile progress on a dark track', () => {
  assert.match(preload, /const INK = '#211E1E';/);
  assert.match(preload, /root: \{[^}]*backgroundColor: INK,/);
  assert.match(preload, /<MobileNestykLogo variant="wordmarkOnDark"/);
  assert.match(preload, /<MobileSmileProgress[\s\S]*?trackColor=\{DARK_TRACK\}/);
  const smile = read('../../packages/ui/src/components/MobileSmileProgress.tsx');
  assert.match(smile, /trackColor = TRACK/, 'other users of the smile keep the light track');
});

test('preload: no circle, glow rings, background picture, corner words, welcome or tap to enter', () => {
  for (const gone of ['preload-background', 'SoftGlowRing', 'glowHalo', 'A MORE CONNECTED TOMORROW', 'copy.welcome', 'copy.tapToEnter', 'preparingEn', 'Pressable']) {
    assert.equal(preload.includes(gone), false, gone);
  }
});

test('preload: enters by itself when the smile is full, at once when the phone asks for less motion', () => {
  assert.match(preload, /const handleFilled = useCallback\(\(\) => \{\s*if \(reduceMotion\) \{\s*onEnter\?\.\(\);\s*return;\s*\}/);
  assert.match(preload, /onFilled=\{ready \? handleFilled : undefined\}/);
  assert.match(preload, /useReducedMotion\(\)/);
  assert.match(preload, /accessibilityRole="progressbar"|accessibilityLabel=\{copy\.preparing\}/);
});

test('native splash: ink background and the logo for dark backgrounds', () => {
  const config = read('app.config.js');
  assert.match(config, /splash: \{\s*image: '\.\/assets\/splash-icon-dark\.png',\s*resizeMode: 'contain',\s*backgroundColor: '#211E1E',/);
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets/splash-icon-dark.png')));
});

test('guest web in the app: the page outline while it loads, not a spinner', () => {
  const view = read('components/GuestWebView.tsx');
  assert.match(view, /renderLoading=\{\(\) => <GuestWebSkeleton \/>\}/);
  assert.equal(/ActivityIndicator/.test(view), false);
  const skeleton = read('components/GuestWebSkeleton.tsx');
  assert.match(skeleton, /backgroundColor: INK/);
  assert.match(skeleton, /accessibilityLabel=\{t\.mobile\.preload\.preparing\}/);
});

test('every language has its own "preparing" words (English was Thai)', () => {
  const words = {};
  for (const lang of ['th', 'en', 'ja', 'zh']) {
    const copy = read(`../../packages/i18n/src/locales/${lang}.ts`);
    words[lang] = copy.slice(copy.indexOf('preload: {')).match(/preparing: '([^']+)'/)[1];
  }
  assert.equal(words.en, 'Preparing your space');
  assert.notEqual(words.th, words.en);
});

// Speed (Mos 27 Nov 2026): the preload no longer holds a ready app for 1.1 s; the guest page loads behind it anyway.
test('preload: waits at least 600 ms, not 1.1 s, and the app mounts behind it meanwhile', () => {
  const layout = read('app/_layout.tsx');
  assert.match(layout, /const PRELOAD_MIN_MS = 600;/);
  assert.match(layout, /\{children\}\s*\{showPreload \?/);
});
