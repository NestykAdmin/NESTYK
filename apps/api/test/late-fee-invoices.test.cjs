// D12 (AC-7.8): a late fee invoice is issued by the deal's agent, one per rent bill, in the landlord's name.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { lateFeeDays, lateFeeOpen, lateFeeInvoice, lateFeeInvoiceNo, lateFeeReceiptNo, lateFeeInput } = require('../src/billing/late-fee-invoice.ts');
const { TenantBillingService } = require('../src/billing/tenant-billing.service.ts');
const { AgentBillsController } = require('../src/billing/agent-bills.controller.ts');
const { TenantBillsController } = require('../src/billing/tenant-bills.controller.ts');
const { OwnerBillsController } = require('../src/billing/owner-bills.controller.ts');
const { ROLES_KEY } = require('../src/auth/decorators/roles.decorator.ts');
const { AgentContractsService } = require('../src/agent/contracts/agent-contracts.service.ts');
const { LeaseContractEntity } = require('../src/entities/lease-contract.entity.ts');
const { TenantBillEntity } = require('../src/entities/tenant-bill.entity.ts');
const { AgentInvoiceEntity } = require('../src/entities/agent-invoice.entity.ts');

test('late days run from the day after the grace day through the confirmation day (TC-7.02, TC-7.08)', () => {
  assert.equal(lateFeeDays('2026-12-05', '2026-12-05'), 0);
  assert.equal(lateFeeDays('2026-12-05', '2026-12-08'), 3);
  assert.equal(lateFeeDays('2026-12-03', '2026-12-06'), 3);
  assert.equal(lateFeeOpen('2026-12-05', '2026-12-05', null), false);
  assert.equal(lateFeeOpen('2026-12-05', '2026-12-06', null), true);
  assert.equal(lateFeeOpen('2026-12-05', '2026-10-27', '2026-12-08'), true);
  assert.equal(lateFeeOpen('2026-12-05', '2026-12-08', '2026-12-05'), false);
});

test('the invoice number follows the bill number and the amount is typed', () => {
  assert.equal(lateFeeInvoiceNo('RB202612000042'), 'LF-RB202612000042');
  assert.equal(lateFeeReceiptNo('LF-RB202612000042'), 'REC-LF-RB202612000042');
  assert.equal(lateFeeInput({ amount: '300', dueDate: '' }, '2026-12-08').dueDate, '2026-12-08');
  assert.throws(() => lateFeeInput({ amount: '0' }, '2026-12-08'), (error) => error.getStatus() === 400);
  const data = lateFeeInvoice(lease(), 'RB202612000042', 300, '2026-12-08', '2026-12-08');
  assert.equal(data.documentNo, 'LF-RB202612000042');
  assert.equal(data.items[0].unitPrice, 300);
  assert.equal(data.issuerName, 'Owner');
  assert.equal(data.vatRate, 0);
});

function lease() {
  return {
    id: 42, created_by_user_id: 7, tenant_id: 3, status: 'active', contract_no: 'LS202600042',
    data: { leaseAgreement: { tenantName: 'Tenant', landlordName: 'Owner', project: 'Project', latePenalty: '100' } },
    party_snapshot: {}, tenant: { id: 3, user_id: 8, name: 'Tenant', created_by_user_id: 99 },
    rent_room: { room_id: 'A1', property: { name: 'Project' } },
  };
}

function bill(patch = {}) {
  return {
    id: 5, lease_contract_id: 42, tenant_id: 3, period: '2026-12', document_no: 'RB202612000042',
    issue_date: '2026-11-26', due_date: '2026-12-01', grace_until: '2026-12-05', amount: '20000.00',
    status: 'pending', paid_at: null, payment_slip_path: null, slip_submitted_at: null,
    tenant: lease().tenant, lease_contract: lease(), ...patch,
  };
}

