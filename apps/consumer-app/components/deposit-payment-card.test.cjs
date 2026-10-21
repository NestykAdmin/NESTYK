// D10: the deposit card of a generated lease, for the agent and for the tenant and landlord.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { i18nMock, leadFormat } = require('./test-i18n.cjs');
const loaded = { exports: {} };
const pressed = [];
const mockRequire = name => {
  if (name === 'react') return React;
  if (name === 'react-native') return { View: 'section', Text: 'span' };
  if (name === '@nestyk/ui/native') return {
    useMobileTheme: () => ({ theme: {} }),
    tokens: { typography: { native: {} } },
    MobileButton: ({ children, disabled, onPress }) => { pressed.push([[].concat(children).join(''), onPress]); return React.createElement('button', { disabled }, children); },
  };
  if (name === '@nestyk/i18n') return i18nMock();
  if (name === '../lib/lead-format') return leadFormat;
  throw new Error(`Unexpected dependency: ${name}`);
};
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, 'DepositPaymentCard.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText)(mockRequire, loaded, loaded.exports);
const { DepositPaymentCard } = loaded.exports;
const deposit = { status: 'unpaid', total: 40000, invoiceId: 100, invoiceDocumentNo: 'DEP-LS202600011', dueDate: '2026-11-01',
  invoiceUrl: 'invoice.pdf', receiptDocumentNo: null, receiptUrl: null, paymentSlipUrl: null, submittedAt: null };
const base = { contractNo: 'LS202600011', status: 'active', formKind: 'lease', depositPayment: deposit };
const render = (patch = {}, props = {}) => {
  pressed.length = 0;
  return renderToStaticMarkup(React.createElement(DepositPaymentCard, { contract: { ...base, ...patch }, busy: false, onOpen() {}, ...props }));
};
const withDeposit = (patch) => ({ depositPayment: { ...deposit, ...patch } });

test('no card when there is no deposit to pay (not a generated lease, or a deposit of 0)', () => {
  assert.equal(render({ depositPayment: null }, { onUpload() {}, onIssueReceipt() {}, onIssueInvoice() {} }), '');
  assert.equal(render({ depositPayment: undefined }), '');
});

test('tenant sees the landlord\'s deposit invoice, the amount and the due date, and sends the slip', () => {
  const opened = [];
  const markup = render({}, { onUpload() {}, onOpen: (kind) => opened.push(kind) });
  assert.match(markup, /การชำระเงินประกัน/);
  assert.match(markup, /ออกในนามผู้ให้เช่า · ผูกกับสัญญาเช่า LS202600011/);
  assert.match(markup, /ยอดเงินประกัน ฿40,000\.00/);
  assert.match(markup, /ครบกำหนดชำระ 1 พ\.ย\. 2569</, 'the due date 2026-11-01 in Thai (Buddhist year)');
  assert.doesNotMatch(markup, /Invalid Date/);
  assert.match(markup, /ดูใบแจ้งหนี้เงินประกัน DEP-LS202600011/);
  assert.match(markup, /อัปโหลดสลิปชำระเงินประกัน/);
  assert.doesNotMatch(markup, /<button>(ตรวจสอบการชำระและออกใบเสร็จ|ออกใบแจ้งหนี้เงินประกัน)/);
  pressed.find(([label]) => label.startsWith('ดูใบแจ้งหนี้เงินประกัน'))[1]();
  assert.deepEqual(opened, ['deposit-invoice']);
});

test('a submitted slip can be viewed and replaced by the tenant, and the agent verifies it', () => {
  const patch = withDeposit({ status: 'submitted', paymentSlipUrl: 'slip.jpg' });
  const tenant = render(patch, { onUpload() {} });
  assert.match(tenant, /รอตรวจสอบ/);
  assert.match(tenant, /ดูสลิปชำระเงินประกัน/);
  assert.match(tenant, /อัปโหลดสลิปใหม่/);
  const landlord = render(patch);
  assert.doesNotMatch(landlord, /<button>(อัปโหลดสลิป|ตรวจสอบการชำระ)/, 'the landlord only views');
  let verified = false;
  const agent = render(patch, { onIssueReceipt: () => { verified = true; } });
  assert.match(agent, /ตรวจสอบการชำระและออกใบเสร็จ/);
  assert.doesNotMatch(agent, /<button>อัปโหลดสลิป/);
  pressed.find(([label]) => label === 'ตรวจสอบการชำระและออกใบเสร็จ')[1]();
  assert.equal(verified, true);
});

