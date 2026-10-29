const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, experimentalDecorators: true },
  fileName: filename,
}).outputText, filename);
const { settlementAllocation, deductionTotalOf, parseDeduction, parseRefundAmount, moneyText, assertDeductionsEvidenced, assertRefundOnce } = require('../src/agent/contracts/deposit-settlement.ts');
const { moveOutBlockedReason } = require('../src/agent/contracts/handover.service.ts');
const { dueReminders } = require('../src/agent/reminders/contract-reminders.ts');

const gate = (patch = {}) => moveOutBlockedReason({
  formKind: 'lease', status: 'active', endDate: '2027-10-31', notRenewing: false, endsOn: false, hasSuccessor: false, today: '2026-10-28',
  ...patch,
});

test('move-out opens when the stay is ending and stays closed while a renewal is linked', () => {
  assert.equal(gate(), 'not_leaving');
  assert.equal(gate({ today: '2027-10-31' }), null, 'the end date itself is open');
  assert.equal(gate({ notRenewing: true }), null);
  assert.equal(gate({ endsOn: true }), null);
  assert.equal(gate({ formKind: 'renewal', notRenewing: true }), null);
  assert.equal(gate({ notRenewing: true, hasSuccessor: true }), 'has_successor');
  assert.equal(gate({ status: 'cancelled', notRenewing: true }), 'contract_ended');
  assert.equal(gate({ formKind: 'reservation' }), 'not_lease');
  assert.equal(gate({ status: 'expired', today: '2027-11-01' }), null, 'a stored ended lease can still be filled in');
});

test('the typed refund must equal the deposit minus the deductions, and a line needs a type and a note', () => {
  assert.equal(deductionTotalOf(['5000.00', '1500.50']), '6500.50');
  assert.deepEqual(settlementAllocation('40000.00', '5000.00', '35000'), {
    available: '40000.00', deductionTotal: '5000.00', carried: '0.00', refund: '35000.00',
  });
  assert.deepEqual(settlementAllocation('40000.00', '40000.00', '0'), {
    available: '40000.00', deductionTotal: '40000.00', carried: '0.00', refund: '0.00',
  });
  assert.throws(() => settlementAllocation('40000.00', '5000.00', '40000'), (error) => error.getStatus() === 400);
  assert.throws(() => settlementAllocation('40000.00', '5000.00', '30000'), (error) => error.getStatus() === 400);
  assert.throws(() => settlementAllocation('40000.00', '50000.00', '0'), (error) => error.getStatus() === 400);
  assert.deepEqual(parseDeduction({ type: 'damage', description: ' โต๊ะเสีย ', amount: '5,000' }), {
    deduction_type: 'damage', description: 'โต๊ะเสีย', amount: '5000.00',
  });
  assert.throws(() => parseDeduction({ type: 'damage', description: ' ', amount: '5000' }), (error) => error.getStatus() === 400);
  assert.throws(() => parseDeduction({ type: 'paint', description: 'โต๊ะ', amount: '1' }), (error) => error.getStatus() === 400);
  assert.equal(parseRefundAmount({ refundAmount: 0 }), '0.00');
  assert.equal(moneyText('0'), null);
  assert.throws(() => assertDeductionsEvidenced([{ evidence_reference: '  ' }]), (error) => error.getStatus() === 400);
  assert.doesNotThrow(() => assertDeductionsEvidenced([{ evidence_reference: 'agent/1.jpg' }]));
  assert.throws(() => assertRefundOnce('completed', false), (error) => error.getStatus() === 409);
  assert.throws(() => assertRefundOnce('approved', true), (error) => error.getStatus() === 409);
  assert.doesNotThrow(() => assertRefundOnce('approved', false));
});

test('TC-7.10 and TC-8.07: unused rent is reminded the day after day 7, and the deposit the day after day 30', () => {
  const lease = {
    id: 11, status: 'active', formKind: 'lease', createdAt: null, contractNo: 'LS', tenantId: 2, tenantName: 'T',
    property: 'A', room: '1', startDate: '2026-11-01', endDate: '2027-10-31', effectiveEndDate: null, previousAgreementId: null,
    agentId: 7, landlordUserId: 9, noticeDays: 30,
    data: { endsOn: { date: '2027-01-15', money: { kind: 'refund', amount: 10323, dueOn: '2027-01-22', proofPath: null } } },
  };
  const kinds = (today, extra = {}) => dueReminders(today, [{ ...lease, ...extra }], []).map((row) => row.kind);
  assert.deepEqual(kinds('2027-01-22'), []);
  assert.deepEqual(kinds('2027-01-23'), ['early_end_refund_late']);
  assert.deepEqual(kinds('2027-01-23', { data: { endsOn: { date: '2027-01-15', money: { kind: 'refund', amount: 1, dueOn: '2027-01-22', proofPath: 'proof' } } } }), []);
  const deposit = { contractId: 11, status: 'approved', refundAmount: 35000, refunded: false };
  const ended = { ...lease, data: {}, endDate: '2027-10-31' };
  const depositKinds = (today, rows = [deposit], contracts = [ended]) => dueReminders(today, contracts, [], [], rows).map((row) => [row.kind, row.dueDate, row.amount]);
  assert.deepEqual(depositKinds('2027-11-30'), []);
  assert.deepEqual(depositKinds('2027-12-01'), [['deposit_refund_late', '2027-11-30', 35000]]);
  assert.deepEqual(depositKinds('2027-12-01', [{ ...deposit, refunded: true }]), []);
  assert.deepEqual(depositKinds('2027-12-01', [deposit], [ended, { ...ended, id: 12, previousAgreementId: 11, status: 'awaiting_signatures' }]), []);
});
