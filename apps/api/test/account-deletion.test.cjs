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
  const requested = new Date('2026-11-02T03:00:00.000Z');
  assert.equal(deletionEffectiveAt(requested).toISOString(), '2026-12-02T03:00:00.000Z');
});
