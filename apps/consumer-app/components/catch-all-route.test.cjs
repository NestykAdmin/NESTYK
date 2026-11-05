// components/web-routes/CatchAllRoute.web.tsx: QA web test (4 Nov 2026) item 9 — "/Login" and "/Privacy" showed
// expo-router's "Unmatched" page while "/AGENT/..." worked. Own screens typed with capitals now go to their
// lower-case path and keep the query (next=, token_hash=).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
global.React = React; // the app uses the automatic JSX runtime; this test compiles JSX to React.createElement

const compile = (file) => ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;
const routes = { exports: {} };
new Function('require', 'module', 'exports', compile('../lib/app-routes.ts'))(() => { throw new Error('none'); }, routes, routes.exports);

function visit(pathname, search = '') {
  const replaced = [];
  global.window = { location: { search } };
  const deps = {
    react: { ...React, useEffect: (fn) => { fn(); } },
    'expo-router': { Unmatched: 'Unmatched', usePathname: () => pathname, useRouter: () => ({ replace: (href) => replaced.push(href) }) },
    '../../lib/app-routes': routes.exports,
  };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', compile('web-routes/CatchAllRoute.web.tsx'))((id) => { if (id in deps) return deps[id]; throw new Error(id); }, mod, mod.exports);
  const out = mod.exports.default();
  return { replaced, unmatched: out?.type === 'Unmatched' };
}

test('"/Login?next=/agent" goes to "/login?next=/agent", and "/Privacy" to "/privacy"', () => {
  assert.deepEqual(visit('/Login', '?next=%2Fagent').replaced, ['/login?next=%2Fagent']);
  assert.deepEqual(visit('/Privacy').replaced, ['/privacy']);
});

test('a reset link with capitals keeps its token', () => {
  assert.deepEqual(visit('/Reset-Password', '?token_hash=abc&type=recovery').replaced, ['/reset-password?token_hash=abc&type=recovery']);
});

test('unknown paths still show "Unmatched"; app paths render nothing here and are not redirected', () => {
  const unknown = visit('/foo');
  assert.equal(unknown.unmatched, true);
  assert.deepEqual(unknown.replaced, []);
  const app = visit('/AGENT/rooms');
  assert.equal(app.unmatched, false);
  assert.deepEqual(app.replaced, []);
});
