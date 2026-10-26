const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { contractsTh, fillTemplate } = require('./test-i18n.cjs');

function formHarness(props, apiOverrides = {}, dataPatch = {}) {
  const states = [], effects = [], refs = [], buttons = [], calls = [], inputs = [];
  let index = 0, refIndex = 0, firstRender = true;
  const labels = { back: 'กลับ', create: 'สร้าง', confirm: 'ยืนยัน', pickInvoice: 'เลือกใบแจ้งหนี้', invalid: 'ผิดพลาด', required: 'กรอกให้ครบ', retry: 'ลองใหม่',
    markPaid: 'บันทึกการชำระ', slipRequired: 'กรุณาแนบสลิป', paymentSlip: 'สลิปการชำระ', attachSlip: 'แนบสลิป', receiverName: 'ชื่อผู้รับเงิน' };
  const data = {
    documentNo: 'REC-RS202600011', issueDate: '2026-10-05', dueDate: '2026-10-05', reference: 'INV-RS202600011',
    customerName: 'Tenant', customerFirstName: 'Tenant', customerLastName: '', customerAddress: 'Project', customerTaxId: '', customerPhone: '', customerEmail: '',
    issuerName: 'NESTYK', issuerAddress: 'Bangkok', issuerTaxId: '', issuerPhone: '', issuerEmail: '',
    items: [{ description: 'ค่าจอง', quantity: 1, unitPrice: 5000 }], discount: 0, vatRate: 0, paymentMethod: 'transfer', paymentDetails: 'Bank', receiverName: 'Agent', notes: '', ...dataPatch,
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
    ...apiOverrides,
  };
  const mockRequire = name => {
    if (name === 'react') return hookedReact;
    if (name === 'react-native') return { View: 'section', Text: 'span', Pressable: 'button', ActivityIndicator: () => null, BackHandler: { addEventListener: () => ({ remove() {} }) } };
    if (name === 'expo-document-picker' || name === 'expo-image-picker') return {};
    if (name === '@nestyk/i18n') return { fillTemplate, useLocale: () => ({ t: { contracts: contractsTh, common: { cancel: 'ยกเลิก' }, agent: { contracts: { financial: labels, invoice: 'ใบแจ้งหนี้', receipt: 'ใบเสร็จ' } } } }) };
    if (name === '@nestyk/ui/native') return { tokens: { typography: { native: {} }, colors: { roles: { agent: '#f8b615' } } }, useMobileTheme: () => ({ theme: {} }), MobileIcon: () => null,
      MobileInput: (props) => { inputs.push(props); return React.createElement('input', { 'aria-label': props.label, value: props.value, onChange() {} }); },
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
    index = 0; refIndex = 0; buttons.length = 0; inputs.length = 0;
    const markup = renderToStaticMarkup(React.createElement(loaded.exports.FinancialDocumentForm, { onBack() {}, onCreated: value => result.push(value), ...props }));
    firstRender = false;
    return markup;
  };
  return { render, calls, buttons, inputs, result, runEffects: async () => { for (const effect of effects) effect(); await new Promise(resolve => setImmediate(resolve)); } };
}

test('booking receipt loads the linked invoice and submits back to that reservation', async () => {
  const h = formHarness({ contractId: 11, kind: 'receipt' });
  h.render(); await h.runEffects();
  const markup = h.render();
  assert.deepEqual(h.calls, [['linked-defaults', 11, 'receipt']]);
  assert.doesNotMatch(markup, /เลือกใบแจ้งหนี้/);
  assert.match(markup, /INV-RS202600011/);
  assert.ok(h.inputs.some(input => input.label === 'ชื่อผู้รับเงิน'), 'the receiver is typed when the screen does not ask who received it');
  h.buttons.find(button => button.children === 'ยืนยัน').onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.calls[1].slice(0, 3), ['linked-create', 11, 'receipt']);
  assert.equal(h.calls[1][3].receiverName, 'Agent');
  assert.equal('receivedBy' in h.calls[1][3], false, 'D11: no receiver choice unless the screen asks for one');
  assert.equal(h.buttons.some(button => button.children === contractsTh.receipt.agent), false);
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

test('D10: the deposit receipt goes through with the tenant\'s slip on file; without one the agent must attach a slip', async () => {
  for (const slipOnFile of [true, false]) {
    const sent = [];
    const h = formHarness({ kind: 'receipt', fixedInvoiceId: 100, slipOnFile, onStandaloneCreated: (value) => sent.push(value) }, {
      createReceiptForInvoice: async (id, payload, file) => { h.calls.push(['standalone-receipt', id, file]); return { id }; },
    });
    h.render(); await h.runEffects();
    const markup = h.render();
    assert.equal(/สลิปการชำระ(<!-- -->)? \*/.test(markup), !slipOnFile, 'the slip is marked required only when none is on file');
    assert.equal(markup.includes(contractsTh.deposit.slipOnFile), slipOnFile);
    assert.equal(h.buttons.some(button => button.children === 'แนบสลิป'), !slipOnFile, 'the tenant\'s slip is kept: no other slip is attached over it');
    h.buttons.find(button => button.children === 'บันทึกการชำระ').onPress();
    await new Promise(resolve => setImmediate(resolve));
    const created = h.calls.filter(call => call[0] === 'standalone-receipt');
    if (slipOnFile) {
      assert.deepEqual(created, [['standalone-receipt', 100, undefined]], 'no file is sent: the server uses the tenant\'s slip');
      assert.deepEqual(sent, [{ id: 100 }]);
    } else {
      assert.deepEqual(created, []);
      assert.match(h.render(), /กรุณาแนบสลิป/);
    }
  }
});

// D11 (AC-3.5, TC-3.15): the server prints the receiver (the landlord, or the agent with a power of attorney).
const rc = contractsTh.receipt;
const press = async (h, label) => { h.buttons.find((button) => [button.children].flat().join('') === label).onPress(); await new Promise((resolve) => setImmediate(resolve)); };
test('D11: a booking receipt chooses who received the money and may carry the withholding tax', async () => {
  // The server's receipt defaults leave the receiver empty: it is not asked for here, so it does not block the form.
  const h = formHarness({ contractId: 11, kind: 'receipt', landlordReceipt: 'reservation' }, {}, { receiverName: '' });
  h.render(); await h.runEffects();
  let markup = h.render();
  assert.equal(h.inputs.some((input) => input.label === 'ชื่อผู้รับเงิน'), false, 'no receiver name input');
  assert.ok(h.buttons.some((button) => button.children === rc.landlord) && h.buttons.some((button) => button.children === rc.agent));
  assert.doesNotMatch(markup, new RegExp(rc.agentHint));
  await press(h, 'ยืนยัน');
  assert.equal(h.calls[1][3].receivedBy, 'landlord', 'the landlord by default');
  assert.equal('withholdingTax' in h.calls[1][3], false);
  h.render();
  await press(h, rc.agent);
  markup = h.render();
  assert.match(markup, new RegExp(rc.agentHint));
  h.inputs.find((input) => input.label === rc.withholdingTax).onChangeText('1,000');
  markup = h.render();
  assert.match(markup, /รับเงินสุทธิ 4,000\.00/);
  await press(h, 'ยืนยัน');
  assert.deepEqual([h.calls[2][3].receivedBy, h.calls[2][3].withholdingTax], ['agent', 1000]);
  for (const bad of ['5000', '6000', '-1', 'abc', '1.234']) {
    h.render();
    h.inputs.find((input) => input.label === rc.withholdingTax).onChangeText(bad);
    h.render();
    const before = h.calls.length;
    await press(h, 'ยืนยัน');
    assert.equal(h.calls.length, before, bad);
    assert.match(h.render(), new RegExp(rc.withholdingInvalid), bad);
  }
});

test('D11: a missing power of attorney shows the app\'s own reason', async () => {
  const h = formHarness({ contractId: 11, kind: 'receipt', landlordReceipt: 'reservation' }, {
    generateFinancialDocument: async () => { throw Object.assign(new Error('Thai-only server text'), { code: 'POWER_OF_ATTORNEY_REQUIRED' }); },
  });
  h.render(); await h.runEffects(); h.render();
  await press(h, rc.agent);
  h.render();
  await press(h, 'ยืนยัน');
  const markup = h.render();
  assert.match(markup, new RegExp(rc.poaRequired));
  assert.doesNotMatch(markup, /Thai-only server text/);
});

test('D11: a deposit receipt chooses the receiver but has no withholding tax', async () => {
  const payloads = [];
  const h = formHarness({ kind: 'receipt', fixedInvoiceId: 100, slipOnFile: true, landlordReceipt: 'deposit', onStandaloneCreated() {} }, {
    createReceiptForInvoice: async (id, payload) => { payloads.push(payload); return { id }; },
  }, { receiverName: '' });
  h.render(); await h.runEffects(); h.render();
  assert.equal(h.inputs.some((input) => input.label === rc.withholdingTax), false);
  assert.equal(h.inputs.some((input) => input.label === 'ชื่อผู้รับเงิน'), false, 'no receiver name input');
  await press(h, 'บันทึกการชำระ');
  h.render();
  await press(h, rc.agent);
  h.render();
  await press(h, 'บันทึกการชำระ');
  assert.deepEqual(payloads.map((payload) => [payload.receivedBy, 'withholdingTax' in payload]), [['landlord', false], ['agent', false]]);
});
