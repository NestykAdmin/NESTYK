const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { rentPeriodsUntil, parseDueDay, parseAdvanceMonths } = require('../src/billing/rent-schedule.ts');
const { TenantBillingService, openRentBills, billDocumentNo, upcomingRentPeriod } = require('../src/billing/tenant-billing.service.ts');

const dues = (input, until) => rentPeriodsUntil(input, until).map((p) => p.dueDate);

test('bill is issued 5 days before the move-in anniversary with a 5-day grace window', () => {
  const input = { anchorDate: '2026-10-15', endDate: '2027-10-15', advanceMonths: 1 };
  assert.deepEqual(rentPeriodsUntil(input, '2026-11-09'), []);
  assert.deepEqual(rentPeriodsUntil(input, '2026-11-10'), [
    { period: '2026-11', issueDate: '2026-11-10', dueDate: '2026-11-15', graceUntil: '2026-11-20' },
  ]);
});

test('advance months skip the first periods; no advance bills the move-in month', () => {
  assert.deepEqual(dues({ anchorDate: '2026-10-15', endDate: null, advanceMonths: 0 }, '2026-10-10'), ['2026-10-15']);
  assert.deepEqual(dues({ anchorDate: '2026-10-15', endDate: null, advanceMonths: 2 }, '2026-12-31'), ['2026-12-15']);
});

test('rentDueDay from the lease overrides the anchor day and never falls before move-in', () => {
  assert.deepEqual(dues({ anchorDate: '2026-10-15', endDate: null, dueDay: '5' }, '2026-12-01'), ['2026-11-05', '2026-12-05']);
  assert.deepEqual(dues({ anchorDate: '2026-10-03', endDate: null, dueDay: '5' }, '2026-10-01'), ['2026-10-05']);
});

test('month-end anchors clamp to the last day of short months', () => {
  assert.deepEqual(
    dues({ anchorDate: '2027-01-31', endDate: null }, '2027-04-30'),
    ['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30'],
  );
});

test('no bills are issued on or after the lease end date', () => {
  assert.deepEqual(dues({ anchorDate: '2026-10-15', endDate: '2026-12-15' }, '2027-06-01'), ['2026-10-15', '2026-11-15']);
});

test('due day and advance months parsing', () => {
  assert.equal(parseDueDay('5'), 5);
  assert.equal(parseDueDay(' 31 '), 31);
  for (const bad of ['', '0', '32', 'วันที่ 5', null, undefined]) assert.equal(parseDueDay(bad), null);
  assert.equal(parseAdvanceMonths('2', null, '10000'), 2);
  assert.equal(parseAdvanceMonths('', '20000.00', '10000.00'), 2);
  assert.equal(parseAdvanceMonths('', null, '10000'), 0);
});

function lease(patch = {}) {
  return {
    id: 42, tenant_id: 3, status: 'active', contract_no: 'LS202600042', created_by_user_id: 7,
    start_date: '2026-01-15', move_in_date: null, end_date: '2027-01-15',
    monthly_rent: '12000.00', advance_rent: null,
    data: { leaseAgreement: { rentDueDay: '', advanceMonths: '1', bankName: 'KBank', accountName: 'Owner', accountNo: '123' } },
    rent_room: { room_id: 'A1', property: { name: 'Project' } },
    ...patch,
  };
}

test('only periods still inside their grace window are generated (no backfill)', () => {
  assert.deepEqual(openRentBills(lease(), '2026-10-06'), []);
  assert.deepEqual(openRentBills(lease(), '2026-10-12'), [{
    lease_contract_id: 42, tenant_id: 3, period: '2026-10', document_no: billDocumentNo(42, '2026-10'),
    issue_date: '2026-10-10', due_date: '2026-10-15', grace_until: '2026-10-20', amount: '12000.00', status: 'pending',
  }]);
  assert.equal(billDocumentNo(42, '2026-10'), 'RB202610000042');
  assert.deepEqual(openRentBills(lease({ monthly_rent: null }), '2026-10-12'), []);
});

