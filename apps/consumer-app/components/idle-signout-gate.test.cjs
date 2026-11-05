// components/web-session/IdleSignOutGate.web.tsx: QA web test (4 Nov 2026) item 3 — the "Are you still there?" box
// closed on the first mouse move or Shift+Tab, so its "Sign out" button could never be reached and the user stayed
// signed in. While the box shows, only its buttons answer it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

const rulesSource = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/auth/idle-rules.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const rules = { exports: {} };
new Function('module', 'exports', rulesSource)(rules, rules.exports);
const { ACTIVITY_KEY, IDLE_LIMIT_MS, IDLE_WARN_MS } = rules.exports;

const gateSource = ts.transpileModule(fs.readFileSync(path.join(__dirname, 'web-session/IdleSignOutGate.web.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;

/** Renders the gate with hooks that keep state, refs and effect deps between renders (enough for this component). */
function mount({ lastActivity }) {
  const store = new Map([[ACTIVITY_KEY, String(lastActivity)]]);
  const listeners = new Map();
  const calls = [];
  global.window = {
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    addEventListener: (name, fn) => listeners.set(name, [...(listeners.get(name) ?? []), fn]),
    removeEventListener: (name, fn) => listeners.set(name, (listeners.get(name) ?? []).filter((f) => f !== fn)),
    setInterval: () => 1,
    clearInterval: () => {},
  };
  global.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };

  const slots = [], effects = [];
  let cursor = 0, effectCursor = 0, dirty = false;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const hooks = { ...React,
    useState: (init) => { const i = cursor++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init;
      return [slots[i], (v) => { const next = typeof v === 'function' ? v(slots[i]) : v; if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true; } }]; },
    useRef: (init) => { const i = cursor++; if (!(i in slots)) slots[i] = { current: init }; return slots[i]; },
    useCallback: (fn, deps) => { const i = cursor++; if (!(i in slots) || !same(slots[i].deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect: (fn, deps) => { const i = effectCursor++; const prev = effects[i];
      if (!prev || !same(prev.deps, deps)) { prev?.cleanup?.(); effects[i] = { deps, cleanup: undefined, run: fn }; } },
  };
  const deps = {
    react: hooks,
    '@nestyk/i18n': { useLocale: () => ({ t: { webSession: { idleTitle: 'Are you still there?', idleBody: '{time}', idleSignOut: 'Sign out', idleStay: 'Stay signed in' } } }),
      fillTemplate: (s) => s },
    '../../lib/auth/AuthContext': { useAuth: () => ({ ready: true, isAuthenticated: true, signOutIdle: async () => { calls.push('signOut'); } }) },
    '../../lib/auth/idle-rules': rules.exports,
    './idle-gate.css': {},
  };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', gateSource)((id) => { if (id in deps) return deps[id]; throw new Error(id); }, mod, mod.exports);
  const { IdleSignOutGate } = mod.exports;

  let tree;
  const render = () => {
    for (let round = 0; round < 10; round += 1) {
      dirty = false; cursor = 0; effectCursor = 0;
      tree = IdleSignOutGate();
      for (const e of effects) if (e?.run) { const run = e.run; e.run = undefined; e.cleanup = run() || undefined; }
      if (!dirty) return tree;
    }
    throw new Error('render loop');
  };
  const fire = (name) => { for (const fn of listeners.get(name) ?? []) fn({}); return render(); };
  const nodes = (el) => (el == null || typeof el !== 'object' ? [] : [el, ...[el.props?.children].flat().flatMap(nodes)]);
  const button = (label) => nodes(tree).find((n) => n.type === 'button' && n.props.children === label);
  return { render, fire, button, calls, store, shown: () => tree !== null };
}

const warnTime = () => Date.now() - (IDLE_LIMIT_MS - IDLE_WARN_MS) - 5000; // 7 h 58 m ago, plus a little

test('the warning stays while the mouse moves or keys are pressed, and "Sign out" signs out', async () => {
  const gate = mount({ lastActivity: warnTime() });
  gate.render();
  assert.equal(gate.shown(), true, 'warning shows near the limit');
  for (const name of ['pointermove', 'keydown', 'wheel', 'pointerdown', 'touchstart']) {
    gate.fire(name);
    assert.equal(gate.shown(), true, `${name} does not close the warning`);
  }
  assert.ok(Number(gate.store.get(ACTIVITY_KEY)) < Date.now() - 60 * 60 * 1000, 'the idle clock was not reset');
  gate.button('Sign out').props.onClick();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(gate.calls, ['signOut']);
});

test('"Stay signed in" closes the warning and restarts the clock', () => {
  const gate = mount({ lastActivity: warnTime() });
  gate.render();
  gate.button('Stay signed in').props.onClick();
  gate.render();
  assert.equal(gate.shown(), false);
  assert.ok(Date.now() - Number(gate.store.get(ACTIVITY_KEY)) < 5000);
});

test('without the warning, activity still keeps the session alive', () => {
  const gate = mount({ lastActivity: Date.now() - 60 * 60 * 1000 });
  gate.render();
  assert.equal(gate.shown(), false);
  gate.fire('pointermove');
  assert.ok(Date.now() - Number(gate.store.get(ACTIVITY_KEY)) < 5000, 'a move an hour later is written as activity');
});
