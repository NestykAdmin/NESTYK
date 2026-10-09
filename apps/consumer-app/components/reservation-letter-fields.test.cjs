const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { i18nMock, contractsTh, fillTemplate, leadFormat } = require('./test-i18n.cjs');
const loaded = { exports: {} };
const source = fs.readFileSync(path.join(__dirname, 'ReservationLetterFields.tsx'), 'utf8');
const mockRequire = name => {
  if (name === 'react') return React;
  if (name === 'react-native') return { View: 'section', Text: 'span', Pressable: ({ children, accessibilityRole, accessibilityState }) => React.createElement('div', { role: accessibilityRole, 'aria-checked': accessibilityState?.checked }, children) };
  if (name === '@nestyk/ui/native') return {
    useMobileTheme: () => ({ theme: {} }),
    tokens: { typography: { native: {} }, colors: { brand: { 50: '#fff9e8', 500: '#f8b615' } } },
    MobileInput: ({ label, value, editable, required, error }) => React.createElement('input', { 'aria-label': label, value, onChange() {}, readOnly: !editable, required, 'data-error': error }),
  };
  if (name === '../lib/agent-contracts-api') return { searchOwnerUsers: async () => [] };
  if (name === '@nestyk/i18n') return i18nMock();
  if (name === '../lib/lead-format') return leadFormat;
  throw new Error(`Unexpected dependency: ${name}`);
};
new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText)(mockRequire, loaded, loaded.exports);
const { ReservationLetterFields, emptyReservationLetterForm, reservationLetterFieldErrors } = loaded.exports;
const render = (value, step) => renderToStaticMarkup(React.createElement(ReservationLetterFields, { value, step, onChange() {} }));

test('all original editable and locked text fields remain available across the four steps', () => {
  const value = emptyReservationLetterForm();
  for (const key of Object.keys(value)) if (typeof value[key] === 'string') value[key] = `field_${key}_value`;
  const markup = [0, 1, 2, 3].map(step => render(value, step)).join('');
  // Full names are derived from first/last name; issue date and number are system metadata; amount wording is generated.
  const derived = new Set(['tenantName', 'landlordName', 'documentNo', 'issueDate', 'reservationWords']);
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' && !derived.has(key) && key !== 'paymentMethod') assert.ok(markup.includes(`value="${entry}"`), `Missing input: ${key}`);
  }
});

test('tenant fields stay read-only while landlord fields stay editable', () => {
  const value = { ...emptyReservationLetterForm(), tenantFirstName: 'TENANT', landlordFirstName: 'OWNER' };
  const markup = render(value, 0);
  assert.match(markup, /<input[^>]*readOnly=""[^>]*value="TENANT"/);
  assert.doesNotMatch(markup, /<input[^>]*readOnly=""[^>]*value="OWNER"/);
});

test('signatory fields appear only on the review step', () => {
  const value = emptyReservationLetterForm();
  assert.ok(!render(value, 2).includes('aria-label="ชื่อใต้ลายเซ็น'));
  const markup = render(value, 3);
  for (const party of ['ผู้จอง', 'ผู้ให้เช่า', 'เอเจนท์']) assert.ok(markup.includes(`aria-label="ชื่อใต้ลายเซ็น${party}"`));
});

test('payment allocation supports both independent choices and every existing payment method', () => {
  const value = { ...emptyReservationLetterForm(), applyToAdvance: true, applyToDeposit: true, paymentMethod: 'credit' };
  const markup = render(value, 2);
  assert.equal((markup.match(/role="checkbox" aria-checked="true"/g) || []).length, 2);
  assert.equal((markup.match(/role="radio"/g) || []).length, 3);
  assert.match(markup, /role="radio" aria-checked="true"[^>]*><span[^>]*>บัตรเครดิต/);
  assert.match(markup, /ใส่วันจอง/);
  assert.match(markup, /ใส่วันทำสัญญา/);
  assert.match(markup, /ตัวอักษร/);
});

test('required-field rules do not expand with the redesign', () => {
  const value = { ...emptyReservationLetterForm(), tenantFirstName: 'Tenant', tenantPhone: '0800000000', tenantEmail: 'tenant@example.com', landlordFirstName: 'Owner', landlordPhone: '0800000001', landlordEmail: 'owner@example.com', project: 'Nest', reservationPayment: '5000' };
  assert.deepEqual(reservationLetterFieldErrors(value, contractsTh.validation), {});
  const invalid = reservationLetterFieldErrors({ ...value, tenantEmail: 'invalid', project: '', termFrom: '15/10/2026' }, contractsTh.validation);
  assert.deepEqual(Object.keys(invalid).sort(), ['project', 'tenantEmail', 'termFrom']);
});
