const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { parseEarlyEndMoney, earlyEndCollectInvoice } = require('../src/agent/contracts/early-end-money.ts');

test('unused rent is refunded within 7 days and a collection is due on the ending day', () => {
  assert.deepEqual(parseEarlyEndMoney({ kind: 'refund', amount: '10323' }, '2027-01-15'), {
    kind: 'refund', amount: 10323, note: '', dueOn: '2027-01-22',
  });
  assert.equal(parseEarlyEndMoney({ kind: 'collect', amount: 9677, note: ' 1-15 Jan ' }, '2027-01-15').dueOn, '2027-01-15');
  assert.equal(parseEarlyEndMoney({ kind: 'collect', amount: 9677, note: ' 1-15 Jan ' }, '2027-01-15').note, '1-15 Jan');
  assert.throws(() => parseEarlyEndMoney({ kind: 'refund', amount: '0' }, '2027-01-15'), (error) => error.getStatus() === 400);
  assert.throws(() => parseEarlyEndMoney({ kind: 'both', amount: '1' }, '2027-01-15'), (error) => error.getStatus() === 400);
});

test('the collection invoice is in the landlord name and is due today once the ending day has passed', () => {
  const doc = earlyEndCollectInvoice({
    id: 9,
    contract_no: 'L-9',
    data: { leaseAgreement: { project: 'A', tenantName: 'T', tenantAddress: 'TA', landlordName: 'L', landlordAddress: 'LA' } },
    party_snapshot: {},
    tenant: { name: 'T' },
    rent_room: { property: { name: 'A' } },
  }, 9677, '2026-01-15', '2026-10-27');
  assert.equal(doc.documentNo, 'EE-L-9');
  assert.equal(doc.dueDate, '2026-10-27');
  assert.equal(doc.issueDate, '2026-10-27');
  assert.equal(doc.issuerName, 'L');
  assert.equal(doc.customerName, 'T');
  assert.equal(doc.items[0].unitPrice, 9677);
  assert.equal(doc.vatRate, 0);
});