test('paid deposits show the receipt; closed leases keep the documents but hide payment actions', () => {
  const paid = render(withDeposit({ status: 'paid', paymentSlipUrl: 'slip.jpg', receiptUrl: 'receipt.pdf', receiptDocumentNo: 'REC-DEP-LS202600011' }), { onUpload() {}, onIssueReceipt() {} });
  assert.match(paid, /ชำระแล้ว/);
  assert.match(paid, /ดูใบเสร็จเงินประกัน REC-DEP-LS202600011/);
  assert.doesNotMatch(paid, /<button>(อัปโหลดสลิป|ตรวจสอบการชำระ)/);
  for (const status of ['cancelled', 'expired', 'terminated']) {
    const closed = render({ status }, { onUpload() {}, onIssueReceipt() {}, onIssueInvoice() {} });
    assert.match(closed, /ดูใบแจ้งหนี้เงินประกัน/);
    assert.match(closed, /สัญญาเช่าปิดแล้ว/);
    assert.doesNotMatch(closed, /<button>(อัปโหลดสลิป|ตรวจสอบการชำระ)/);
  }
});

test('a deposit invoice that failed to issue shows "not issued"; only the agent can issue it again', () => {
  const notIssued = withDeposit({ status: 'not_issued', invoiceId: null, invoiceDocumentNo: null, dueDate: null, invoiceUrl: null });
  let issued = false;
  const agent = render(notIssued, { onIssueReceipt() {}, onIssueInvoice: () => { issued = true; } });
  assert.match(agent, /ยังไม่ออกใบแจ้งหนี้/);
  assert.match(agent, /ยอดเงินประกัน ฿40,000\.00/);
  assert.doesNotMatch(agent, /<button>(ดูใบแจ้งหนี้|ตรวจสอบการชำระ)|ครบกำหนดชำระ/);
  pressed.find(([label]) => label === 'ออกใบแจ้งหนี้เงินประกัน')[1]();
  assert.equal(issued, true);
  const tenant = render(notIssued, { onUpload() {} });
  assert.match(tenant, /ยังไม่ได้ออกใบแจ้งหนี้เงินประกัน/);
  assert.doesNotMatch(tenant, /<button/, 'nothing to press yet');
  const closed = render({ ...notIssued, status: 'terminated' }, { onIssueInvoice() {} });
  assert.doesNotMatch(closed, /<button/);
});

test('every locale has the same deposit copy keys', () => {
  const load = (file) => { const out = { exports: {} }; new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(() => ({}), out, out.exports); return out.exports; };
  const dir = path.join(__dirname, '../../../packages/i18n/src/locales/contracts');
  const keys = (value) => Object.entries(value).flatMap(([key, item]) => (item && typeof item === 'object' ? keys(item).map((sub) => `${key}.${sub}`) : [key])).sort();
  const th = keys(load(path.join(dir, 'th.ts')).contractsTh.deposit);
  for (const [file, name] of [['en.ts', 'contractsEn'], ['ja.ts', 'contractsJa'], ['zh.ts', 'contractsZh']])
    assert.deepEqual(keys(load(path.join(dir, file))[name].deposit), th, file);
});

test('while busy every button of the card is disabled', () => {
  const markup = render(withDeposit({ status: 'submitted', paymentSlipUrl: 'slip.jpg' }), { busy: true, onUpload() {}, onIssueReceipt() {} });
  assert.ok(pressed.length >= 3);
  assert.doesNotMatch(markup, /<button>/, 'no enabled button');
});
