// D10 (AC-5.1 to 5.5): the deposit invoice of a generated lease, issued in the landlord's name, once per lease.
// Decisions Aof made on 21 Oct 2026 (the expected values below come from them):
// - the deposit invoice is issued by the landlord (issuer_party landlord, issuer = the landlord on the lease form)
// - its number is tied to the contract number: DEP-<contract no>, receipt REC-DEP-<contract no>
// - a deposit of 0 gets no invoice (the deposit step is skipped)
// Decisions Aof made later on 21 Oct 2026 (after the D10 review):
// - no deposit receipt once the lease is closed
// - the slip the tenant sent is kept: the agent cannot attach another slip over it
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const sharp = require('sharp');
const { AgentContractsService } = require('../src/agent/contracts/agent-contracts.service.ts');
const { AgentContractsController } = require('../src/agent/contracts/agent-contracts.controller.ts');
const { PartyContractsController } = require('../src/agent/contracts/party-contracts.controller.ts');
const { ContractDocumentStorageService } = require('../src/agent/contracts/contract-document-storage.service.ts');
const { emptyLeaseAgreement } = require('../src/agent/contracts/lease-agreement.ts');
const { LeaseContractEntity } = require('../src/entities/lease-contract.entity.ts');
const { AgentInvoiceEntity } = require('../src/entities/agent-invoice.entity.ts');
const { AgreementSignatureEntity } = require('../src/entities/agreement-signature.entity.ts');
const { TenantEntity } = require('../src/entities/tenant.entity.ts');

const GENERATED = '7/11/generated/lease_agreement/v1/lease.pdf';
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const slip = { buffer: jpeg, size: jpeg.length, originalname: 'slip.jpg' };
const invoiceData = { items: [{ description: 'เงินประกันการเช่า', quantity: 1, unitPrice: 40000 }], vatRate: 0, discount: 0 };

function leaseRow(overrides = {}) {
  return {
    id: 11, tenant_id: 2, rent_room_id: 3, lead_id: 1, created_by_user_id: 7, contract_no: 'LS202600011',
    rent_room: { property: { name: 'Aria' }, listing_title: null, room_id: '1201' },
    tenant: { id: 2, name: 'Tenant B', user_id: 8 }, owner_user_id: 9,
    agreement_type_code: 'lease', agreement_type: { name_th: 'สัญญาเช่า', form_kind: 'lease' },
    template: { form_kind: 'lease', document_template_key: 'lease/v1' },
    status: 'active', start_date: '2099-01-01', end_date: '2099-12-31', monthly_rent: '20000.00', deposit: '40000.00',
    owner_signed_at: new Date('2026-10-20T03:00:00Z'), owner_signature_url: '7/11/signatures/owner.png',
    tenant_signed_at: new Date('2026-10-20T03:00:00Z'), tenant_signature_url: '7/11/signatures/tenant.png',
    agent_signed_at: null, document_url: GENERATED, invoice_url: null, receipt_url: null,
    tenant_delivered_at: new Date('2026-10-20T04:00:00Z'), owner_delivered_at: new Date('2026-10-20T04:00:00Z'),
    data: { leaseAgreement: { ...emptyLeaseAgreement(), landlordName: 'Landlord A', landlordAddress: '9 Owner Rd', landlordPhone: '0899999999',
      landlordEmail: 'not-an-email', tenantName: 'Tenant B', tenantAddress: '5 Tenant Rd', tenantEmail: 'tenant@example.com',
      project: 'Aria', houseNo: '1201', bankName: 'KBank', accountName: 'Landlord A', accountNo: '123-4-56789-0', depositAmount: '40000' } },
    ...overrides,
  };
}

function storageDouble() {
  const objects = new Map();
  const cloud = {
    upload: async (key, buffer, options) => { assert.equal(options.upsert, false); objects.set(key, { buffer }); return { error: null }; },
    createSignedUrls: async (paths) => ({ data: paths.map((path) => ({ path, signedUrl: `https://signed.example/${path}` })), error: null }),
    download: async (path) => ({ data: objects.has(path) ? new Blob([objects.get(path).buffer]) : null, error: objects.has(path) ? null : new Error('missing') }),
    remove: async (paths) => { paths.forEach((path) => objects.delete(path)); return { error: null }; },
  };
  const storage = new ContractDocumentStorageService();
  storage.storage = () => cloud;
  storage.client = { storage: { listBuckets: async () => ({ data: [{ name: 'contract-documents', public: false }], error: null }) } };
  return { storage, objects };
}

