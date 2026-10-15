const { test } = require('node:test');
const assert = require('node:assert/strict');
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
  for (const key of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy']) qb[key] = () => qb;
  qb.getOne = async () => row;
  const { storage, objects, cloud } = storageDouble();
  cloud.download = async path => ({ data: objects.has(path) ? new Blob([objects.get(path).buffer]) : null, error: objects.has(path) ? null : new Error('missing') });
  cloud.remove = async paths => { paths.forEach(path => objects.delete(path)); return { error: null }; };
  const repo = { createQueryBuilder: () => qb, update: async (where, patch) => { Object.assign(row, patch); return { affected: 1 }; } };
  return { row, storage, objects, repo, service: new AgentContractsService({ getRepository: () => repo }, storage) };
}
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
