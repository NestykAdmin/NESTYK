// Web idle sign out, 8 hours (Mos 4 Nov 2026): rules + wiring. Mobile has none.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, 'idle-rules.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', source)(() => { throw new Error('idle-rules must stay dependency free'); }, mod, mod.exports);
const { IDLE_LIMIT_MS, IDLE_WARN_MS, idlePhase, parseLastActivity, countdownLabel } = mod.exports;
const app = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(app, rel), 'utf8');
const H = 60 * 60 * 1000;

test('8 hours, warning in the last 2 minutes', () => {
  assert.equal(IDLE_LIMIT_MS, 8 * H);
  assert.equal(IDLE_WARN_MS, 2 * 60 * 1000);
  const now = 100 * H;
  assert.equal(idlePhase(now - 1000, now), 'active');
  assert.equal(idlePhase(now - (8 * H - 2 * 60 * 1000) + 1, now), 'active');
  assert.equal(idlePhase(now - (8 * H - 2 * 60 * 1000), now), 'warn');
  assert.equal(idlePhase(now - 8 * H + 1, now), 'warn');
  assert.equal(idlePhase(now - 8 * H, now), 'expired');
  assert.equal(idlePhase(now - 30 * H, now), 'expired'); // browser opened the next day
});

test('missing, broken or future times count as active now', () => {
  assert.equal(parseLastActivity(null), null);
  assert.equal(parseLastActivity('abc'), null);
  assert.equal(parseLastActivity('-5'), null);
  assert.equal(parseLastActivity('1730700000000'), 1730700000000);
  assert.equal(idlePhase(null, 5), 'active');
  assert.equal(idlePhase(10 * H, 9 * H), 'active');
});

test('countdown shows minutes and seconds left', () => {
  const now = 100 * H;
  assert.equal(countdownLabel(now - (8 * H - 2 * 60 * 1000), now), '2:00');
  assert.equal(countdownLabel(now - (8 * H - 65 * 1000), now), '1:05');
  assert.equal(countdownLabel(now - 8 * H, now), '0:00');
});

test('wiring: mounted once in the root layout, web only, signs out this device as "expired"', () => {
  assert.match(read('app/_layout.tsx'), /<IdleSignOutGate \/>/);
  assert.match(read('components/web-session/IdleSignOutGate.tsx'), /return null;/);
  const web = read('components/web-session/IdleSignOutGate.web.tsx');
  assert.match(web, /signOutIdle/);
  assert.match(web, /data-testid="session\.idleWarning"/);
  const ctx = read('lib/auth/AuthContext.tsx');
  assert.match(ctx, /const signOutIdle = useCallback\(\(\) => endSession\('local', 'expired'\), \[endSession\]\);/);
});