/** Runs fn at 18:00 UTC on 20 Oct 2026, which is already 21 Oct in Bangkok (the date the invoice must carry). */
async function atBangkokOct21(fn) {
  const RealDate = Date;
  global.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : ['2026-10-20T18:00:00Z'])); } static now() { return new RealDate('2026-10-20T18:00:00Z').getTime(); } };
  try { return await fn(); } finally { global.Date = RealDate; }
}

const matches = (row, where = {}) => Object.entries(where).every(([key, value]) =>
  value && typeof value === 'object' && value._type === 'in' ? value.value.includes(row[key]) : row[key] === value);

/**
 * An in-memory lease (id 11, agent 7, tenant user 8, owner user 9) and agent_invoices table. `others` are more
 * contracts of the same agent, returned by the list queries only. `events` records, in order, the locks taken and
 * the invoice lookups made inside a transaction; `saves` records whether each invoice was saved inside one.
 */
function harness(overrides = {}, others = []) {
  const row = leaseRow(overrides);
  const invoices = [];
  const removed = [];
  const { storage, objects } = storageDouble();
  const remove = storage.remove.bind(storage);
  storage.remove = async (path) => { removed.push(path); return remove(path); };
  let witness = null;
  let nextId = 100;
  const hooks = { beforeSave: null, inTransaction: null };
  const events = [];
  const saves = [];
  const qbFor = () => {
    let scope = null;
    const qb = {};
    for (const key of ['leftJoinAndSelect', 'andWhere', 'orderBy']) qb[key] = () => qb;
    qb.where = (_sql, params) => { scope = params ?? null; return qb; };
    const visible = () => !(scope && 'agentId' in scope && scope.agentId !== row.created_by_user_id);
    qb.getOne = async () => (visible() ? structuredClone(row) : null);
    qb.getMany = async () => (visible() ? [row, ...others].map((value) => structuredClone(value)) : []);
    return qb;
  };
  const invoiceRepo = {
    find: async ({ where }) => invoices.filter((invoice) => matches(invoice, where)).map((invoice) => ({ ...invoice })),
    findOne: async ({ where }) => { const found = invoices.find((invoice) => matches(invoice, where)); return found ? { ...found } : null; },
    create: (value) => ({ ...value }),
    save: async (value) => {
      saves.push('outside a transaction');
      return saveInvoice(value);
    },
  };
  const saveInvoice = async (value) => {
      if (hooks.beforeSave) await hooks.beforeSave(value);
      const existing = value.id ? invoices.find((invoice) => invoice.id === value.id) : null;
      if (existing) { Object.assign(existing, value); return { ...existing }; }
      if (value.invoice_kind === 'deposit' && invoices.some((invoice) => invoice.invoice_kind === 'deposit' && invoice.lease_contract_id === value.lease_contract_id))
        throw Object.assign(new Error('duplicate key value violates unique constraint "uq_agent_invoices_one_deposit"'), { code: '23505' });
      const saved = { id: nextId++, invoice_kind: 'general', issuer_party: 'agent', receipt_pdf_path: null, receipt_document_no: null,
        payment_slip_path: null, slip_submitted_at: null, receipt_data: null, ...value };
      invoices.push(saved);
      return { ...saved };
  };
  // The repository a transaction hands out: saves are marked as inside it, lookups are logged in order.
  const managerInvoiceRepo = { ...invoiceRepo,
    findOne: async (options) => { events.push('find invoice'); return invoiceRepo.findOne(options); },
    save: async (value) => { saves.push('in the transaction'); return saveInvoice(value); },
  };
  const leaseRepo = {
    createQueryBuilder: qbFor,
    findOne: async ({ where }) => (where.id === row.id ? structuredClone(row) : null),
    update: async (_where, patch) => { Object.assign(row, patch); return { affected: 1 }; },
  };
  const signatureRepo = { findOne: async () => witness };
  const repoFor = (entity) => (entity === AgentInvoiceEntity ? invoiceRepo : entity === AgreementSignatureEntity ? signatureRepo : leaseRepo);
  const locks = [];
  const manager = {
    getRepository: (entity) => (entity === AgentInvoiceEntity ? managerInvoiceRepo : repoFor(entity)),
    findOne: async (entity, options) => {
      if (options.lock) { locks.push([entity.name, options.lock.mode]); events.push(`lock ${entity.name}`); }
      if (entity === LeaseContractEntity) {
        if (options.where.created_by_user_id !== undefined) assert.equal(options.where.created_by_user_id, 7);
        if (options.where.id !== row.id) return null;
        return structuredClone(row);
      }
      events.push('find invoice');
      return invoiceRepo.findOne(options);
    },
    findOneBy: async (entity, where) => {
      assert.equal(entity, TenantEntity);
      return where.id === row.tenant_id && where.user_id === row.tenant.user_id ? row.tenant : null;
    },
    update: async (entity, where, patch) => {
      assert.equal(entity, AgentInvoiceEntity);
      Object.assign(invoices.find((invoice) => invoice.id === where.id), patch);
    },
  };
  const db = {
    getRepository: repoFor,
    transaction: async (fn) => { if (hooks.inTransaction) await hooks.inTransaction(); return fn(manager); },
  };
  const service = new AgentContractsService(db, storage);
  service.logger = { warn: () => undefined };
  return { service, row, invoices, objects, removed, locks, events, saves, hooks, storage, setWitness: (value) => { witness = value; } };
}

