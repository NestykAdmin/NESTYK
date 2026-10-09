const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, deps = {}) {
  const loaded = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('module', 'exports', 'require', source)(loaded, loaded.exports, (id) => deps[id] ?? require(id));
  return loaded.exports;
}
const detail = load('tenant-detail.ts');
const { demoTenantBilling } = load('tenant-billing-demo.ts', { './tenant-detail': detail });
const {
  tenantLease,
  missingProfileFields,
  rentDueDay,
  leaseProgress,
  billingTotals,
  tenantNextAction,
  confirmBill,
  withLiveSlips,
  tenantSlips,
} = detail;
const slip = (over = {}) => ({
  id: 41,
  leaseContractId: 7,
  period: '2026-10',
  documentNo: 'RB202610000007',
  issueDate: '2026-09-30',
  dueDate: '2026-10-05',
  amount: 18000,
  status: 'pending',
  ...over,
});

const contract = (over = {}) => ({
  id: 7,
  formKind: 'lease',
  status: 'active',
  startDate: '2026-06-01',
  endDate: '2027-05-31',
  moveInDate: '2026-06-01',
  monthlyRent: 18000,
  deposit: 36000,
  bookingDate: null,
  reservationPayment: null,
  data: { leaseAgreement: { rentDueDay: '5', advanceMonths: '1' } },
  ...over,
});
const tenant = (over = {}) => ({
  id: 1,
  name: 'ธนากร ศรีสุข',
  phone: '0812345678',
  email: 'a@b.co',
  identityNumber: '1234567890123',
  nationality: 'ไทย',
  contracts: [contract()],
  ...over,
});

test('the active lease wins over newer drafts and cancelled leases are ignored', () => {
  const active = contract({ id: 1, startDate: '2026-01-01' });
  const draft = contract({ id: 2, status: 'draft', startDate: '2026-09-01' });
  const cancelled = contract({ id: 3, status: 'cancelled', startDate: '2026-10-01' });
  assert.equal(tenantLease(tenant({ contracts: [draft, active, cancelled] })).id, 1);
  assert.equal(tenantLease(tenant({ contracts: [cancelled, draft] })).id, 2);
  assert.equal(tenantLease(tenant({ contracts: [] })), null);
});

test('missing profile fields treat blank strings as missing', () => {
  assert.deepEqual(missingProfileFields(tenant()), []);
  assert.deepEqual(missingProfileFields(tenant({ email: ' ', identityNumber: null })), ['email', 'identityNumber']);
});

test('rent due day reads the lease form and rejects out-of-range values', () => {
  assert.equal(rentDueDay(contract()), 5);
  assert.equal(rentDueDay(contract({ data: { leaseAgreement: { rentDueDay: 31 } } })), 31);
  assert.equal(rentDueDay(contract({ data: { leaseAgreement: { rentDueDay: '0' } } })), null);
  assert.equal(rentDueDay(contract({ data: {} })), null);
});

test('lease progress counts days left and clamps the ratio', () => {
  const progress = leaseProgress(contract({ startDate: '2026-01-01', endDate: '2026-01-11' }), new Date(2026, 0, 6));
  assert.equal(progress.daysLeft, 5);
  assert.equal(progress.ratio, 0.5);
  assert.equal(leaseProgress(contract({ endDate: '2026-01-11' }), new Date(2026, 5, 1)).daysLeft, 0);
  assert.equal(leaseProgress(contract({ endDate: null })), null);
});

test('demo billing skips advance months, marks every issued bill paid and shows the next one', () => {
  const billing = demoTenantBilling(tenant(), new Date(2026, 9, 7));
  assert.deepEqual(billing.advancePeriods, ['2026-06']);
  assert.deepEqual(billing.bills.map((b) => [b.period, b.status]), [
    ['2026-10', 'paid'],
    ['2026-09', 'paid'],
    ['2026-08', 'paid'],
    ['2026-07', 'paid'],
  ]);
  assert.ok(billing.bills.every((b) => b.id < 0));
  assert.equal(billing.bills[0].documentNo, 'RB202610000007');
  assert.deepEqual(billing.upcoming, { period: '2026-11', issueDate: '2026-10-31', dueDate: '2026-11-05', amount: 18000 });
  assert.equal(billing.payments.length, 4);
});

test('live slips replace the sample bill and payment of the same period', () => {
  const billing = withLiveSlips(demoTenantBilling(tenant(), new Date(2026, 9, 7)), [slip()]);
  assert.deepEqual(billing.bills.slice(0, 2).map((b) => [b.id, b.period, b.status]), [
    [41, '2026-10', 'awaiting_review'],
    [-4, '2026-09', 'paid'],
  ]);
  assert.equal(billing.bills.length, 4);
  assert.ok(!billing.payments.some((p) => p.period === '2026-10'));
  assert.equal(withLiveSlips(null, [slip()]).bills.length, 1);
  const none = demoTenantBilling(tenant(), new Date(2026, 9, 7));
  assert.equal(withLiveSlips(none, []), none);
});

test('tenant slips match by any of the tenant contracts', () => {
  assert.deepEqual(tenantSlips(tenant(), [slip(), slip({ id: 42, leaseContractId: 99 })]).map((b) => b.id), [41]);
});

test('demo billing has no bills without an active lease but keeps a paid reservation fee', () => {
  const reservation = contract({
    id: 9,
    formKind: 'reservation',
    status: 'awaiting_signatures',
    bookingDate: '2026-05-20',
    reservationPayment: { status: 'paid', total: 5000, submittedAt: null, paymentSlipUrl: 'x', receiptDocumentNo: 'RC1' },
  });
  const billing = demoTenantBilling(tenant({ contracts: [reservation] }), new Date(2026, 9, 7));
  assert.deepEqual(billing.bills, []);
  assert.equal(billing.upcoming, null);
  assert.deepEqual(billing.payments.map((p) => [p.kind, p.amount, p.paidAt, p.receiptIssued]), [
    ['reservation', 5000, '2026-05-20', true],
  ]);
});

test('next action prefers a slip to review, then a missing contract, then signatures', () => {
  const billing = withLiveSlips(demoTenantBilling(tenant(), new Date(2026, 9, 7)), [slip()]);
  assert.equal(tenantNextAction(tenant(), billing).kind, 'review_slip');
  assert.equal(tenantNextAction(tenant({ contracts: [] }), null).kind, 'reservation');
  assert.equal(tenantNextAction(tenant({ contracts: [contract({ status: 'awaiting_signatures' })] }), null).kind, 'sign');
  assert.equal(tenantNextAction(tenant(), demoTenantBilling(tenant(), new Date(2026, 9, 7))), null);
});

test('confirming a slip pays the bill and records the payment once', () => {
  const billing = withLiveSlips(demoTenantBilling(tenant(), new Date(2026, 9, 7)), [slip()]);
  assert.equal(billingTotals(billing).awaiting.length, 1);
  const confirmed = confirmBill(billing, 41, new Date('2026-10-07T03:00:00Z'));
  assert.equal(confirmed.bills[0].status, 'paid');
  assert.equal(confirmed.payments[0].period, '2026-10');
  assert.equal(billingTotals(confirmed).awaiting.length, 0);
  assert.equal(confirmBill(confirmed, 41), confirmed);
});
