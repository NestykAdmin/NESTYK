const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { i18nMock, contractsTh } = require('./test-i18n.cjs');
function load(file, requireFn) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText)(requireFn, module, module.exports);
  return module.exports;
}
const term = load(path.join(__dirname,'../lib/lease-term.ts'), require);
const Input = () => null;
const fields = load(path.join(__dirname,'LeaseRenewalFields.tsx'), id => {
  if (id === 'react') return React;
  if (id === 'react-native') return { Text: 'span', View: 'div' };
  if (id === '@nestyk/ui/native') return { MobileInput: Input, useMobileTheme: () => ({ theme: {} }) };
  if (id === '@nestyk/i18n') return i18nMock();
  if (id === '../lib/lease-term') return term;
  throw new Error(`Unexpected dependency: ${id}`);
});
function nodes(node) { return !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node,...nodes(node.props?.children)]; }
test('predecessor references and calculated dates are locked, while renewal terms stay editable', () => {
  const value = fields.emptyLeaseRenewalForm();
  Object.keys(value).forEach(key => value[key] = `value_${key}`);
  const tree = fields.LeaseRenewalFields({ value, errors: {}, onChange() {} });
  const inputs = nodes(tree).filter(node => node.type === Input);
  for (const key of ['firstLeaseNo','firstLeaseDate','firstLeaseStart','firstLeaseEnd','originalLeaseNo','originalLeaseDate','originalExpiryDate','startDate','endDate']) assert.equal(inputs.find(node=>node.props.value===value[key]).props.editable,false,key);
  for (const key of ['issueDate','renewMonths','monthlyRent','depositCarried']) assert.equal(inputs.find(node=>node.props.value===value[key]).props.editable,true,key);
});
test('renewal form rejects impossible issue dates and calculates month-end from predecessor expiry', () => {
  const value = { ...fields.emptyLeaseRenewalForm(), issueDate: '2026-02-30', originalExpiryDate: '2026-01-30', startDate: '2026-01-31', renewMonths: '12' };
  assert.equal(fields.leaseRenewalFieldErrors(value, contractsTh.validation).issueDate, contractsTh.validation.dateFormat);
  let next;
  const tree = fields.LeaseRenewalFields({ value, errors: {}, onChange(v) { next = v; } });
  nodes(tree).find(node=>node.type===Input && node.props.value==='12').props.onChangeText('1');
  assert.equal(next.startDate,'2026-01-31');
  assert.equal(next.endDate,'2026-02-28');
});
