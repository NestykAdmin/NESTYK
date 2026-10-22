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
const { AgreementDocumentEntity } = require('../src/entities/agreement-document.entity.ts');
const { UserEntity } = require('../src/entities/user.entity.ts');

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
  // Invoices another request committed: a rollback of our transaction keeps them.
  const committedElsewhere = [];
  const events = [];
  // Locks and lease updates with the number of the transaction they happened in (tx1, tx2, ...).
  const txEvents = [];
  let tx = 0, txCount = 0;
  const saves = [];
  // D11: attachments of the agreements (the power of attorney) and the lookups made for them.
  const docs = [];
  const docQueries = [];
  const qbFor = () => {
    let scope = null, hidesCancelled = false;
    const qb = {};
    for (const key of ['leftJoinAndSelect', 'andWhere', 'orderBy']) qb[key] = () => qb;
    // The parties' inbox query leaves out cancelled leases (c.status <> 'cancelled'), like Postgres.
    qb.where = (sql, params) => { scope = params ?? null; hidesCancelled = /c\.status <> 'cancelled'/.test(sql); return qb; };
    const visible = (value) => !(scope && 'agentId' in scope && scope.agentId !== value.created_by_user_id) && !(hidesCancelled && value.status === 'cancelled');
    qb.getOne = async () => (visible(row) ? structuredClone(row) : null);
    qb.getMany = async () => [row, ...others].filter(visible).map((value) => structuredClone(value));
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
    find: async (entity, { where }) => {
      if (entity === LeaseContractEntity) return [row, ...others].filter((value) => matches(value, where)).map((value) => structuredClone(value));
      assert.equal(entity, AgreementDocumentEntity);
      docQueries.push(where.agreement_id.value);
      return docs.filter((doc) => where.agreement_id.value.includes(doc.agreement_id));
    },
    findOne: async (entity, options) => {
      if (entity === UserEntity) return options.where.id === 7 ? { id: 7, first_name: 'Agent', last_name: 'Seven' } : null;
      if (options.lock) { locks.push([entity.name, options.lock.mode]); events.push(`lock ${entity.name}`); txEvents.push(`tx${tx}:lock ${entity.name}`); }
      if (entity === LeaseContractEntity) {
        if (options.where.created_by_user_id !== undefined && options.where.created_by_user_id !== row.created_by_user_id) return null;
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
      // D7: the deposit receipt moves the lease from awaiting_deposit to awaiting_handover.
      if (entity === LeaseContractEntity) {
        events.push(`update lease ${JSON.stringify(where)}`);
        txEvents.push(`tx${tx}:update lease ${JSON.stringify(where)}`);
        if (matches(row, where)) Object.assign(row, patch);
        return;
      }
      assert.equal(entity, AgentInvoiceEntity);
      Object.assign(invoices.find((invoice) => invoice.id === where.id), patch);
    },
  };
  const db = {
    getRepository: repoFor,
    // Like Postgres: a failed transaction leaves the lease and the invoices as they were.
    transaction: async (fn) => {
      if (hooks.inTransaction) await hooks.inTransaction();
      // The same objects come back with their old values, so a test holding one still sees committed data.
      const before = { row: structuredClone(row), invoices: invoices.map((invoice) => [invoice, structuredClone(invoice)]) };
      tx = ++txCount;
      try {
        return await fn(manager);
      } catch (error) {
        for (const key of Object.keys(row)) delete row[key];
        Object.assign(row, before.row);
        for (const [invoice, saved] of before.invoices) {
          for (const key of Object.keys(invoice)) delete invoice[key];
          Object.assign(invoice, saved);
        }
        const kept = before.invoices.map(([invoice]) => invoice);
        invoices.splice(0, invoices.length, ...kept, ...committedElsewhere.filter((invoice) => !kept.includes(invoice)));
        throw error;
      } finally {
        tx = 0;
      }
    },
  };
  const service = new AgentContractsService(db, storage);
  service.logger = { warn: () => undefined };
  return { service, row, invoices, objects, removed, locks, events, txEvents, saves, hooks, storage, docs, docQueries,
    commitElsewhere: (invoice) => { committedElsewhere.push(invoice); invoices.push(invoice); }, setWitness: (value) => { witness = value; } };
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
  assert.equal(h.row.status, 'awaiting_deposit', 'D7: a generated lease with a deposit waits for the deposit receipt');
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
    invoiceUrl: `https://signed.example/${invoice.pdf_path}`, receiptDocumentNo: null, receiptUrl: null, paymentSlipUrl: null, submittedAt: null, slipReturnReason: null,
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
    assert.equal(h.row.status, 'awaiting_handover', 'D7: without a deposit the lease waits for the handover');
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
  assert.equal(h.row.status, 'awaiting_deposit', 'D7: still generated, waiting for the deposit');
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
    raced.commitElsewhere({ id: 51, invoice_kind: 'deposit', lease_contract_id: 11, document_no: 'DEP-LS202600011', pdf_path: '7/invoices/first.pdf', data: invoiceData, due_date: '2099-01-01' });
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
  // D11: the landlord received the deposit (the default); the receiver name the agent typed is not used.
  assert.equal(invoice.receipt_data.receiverName, 'Landlord A');
  assert.equal(invoice.receipt_data.receivedBy, 'landlord');
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

test('D7: the deposit receipt moves a lease waiting for its deposit to waiting for the handover; an active lease stays active', async () => {
  for (const [status, after] of [['awaiting_deposit', 'awaiting_handover'], ['active', 'active'], ['awaiting_handover', 'awaiting_handover']]) {
    const h = harness({ status });
    await h.service.issueDepositInvoice(7, 11);
    await h.service.uploadDepositPaymentSlip(8, 11, slip);
    h.txEvents.length = 0;
    await h.service.createReceiptForInvoice(7, h.invoices[0].id, { paymentMethod: '', receiverName: 'Agent', notes: '' });
    assert.equal(h.row.status, after, status);
    if (status === 'awaiting_deposit') {
      // The same transaction locks the lease and then moves it (tx<n>: tags the transaction number).
      const lock = h.txEvents.find((e) => /^tx\d+:lock LeaseContractEntity$/.test(e));
      const update = h.txEvents.find((e) => /^tx\d+:update lease/.test(e));
      assert.ok(lock && update, h.txEvents.join(', '));
      assert.equal(lock.split(':')[0], update.split(':')[0], 'the lock and the update are in the same transaction');
      assert.ok(h.txEvents.indexOf(update) > h.txEvents.indexOf(lock), 'the lease is locked before it is moved');
      assert.equal(update.slice(update.indexOf(':') + 1), 'update lease {"id":11,"status":"awaiting_deposit"}');
    }
  }
  // The receipt fails after the status update (saving the invoice throws): the whole transaction is undone.
  const h = harness({ status: 'awaiting_deposit' });
  await h.service.issueDepositInvoice(7, 11);
  await h.service.uploadDepositPaymentSlip(8, 11, slip);
  h.hooks.beforeSave = async (value) => { if (value.receipt_pdf_path) throw new Error('save failed'); };
  await assert.rejects(() => h.service.createReceiptForInvoice(7, h.invoices[0].id, { paymentMethod: '', receiverName: 'Agent', notes: '' }), /save failed/);
  assert.ok(h.txEvents.some((e) => /^tx\d+:update lease/.test(e)), 'the update did run before the failure');
  assert.equal(h.row.status, 'awaiting_deposit', 'rolled back with the receipt');
  assert.equal(h.invoices[0].receipt_pdf_path, null);
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

test('D7: a cancelled deposit invoice shows as cancelled, keeps the slip to view, and takes no new slip or receipt', async () => {
  // Aof, 22 Oct 2026: the deposit is due by the move-in day. The lease was terminated while it still waited for the
  // deposit (contract-closure.ts sets voided_at). A lease closed as cancelled is not shown to the parties at all.
  const h = harness();
  await h.service.issueDepositInvoice(7, 11);
  await h.service.uploadDepositPaymentSlip(8, 11, slip);
  const invoice = h.invoices[0];
  const sentSlip = invoice.payment_slip_path;
  invoice.voided_at = new Date('2026-10-22T03:00:00Z');
  h.row.status = 'terminated';
  for (const user of [8, 9]) {
    const [mine] = await h.service.listForUser(user);
    assert.equal(mine.depositPayment.status, 'voided', `user ${user}`);
    assert.equal(mine.depositPayment.paymentSlipUrl, `https://signed.example/${sentSlip}`, 'the slip stays viewable');
    assert.equal(mine.depositPayment.receiptUrl, null);
  }
  h.row.status = 'cancelled';
  for (const user of [8, 9]) assert.deepEqual(await h.service.listForUser(user), [], 'a cancelled lease is hidden from the parties');
  assert.equal((await h.service.view(7, 11)).depositPayment.status, 'voided', 'the agent still sees it');
  // A cancelled invoice is checked before the lease, so the agent sees why.
  const files = h.objects.size;
  await assert.rejects(() => h.service.createReceiptForInvoice(7, invoice.id, { paymentMethod: '', receiverName: 'Agent' }, slip),
    (e) => e.getStatus() === 400 && /ถูกยกเลิกแล้ว/.test(e.message));
  await assert.rejects(() => h.service.createReceiptForInvoice(7, invoice.id, { paymentMethod: '', receiverName: 'Agent' }),
    (e) => e.getStatus() === 400 && /ถูกยกเลิกแล้ว/.test(e.message));
  assert.equal(invoice.receipt_pdf_path, null);
  assert.equal(h.objects.size, files, 'nothing uploaded');
  // Even if the lease were still open, a cancelled invoice takes no receipt and no new slip.
  h.row.status = 'awaiting_deposit';
  await assert.rejects(() => h.service.createReceiptForInvoice(7, invoice.id, { paymentMethod: '', receiverName: 'Agent' }),
    (e) => e.getStatus() === 400 && /ถูกยกเลิกแล้ว/.test(e.message));
  const before = h.objects.size;
  await assert.rejects(() => h.service.uploadDepositPaymentSlip(8, 11, slip), (e) => e.getStatus() === 409 && /ถูกยกเลิกแล้ว/.test(e.message));
  assert.equal(invoice.payment_slip_path, sentSlip, 'the slip is not replaced');
  assert.equal(h.objects.size, before, 'the refused slip file is removed');
  assert.equal(invoice.receipt_pdf_path, null);
});

/** D11: the slip the agent looked at (sent with the return, so a newer slip is not returned by mistake). */
const seen = (h) => (h.invoices[0]?.slip_submitted_at ? new Date(h.invoices[0].slip_submitted_at).toISOString() : undefined);

// D11 (AC-3.5): the agent receives the deposit only with a power of attorney on the lease or on its reservation.
const poa = (agreementId, patch = {}) => ({ id: 60 + agreementId, agreement_id: agreementId, document_type_code: 'power_of_attorney', subject: 'representative',
  removed_at: null, supersedes_document_id: null, review_status: 'pending', ...patch });
const reservation = (id, patch = {}) => leaseRow({ id, contract_no: `RS${id}`, status: 'active', template: { form_kind: 'reservation' },
  agreement_type: { form_kind: 'reservation' }, ...patch });
test('D11: the agent receives the deposit only with a power of attorney on the lease or on its reservation', async () => {
  const others = [reservation(5), reservation(6, { status: 'cancelled' }), reservation(7, { lead_id: 99 }), reservation(8, { rent_room_id: 99 }),
    leaseRow({ id: 9, contract_no: 'BA9', template: { form_kind: 'broker_appointment' }, agreement_type: { form_kind: 'broker_appointment' } }),
    reservation(10, { created_by_user_id: 70 })];
  const ready = async (docs) => {
    const h = harness({}, others);
    await h.service.issueDepositInvoice(7, 11);
    await h.service.uploadDepositPaymentSlip(8, 11, slip);
    h.docs.push(...docs);
    return h;
  };
  for (const [label, docs] of [['none', []], ['cancelled reservation', [poa(6)]], ['another lead', [poa(7)]], ['another room', [poa(8)]],
    ['broker appointment', [poa(9)]], ['another agent', [poa(10)]], ['rejected on the lease', [poa(11, { review_status: 'rejected' })]]]) {
    const h = await ready(docs);
    const files = h.objects.size;
    await assert.rejects(() => h.service.createReceiptForInvoice(7, h.invoices[0].id, { paymentMethod: '', receivedBy: 'agent' }),
      (e) => e.getStatus() === 400 && e.getResponse().code === 'POWER_OF_ATTORNEY_REQUIRED', label);
    assert.equal(h.invoices[0].receipt_pdf_path, null, label);
    assert.equal(h.objects.size, files, `${label}: no receipt file`);
    assert.deepEqual(h.docQueries, [[11, 5]], `${label}: the lease and its open reservation of the same lead and room`);
  }
  for (const docs of [[poa(11)], [poa(5)]]) {
    const h = await ready(docs);
    await h.service.createReceiptForInvoice(7, h.invoices[0].id, { paymentMethod: '', receivedBy: 'agent', receiverName: 'Typed' });
    assert.equal(h.invoices[0].receipt_data.receiverName, 'Agent Seven (ผู้รับมอบอำนาจ)', 'the agent\'s name from the account');
    assert.equal(h.invoices[0].receipt_data.receivedBy, 'agent');
  }
  const named = harness({ party_snapshot: { agentName: 'Agent On Lease' } });
  await named.service.issueDepositInvoice(7, 11);
  await named.service.uploadDepositPaymentSlip(8, 11, slip);
  named.docs.push(poa(11));
  await named.service.createReceiptForInvoice(7, named.invoices[0].id, { paymentMethod: '', receivedBy: 'agent' });
  assert.equal(named.invoices[0].receipt_data.receiverName, 'Agent On Lease (ผู้รับมอบอำนาจ)');
  // No withholding tax on a deposit; an unknown receiver is refused.
  for (const body of [{ withholdingTax: '100' }, { receivedBy: 'tenant' }]) {
    const h = await ready([]);
    await assert.rejects(() => h.service.createReceiptForInvoice(7, h.invoices[0].id, { paymentMethod: '', ...body }), (e) => e.getStatus() === 400, JSON.stringify(body));
    assert.equal(h.invoices[0].receipt_pdf_path, null);
  }
  // A general invoice keeps the receiver the agent typed.
  const g = harness();
  await g.service.issueDepositInvoice(7, 11);
  g.invoices.push({ id: 7003, created_by_user_id: 7, invoice_kind: 'general', issuer_party: 'agent', document_no: 'INV2026-0003', customer_name: 'X', issue_date: '2026-10-21',
    data: { ...g.invoices[0].data, issuerName: 'NESTYK' }, pdf_path: '7/invoices/g.pdf', receipt_pdf_path: null, receipt_document_no: 'REC2026-0009', payment_slip_path: null, tenant_id: null });
  await g.service.createReceiptForInvoice(7, 7003, { paymentMethod: 'cash', receiverName: 'Typed Name', receivedBy: 'agent' });
  assert.equal(g.invoices.find((row) => row.id === 7003).receipt_data.receiverName, 'Typed Name');
  assert.equal(g.invoices.find((row) => row.id === 7003).receipt_data.receivedBy, undefined);
  assert.deepEqual(g.docQueries, [], 'no power of attorney check for a general invoice');
});

test('D11 (AC-5.4): the agent returns the tenant\'s deposit slip with a reason, and the tenant sends a new one', async () => {
  const h = harness();
  await h.service.issueDepositInvoice(7, 11);
  await h.service.uploadDepositPaymentSlip(8, 11, slip);
  const invoice = h.invoices[0];
  const sent = invoice.payment_slip_path;
  const view = await h.service.returnDepositSlip(7, 11, { reason: ' สลิปอ่านไม่ออก ', submittedAt: seen(h) });
  assert.equal(view.depositPayment.status, 'unpaid');
  assert.equal(view.depositPayment.slipReturnReason, 'สลิปอ่านไม่ออก');
  assert.equal(view.depositPayment.paymentSlipUrl, null);
  assert.equal(invoice.payment_slip_path, null);
  assert.equal(invoice.slip_submitted_at, null);
  assert.ok(h.removed.includes(sent), 'the returned slip file is removed');
  assert.deepEqual(h.locks.slice(-2), [['LeaseContractEntity', 'pessimistic_write'], ['AgentInvoiceEntity', 'pessimistic_write']], 'the lease is locked before the invoice');
  const [mine] = await h.service.listForUser(8);
  assert.equal(mine.depositPayment.slipReturnReason, 'สลิปอ่านไม่ออก', 'the tenant sees why');
  await h.service.uploadDepositPaymentSlip(8, 11, slip);
  assert.equal(invoice.slip_return_note, null, 'a new slip clears the reason');
  assert.equal((await h.service.view(7, 11)).depositPayment.status, 'submitted');
  assert.equal((await h.service.view(7, 11)).depositPayment.slipReturnReason, null);
  // Paid another way after the return: the agent attaches the slip with the receipt, so the reason is no longer shown.
  const other = harness();
  await other.service.issueDepositInvoice(7, 11);
  await other.service.uploadDepositPaymentSlip(8, 11, slip);
  await other.service.returnDepositSlip(7, 11, { reason: 'โอนผิดบัญชี', submittedAt: seen(other) });
  await other.service.createReceiptForInvoice(7, other.invoices[0].id, { paymentMethod: '' }, slip);
  const paid = await other.service.view(7, 11);
  assert.equal(paid.depositPayment.status, 'paid');
  assert.equal(paid.depositPayment.slipReturnReason, null);
});

test('D11: no deposit slip return without a reason, for the agent\'s own slip, after the receipt, for a cancelled invoice or a closed lease', async () => {
  const sentHarness = async (overrides) => {
    const h = harness(overrides);
    await h.service.issueDepositInvoice(7, 11);
    await h.service.uploadDepositPaymentSlip(8, 11, slip);
    return h;
  };
  for (const body of [{}, { reason: ' ' }, { reason: 'x'.repeat(501) }]) {
    const h = await sentHarness();
    await assert.rejects(() => h.service.returnDepositSlip(7, 11, { ...body, submittedAt: seen(h) }), (e) => e.getStatus() === 400 && /เหตุผล/.test(e.message));
    assert.ok(h.invoices[0].payment_slip_path);
  }
  const none = harness();
  await assert.rejects(() => none.service.returnDepositSlip(7, 11, { reason: 'x' }), (e) => e.getStatus() === 400 && /ยังไม่มีใบแจ้งหนี้/.test(e.message));
  // The agent attached the slip itself (no tenant slip): nothing for the tenant to resend.
  const own = harness();
  await own.service.issueDepositInvoice(7, 11);
  own.invoices[0].payment_slip_path = '7/payment-slips/agent.jpg';
  await assert.rejects(() => own.service.returnDepositSlip(7, 11, { reason: 'x', submittedAt: seen(own) }), (e) => e.getStatus() === 400 && /ผู้เช่าส่ง/.test(e.message));
  const paid = await sentHarness();
  await paid.service.createReceiptForInvoice(7, paid.invoices[0].id, { paymentMethod: '' });
  await assert.rejects(() => paid.service.returnDepositSlip(7, 11, { reason: 'x', submittedAt: seen(paid) }), (e) => e.getStatus() === 400 && /ออกใบเสร็จแล้ว/.test(e.message));
  const voided = await sentHarness();
  voided.invoices[0].voided_at = new Date();
  await assert.rejects(() => voided.service.returnDepositSlip(7, 11, { reason: 'x', submittedAt: seen(voided) }), (e) => e.getStatus() === 400 && /ยกเลิกแล้ว/.test(e.message));
  for (const status of ['cancelled', 'expired', 'terminated']) {
    const closed = await sentHarness();
    closed.row.status = status;
    await assert.rejects(() => closed.service.returnDepositSlip(7, 11, { reason: 'x', submittedAt: seen(closed) }), (e) => e.getStatus() === 400, status);
    assert.ok(closed.invoices[0].payment_slip_path, status);
  }
  const stranger = await sentHarness();
  await assert.rejects(() => stranger.service.returnDepositSlip(70, 11, { reason: 'x', submittedAt: seen(stranger) }), (e) => e.getStatus() === 404,
    'another agent\'s lease is not found');
  assert.ok(stranger.invoices[0].payment_slip_path);
});

test('D11: a deposit slip the tenant sent after the agent looked is not returned (409) and is kept', async () => {
  for (const [label, at] of [['an older slip', '2026-10-20T03:00:00.000Z'], ['no slip time', undefined]]) {
    const h = harness();
    await h.service.issueDepositInvoice(7, 11);
    await h.service.uploadDepositPaymentSlip(8, 11, slip);
    const invoice = h.invoices[0];
    // The tenant's newer slip is saved just before the return's transaction.
    h.hooks.inTransaction = async () => { invoice.payment_slip_path = '7/payment-slips/newer.jpg'; invoice.slip_submitted_at = new Date('2026-10-22T05:00:00Z'); };
    const removedBefore = h.removed.length;
    await assert.rejects(() => h.service.returnDepositSlip(7, 11, { reason: 'ยอดไม่ตรง', submittedAt: at }),
      (e) => e.getStatus() === 409 && e.getResponse().code === 'SLIP_CHANGED', label);
    assert.equal(invoice.payment_slip_path, '7/payment-slips/newer.jpg', label);
    assert.equal(invoice.slip_return_note ?? null, null, label);
    assert.equal(h.removed.length, removedBefore, `${label}: no file removed`);
  }
});
