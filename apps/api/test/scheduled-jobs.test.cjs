// dev-issues 9 (QA Aof, 3 Nov 2026): DISABLE_SCHEDULED_JOBS=true stops the 00:05 rent bills, the 00:10 account
// deletions and the 08:00 reminders, so an API QA runs against a shared database does not touch every contract or
// delete scheduled accounts. Anything else (unset, false, 1, TRUE) leaves them running, as production needs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename,
  }).outputText, filename);
};
const { scheduledJobsDisabled } = require('../src/common/scheduled-jobs.ts');
const { TenantBillingScheduler } = require('../src/billing/tenant-billing.scheduler.ts');
const { AccountDeletionScheduler } = require('../src/auth/account-deletion.scheduler.ts');
const { ContractRemindersScheduler } = require('../src/agent/reminders/contract-reminders.scheduler.ts');

async function runAll() {
  const calls = [];
  const billing = { persistEndedLeases: async () => calls.push('close leases'), ensureAllActive: async () => calls.push('rent bills') };
  const auth = { deleteDueAccounts: async () => { calls.push('delete accounts'); return 0; } };
  const reminders = { run: async () => { calls.push('reminders'); return { due: 0, emailed: 0 }; } };
  await new TenantBillingScheduler(billing).issueDueBills();
  await new AccountDeletionScheduler(auth).deleteDueAccounts();
  await new ContractRemindersScheduler(reminders).remind();
  return calls;
}

test('DISABLE_SCHEDULED_JOBS=true stops all three jobs; anything else keeps them', async (t) => {
  const previous = process.env.DISABLE_SCHEDULED_JOBS;
  t.after(() => { if (previous === undefined) delete process.env.DISABLE_SCHEDULED_JOBS; else process.env.DISABLE_SCHEDULED_JOBS = previous; });
  process.env.DISABLE_SCHEDULED_JOBS = 'true';
  assert.equal(scheduledJobsDisabled(), true);
  assert.deepEqual(await runAll(), []);
  for (const value of [undefined, 'false', '1', 'TRUE', '']) {
    if (value === undefined) delete process.env.DISABLE_SCHEDULED_JOBS; else process.env.DISABLE_SCHEDULED_JOBS = value;
    assert.equal(scheduledJobsDisabled(), false, String(value));
    assert.deepEqual(await runAll(), ['close leases', 'rent bills', 'delete accounts', 'reminders'], String(value));
  }
});

test('the example env documents the switch, off by default', () => {
  const example = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../../.env.api.example'), 'utf8');
  assert.match(example, /^DISABLE_SCHEDULED_JOBS=false$/m);
});