test('upcoming round is the first period not issued yet, with its payable window', () => {
  assert.deepEqual(upcomingRentPeriod(lease(), '2026-10-06'), {
    period: '2026-10', issueDate: '2026-10-10', dueDate: '2026-10-15', graceUntil: '2026-10-20',
  });
  assert.equal(upcomingRentPeriod(lease(), '2026-10-10').dueDate, '2026-11-15');
  assert.equal(upcomingRentPeriod(lease({ start_date: '2027-03-01', end_date: '2028-03-01' }), '2026-10-06').dueDate, '2027-04-01');
  assert.equal(upcomingRentPeriod(lease(), '2026-12-11'), null);
  assert.equal(upcomingRentPeriod(lease({ end_date: null }), '2026-12-11').dueDate, '2027-01-15');
});

function bill(patch = {}) {
  return {
    id: 5, lease_contract_id: 42, tenant_id: 3, period: '2026-10', document_no: 'RB202610000042',
    issue_date: '2026-10-10', due_date: '2026-10-15', grace_until: '2026-10-20', amount: '12000.00',
    status: 'pending', payment_slip_path: null, paid_at: null,
    tenant: { id: 3, user_id: 8 }, lease_contract: lease(), ...patch,
  };
}

test('status is pending through the grace day, then overdue; paid stays paid', () => {
  const service = new TenantBillingService({});
  assert.equal(service.serialize(bill(), '2026-10-20').status, 'pending');
  assert.equal(service.serialize(bill(), '2026-10-21').status, 'overdue');
  assert.equal(service.serialize(bill({ status: 'paid', paid_at: new Date() }), '2026-11-30').status, 'paid');
  const view = service.serialize(bill(), '2026-10-12');
  assert.equal(view.amount, 12000);
  assert.equal(view.property, 'Project');
  assert.deepEqual(view.payTo, { bankName: 'KBank', accountName: 'Owner', accountNo: '123' });
  assert.equal(service.serialize(bill({ lease_contract: lease({ data: {} }) })).payTo, null);
});

function fixture(row) {
  const uploaded = [], removed = [], updates = [];
  const qb = { params: {} };
  for (const key of ['innerJoinAndSelect', 'leftJoinAndSelect', 'leftJoin', 'orderBy', 'addOrderBy']) qb[key] = () => qb;
  qb.where = qb.andWhere = (_sql, params) => { Object.assign(qb.params, params); return qb; };
  qb.getOne = async () => {
    if (qb.params.id !== row.id) return null;
    if (qb.params.agentId != null) return qb.params.agentId === row.lease_contract.created_by_user_id ? structuredClone(row) : null;
    return qb.params.userId === row.tenant.user_id ? structuredClone(row) : null;
  };
  const repo = {
    createQueryBuilder: () => { qb.params = {}; return qb; },
    update: async (where, patch) => {
      updates.push({ where, patch });
      Object.assign(row, patch);
      return { affected: 1 };
    },
  };
  const documents = {
    uploadPaymentSlip: async (agentId) => { const path = `${agentId}/payment-slips/${uploaded.length}.jpg`; uploaded.push(path); return { path }; },
    remove: async (path) => removed.push(path),
    signPaths: async (paths) => new Map(paths.map((p) => [p, `https://signed.example/${p}`])),
  };
  return { service: new TenantBillingService({ getRepository: () => repo }, documents), uploaded, removed, updates };
}

const file = { buffer: Buffer.from([0xff, 0xd8, 0xff]), size: 3, originalname: 'slip.jpg' };

