// Self owner bills (plan 2026-11-27): self owner leases are billed like agent leases; the owner reads them through
// /bills/received with the same room-owner rule as contracts.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { TenantBillingService, openRentBills, reservationCredits } = require('../src/billing/tenant-billing.service.ts');

const FILTER = 'self_owner_room_id IS NULL';
const SELF_ROOM = { owner_user_id: 9, room_name: 'ห้อง 805', room_number: '805', property: { name: 'Ideo Q' } };

function lease(patch = {}) {
  return {
    id: 42, tenant_id: 3, status: 'active', contract_no: 'LS202600042', created_by_user_id: 8, lead_id: 4,
    agreement_kind: 'new', owner_user_id: 9,
    start_date: '2026-10-01', move_in_date: '2026-10-01', end_date: '2027-09-30',
    monthly_rent: '12000.00', advance_rent: null, room_tenancy_id: 31,
    data: { leaseAgreement: { rentDueDay: '1', advanceMonths: '0', bankName: 'KBank', accountName: 'Owner', accountNo: '123' } },
    rent_room_id: null, rent_room: null, self_owner_room_id: 40, self_owner_room: SELF_ROOM,
    template: { form_kind: 'lease' },
    ...patch,
  };
}

function recorder(rows = []) {
  const sql = [];
  const params = [];
  const qb = new Proxy({}, {
    get(_t, name) {
      if (name === 'sql') return sql;
      if (name === 'params') return params;
      if (name === 'where' || name === 'andWhere') return (text, p) => { sql.push(String(text)); if (p) params.push(p); return qb; };
      if (name === 'getRawMany' || name === 'getMany') return async () => rows;
      if (name === 'getOne') return async () => rows[0] ?? null;
      if (name === 'then') return undefined;
      return () => qb;
    },
  });
  return qb;
}

function insertHarness(records, { occupied = 0 } = {}) {
  const updates = [], inserted = [], counted = [];
  const manager = {
    findOne: async (_, options) => records.find((c) => c.id === options.where.id && c.status === options.where.status) ?? null,
    find: async () => [],
    getRepository: () => ({ find: async () => [] }),
    count: async (_, options) => { counted.push(options.where); return occupied; },
    update: async (_, where, patch) => { updates.push({ where, patch }); },
    createQueryBuilder: () => { const qb = {}; for (const n of ['insert', 'into', 'orIgnore']) qb[n] = () => qb; qb.values = (rows) => { inserted.push(...rows); return qb; }; qb.execute = async () => ({ raw: [] }); return qb; },
  };
  return { manager, updates, inserted, counted, service: new TenantBillingService({ transaction: (fn) => fn(manager) }) };
}

// ---- Task 1: issuing bills for self owner leases ----

test('activeLeases no longer excludes self owner leases', () => {
  const qb = recorder();
  new TenantBillingService({ getRepository: () => ({ createQueryBuilder: () => qb }) }).activeLeases();
  assert.equal(qb.sql.some((s) => s.includes(FILTER)), false, qb.sql.join(' | '));
});

test('insertBills activates the prospect tenancy of a self owner room', async () => {
  const h = insertHarness([lease()]);
  await h.service.insertBills([lease()], '2026-10-03');
  assert.equal(h.counted[0].self_owner_room_id, 40, 'occupancy checked on the self owner room');
  assert.equal('rent_room_id' in h.counted[0], false);
  assert.equal(h.updates.length, 1);
  assert.equal(h.updates[0].where.id, 31);
  assert.equal(h.updates[0].where.self_owner_room_id, 40);
  assert.equal(h.updates[0].where.status, 'prospect');
  assert.deepEqual(h.inserted.map((r) => r.period), ['2026-10']);
});

test('a self owner room with another active stay waits, and the bill still goes out', async () => {
  const h = insertHarness([lease()], { occupied: 1 });
  await h.service.insertBills([lease()], '2026-10-03');
  assert.equal(h.updates.length, 0);
  assert.deepEqual(h.inserted.map((r) => r.period), ['2026-10']);
});

test('no bill for a period after end_date (the daily close skips self owner leases)', () => {
  const ended = lease({ start_date: '2025-10-01', move_in_date: '2025-10-01', end_date: '2026-09-30' });
  // A new lease always re-offers its first period (deduplicated by the unique period index); nothing after the end.
  for (const today of ['2026-10-03', '2026-11-03', '2027-02-03'])
    for (const row of openRentBills(ended, today)) assert.ok(row.period <= '2026-09', `${today}: ${row.period}`);
});

test('reservation credit applies on a self owner room (same creator, lead and room)', async () => {
  const reservation = {
    id: 41, created_by_user_id: 8, lead_id: 4, rent_room_id: null, self_owner_room_id: 40, status: 'active',
    receipt_url: '8/41/receipt.pdf', template: { form_kind: 'reservation' },
    data: { financialDocuments: { invoice: { items: [{ description: 'จอง', quantity: 1, unitPrice: 5000 }], discount: 0, vatRate: 0 } } },
  };
  const wheres = [];
  const db = { getRepository: () => ({ find: async (options) => { wheres.push(options.where); return [reservation]; } }) };
  const credits = await reservationCredits(db, [lease()]);
  assert.equal(credits.get(42), 5000);
  assert.equal(wheres[0][0].self_owner_room_id, 40);
  assert.equal('rent_room_id' in wheres[0][0], false);
});

