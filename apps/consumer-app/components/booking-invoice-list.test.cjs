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
  if (name === 'react-native') return {
    View: 'section', Text: 'span',
    Pressable: ({ children, disabled, accessibilityLabel }) => React.createElement('button', { disabled, 'aria-label': accessibilityLabel }, children),
  };
  if (name === '@nestyk/ui/native') return {
    useMobileTheme: () => ({ theme: {} }), tokens: { typography: { native: {} } },
  };
  if (name === '@nestyk/i18n') return i18nMock();
  if (name === '../lib/lead-format') return leadFormat;
  throw new Error(`Unexpected dependency: ${name}`);
};
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, 'BookingInvoiceListCard.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText)(mockRequire, loaded, loaded.exports);
const { BookingInvoiceListCard, bookingInvoicesForTenant } = loaded.exports;
const booking = { id: 15, tenantId: 2, contractNo: 'RS202600004', formKind: 'reservation', tenant: 'Tenant', property: 'Condo', room: '101', status: 'draft', invoiceUrl: 'invoice.pdf', reservationPayment: { invoiceDocumentNo: 'INV-RS202600004', total: 25000, status: 'unpaid' } };
const render = patch => renderToStaticMarkup(React.createElement(BookingInvoiceListCard, { contract: { ...booking, ...patch }, busy: false, onOpen() {} }));

test('booking invoices appear for their tenant without including letters that have no linked invoice', () => {
  const rows = [booking, { ...booking, id: 16, tenantId: 3 }, { ...booking, id: 17, invoiceUrl: null }, { ...booking, id: 18, reservationPayment: null }, { ...booking, id: 19, formKind: 'lease' }];
  assert.deepEqual(bookingInvoicesForTenant(rows, 2).map(row => row.id), [15]);
  assert.deepEqual(bookingInvoicesForTenant(rows).map(row => row.id), [15, 16]);
});

test('list card shows invoice number, linked booking, room, amount and correct payment status', () => {
  const markup = render({});
  assert.match(markup, /ดูใบแจ้งหนี้ค่าจอง INV-RS202600004/);
  assert.match(markup, /ผูกกับหนังสือจอง RS202600004/);
  assert.match(markup, /ห้อง 101/);
  assert.match(markup, /25,000.00/);
  assert.match(markup, /รอชำระเงิน/);
  assert.match(render({ reservationPayment: { ...booking.reservationPayment, status: 'submitted' } }), /ส่งสลิปแล้ว · รอตรวจสอบ/);
  assert.match(render({ reservationPayment: { ...booking.reservationPayment, status: 'paid' } }), /ชำระแล้ว/);
  assert.match(render({ status: 'cancelled' }), /หนังสือจองปิดแล้ว/);
});
