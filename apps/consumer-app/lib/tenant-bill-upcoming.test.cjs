const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const loaded = { exports: {} };
const source = fs.readFileSync(path.join(__dirname, 'tenant-bill-upcoming.ts'), 'utf8');
new Function('require', 'module', 'exports', ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(require, loaded, loaded.exports);
const { upcomingTenantBill } = loaded.exports;

function contract(patch = {}) {
  return {
    id: 11, formKind: 'lease', status: 'active', myParties: ['tenant'],
    property: 'Project', room: '1208', monthlyRent: 18000,
    startDate: '2026-01-01', endDate: '2027-12-31', previousAgreementId: null,
    nextRentBill: { period: '2026-11', issueDate: '2026-11-05', dueDate: '2026-11-10', graceUntil: '2026-11-15' },
    ...patch,
  };
}

test('selects the earliest future rent issue date across tenant leases without changing the contracts', () => {
  const earlier = contract({ id: 12, property: 'Other project', room: '502', monthlyRent: 12000,
    nextRentBill: { period: '2026-11', issueDate: '2026-10-31', dueDate: '2026-11-05', graceUntil: '2026-11-10' } });
  const contracts = [contract(), earlier];
  const before = structuredClone(contracts);
  assert.deepEqual(upcomingTenantBill(contracts), {
    ...earlier.nextRentBill, billId: null, leaseContractId: 12, property: 'Other project', room: '502', amount: 12000, status: 'upcoming',
  });
  assert.deepEqual(contracts, before);
});

test('independent rooms keep their earliest bill even when another lease started later', () => {
  const earlier = contract({ id: 12, startDate: '2026-01-01', nextRentBill: { period: '2026-11', issueDate: '2026-10-31', dueDate: '2026-11-05', graceUntil: '2026-11-10' } });
  const later = contract({ id: 13, startDate: '2026-09-01' });
  assert.equal(upcomingTenantBill([later, earlier]).leaseContractId, earlier.id);
});

test('renewal replaces its predecessor only after it starts, including when it has no next bill', () => {
  const current = contract();
  const future = contract({ id: 12, formKind: 'renewal', previousAgreementId: current.id, startDate: '2099-01-01', nextRentBill: { ...current.nextRentBill, issueDate: '2099-01-02' } });
  assert.equal(upcomingTenantBill([current, future]).leaseContractId, current.id);
  const started = { ...future, startDate: '2026-01-01', nextRentBill: null };
  assert.equal(upcomingTenantBill([current, started]), null);
  const otherRoom = contract({ id: 14, property: 'Other', startDate: '2025-01-01' });
  assert.equal(upcomingTenantBill([current, started, otherRoom]).leaseContractId, otherRoom.id);
  assert.equal(upcomingTenantBill([current, { ...started, status: 'cancelled' }]).leaseContractId, current.id);
});

test('does not invent a next bill for ended leases, unsigned contracts, owner-only contracts, or absent schedules', () => {
  for (const patch of [
    { status: 'terminated' }, { status: 'expired' }, { status: 'draft' },
    { formKind: 'reservation' }, { myParties: ['owner'] },
    { nextRentBill: null }, { nextRentBill: undefined }, { monthlyRent: 0 },
  ]) assert.equal(upcomingTenantBill([contract(patch)]), null);
  assert.equal(upcomingTenantBill([]), null);
});