function world(row, invoices = []) {
  const removed = [];
  const saved = [];
  const documents = {
    uploadStandaloneInvoice: async () => ({ path: `7/invoices/${saved.length}.pdf` }),
    uploadPaymentSlip: async () => ({ path: `7/payment-slips/${removed.length}.jpg` }),
    remove: async (path) => removed.push(path),
    signPaths: async (paths) => new Map(paths.map((path) => [path, `https://signed.example/${path}`])),
  };
  const repo = {
    createQueryBuilder() {
      const qb = { params: {} };
      for (const name of ['innerJoinAndSelect', 'leftJoinAndSelect', 'leftJoin', 'orderBy', 'addOrderBy']) qb[name] = () => qb;
      qb.where = qb.andWhere = (_sql, params) => { Object.assign(qb.params, params); return qb; };
      qb.getOne = async () => {
        if (qb.params.id !== row.id) return null;
        if (qb.params.agentId != null) {
          const lease = row.lease_contract;
          return qb.params.agentId === lease.created_by_user_id || qb.params.agentId === row.tenant.created_by_user_id ? row : null;
        }
        if (qb.params.userId != null) return qb.params.userId === row.tenant.user_id ? row : null;
        return null;
      };
      return qb;
    },
    find: async (options) => options?.where?.invoice_kind === 'late_fee' ? invoices.filter((item) => item.invoice_kind === 'late_fee' && item.tenant_bill_id === row.id) : [],
    findOne: async (entity, options) => {
      const where = options?.where ?? entity?.where ?? {};
      const name = options ? entity?.name : '';
      if (name === LeaseContractEntity.name) return where.id === row.lease_contract.id ? row.lease_contract : null;
      if (name === TenantBillEntity.name) return where.id === row.id ? row : null;
      if (name === AgentInvoiceEntity.name || where.invoice_kind === 'late_fee') {
        return invoices.find((item) => item.invoice_kind === 'late_fee' && item.tenant_bill_id === (where.tenant_bill_id ?? row.id)
          && (where.tenant_id == null || item.tenant_id === where.tenant_id)
          && (where.created_by_user_id == null || item.created_by_user_id === where.created_by_user_id)) ?? null;
      }
      return null;
    },
    create: (value) => value,
    save: async (value) => { const stored = { id: 9, ...value }; invoices.push(stored); saved.push(stored); return stored; },
    update: async (entityOrWhere, whereOrPatch, maybePatch) => {
      const where = maybePatch ? whereOrPatch : entityOrWhere;
      const patch = maybePatch ?? whereOrPatch;
      const item = invoices.find((row) => row.id === where.id);
      if (item) Object.assign(item, patch);
      return { affected: 1 };
    },
  };
  const db = {
    getRepository: () => repo,
    transaction: (fn) => fn({
      findOne: (entity, options) => repo.findOne(entity, options),
      getRepository: () => repo,
      update: (...args) => repo.update(...args),
    }),
  };
  return { service: new TenantBillingService(db, documents), removed, saved, invoices };
}

test('only the deal agent can issue a late fee, and only once the grace day has passed', async () => {
  const early = world(bill({ grace_until: '2999-12-31' }));
  await assert.rejects(() => early.service.createLateFee(7, 5, { amount: 300 }), (error) => error.getStatus() === 400);
  assert.equal(early.saved.length, 0);
  await assert.rejects(() => world(bill()).service.createLateFee(99, 5, { amount: 300 }), (error) => error.getStatus() === 403);
  await assert.rejects(() => world(bill()).service.createLateFee(8, 5, { amount: 300 }), (error) => error.getStatus() === 404);
  const open = world(bill({ grace_until: '2026-10-01' }));
  const view = await open.service.createLateFee(7, 5, { amount: 300, dueDate: '2999-12-31' });
  assert.equal(open.saved.length, 1);
  assert.equal(open.saved[0].invoice_kind, 'late_fee');
  assert.equal(open.saved[0].issuer_party, 'landlord');
  assert.equal(open.saved[0].amount, '300.00');
  assert.equal(open.saved[0].tenant_bill_id, 5);
  assert.equal(view.amount, 20000);
  assert.equal(view.lateFee.amount, 300);
  assert.equal(view.lateFeePerDay, 100);
  assert.ok(view.lateDays > 0);
  await assert.rejects(() => open.service.createLateFee(7, 5, { amount: 300 }), (error) => error.getStatus() === 409);
  assert.equal(open.removed.length, 1);
});

