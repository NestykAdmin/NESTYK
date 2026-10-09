const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { i18nMock, contractsTh, fillTemplate, leadFormat } = require('./test-i18n.cjs');
const loaded = { exports: {} };
const source = fs.readFileSync(path.join(__dirname, 'LeaseAgreementFields.tsx'), 'utf8');
const Input = ({ label, value, editable, required }) => React.createElement('input', { 'aria-label': label, value, onChange() {}, readOnly: !editable, required });
const mockRequire = name => {
  if (name === 'react') return React;
  if (name === 'react-native') return { View: 'section', Text: 'span', Pressable: 'button' };
  if (name === '@nestyk/ui/native') return { MobileInput: Input, useMobileTheme: () => ({ theme: {} }), tokens: { typography: { native: {} }, colors: { brand: { 50: '#fff9e8' } } } };
  if (name === '@nestyk/i18n') return i18nMock();
  if (name === '../lib/lead-format') return leadFormat;
  throw new Error(`Unexpected dependency: ${name}`);
};
new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText)(mockRequire, loaded, loaded.exports);
const { LeaseAgreementFields, emptyLeaseAgreementForm, completeLeaseNames, leaseAgreementFieldErrors, leaseAgreementFieldStep } = loaded.exports;
function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
function form(value, step, overrides = {}) {
  return LeaseAgreementFields({ value, step, onChange() {}, ...overrides });
}

test('every existing lease input remains editable exactly once across the four steps', () => {
  const value = emptyLeaseAgreementForm();
  Object.keys(value).forEach(key => value[key] = `value_${key}`);
  const inputs = [0, 1, 2, 3].flatMap(step => nodes(form(value, step))).filter(node => node.type === Input);
  const derived = new Set(['documentNo', 'landlordName', 'tenantName', 'landlordSignName', 'tenantSignName', 'witnessSignName', 'landlordSignaturePng', 'tenantSignaturePng']);
  for (const key of Object.keys(value)) {
    if (derived.has(key)) continue;
    const matches = inputs.filter(node => node.props.value === value[key]);
    assert.equal(matches.length, 1, key);
    assert.equal(matches[0].props.editable, true, key);
  }
  assert.equal(inputs.length, 42);
});

test('name edits retain the existing full name and signatory synchronization without changing other data', () => {
  const value = { ...emptyLeaseAgreementForm(), tenantFirstName: 'Old', tenantLastName: 'Tenant', landlordFirstName: 'Old', landlordLastName: 'Owner', tenantSignaturePng: 'existing-signature', additionalTerms: 'existing-terms' };
  for (const [label, party] of [['ชื่อผู้เช่า', 'tenant'], ['ชื่อผู้ให้เช่า', 'landlord']]) {
    let next;
    const input = nodes(form(value, 0, { onChange: result => next = result })).find(node => node.type === Input && node.props.label === label);
    input.props.onChangeText('New');
    assert.equal(next[`${party}Name`], `New ${value[`${party}LastName`]}`);
    assert.equal(next[`${party}SignName`], next[`${party}Name`]);
    assert.equal(next.tenantSignaturePng, value.tenantSignaturePng);
    assert.equal(next.additionalTerms, value.additionalTerms);
  }
});

test('witness behavior preserves an existing signatory and initializes only an empty name', () => {
  for (const saved of ['', 'Saved witness']) {
    let next;
    const value = { ...emptyLeaseAgreementForm(), witnessSignName: saved };
    const input = nodes(form(value, 3, { onChange: result => next = result })).find(node => node.type === Input && node.props.label.includes('พยาน'));
    input.props.onChangeText('Agent contact');
    assert.equal(next.witnessSignName, saved || 'Agent contact');
  }
});

test('required fields and date validation remain unchanged and errors point to the right step', () => {
  const value = emptyLeaseAgreementForm();
  const errors = leaseAgreementFieldErrors(value, contractsTh.validation);
  assert.deepEqual(Object.keys(errors).sort(), ['issueDate', 'landlordFirstName', 'tenantFirstName', 'project', 'termFrom', 'termTo', 'monthlyRent', 'depositAmount'].sort());
  assert.equal(leaseAgreementFieldStep('issueDate'), 0);
  assert.equal(leaseAgreementFieldStep('tenantFirstName'), 0);
  assert.equal(leaseAgreementFieldStep('project'), 1);
  assert.equal(leaseAgreementFieldStep('termTo'), 1);
  assert.equal(leaseAgreementFieldStep('depositAmount'), 2);
  assert.equal(leaseAgreementFieldStep('additionalTerms'), 3);
  assert.ok(leaseAgreementFieldErrors({ ...value, termFrom: '2026-10-15', termTo: '2026-10-14' }, contractsTh.validation).termTo);
});

test('review displays current values and edit links navigate to their original sections', () => {
  const value = { ...emptyLeaseAgreementForm(), houseNo: '1509', monthlyRent: '16500', depositAmount: '33000' };
  const destinations = [];
  const tree = form(value, 3, { onStepChange: step => destinations.push(step) });
  for (const node of nodes(tree).filter(node => node.type === 'button')) node.props.onPress();
  assert.deepEqual(destinations, [0, 1, 2]);
  const rows = nodes(tree).filter(node => node.type === 'span').flatMap(node => React.Children.toArray(node.props.children));
  assert.ok(rows.includes('1509'));
  assert.ok(rows.includes('16,500 บาท'));
  assert.ok(rows.includes('33,000 บาท'));
});

test('busy state disables every input and legacy name hydration still works', () => {
  const value = completeLeaseNames({ tenantName: 'First Last', landlordName: 'Owner Family' });
  assert.equal(value.tenantFirstName, 'First');
  assert.equal(value.landlordLastName, 'Family');
  for (const step of [0, 1, 2, 3]) {
    const inputs = nodes(form(value, step, { disabled: true })).filter(node => node.type === Input);
    assert.ok(inputs.every(node => node.props.editable === false));
  }
});
