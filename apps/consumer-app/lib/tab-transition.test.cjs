// Slide between menus (Jom 25 Nov 2026): self owner only for now; the new page slides in from the side its menu
// item is on (later in the menu → from the right, earlier → from the left).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', source)(require, module, module.exports);
  return module.exports;
}
const lib = () => load(path.join(__dirname, 'tab-transition.ts'));

test('self owner: later menu item slides in from the right, earlier from the left', () => {
  const { tabSlideDirection } = lib();
  assert.equal(tabSlideDirection('self_owner', 'dashboard', 'listingRoom'), 'right');
  assert.equal(tabSlideDirection('self_owner', 'listingRoom', 'contracts'), 'right');
  assert.equal(tabSlideDirection('self_owner', 'contracts', 'income'), 'right');
  assert.equal(tabSlideDirection('self_owner', 'income', 'dashboard'), 'left');
  assert.equal(tabSlideDirection('self_owner', 'contracts', 'listingRoom'), 'left');
  assert.equal(tabSlideDirection('self_owner', 'listingRoom', 'services'), 'right', 'phone tab bar order');
  assert.equal(tabSlideDirection('self_owner', 'services', 'menu'), 'right');
});

test('no slide for the same menu, other roles, or the first page', () => {
  const { tabSlideDirection } = lib();
  assert.equal(tabSlideDirection('self_owner', 'contracts', 'contracts'), null);
  for (const role of ['agent', 'tenant', 'landlord', 'admin', 'guest']) assert.equal(tabSlideDirection(role, 'dashboard', 'contracts'), null, role);
  assert.equal(tabSlideDirection('self_owner', null, 'dashboard'), null);
});

test('a menu not in the list slides in from the right', () => {
  const { tabSlideDirection } = lib();
  assert.equal(tabSlideDirection('self_owner', 'dashboard', 'somethingNew'), 'right');
  assert.equal(tabSlideDirection('self_owner', 'somethingNew', 'dashboard'), 'right');
});

test('the shell wraps each page in TabTransition with the computed direction', () => {
  const code = fs.readFileSync(path.join(__dirname, '../app/index.tsx'), 'utf8');
  assert.match(code, /<TabTransition key=\{`\$\{activeRole\}-\$\{activeTab\}-\$\{partyInbox \? 'inbox' : 'tab'\}`\} direction=\{tabSlide\}>/);
  assert.match(code, /const tabSlide = tabSlideDirection\(activeRole, lastTabRef\.current, activeTab\);/);
  assert.doesNotMatch(code, /<React\.Fragment key=\{`\$\{activeRole\}-\$\{activeTab\}/);
});

test('web: the slide wraps the page only when there is a direction, and respects reduced motion', () => {
  const React = require('react');
  const loadTsx = (file) => {
    const module = { exports: {} };
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
    const req = (name) => (name.endsWith('.css') ? {} : name === 'react' ? { ...React, useState: (v) => [typeof v === 'function' ? v() : v, () => {}] } : require(name));
    new Function('require', 'module', 'exports', source)(req, module, module.exports);
    return module.exports;
  };
  const { TabTransition } = loadTsx(path.join(__dirname, '../components/TabTransition.web.tsx'));
  const child = React.createElement('p', null, 'page');
  const plain = TabTransition({ direction: null, children: child });
  assert.equal(plain.type, React.Fragment);
  const slid = TabTransition({ direction: 'left', children: child });
  assert.equal(slid.type, 'div');
  assert.equal(slid.props.className, 'tab-slide tab-slide-left');
  const css = fs.readFileSync(path.join(__dirname, '../components/tab-transition.css'), 'utf8');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[^}]*\.tab-slide[^}]*animation: none/);
});

// Recheck 25 Nov 2026: the wrapper stays after the slide, so it must pass the page's full height through, or the
// add-room form (flex: 1; min-height: 0, scrolls inside) stopped filling the screen on web and overflowed on the phone.
test('the slide wrapper passes the height through: grows to fill, shrinks to fit (web and phone)', () => {
  const css = fs.readFileSync(path.join(__dirname, '../components/tab-transition.css'), 'utf8');
  const rule = css.slice(css.indexOf('.tab-slide {'), css.indexOf('}', css.indexOf('.tab-slide {')));
  for (const decl of [/display: flex/, /flex-direction: column/, /flex: 1 1 auto/, /min-height: 0/, /min-width: 0/]) assert.match(rule, decl);
  const native = fs.readFileSync(path.join(__dirname, '../components/TabTransition.tsx'), 'utf8');
  assert.match(native, /flexGrow: 1/);
  assert.match(native, /flexShrink: 1/);
  assert.match(native, /minHeight: 0/);
});

// Jom 25 Nov 2026: faster — 140 ms on web and phone (was 200 ms), same 24 px.
test('the slide lasts 140 ms on web and phone', () => {
  const css = fs.readFileSync(path.join(__dirname, '../components/tab-transition.css'), 'utf8');
  assert.match(css, /animation: tab-slide-in 140ms /);
  const native = fs.readFileSync(path.join(__dirname, '../components/TabTransition.tsx'), 'utf8');
  assert.match(native, /duration: 140,/);
});