test('a bill confirmed after its grace day can take a late fee counted to that day', async () => {
  const row = bill({ status: 'paid', paid_at: new Date('2026-12-08T02:00:00.000Z'), grace_until: '2026-12-05' });
  const seen = world(row);
  const view = await seen.service.createLateFee(7, 5, { amount: 300 });
  assert.equal(view.lateDays, 3);
  assert.equal(view.amount, 20000);
});

test('a tenant sends a late fee slip only for their own bill', async () => {
  const invoice = { id: 9, invoice_kind: 'late_fee', tenant_bill_id: 5, tenant_id: 3, created_by_user_id: 7, pdf_path: '7/invoices/a.pdf', receipt_pdf_path: null, payment_slip_path: null };
  const seen = world(bill(), [invoice]);
  await assert.rejects(() => seen.service.uploadLateFeeSlip(99, 5, { buffer: Buffer.from('x'), size: 1 }), (error) => error.getStatus() === 404);
  const view = await seen.service.uploadLateFeeSlip(8, 5, { buffer: Buffer.from('x'), size: 1 });
  assert.equal(view.lateFee.hasPaymentSlip, true);
  await assert.rejects(() => seen.service.lateFeeUrlForTenant(99, 5, 'invoice'), (error) => error.getStatus() === 404);
  assert.equal((await seen.service.lateFeeUrlForTenant(8, 5, 'invoice')).url.startsWith('https://signed.example/'), true);
});

test('a second late fee receipt is rejected', async () => {
  const invoice = {
    id: 9, invoice_kind: 'late_fee', created_by_user_id: 7, lease_contract_id: 42, document_no: 'LF-RB202612000042',
    receipt_pdf_path: '7/receipts/a.pdf', payment_slip_path: '7/slip.jpg', slip_submitted_at: new Date(), voided_at: null, data: {},
  };
  const db = { getRepository: () => ({ findOne: async ({ where }) => {
    if (where.id === 9) return where.created_by_user_id === 7 ? invoice : null;
    if (where.id === 42) return lease();
    return null;
  } }) };
  const service = new AgentContractsService(db, {});
  await assert.rejects(() => service.createReceiptForInvoice(8, 9, {}), (error) => error.getStatus() === 404);
  await assert.rejects(() => service.createReceiptForInvoice(7, 9, { receivedBy: 'landlord' }), (error) => error.getStatus() === 400);
});

test('M8 (Aof 29 Oct 2026): only the deal agent issues a late fee; the landlord opens it, the tenant only sends a slip', () => {
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, AgentBillsController), ['agent']);
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, TenantBillsController), ['tenant']);
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, OwnerBillsController), ['landlord']);
  assert.equal(Reflect.getMetadata('path', AgentBillsController.prototype.createLateFee), 'agent/:id/late-fee');
  assert.equal(Reflect.getMetadata('method', AgentBillsController.prototype.createLateFee), 1);
  assert.equal(Reflect.getMetadata('path', TenantBillsController.prototype.uploadLateFeeSlip), 'mine/:id/late-fee/payment-slip');
  assert.equal(Reflect.getMetadata('path', OwnerBillsController.prototype.lateFeeUrl), 'received/:id/late-fee/:kind');
  assert.equal(OwnerBillsController.prototype.createLateFee, undefined, 'no landlord route to issue one');
  for (const name of Object.getOwnPropertyNames(OwnerBillsController.prototype))
    assert.notEqual(Reflect.getMetadata('method', OwnerBillsController.prototype[name]), 1, `${name}: the landlord has no POST route`);
});
