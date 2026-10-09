const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { contractsTh, fillTemplate } = require('./test-i18n.cjs');

function formHarness(props) {
  const states = [], effects = [], refs = [], buttons = [], calls = [];
  let index = 0, refIndex = 0, firstRender = true;
  const labels = { back: 'กลับ', create: 'สร้าง', confirm: 'ยืนยัน', pickInvoice: 'เลือกใบแจ้งหนี้', invalid: 'ผิดพลาด', required: 'กรอกให้ครบ', retry: 'ลองใหม่' };
  const data = {
    documentNo: 'REC-RS202600011', issueDate: '2026-10-05', dueDate: '2026-10-05', reference: 'INV-RS202600011',
    customerName: 'Tenant', customerFirstName: 'Tenant', customerLastName: '', customerAddress: 'Project', customerTaxId: '', customerPhone: '', customerEmail: '',
    issuerName: 'NESTYK', issuerAddress: 'Bangkok', issuerTaxId: '', issuerPhone: '', issuerEmail: '',
    items: [{ description: 'ค่าจอง', quantity: 1, unitPrice: 5000 }], discount: 0, vatRate: 0, paymentMethod: 'transfer', paymentDetails: 'Bank', receiverName: 'Agent', notes: '',
  };
  const saved = { id: 11, receiptUrl: 'receipt.pdf' };
  const hookedReact = { ...React,
    useState: initial => {
      const i = index++;
      if (!(i in states)) states[i] = initial;
      return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }];
    },
    useRef: initial => { const i = refIndex++; return refs[i] ??= { current: initial }; },
    useEffect: fn => { if (firstRender) effects.push(fn); },
  };
  const api = {
    getFinancialDocumentDefaults: async (id, kind) => { calls.push(['linked-defaults', id, kind]); return data; },
    getReceiptDefaults: async id => { calls.push(['standalone-receipt-defaults', id]); return data; },
    listStandaloneInvoices: async () => { calls.push(['standalone-list']); return []; },
    getNextInvoiceNumber: async () => { calls.push(['standalone-number']); return { documentNo: 'INV202600001' }; },
    generateFinancialDocument: async (id, kind, payload) => { calls.push(['linked-create', id, kind, payload]); return saved; },
    createReceiptForInvoice: async () => { throw new Error('Unexpected standalone receipt'); },
    createStandaloneInvoice: async () => { throw new Error('Unexpected standalone invoice'); },
  };
  const mockRequire = name => {
    if (name === 'react') return hookedReact;
    if (name === 'react-native') return { View: 'section', Text: 'span', Pressable: 'button', ActivityIndicator: () => null, BackHandler: { addEventListener: () => ({ remove() {} }) } };
    if (name === 'expo-document-picker' || name === 'expo-image-picker') return {};
    if (name === '@nestyk/i18n') return { fillTemplate, useLocale: () => ({ t: { contracts: contractsTh, common: { cancel: 'ยกเลิก' }, agent: { contracts: { financial: labels, invoice: 'ใบแจ้งหนี้', receipt: 'ใบเสร็จ' } } } }) };
    if (name === '@nestyk/ui/native') return { tokens: { typography: { native: {} }, colors: { roles: { agent: '#f8b615' } } }, useMobileTheme: () => ({ theme: {} }), MobileIcon: () => null,
      MobileInput: ({ label, value }) => React.createElement('input', { 'aria-label': label, value, onChange() {} }),
      MobileBottomSheet: () => null,
      MobileButton: ({ children, onPress }) => { buttons.push({ children, onPress }); return React.createElement('button', {}, children); },
    };
    if (name === '../lib/agent-contracts-api') return api;
    throw new Error(`Unexpected dependency: ${name}`);
  };
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, 'FinancialDocumentForm.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText)(mockRequire, loaded, loaded.exports);
  const result = [];
  const render = () => {
    index = 0; refIndex = 0; buttons.length = 0;
    const markup = renderToStaticMarkup(React.createElement(loaded.exports.FinancialDocumentForm, { onBack() {}, onCreated: value => result.push(value), ...props }));
    firstRender = false;
    return markup;
  };
  return { render, calls, buttons, result, runEffects: async () => { for (const effect of effects) effect(); await new Promise(resolve => setImmediate(resolve)); } };
}

test('booking receipt loads the linked invoice and submits back to that reservation', async () => {
  const h = formHarness({ contractId: 11, kind: 'receipt' });
  h.render(); await h.runEffects();
  const markup = h.render();
  assert.deepEqual(h.calls, [['linked-defaults', 11, 'receipt']]);
  assert.doesNotMatch(markup, /เลือกใบแจ้งหนี้/);
  assert.match(markup, /INV-RS202600011/);
  h.buttons.find(button => button.children === 'ยืนยัน').onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.calls[1].slice(0, 3), ['linked-create', 11, 'receipt']);
  assert.equal(h.calls[1][3].receiverName, 'Agent');
  assert.deepEqual(h.result, [{ id: 11, receiptUrl: 'receipt.pdf' }]);
});

test('ordinary invoices still get their independent number, and ordinary receipts list standalone invoices', async () => {
  const invoice = formHarness({ kind: 'invoice' });
  invoice.render(); await invoice.runEffects();
  assert.deepEqual(invoice.calls, [['standalone-number']]);
  const receipt = formHarness({ kind: 'receipt' });
  receipt.render(); await receipt.runEffects();
  assert.deepEqual(receipt.calls, [['standalone-list']]);
  assert.match(receipt.render(), /เลือกใบแจ้งหนี้/);
});
