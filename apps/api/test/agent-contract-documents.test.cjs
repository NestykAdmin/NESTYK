const { test } = require('node:test');
const assert = require('node:assert/strict');
const { brokerAppointmentLookup } = require('./broker-appointment-lookup.cjs');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { ContractDocumentStorageService } = require('../src/agent/contracts/contract-document-storage.service.ts');
const { AgentContractsService } = require('../src/agent/contracts/agent-contracts.service.ts');
const { AgentContractsController } = require('../src/agent/contracts/agent-contracts.controller.ts');
const { createReservationMock, stampReservationSignatures } = require('../src/agent/contracts/reservation-pdf.ts');
const { PDFDocument, PDFName, PDFDict } = require('pdf-lib');
const sharp = require('sharp');
const { LeaseContractEntity } = require('../src/entities/lease-contract.entity.ts');
const { AgreementSignatureEntity } = require('../src/entities/agreement-signature.entity.ts');
const { emptyLeaseAgreement } = require('../src/agent/contracts/lease-agreement.ts');
const { AuthService } = require('../src/auth/auth.service.ts');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');

const pdf = Buffer.from('%PDF-1.4\n%eof\n');
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function reservationRow(overrides = {}) {
  return {
    id: 11,
    tenant_id: 2,
    rent_room_id: 3,
    lead_id: 1,
    contract_no: 'EC-11',
    rent_room: { property: { name: 'Aria' }, listing_title: null, room_id: '1201' },
    tenant: { name: 'สมชาย' },
    agreement_type_code: 'reservation',
    agreement_type: { name_th: 'หนังสือจองห้อง', form_kind: 'reservation' },
    reservation_fee: '5000.00',
    status: 'draft',
    start_date: '2026-10-01',
    end_date: null,
    move_in_date: '2026-10-15',
    monthly_rent: null,
    deposit: null,
    notes: null,
    owner_signed_at: null,
    tenant_signed_at: null,
    agent_signed_at: null,
    document_url: null,
    invoice_url: null,
    receipt_url: null,
    created_by_user_id: 7,
    ...overrides,
  };
}

function storageDouble() {
  const objects = new Map();
  let bucketExists = false;
  const cloud = {
    upload: async (key, buffer, options) => {
      assert.equal(options.upsert, false);
      objects.set(key, { buffer, contentType: options.contentType });
      return { error: null };
    },
    createSignedUrls: async (paths) => ({
      data: paths.map((path) => ({ path, signedUrl: `https://signed.example/${path}` })),
      error: null,
    }),
  };
  const storage = new ContractDocumentStorageService();
  storage.storage = () => cloud;
  storage.client = { storage: {
    listBuckets: async () => ({ data: bucketExists ? [{ name: 'contract-documents' }] : [], error: null }),
    createBucket: async (name, options) => {
      assert.equal(name, 'contract-documents');
      assert.equal(options.public, false);
      bucketExists = true;
      return { error: null };
    },
  } };
  return { storage, objects, cloud };
}

test('contract document storage accepts pdf jpeg png and signs private paths', async () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  const { storage, objects } = storageDouble();
  const uploaded = await storage.upload(7, 11, 'invoice', { buffer: pdf, size: pdf.length });
  assert.match(uploaded.path, /^7\/11\/invoice\/.+\.pdf$/);
  assert.equal([...objects.values()][0].contentType, 'application/pdf');
  await storage.upload(7, 11, 'invoice', { buffer: jpeg, size: jpeg.length });
  await storage.upload(7, 11, 'receipt', { buffer: png, size: png.length });
  const signed = await storage.signPaths([uploaded.path, null]);
  assert.equal(signed.get(uploaded.path), `https://signed.example/${uploaded.path}`);
  await assert.rejects(() => storage.upload(7, 11, 'invoice', { buffer: Buffer.from('hello'), size: 5 }), error => error.getStatus() === 400);
  await assert.rejects(() => storage.upload(7, 11, 'invoice', undefined), error => error.getStatus() === 400);
});

