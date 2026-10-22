const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { i18nMock, contractsTh, fillTemplate, leadFormat } = require('./test-i18n.cjs');
const loaded = { exports: {} };
// D11: the agent's slip return control (tested on its own in slip-return-control.test.cjs).
const returnControls = [];
const mockRequire = name => {
  if (name === 'react') return React;
  if (name === 'react-native') return { View: 'section', Text: 'span' };
  if (name === '@nestyk/ui/native') return {
    useMobileTheme: () => ({ theme: {} }),
    tokens: { typography: { native: {} } },
    MobileButton: ({ children, disabled }) => React.createElement('button', { disabled }, children),
  };
  if (name === '@nestyk/i18n') return i18nMock();
  if (name === '../lib/lead-format') return leadFormat;
  if (name === './SlipReturnControl') return { SlipReturnControl: (props) => { returnControls.push(props); return React.createElement('slip-return', { busy: String(props.busy) }); } };
  throw new Error(`Unexpected dependency: ${name}`);
};
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, 'ReservationPaymentCard.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText)(mockRequire, loaded, loaded.exports);
const { ReservationPaymentCard } = loaded.exports;
const base = { contractNo: 'RS202600011', status: 'draft', reservationFee: 5000, invoiceUrl: 'invoice.pdf', receiptUrl: null, reservationPayment: { invoiceDocumentNo: 'INV-RS202600011', total: 5000, status: 'unpaid', paymentSlipUrl: null } };
const render = (patch = {}, props = {}) => (returnControls.length = 0, renderToStaticMarkup(React.createElement(ReservationPaymentCard, { contract: { ...base, ...patch }, busy: false, onOpen() {}, ...props })));

test('tenant sees the booking invoice and upload action before signing, and waits for a receipt', () => {
  const markup = render({}, { onUpload() {} });
  assert.match(markup, /INV-RS202600011/);
  assert.match(markup, /5,000.00/);
  assert.match(markup, /อัปโหลดสลิปชำระค่าจอง/);
  assert.doesNotMatch(markup, /ออกใบเสร็จ<\/button>/);
});

test('submitted payment offers slip viewing and replacement, while agent can issue a receipt', () => {
  const patch = { reservationPayment: { ...base.reservationPayment, status: 'submitted', paymentSlipUrl: 'slip.jpg' } };
  const tenant = render(patch, { onUpload() {} });
  assert.match(tenant, /รอตรวจสอบ/);
  assert.match(tenant, /ดูสลิปชำระค่าจอง/);
  assert.match(tenant, /อัปโหลดสลิปใหม่/);
  const agent = render(patch, { onIssueReceipt() {} });
  assert.match(agent, /ตรวจสอบการชำระและออกใบเสร็จ/);
  assert.doesNotMatch(agent, /อัปโหลดสลิปใหม่/);
});

test('paid and closed contracts retain document viewing while payment changes are hidden', () => {
  const paid = render({ receiptUrl: 'receipt.pdf', reservationPayment: { ...base.reservationPayment, status: 'paid', receiptDocumentNo: 'REC-RS202600011' } }, { onUpload() {}, onIssueReceipt() {} });
  assert.match(paid, /ดูใบเสร็จค่าจอง REC-RS202600011/);
  assert.doesNotMatch(paid, /อัปโหลดสลิป|ตรวจสอบการชำระและออกใบเสร็จ/);
  for (const status of ['cancelled', 'expired', 'terminated']) {
    const closed = render({ status }, { onUpload() {}, onIssueReceipt() {} });
    assert.match(closed, /ดูใบแจ้งหนี้ค่าจอง/);
    assert.doesNotMatch(closed, /อัปโหลดสลิป|ตรวจสอบการชำระและออกใบเสร็จ/);
  }
});

test('old reservations require a linked invoice before payment submission', () => {
  const old = render({ reservationPayment: null }, { onUpload() {}, onCreateInvoice() {}, onIssueReceipt() {} });
  assert.match(old, /สร้างใบแจ้งหนี้ค่าจองที่ผูกกับหนังสือจอง/);
  assert.doesNotMatch(old, /อัปโหลดสลิป|ตรวจสอบการชำระและออกใบเสร็จ/);
});

test('D11 (AC-3.4): the agent can return a submitted booking slip; the tenant sees why it was returned', () => {
  const onReturnSlip = async () => true;
  const submitted = { reservationPayment: { ...base.reservationPayment, status: 'submitted', paymentSlipUrl: 'slip.jpg' } };
  const agent = render(submitted, { onIssueReceipt() {}, onReturnSlip });
  assert.match(agent, /<slip-return busy="false"><\/slip-return>/);
  assert.equal(returnControls[0].onReturn, onReturnSlip);
  for (const [label, patch, props] of [
    ['tenant', submitted, { onUpload() {} }],
    ['unpaid', {}, { onReturnSlip }],
    ['paid', { ...submitted, receiptUrl: 'receipt.pdf' }, { onReturnSlip }],
    ...['cancelled', 'expired', 'terminated'].map((status) => [status, { ...submitted, status }, { onReturnSlip }]),
  ]) assert.doesNotMatch(render(patch, props), /slip-return/, label);
  const returned = { reservationPayment: { ...base.reservationPayment, status: 'unpaid', slipReturnReason: 'ยอดไม่ตรง' } };
  const tenant = render(returned, { onUpload() {} });
  assert.match(tenant, /นายหน้าตีกลับสลิป: ยอดไม่ตรง กรุณาส่งสลิปใหม่/);
  assert.match(tenant, /อัปโหลดสลิปชำระค่าจอง/);
  assert.doesNotMatch(render({ ...returned, receiptUrl: 'receipt.pdf' }), /ตีกลับสลิป/, 'not once a receipt is issued');
  assert.doesNotMatch(render({ ...returned, status: 'cancelled' }, { onUpload() {} }), /ตีกลับสลิป/, 'not for a closed reservation (no new slip can be sent)');
});

test('D11: the return control belongs to one slip: a newer slip gets a new control (the earlier reason is not kept)', () => {
  const nodes = (node) => (!node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]);
  const control = (submittedAt) => nodes(ReservationPaymentCard({ contract: { ...base, reservationPayment: { ...base.reservationPayment, status: 'submitted', paymentSlipUrl: 's.jpg', submittedAt } },
    busy: false, onOpen() {}, onReturnSlip() {} })).find((n) => n.props?.onReturn);
  assert.equal(control('2026-10-22T03:00:00.000Z').key, '2026-10-22T03:00:00.000Z');
  assert.notEqual(control('2026-10-22T05:00:00.000Z').key, control('2026-10-22T03:00:00.000Z').key);
});
