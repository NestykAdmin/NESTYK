// D11 (AC-3.4, 5.4): the agent returns a booking or deposit slip with a reason.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { i18nMock, contractsTh } = require('./test-i18n.cjs');

/** Renders SlipReturnControl with hooks kept between renders (like the other component tests). */
function harness(onReturn, busy = false) {
  const states = [];
  let index = 0;
  const hookedReact = { ...React,
    useState: (initial) => { const i = index++; if (!(i in states)) states[i] = initial; return [states[i], (next) => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; },
  };
  const mockRequire = (name) => {
    if (name === 'react') return hookedReact;
    if (name === 'react-native') return { View: 'section', Text: 'span' };
    if (name === '@nestyk/ui/native') return {
      useMobileTheme: () => ({ theme: {} }), tokens: { typography: { native: {} } },
      MobileButton: 'button',
      MobileInput: 'input',
    };
    if (name === '@nestyk/i18n') return i18nMock();
    throw new Error(`Unexpected dependency: ${name}`);
  };
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, 'SlipReturnControl.tsx'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText)(mockRequire, loaded, loaded.exports);
  const props = { busy, onReturn };
  const nodes = (node) => (!node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]);
  const render = () => { index = 0; const tree = loaded.exports.SlipReturnControl(props); return nodes(tree); };
  const button = (label) => render().find((n) => n.type === 'button' && [n.props.children].flat().join('') === label);
  return { render, button, props, input: () => render().find((n) => n.type === 'input') };
}
const sr = contractsTh.slipReturn;

test('the agent opens the form, must give a reason, and the trimmed reason is sent', async () => {
  const sent = [];
  const h = harness(async (reason) => { sent.push(reason); return true; });
  assert.equal(h.input(), undefined, 'closed at first: only the button');
  h.button(sr.action).props.onPress();
  const input = h.input();
  assert.equal(input.props.label, sr.reason);
  assert.equal(input.props.maxLength, 500);
  assert.equal(input.props.required, true);
  assert.ok(h.render().some((n) => n.type === 'span' && n.props.children === sr.hint), 'says the tenant will see the reason');
  assert.equal(h.button(sr.confirm).props.disabled, true, 'no reason yet');
  h.input().props.onChangeText('   ');
  assert.equal(h.button(sr.confirm).props.disabled, true, 'spaces are not a reason');
  await h.button(sr.confirm).props.onPress();
  assert.deepEqual(sent, []);
  h.input().props.onChangeText('  ยอดไม่ตรง ');
  assert.equal(h.button(sr.confirm).props.disabled, false);
  await h.button(sr.confirm).props.onPress();
  assert.deepEqual(sent, ['ยอดไม่ตรง']);
  assert.equal(h.input(), undefined, 'closed after a successful return');
  h.button(sr.action).props.onPress();
  assert.equal(h.input().props.value, '', 'opening again starts with no reason');
});

test('a failed return keeps the form and the reason; cancel closes it; busy blocks everything', async () => {
  const h = harness(async () => false);
  h.button(sr.action).props.onPress();
  h.input().props.onChangeText('สลิปซ้ำ');
  await h.button(sr.confirm).props.onPress();
  assert.equal(h.input().props.value, 'สลิปซ้ำ', 'kept for another try');
  h.button(sr.cancel).props.onPress();
  assert.equal(h.input(), undefined);
  const sent = [];
  const busy = harness((reason) => { sent.push(reason); }, true);
  assert.equal(busy.button(sr.action).props.disabled, true);
  busy.button(sr.action).props.onPress();
  busy.input().props.onChangeText('x');
  assert.equal(busy.button(sr.confirm).props.disabled, true);
  assert.equal(busy.button(sr.cancel).props.disabled, true);
  await busy.button(sr.confirm).props.onPress();
  assert.deepEqual(sent, [], 'nothing is sent while busy');
});

test('every locale has the same slip return and receipt copy keys', () => {
  const load = (file) => {
    const m = { exports: {} };
    new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../../packages/i18n/src/locales/contracts', file), 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(() => ({}), m, m.exports);
    return Object.values(m.exports)[0];
  };
  for (const file of ['en.ts', 'ja.ts', 'zh.ts']) {
    const copy = load(file);
    for (const block of ['slipReturn', 'receipt']) {
      assert.deepEqual(Object.keys(copy[block]).sort(), Object.keys(contractsTh[block]).sort(), `${file} ${block}`);
      for (const [key, value] of Object.entries(copy[block])) assert.ok(value.trim(), `${file} ${block}.${key}`);
    }
    assert.match(copy.slipReturn.returned, /\{reason\}/, file);
    assert.match(copy.receipt.net, /\{amount\}/, file);
  }
});
