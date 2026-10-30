const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, deps = {}) {
  const loaded = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('module', 'exports', 'require', source)(loaded, loaded.exports, (id) => deps[id] ?? require(id));
  return loaded.exports;
}
const detail = load('tenant-detail.ts');
const renewal = load('contract-renewal.ts', { './lease-term': load('lease-term.ts') });
const { tenantWorkItems, workCounts, contractSignatures, tenantListStatus, groupByProperty, matchesDirectoryFilter } = load('tenant-work.ts', {
  './tenant-detail': detail, './contract-renewal': renewal,
});

const today = new Date(2026, 9, 8);
const contract = (over = {}) => ({
  id: 1,
  formKind: 'lease',
  status: 'active',
  startDate: '2026-01-01',
  endDate: '2027-01-01',
  ownerSignedAt: null,
  tenantSignedAt: null,
  agentSignedAt: null,
  data: {},
  ...over,
});
const tenant = (id, over = {}) => ({ id, name: `T${id}`, property: 'A', room: null, contracts: [], ...over });

test('signatures count only the parties each document needs', () => {
  assert.deepEqual(contractSignatures(contract({ formKind: 'reservation', ownerSignedAt: 'x' })), { signed: 1, required: 3 });
  assert.deepEqual(contractSignatures(contract({ formKind: 'lease', agentSignedAt: 'x' })), { signed: 0, required: 2 });
  assert.deepEqual(contractSignatures(contract({ formKind: 'broker_appointment', agentSignedAt: 'x' })), { signed: 1, required: 2 });
});

test('work items come from slips, signatures and leases ending within 30 days, most urgent first', () => {
  const renewing = tenant(1, { contracts: [contract({ id: 10, endDate: '2026-10-29' })] });
  const signing = tenant(2, { contracts: [contract({ id: 20, formKind: 'reservation', status: 'awaiting_signatures', tenantSignedAt: 'x' })] });
  const paying = tenant(3, { contracts: [contract({ id: 30, endDate: '2027-06-01' })] });
  const calm = tenant(4, { contracts: [contract({ id: 40, endDate: '2026-12-31' })] });
  const slips = [{ id: 5, leaseContractId: 30, dueDate: '2026-10-05' }, { id: 6, leaseContractId: 999, dueDate: '2026-10-01' }];

  const items = tenantWorkItems([renewing, signing, paying, calm], slips, today);
  assert.deepEqual(items.map((i) => [i.kind, i.tenant.id]), [
    ['slip', 3],
    ['signing', 2],
    ['renewal', 1],
  ]);
  assert.equal(items[1].signed, 1);
  assert.equal(items[1].required, 3);
  assert.equal(items[2].daysLeft, 21);
  assert.deepEqual(workCounts(items), { slip: 1, overdue: 0, signing: 1, renewal: 1 });
});

test('renewals sort by days left, and a lease past its end date stays until a decision is recorded', () => {
  const soon = tenant(1, { contracts: [contract({ endDate: '2026-10-10' })] });
  const later = tenant(2, { contracts: [contract({ endDate: '2026-11-01' })] });
  const undecided = tenant(3, { contracts: [contract({ endDate: '2026-10-01' })] });
  const decided = tenant(4, { contracts: [contract({ endDate: '2026-10-01', data: { notRenewing: { recordedOn: '2026-10-02' } } })] });
  const items = tenantWorkItems([later, undecided, soon, decided], [], today);
  assert.deepEqual(items.map((i) => i.tenant.id), [3, 1, 2]);
});

test('AC-8.7: after the nightly job ends an undecided lease, the renewal work stays until a decision is recorded', () => {
  const ended = (data) => tenant(1, { contracts: [contract({ status: 'expired', endDate: '2026-10-01', data })] });
  const work = (t) => tenantWorkItems([t], [], today).filter((i) => i.kind === 'renewal');
  assert.deepEqual(work(ended({ undecided: { since: '2026-10-02' } })).map((i) => i.daysLeft), [-7]);
  assert.equal(tenantListStatus(ended({ undecided: { since: '2026-10-02' } }), work(ended({ undecided: { since: '2026-10-02' } }))), 'renewal');
  assert.equal(work(ended({ undecided: { since: '2026-10-02' }, notRenewing: { recordedOn: '2026-10-05' } })).length, 0, 'recorded not renewing');
  assert.equal(work(ended({})).length, 0, 'an ended lease with no open decision is history');
  const renewed = tenant(1, { contracts: [contract({ id: 1, status: 'expired', endDate: '2026-10-01', data: { undecided: { since: '2026-10-02' } } }),
    contract({ id: 2, formKind: 'renewal', status: 'awaiting_signatures', previousAgreementId: 1, startDate: '2026-10-02', endDate: '2027-10-01' })] });
  assert.equal(detail.tenantLease(renewed, today).id, 2, 'the tenant lease is the renewal, which has no days left');
  assert.equal(work(renewed).length, 0, 'a renewal on the way');
  // The longest past the end comes first.
  const past = (id, endDate) => tenant(id, { contracts: [contract({ id, status: 'expired', endDate, data: { undecided: { since: endDate } } })] });
  assert.deepEqual(tenantWorkItems([past(5, '2026-09-26'), past(6, '2026-09-23'), tenant(7, { contracts: [contract({ id: 7, endDate: '2026-10-20' })] })], [], today).map((i) => i.daysLeft), [-15, -12, 12]);
});

