const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { i18nMock, contractsTh, fillTemplate, leadFormat } = require('./test-i18n.cjs');
const loaded = { exports: {} };
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
  throw new Error(`Unexpected dependency: ${name}`);
};
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, 'ReservationPaymentCard.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText)(mockRequire, loaded, loaded.exports);
const { ReservationPaymentCard } = loaded.exports;
const base = { contractNo: 'RS202600011', status: 'draft', reservationFee: 5000, invoiceUrl: 'invoice.pdf', receiptUrl: null, reservationPayment: { invoiceDocumentNo: 'INV-RS202600011', total: 5000, status: 'unpaid', paymentSlipUrl: null } };
const render = (patch = {}, props = {}) => renderToStaticMarkup(React.createElement(ReservationPaymentCard, { contract: { ...base, ...patch }, busy: false, onOpen() {}, ...props }));

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
