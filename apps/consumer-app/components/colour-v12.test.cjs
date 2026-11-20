// Colour system v1.2 (Mos, 12 Nov 2026): design B "ink leads" + B-dark 2 "lifted grey + yellow".
// Selected items, the workspace box, KPI icons and the user's own avatar are ink (lifted grey #4A4545 in dark mode)
// with yellow; status pills move from the 50 to the 100 step without a border and get one dark set for the app and the web.
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

test('tokens: lifted grey for dark mode is shared by the app and the web', () => {
  assert.equal(tokens.colors.lift, '#4A4545');
  const css = read(path.join(web, 'ui/agent-web-ui.css'));
  assert.match(css, /--aw-lift: #4a4545;/);
  assert.match(css, /:root \{[\s\S]*--aw-brand-hover: #e5a50a;[\s\S]*\}\s*\[data-theme="dark"\] \{\s*--aw-brand-hover: #fbc740;/);
});

test('web shell: selected item slate (light) / lifted grey (dark) with a yellow bar, warm hover, slate role box with a role tile, ink own avatar', () => {
  const css = read(path.join(web, 'agent-workspace.css'));
  // Hover never paints over the selected item (white text on a light hover was unreadable, Mos 12 Nov 15:23);
  // hover is the CI slate neutral #F1F5F9 (warm stone #F5F5F4 was off-CI, Mos 12 Nov 16:13).
  assert.match(css, /\.aw-nav-item:hover:not\(:disabled\):not\(\.is-active\) \{[^}]*background: #f1f5f9;/);
  // Design ก (Mos 17 Nov 2026): light mirrors dark: slate fill, ink text and a yellow bar instead of the ink pill.
  assert.match(css, /\.aw-nav-item\.is-active:hover \{[^}]*background: #e2e8f0;/);
  assert.match(css, /\[data-theme="dark"\] \.aw-nav-item:hover:not\(:disabled\):not\(\.is-active\) \{/);
  assert.match(css, /\[data-theme="dark"\] \.aw-nav-item\.is-active:hover \{[^}]*background: var\(--aw-lift-hover\);/);
  assert.doesNotMatch(css, /\.aw-nav-item:hover:not\(:disabled\) \{/);
  assert.match(css, /\.aw-nav-subitem:hover:not\(:disabled\):not\(\.is-active\) \{[^}]*background: #f1f5f9;/);
  assert.match(css, /\.aw-nav-subitem\.is-active \{[^}]*background: #f8fafc;[^}]*box-shadow: inset 2px 0 0 var\(--aw-brand\);/);
  assert.match(css, /\.aw-nav-item\.is-active \{[^}]*background: #f1f5f9;[^}]*color: var\(--aw-ink\);[^}]*box-shadow: inset 3px 0 0 var\(--aw-brand\);/);
  assert.doesNotMatch(css, /\.aw-nav-item\.is-active \{[^}]*background: var\(--aw-black\);/);
  assert.match(css, /\[data-theme="dark"\] \.aw-nav-item\.is-active \{[^}]*background: var\(--aw-lift\);[^}]*box-shadow: inset 3px 0 0 var\(--aw-brand\);/);
  // Design จ2 (Mos 18 Nov 2026): the role box is CI slate in light mode; the role shows only in its tile.
  assert.match(css, /\.aw-switcher \{[^}]*border: 1px solid #f1f5f9;[^}]*background: #f1f5f9;[^}]*color: var\(--aw-ink\);/);
  assert.match(css, /\.aw-switcher \.aw-switch-copy strong \{\s*color: var\(--aw-ink\);/);
  assert.match(read(path.join(web, 'AgentWorkspace.web.tsx')), /className="aw-switch-tile"[\s\S]{0,80}style=\{\{ background: roleTile\.bg, boxShadow: `0 0 0 1\.5px \$\{roleTile\.ring\}` \}\}/);
  assert.match(css, /\[data-theme="dark"\] \.aw-switcher \{[^}]*background: var\(--aw-lift\);/);
  assert.match(css, /\.aw-avatar \{[^}]*background: var\(--aw-black\);[^}]*color: var\(--aw-brand\);/);
  const shell = read(path.join(web, 'AgentWorkspace.web.tsx'));
  // Selected icon: CI yellow on the dark lift, dark gold on the light slate fill (CI yellow is too faint there).
  assert.match(shell, /active \? \(isDark \? "#F8B615" : "#795719"\) : isDark \? "#E2E8F0" : "#334155"/);
  assert.ok(contrast('#795719', '#F1F5F9') >= 4.5);
  // The group chevron on a selected parent: light grey on the dark lift only.
  assert.match(shell, /name="chevron-right" size=\{14\} color=\{parent === tab && isDark \? "#CBD5E1" : theme\.textSecondary\}/);
  const overview = read(path.join(web, 'AgentOverview.web.tsx'));
  assert.match(overview, /<span className="aov-kpi-icon" aria-hidden="true">\s*<MobileIcon name=\{item\.icon\} size=\{18\} color="#F8B615" \/>/);
  assert.match(read(path.join(web, 'agent-overview.css')), /\.aov-kpi-icon \{[^}]*background: #211e1e;[\s\S]*\[data-theme="dark"\] \.aov-kpi-icon \{\s*background: #f8b61533;/);
});

// Mos 20 Nov 2026: the app follows the web. Where a role is shown (own avatar, drawer role box, role list, role badge)
// the app uses the same role identity colours as the web (roleTileColors); ink and gold now mean admin only.
test('app: own avatar takes the role identity colours when it gets a role, and keeps ink with yellow initials without one', () => {
  const avatar = read(path.join(ui, 'components/MobileProfileAvatar.tsx'));
  assert.match(avatar, /const tile = role \? roleTileColors\(role, isDark\) : null;/);
  assert.match(avatar, /const fill = tile \? tile\.bg : isDark \? tokens\.colors\.lift : tokens\.colors\.primary;/);
  assert.match(avatar, /const ring = tile \? tile\.ring : /);
  assert.match(avatar, /const text = tile \? tile\.fg : tokens\.colors\.brand\[500\];/);
  assert.ok(contrast('#F8B615', '#211E1E') >= 4.5 && contrast('#F8B615', '#4A4545') >= 4.5);
  assert.match(read(path.join(ui, 'components/MobileBottomTabBar.tsx')), /mutedColor=\{isDark \? '#E2E8F0' : '#334155'\}/);
});

test('app: every place that shows the own avatar passes the current role', () => {
  assert.match(read(path.join(ui, 'components/MobileHeaderActions.tsx')), /<MobileProfileAvatar initials=\{initials\} size="sm" role=\{role\} \/>/);
  assert.match(read(path.join(__dirname, '../app/index.tsx')), /<MobileHeaderActions\s+initials=\{profileInitials\}\s+role=\{activeRole\}/);
  const drawer = read(path.join(ui, 'shells/MobileProfileDrawer.tsx'));
  assert.match(drawer, /<MobileProfileAvatar initials=\{initials\} imageUri=\{avatarUri\} size="md" role=\{activeRole\} \/>/);
  assert.match(drawer, /<MobileProfileEditBody[^>]*?role=\{activeRole\}/);
  assert.match(drawer, /avatarUri,\s+role: activeRole,\s+\}\}/);
  assert.match(read(path.join(ui, 'components/MobileProfileEditBody.tsx')), /size="lg"\s+role=\{role\}/);
  const account = read(path.join(ui, 'shells/MobileAccountSettingsBody.tsx'));
  assert.match(account, /<MobileProfileAvatar initials=\{profile\.initials\} size="lg" role=\{profile\.role\}/);
  assert.match(account, /avatarUri=\{profile\.avatarUri\}\s+role=\{profile\.role\}/);
  const dashboard = read(path.join(ui, '../../feature-listing/src/components/MobileAgentDashboardBody.tsx'));
  assert.match(dashboard, /<MobileProfileAvatar initials=\{initials\} imageUri=\{avatarUri\} size="md" role="agent" \/>/);
});

test('app: drawer role box, role list and role badge are role identity tiles with a ring; initials and icons read 4.5:1 or more', () => {
  const drawer = read(path.join(ui, 'shells/MobileProfileDrawer.tsx'));
  assert.match(drawer, /const roleTile = roleTileColors\(activeRole, isDark\);/);
  assert.match(drawer, /styles\.roleIconBox, \{ backgroundColor: roleTile\.bg, borderColor: roleTile\.ring \}/);
  assert.match(drawer, /color=\{roleTile\.fg\}/);
  assert.match(drawer, /const tile = roleTileColors\(role\.key, isDark\);/);
  assert.match(drawer, /styles\.roleIconBoxLg, \{ backgroundColor: tile\.bg, borderColor: tile\.ring \}/);
  assert.match(drawer, /color=\{tile\.fg\}/);
  assert.match(drawer, /const decorRingColor = roleTile\.ring;/);
  assert.doesNotMatch(drawer, /roleBoxFill|roleBoxIcon|roleIconTint/);
  assert.match(drawer, /roleIconBox: \{[^}]*borderWidth: 1\.5,/);
  assert.match(drawer, /roleIconBoxLg: \{[^}]*borderWidth: 1\.5,/);
  const badge = read(path.join(ui, 'components/MobileBadge.tsx'));
  assert.match(badge, /const tile = roleTileColors\(role, isDark\);/);
  assert.match(badge, /backgroundColor: variant === 'solid' \? roleColor : tile\.bg,/);
  assert.match(badge, /variant === 'solid' \? \([^)]*\) : tile\.fg,/);
  const { roleTileColors } = load(path.join(ui, 'theme/tokens.ts'));
  for (const role of ['guest', 'tenant', 'landlord', 'agent', 'self_owner', 'admin']) {
    for (const dark of [false, true]) {
      const tile = roleTileColors(role, dark);
      assert.ok(contrast(tile.fg, tile.bg) >= 4.5, `${role} ${dark ? 'dark' : 'light'}: ${contrast(tile.fg, tile.bg).toFixed(2)}`);
    }
  }
});

test('app: agent overview uses the CI pair of the web: ink "new lead" button beside the yellow one, yellow KPI icons on ink', () => {
  const dashboard = read(path.join(ui, '../../feature-listing/src/components/MobileAgentDashboardBody.tsx'));
  assert.match(dashboard, /const inkFill = isDark \? subtle\.neutralBg : primary;/);
  assert.equal(tokens.colors.subtle.neutralBg.toLowerCase(), '#f1f5f9');
  assert.match(dashboard, /const inkButtonText = \{ color: isDark \? primary : '#FFFFFF' \} as const;/);
  assert.match(dashboard, /style=\{inkButton\}\s+textStyle=\{inkButtonText\}\s+onPress=\{\(\) => onNavigate\(\{ type: 'action', id: 'newLead' \}\)\}/);
  assert.match(dashboard, /const kpiIconBox = \{ backgroundColor: isDark \? 'rgba\(248,182,21,0\.2\)' : primary \} as const;/);
  assert.match(dashboard, /<View style=\{\[styles\.kpiIcon, kpiIconBox\]\}>\s*<MobileIcon name=\{kpi\.icon\} size=\{16\} color=\{brand\[500\]\} \/>/);
  assert.equal((dashboard.match(/icon: '[a-z-]+' as AppIconName,/g) || []).length, 4);
  assert.ok(contrast('#FFFFFF', '#211E1E') >= 4.5 && contrast('#211E1E', '#F1F5F9') >= 4.5);
});

test('status pills, light: 100 step, no border, text 4.5:1 or more', () => {
  const T = pill.STATUS_PILL_TONES;
  assert.deepEqual(
    Object.fromEntries(Object.entries(T).map(([k, v]) => [k, [v.bg, v.fg, v.border ?? null]])),
    {
      yellow: ['#FEF3C7', '#92400E', null],
      blue: ['#DBEAFE', '#1E3A8A', null],
      purple: ['#211E1E', '#FFFFFF', null],
      green: ['#DCFCE7', '#166534', null],
      rose: ['#FFF0C4', '#211E1E', null],
      red: ['#FEE2E2', '#991B1B', null],
      slate: ['#E2E8F0', '#334155', null],
    },
  );
  for (const [k, v] of Object.entries(T)) assert.ok(contrast(v.fg, v.bg) >= 4.5, k);
});

test('status pills, dark: one set for every key, readable on the page and on cards, "in progress" is light so it does not vanish', () => {
  const D = pill.STATUS_PILL_DARK_TONES;
  assert.deepEqual(Object.keys(D).sort(), Object.keys(pill.STATUS_PILL_TONES).sort());
  for (const [k, v] of Object.entries(D)) {
    for (const under of ['#211E1E', '#2F2B2B']) assert.ok(contrast(v.fg, v.bg, under) >= 4.5, `${k} on ${under}`);
  }
  assert.equal(D.purple.bg, '#F1F5F9');
  assert.equal(D.purple.dot, '#F8B615');
});

test('pillToneFor maps a key or a light tone object to its dark tone, and leaves other tones alone', () => {
  const { pillToneFor, STATUS_PILL_TONES: T, STATUS_PILL_DARK_TONES: D } = pill;
  for (const k of Object.keys(T)) {
    assert.deepEqual(pillToneFor(k, false), T[k]);
    assert.deepEqual(pillToneFor(k, true), D[k]);
    assert.deepEqual(pillToneFor({ ...T[k], dot: 'x' }, true), D[k]);
  }
  const custom = { bg: '#123456', fg: '#FFFFFF' };
  assert.equal(pillToneFor(custom, true), custom);
});

test('the pill, the filter chip and the web badge use pillToneFor; no screen keeps its own dark pill set', () => {
  assert.match(read(path.join(ui, 'components/MobileStatusPill.tsx')), /pillToneFor\(tone, isDark\)/);
  assert.match(read(path.join(ui, 'components/MobileFilterChip.tsx')), /pillToneFor\(tone, isDark\)/);
  assert.doesNotMatch(read(path.join(__dirname, 'LeadMatchedRoomBody.tsx')), /const DARK_TONES/);
  assert.doesNotMatch(read(path.join(web, 'ui/StatusBadge.tsx')), /borderColor: tone\.border/);
});

test('web status intents carry the same light values as the app pills', () => {
  const intents = load(path.join(web, 'ui/statusIntent.ts')).STATUS_INTENT_TONES;
  const T = pill.STATUS_PILL_TONES;
  const map = { attn: 'rose', prog: 'purple', done: 'green', neutral: 'slate', crit: 'red' };
  for (const [intent, key] of Object.entries(map)) {
    assert.equal(intents[intent].bg, T[key].bg, intent);
    assert.equal(intents[intent].fg, T[key].fg, intent);
  }
});
