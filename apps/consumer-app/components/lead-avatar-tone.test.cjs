// Leads list (Mos, 12 Nov 2026, design B4): every lead's initials avatar uses one neutral colour, not the status colour.
// The status pill beside it still carries the status colour. Light: slate #F1F5F9 / #334155. Dark: warm grey #4A4545 / #E7E5E4.
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

test('LEAD_AVATAR_TONE is one neutral tone per mode and its initials read (4.5:1)', () => {
  const src = read('AgentLeadDetailBody.tsx');
  const m = src.match(/export const LEAD_AVATAR_TONE = (\{[\s\S]*?\}) as const;/);
  assert.ok(m, 'LEAD_AVATAR_TONE export');
  const tone = new Function(`return ${ts.transpileModule(`(${m[1]})`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText}`)();
  assert.deepEqual(tone, { light: { bg: '#F1F5F9', fg: '#334155' }, dark: { bg: '#4A4545', fg: '#E7E5E4' } });
  for (const mode of ['light', 'dark']) assert.ok(contrast(tone[mode].fg, tone[mode].bg) >= 4.5, mode);
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
  assert.match(css, /\.awl-avatar \{[^}]*background: #f1f5f9;[^}]*color: #334155;/);
  assert.match(css, /\.aw-shell\[data-theme="dark"\] \.awl-avatar \{[^}]*background: #4a4545;[^}]*color: #e7e5e4;/);
});