test('tenant bill views show the self owner room', () => {
  const view = new TenantBillingService({}).serialize({
    id: 5, lease_contract_id: 42, tenant_id: 3, period: '2026-10', document_no: 'RB',
    issue_date: '2026-09-28', due_date: '2026-10-01', grace_until: '2026-10-06', amount: '12000.00',
    status: 'pending', payment_slip_path: null, paid_at: null, tenant: { id: 3, user_id: 5 }, lease_contract: lease(),
  }, '2026-10-02');
  assert.equal(view.property, 'Ideo Q');
  assert.equal(view.room, '805');
});

// ---- Task 2: owner endpoints and the bill view fields ----

const { OwnerBillsController } = require('../src/billing/owner-bills.controller.ts');
const { BillRefreshController } = require('../src/billing/bill-refresh.controller.ts');
const OWNER_SQL_AGENT = 'c.owner_user_id = :userId OR (c.owner_user_id IS NULL AND room.owner_id = :userId)';

function bill(patch = {}) {
  return {
    id: 5, lease_contract_id: 42, tenant_id: 3, period: '2026-10', document_no: 'RB202610000042',
    issue_date: '2026-09-26', due_date: '2026-10-01', grace_until: '2026-10-06', amount: '12000.00',
    status: 'pending', payment_slip_path: null, slip_submitted_at: null, slip_return_note: null, paid_at: null,
    tenant: { id: 3, user_id: 5, name: 'QA Tenant' }, lease_contract: lease(), ...patch,
  };
}

function billingWith(rows) {
  const qbs = [];
  const repo = { createQueryBuilder: () => { const qb = recorder(rows); qbs.push(qb); return qb; }, find: async () => [] };
  const service = new TenantBillingService({ getRepository: () => repo, transaction: async () => 0 });
  return { service, qbs };
}

test('self owner lists bills of their own room, with the new view fields', async () => {
  const { service, qbs } = billingWith([bill({ payment_slip_path: 'p/slip.png', slip_submitted_at: new Date('2026-09-30T03:00:00Z') })]);
  const [view] = await service.listReceived(9);
  const sql = qbs[0].sql.join(' ');
  assert.ok(sql.includes('selfOwnerRoom.owner_user_id = :userId'), sql);
  assert.equal(view.selfOwnerRoomId, 40);
  assert.equal(view.slipSubmittedAt, '2026-09-30T03:00:00.000Z');
  assert.equal(view.awaitingReview, true);
  assert.equal(view.property, 'Ideo Q');
});

test('landlord predicate unchanged for agent rooms', async () => {
  const { service, qbs } = billingWith([]);
  await service.listReceived(9);
  const sql = qbs[0].sql.join(' ');
  assert.ok(sql.includes(OWNER_SQL_AGENT), sql);
  assert.ok(sql.includes('c.self_owner_room_id IS NULL AND'), 'the agent rule applies to agent rooms only');
  assert.ok(sql.includes('c.self_owner_room_id IS NOT NULL AND c.owner_user_id = :userId AND selfOwnerRoom.owner_user_id = :userId'), sql);
});

test('slip, late fee and refresh use the same owner rule', async () => {
  const { service, qbs } = billingWith([]);
  await assert.rejects(() => service.receivedSlipUrl(9, 5), /ไม่พบบิล/);
  assert.ok(qbs[0].sql.join(' ').includes('selfOwnerRoom.owner_user_id = :userId'));
  const leases = recorder([]);
  const svc = new TenantBillingService({ getRepository: () => ({ createQueryBuilder: () => leases }) });
  await svc.ensureForOwner(9, '2026-10-03');
  const sql = leases.sql.join(' ');
  assert.ok(sql.includes('ownerSelfRoom.owner_user_id = :userId'), sql);
  assert.ok(sql.includes('c.owner_user_id IS NULL AND ownerRoom.owner_id = :userId'), 'agent rule kept');
});

test('awaitingReview: true once the slip is sent, false when returned or paid', () => {
  const service = new TenantBillingService({});
  const sent = service.serialize(bill({ payment_slip_path: 'p.png', slip_submitted_at: new Date('2026-10-02T02:00:00Z') }), '2026-10-09');
  assert.equal(sent.awaitingReview, true);
  assert.equal(sent.status, 'overdue', 'the stored status union is unchanged');
  const returned = service.serialize(bill({ payment_slip_path: null, slip_submitted_at: null, slip_return_note: 'ไม่ชัด' }), '2026-10-02');
  assert.equal(returned.awaitingReview, false);
  assert.equal(returned.slipSubmittedAt, null);
  const paid = service.serialize(bill({ status: 'paid', payment_slip_path: 'p.png', slip_submitted_at: new Date('2026-10-02T02:00:00Z'), paid_at: new Date('2026-10-03T02:00:00Z') }), '2026-10-09');
  assert.equal(paid.awaitingReview, false);
  assert.equal(paid.slipSubmittedAt, '2026-10-02T02:00:00.000Z');
  const agent = service.serialize(bill({ lease_contract: lease({ self_owner_room_id: null, self_owner_room: null, rent_room_id: 3, rent_room: { room_id: 'A1', property: { name: 'P' } } }) }), '2026-10-02');
  assert.equal(agent.selfOwnerRoomId, null);
});

test('roles: self_owner on the received endpoints and the refresh POST', () => {
  const { ROLES_KEY } = require('../src/auth/decorators/roles.decorator.ts');
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, OwnerBillsController), ['landlord', 'self_owner']);
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, BillRefreshController.prototype.landlord), ['landlord', 'self_owner']);
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, BillRefreshController.prototype.tenant), ['tenant']);
});
