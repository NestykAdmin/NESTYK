const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
  const module = { exports: {} };
  new Function('module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText)(module, module.exports);
  return module.exports;
}
const api = load(path.join(__dirname, '../src/agent/contracts/lease-term.ts'));
const ui = load(path.join(__dirname, '../../consumer-app/lib/lease-term.ts'));

test('API and UI agree on inclusive terms, short months, leap years and year boundaries', () => {
  for (const [start, months, end] of [
    ['2026-12-25',12,'2027-12-24'], ['2026-11-01',12,'2027-10-31'],
    ['2026-01-31',1,'2026-02-28'], ['2024-01-31',1,'2024-02-29'],
    ['2024-02-29',12,'2025-02-28'], ['2026-01-30',1,'2026-02-28'],
    ['2026-01-31',2,'2026-03-30'], ['2023-03-01',12,'2024-02-29'],
    ['2026-08-31',1,'2026-09-30'], ['2026-12-31',1,'2027-01-30'],
  ]) for (const impl of [api,ui]) assert.equal(impl.leaseTermEnd(start,months),end,`${start} + ${months}`);
});
test('real-date validation rejects normalization, invalid months and non-ISO input', () => {
  for (const impl of [api,ui]) {
    for (const value of ['2026-02-30','2025-02-29','2026-04-31','2026-13-01','2026-00-01','2026-01-00','1899-12-31','01/10/2026','2026-01-01T00:00:00Z',null]) assert.equal(impl.isIsoDate(value),false,String(value));
    for (const value of ['2024-02-29','2026-02-28','2026-12-31']) assert.equal(impl.isIsoDate(value),true,value);
    assert.equal(impl.shiftIsoDate('2024-02-28',1),'2024-02-29');
    assert.equal(impl.shiftIsoDate('2026-12-31',1),'2027-01-01');
    assert.equal(impl.shiftIsoDate('2026-10-31',-30),'2026-10-01');
  }
});