async function signaturePng() {
  return sharp(Buffer.from('<svg width="240" height="100"><path d="M20 65 Q50 0 65 55 T110 50 Q140 10 150 65 L210 40" fill="none" stroke="#203854" stroke-width="4"/></svg>')).png().toBuffer();
}
/** A lease signed by both parties and the witness, not generated yet. */
async function readyToGenerate(overrides = {}) {
  const h = harness({ status: 'awaiting_signatures', document_url: null, ...overrides });
  const png = await signaturePng();
  for (const path of ['7/11/signatures/owner.png', '7/11/signatures/tenant.png', '7/11/signatures/w.png']) h.objects.set(path, { buffer: png });
  h.setWitness({ signature_url: '7/11/signatures/w.png', signer_name: 'Witness C', signed_by: null });
  return h;
}

test('generating a lease issues its deposit invoice in the landlord\'s name, once', async () => atBangkokOct21(async () => {
  const h = await readyToGenerate();
  const result = await h.service.leaseAgreementPdf(7, 11, true);
  assert.equal(result.leaseAgreementStatus, 'ready');
  assert.equal(h.row.status, 'active');
  assert.equal(h.invoices.length, 1);
  const invoice = h.invoices[0];
  assert.deepEqual(
    { kind: invoice.invoice_kind, issuer: invoice.issuer_party, lease: invoice.lease_contract_id, tenant: invoice.tenant_id, agent: invoice.created_by_user_id,
      no: invoice.document_no, amount: invoice.amount, due: invoice.due_date, issued: invoice.issue_date, customer: invoice.customer_name },
    { kind: 'deposit', issuer: 'landlord', lease: 11, tenant: 2, agent: 7,
      no: 'DEP-LS202600011', amount: '40000.00', due: '2099-01-01', issued: '2026-10-21', customer: 'Tenant B' });
  const data = invoice.data;
  assert.equal(data.issuerName, 'Landlord A', 'issued by the landlord, not NESTYK');
  assert.equal(data.issuerAddress, '9 Owner Rd');
  assert.equal(data.issuerEmail, '', 'an invalid e-mail in the form is left out instead of failing the invoice');
  assert.equal(data.customerAddress, '5 Tenant Rd');
  assert.equal(data.reference, 'LS202600011');
  assert.deepEqual(data.items, [{ description: 'เงินประกันการเช่า Aria ห้อง 1201', quantity: 1, unitPrice: 40000 }]);
  assert.equal(data.paymentDetails, 'KBank Landlord A 123-4-56789-0', 'paid into the landlord\'s account from the lease');
  assert.match(invoice.pdf_path, /^7\/invoices\/.+\.pdf$/);
  assert.equal(h.objects.get(invoice.pdf_path).buffer.subarray(0, 5).toString(), '%PDF-');
  assert.deepEqual(result.depositPayment, {
    status: 'unpaid', total: 40000, invoiceId: invoice.id, invoiceDocumentNo: 'DEP-LS202600011', dueDate: '2099-01-01',
    invoiceUrl: `https://signed.example/${invoice.pdf_path}`, receiptDocumentNo: null, receiptUrl: null, paymentSlipUrl: null, submittedAt: null,
  });
  assert.deepEqual(h.saves, ['in the transaction']);
  // The lease is locked before looking for an invoice again, so a second request waits and then finds this one.
  const issuing = h.events.slice(h.events.lastIndexOf('lock LeaseContractEntity'));
  assert.deepEqual(issuing, ['lock LeaseContractEntity', 'find invoice']);
  // Asking again (or generating again) issues nothing new.
  const files = h.objects.size;
  const again = await h.service.issueDepositInvoice(7, 11);
  assert.equal(h.invoices.length, 1);
  assert.equal(h.objects.size, files, 'no second PDF');
  assert.equal(again.depositPayment.invoiceId, invoice.id);
}));

