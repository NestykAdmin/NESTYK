const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { AgentContractsService } = require('../src/agent/contracts/agent-contracts.service.ts');
const { ContractDocumentStorageService } = require('../src/agent/contracts/contract-document-storage.service.ts');
const { PartyContractsController } = require('../src/agent/contracts/party-contracts.controller.ts');
const { AgreementAttachmentsService } = require('../src/agent/contracts/agreement-attachments.service.ts');
const { AuthService } = require('../src/auth/auth.service.ts');
const { AgentContractsController } = require('../src/agent/contracts/agent-contracts.controller.ts');
const { LeaseContractEntity } = require('../src/entities/lease-contract.entity.ts');
const { AgreementDocumentEntity } = require('../src/entities/agreement-document.entity.ts');
const { DealOfferEntity } = require('../src/entities/deal-offer.entity.ts');
const { AgreementSignInviteEntity } = require('../src/entities/agreement-sign-invite.entity.ts');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');

function fixture({ patch = {}, failUpdate = false, concurrentPatch, reassignTenant = false, docs = [], offer = null } = {}) {
  const invoice = {
    documentNo: 'INV-RS202600011', issueDate: '2026-10-01', dueDate: '2026-10-01', reference: 'RS202600011',
    customerName: 'Tenant', customerFirstName: 'Tenant', customerLastName: '', customerAddress: 'Project', customerTaxId: '', customerPhone: '0811111111', customerEmail: 'tenant@example.com',
    issuerName: 'NESTYK', issuerAddress: 'Bangkok', issuerTaxId: '', issuerPhone: '', issuerEmail: '',
    items: [{ description: 'ค่าจอง Project ห้อง A1', quantity: 1, unitPrice: 5000 }], vatRate: 0, discount: 0, paymentMethod: '', paymentDetails: 'Bank 123', receiverName: '', notes: '',
  };
  const row = {
    id: 11, created_by_user_id: 7, tenant_id: 2, lead_id: 1, contract_no: 'RS202600011', status: 'draft', start_date: '2026-10-01',
    agreement_type_code: 'reservation', template: { form_kind: 'reservation' }, agreement_type: { form_kind: 'reservation' },
    tenant: { id: 2, user_id: 8, name: 'Tenant' }, tenant_delivered_at: new Date(), owner_user_id: 9, owner_delivered_at: new Date(),
    rent_room: { room_id: 'A1', property: { name: 'Project' } }, reservation_fee: '5000',
    invoice_url: '7/11/invoice/a.pdf', receipt_url: null, data: { untouched: true, financialDocuments: { invoice } },
    party_snapshot: { ownerName: 'Owner A', agentName: 'Agent B' }, ...patch,
  };
  const uploaded = [], removed = [], updates = [], docQueries = [];
  const qb = {};
  for (const key of ['where', 'andWhere', 'leftJoinAndSelect', 'orderBy']) qb[key] = () => qb;
  qb.getOne = async () => structuredClone(row);
  qb.getMany = async () => [row];
  const repo = {
    createQueryBuilder: () => qb,
    findOne: async ({ where, lock }) => {
      assert.equal(where.created_by_user_id, 7);
      assert.equal(lock.mode, 'pessimistic_write');
      if (concurrentPatch) Object.assign(row, concurrentPatch);
      // A copy, like a row read from the database: later writes do not change what the service already read.
      return structuredClone(row);
    },
    update: async (where, update) => {
      if (failUpdate) throw new Error('DB failure');
      updates.push(update); Object.assign(row, update); return { affected: 1 };
    },
  };
  const documents = {
    uploadPaymentSlip: async (agentId, file) => {
      assert.equal(agentId, 7);
      assert.ok(file.buffer.length);
      const path = `7/payment-slips/${uploaded.length}.jpg`;
      uploaded.push(path); return { path };
    },
    upload: async (agentId, id, kind, file) => {
      assert.equal(file.buffer.subarray(0, 4).toString(), '%PDF');
      const path = `7/11/${kind}/${uploaded.length}.pdf`; uploaded.push(path); return { path };
    },
    remove: async path => removed.push(path),
    signPaths: async paths => new Map(paths.filter(Boolean).map(path => [path, `https://signed.example/${path}`])),
  };
  const db = {
    getRepository: () => repo,
    // D2 round 2: the deal's confirmed offer (looked up when a slip is returned).
    transaction: async fn => fn({ getRepository: (entity) => entity === DealOfferEntity
      ? { findOne: async ({ where }) => (offer && where.lead_id === row.lead_id && where.rent_room_id === row.rent_room_id && where.status === 'confirmed' ? offer : null) }
      : repo, findOneBy: async (_entity, where) => !reassignTenant && where.id === 2 && where.user_id === 8 ? row.tenant : null,
      // D11: the slip return locks the reservation; the power of attorney is looked up among its attachments.
      findOne: async (entity, options) => { assert.equal(entity, LeaseContractEntity); return repo.findOne(options); },
      update: async (entity, where, update) => {
        if (entity === AgreementSignInviteEntity) { updates.push({ invitesRevoked: where.agreement_id }); return; }
        assert.equal(entity, LeaseContractEntity); assert.deepEqual(where, { id: 11 }); return repo.update(where, update);
      },
      find: async (entity, { where }) => {
        assert.equal(entity, AgreementDocumentEntity);
        docQueries.push(where.agreement_id.value);
        return docs.filter(doc => where.agreement_id.value.includes(doc.agreement_id));
      },
    }),
  };
  return { service: new AgentContractsService(db, documents), row, uploaded, removed, updates, docQueries };
}
const file = { buffer: Buffer.from([0xff, 0xd8, 0xff]), size: 3, originalname: 'slip.jpg' };

