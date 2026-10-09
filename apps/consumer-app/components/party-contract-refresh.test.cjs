const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { contractsTh, fillTemplate } = require('./test-i18n.cjs');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness(party) {
  const states = [], refs = [], effectDeps = [], effects = [], requests = [], settled = [];
  let stateIndex = 0, refIndex = 0, effectIndex = 0, refresh, detail;
  const contract = { id: 11, property: 'Project', room: '101', formKind: 'reservation', status: 'draft', myParties: [party], invoiceUrl: 'old-invoice.pdf', receiptUrl: null };
  const props = {
    opened: contract, selectedRoom: null, reloadToken: 0,
    onOpenedChange: next => { props.opened = next; }, onSelectedRoomChange() {},
    onReloadSettled: token => settled.push(token),
    onRefresh: () => { props.reloadToken += 1; },
  };
  const hookedReact = { ...React,
    useState: initial => { const i = stateIndex++; if (!(i in states)) states[i] = initial; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; },
    useRef: initial => { const i = refIndex++; return refs[i] ??= { current: initial }; },
    useEffect: (fn, deps) => {
      const i = effectIndex++, old = effectDeps[i];
      if (!old || deps.some((value, j) => value !== old[j])) { effects.push(fn); effectDeps[i] = deps; }
    },
  };
  const mockRequire = name => {
    if (name === 'react') return hookedReact;
    if (name === 'react-native') return {
      View: 'section', Text: 'span', Pressable: 'button', ActivityIndicator: () => null,
      StyleSheet: { create: styles => styles }, Modal: ({ children, visible }) => visible ? children : null,
      ScrollView: ({ children, refreshControl }) => React.createElement(React.Fragment, {}, refreshControl, children),
      RefreshControl: props => { refresh = props; return null; },
    };
    if (name === 'react-native-safe-area-context') return { SafeAreaProvider: ({ children }) => children, SafeAreaView: 'section' };
    if (name === '@nestyk/ui/native') return {
      tokens: { colors: { brand: { 500: '#f8b615' }, roles: { owner: '#f8b615' } }, typography: { native: {} } },
      useMobileTheme: () => ({ theme: {} }), MobileIcon: () => null, MobileSectionHeader: () => null,
      MobileButton: ({ children }) => React.createElement('button', {}, children),
    };
    if (name === './PartyContractDetail') return { PartyContractDetail: props => { detail = props; return React.createElement('span', {}, `${props.contract.invoiceUrl} ${props.contract.receiptUrl ?? ''}`); } };
    if (name === '../lib/party-contracts-api') return { listMyContracts: () => { const request = deferred(); requests.push(request); return request.promise; } };
    if (name === '@nestyk/i18n') return {
      useLocale: () => ({ locale: 'th', t: { contracts: contractsTh, mobile: { partyContracts: { loadFailed: 'โหลดสัญญาไม่สำเร็จ' } } } }),
      fillTemplate,
      localizedError: (error, fallback) => (error instanceof Error && error.message) || fallback,
    };
    throw new Error(`Unexpected dependency: ${name}`);
  };
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, 'PartyContractsScreen.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText)(mockRequire, loaded, loaded.exports);
  function render() {
    stateIndex = refIndex = effectIndex = 0;
    return renderToStaticMarkup(React.createElement(loaded.exports.PartyContractsScreen, props));
  }
  function runEffects() { effects.splice(0).forEach(fn => fn()); }
  async function initialLoad() {
    render(); runEffects(); requests[0].resolve([contract]);
    await new Promise(resolve => setImmediate(resolve));
    render(); detail.onReloadSettled(0); render(); runEffects();
  }
  return { props, requests, settled, render, runEffects, initialLoad, get refresh() { return refresh; }, get detail() { return detail; } };
}

for (const party of ['owner', 'tenant']) {
  test(`${party} detail pull refresh replaces stale contract and waits for attachment loading`, async () => {
    const h = harness(party);
    await h.initialLoad();
    assert.equal(h.refresh.refreshing, false);
    h.refresh.onRefresh(); h.render(); h.runEffects();
    assert.equal(h.refresh.refreshing, true);
    assert.equal(h.detail.reloadToken, 1);
    h.requests[1].resolve([{ ...h.props.opened, invoiceUrl: 'latest-invoice.pdf', receiptUrl: 'receipt.pdf' }]);
    await new Promise(resolve => setImmediate(resolve));
    assert.match(h.render(), /latest-invoice.pdf receipt.pdf/);
    h.runEffects();
    assert.equal(h.refresh.refreshing, true);
    assert.equal(h.settled.includes(1), false);
    h.detail.onReloadSettled(1); h.render(); h.runEffects();
    assert.equal(h.refresh.refreshing, false);
    assert.equal(h.settled.at(-1), 1);
  });
}

test('failed contract refresh keeps the open detail and stops after both requests settle', async () => {
  const h = harness('tenant');
  await h.initialLoad();
  h.refresh.onRefresh(); h.render(); h.runEffects();
  h.detail.onReloadSettled(1); h.render(); h.runEffects();
  assert.equal(h.refresh.refreshing, true);
  h.requests[1].reject(new Error('Network unavailable'));
  await new Promise(resolve => setImmediate(resolve));
  h.render(); h.runEffects();
  assert.equal(h.props.opened.id, 11);
  assert.equal(h.detail.refreshError, 'Network unavailable');
  assert.equal(h.refresh.refreshing, false);
});
