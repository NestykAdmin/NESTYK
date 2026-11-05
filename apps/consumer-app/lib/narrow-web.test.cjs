// "Use the app" banner below 768 px (launch plan 13 Nov 2026).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, deps = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)((id) => { if (id in deps) return deps[id]; throw new Error(id); }, mod, mod.exports);
  return mod.exports;
}
const narrow = load('narrow-web.ts', { './app-routes': load('app-routes.ts') });

test('role pages under 768 px show it; guest, sign-in, legal and wide screens do not; closed stays closed', () => {
  const { showNarrowWebBanner: show } = narrow;
  for (const p of ['/agent', '/agent/leads', '/tenant', '/landlord/rooms', '/owner']) assert.equal(show(p, 390, false), p !== '/owner', p);
  for (const p of ['/', '/search', '/login', '/register', '/privacy', '/no-access']) assert.equal(show(p, 390, false), false, p);
  assert.equal(show('/agent', 767, false), true);
  assert.equal(show('/agent', 768, false), false, 'the desktop shell starts here');
  assert.equal(show('/agent', 390, true), false, 'closed');
  assert.equal(show('/agent', 0, false), false, 'no size yet');
});

test('same width as the desktop shell, and mounted once', () => {
  const index = fs.readFileSync(path.join(__dirname, '../app/index.tsx'), 'utf8');
  assert.equal(Number(index.match(/const WEB_SHELL_MIN_WIDTH = (\d+);/)[1]), narrow.NARROW_WEB_MAX_WIDTH);
  const layout = fs.readFileSync(path.join(__dirname, '../app/_layout.tsx'), 'utf8');
  assert.equal((layout.match(/<NarrowWebBanner \/>/g) || []).length, 1);
  assert.match(fs.readFileSync(path.join(__dirname, '../components/web-narrow/NarrowWebBanner.tsx'), 'utf8'), /return null;/, 'mobile: nothing');
});
