// M5 (Aof 29 Oct 2026): who can do what with the slip of the amount still to collect after an early end.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const module_ = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, 'early-end-slip.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(require, module_, module_.exports);
const { earlyEndMoneyOf, earlyEndSlipState } = module_.exports;

test('the slip goes from none to awaiting the agent, then paid, or back to the tenant with a reason', () => {
  const money = (patch) => ({ endsOn: { date: '2027-01-15', money: { kind: 'collect', invoicePath: 'ee.pdf', ...patch } } });
  assert.equal(earlyEndSlipState(earlyEndMoneyOf({})), 'none');
  assert.equal(earlyEndSlipState(earlyEndMoneyOf({ endsOn: { money: { kind: 'refund' } } })), 'none', 'a refund has no slip');
  assert.equal(earlyEndSlipState(earlyEndMoneyOf(money({}))), 'no_slip');
  assert.equal(earlyEndSlipState(earlyEndMoneyOf(money({ slipPath: 's.jpg', slipSubmittedAt: '2027-01-16T03:00:00.000Z' }))), 'awaiting');
  assert.equal(earlyEndSlipState(earlyEndMoneyOf(money({ slipPath: null, returnNote: 'ยอดไม่ครบ' }))), 'returned');
  assert.equal(earlyEndSlipState(earlyEndMoneyOf(money({ slipPath: 's.jpg', paidAt: '2027-01-17T03:00:00.000Z' }))), 'paid');
  assert.equal(earlyEndMoneyOf(null), null);
});