test('tenant can read only their delivered invoice, receipt and slip, using private signed URLs', async () => {
  const f = fixture({ patch: { receipt_url: '7/11/receipt/a.pdf' } });
  f.row.data.reservationPayment = { slipPath: '7/payment-slips/a.jpg' };
  for (const [kind, path] of [['invoice', f.row.invoice_url], ['receipt', f.row.receipt_url], ['payment-slip', '7/payment-slips/a.jpg']]) {
    assert.equal((await f.service.financialDocumentForParty(8, 11, kind)).url, `https://signed.example/${path}`);
    await assert.rejects(() => f.service.financialDocumentForParty(99, 11, kind), e => e.getStatus() === 404);
  }
  await assert.rejects(() => f.service.financialDocumentForParty(8, 11, 'signatures'), e => e.getStatus() === 404);
  const undelivered = fixture({ patch: { tenant_delivered_at: null } });
  await assert.rejects(() => undelivered.service.financialDocumentForParty(8, 11, 'invoice'), e => e.getStatus() === 404);
});

test('tenant submits and replaces a slip without issuing a receipt or changing signing status', async () => {
  const f = fixture({ patch: { status: 'active', document_url: '7/11/generated/reservation_letter/letter-v1/a.pdf' } });
  const updated = await f.service.uploadReservationPaymentSlip(8, 11, file);
  assert.equal(updated.reservationPayment.status, 'submitted');
  assert.equal(updated.invoiceUrl, 'https://signed.example/7/11/invoice/a.pdf');
  assert.equal(updated.receiptUrl, null);
  assert.equal(updated.reservationPayment.paymentSlipUrl, 'https://signed.example/7/payment-slips/0.jpg');
  assert.deepEqual(updated.myParties, ['tenant']);
  assert.equal(f.row.status, 'active');
  assert.equal(f.row.data.untouched, true);
  assert.equal(f.row.data.reservationPayment.submittedBy, 8);
  assert.ok(f.row.payment_submitted_at instanceof Date);
  await f.service.uploadReservationPaymentSlip(8, 11, file);
  assert.deepEqual(f.removed, ['7/payment-slips/0.jpg']);
  assert.equal(f.row.data.reservationPayment.slipPath, '7/payment-slips/1.jpg');
});

