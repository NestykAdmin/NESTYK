// Dark mode B+C foundation (Mos, 12-13 Nov 2026): white headings, E2E8F0 body, A8B4C6 muted text, 30% status pills
// (red 34%), "in progress" pill CI slate 100, lifted-grey hover #575151. The app (tokens.ts, ThemeContext.tsx,
// MobileStatusPill.tsx) and the web (agent-web-ui.css) must carry the same values.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ui = path.join(__dirname, '../../../packages/ui/src');
const web = path.join(__dirname, 'agent-web');
const read = (p) => fs.readFileSync(p, 'utf8');

function load(file, stubs = {}) {
  const loaded = { exports: {} };
  const req = (name) => (name in stubs ? stubs[name] : require(name));
  new Function('require', 'module', 'exports', ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
  }).outputText)(req, loaded, loaded.exports);
  return loaded.exports;
}

function rgb(c, under) {
  const m = c.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  if (!m) return hex(c);
  const a = Number(m[4]);
  const base = hex(under);
  return [1, 2, 3].map((i, k) => Math.round(Number(m[i]) * a + base[k] * (1 - a)));
}
function lum(c) {
  return c.map((v) => v / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
    .reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(fg, bg, under = '#FFFFFF') {
  const [x, y] = [lum(rgb(fg, under)), lum(rgb(bg, under))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const tokens = load(path.join(ui, 'theme/tokens.ts')).tokens;
const pill = load(path.join(ui, 'components/MobileStatusPill.tsx'), {
  react: { createElement: () => null },
  'react-native': { StyleSheet: { create: (s) => s }, Text: 'Text', View: 'View' },
  '../theme/tokens': { tokens },
  '../theme/ThemeContext': { useMobileThemeOptional: () => null },
});

const PAGE = '#211E1E';
const CARD = '#2F2B2B';

test('tokens: text on dark is white / E2E8F0 / A8B4C6, each readable (>= 4.5:1) on the dark page and on cards', () => {
  assert.deepEqual({ ...tokens.colors.textOnDark }, { primary: '#FFFFFF', secondary: '#E2E8F0', muted: '#A8B4C6' });
  for (const [k, v] of Object.entries(tokens.colors.textOnDark)) {
    for (const under of [PAGE, CARD]) assert.ok(contrast(v, under) >= 4.5, `${k} on ${under}`);
  }
  assert.equal(tokens.colors.liftHover, '#575151');
});

test('dark theme: headings and screen title are white, secondary text is the muted step, page and card stay brand black', () => {
  // DARK_THEME is not exported, so read the block from the source (same approach as the other colour tests).
  const src = read(path.join(ui, 'theme/ThemeContext.tsx'));
  const block = src.slice(src.indexOf('const DARK_THEME'), src.indexOf('};', src.indexOf('const DARK_THEME')));
  assert.match(block, /background: '#211E1E'/);
  assert.match(block, /surface: '#2F2B2B'/);
  assert.match(block, /textHeading: tokens\.colors\.textOnDark\.primary,/);
  assert.match(block, /screenTitle: tokens\.colors\.textOnDark\.primary,/);
  assert.match(block, /textSecondary: tokens\.colors\.textOnDark\.muted,/);
  assert.doesNotMatch(block, /#F1F5F9|#94A3B8|#F8FAFC/);
});

test('dark status pills: 30% fill (red 34%), light fg readable on page and cards, "in progress" is CI slate 100', () => {
  const D = pill.STATUS_PILL_DARK_TONES;
  for (const [k, v] of Object.entries(D)) {
    if (k === 'purple') continue;
    assert.match(v.bg, k === 'red' ? /,0\.34\)$/ : /,0\.3\)$/, k);
    for (const under of [PAGE, CARD]) assert.ok(contrast(v.fg, v.bg, under) >= 4.5, `${k} on ${under}`);
  }
  assert.equal(D.purple.bg, '#F1F5F9');
  assert.equal(D.purple.fg, '#211E1E');
  assert.ok(contrast(D.purple.fg, D.purple.bg) >= 4.5);
});

test('web: the same text and hover values exist as CSS variables', () => {
  const css = read(path.join(web, 'ui/agent-web-ui.css'));
  assert.match(css, /--aw-lift-hover: #575151;/);
  assert.match(css, /--aw-text-1: #ffffff;/);
  assert.match(css, /--aw-text-2: #e2e8f0;/);
  assert.match(css, /--aw-text-3: #a8b4c6;/);
});

test('colors.json (package + doc copy) carries lift, liftHover and textOnDark with the token values', () => {
  for (const f of ['packages/config/theme/colors.json', 'doc/NESTYK/colors.json']) {
    const j = JSON.parse(read(path.join(__dirname, '../../..', f)));
    assert.equal(j.lift.toUpperCase(), tokens.colors.lift, f);
    assert.equal(j.liftHover.toUpperCase(), tokens.colors.liftHover, f);
    for (const k of Object.keys(tokens.colors.textOnDark)) {
      assert.equal(j.textOnDark[k].toUpperCase(), tokens.colors.textOnDark[k], `${f} ${k}`);
    }
  }
});
