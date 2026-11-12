// components/OwnerConfirmedRent.tsx (landlord home "Confirmed rent"): a failed load showed the error and
// "Rent appears here after the agent confirms the slip." together (QA web flow bugs 6 Nov 2026 item 2).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

const root = path.resolve(__dirname, '../../..');
function load(filename, deps) {
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }).outputText;
  new Function('require', 'module', 'exports', source)((id) => {
    if (id in deps) return deps[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, mod, mod.exports);
  return mod.exports;
}
const cache = new Map();
/** Loads a file of the i18n package with its own relative imports. */
function loadTree(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = { exports: {} };
  cache.set(filename, mod);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  new Function('require', 'module', 'exports', source)((id) => {
    const base = path.resolve(path.dirname(filename), id);
    return loadTree([base, `${base}.ts`, `${base}/index.ts`].find((f) => fs.existsSync(f) && fs.statSync(f).isFile()));
  }, mod, mod.exports);
  return mod.exports;
}
const en = loadTree(`${root}/packages/i18n/src/locales/en.ts`).en;
const { localizedError } = load(`${root}/packages/i18n/src/error-message.ts`, {});
const copy = en.owner.bills;

function texts(element) {
  if (element == null || typeof element === 'boolean') return [];
  if (typeof element === 'string' || typeof element === 'number') return [String(element)];
  if (Array.isArray(element)) return element.flatMap(texts);
  return texts(element.props?.children);
}

function card(listReceivedBills) {
  const state = [];
  const effects = [];
  let cursor = 0;
  const deps = {
    react: { ...React,
      useEffect: (effect) => effects.push(effect),
      useState: (initial) => {
        const i = cursor++;
        if (!(i in state)) state[i] = initial;
        return [state[i], (next) => { state[i] = typeof next === 'function' ? next(state[i]) : next; }];
      } },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Text: 'Text', View: 'View', StyleSheet: { create: (x) => x } },
    '@nestyk/i18n': { useLocale: () => ({ t: en, locale: 'en' }), localizedError },
    '@nestyk/ui/native': { MobileBottomSheet: 'Sheet', MobileButton: 'Button', useMobileTheme: () => ({ theme: {} }), roleOnDark: (c) => c,
      tokens: { typography: { native: {} }, colors: { danger: 'red', roles: { landlord: 'blue' } } } },
    '../lib/bill-format': { billFormatters: () => ({ date: String, month: String, amount: String }) },
    '../lib/tenant-bills-api': { listReceivedBills, openReceivedBillSlip: async () => ({}), openReceivedLateFee: async () => ({}) },
    './ContractDocumentPreview': { ContractDocumentPreview: 'Preview' },
  };
  const { OwnerConfirmedRent } = load(path.join(__dirname, 'OwnerConfirmedRent.tsx'), deps);
  const render = () => { cursor = 0; return texts(OwnerConfirmedRent({})); };
  return { render, load: async () => { render(); effects.splice(0).forEach((e) => e()); await new Promise((r) => setImmediate(r)); } };
}

test('a failed load shows only the error, translated, not "no rent yet"', async () => {
  const view = card(async () => { throw Object.assign(new TypeError('Failed to fetch')); });
  await view.load();
  const shown = view.render();
  assert.ok(shown.includes(copy.loadFailed), shown.join(' | '));
  assert.ok(!shown.includes('Failed to fetch'));
  assert.ok(!shown.includes(copy.confirmedEmpty));
});

test('a successful load with no paid bills still says rent appears after the agent confirms the slip', async () => {
  const view = card(async () => [{ id: 'b1', status: 'pending' }]);
  await view.load();
  const shown = view.render();
  assert.ok(shown.includes(copy.confirmedEmpty));
  assert.ok(!shown.includes(copy.loadFailed));
});