test('strangers, owners, undelivered tenants and closed/non-reservation/receipted records upload nothing', async () => {
  for (const [userId, patch] of [
    [99, {}], [9, {}], [8, { tenant_delivered_at: null }],
    ...['cancelled', 'expired', 'terminated'].map(status => [8, { status }]),
    [8, { template: { form_kind: 'lease' } }], [8, { invoice_url: null }], [8, { receipt_url: 'receipt.pdf' }],
  ]) {
    const f = fixture({ patch });
    await assert.rejects(() => f.service.uploadReservationPaymentSlip(userId, 11, file));
    assert.equal(f.uploaded.length, 0);
    assert.equal(f.updates.length, 0);
  }
});

test('failed or stale uploads remove the new file and retain the original payment', async () => {
  for (const options of [{ failUpdate: true }, { reassignTenant: true }, { concurrentPatch: { invoice_url: 'changed.pdf' } }, { concurrentPatch: { receipt_url: 'receipt.pdf' } }]) {
    const f = fixture(options);
    f.row.data.reservationPayment = { slipPath: '7/payment-slips/original.jpg' };
    await assert.rejects(() => f.service.uploadReservationPaymentSlip(8, 11, file));
    assert.deepEqual(f.removed, f.uploaded);
    assert.equal(f.row.data.reservationPayment.slipPath, '7/payment-slips/original.jpg');
  }
});

test('agent receipt confirms the invoice amount; tenant sees it and cannot replace paid evidence', async () => {
  const f = fixture();
  await f.service.uploadReservationPaymentSlip(8, 11, file);
  const defaults = await f.service.financialDocumentDefaults(7, 11, 'receipt');
  assert.equal(defaults.paymentMethod, 'transfer');
  assert.equal(defaults.reference, 'INV-RS202600011');
  const result = await f.service.generateFinancialDocument(7, 11, 'receipt', {
    ...defaults, documentNo: 'HACKED', customerName: 'Other', items: [{ description: 'hack', quantity: 1, unitPrice: 1 }], receiverName: 'Agent',
  });
  assert.equal(result.reservationPayment.status, 'paid');
  assert.equal(result.reservationPayment.receiptDocumentNo, 'REC-RS202600011');
  assert.equal(f.row.data.financialDocuments.receipt.items[0].unitPrice, 5000);
  assert.equal(f.row.data.financialDocuments.receipt.customerName, 'Tenant');
  assert.equal(f.row.data.financialDocuments.receipt.reference, 'INV-RS202600011');
  // D11: the landlord received the money (the default); the receiver name the agent typed is not used.
  assert.equal(f.row.data.financialDocuments.receipt.receiverName, 'Owner A');
  assert.equal(f.row.data.financialDocuments.receipt.receivedBy, 'landlord');
  assert.equal('withholdingTax' in f.row.data.financialDocuments.receipt, false);
  const mine = await f.service.listForUser(8);
  assert.equal(mine[0].receiptUrl, result.receiptUrl);
  await assert.rejects(() => f.service.uploadReservationPaymentSlip(8, 11, file), /ออกใบเสร็จแล้ว/);
  const count = f.uploaded.length;
  await f.service.generateFinancialDocument(7, 11, 'receipt', {});
  assert.equal(f.uploaded.length, count);
});

test('invoice and receipt cannot be re-uploaded to bypass booking amounts', async () => {
  const f = fixture();
  for (const kind of ['invoice', 'receipt'])
    await assert.rejects(() => f.service.uploadDocument(7, 11, kind, file), /ต้องสร้างจากใบแจ้งหนี้/);
  assert.equal(f.uploaded.length, 0);
});

