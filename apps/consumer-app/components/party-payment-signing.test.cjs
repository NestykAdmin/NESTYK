const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { contractsTh, fillTemplate, leadFormat } = require('./test-i18n.cjs');

const i18nMock = {
  useLocale: () => ({
    locale: 'th',
    t: {
      common: { fileTooLarge: 'ไฟล์ต้องไม่เกิน {size} MB' },
      contracts: contractsTh,
      mobile: { partyContracts: { bookingPaymentBeforeSigning: 'ผู้เช่าต้องชำระค่าจอง และรอเอเจนต์ตรวจสอบการชำระพร้อมออกใบเสร็จก่อนลงนาม' } },
    },
  }),
  fillTemplate,
  localizedError: (error, fallback) => (error instanceof Error && error.message) || fallback,
};

function harness(contract) {
  const states = [], effects = [], buttons = [];
  let index = 0, first = true;
  const mockedReact = { ...React,
    useState: initial => {
      const i = index++;
      if (!(i in states)) states[i] = initial;
      return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }];
    },
    useRef: initial => ({ current: initial }),
    useEffect: fn => { if (first) effects.push(fn); },
  };
  const requireMock = name => {
    if (name === 'react') return mockedReact;
    if (name === 'react-native') return { View: 'section', Text: 'span', ActivityIndicator: () => null, StyleSheet: { create: styles => styles } };
    if (name === 'expo-document-picker' || name === 'expo-image-picker') return {};
    if (name === '@nestyk/ui/native') return {
      useMobileTheme: () => ({ theme: {} }), tokens: { typography: { native: {} }, colors: { brand: { 500: '#f8b615' }, roles: { owner: '#f8b615' } } },
      MobileBottomSheet: () => null, MobileIcon: () => null,
      MobileButton: ({ children, disabled, onPress }) => { buttons.push({ label: React.Children.toArray(children).join(''), disabled, onPress }); return React.createElement('button', { disabled }, children); },
    };
    if (name === '../lib/party-contracts-api') return { listMyAttachments: async () => ({ requirements: [], documents: [], documentTypes: [] }) };
    if (name === '../lib/contract-signing') return load('../lib/contract-signing.ts');
    if (name === '@nestyk/i18n') return i18nMock;
    if (name === '../lib/lead-format') return leadFormat;
    if (name === './ReservationPaymentCard') return { ReservationPaymentCard: () => null };
    if (name === './TenantContractList') return { TenantContractAttachments: () => null };
    if (name === './ContractDocumentPreview') return { ContractDocumentPreview: () => null };
    if (name === './ContractSignaturePad') return { ContractSignaturePad: () => null };
    throw new Error(`Unexpected dependency: ${name}`);
  };
  function load(filename) {
    const loaded = { exports: {} };
    new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, filename), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText)(requireMock, loaded, loaded.exports);
    return loaded.exports;
  }
  const { PartyContractDetail } = load('PartyContractDetail.tsx');
  const render = () => {
    index = 0; buttons.length = 0;
    const markup = renderToStaticMarkup(React.createElement(PartyContractDetail, { contract, onUpdated() {} }));
    first = false;
    return markup;
  };
  return { render, buttons, ready: async () => { render(); effects.forEach(effect => effect()); await new Promise(resolve => setImmediate(resolve)); } };
}
const booking = { id: 11, formKind: 'reservation', status: 'draft', myParties: ['tenant'], receiptUrl: null, reservationFee: 5000, contractNo: 'RS202600011' };

test('tenant sees why signing is disabled even when their documents are ready', async () => {
  const h = harness({ ...booking, reservationPayment: { status: 'submitted' } });
  await h.ready();
  assert.match(h.render(), /ต้องชำระค่าจอง/);
  assert.equal(h.buttons.find(button => button.label === 'ลงนามผู้เช่า').disabled, true);
});

test('tenant signing unlocks after receipt issuance and owner signing needs no booking payment', async () => {
  for (const contract of [{ ...booking, receiptUrl: 'receipt.pdf' }, { ...booking, myParties: ['owner'] }]) {
    const h = harness(contract);
    await h.ready();
    assert.doesNotMatch(h.render(), /ต้องชำระค่าจอง/);
    const label = contract.myParties[0] === 'tenant' ? 'ลงนามผู้เช่า' : 'ลงนามผู้ให้เช่า';
    assert.equal(h.buttons.find(button => button.label === label).disabled, false);
  }
});