test('uploadDocument supports reservation invoice and lease agreement uploads', async () => {
  const { storage } = storageDouble();
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  const reservation = reservationRow();
  const lease = reservationRow({
    agreement_type_code: 'lease',
    agreement_type: { name_th: 'สัญญาเช่า', form_kind: 'lease' },
    document_url: null,
  });
  let current = reservation;
  const qb = {};
  for (const key of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy']) qb[key] = () => qb;
  qb.getOne = async () => current;
  const updates = [];
  const db = {
    getRepository: (entity) => {
      assert.equal(entity, LeaseContractEntity);
      return {
        createQueryBuilder: () => qb,
        update: async (where, patch) => {
          updates.push([where, patch]);
          Object.assign(current, patch);
          return { affected: 1 };
        },
      };
    },
  };
  const service = new AgentContractsService(db, storage);
  await assert.rejects(() => service.uploadDocument(7, 11, 'unknown', { buffer: pdf, size: pdf.length }), error => error.getStatus() === 400);
  current = lease;
  await assert.rejects(() => service.uploadDocument(7, 11, 'invoice', { buffer: pdf, size: pdf.length }), error => error.getStatus() === 400 && /หนังสือจองห้อง/.test(error.message));
  const leaseResult = await service.uploadDocument(7, 11, 'lease_agreement', { buffer: pdf, size: pdf.length });
  assert.match(updates[0][1].document_url, /^7\/11\/lease_agreement\//);
  assert.match(leaseResult.leaseDocumentUrl, /^https:\/\/signed\.example\/7\/11\/lease_agreement\//);
  assert.equal(leaseResult.reservationLetterUrl, null);
  current = reservation;
  await assert.rejects(() => service.uploadDocument(7, 11, 'lease_agreement', { buffer: pdf, size: pdf.length }), error => error.getStatus() === 400 && /สัญญาเช่า/.test(error.message));
  await assert.rejects(() => service.uploadDocument(7, 11, 'reservation_letter', { buffer: pdf, size: pdf.length }), error => error.getStatus() === 400);
  const result = await service.uploadDocument(7, 11, 'invoice', { buffer: pdf, size: pdf.length });
  assert.equal(updates[1][0].id, 11);
  assert.match(updates[1][1].invoice_url, /^7\/11\/invoice\//);
  assert.match(result.invoiceUrl, /^https:\/\/signed\.example\/7\/11\/invoice\//);
  assert.equal(result.reservationLetterUrl, null);
});

test('HTTP document upload requires an agent and forwards the file', async (t) => {
  const previous = process.env.ALLOW_DEV_AUTH;
  process.env.ALLOW_DEV_AUTH = 'true';
  t.after(() => { if (previous === undefined) delete process.env.ALLOW_DEV_AUTH; else process.env.ALLOW_DEV_AUTH = previous; });
  const received = [];
  class TestModule {}
  Module({ controllers: [AgentContractsController], providers: [
    { provide: AgentContractsService, useValue: {
      list: async () => [],
      reservationPdf: async (agentId, id, generate) => ({ id, agentId, generate }),
      candidates: async () => [],
      create: async () => ({}),
      uploadDocument: async (agentId, id, kind, file) => {
        received.push({ agentId, id, kind, size: file?.buffer?.length });
        return { id, reservationLetterUrl: 'https://signed.example/doc.pdf' };
      },
    } },
    { provide: AuthService, useValue: {
      findBySupabaseUserId: async id => ({ id: Number(id) }),
      loadUserWithRoles: async id => ({ id, roleNames: id === 7 ? ['agent'] : ['tenant'] }),
    } },
  ] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  t.after(() => app.close());
  const base = await app.getUrl();
  const path = `${base}/agent/contracts/11/documents/invoice`;
  const upload = (auth) => {
    const body = new FormData();
    body.append('file', new Blob([pdf], { type: 'application/pdf' }), 'booking.pdf');
    return fetch(path, { method: 'POST', body, headers: auth ? { Authorization: `Bearer ${auth}` } : {} });
  };
  assert.equal((await upload()).status, 401);
  assert.equal((await upload('dev|8|test@example.invalid')).status, 403);
  const ok = await upload('dev|7|test@example.invalid');
  assert.equal(ok.status, 200);
  assert.equal(received[0].agentId, 7);
  assert.equal(received[0].id, 11);
  assert.equal(received[0].kind, 'invoice');
  assert.equal(received[0].size, pdf.length);
  for (const route of ['reservation-preview', 'generate-reservation']) {
    const url = `${base}/agent/contracts/11/${route}`;
    assert.equal((await fetch(url, { method: 'POST' })).status, 401);
    assert.equal((await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer dev|8|test@example.invalid' } })).status, 403);
    const response = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer dev|7|test@example.invalid' } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { id: 11, agentId: 7, generate: route === 'generate-reservation' });
  }

});


test('signed reservation preview requires all signatures and a server generated PDF', async () => {
  const service = new AgentContractsService({});
  const path = '7/11/generated/reservation_letter/letter-v1/example.pdf';
  const signed = new Map([[path, 'https://signed.example/generated.pdf'], ['7/11/reservation_letter/legacy.pdf', 'https://signed.example/legacy.pdf']]);
  const row = reservationRow({ document_url: path });
  assert.equal(service.serialize(row, signed).reservationLetterStatus, 'awaiting_signatures');
  assert.equal(service.serialize(row, signed).reservationLetterUrl, null);
  assert.ok(!service.documentPaths(row).includes(path));
  for (const party of ['owner', 'tenant', 'agent']) {
    row[`${party}_signed_at`] = new Date();
    row[`${party}_signature_url`] = `7/11/signatures/${party}.png`;
  }
  assert.equal(service.serialize(row, signed).reservationLetterStatus, 'ready');
  assert.equal(service.serialize(row, signed).reservationLetterUrl, 'https://signed.example/generated.pdf');
  row.document_url = '7/11/reservation_letter/legacy.pdf';
  assert.equal(service.serialize(row, signed).reservationLetterStatus, 'ready_to_generate');
  assert.equal(service.serialize(row, signed).reservationLetterUrl, null);
  assert.ok(!service.documentPaths(row).includes(row.document_url));
  row.document_url = null;
  assert.equal(service.serialize(row, signed).reservationLetterStatus, 'ready_to_generate');
  row.tenant_signature_url = null;
  assert.equal(service.serialize(row, signed).reservationLetterStatus, 'awaiting_signatures');
});

test('storage rejects reservation uploads even when called directly', async () => {
  const { storage, objects } = storageDouble();
  await assert.rejects(() => storage.upload(7, 11, 'reservation_letter', { buffer: pdf, size: pdf.length }), error => error.getStatus() === 400);
  assert.equal(objects.size, 0);
});


async function signaturePng() {
  return sharp(Buffer.from('<svg width="240" height="100"><path d="M20 65 Q50 0 65 55 T110 50 Q140 10 150 65 L210 40" fill="none" stroke="#203854" stroke-width="4"/></svg>')).png().toBuffer();
}
function pdfHarness(overrides = {}) {
  const row = reservationRow(overrides);
  const qb = {};
  const scoped = [];
  for (const key of ['leftJoinAndSelect', 'andWhere', 'orderBy']) qb[key] = () => qb;
  qb.where = (sql, params) => { scoped.push(params); return qb; };
  qb.getOne = async () => row;
  // D1: broker appointments as [roomId, tenantId] (the row's own pair unless a test changes it), answered only for its agent.
  let appointments = [[row.rent_room_id, row.tenant_id]];
  const asked = [];
  qb.leftJoin = (...args) => brokerAppointmentLookup(() => appointments, row.created_by_user_id, asked).leftJoin(...args);
  const { storage, objects, cloud } = storageDouble();
  cloud.download = async path => ({ data: objects.has(path) ? new Blob([objects.get(path).buffer]) : null, error: objects.has(path) ? null : new Error('missing') });
  cloud.remove = async paths => { paths.forEach(path => objects.delete(path)); return { error: null }; };
  // D9 + D17: the live witness signature of this lease (null until a test sets one) and the rows the service logs.
  // `locked` is what the transaction reads back (a test can make it differ), `insertError` makes the log insert fail.
  let witness = null; let locked = null; let insertError = null; const logged = [];
  const repo = { createQueryBuilder: () => qb, update: async (where, patch) => { Object.assign(row, patch); return { affected: 1 }; },
    findOne: async (options) => {
      assert.deepEqual({ ...options.where, voided_at: options.where.voided_at?._type }, { agreement_id: row.id, party: 'witness', voided_at: 'isNull' });
      assert.deepEqual(options.relations, { signed_by: true }, 'the witness comes with the account that pressed sign');
      return witness;
    } };
  const db = { getRepository: () => repo, transaction: async (fn) => fn({
    getRepository: () => repo,
    findOne: async (entity, options) => {
      assert.equal(entity, LeaseContractEntity); assert.equal(options.lock.mode, 'pessimistic_write');
      assert.equal(options.where.created_by_user_id, 7);
      return locked ? { ...row, ...locked } : { ...row };
    },
    insert: async (entity, rows) => { assert.equal(entity, AgreementSignatureEntity); if (insertError) throw insertError; logged.push(...rows); },
  }) };
  return { row, storage, objects, repo, asked, logged, scoped, setWitness: (value) => { witness = value; },
    setLocked: (value) => { locked = value; }, failInsert: (error) => { insertError = error; },
    setAppointments: (pairs) => { appointments = pairs; }, service: new AgentContractsService(db, storage) };
}
test('D1: a reservation not generated yet cannot be generated, sent or signed once its broker appointment is not valid', async () => {
  const h = pdfHarness();
  h.setAppointments([]);
  const refused = (e) => e.getStatus() === 400 && e.getResponse().code === 'BROKER_APPOINTMENT_REQUIRED';
  // The preview still opens, so the agent can read the letter while the appointment is sorted out.
  await h.service.reservationPdf(7, 11, false);
  const preview = h.row.document_url;
  assert.match(preview, /mock\/reservation_letter/);
  // "Today" is the Bangkok date: 18:00 UTC on 20 Oct is already 21 Oct in Bangkok.
  const RealDate = Date;
  global.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : ['2026-10-20T18:00:00Z'])); } static now() { return new RealDate('2026-10-20T18:00:00Z').getTime(); } };
  try { await assert.rejects(() => h.service.reservationPdf(7, 11, true), refused); } finally { global.Date = RealDate; }
  assert.equal(h.row.document_url, preview, 'nothing was generated');
  // The lookup asks about this agent, this room and this tenant, and only appointments under 1 year old:
  // start_date + 1 year must be after today, so on the anniversary itself the appointment has already ended.
  const asked = h.asked;
  assert.ok(asked.some((c) => c[0] === 'where' && c[2]?.agentId === 7));
  assert.ok(asked.some((c) => c[0] === 'andWhere' && c[1] === "c.status = 'active'"));
  assert.ok(asked.some((c) => c[0] === 'andWhere' && c[1] === "COALESCE(template.form_kind, agreementType.form_kind) = 'broker_appointment'"));
  assert.ok(asked.some((c) => c[0] === 'andWhere' && c[1] === "c.start_date + INTERVAL '1 year' > CAST(:today AS date)" && c[2]?.today === '2026-10-21'));
  assert.ok(asked.some((c) => c[0] === 'andWhere' && JSON.stringify(c[2]?.roomIds) === '[3]'));
  assert.ok(asked.some((c) => c[0] === 'andWhere' && JSON.stringify(c[2]?.tenantIds) === '[2]'));
  await assert.rejects(() => h.service.deliverToParty(7, 11, { party: 'tenant' }), refused);
  assert.equal(h.row.tenant_delivered_at, undefined, 'nothing was delivered');
  // A party who already received the letter cannot sign it in the app either.
  Object.assign(h.row, { tenant: { name: 'สมชาย', user_id: 8 }, tenant_delivered_at: new Date('2026-10-01T00:00:00Z') });
  h.service.inboxQuery = () => h.repo.createQueryBuilder();
  await assert.rejects(() => h.service.signAsParty(8, 11, { party: 'tenant', signaturePng: 'not checked yet' }), refused);
  assert.equal(h.row.tenant_signed_at, null, 'nothing was signed');
  // An appointment for the same room but another tenant does not count.
  h.setAppointments([[3, 99]]);
  await assert.rejects(() => h.service.reservationPdf(7, 11, true), refused);
  const otherAgent = pdfHarness({ created_by_user_id: 8 });
  otherAgent.service.query = () => otherAgent.repo.createQueryBuilder(); // the letter loads, but the appointment lookup asks for agent 8
  // The lookup asks about the letter's own agent (8), so its appointment counts and delivery gets past the check.
  await assert.rejects(() => otherAgent.service.deliverToParty(7, 11, { party: 'tenant' }), (e) => e.getStatus() === 400 && /ผู้เช่ายังไม่มีบัญชี/.test(e.message));
});

test('D1: a lease and the broker appointment itself are never checked against an appointment', async () => {
  for (const kind of ['lease', 'broker_appointment']) {
    const h = pdfHarness({ agreement_type_code: kind, agreement_type: { form_kind: kind }, template: { form_kind: kind },
      owner_user_id: 9, owner_delivered_at: kind === 'lease' ? new Date('2026-10-01T00:00:00Z') : null });
    h.repo.createQueryBuilder().leftJoin = () => assert.fail(`a ${kind} is not checked`);
    // Each call gets past the appointment check: the lease stops at a later rule (the tenant has no account),
    // the broker appointment is delivered to the landlord, and signing stops at the unreadable signature.
    if (kind === 'lease')
      await assert.rejects(() => h.service.deliverToParty(7, 11, { party: 'tenant' }), (e) => e.getStatus() === 400 && /ผู้เช่ายังไม่มีบัญชี/.test(e.message), kind);
    else {
      await h.service.deliverToParty(7, 11, { party: 'owner' });
      assert.ok(h.row.owner_delivered_at instanceof Date, kind);
    }
    h.service.inboxQuery = () => h.repo.createQueryBuilder();
    await assert.rejects(() => h.service.signAsParty(9, 11, { party: 'owner', signaturePng: 'not a png' }),
      (e) => e.getStatus() === 400 && /ลายเซ็น/.test(e.message), kind);
  }
});

test('D1: the agent cannot sign for a party on a reservation whose broker appointment is not valid (needs real PNG decoding)', async () => {
  const h = pdfHarness();
  h.setAppointments([]);
  const signature = `data:image/png;base64,${(await signaturePng()).toString('base64')}`;
  await assert.rejects(() => h.service.sign(7, 11, { parties: ['agent'], signaturePng: signature }),
    (e) => e.getStatus() === 400 && e.getResponse().code === 'BROKER_APPOINTMENT_REQUIRED');
  assert.equal(h.row.agent_signed_at, null);
});

function leaseHarness(overrides = {}) {
  return pdfHarness({ agreement_type_code: 'lease', agreement_type: { name_th: 'สัญญาเช่า', form_kind: 'lease' },
    template: { form_kind: 'lease', document_template_key: 'lease/v1' },
    data: { leaseAgreement: { ...emptyLeaseAgreement(), landlordName: 'Landlord A', tenantName: 'Tenant B', witnessSignName: 'Typed In Form' } },
    ...overrides });
}
const pageImages = async (buffer, index) =>
  (await PDFDocument.load(buffer)).getPages()[index].node.Resources().lookup(PDFName.of('XObject'), PDFDict)?.keys().length ?? 0;

test('D9: a lease is generated only after the witness signs, and the witness signature and name go on page 7', async () => {
  const h = leaseHarness();
  const png = await signaturePng();
  for (const party of ['owner', 'tenant']) {
    h.row[`${party}_signed_at`] = new Date('2026-10-20T03:00:00Z');
    h.row[`${party}_signature_url`] = `7/11/signatures/${party}.png`;
    h.objects.set(`7/11/signatures/${party}.png`, { buffer: png });
  }
  const before = h.objects.size;
  await assert.rejects(() => h.service.leaseAgreementPdf(7, 11, true),
    (e) => e.getStatus() === 400 && e.getResponse().code === 'WITNESS_SIGNATURE_REQUIRED');
  assert.equal(h.objects.size, before, 'nothing was generated');
  assert.equal(h.row.status, 'draft');
  // The preview still opens without a witness.
  await h.service.leaseAgreementPdf(7, 11, false);
  assert.match(h.row.document_url, /mock\/lease_agreement/);
  // A witness file from another contract is refused.
  h.setWitness({ signature_url: '9/99/signatures/w.png', signer_name: 'Witness C', signed_by: null });
  await assert.rejects(() => h.service.leaseAgreementPdf(7, 11, true), (e) => e.getStatus() === 400 && /ลายเซ็นไม่ตรง/.test(e.message));
  h.setWitness({ signature_url: '7/11/signatures/w.png', signer_name: 'Witness C', signed_by: null });
  h.objects.set('7/11/signatures/w.png', { buffer: png });
  const result = await h.service.leaseAgreementPdf(7, 11, true);
  assert.equal(result.leaseAgreementStatus, 'ready');
  assert.equal(h.row.status, 'active');
  const generated = h.objects.get(h.row.document_url).buffer;
  assert.equal(await pageImages(generated, 6), 3, 'page 7 has the landlord, tenant and witness signatures');
  assert.equal(await pageImages(generated, 0), 2, 'other pages carry only the landlord and tenant');
});

test('D9: the witness name on the generated lease is the person who signed, or the agent when the agent is the witness', async () => {
  // createLeaseAgreementPdf is read from the module at call time, so wrapping the export shows the data it gets.
  const pdfModule = require('../src/agent/contracts/lease-agreement-pdf.ts');
  const original = pdfModule.createLeaseAgreementPdf;
  const named = [];
  pdfModule.createLeaseAgreementPdf = async (data) => { named.push(data.witnessSignName); return original(data); };
  try {
    for (const witness of [
      { signature_url: '7/11/signatures/w.png', signer_name: ' Witness C ', signed_by: { first_name: 'QA', last_name: 'Agent' } },
      { signature_url: '7/11/signatures/w.png', signer_name: null, signed_by: { first_name: 'QA', last_name: 'Agent' } },
    ]) {
      const h = leaseHarness();
      const png = await signaturePng();
      for (const party of ['owner', 'tenant']) {
        h.row[`${party}_signed_at`] = new Date('2026-10-20T03:00:00Z');
        h.row[`${party}_signature_url`] = `7/11/signatures/${party}.png`;
        h.objects.set(`7/11/signatures/${party}.png`, { buffer: png });
      }
      h.objects.set('7/11/signatures/w.png', { buffer: png });
      h.setWitness(witness);
      await h.service.leaseAgreementPdf(7, 11, true);
    }
  } finally { pdfModule.createLeaseAgreementPdf = original; }
  assert.deepEqual(named, ['Witness C', 'QA Agent'], 'not the name typed in the form ("Typed In Form")');
});

test('D9: the lease witness signs once on the agent\'s device; the agent can be the witness', async () => {
  const signature = `data:image/png;base64,${(await signaturePng()).toString('base64')}`;
  const notLease = pdfHarness();
  await assert.rejects(() => notLease.service.witnessSign(7, 11, { asAgent: true, signaturePng: signature }), (e) => e.getStatus() === 400 && /เฉพาะสัญญาเช่า/.test(e.message));
  const h = leaseHarness();
  await assert.rejects(() => h.service.witnessSign(7, 11, { asAgent: false, signerName: '  ', signaturePng: signature }), (e) => e.getStatus() === 400 && /ชื่อพยาน/.test(e.message));
  await assert.rejects(() => h.service.witnessSign(7, 11, { asAgent: true, signaturePng: 'not a png' }), (e) => e.getStatus() === 400);
  assert.deepEqual(h.logged, []);
  await h.service.witnessSign(7, 11, { asAgent: true, signerName: 'ignored', signaturePng: signature });
  assert.equal(h.logged.length, 1);
  assert.deepEqual({ ...h.logged[0], signed_at: undefined, signature_url: undefined },
    { agreement_id: 11, party: 'witness', channel: 'app', signed_by_user_id: 7, signer_name: null, signed_at: undefined, signature_url: undefined });
  assert.match(h.logged[0].signature_url, /^7\/11\/signatures\//);
  assert.ok(h.logged[0].signed_at instanceof Date);
  // Once a witness has signed, a second one is refused.
  h.setWitness({ signature_url: h.logged[0].signature_url, signer_name: null, signed_by: { first_name: 'QA', last_name: 'Agent' } });
  await assert.rejects(() => h.service.witnessSign(7, 11, { asAgent: true, signaturePng: signature }), (e) => e.getStatus() === 400 && /พยานลงนามแล้ว/.test(e.message));
  assert.equal(h.logged.length, 1);
  // Someone else signs on the agent's device: pressed by the agent, named as typed.
  const other = leaseHarness();
  await other.service.witnessSign(7, 11, { asAgent: false, signerName: ' Witness C ', signaturePng: signature });
  assert.equal(other.logged[0].channel, 'on_site');
  assert.equal(other.logged[0].signed_by_user_id, 7);
  assert.equal(other.logged[0].signer_name, 'Witness C');
  assert.ok(other.scoped.some((params) => params?.agentId === 7), 'the lease is looked up for this agent');
  // A generated lease cannot get a witness any more.
  const done = leaseHarness({ status: 'active' });
  await assert.rejects(() => done.service.witnessSign(7, 11, { asAgent: true, signaturePng: signature }), (e) => e.getStatus() === 400);
});

test('D9: a witness signature that loses a race or meets a changed lease is refused and its file removed', async () => {
  const signature = `data:image/png;base64,${(await signaturePng()).toString('base64')}`;
  const uploadedSignatures = (h) => [...h.objects.keys()].filter((key) => key.startsWith('7/11/signatures/'));
  // Another witness signed between the check and the insert: the unique index answers.
  const raced = leaseHarness();
  raced.failInsert(Object.assign(new Error('duplicate key'), { code: '23505' }));
  await assert.rejects(() => raced.service.witnessSign(7, 11, { asAgent: true, signaturePng: signature }), (e) => e.getStatus() === 400 && /พยานลงนามแล้ว/.test(e.message));
  assert.deepEqual(raced.logged, []);
  assert.deepEqual(uploadedSignatures(raced), [], 'the uploaded signature file was removed');
  // The lease was edited (or generated) while the witness was signing.
  for (const change of [{ data: { leaseAgreement: { edited: true } } }, { status: 'awaiting_agent_review' }, { document_url: '7/11/generated/lease_agreement/v1/x.pdf' }]) {
    const changed = leaseHarness();
    changed.setLocked(change);
    await assert.rejects(() => changed.service.witnessSign(7, 11, { asAgent: true, signaturePng: signature }), (e) => e.getStatus() === 409, JSON.stringify(change));
    assert.deepEqual(changed.logged, []);
    assert.deepEqual(uploadedSignatures(changed), []);
  }
});

test('mock preview works before signing, generation stamps three images and persists once', async () => {
  const h = pdfHarness();
  const preview = await h.service.reservationPdf(7, 11, false);
  assert.equal(preview.reservationLetterStatus, 'awaiting_signatures');
  assert.match(preview.reservationLetterUrl, /mock\/reservation_letter/);
  const draftPath = h.row.document_url;
  const base = h.objects.get(draftPath).buffer;
  assert.equal((await PDFDocument.load(base)).getPageCount(), 1);
  await assert.rejects(() => h.service.reservationPdf(7, 11, true), error => error.getStatus() === 400);
  assert.equal(h.row.document_url, draftPath);
  const png = await signaturePng();
  for (const party of ['owner', 'tenant', 'agent']) {
    h.row[`${party}_signed_at`] = new Date();
    const path = `7/11/signatures/${party}.png`;
    h.row[`${party}_signature_url`] = path;
    h.objects.set(path, { buffer: png });
  }
  const result = await h.service.reservationPdf(7, 11, true);
  assert.equal(result.reservationLetterStatus, 'ready');
  assert.equal(h.row.status, 'active');
  assert.match(result.reservationLetterUrl, /generated\/reservation_letter/);
  const pdf = await PDFDocument.load(h.objects.get(h.row.document_url).buffer);
  const resources = pdf.getPages()[0].node.Resources().lookup(PDFName.of('XObject'), PDFDict);
  assert.equal(resources.keys().length, 3);
  const count = h.objects.size;
  assert.equal((await h.service.reservationPdf(7, 11, true)).reservationLetterUrl, result.reservationLetterUrl);
  assert.equal(h.objects.size, count);
  assert.equal((await h.service.reservationPdf(7, 11, false)).reservationLetterUrl, result.reservationLetterUrl);
  // D1: once generated, the letter stays readable (and a repeated generate returns it) even after the appointment ends.
  h.setAppointments([]);
  assert.equal((await h.service.reservationPdf(7, 11, true)).reservationLetterUrl, result.reservationLetterUrl);
  assert.equal(h.objects.size, count);
});

test('PDF writes reject inaccessible or non-reservation contracts and clean up failed commits', async () => {
  const h = pdfHarness({ agreement_type: { form_kind: 'lease' } });
  await assert.rejects(() => h.service.reservationPdf(7, 11, false), error => error.getStatus() === 400);
  h.repo.createQueryBuilder().getOne = async () => null;
  await assert.rejects(() => h.service.reservationPdf(7, 11, false), error => error.getStatus() === 404);
  const failure = pdfHarness();
  failure.repo.update = async () => ({ affected: 0 });
  await assert.rejects(() => failure.service.reservationPdf(7, 11, false), error => error.getStatus() === 409);
  assert.equal(failure.objects.size, 0);
  assert.equal(failure.row.document_url, null);
});

test('invalid signature leaves the original preview unchanged', async () => {
  const h = pdfHarness({
    invoice_url: '7/11/invoice/test.pdf',
    receipt_url: '7/11/receipt/test.pdf',
  });
  await h.service.reservationPdf(7, 11, false);
  const original = h.row.document_url;
  for (const party of ['owner', 'tenant', 'agent']) {
    h.row[`${party}_signed_at`] = new Date();
    const path = `7/11/signatures/${party}.png`;
    h.row[`${party}_signature_url`] = path;
    h.objects.set(path, { buffer: Buffer.from('invalid') });
  }
  await assert.rejects(() => h.service.reservationPdf(7, 11, true), error => error.getStatus() === 400);
  assert.equal(h.row.document_url, original);
});

test('ended agreements cannot upload replacement documents or persist new PDF previews', async () => {
  for (const status of ['cancelled', 'expired', 'terminated']) {
    const lease = pdfHarness({ status, agreement_type_code: 'lease', agreement_type: { form_kind: 'lease' }, document_url: '7/11/lease_agreement/historical.pdf' });
    await assert.rejects(() => lease.service.uploadDocument(7, 11, 'lease_agreement', { buffer: pdf, size: pdf.length }), e => e.getStatus() === 400);
    await assert.rejects(() => lease.service.leaseAgreementPdf(7, 11, false), e => e.getStatus() === 400);
    assert.equal(lease.row.document_url, '7/11/lease_agreement/historical.pdf'); assert.equal(lease.objects.size, 0);
    const renewal = pdfHarness({ status, agreement_type_code: 'lease_renewal', agreement_type: { form_kind: 'renewal' } });
    await assert.rejects(() => renewal.service.leaseRenewalPdf(7, 11, false), e => e.getStatus() === 400);
    assert.equal(renewal.objects.size, 0);
  }
});

test('closure during a document upload rejects the stale write and cleans up the new file', async () => {
  const row = reservationRow({ agreement_type: { form_kind: 'lease' }, data: {}, document_url: 'historical.pdf' });
  const qb = {}; for (const key of ['leftJoinAndSelect', 'where', 'andWhere']) qb[key] = () => qb;
  qb.getOne = async () => structuredClone(row);
  const removed = [];
  const repo = { createQueryBuilder: () => qb, update: async (where) => {
    assert.equal(where.status, 'draft'); assert.equal(where.document_url, 'historical.pdf');
    return { affected: row.status === where.status ? 1 : 0 };
  } };
  const storage = { upload: async () => { row.status = 'terminated'; return { path: 'new-upload.pdf' }; }, remove: async path => removed.push(path) };
  const service = new AgentContractsService({ getRepository: () => repo }, storage);
  await assert.rejects(() => service.uploadDocument(7, 11, 'lease_agreement', { buffer: pdf, size: pdf.length }), e => e.getStatus() === 409);
  assert.equal(row.document_url, 'historical.pdf'); assert.deepEqual(removed, ['new-upload.pdf']);
});


test('signature storage rejects malformed PNG before uploading and normalizes valid images for PDF use', async () => {
  const { storage, objects } = storageDouble();
  const invalid = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(40, 1)]);
  await assert.rejects(() => storage.uploadSignature(7, 11, { buffer: invalid, size: invalid.length }), e => e.getStatus() === 400);
  assert.equal(objects.size, 0);
  const valid = await signaturePng();
  const stored = await storage.uploadSignature(7, 11, { buffer: valid, size: valid.length });
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(objects.get(stored.path).buffer);
  assert.ok(image.width > 0 && image.height > 0);
});
