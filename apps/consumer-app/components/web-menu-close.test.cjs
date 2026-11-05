// components/agent-web/ui/WebMenu.tsx: QA web test (4 Nov 2026) item 10 — Esc left focus on the page body, and the
// outside click that closed the menu also pressed what lay under it (the dashboard went to /agent/leads).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, 'agent-web/ui/WebMenu.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText;

/** A tiny DOM: listeners by type (capture and once honoured), timers run on flush. */
function fakeDocument() {
  const listeners = [];
  const timers = [];
  return {
    listeners,
    addEventListener: (type, fn, opts = {}) => listeners.push({ type, fn, capture: !!(opts === true || opts.capture), once: !!opts.once }),
    removeEventListener: (type, fn, opts = {}) => {
      const capture = !!(opts === true || opts.capture);
      const i = listeners.findIndex((l) => l.type === type && l.fn === fn && l.capture === capture);
      if (i >= 0) listeners.splice(i, 1);
    },
    dispatch(type, event) {
      for (const l of [...listeners].filter((x) => x.type === type)) {
        if (l.once) listeners.splice(listeners.indexOf(l), 1);
        l.fn(event);
      }
    },
    timers,
    flushTimers() { while (timers.length) timers.shift()(); },
  };
}

function mount() {
  const doc = fakeDocument();
  global.document = doc;
  global.window = { setTimeout: (fn) => doc.timers.push(fn) };
  const slots = [], effects = [];
  let cursor = 0, effectCursor = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const hooks = { ...React,
    useState: (init) => { const i = cursor++; if (!(i in slots)) slots[i] = init; return [slots[i], (v) => { slots[i] = v; }]; },
    useRef: (init) => { const i = cursor++; if (!(i in slots)) slots[i] = { current: init }; return slots[i]; },
    useEffect: (fn, deps) => { const i = effectCursor++; const prev = effects[i];
      if (!prev || !same(prev.deps, deps)) { prev?.cleanup?.(); effects[i] = { deps, run: fn }; } },
  };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)((id) => {
    if (id === 'react') return hooks;
    if (id === '@nestyk/ui/native') return { MobileIcon: 'MobileIcon', useMobileTheme: () => ({ theme: {} }) };
    if (id.endsWith('.css')) return {};
    throw new Error(id);
  }, mod, mod.exports);
  const focused = [];
  const trigger = { focus: () => focused.push('trigger') };
  const root = { contains: (node) => node === 'inside' };
  let tree;
  const render = () => {
    cursor = 0; effectCursor = 0;
    tree = mod.exports.WebMenu({ label: 'Create', trigger: 'Create', items: [{ key: 'lead', label: 'Lead' }] });
    // Wire the refs the way React would: root div, trigger button, list.
    const all = [];
    const walk = (el) => { if (!el || typeof el !== 'object') return; all.push(el); [el.props?.children].flat().forEach(walk); };
    walk(tree);
    const rootRef = tree.ref; if (rootRef) rootRef.current = root;
    const button = all.find((n) => n.type === 'button' && n.props['aria-haspopup'] === 'menu');
    if (button?.ref) button.ref.current = trigger;
    for (const e of effects) if (e?.run) { const run = e.run; e.run = undefined; e.cleanup = run() || undefined; }
    return { tree, button, open: all.some((n) => n.props?.role === 'menu') };
  };
  return { doc, render, focused };
}

const clickEvent = () => { const e = { prevented: false, stopped: false }; e.preventDefault = () => { e.prevented = true; }; e.stopPropagation = () => { e.stopped = true; }; return e; };

test('Esc closes the menu and puts focus back on the button that opened it', () => {
  const m = mount();
  m.render().button.props.onClick();
  assert.equal(m.render().open, true);
  m.doc.dispatch('keydown', { key: 'Escape' });
  assert.equal(m.render().open, false);
  assert.deepEqual(m.focused, ['trigger']);
});

test('the outside click that closes the menu does not press what lies under it', () => {
  const m = mount();
  m.render().button.props.onClick();
  m.render();
  m.doc.dispatch('mousedown', { target: 'outside' });
  assert.equal(m.render().open, false);
  m.doc.dispatch('mouseup', {});
  const click = clickEvent();
  m.doc.dispatch('click', click);
  assert.equal(click.prevented && click.stopped, true, 'the closing click is swallowed');
  m.doc.flushTimers();
  const next = clickEvent();
  m.doc.dispatch('click', next);
  assert.equal(next.prevented || next.stopped, false, 'the next click works normally');
});

test('a press outside that ends without a click (a drag) does not eat a later click', () => {
  const m = mount();
  m.render().button.props.onClick();
  m.render();
  m.doc.dispatch('mousedown', { target: 'outside' });
  m.doc.dispatch('mouseup', {});
  m.doc.flushTimers();
  const later = clickEvent();
  m.doc.dispatch('click', later);
  assert.equal(later.prevented || later.stopped, false);
});

test('a press inside the menu does not close it', () => {
  const m = mount();
  m.render().button.props.onClick();
  m.render();
  m.doc.dispatch('mousedown', { target: 'inside' });
  assert.equal(m.render().open, true);
  assert.equal(m.doc.listeners.filter((l) => l.type === 'click').length, 0);
});