test('slip storage rejects unsupported bytes, missing files and oversized uploads', async () => {
  const storage = new ContractDocumentStorageService();
  await assert.rejects(() => storage.uploadPaymentSlip(7, undefined), /สลิป/);
  await assert.rejects(() => storage.uploadPaymentSlip(7, { buffer: Buffer.from('executable'), size: 10 }), /PDF|JPG|PNG/);
  const tooLarge = Buffer.alloc(10 * 1024 * 1024 + 1);
  await assert.rejects(() => storage.uploadPaymentSlip(7, { buffer: tooLarge, size: tooLarge.length }), /10 MB/);
});

test('party payment endpoints enforce authentication, roles and file-only multipart uploads', async t => {
  const previous = process.env.ALLOW_DEV_AUTH;
  process.env.ALLOW_DEV_AUTH = 'true';
  t.after(() => { if (previous == null) delete process.env.ALLOW_DEV_AUTH; else process.env.ALLOW_DEV_AUTH = previous; });
  const calls = [];
  class TestModule {}
  Module({ controllers: [PartyContractsController], providers: [
    { provide: AgentContractsService, useValue: {
      financialDocumentForParty: async (userId, id, kind) => { calls.push(['read', userId, id, kind]); return { url: 'https://files/invoice.pdf' }; },
      uploadReservationPaymentSlip: async (userId, id, file) => { calls.push(['upload', userId, id, file?.originalname]); return { ok: true }; },
    } },
    { provide: AgreementAttachmentsService, useValue: {} },
    { provide: AuthService, useValue: { findBySupabaseUserId: async id => ({ id: Number(id) }), loadUserWithRoles: async id => ({ id, roleNames: id === 8 ? ['tenant'] : ['agent'] }) } },
  ] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const base = `${await app.getUrl()}/contracts/mine/11`;
  assert.equal((await fetch(`${base}/financial-documents/invoice`)).status, 401);
  assert.equal((await fetch(`${base}/financial-documents/invoice`, { headers: { Authorization: 'Bearer dev|7|test@example.invalid' } })).status, 403);
  assert.equal((await fetch(`${base}/financial-documents/invoice`, { headers: { Authorization: 'Bearer dev|8|test@example.invalid' } })).status, 200);
  const form = new FormData(); form.append('file', new Blob([file.buffer], { type: 'image/jpeg' }), 'slip.jpg');
  assert.equal((await fetch(`${base}/payment-slip`, { method: 'POST', headers: { Authorization: 'Bearer dev|8|test@example.invalid' }, body: form })).status, 200);
  assert.deepEqual(calls[1], ['upload', 8, 11, 'slip.jpg']);
  const malicious = new FormData(); malicious.append('file', new Blob([file.buffer]), 'slip.jpg'); malicious.append('invoiceId', '999');
  assert.equal((await fetch(`${base}/payment-slip`, { method: 'POST', headers: { Authorization: 'Bearer dev|8|test@example.invalid' }, body: malicious })).status, 400);
  assert.equal(calls.length, 2);
});

// D11 (AC-3.5): the agent receives the booking money for the landlord only with a power of attorney attached.
const poa = (patch = {}) => ({ id: 51, agreement_id: 11, document_type_code: 'power_of_attorney', subject: 'representative', removed_at: null,
  supersedes_document_id: null, review_status: 'pending', ...patch });
test('D11: the agent is the receiver only with a current, not rejected power of attorney on the reservation', async () => {
  for (const [label, docs] of [
    ['nothing attached', []],
    ['removed', [poa({ removed_at: new Date() })]],
    ['rejected', [poa({ review_status: 'rejected' })]],
    ['replaced by a newer file', [poa(), { ...poa({ id: 52, document_type_code: 'other', supersedes_document_id: 51 }) }]],
    ['another document type', [poa({ document_type_code: 'other' })]],
    ['the tenant\'s power of attorney', [poa({ subject: 'tenant' })]],
    ['on another agreement', [poa({ agreement_id: 12 })]],
  ]) {
    const f = fixture({ docs });
    await f.service.uploadReservationPaymentSlip(8, 11, file);
    const files = f.uploaded.length;
    await assert.rejects(() => f.service.generateFinancialDocument(7, 11, 'receipt', { paymentMethod: 'transfer', paymentDetails: 'bank', receivedBy: 'agent' }),
      e => e.getStatus() === 400 && e.getResponse().code === 'POWER_OF_ATTORNEY_REQUIRED', label);
    assert.equal(f.uploaded.length, files, `${label}: no receipt file`);
    assert.equal(f.row.receipt_url, null, label);
    assert.deepEqual(f.docQueries, [[11]], `${label}: only the reservation's own attachments count`);
  }
  for (const docs of [[poa()], [poa({ subject: 'owner' })], [poa({ subject: 'property' })], [poa({ review_status: 'accepted' })], [poa({ id: 50, removed_at: new Date() }), poa({ supersedes_document_id: 50 })]]) {
    const f = fixture({ docs });
    await f.service.uploadReservationPaymentSlip(8, 11, file);
    await f.service.generateFinancialDocument(7, 11, 'receipt', { paymentMethod: 'transfer', paymentDetails: 'bank', receivedBy: 'agent', receiverName: 'Typed' });
    const receipt = f.row.data.financialDocuments.receipt;
    assert.equal(receipt.receiverName, 'Agent B (ผู้รับมอบอำนาจ)');
    assert.equal(receipt.receivedBy, 'agent');
  }
  const f = fixture();
  await f.service.uploadReservationPaymentSlip(8, 11, file);
  await assert.rejects(() => f.service.generateFinancialDocument(7, 11, 'receipt', { paymentMethod: 'transfer', paymentDetails: 'bank', receivedBy: 'owner' }),
    e => e.getStatus() === 400 && /ผู้รับเงิน/.test(e.message));
  assert.equal(f.row.receipt_url, null);
});

test('D11: a landlord receipt needs the landlord\'s name; an old invoice issued as NESTYK does not count as one', async () => {
  const f = fixture({ patch: { party_snapshot: {} } });
  f.row.data.financialDocuments.invoice.issuerName = 'NESTYK';
  await f.service.uploadReservationPaymentSlip(8, 11, file);
  await assert.rejects(() => f.service.generateFinancialDocument(7, 11, 'receipt', { paymentMethod: 'transfer', paymentDetails: 'bank' }),
    e => e.getStatus() === 400 && /ชื่อผู้ให้เช่า/.test(e.message));
  f.row.data.financialDocuments.invoice.issuerName = 'Landlord On Invoice';
  await f.service.generateFinancialDocument(7, 11, 'receipt', { paymentMethod: 'transfer', paymentDetails: 'bank' });
  assert.equal(f.row.data.financialDocuments.receipt.receiverName, 'Landlord On Invoice');
  const letter = fixture({ patch: { party_snapshot: { ownerName: 'Snapshot Owner' } } });
  letter.row.data.reservationLetter = { landlordName: 'Letter Owner' };
  await letter.service.uploadReservationPaymentSlip(8, 11, file);
  await letter.service.generateFinancialDocument(7, 11, 'receipt', { paymentMethod: 'cash' });
  assert.equal(letter.row.data.financialDocuments.receipt.receiverName, 'Letter Owner', 'the name on the reservation letter first');
});

test('D11 (TC-3.15): the booking receipt keeps the full amount and records the tax the tenant withheld', async () => {
  for (const [value, expected] of [['1,000', 1000], [999.5, 999.5], ['4999.99', 4999.99]]) {
    const f = fixture();
    await f.service.uploadReservationPaymentSlip(8, 11, file);
    await f.service.generateFinancialDocument(7, 11, 'receipt', { paymentMethod: 'transfer', paymentDetails: 'bank', withholdingTax: value });
    const receipt = f.row.data.financialDocuments.receipt;
    assert.equal(receipt.withholdingTax, expected, String(value));
    assert.equal(receipt.items[0].unitPrice, 5000, 'the receipt total stays the booking amount');
  }
  for (const value of ['', 0, '0', null]) {
    const f = fixture();
    await f.service.uploadReservationPaymentSlip(8, 11, file);
    await f.service.generateFinancialDocument(7, 11, 'receipt', { paymentMethod: 'transfer', paymentDetails: 'bank', withholdingTax: value });
    assert.equal('withholdingTax' in f.row.data.financialDocuments.receipt, false, `no tax for ${JSON.stringify(value)}`);
  }
  for (const value of ['5000', 5000, '6000', '-1', 'abc', '1.234', {}, true]) {
    const f = fixture();
    await f.service.uploadReservationPaymentSlip(8, 11, file);
    const files = f.uploaded.length;
    await assert.rejects(() => f.service.generateFinancialDocument(7, 11, 'receipt', { paymentMethod: 'transfer', paymentDetails: 'bank', withholdingTax: value }),
      e => e.getStatus() === 400 && /ภาษีหัก ณ ที่จ่าย/.test(e.message), JSON.stringify(value));
    assert.equal(f.uploaded.length, files);
    assert.equal(f.row.receipt_url, null);
  }
});

// D11 (AC-3.4): the agent returns a slip with a reason; the tenant sees it and sends a new one.
test('D11: the agent returns the tenant\'s booking slip with a reason, and the tenant sends a new one', async () => {
  const f = fixture();
  await f.service.uploadReservationPaymentSlip(8, 11, file);
  const sent = f.row.data.reservationPayment.slipPath;
  // The time the app sends is the one the agent's view shows.
  const shown = (await f.service.view(7, 11)).reservationPayment.submittedAt;
  assert.equal(shown, f.row.data.reservationPayment.submittedAt);
  const view = await f.service.returnReservationSlip(7, 11, { reason: '  ยอดไม่ตรง  ', submittedAt: shown });
  assert.equal(view.reservationPayment.status, 'unpaid');
  assert.equal(view.reservationPayment.slipReturnReason, 'ยอดไม่ตรง');
  assert.equal(view.reservationPayment.paymentSlipUrl, null);
  assert.equal(f.row.payment_submitted_at, null);
  assert.equal(f.row.data.reservationPayment.slipPath, undefined);
  assert.equal(f.row.data.reservationPayment.returnedBy, 7);
  assert.equal(f.row.data.untouched, true, 'the rest of the reservation is kept');
  assert.ok(f.row.data.financialDocuments.invoice, 'the invoice is kept');
  assert.deepEqual(f.removed, [sent], 'the returned slip file is removed');
  const [mine] = await f.service.listForUser(8);
  assert.equal(mine.reservationPayment.slipReturnReason, 'ยอดไม่ตรง', 'the tenant sees why');
  const again = await f.service.uploadReservationPaymentSlip(8, 11, file);
  assert.equal(again.reservationPayment.status, 'submitted');
  assert.equal(again.reservationPayment.slipReturnReason, null, 'a new slip clears the reason');
  // Paid in cash after the return (no new slip): the receipt ends it, so the reason is no longer shown.
  const cash = fixture();
  await cash.service.uploadReservationPaymentSlip(8, 11, file);
  await cash.service.returnReservationSlip(7, 11, { reason: 'โอนผิดบัญชี', submittedAt: cash.row.data.reservationPayment.submittedAt });
  const paid = await cash.service.generateFinancialDocument(7, 11, 'receipt', { paymentMethod: 'cash' });
  assert.equal(paid.reservationPayment.status, 'paid');
  assert.equal(paid.reservationPayment.slipReturnReason, null);
});

test('D11: no slip return without a reason, without a slip, after the receipt, or for a closed reservation', async () => {
  for (const body of [{}, { reason: '   ' }, { reason: 'x'.repeat(501) }, { reason: 5 }, null]) {
    const f = fixture();
    await f.service.uploadReservationPaymentSlip(8, 11, file);
    const before = structuredClone(f.row.data);
    await assert.rejects(() => f.service.returnReservationSlip(7, 11, body && { ...body, submittedAt: f.row.data.reservationPayment.submittedAt }),
      e => e.getStatus() === 400 && /เหตุผล/.test(e.message), JSON.stringify(body));
    assert.deepEqual(f.row.data, before);
  }
  const none = fixture();
  await assert.rejects(() => none.service.returnReservationSlip(7, 11, { reason: 'x' }), e => e.getStatus() === 400 && /ยังไม่มีสลิป/.test(e.message));
  const paid = fixture();
  await paid.service.uploadReservationPaymentSlip(8, 11, file);
  paid.row.receipt_url = '7/11/receipt/r.pdf';
  await assert.rejects(() => paid.service.returnReservationSlip(7, 11, { reason: 'x', submittedAt: paid.row.data.reservationPayment.submittedAt }),
    e => e.getStatus() === 400 && /ออกใบเสร็จแล้ว/.test(e.message));
  assert.ok(paid.row.data.reservationPayment.slipPath);
  for (const status of ['cancelled', 'expired', 'terminated']) {
    const closed = fixture();
    await closed.service.uploadReservationPaymentSlip(8, 11, file);
    closed.row.status = status;
    await assert.rejects(() => closed.service.returnReservationSlip(7, 11, { reason: 'x', submittedAt: closed.row.data.reservationPayment.submittedAt }),
      e => e.getStatus() === 400, status);
    assert.ok(closed.row.data.reservationPayment.slipPath, status);
  }
  // A receipt issued while the return is being made: the reservation is locked and read again, so it stops the return.
  const raced = fixture({ concurrentPatch: { receipt_url: '7/11/receipt/r.pdf' } });
  raced.row.data.reservationPayment = { slipPath: '7/payment-slips/a.jpg', submittedAt: '2026-10-22T03:00:00.000Z' };
  await assert.rejects(() => raced.service.returnReservationSlip(7, 11, { reason: 'x', submittedAt: '2026-10-22T03:00:00.000Z' }), /ออกใบเสร็จแล้ว/);
  assert.equal(raced.row.data.reservationPayment.slipPath, '7/payment-slips/a.jpg');
  assert.deepEqual(raced.removed, []);
});

test('D11: a slip the tenant sent after the agent looked is not returned (409) and is kept', async () => {
  const newer = { slipPath: '7/payment-slips/B.jpg', submittedAt: '2026-10-22T05:00:00.000Z', submittedBy: 8 };
  for (const [label, seen] of [['an older slip', '2026-10-22T03:00:00.000Z'], ['no slip time', undefined], ['not a string', 5]]) {
    // The tenant's new slip B lands just before the agent's return (made after looking at slip A) locks the reservation.
    const patch = {};
    const fx = fixture({ concurrentPatch: patch });
    fx.row.data.reservationPayment = { slipPath: '7/payment-slips/A.jpg', submittedAt: '2026-10-22T03:00:00.000Z', submittedBy: 8 };
    patch.data = { ...fx.row.data, reservationPayment: newer };
    await assert.rejects(() => fx.service.returnReservationSlip(7, 11, { reason: 'ยอดไม่ตรง', submittedAt: seen }),
      e => e.getStatus() === 409 && e.getResponse().code === 'SLIP_CHANGED', label);
    assert.deepEqual(fx.row.data.reservationPayment, newer, `${label}: the new slip is kept`);
    assert.deepEqual(fx.removed, [], `${label}: no file removed`);
  }
});

test('D11: routes POST /agent/contracts/:id/reservation-payment/return and /deposit-payment/return', () => {
  for (const [method, path] of [['returnReservationSlip', ':id/reservation-payment/return'], ['returnDepositSlip', ':id/deposit-payment/return']]) {
    assert.equal(Reflect.getMetadata('path', AgentContractsController.prototype[method]), path);
    assert.equal(Reflect.getMetadata('method', AgentContractsController.prototype[method]), 1);
  }
});

// D2 round 2 (AC-2.4, TC-2.04 round 4): the rent of the confirmed offer changed after the tenant sent the slip; the
// agent returns the slip, so the tenant pays the latest amount: the letter nobody signed and its invoice follow.
const offerRow = (rent) => ({ monthly_rent: rent, term_months: 12, start_date: '2026-11-01', deposit_amount: '9000.00', contract_date: '2026-10-25',
  rent_due_day: 1, grace_day: null, late_fee_per_day: null, renewal_notice_days: 30, co_broke: false, co_broke_agent_name: null });
const letter = { issueDate: '2026-10-01', landlordName: 'Owner A', tenantName: 'Tenant', project: 'Project', unitNo: 'A1', monthlyRent: '5000',
  reservationPayment: '5000', advanceAmount: '5000', depositAmount: '10000', termFrom: '2026-11-01' };
test('D2 round 2: a slip returned after the offer\'s rent changed makes the invoice and the unsigned letter follow the new rent', async () => {
  const f = fixture({ patch: { rent_room_id: 3, reservation_fee: '5000.00' }, offer: offerRow('4500.00') });
  f.row.data.reservationLetter = { ...letter };
  await f.service.uploadReservationPaymentSlip(8, 11, file);
  const view = await f.service.returnReservationSlip(7, 11, { reason: 'โอนตามยอดใหม่', submittedAt: f.row.data.reservationPayment.submittedAt });
  const invoice = f.row.data.financialDocuments.invoice;
  assert.deepEqual([invoice.documentNo, invoice.items[0].unitPrice], ['INV-RS202600011', 4500], 'same invoice number, the new amount');
  assert.equal(f.row.reservation_fee, '4500.00');
  assert.deepEqual([f.row.data.reservationLetter.reservationPayment, f.row.data.reservationLetter.monthlyRent, f.row.data.reservationLetter.landlordName],
    ['4500', '4500', 'Owner A']);
  assert.equal(f.row.data.reservationPayment.returnNote, 'โอนตามยอดใหม่', 'the reason stays for the tenant');
  assert.equal(view.reservationPayment.total, 4500);
  assert.equal(view.reservationPayment.status, 'unpaid');
  assert.ok(f.removed.includes('7/11/invoice/a.pdf'), 'the old invoice file is removed after the commit');
  assert.ok(f.updates.some((u) => u.invitesRevoked === 11));
  // Unchanged when the rent did not change, without an offer, or when someone signed the letter.
  for (const [label, options, extra] of [
    ['same rent', { offer: offerRow('5000.00') }, {}], ['no offer', {}, {}],
    ['letter signed', { offer: offerRow('4500.00') }, { owner_signed_at: new Date() }],
  ]) {
    const g = fixture({ patch: { rent_room_id: 3, reservation_fee: '5000.00', ...extra }, ...options });
    g.row.data.reservationLetter = { ...letter };
    await g.service.uploadReservationPaymentSlip(8, 11, file);
    await g.service.returnReservationSlip(7, 11, { reason: 'x', submittedAt: g.row.data.reservationPayment.submittedAt });
    assert.deepEqual([g.row.data.financialDocuments.invoice.items[0].unitPrice, g.row.reservation_fee, g.row.invoice_url, g.row.data.reservationLetter.reservationPayment],
      [5000, '5000.00', '7/11/invoice/a.pdf', '5000'], label);
  }
});