test('directory status is the tenant own most urgent work, else lease state', () => {
  const active = tenant(1, { contracts: [contract({ id: 1 })] });
  const draft = tenant(2, { contracts: [contract({ id: 2, status: 'draft' })] });
  const items = tenantWorkItems([active, draft], [{ id: 9, leaseContractId: 1, dueDate: '2026-10-05' }], today);
  assert.equal(tenantListStatus(active, items), 'slip');
  assert.equal(tenantListStatus(draft, items), 'none');
  assert.equal(tenantListStatus(active, []), 'active');
  const ended = tenant(3, { contracts: [contract({ id: 3, status: 'terminated' })] });
  assert.equal(tenantListStatus(ended, []), 'ended');
});

test('a fully signed document waiting for the agent stays in signing work', () => {
  const row = tenant(1, {
    contracts: [contract({ id: 5, formKind: 'lease', status: 'awaiting_agent_review', ownerSignedAt: 'x', tenantSignedAt: 'y' })],
  });
  const items = tenantWorkItems([row], [], today);
  assert.deepEqual(items.map((i) => [i.kind, i.contract.id, i.signed, i.required]), [['signing', 5, 2, 2]]);
  assert.equal(tenantListStatus(row, items), 'signing');
});

test('directory chips: an ended lease shows only under all', () => {
  const active = tenant(1, { contracts: [contract({ id: 1 })] });
  const signing = tenant(2, { contracts: [contract({ id: 2, status: 'awaiting_signatures' })] });
  const ended = tenant(3, { contracts: [contract({ id: 3, status: 'expired' })] });
  const none = tenant(4);
  const pick = (key) => [active, signing, ended, none].filter((row) => matchesDirectoryFilter(row, key)).map((row) => row.id);
  assert.deepEqual(pick('all'), [1, 2, 3, 4]);
  assert.deepEqual(pick('signing'), [2, 4]);
  assert.deepEqual(pick('active'), [1]);
});

test('tenants group by project in name order', () => {
  const groups = groupByProperty([
    tenant(1, { property: 'B', name: 'Zed' }),
    tenant(2, { property: 'A', name: 'Amy' }),
    tenant(3, { property: 'B', name: 'Bob' }),
  ]);
  assert.deepEqual(groups.map((g) => [g.property, g.tenants.map((t) => t.name)]), [
    ['A', ['Amy']],
    ['B', ['Bob', 'Zed']],
  ]);
});

test('renewal work disappears once there is a draft, signable, or signed successor and returns after cancellation', () => {
  const original = contract({ id: 10, endDate: '2026-10-29' });
  for (const status of ['draft', 'awaiting_signatures', 'awaiting_agent_review', 'active', 'cancelled']) {
    const successor = contract({ id: 11, formKind: 'renewal', previousAgreementId: original.id, status, startDate: '2026-10-30', endDate: '2027-10-29' });
    const items = tenantWorkItems([tenant(1, { contracts: [original, successor] })], [], today);
    assert.equal(items.some(i => i.kind === 'renewal'), status === 'cancelled', status);
    assert.equal(items.some(i => i.kind === 'signing'), status.startsWith('awaiting_'), status);
  }
});

test('renewal work follows the offer notice days and otherwise stays at 30 (TC-7.05)', () => {
  const end = '2027-10-31';
  const items = (iso, renewalNoticeDays) => tenantWorkItems(
    [tenant(1, { contracts: [contract({ endDate: end, renewalNoticeDays })] })], [], new Date(iso),
  );
  assert.equal(items('2027-08-31T12:00:00+07:00', 60).some((item) => item.kind === 'renewal'), false);
  assert.equal(items('2027-09-01T12:00:00+07:00', 60).some((item) => item.kind === 'renewal'), true);
  assert.equal(items('2027-09-01T12:00:00+07:00', null).some((item) => item.kind === 'renewal'), false);
  assert.equal(items('2027-10-01T12:00:00+07:00', null).some((item) => item.kind === 'renewal'), true);
});

test('renewal days use Bangkok date even when the device is set to UTC', () => {
  const savedTZ = process.env.TZ;
  process.env.TZ = 'UTC';
  try {
    const row = tenant(1, { contracts: [contract({ endDate: '2026-10-31' })] });
    const items = tenantWorkItems([row], [], new Date('2026-09-30T17:30:00Z'));
    assert.equal(items[0].kind, 'renewal');
    assert.equal(items[0].daysLeft, 30);
  } finally {
    if (savedTZ === undefined) delete process.env.TZ; else process.env.TZ = savedTZ;
  }
});