test('tenant can replace a slip until they confirm, then only the agent can finish it', async () => {
  const row = bill({ payment_slip_path: '7/payment-slips/old.jpg' });
  const f = fixture(row);
  const view = await f.service.uploadPaymentSlip(8, 5, file);
  assert.equal(view.status, 'pending');
  assert.equal(view.hasPaymentSlip, true);
  assert.equal(view.slipSubmitted, false);
  assert.deepEqual(f.uploaded, ['7/payment-slips/0.jpg']);
  assert.deepEqual(f.removed, ['7/payment-slips/old.jpg']);
  const replaced = await f.service.uploadPaymentSlip(8, 5, file);
  assert.equal(replaced.slipSubmitted, false);
  await assert.rejects(() => f.service.confirmForAgent(7, 5), (e) => e.getStatus() === 400);
  await assert.rejects(() => f.service.submitForTenant(99, 5), (e) => e.getStatus() === 404);
  const sent = await f.service.submitForTenant(8, 5);
  assert.equal(sent.slipSubmitted, true);
  assert.equal(sent.status, 'pending');
  await assert.rejects(() => f.service.uploadPaymentSlip(8, 5, file), (e) => e.getStatus() === 400);
  await assert.rejects(() => f.service.confirmForAgent(99, 5), (e) => e.getStatus() === 404);
  const confirmed = await f.service.confirmForAgent(7, 5);
  assert.equal(confirmed.status, 'paid');
  assert.equal((await f.service.receivedSlipUrl(8, 5)).url.startsWith('https://signed.example/'), true);
  await assert.rejects(() => f.service.uploadPaymentSlip(8, 5, file), (e) => e.getStatus() === 400);
});

test('agent can return a submitted slip so the tenant uploads again', async () => {
  const row = bill({ payment_slip_path: '7/payment-slips/bad.jpg', slip_submitted_at: new Date() });
  const f = fixture(row);
  await assert.rejects(() => f.service.returnForAgent(7, 5, { reason: '   ' }), (e) => e.getStatus() === 400);
  assert.deepEqual(f.removed, []);
  const returned = await f.service.returnForAgent(7, 5, { reason: ' รูปไม่ชัด ' });
  assert.equal(returned.status, 'pending');
  assert.equal(returned.hasPaymentSlip, false);
  assert.equal(returned.slipSubmitted, false);
  assert.equal(returned.slipReturnReason, 'รูปไม่ชัด');
  assert.deepEqual(f.removed, ['7/payment-slips/bad.jpg']);
  assert.equal(f.updates[0].patch.slip_submitted_at, null);
  const again = await f.service.uploadPaymentSlip(8, 5, file);
  assert.equal(again.hasPaymentSlip, true);
  assert.equal(again.slipSubmitted, false);
  assert.equal(again.slipReturnReason, null);
});

test('a paid bill or a bill without a slip cannot be returned', async () => {
  const paid = fixture(bill({ status: 'paid', payment_slip_path: '7/payment-slips/ok.jpg', paid_at: new Date() }));
  await assert.rejects(() => paid.service.returnForAgent(7, 5), (e) => e.getStatus() === 400);
  assert.deepEqual(paid.removed, []);
  const empty = fixture(bill());
  await assert.rejects(() => empty.service.returnForAgent(7, 5), (e) => e.getStatus() === 400);
  assert.deepEqual(empty.updates, []);
  const draft = fixture(bill({ payment_slip_path: '7/payment-slips/draft.jpg' }));
  await assert.rejects(() => draft.service.returnForAgent(7, 5), (e) => e.getStatus() === 400);
  assert.deepEqual(draft.removed, []);
  await assert.rejects(
    () => fixture(bill({ payment_slip_path: '7/payment-slips/bad.jpg' })).service.returnForAgent(99, 5),
    (e) => e.getStatus() === 404,
  );
});

test('other users cannot see or pay a bill', async () => {
  const f = fixture(bill());
  await assert.rejects(() => f.service.uploadPaymentSlip(99, 5, file), (e) => e.getStatus() === 404);
  await assert.rejects(() => f.service.paymentSlipUrl(99, 5), (e) => e.getStatus() === 404);
  assert.deepEqual(f.uploaded, []);
});