test('a deposit of 0 (or none) issues no invoice and shows no deposit card', async () => {
  for (const deposit of ['0.00', null]) {
    const h = await readyToGenerate({ deposit });
    const result = await h.service.leaseAgreementPdf(7, 11, true);
    assert.equal(h.row.status, 'active');
    assert.equal(h.invoices.length, 0);
    assert.equal(result.depositPayment, null);
    await assert.rejects(() => h.service.issueDepositInvoice(7, 11), (e) => e.getStatus() === 400 && /ไม่มีเงินประกัน/.test(e.message));
    assert.equal(h.invoices.length, 0);
  }
});

test('nothing is issued before the lease is generated, for a preview, for another agent, or for a closed lease', async () => {
  const preview = await readyToGenerate();
  const result = await preview.service.leaseAgreementPdf(7, 11, false);
  assert.match(preview.row.document_url, /mock\/lease_agreement/);
  assert.equal(preview.invoices.length, 0);
  assert.equal(result.depositPayment, null);
  await assert.rejects(() => preview.service.issueDepositInvoice(7, 11), (e) => e.getStatus() === 400 && /หลังสร้างเอกสารสัญญาเช่า/.test(e.message));
  const reservation = harness({ agreement_type_code: 'reservation', agreement_type: { form_kind: 'reservation' }, template: { form_kind: 'reservation' } });
  await assert.rejects(() => reservation.service.issueDepositInvoice(7, 11), (e) => e.getStatus() === 400);
  const other = harness();
  await assert.rejects(() => other.service.issueDepositInvoice(8, 11), (e) => e.getStatus() === 404);
  for (const status of ['terminated', 'expired']) {
    const closed = harness({ status });
    await assert.rejects(() => closed.service.issueDepositInvoice(7, 11), (e) => e.getStatus() === 400);
    assert.equal(closed.invoices.length, 0);
    assert.equal(closed.objects.size, 0, 'no PDF uploaded');
  }
});

test('if issuing fails the lease is still generated, shows "not issued", and the agent issues it again', async () => {
  const h = await readyToGenerate();
  const upload = h.storage.uploadStandaloneInvoice.bind(h.storage);
  h.storage.uploadStandaloneInvoice = async () => { throw new Error('storage down'); };
  const result = await h.service.leaseAgreementPdf(7, 11, true);
  assert.equal(result.leaseAgreementStatus, 'ready');
  assert.equal(h.row.status, 'active');
  assert.equal(h.invoices.length, 0);
  assert.equal(result.depositPayment.status, 'not_issued');
  assert.equal(result.depositPayment.total, 40000);
  assert.equal(result.depositPayment.invoiceId, null);
  // A failed save removes the uploaded PDF.
  h.storage.uploadStandaloneInvoice = upload;
  h.hooks.beforeSave = async () => { throw new Error('DB failure'); };
  await assert.rejects(() => h.service.issueDepositInvoice(7, 11), /DB failure/);
  assert.equal(h.removed.length, 1);
  assert.equal(h.objects.has(h.removed[0]), false);
  h.hooks.beforeSave = null;
  const issued = await h.service.issueDepositInvoice(7, 11);
  assert.equal(issued.depositPayment.status, 'unpaid');
  assert.equal(h.invoices.length, 1);
});

