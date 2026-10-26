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
// D11: the agent's slip return control (tested on its own in slip-return-control.test.cjs).
const returnControls = [];
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
  if (name === './SlipReturnControl') return { SlipReturnControl: (props) => { returnControls.push(props); return React.createElement('slip-return', { busy: String(props.busy) }); } };
  throw new Error(`Unexpected dependency: ${name}`);
};
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, 'DepositPaymentCard.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText)(mockRequire, loaded, loaded.exports);
const { DepositPaymentCard } = loaded.exports;
const deposit = { status: 'unpaid', total: 40000, invoiceId: 100, invoiceDocumentNo: 'DEP-LS202600011', dueDate: '2026-11-01',
  invoiceUrl: 'invoice.pdf', receiptDocumentNo: null, receiptUrl: null, paymentSlipUrl: null, submittedAt: null };
const base = { contractNo: 'LS202600011', status: 'active', formKind: 'lease', depositPayment: deposit };
const render = (patch = {}, props = {}) => {
  pressed.length = 0;
  returnControls.length = 0;
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

test('D7: a cancelled deposit invoice says the tenant need not pay, keeps the documents, and has no payment actions', () => {
  const all = { onUpload() {}, onIssueReceipt() {}, onIssueInvoice() {} };
  // Aof, 22 Oct 2026: the lease was closed before the deposit was paid; the tenant had sent a slip.
  // Terminated: the tenant and the landlord still see the lease (a cancelled one is shown to the agent only).
  const withSlip = render({ status: 'terminated', ...withDeposit({ status: 'voided', paymentSlipUrl: 'slip.jpg' }) }, all);
  assert.match(withSlip, /ยกเลิกแล้ว/);
  assert.match(withSlip, /สถานะการชำระเงินประกัน: ยกเลิกแล้ว/);
  assert.match(withSlip, /ใบแจ้งหนี้นี้ถูกยกเลิก เพราะปิดสัญญาก่อนชำระเงินประกัน ผู้เช่าไม่ต้องชำระแล้ว/);
  assert.match(withSlip, /มีสลิปที่ผู้เช่าส่งไว้ก่อนปิดสัญญา ถ้ามีการโอนเงินแล้ว ต้องคืนเงินให้ผู้เช่านอกระบบ ติดต่อนายหน้าเพื่อดำเนินการ/);
  assert.match(withSlip, /ดูใบแจ้งหนี้เงินประกัน DEP-LS202600011/);
  assert.match(withSlip, /ดูสลิปชำระเงินประกัน/);
  assert.doesNotMatch(withSlip, /อัปโหลดสลิป|ตรวจสอบการชำระและออกใบเสร็จ|<button>ออกใบแจ้งหนี้เงินประกัน/);
  // No slip: no refund note. A cancelled invoice has no actions even if the lease status were still open.
  const noSlip = render({ status: 'awaiting_deposit', ...withDeposit({ status: 'voided' }) }, all);
  assert.match(noSlip, /ผู้เช่าไม่ต้องชำระแล้ว/);
  assert.doesNotMatch(noSlip, /มีสลิปที่ผู้เช่าส่งไว้/);
  assert.doesNotMatch(noSlip, /อัปโหลดสลิป|ตรวจสอบการชำระและออกใบเสร็จ|<button>ออกใบแจ้งหนี้เงินประกัน/);
  assert.doesNotMatch(render(withDeposit({ status: 'unpaid' }), all), /ยกเลิกแล้ว|ไม่ต้องชำระแล้ว/);
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

test('D11 (AC-5.4): the agent can return a slip the tenant sent; the tenant sees why it was returned', () => {
  const onReturnSlip = async () => true;
  const submitted = withDeposit({ status: 'submitted', paymentSlipUrl: 'slip.jpg', submittedAt: '2026-10-21T03:00:00Z' });
  const agent = render(submitted, { onIssueReceipt() {}, onReturnSlip, busy: true });
  assert.match(agent, /<slip-return busy="true"><\/slip-return>/);
  assert.equal(returnControls.length, 1);
  assert.equal(returnControls[0].onReturn, onReturnSlip);
  // Not for the tenant or the landlord, not for a slip the agent attached itself, not once paid, cancelled or closed.
  for (const [label, patch, props] of [
    ['tenant', submitted, { onUpload() {} }],
    ['agent attached the slip', withDeposit({ status: 'submitted', paymentSlipUrl: 'slip.jpg', submittedAt: null }), { onReturnSlip }],
    ['unpaid', withDeposit({ status: 'unpaid' }), { onReturnSlip }],
    ['paid', withDeposit({ status: 'paid', paymentSlipUrl: 'slip.jpg', submittedAt: '2026-10-21T03:00:00Z', receiptUrl: 'r.pdf' }), { onReturnSlip }],
    ['voided', withDeposit({ status: 'voided', paymentSlipUrl: 'slip.jpg', submittedAt: '2026-10-21T03:00:00Z' }), { onReturnSlip }],
    ['closed', { ...submitted, status: 'terminated' }, { onReturnSlip }],
  ]) assert.doesNotMatch(render(patch, props), /slip-return/, label);
  const returned = withDeposit({ status: 'unpaid', slipReturnReason: 'สลิปอ่านไม่ออก' });
  const tenant = render(returned, { onUpload() {} });
  assert.match(tenant, /นายหน้าตีกลับสลิป: สลิปอ่านไม่ออก กรุณาส่งสลิปใหม่/);
  assert.match(tenant, /อัปโหลดสลิปชำระเงินประกัน/, 'the tenant can send a new slip');
  assert.doesNotMatch(render({ ...returned, status: 'terminated' }, { onUpload() {} }), /ตีกลับสลิป/, 'not for a closed lease');
  assert.doesNotMatch(render(withDeposit({ status: 'submitted', paymentSlipUrl: 'slip.jpg', slipReturnReason: 'old' }), { onUpload() {} }), /ตีกลับสลิป/,
    'the reason shows only while waiting for a new slip');
});

test('D11: the deposit return control belongs to one slip (keyed by when the tenant sent it)', () => {
  const nodes = (node) => (!node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]);
  const control = (submittedAt) => nodes(DepositPaymentCard({ contract: { ...base, ...withDeposit({ status: 'submitted', paymentSlipUrl: 's.jpg', submittedAt }) },
    busy: false, onOpen() {}, onReturnSlip() {} })).find((n) => n.props?.onReturn);
  assert.equal(control('2026-10-22T03:00:00.000Z').key, '2026-10-22T03:00:00.000Z');
  assert.equal(control('2026-10-22T05:00:00.000Z').key, '2026-10-22T05:00:00.000Z');
});
