// Mos 20 Nov 2026: the guest header is white at the top of the page and turns ink (#211e1e) once the page has
// scrolled past it (72px), fading in 200ms (none with reduced motion). Every guest page, desktop header only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('the header marks itself dark once the page has scrolled past it', () => {
  const header = read('app/components/guest/GuestHeader.tsx');
  assert.match(header, /const DARK_AFTER_PX = 72;/);
  assert.match(header, /data-tone=\{dark \? 'dark' : undefined\}/);
  assert.match(header, /window\.scrollY > DARK_AFTER_PX/);
  assert.match(header, /addEventListener\('scroll'/);
  // Both logos are in the page, so switching never waits for a download; the second one is not read out.
  assert.match(header, /logo-nestyk-onBlack\.svg/);
  assert.match(header, /className="nk-logo nk-logo--on-dark"[^>]*alt=""|alt=""[^>]*className="nk-logo nk-logo--on-dark"/);
});

test('the dark header styles its own controls, keeps a visible focus ring and fades only without reduced motion', () => {
  const css = read('app/[locale]/guest.css');
  const dark = (rule) => new RegExp(`\\.nk-header\\[data-tone='dark'\\] ${rule}`);
  assert.match(css, /\.nk-header\[data-tone='dark'\] \{[^}]*background: var\(--nk-color-ink\)/);
  assert.match(css, dark('\\.nk-nav__item'));
  assert.match(css, dark('\\.nk-icon-btn'));
  assert.match(css, dark('\\.nk-signin'));
  assert.match(css, dark('\\.nk-lang__button'));
  assert.match(css, dark('\\.nk-account__chip'));
  // Only the header's own pills: the account menu that opens from it stays light, with its own "soon" pill.
  assert.match(css, dark('\\.nk-nav \\.nk-soon'));
  // The blue ring has too little contrast on ink: yellow there.
  assert.match(css, /\.nk-header\[data-tone='dark'\] :is\(\.nk-header__brand, \.nk-nav__item, \.nk-icon-btn, \.nk-signin, \.nk-lang__button, \.nk-account__chip\):focus-visible \{[^}]*outline-color: var\(--nk-color-brand\)/);
  assert.doesNotMatch(css, /\.nk-header\[data-tone='dark'\] :is\(a, button\)/, 'menu items keep the blue ring on their white panel');
  assert.match(css, /\.nk-logo--on-dark \{[^}]*display: none/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.nk-header,[^}]*transition: none/);
});

// Mos 20 Nov 2026 09:55: on the dark header the ink avatar vanished into the ink bar, and the "soon" menu items were
// almost as light as the open one. Avatar: white circle, ink letters. Soon items: mid grey (placeholder).
test('dark header: the avatar is a white circle and the "soon" items are mid grey', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'app/[locale]/guest.css'), 'utf8');
  assert.match(css, /\.nk-header\[data-tone='dark'\] \.nk-account__chip \.nk-avatar-initials \{[^}]*background: var\(--nk-color-surface\);[^}]*color: var\(--nk-color-ink\)/);
  assert.match(css, /\.nk-header\[data-tone='dark'\] \.nk-nav__item--soon \{[^}]*color: var\(--nk-color-placeholder\)/);
});

// Mos 20 Nov 2026: the logo's letters sit on the menu's middle line. The SVG (618 x 219) has its letters at y 41-142
// with the smile below, so the centred image moves down 8% of its height (18 / 219) to put the letters' middle there.
test('the header logo is centred on its letters, not pinned to the top', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'app/[locale]/guest.css'), 'utf8');
  const rule = css.match(/\.nk-header__brand \.nk-logo \{([^}]*)\}/);
  assert.ok(rule, 'a header-only logo rule (the footer logo keeps its own)');
  assert.match(rule[1], /align-self: center;/);
  assert.match(rule[1], /transform: translateY\(8%\);/);
});
