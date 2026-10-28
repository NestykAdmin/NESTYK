const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const Box = ({ children }) => React.createElement('section', {}, children);
const Text = ({ children }) => React.createElement('span', {}, children);
const detail = new Proxy({ billsNoLease: 'No active lease' }, { get: (row, key) => row[key] ?? `${key} {month} {date} {count} {months}` });
function load(file) {
  const loaded = { exports: {} };
  const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
  new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText)(mockRequire, loaded, loaded.exports);
  return loaded.exports;
}
function mockRequire(name) {
  if (name === 'react') return React;
  if (name === 'react-native') return { View: Box, Text, StyleSheet: { create: value => value } };
  if (name === '@nestyk/i18n') return { useLocale: () => ({ locale: 'en', t: { agent: { tenants: { detail } } } }) };
  if (name === '@nestyk/ui/native') return { useMobileTheme: () => ({ theme: {} }), tokens: { colors: { danger: 'red', brand: { 700: 'orange' } } }, MobileButton: Box, MobileIcon: () => null, MobileFilterChip: () => null, MobileBottomSheet: Box, MobileInput: () => null, MobileStatusPill: ({ label }) => React.createElement(Text, {}, label) };
  if (name === './TenantDetailParts') return { DetailCard: Box, DemoNotice: ({ text }) => React.createElement(Text, {}, text), ps: {} };
  if (name.startsWith('../lib/')) return load(name + '.ts');
  throw new Error(name);
}
const { TenantBillsBody } = load('./TenantBillsBody.tsx');
const billing = { bills: [
  { id: 1, period: '2026-08', documentNo: 'REAL-UNPAID-1', issueDate: '2026-08-10', dueDate: '2026-08-15', amount: 14500, status: 'overdue', slipSubmittedAt: null, paidAt: null },
  { id: 2, period: '2026-09', documentNo: 'REAL-PAID-2', issueDate: '2026-09-10', dueDate: '2026-09-15', amount: 15000, status: 'paid', slipSubmittedAt: null, paidAt: '2026-09-20T06:00:00Z' },
], upcoming: null, payments: [], advancePeriods: [] };

test('Agent still sees persisted unpaid and paid bills after the lease ends', () => {
  const html = renderToStaticMarkup(React.createElement(TenantBillsBody, { billing, leaseActive: false, demo: false, onReview() {} }));
  assert.match(html, /REAL-UNPAID-1/); assert.match(html, /REAL-PAID-2/);
  assert.match(html, /14,500/); assert.match(html, /20 Sept 2026/);
  assert.doesNotMatch(html, /No active lease|demoNotice/);
});

test('empty billing without an active lease keeps the existing empty state', () => {
  const html = renderToStaticMarkup(React.createElement(TenantBillsBody, { billing: { ...billing, bills: [] }, leaseActive: false, demo: false, onReview() {} }));
  assert.match(html, /No active lease/);
});
