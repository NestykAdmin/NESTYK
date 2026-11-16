// QA Aof, 16 Nov 2026 (Q2): the tenant could not attach a late fee slip once the rent bill was paid or its slip sent,
// because the sheet's buttons only looked at the rent bill.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const loaded = { exports: {} };
const source = fs.readFileSync(path.join(__dirname, 'tenant-bill-slip.ts'), 'utf8');
new Function('require', 'module', 'exports', ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(require, loaded, loaded.exports);
const { canAttachSlip } = loaded.exports;

const fee = (patch = {}) => ({ invoiceId: 9, documentNo: 'LF1', amount: 300, dueDate: '2026-12-20', status: 'pending',
  slipReturnReason: null, hasPaymentSlip: false, slipSubmitted: false, slipSubmittedAt: null, receiptIssued: false, ...patch });
const bill = (patch = {}) => ({ status: 'pending', slipSubmitted: false, lateFee: null, ...patch });

test('Q2: a late fee slip can be attached whatever the rent bill state, until the late fee receipt is issued', () => {
  for (const [label, rent] of [['rent paid', { status: 'paid' }], ['rent slip sent', { slipSubmitted: true }],
    ['rent overdue', { status: 'overdue' }], ['rent pending', {}]]) {
    assert.equal(canAttachSlip(bill({ ...rent, lateFee: fee() }), true), true, label);
    assert.equal(canAttachSlip(bill({ ...rent, lateFee: fee({ hasPaymentSlip: true, slipSubmitted: true }) }), true), true, `${label}: replace`);
    assert.equal(canAttachSlip(bill({ ...rent, lateFee: fee({ receiptIssued: true }) }), true), false, `${label}: receipt issued`);
  }
  assert.equal(canAttachSlip(bill({ status: 'paid' }), true), false, 'no late fee issued');
});

test('Q2: a rent slip keeps its rule: only while the bill is unpaid and its slip not sent', () => {
  assert.equal(canAttachSlip(bill(), false), true);
  assert.equal(canAttachSlip(bill({ status: 'overdue' }), false), true);
  assert.equal(canAttachSlip(bill({ status: 'paid' }), false), false);
  assert.equal(canAttachSlip(bill({ slipSubmitted: true }), false), false);
  assert.equal(canAttachSlip(bill({ status: 'paid', lateFee: fee() }), false), false, 'a late fee does not reopen the rent slip');
});

test('Q6: a sent slip reads "under review" even past the grace day, as the agent sees "Slip to review"', () => {
  const { tenantBillBadge } = loaded.exports;
  assert.equal(tenantBillBadge({ status: 'overdue', slipSubmitted: true }), 'reviewing');
  assert.equal(tenantBillBadge({ status: 'pending', slipSubmitted: true }), 'reviewing');
  assert.equal(tenantBillBadge({ status: 'paid', slipSubmitted: true }), 'paid');
  assert.equal(tenantBillBadge({ status: 'paid', slipSubmitted: false }), 'paid');
  // A returned slip clears slipSubmitted (the API sets slip_submitted_at to null), so the bill is overdue again.
  assert.equal(tenantBillBadge({ status: 'overdue', slipSubmitted: false }), 'overdue');
  assert.equal(tenantBillBadge({ status: 'pending', slipSubmitted: false }), 'pending');
});
