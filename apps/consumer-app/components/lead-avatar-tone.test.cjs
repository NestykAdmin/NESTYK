// Person avatars (Mos, 12 Nov 2026, design B4): every lead and tenant initials avatar uses one neutral colour,
// not the status, role or brand colour (yellow is kept for the signed-in user's own avatar).
// The status pill beside it still carries the status colour. Light: slate #E2E8F0 / #334155 (v1.2, CI neutral text; #1E293B was off-CI). Dark: warm grey #4A4545 / #E7E5E4.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

function contrast(a, b) {
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

test('tokens.colors.avatar is one neutral tone per mode and its initials read (4.5:1)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../../packages/ui/src/theme/tokens.ts'), 'utf8');
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText)(require, loaded, loaded.exports);
  const tone = loaded.exports.tokens.colors.avatar;
  assert.deepEqual(JSON.parse(JSON.stringify(tone)), { light: { bg: '#E2E8F0', fg: '#334155' }, dark: { bg: '#4A4545', fg: '#E7E5E4' } });
  for (const mode of ['light', 'dark']) assert.ok(contrast(tone[mode].fg, tone[mode].bg) >= 4.5, mode);
  assert.match(read('AgentLeadDetailBody.tsx'), /export const LEAD_AVATAR_TONE = tokens\.colors\.avatar;/);
});

test('every other person avatar in the app (lead detail, tenant list, tenant detail) uses the same tone by mode', () => {
  const lead = read('AgentLeadDetailBody.tsx');
  assert.match(lead, /styles\.avatar, \{ backgroundColor: LEAD_AVATAR_TONE\[isDark \? 'dark' : 'light'\]\.bg \}/);
  assert.match(lead, /styles\.avatarText, \{ color: LEAD_AVATAR_TONE\[isDark \? 'dark' : 'light'\]\.fg \}/);
  for (const f of ['TenantDirectoryBody.tsx', 'TenantDetailHub.tsx']) {
    const code = read(f);
    assert.match(code, /const avatarTone = tokens\.colors\.avatar\[isDark \? 'dark' : 'light'\];/, f);
    assert.match(code, /s\.avatar, \{ backgroundColor: avatarTone\.bg \}/, f);
    assert.match(code, /s\.avatarText, \{ color: avatarTone\.fg \}/, f);
    assert.doesNotMatch(code.slice(code.indexOf('StyleSheet.create')), /avatar: \{[^}]*backgroundColor/, f);
  }
});

test('the app leads list gives every avatar the same tone (by mode), not the status tone', () => {
  const src = read('AgentLeadsScreen.tsx');
  assert.match(src, /avatarTone=\{LEAD_AVATAR_TONE\[isDark \? 'dark' : 'light'\]\}/);
  assert.doesNotMatch(src, /avatarTone=\{tone\}/);
});

test('the agent web leads table uses one avatar class, with a dark-mode rule, and no status tone classes', () => {
  const page = read('agent-web/AgentLeadsPage.web.tsx');
  assert.match(page, /<span className="awl-avatar" aria-hidden="true">/);
  assert.doesNotMatch(page, /awl-tone-/);
  const css = read('agent-web/agent-leads.css');
  assert.doesNotMatch(css, /\.awl-tone-/);
  assert.match(css, /\.awl-avatar \{[^}]*background: #e2e8f0;[^}]*color: #334155;/);
  assert.match(css, /\.aw-shell\[data-theme="dark"\] \.awl-avatar \{[^}]*background: #4a4545;[^}]*color: #e7e5e4;/);
});

test('the agent web tenant avatars use the same neutral tone, with the dark-mode rule', () => {
  const css = read('agent-web/agent-tenants.css');
  assert.match(css, /\.awt-avatar \{[^}]*background: #e2e8f0;[^}]*color: #334155;/);
  assert.match(css, /\.aw-shell\[data-theme="dark"\] \.awt-avatar \{[^}]*background: #4a4545;[^}]*color: #e7e5e4;/);
  assert.doesNotMatch(css, /\.awt-avatar \{[^}]*#fff9e8/);
});
