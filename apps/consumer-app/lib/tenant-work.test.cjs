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
const { tenantWorkItems, workCounts, contractSignatures, tenantListStatus, groupByProperty } = load('tenant-work.ts', {
  './tenant-detail': detail,
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

test('renewals sort by days left and ended leases are not renewals', () => {
  const soon = tenant(1, { contracts: [contract({ endDate: '2026-10-10' })] });
  const later = tenant(2, { contracts: [contract({ endDate: '2026-11-01' })] });
  const ended = tenant(3, { contracts: [contract({ endDate: '2026-10-01' })] });
  const items = tenantWorkItems([later, ended, soon], [], today);
  assert.deepEqual(items.map((i) => i.tenant.id), [1, 2]);
});

test('directory status is the tenant own most urgent work, else lease state', () => {
  const active = tenant(1, { contracts: [contract({ id: 1 })] });
  const draft = tenant(2, { contracts: [contract({ id: 2, status: 'draft' })] });
  const items = tenantWorkItems([active, draft], [{ id: 9, leaseContractId: 1, dueDate: '2026-10-05' }], today);
  assert.equal(tenantListStatus(active, items), 'slip');
  assert.equal(tenantListStatus(draft, items), 'none');
  assert.equal(tenantListStatus(active, []), 'active');
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
