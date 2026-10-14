const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { i18nMock, contractsTh, leadFormat } = require('./test-i18n.cjs');
function load(file, deps = {}) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText)(id => deps[id] ?? require(id), module, module.exports);
  return module.exports;
}
const lib = load('../lib/agent-contract-library.ts');
const dependencies = {
  react: { ...React, useMemo: fn => fn() },
  'react-native': { View: 'view', Text: 'text', Pressable: 'button', StyleSheet: { create: s => s } },
  '@nestyk/ui/native': { tokens: { typography: { native: {} } }, MobileIcon: 'icon', MobileInput: 'input', MobileButton: 'button', useMobileTheme: () => ({ theme: {} }) },
  '@nestyk/i18n': i18nMock({ agent: { contracts: { commissionConfirmation: { menu: 'ค่าคอมมิชชัน' } } } }),
  '../lib/lead-format': leadFormat, '../lib/agent-contract-library': lib,
};
const { AgentContractLibrary } = load('AgentContractLibrary.tsx', dependencies);
const { ContractTypePicker } = load('ContractTypePicker.tsx', dependencies);
const booking = { id: 7, contractNo: 'RS007', formKind: 'reservation', status: 'cancelled', startDate: '2026-10-01', property: 'Condo', room: '101', tenant: 'พิมพ์', reservationFee: 1000,
  invoiceUrl: 'booking-invoice.pdf', receiptUrl: 'booking-receipt.pdf', reservationPayment: { invoiceDocumentNo: 'BI007', receiptDocumentNo: 'BR007', total: 1000, status: 'paid' } };
const lease = { ...booking, id: 8, contractNo: 'LS008', formKind: 'lease', status: 'active', monthlyRent: 15000 };
const invoice = { id: 7, documentNo: 'INV007', customerName: 'พิมพ์', issueDate: '2026-10-02', total: 2000, invoiceUrl: 'invoice.pdf', receiptDocumentNo: 'REC007', receiptUrl: 'receipt.pdf' };
const commission = { id: 7, documentNo: 'COM007', issueDate: '2026-10-03', landlordName: 'Owner', tenantName: 'พิมพ์', pdfUrl: 'commission.pdf' };
const base = { contracts: [booking, lease], invoices: [invoice], commissions: [commission], busy: false, loading: false, onCreate() {} };
const entries = () => lib.contractLibraryEntries(base.contracts, base.invoices, base.commissions);
function nodes(node) { return !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]; }
function render(view, overrides = {}) {
  let next, opened;
  const tree = AgentContractLibrary({ ...base, view, onViewChange: v => { next = v; }, onOpen: v => { opened = v; }, ...overrides });
  return { tree, nodes: nodes(tree), get next() { return next; }, get opened() { return opened; } };
}
test('folders include all source types and preserve financial history after booking closure', () => {
  const all = entries();
  assert.equal(new Set(all.map(e => e.key)).size, 7);
  assert.deepEqual(['rental', 'finance', 'brokerage'].map(folder => all.filter(e => e.folder === folder).length), [2, 4, 1]);
  assert.equal(all.find(e => e.kind === 'contract' && e.value === booking).state, 'closed');
  assert.equal(all.find(e => e.kind === 'booking_receipt').state, 'active');
  assert.equal(all.find(e => e.kind === 'booking_receipt').value, booking);
  assert.equal(all.find(e => e.kind === 'receipt').value, invoice);
  assert.equal(lib.contractLibraryEntries([{ ...booking, receiptUrl: null }], [{ ...invoice, receiptUrl: null }], []).filter(e => e.type === 'receipt').length, 0);
});
test('filters combine folder, type, status, document reference and Thai customer search', () => {
  const view = { ...lib.emptyLibraryView(), folder: 'finance', type: 'receipt', status: 'active', query: '  พิมพ์ ' };
  assert.deepEqual(lib.filterContractLibrary(entries(), view).map(e => e.kind), ['receipt', 'booking_receipt']);
  assert.deepEqual(lib.filterContractLibrary(entries(), { ...view, query: 'bi007' }).map(e => e.kind), ['booking_receipt']);
  assert.equal(lib.filterContractLibrary(entries(), { ...view, status: 'closed' }).length, 0);
  assert.equal(lib.filterContractLibrary([], view).length, 0);
});
test('folder navigation resets stale filters; receipt cards open the original source despite overlapping IDs', () => {
  const home = render({ ...lib.emptyLibraryView(), query: 'stale', type: 'lease' });
  home.nodes.find(n => n.props?.accessibilityLabel?.startsWith(contractsTh.screen.library.finance)).props.onPress();
  assert.deepEqual(home.next, { folder: 'finance', type: 'all', status: 'all', query: '' });
  const finance = render({ ...home.next, type: 'receipt' });
  const buttons = finance.nodes.filter(n => ['ใบเสร็จรับเงิน BR007', 'ใบเสร็จรับเงิน REC007'].includes(n.props?.accessibilityLabel));
  assert.equal(buttons.length, 2);
  buttons.find(n => n.props.accessibilityLabel.endsWith('BR007')).props.onPress();
  assert.equal(finance.opened.kind, 'booking_receipt'); assert.equal(finance.opened.value, booking);
  buttons.find(n => n.props.accessibilityLabel.endsWith('REC007')).props.onPress();
  assert.equal(finance.opened.kind, 'receipt'); assert.equal(finance.opened.value, invoice);
  finance.nodes.find(n => n.type === 'input').props.onChangeText('REC007');
  assert.equal(finance.next.query, 'REC007'); assert.equal(finance.next.type, 'receipt');
});
test('missing commission PDF is visible as pending and cannot open; busy disables document actions', () => {
  const view = { ...lib.emptyLibraryView(), folder: 'brokerage' };
  const missing = render(view, { commissions: [{ ...commission, pdfUrl: null }] });
  assert.equal(missing.nodes.find(n => n.props?.accessibilityLabel?.endsWith('COM007')).props.disabled, true);
  const busy = render({ ...view, folder: 'rental' }, { busy: true });
  assert.equal(busy.nodes.find(n => n.props?.accessibilityLabel?.endsWith('LS008')).props.disabled, true);
});
test('grouped create menu dispatches all six existing document kinds and keeps renewal disabled', () => {
  let selected;
  const tree = ContractTypePicker({ onSelect: kind => { selected = kind; }, onBack() {}, disabledKinds: ['renewal'] });
  const buttons = nodes(tree).filter(n => n.props?.accessibilityLabel);
  assert.equal(buttons.length, 6);
  for (const n of buttons.filter(n => !n.props.disabled)) { n.props.onPress(); assert.ok(['reservation', 'lease', 'invoice', 'broker_appointment', 'agent_commission'].includes(selected)); }
  const renewal = buttons.find(n => n.props.disabled);
  assert.match(renewal.props.accessibilityLabel, /ต่อสัญญา/);
});
