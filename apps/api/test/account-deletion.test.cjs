const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/auth/account-deletion.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', source)(() => { throw new Error('import'); }, mod, mod.exports);
const { deletionBlockers, contractBlocksDeletion, anonymizedAccountEmail, deletionEffectiveAt } = mod.exports;

test('an open lease, an unpaid bill, or an unrefunded deposit blocks account deletion', () => {
  assert.deepEqual(deletionBlockers({ openContracts: 0, unpaidBills: 0, unrefundedDeposits: 0 }), []);
  assert.deepEqual(deletionBlockers({ openContracts: 1, unpaidBills: 0, unrefundedDeposits: 0 }), ['open_contract']);
  assert.deepEqual(deletionBlockers({ openContracts: 0, unpaidBills: 2, unrefundedDeposits: 1 }), ['unpaid_bill', 'unrefunded_deposit']);
  assert.equal(contractBlocksDeletion('active'), true);
  assert.equal(contractBlocksDeletion('awaiting_deposit'), true);
  assert.equal(contractBlocksDeletion('terminated'), false);
  assert.equal(anonymizedAccountEmail(12), 'deleted+12@users.invalid');
  // QA A10: the deletion starts at 00:00 Bangkok of the 30th day, so the 00:10 job deletes it on the day shown.
  assert.equal(deletionEffectiveAt(new Date('2026-11-02T03:00:00.000Z')).toISOString(), '2026-12-01T17:00:00.000Z', '10:00 BKK 2 Nov -> 2 Dec');
  assert.equal(deletionEffectiveAt(new Date('2026-11-03T08:00:00.000Z')).toISOString(), '2026-12-02T17:00:00.000Z', '15:00 BKK 3 Nov -> 3 Dec');
  assert.equal(deletionEffectiveAt(new Date('2026-11-03T17:30:00.000Z')).toISOString(), '2026-12-03T17:00:00.000Z', '00:30 BKK 4 Nov -> 4 Dec');
});

test('an open booking letter or lease the user manages as the agent blocks deletion with its own reason', () => {
  assert.deepEqual(deletionBlockers({ openContracts: 0, openAgentContracts: 1, unpaidBills: 0, unrefundedDeposits: 0 }), ['open_agent_contract']);
  assert.deepEqual(deletionBlockers({ openContracts: 1, openAgentContracts: 2, unpaidBills: 1, unrefundedDeposits: 0 }), ['open_contract', 'open_agent_contract', 'unpaid_bill']);
  assert.deepEqual(mod.exports.ACCOUNT_DELETE_BLOCKERS, ['open_contract', 'open_agent_contract', 'unpaid_bill', 'bill_awaiting_review', 'unrefunded_deposit']);
  assert.deepEqual(deletionBlockers({ openContracts: 0, unpaidBills: 0, billsAwaitingReview: 1, unrefundedDeposits: 0 }), ['bill_awaiting_review']);
});
