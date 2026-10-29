const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { rentPeriodsUntil, parseDueDay, parseAdvanceMonths, renewalActiveOn } = require('../src/billing/rent-schedule.ts');
const { TenantBillingService, openRentBills, billDocumentNo, upcomingRentPeriod, reservationCredits } = require('../src/billing/tenant-billing.service.ts');

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

test('a bill due on the lease end date is issued, and one due after it is not (AC-8.7)', () => {
  assert.deepEqual(dues({ anchorDate: '2026-10-15', endDate: '2026-12-15' }, '2027-06-01'), ['2026-10-15', '2026-11-15', '2026-12-15']);
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
  assert.equal(upcomingRentPeriod(lease(), '2026-12-11').dueDate, '2027-01-15');
  assert.equal(upcomingRentPeriod(lease(), '2027-01-10'), null);
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

function fixture(row, options = {}) {
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
    find: async () => [],
    createQueryBuilder: () => { qb.params = {}; return qb; },
    update: async (where, patch) => {
      if (options.beforeUpdate) await options.beforeUpdate(where, patch);
      for (const [key, value] of Object.entries(where)) {
        if (value?.type === 'isNull' ? row[key] != null :
            value instanceof Date ? new Date(row[key]).getTime() !== value.getTime() : row[key] !== value)
          return { affected: 0 };
      }
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
  const row = bill({ payment_slip_path: '7/payment-slips/old.jpg', grace_until: '2999-12-31' });
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
  const row = bill({ payment_slip_path: '7/payment-slips/bad.jpg', slip_submitted_at: new Date(), grace_until: '2999-12-31' });
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

test('a concurrent return invalidates a stale confirmation instead of paying a bill without evidence', async () => {
  const row = bill({ payment_slip_path: '7/payment-slips/bad.jpg', slip_submitted_at: new Date() });
  let release, entered;
  const gate = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  const f = fixture(row, { beforeUpdate: async (_where, patch) => {
    if (patch.status === 'paid') { entered(); await gate; }
  } });
  const confirming = f.service.confirmForAgent(7, 5);
  const rejected = assert.rejects(() => confirming, e => e.getStatus() === 409);
  await started;
  await f.service.returnForAgent(7, 5, { reason: 'Wrong slip' });
  release(); await rejected;
  assert.equal(row.status, 'pending'); assert.equal(row.payment_slip_path, null);
  assert.equal(row.paid_at, null); assert.equal(row.slip_return_note, 'Wrong slip');
  assert.deepEqual(f.removed, ['7/payment-slips/bad.jpg']);
});

test('billing re-reads active contracts under a lock so a stale pre-closure snapshot issues nothing', async () => {
  const qb = {}; for (const name of ['leftJoin', 'leftJoinAndSelect', 'where', 'andWhere']) qb[name] = () => qb;
  qb.getMany = async () => [lease()];
  const locks = []; let insertCalled = false;
  const service = new TenantBillingService({ getRepository: () => ({ createQueryBuilder: () => qb }),
    transaction: fn => fn({ findOne: async (_entity, options) => { locks.push(options); return null; },
      createQueryBuilder: () => { insertCalled = true; throw Error('must not insert closed lease'); } }),
  });
  assert.equal(await service.ensureAllActive('2026-10-12'), 0);
  assert.deepEqual(locks, [{ where: { id: 42, status: 'active' }, lock: { mode: 'pessimistic_write' } }]);
  assert.equal(insertCalled, false);
});

test('closed leases keep unpaid bills payable and preserve paid bill evidence', async () => {
  const row = bill({ lease_contract: lease({ status: 'terminated' }) });
  const f = fixture(row);
  assert.equal(f.service.serialize(row, '2026-10-21').status, 'overdue');
  assert.equal(f.service.serialize(row).leaseActive, false);
  await f.service.uploadPaymentSlip(8, 5, file); await f.service.submitForTenant(8, 5);
  const paid = await f.service.confirmForAgent(7, 5);
  assert.equal(paid.status, 'paid'); assert.equal(paid.hasPaymentSlip, true); assert.equal(paid.leaseActive, false);
});


test('grace deadline follows the signed form and rolls forward when its day is before the due date', () => {
  const { rentPeriodsUntil } = require('../src/billing/rent-schedule.ts');
  assert.equal(rentPeriodsUntil({ anchorDate: '2026-10-01', endDate: '2026-11-01', dueDay: '1', graceDay: '15' }, '2026-10-01')[0].graceUntil, '2026-10-15');
  assert.equal(rentPeriodsUntil({ anchorDate: '2026-10-01', endDate: '2026-11-01', dueDay: '25', graceDay: '5' }, '2026-10-25')[0].graceUntil, '2026-11-05');
  assert.equal(rentPeriodsUntil({ anchorDate: '2027-02-01', endDate: '2027-03-01', dueDay: '31', graceDay: '31' }, '2027-02-28')[0].graceUntil, '2027-02-28');
  const c = lease({ data: { leaseAgreement: { rentDueDay: '15', graceDay: '25', advanceMonths: '0' } } });
  assert.equal(openRentBills(c, '2026-10-20')[0].grace_until, '2026-10-25');
});

test('renewal bank display text exposes a copyable account number separately', () => {
  const service = new TenantBillingService({});
  const c = lease({ data: { leaseRenewal: { dueDay: '15', bankAccount: 'KBank / Owner / 1234567890' } } });
  assert.deepEqual(service.serialize(bill({ lease_contract: c })).payTo, { bankName: 'KBank', accountName: 'Owner', accountNo: '1234567890' });
});


test('billing activates only signed stays that have started, and preserves closed or future occupancy', async () => {
  const updates = [];
  const records = [lease({ id: 42, room_tenancy_id: 9, start_date: '2026-10-01', move_in_date: '2026-10-01' }),
    lease({ id: 43, room_tenancy_id: 10, start_date: '2026-11-01', move_in_date: '2026-11-01' }),
    lease({ id: 44, room_tenancy_id: 11, status: 'terminated' })];
  const manager = { findOne: async (_, options) => records.find(c => c.id === options.where.id && c.status === options.where.status),
    update: async (_, where, patch) => { updates.push({ where, patch }); },
    createQueryBuilder: () => { const qb = {}; for (const name of ['insert', 'into', 'values', 'orIgnore']) qb[name] = () => qb; qb.execute = async () => ({ raw: [] }); return qb; } };
  const service = new TenantBillingService({ transaction: fn => fn(manager) });
  await service.insertBills(records, '2026-10-14');
  assert.equal(updates.length, 1); assert.equal(updates[0].where.id, 9);
  assert.equal(updates[0].where.status, 'prospect'); assert.equal(updates[0].patch.move_in_date, '2026-10-01');
});


test('legacy advances beyond the supported calendar yield no due bills instead of a date error', () => {
  assert.deepEqual(rentPeriodsUntil({ anchorDate: '2026-10-01', endDate: null, advanceMonths: 1e12 }, '2026-10-14'), []);
});

// D12 (AC-7.2): the sample lease of the AC/TC document, 1 Nov 2026 to 31 Oct 2027, rent 20,000 due on the 1st.
const newLease = (patch = {}) => lease({
  agreement_kind: 'new', lead_id: 11, rent_room_id: 21, start_date: '2026-11-01', end_date: '2027-10-31',
  monthly_rent: '20000.00', data: { leaseAgreement: { rentDueDay: '1', graceDay: '5', advanceMonths: '1' } }, ...patch,
});
const firstBill = (c, today, credit) => openRentBills(c, today, credit).find((row) => row.period === '2026-11');

test('H1: the daily close goes lease by lease; one that fails is logged and the others still close', async () => {
  const queries = [];
  const qb = {};
  for (const m of ['leftJoin', 'select', 'where', 'andWhere', 'orderBy']) qb[m] = (...args) => { queries.push([m, ...args]); return qb; };
  qb.getRawMany = async () => [{ id: 1 }, { id: 2 }, { id: 3 }];
  const service = new TenantBillingService({ getRepository: () => ({ createQueryBuilder: () => qb }) });
  const calls = [];
  service.closeEnded = async (id, today) => {
    calls.push([id, today]);
    if (id === 2) throw new Error('trigger refused');
    return id === 1 ? 'terminated' : null;
  };
  service.logger = { log() {}, error: (message) => calls.push(['error', message]) };
  assert.equal(await service.persistEndedLeases('2027-01-16'), 1);
  assert.deepEqual(calls, [[1, '2027-01-16'], [2, '2027-01-16'], ['error', 'Could not close ended lease 2: trigger refused'], [3, '2027-01-16']]);
  const dates = queries.find(([m, sql]) => m === 'andWhere' && /end_date/.test(sql));
  assert.match(dates[1], /CAST\(:today AS date\)/); assert.match(dates[1], /CAST\(:today AS text\)/);
  assert.match(dates[1], /c\.status = 'expired' AND \(c\.data->'undecided'\) IS NOT NULL/, 'AC-8.7: the undecided ended leases too');
  assert.deepEqual(dates[2], { today: '2027-01-16' });
});

test('first month counts the days from move-in through the day before the due date (AC-7.1)', () => {
  const c = newLease({
    start_date: '2026-11-15',
    data: { leaseAgreement: { rentDueDay: '1', graceDay: '5', advanceMonths: '0' } },
  });
  const [first] = openRentBills(c, '2026-11-15');
  assert.equal(first.due_date, '2026-12-01');
  assert.equal(first.amount, '10667.00');
  assert.equal(first.status, 'pending');
  const covered = openRentBills(c, '2026-11-15', 20000)[0];
  assert.equal(covered.amount, '0.00');
  assert.equal(covered.status, 'paid');
});

test('first bill of a new lease is the rent less the reservation, closed at once when it comes to 0 (TC-7.01)', () => {
  const rows = openRentBills(newLease(), '2026-11-01', 20000);
  assert.deepEqual(rows.map((row) => row.period), ['2026-11']);
  assert.equal(rows[0].amount, '0.00');
  assert.equal(rows[0].status, 'paid');
  assert.ok(rows[0].paid_at instanceof Date);
  assert.equal(rows[0].document_no, billDocumentNo(42, '2026-11'));
  assert.deepEqual(openRentBills(newLease(), '2026-11-25', 20000).map((row) => row.period), ['2026-11']);
  const dec = openRentBills(newLease(), '2026-11-26', 20000);
  assert.deepEqual(dec.map((row) => [row.period, row.amount, row.status, row.issue_date]),
    [['2026-11', '0.00', 'paid', '2026-10-27'], ['2026-12', '20000.00', 'pending', '2026-11-26']]);
  assert.equal('paid_at' in dec[1], false);
});

test('first bill amounts: rent above, below or without a reservation receipt (AC-2.4)', () => {
  const above = firstBill(newLease({ monthly_rent: '21000.00' }), '2026-11-01', 20000);
  assert.equal(above.amount, '1000.00'); assert.equal(above.status, 'pending'); assert.equal('paid_at' in above, false);
  const below = firstBill(newLease({ monthly_rent: '19000.00' }), '2026-11-01', 20000);
  assert.equal(below.amount, '0.00'); assert.equal(below.status, 'paid');
  const none = firstBill(newLease(), '2026-11-01', null);
  assert.equal(none.amount, '20000.00'); assert.equal(none.status, 'pending');
});

test('the first bill is issued as soon as the lease is in effect, even after its grace day', () => {
  assert.equal(firstBill(newLease(), '2026-10-20', 20000).issue_date, '2026-10-20');
  const late = openRentBills(newLease(), '2026-11-20', 20000);
  assert.deepEqual(late.map((row) => [row.period, row.amount, row.status]), [['2026-11', '0.00', 'paid']]);
});

test('a renewal is not a new lease: no reservation is taken off and its schedule is unchanged', () => {
  const renewal = newLease({ agreement_kind: 'renewal', data: { leaseAgreement: { rentDueDay: '1', advanceMonths: '0' } } });
  const rows = openRentBills(renewal, '2026-11-01', 20000);
  assert.deepEqual(rows.map((row) => [row.period, row.amount, row.status]), [['2026-11', '20000.00', 'pending']]);
  assert.deepEqual(openRentBills(renewal, '2026-10-20', 20000), []);
});

test('an advance above one month still skips the periods after the first one', () => {
  const c = newLease({ data: { leaseAgreement: { rentDueDay: '1', graceDay: '5', advanceMonths: '2' } } });
  assert.deepEqual(openRentBills(c, '2027-01-01', 20000).map((row) => row.period), ['2026-11', '2027-01']);
  assert.equal(upcomingRentPeriod(c, '2026-11-02').dueDate, '2027-01-01');
});

test('the first period of a new lease is never shown as the upcoming bill', () => {
  assert.equal(upcomingRentPeriod(newLease(), '2026-10-20').dueDate, '2026-12-01');
  assert.equal(upcomingRentPeriod(newLease(), '2026-11-26').dueDate, '2027-01-01');
});

test('the late badge follows the grace day of the contract (TC-7.02, TC-7.08)', () => {
  const service = new TenantBillingService({});
  for (const [graceDay, lastDay, lateDay] of [['5', '2026-12-05', '2026-12-06'], ['3', '2026-12-03', '2026-12-04']]) {
    const c = newLease({ data: { leaseAgreement: { rentDueDay: '1', graceDay, advanceMonths: '1' } } });
    const dec = openRentBills(c, '2026-12-01', 20000).find((row) => row.period === '2026-12');
    assert.equal(dec.grace_until, lastDay);
    const row = bill({ ...dec, lease_contract: c });
    assert.equal(service.serialize(row, lastDay).status, 'pending');
    assert.equal(service.serialize(row, lateDay).status, 'overdue');
    assert.equal(service.serialize(row, lateDay).amount, 20000);
  }
});

test('a signed renewal is in force on its start day, or the day after a late signing', () => {
  assert.equal(renewalActiveOn('2027-11-01', '2027-10-29'), '2027-11-01');
  assert.equal(renewalActiveOn('2027-11-01', '2027-11-01'), '2027-11-02');
  assert.equal(renewalActiveOn('2027-11-01', '2027-11-10'), '2027-11-11');
});

test('a renewal signed after the normal issue day bills that period immediately (TC-8.10)', () => {
  const c = lease({
    agreement_kind: 'renewal', start_date: '2027-11-01', move_in_date: null, end_date: '2028-10-31', monthly_rent: '21000.00',
    data: { leaseAgreement: { rentDueDay: '1', graceDay: '5', advanceMonths: '0' }, renewalSignedOn: '2027-10-29' },
  });
  assert.deepEqual(openRentBills(c, '2027-10-26'), []);
  const rows = openRentBills(c, '2027-10-29');
  assert.deepEqual(rows.map((row) => [row.period, row.due_date, row.amount]), [['2027-11', '2027-11-01', '21000.00']]);
});

test('a late renewal backfills missed periods onto the next due day (TC-8.08)', () => {
  const form = { leaseAgreement: { rentDueDay: '1', graceDay: '5', advanceMonths: '0' } };
  const base = { agreement_kind: 'renewal', start_date: '2027-11-01', move_in_date: null, end_date: '2028-10-31', monthly_rent: '20000.00' };
  const november = openRentBills(lease({ ...base, data: { ...form, renewalSignedOn: '2027-11-10' } }), '2027-11-10');
  assert.deepEqual(november.map((row) => [row.period, row.due_date, row.grace_until]), [['2027-11', '2027-12-01', '2027-12-05']]);
  const both = openRentBills(lease({ ...base, data: { ...form, renewalSignedOn: '2027-12-02' } }), '2027-12-02');
  assert.deepEqual(both.map((row) => [row.period, row.due_date]), [['2027-11', '2028-01-01'], ['2027-12', '2028-01-01']]);
  const service = new TenantBillingService({});
  const row = bill({ ...november[0], lease_contract: lease({ ...base, data: { ...form, renewalSignedOn: '2027-11-10' } }) });
  assert.equal(service.serialize(row, '2027-12-05').status, 'pending');
  assert.equal(service.serialize(row, '2027-12-06').status, 'overdue');
});

test('a reservation receipt without line items leaves the first bill at the full rent', async () => {
  const db = { getRepository: () => ({ find: async () => [{ id: 30, created_by_user_id: 7, lead_id: 11, rent_room_id: 21,
    status: 'active', receipt_url: '7/receipt.pdf', template: { form_kind: 'reservation' },
    data: { financialDocuments: { invoice: {} } } }] }) };
  assert.equal((await reservationCredits(db, [newLease()])).has(42), false);
  assert.equal(firstBill(newLease(), '2026-11-01', null).amount, '20000.00');
});

test('only the first bill of a new lease shows the rent less the reservation', () => {
  const service = new TenantBillingService({});
  const credits = new Map([[42, 20000]]);
  const nov = bill({ period: '2026-11', amount: '0.00', status: 'paid', lease_contract: newLease() });
  assert.deepEqual(service.serialize(nov, '2026-11-01', credits).reservationCredit, { rent: 20000, credit: 20000 });
  const dec = bill({ period: '2026-12', amount: '20000.00', lease_contract: newLease() });
  assert.equal(service.serialize(dec, '2026-12-01', credits).reservationCredit, null);
  const full = bill({ period: '2026-11', amount: '20000.00', lease_contract: newLease() });
  assert.equal(service.serialize(full, '2026-11-01', credits).reservationCredit, null);
  assert.equal(service.serialize(nov, '2026-11-01').reservationCredit, null);
});

test('billing reads the deal reservation receipt for the first bill and inserts idempotently (TC-S.07)', async () => {
  const c = newLease({ room_tenancy_id: null });
  const invoice = { items: [{ description: 'ค่าจอง', quantity: 1, unitPrice: 20000 }], discount: 0, vatRate: 0 };
  const reservation = (patch) => ({ id: 30, created_by_user_id: 7, lead_id: 11, rent_room_id: 21, status: 'active',
    receipt_url: '7/receipt.pdf', template: { form_kind: 'reservation' }, data: { financialDocuments: { invoice } }, ...patch });
  const found = [reservation({ id: 29, status: 'cancelled' }), reservation(), reservation({ id: 31, receipt_url: null }),
    reservation({ id: 32, lead_id: 99 }), { ...c, id: 42, template: { form_kind: 'lease' } }];
  const inserted = [], ignored = [];
  const manager = {
    findOne: async (_, options) => (options.where.id === c.id ? c : null),
    update: async () => undefined,
    getRepository: () => ({ find: async () => found }),
    createQueryBuilder: () => {
      const qb = { insert: () => qb, into: () => qb };
      qb.values = (rows) => { inserted.push(rows); return qb; };
      qb.orIgnore = () => { ignored.push(true); return qb; };
      qb.execute = async () => ({ raw: [] });
      return qb;
    },
  };
  const service = new TenantBillingService({ transaction: (fn) => fn(manager) });
  await service.insertBills([c], '2026-11-01');
  await service.insertBills([c], '2026-11-01');
  assert.equal(ignored.length, 2);
  for (const rows of inserted) {
    assert.deepEqual(rows.map((row) => [row.period, row.document_no, row.amount, row.status]),
      [['2026-11', billDocumentNo(42, '2026-11'), '0.00', 'paid']]);
  }
});
