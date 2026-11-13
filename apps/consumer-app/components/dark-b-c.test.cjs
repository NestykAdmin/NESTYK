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

// ---- Commit 2 (13 Nov 2026): web shell, overview, drawer hero (D1) and the create-lead form (D2) in dark mode ----

test('web shell: lifted hover uses --aw-lift-hover, sidebar icons are the body step #E2E8F0 in dark mode', () => {
  const css = read(path.join(web, 'agent-workspace.css'));
  assert.match(css, /\[data-theme="dark"\] \.aw-nav-item\.is-active:hover \{[^}]*background: var\(--aw-lift-hover\);/);
  assert.match(css, /\[data-theme="dark"\] \.aw-switcher:hover \{[^}]*background: var\(--aw-lift-hover\);/);
  assert.doesNotMatch(css, /#575151/);
  const shell = read(path.join(web, 'AgentWorkspace.web.tsx'));
  assert.match(shell, /isDark \? "#E2E8F0" : "#334155"/);
  assert.ok(contrast('#E2E8F0', '#2F2B2B') >= 4.5);
});

test('overview: KPI chip is a yellow tint with a yellow icon; tone chips in dark mode use the pill fills and text', () => {
  const css = read(path.join(web, 'agent-overview.css'));
  assert.match(css, /\[data-theme="dark"\] \.aov-kpi-icon \{\s*background: #f8b61533;/);
  // the yellow icon still reads as an icon (>= 3:1) on the tinted chip over a card
  assert.ok(contrast('#F8B615', 'rgba(248,182,21,0.2)', CARD) >= 3);
  const D = pill.STATUS_PILL_DARK_TONES;
  const rule = (sel) => css.match(new RegExp(`${sel} \\{([^}]*)\\}`))[1];
  const tones = [
    ['\\.aov-tone-success', D.green],
    ['\\.aov-tone-warning', D.rose],
    ['\\.aov-overdue \\.aov-row-count', D.red],
    ['\\.aov-tone-info', D.blue],
    ['\\.aov-work-total', D.rose],
  ];
  for (const [sel, tone] of tones) {
    const body = rule(`\\[data-theme="dark"\\] ${sel}`);
    assert.match(body, new RegExp(`color: ${tone.fg.toLowerCase()};`, 'i'), sel);
    assert.match(body, new RegExp(`background: ${tone.bg.replace(/[()]/g, '\\$&').replace(/\./g, '\\.')};`), sel);
  }
});

test('D1: the agent hero in the drawer is lifted grey in dark mode (ink on the ink page vanished)', () => {
  const code = read(path.join(ui, 'shells/MobileProfileDrawer.tsx'));
  assert.match(code, /const heroFill = isDark && activeRole === 'agent' \? tokens\.colors\.lift : roleColor;/);
  assert.match(code, /styles\.heroCard, \{ backgroundColor: heroFill \}/);
});

test('D2: create-lead form tabs, care box and matching banner follow the theme in dark mode', () => {
  const code = read(path.join(__dirname, 'CreateLeadForm.tsx'));
  assert.match(code, /styles\.tabs, \{ borderColor: theme\.border, backgroundColor: isDark \? theme\.background : '#F1F5F9' \}/);
  assert.match(code, /styles\.careBox, \{ borderColor: theme\.border, backgroundColor: isDark \? DARK_WELL : '#F8FAFC' \}/);
  assert.match(code, /const DARK_WELL = '#3F3A3A';/);
  assert.doesNotMatch(code, /bannerIconReady: \{ backgroundColor: '#FFFFFF' \}/);
  // banner text on the 30% tints over a card: heading white, body #E2E8F0 (the muted step is too faint there)
  for (const fill of ['rgba(248,182,21,0.3)', 'rgba(34,197,94,0.3)']) {
    assert.match(code, new RegExp(fill.replace(/[().]/g, '\\$&')));
    for (const fg of ['#FFFFFF', '#E2E8F0']) assert.ok(contrast(fg, fill, CARD) >= 4.5, `${fg} on ${fill}`);
  }
  assert.match(code, /styles\.bannerBody, \{ color: isDark \? tokens\.colors\.textOnDark\.secondary : theme\.textSecondary \}/);
});

test('D3 (web): the saved theme is applied before the first paint of the shell, so a dark reload has no light frame', () => {
  const shell = read(path.join(web, 'AgentWorkspace.web.tsx'));
  // a layout effect runs before the browser paints; the plain effect ran after it (one light frame on reload)
  assert.match(shell, /const useBeforePaint = typeof window === "undefined" \? useEffect : React\.useLayoutEffect;/);
  assert.match(shell, /useBeforePaint\(\(\) => \{\s*if \(!props\.enabled\) return;\s*if \(themePref !== "system"\) \{\s*setThemeMode\(themePref\);/);
});

// ---- Commit 3 (13 Nov 2026): text fields follow the theme (they stayed white in dark mode) ----

test('tokens: one set of dark field colours, readable on cards', () => {
  const f = tokens.colors.fieldOnDark;
  assert.deepEqual({ ...f }, {
    fill: '#2F2B2B', line: '#575151', readOnly: '#211E1E', text: '#FFFFFF', placeholder: '#A8B4C6', error: '#FCA5A5',
  });
  for (const fg of [f.text, f.placeholder, f.error]) {
    assert.ok(contrast(fg, f.fill) >= 4.5, `${fg} on fill`);
    assert.ok(contrast(fg, f.readOnly) >= 4.5, `${fg} on read-only`);
  }
  // the field edge must show on a card (>= 3:1 is not required for a decorative border, but it must differ)
  assert.notEqual(f.line, CARD);
});

test('MobileInput follows the theme: dark fill, edge, text, placeholder, label and error in dark mode', () => {
  const code = read(path.join(ui, 'components/MobileInput.tsx'));
  assert.match(code, /useMobileThemeOptional\(\)/);
  assert.match(code, /const dark = theme\?\.isDark \? tokens\.colors\.fieldOnDark : null;/);
  for (const k of ['fill', 'line', 'text', 'placeholder', 'error', 'readOnly']) {
    assert.match(code, new RegExp(`dark\\.${k}\\b`), k);
  }
  assert.match(code, /placeholderTextColor=\{dark \? dark\.placeholder : tokens\.colors\.placeholder\}/);
});

test('lead form fields (select, pins, radius chips) follow the theme in dark mode', () => {
  const select = read(path.join(__dirname, 'LeadSelectField.tsx'));
  assert.match(select, /const \{ theme, isDark \} = useMobileTheme\(\);/);
  assert.match(select, /tokens\.colors\.fieldOnDark/);
  assert.doesNotMatch(select, /backgroundColor: '#FFFFFF'/);
  const pins = read(path.join(__dirname, 'LeadLocationsField.tsx'));
  assert.doesNotMatch(pins, /backgroundColor: '#FFFFFF'/);
  assert.match(pins, /tokens\.colors\.fieldOnDark/);
});

// ---- D4 + D5 (13 Nov 2026): close the dark mode gaps in shared contract pieces, the calendar dot and the tab bar ----

test('tokens: status text on dark surfaces = the dark pill text steps, readable on page and card', () => {
  const S = tokens.colors.statusOnDark;
  const D = pill.STATUS_PILL_DARK_TONES;
  assert.deepEqual({ ...S }, { success: D.green.fg, warning: D.yellow.fg, danger: D.red.fg, info: D.blue.fg });
  for (const [k, v] of Object.entries(S)) for (const under of [PAGE, CARD]) assert.ok(contrast(v, under) >= 4.5, `${k} on ${under}`);
});

test('D5: deposit and handover status badges use the dark pill tones in dark mode, light values unchanged', () => {
  for (const f of ['DepositPaymentCard.tsx', 'HandoverCard.tsx']) {
    const code = read(path.join(__dirname, f));
    assert.match(code, /const \{ theme, isDark \} = useMobileTheme\(\);/, f);
    assert.match(code, /STATUS_PILL_DARK_TONES/, f);
    assert.match(code, /color: "#92400E", background: "#FFFBEB"/, `${f} light unchanged`);
  }
  assert.doesNotMatch(read(path.join(__dirname, 'DepositPaymentCard.tsx')), /color: "#991B1B" \}/);
});

test('D5: attachments and financial forms: selected cards tint yellow and status / error text uses statusOnDark in dark mode', () => {
  const att = read(path.join(__dirname, 'AgreementAttachments.tsx'));
  assert.match(att, /tokens\.colors\.statusOnDark/);
  assert.match(att, /DARK_SELECTED/);
  // light values stay, once each, behind the isDark switch
  assert.equal(att.match(/"#991B1B"/g).length, 1);
  assert.equal(att.match(/"#166534"/g).length, 1);
  assert.match(att, /const errorColor = isDark \? tokens\.colors\.statusOnDark\.danger : "#991B1B";/);
  const fin = read(path.join(__dirname, 'FinancialDocumentForm.tsx'));
  assert.doesNotMatch(fin, /color: "#DC2626"/);
  assert.doesNotMatch(fin, /backgroundColor: selected \? "#FFF9E8" : theme\.surface/);
  assert.match(fin, /tokens\.colors\.statusOnDark\.danger/);
  for (const fill of ['rgba(248,182,21,0.16)']) assert.ok(contrast('#FFFFFF', fill, CARD) >= 4.5);
});

test('D4: the calendar "prog" dot is not repainted in dark mode (yellow like the pill dot)', () => {
  const css = read(path.join(web, 'agent-calendar.css'));
  assert.doesNotMatch(css, /\[data-theme="dark"\] \.awc-dot\[data-intent="prog"\]/);
  const { STATUS_INTENT_TONES } = load(path.join(web, 'ui/statusIntent.ts'));
  assert.equal(STATUS_INTENT_TONES.prog.dot, '#F8B615');
  assert.ok(contrast('#F8B615', CARD) >= 3);
});

test('tab bar icons in dark mode use the body step #E2E8F0', () => {
  assert.match(read(path.join(ui, 'components/MobileBottomTabBar.tsx')), /mutedColor=\{isDark \? '#E2E8F0' : '#334155'\}/);
});