test('two requests at once still give one invoice, and the extra PDF is removed', async () => {
  // The second request finds the first invoice once it gets the lease lock.
  const waited = harness();
  waited.hooks.inTransaction = async () => {
    waited.hooks.inTransaction = null;
    waited.invoices.push({ id: 50, invoice_kind: 'deposit', lease_contract_id: 11, document_no: 'DEP-LS202600011', pdf_path: '7/invoices/first.pdf', data: invoiceData, due_date: '2099-01-01' });
  };
  const view = await waited.service.issueDepositInvoice(7, 11);
  assert.deepEqual(waited.saves, [], 'found after taking the lock, so nothing is saved');
  assert.equal(waited.invoices.length, 1);
  assert.equal(view.depositPayment.invoiceId, 50);
  assert.equal(waited.removed.length, 1, 'our PDF is not used');
  assert.match(waited.removed[0], /^7\/invoices\//);
  // The unique index catches an insert that slipped past the check.
  const raced = harness();
  raced.hooks.beforeSave = async () => {
    raced.hooks.beforeSave = null;
    raced.invoices.push({ id: 51, invoice_kind: 'deposit', lease_contract_id: 11, document_no: 'DEP-LS202600011', pdf_path: '7/invoices/first.pdf', data: invoiceData, due_date: '2099-01-01' });
  };
  const result = await raced.service.issueDepositInvoice(7, 11);
  assert.equal(raced.invoices.length, 1);
  assert.equal(result.depositPayment.invoiceId, 51);
  assert.equal(raced.removed.length, 1);
});

test('a lease that already started is due on the issue date', async () => atBangkokOct21(async () => {
  const h = harness({ start_date: '2020-01-01' });
  await h.service.issueDepositInvoice(7, 11);
  assert.equal(h.invoices[0].issue_date, '2026-10-21');
  assert.equal(h.invoices[0].due_date, '2026-10-21');
}));

test('a lease changed while issuing gets no invoice (409) and the PDF is removed', async () => {
  for (const change of [{ deposit: '45000.00' }, { document_url: '7/11/generated/lease_agreement/v1/other.pdf' }]) {
    const h = harness();
    h.hooks.inTransaction = async () => { Object.assign(h.row, change); };
    await assert.rejects(() => h.service.issueDepositInvoice(7, 11), (e) => e.getStatus() === 409);
    assert.equal(h.invoices.length, 0);
    assert.equal(h.removed.length, 1);
    assert.equal(h.objects.has(h.removed[0]), false);
  }
});

test('each lease in a list gets its own deposit invoice', async () => {
  const second = leaseRow({ id: 12, contract_no: 'LS202600012', deposit: '30000.00', document_url: '7/12/generated/lease_agreement/v1/lease.pdf',
    owner_signature_url: '7/12/signatures/owner.png', tenant_signature_url: '7/12/signatures/tenant.png' });
  const h = harness({}, [second]);
  await h.service.issueDepositInvoice(7, 11);
  const listed = await h.service.list(7);
  assert.deepEqual(listed.map((c) => [c.id, c.depositPayment.status, c.depositPayment.invoiceDocumentNo, c.depositPayment.total]),
    [[11, 'unpaid', 'DEP-LS202600011', 40000], [12, 'not_issued', null, 30000]]);
  const mine = await h.service.listForUser(8);
  assert.deepEqual(mine.map((c) => [c.id, c.depositPayment.status]), [[11, 'unpaid'], [12, 'not_issued']]);
});

test('satang in the deposit are kept, a missing contract number uses the one the app shows, other templates get no deposit', async () => {
  const h = harness({ deposit: '12500.50', contract_no: null });
  const view = await h.service.issueDepositInvoice(7, 11);
  assert.equal(h.invoices[0].amount, '12500.50');
  assert.equal(h.invoices[0].data.items[0].unitPrice, 12500.5);
  assert.equal(h.invoices[0].document_no, `DEP-${view.contractNo}`);
  assert.equal(view.contractNo, 'EC-11');
  assert.equal(view.depositPayment.total, 12500.5);
  const custom = harness({ template: { form_kind: 'lease', document_template_key: 'lease/custom' }, document_url: '7/11/custom.pdf' });
  assert.equal((await custom.service.view(7, 11)).depositPayment, null);
  await assert.rejects(() => custom.service.issueDepositInvoice(7, 11), (e) => e.getStatus() === 400);
  await assert.rejects(() => custom.service.financialDocumentForParty(8, 11, 'deposit-invoice'), (e) => e.getStatus() === 404);
});

test('tenant and landlord open the deposit documents; only the tenant sends the slip', async () => {
  const h = harness();
  await h.service.issueDepositInvoice(7, 11);
  const invoice = h.invoices[0];
  for (const user of [8, 9]) assert.equal((await h.service.financialDocumentForParty(user, 11, 'deposit-invoice')).url, `https://signed.example/${invoice.pdf_path}`);
  await assert.rejects(() => h.service.financialDocumentForParty(99, 11, 'deposit-invoice'), (e) => e.getStatus() === 404);
  await assert.rejects(() => h.service.financialDocumentForParty(8, 11, 'deposit-receipt'), (e) => e.getStatus() === 404, 'no receipt yet');
  await assert.rejects(() => h.service.financialDocumentForParty(8, 11, 'deposit-other'), (e) => e.getStatus() === 404);
  const mine = await h.service.listForUser(8);
  assert.equal(mine[0].depositPayment.status, 'unpaid');
  // The landlord cannot send it, the tenant can and can replace it.
  await assert.rejects(() => h.service.uploadDepositPaymentSlip(9, 11, slip), (e) => e.getStatus() === 403);
  const sent = await h.service.uploadDepositPaymentSlip(8, 11, slip);
  assert.deepEqual(sent.myParties, ['tenant']);
  assert.equal(sent.depositPayment.status, 'submitted');
  const first = invoice.payment_slip_path;
  assert.match(first, /^7\/payment-slips\/.+\.jpg$/);
  assert.ok(invoice.slip_submitted_at instanceof Date);
  assert.equal(sent.depositPayment.paymentSlipUrl, `https://signed.example/${first}`);
  assert.equal(sent.depositPayment.submittedAt, invoice.slip_submitted_at.toISOString());
  // The lease is locked first, then the invoice (the same order as issuing, so the two cannot wait on each other).
  assert.deepEqual(h.events.slice(h.events.lastIndexOf('lock LeaseContractEntity')), ['lock LeaseContractEntity', 'lock AgentInvoiceEntity', 'find invoice']);
  await h.service.uploadDepositPaymentSlip(8, 11, slip);
  assert.notEqual(invoice.payment_slip_path, first);
  assert.ok(h.removed.includes(first), 'the replaced slip is removed');
  assert.equal((await h.service.financialDocumentForParty(9, 11, 'deposit-payment-slip')).url, `https://signed.example/${invoice.payment_slip_path}`);
});

test('no slip without a deposit invoice, after the receipt, for a closed lease, or for someone not on the lease', async () => {
  const none = harness();
  await assert.rejects(() => none.service.uploadDepositPaymentSlip(8, 11, slip), (e) => e.getStatus() === 400 && /ยังไม่มีใบแจ้งหนี้เงินประกัน/.test(e.message));
  for (const [user, patch, status] of [[99, {}, 404], [8, { tenant_delivered_at: null }, 404], [8, { status: 'terminated' }, 400], [8, { status: 'expired' }, 400]]) {
    const h = harness();
    await h.service.issueDepositInvoice(7, 11);
    Object.assign(h.row, patch);
    const files = h.objects.size;
    await assert.rejects(() => h.service.uploadDepositPaymentSlip(user, 11, slip), (e) => e.getStatus() === status);
    assert.equal(h.invoices[0].payment_slip_path, null);
    assert.equal(h.objects.size, files, 'nothing uploaded');
  }
  // The same checks run again inside the transaction, with the lease locked: a lease closed, undelivered or
  // given to another tenant meanwhile takes no slip, and the uploaded file is removed.
  for (const [patch, status] of [[{ status: 'terminated' }, 400], [{ tenant_delivered_at: null }, 404], [{ tenant_id: 3 }, 404], [{ tenant: { id: 2, name: 'Tenant B', user_id: 99 } }, 404]]) {
    const h = harness();
    await h.service.issueDepositInvoice(7, 11);
    h.hooks.inTransaction = async () => { Object.assign(h.row, patch); };
    await assert.rejects(() => h.service.uploadDepositPaymentSlip(8, 11, slip), (e) => e.getStatus() === status);
    assert.equal(h.invoices[0].payment_slip_path, null);
    assert.equal(h.removed.length, 1);
    assert.equal(h.objects.has(h.removed[0]), false);
    assert.equal(h.events.at(-1), 'lock LeaseContractEntity', 'the lease is locked and checked before the invoice');
  }
  // The receipt is issued while the tenant uploads: the new slip is removed and the receipt stays.
  const h = harness();
  await h.service.issueDepositInvoice(7, 11);
  h.hooks.inTransaction = async () => { h.invoices[0].receipt_pdf_path = '7/receipts/r.pdf'; };
  await assert.rejects(() => h.service.uploadDepositPaymentSlip(8, 11, slip), (e) => e.getStatus() === 409);
  assert.equal(h.invoices[0].payment_slip_path, null);
  assert.equal(h.removed.length, 1);
  h.hooks.inTransaction = null;
  await assert.rejects(() => h.service.uploadDepositPaymentSlip(8, 11, slip), (e) => e.getStatus() === 400 && /ออกใบเสร็จแล้ว/.test(e.message));
});

test('the agent issues the deposit receipt REC-DEP-<no> from the tenant\'s slip; the invoice menu does not list deposits', async () => {
  const h = harness();
  await h.service.issueDepositInvoice(7, 11);
  await h.service.uploadDepositPaymentSlip(8, 11, slip);
  const invoice = h.invoices[0];
  const tenantSlip = invoice.payment_slip_path;
  const defaults = await h.service.receiptDefaults(7, invoice.id);
  assert.equal(defaults.documentNo, 'REC-DEP-LS202600011');
  assert.equal(defaults.reference, 'DEP-LS202600011');
  const receipt = await h.service.createReceiptForInvoice(7, invoice.id, { documentNo: 'HACKED', paymentMethod: '', receiverName: 'Agent', notes: '' });
  assert.equal(invoice.receipt_document_no, 'REC-DEP-LS202600011');
  assert.equal(receipt.receiptDocumentNo, 'REC-DEP-LS202600011');
  assert.equal(invoice.payment_slip_path, tenantSlip, 'the tenant\'s slip is the evidence');
  assert.equal(invoice.receipt_data.issuerName, 'Landlord A');
  assert.equal(invoice.receipt_data.items[0].unitPrice, 40000);
  const view = await h.service.view(7, 11);
  assert.equal(view.depositPayment.status, 'paid');
  assert.equal(view.depositPayment.receiptDocumentNo, 'REC-DEP-LS202600011');
  assert.equal(view.depositPayment.receiptUrl, `https://signed.example/${invoice.receipt_pdf_path}`);
  assert.equal((await h.service.financialDocumentForParty(8, 11, 'deposit-receipt')).url, `https://signed.example/${invoice.receipt_pdf_path}`);
  // Only general invoices are listed in the invoice menu.
  h.invoices.push({ id: 7001, created_by_user_id: 7, invoice_kind: 'general', document_no: 'INV2026-0001', customer_name: 'X', issue_date: '2026-10-21',
    data: invoice.data, pdf_path: '7/invoices/g.pdf', receipt_pdf_path: null, payment_slip_path: null, tenant_id: null });
  const listed = await h.service.listStandaloneInvoices(7);
  assert.deepEqual(listed.map((row) => row.id), [7001]);
});

test('a deposit receipt without a slip on file, and a general invoice without a slip, are still refused', async () => {
  const h = harness();
  await h.service.issueDepositInvoice(7, 11);
  const files = h.objects.size;
  await assert.rejects(() => h.service.createReceiptForInvoice(7, h.invoices[0].id, { paymentMethod: '', receiverName: 'Agent' }), (e) => e.getStatus() === 400 && /แนบสลิป/.test(e.message));
  h.invoices.push({ id: 7002, created_by_user_id: 7, invoice_kind: 'general', document_no: 'INV2026-0002', customer_name: 'X', issue_date: '2026-10-21',
    data: h.invoices[0].data, pdf_path: '7/invoices/g.pdf', receipt_pdf_path: null, receipt_document_no: null, payment_slip_path: '7/payment-slips/agent.jpg', tenant_id: null });
  await assert.rejects(() => h.service.createReceiptForInvoice(7, 7002, { paymentMethod: '', receiverName: 'Agent' }), (e) => e.getStatus() === 400 && /แนบสลิป/.test(e.message),
    'an old slip on a general invoice is not reused');
  assert.equal(h.objects.size, files);
  assert.equal(h.invoices[0].receipt_pdf_path, null);
});

test('routes: the agent issues again at POST /agent/contracts/:id/deposit-invoice, the tenant sends the slip at POST /contracts/mine/:id/deposit-payment-slip', () => {
  assert.equal(Reflect.getMetadata('path', AgentContractsController.prototype.issueDepositInvoice), ':id/deposit-invoice');
  assert.equal(Reflect.getMetadata('method', AgentContractsController.prototype.issueDepositInvoice), 1); // POST
  assert.equal(Reflect.getMetadata('path', PartyContractsController.prototype.depositPaymentSlip), 'mine/:id/deposit-payment-slip');
  assert.equal(Reflect.getMetadata('method', PartyContractsController.prototype.depositPaymentSlip), 1);
  assert.ok(Reflect.getMetadata('__interceptors__', PartyContractsController.prototype.depositPaymentSlip)?.length, 'reads one uploaded file');
});

test('the tenant\'s slip is kept: the agent cannot attach another slip over it, but can when the tenant sent none', async () => {
  const h = harness();
  await h.service.issueDepositInvoice(7, 11);
  await h.service.uploadDepositPaymentSlip(8, 11, slip);
  const invoice = h.invoices[0];
  const tenantSlip = invoice.payment_slip_path;
  const sentAt = invoice.slip_submitted_at;
  const files = h.objects.size;
  await assert.rejects(() => h.service.createReceiptForInvoice(7, invoice.id, { paymentMethod: '', receiverName: 'Agent' }, slip),
    (e) => e.getStatus() === 400 && /ผู้เช่าส่งสลิปแล้ว/.test(e.message));
  assert.equal(invoice.payment_slip_path, tenantSlip);
  assert.equal(invoice.slip_submitted_at, sentAt);
  assert.equal(invoice.receipt_pdf_path, null);
  assert.equal(h.objects.size, files, 'nothing uploaded');
  assert.ok(h.objects.has(tenantSlip), 'the tenant\'s slip is still stored');
  // The tenant paid in cash and sent no slip: the agent attaches one, and it is not counted as sent by the tenant.
  const cash = harness();
  await cash.service.issueDepositInvoice(7, 11);
  const receipt = await cash.service.createReceiptForInvoice(7, cash.invoices[0].id, { paymentMethod: '', receiverName: 'Agent' }, slip);
  assert.equal(receipt.receiptDocumentNo, 'REC-DEP-LS202600011');
  assert.match(cash.invoices[0].payment_slip_path, /^7\/payment-slips\//);
  assert.equal(cash.invoices[0].slip_submitted_at, null);
  assert.equal((await cash.service.view(7, 11)).depositPayment.submittedAt, null);
});

test('a slip the tenant sends while the agent is making the receipt is kept, and the agent\'s slip is removed', async () => {
  const h = harness();
  await h.service.issueDepositInvoice(7, 11);
  const tenantSlip = '7/payment-slips/tenant.jpg';
  h.objects.set(tenantSlip, { buffer: jpeg });
  h.hooks.inTransaction = async () => {
    Object.assign(h.invoices[0], { payment_slip_path: tenantSlip, slip_submitted_at: new Date('2026-10-21T03:00:00Z') });
  };
  await assert.rejects(() => h.service.createReceiptForInvoice(7, h.invoices[0].id, { paymentMethod: '', receiverName: 'Agent' }, slip),
    (e) => e.getStatus() === 400 && /ผู้เช่าส่งสลิปแล้ว/.test(e.message));
  assert.equal(h.invoices[0].payment_slip_path, tenantSlip);
  assert.equal(h.invoices[0].receipt_pdf_path, null);
  assert.ok(h.objects.has(tenantSlip), 'the tenant\'s slip is still stored');
  assert.equal(h.removed.length, 1);
  assert.notEqual(h.removed[0], tenantSlip, 'only the agent\'s uploaded slip is removed');
});

test('no deposit receipt once the lease is closed, also when it closes while the receipt is being made', async () => {
  for (const status of ['terminated', 'expired', 'cancelled']) {
    // The tenant paid in cash, so the agent attaches a slip: refused before the slip is even uploaded.
    const h = harness();
    await h.service.issueDepositInvoice(7, 11);
    h.row.status = status;
    const files = h.objects.size;
    await assert.rejects(() => h.service.createReceiptForInvoice(7, h.invoices[0].id, { paymentMethod: '', receiverName: 'Agent' }, slip),
      (e) => e.getStatus() === 400 && /สัญญาเช่าปิดแล้ว/.test(e.message), status);
    assert.equal(h.invoices[0].receipt_pdf_path, null);
    assert.equal(h.objects.size, files, 'nothing uploaded');
    assert.deepEqual(h.removed, [], 'nothing had to be removed: checked before uploading');
  }
  // Closed between the first check and the transaction: the lease is locked and checked again, the slip the agent
  // attached is removed and no receipt is made.
  const h = harness();
  await h.service.issueDepositInvoice(7, 11);
  h.hooks.inTransaction = async () => { h.row.status = 'terminated'; };
  await assert.rejects(() => h.service.createReceiptForInvoice(7, h.invoices[0].id, { paymentMethod: '', receiverName: 'Agent' }, slip),
    (e) => e.getStatus() === 400 && /สัญญาเช่าปิดแล้ว/.test(e.message));
  assert.equal(h.invoices[0].receipt_pdf_path, null);
  assert.equal(h.invoices[0].payment_slip_path, null);
  assert.equal(h.removed.length, 1);
  assert.match(h.removed[0], /^7\/payment-slips\//);
  assert.deepEqual(h.events.slice(h.events.lastIndexOf('lock LeaseContractEntity')), ['lock LeaseContractEntity', 'find invoice'],
    'the lease is locked before the invoice');
});
