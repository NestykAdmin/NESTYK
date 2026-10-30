// D6 (AC-6.1 to 6.4): handing the room over. Decisions Aof made on 22 Oct 2026 (the expected values below come from them):
// - annex 1 = what is in the room (name, quantity, condition; damaged or missing needs a note), annex 2 = photos of the room
// - the lease no longer needs annex files before signing (new lease template; see the SQL test for the migration)
// - the landlord and the tenant sign, in their own app or on the agent's device at the room
// - no PDF of the annexes in this step
// Defaults Bewty set and told Aof (22 Oct 2026): at least 1 photo before signing; the item list may be empty
// (an unfurnished room); a change after a signature voids the signatures; once both have signed the record is locked.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const sharp = require('sharp');
const { FindOperator } = require('typeorm');
const { AgentContractsService } = require('../src/agent/contracts/agent-contracts.service.ts');
const { AgentContractsController } = require('../src/agent/contracts/agent-contracts.controller.ts');
const { PartyContractsController } = require('../src/agent/contracts/party-contracts.controller.ts');
const { ContractDocumentStorageService } = require('../src/agent/contracts/contract-document-storage.service.ts');
const {
  HandoverService, validateHandover, HANDOVER_BLOCKED_MESSAGES, HANDOVER_COMPLETED, HANDOVER_CHANGED, HANDOVER_MAX_PHOTOS,
} = require('../src/agent/contracts/handover.service.ts');
const { LeaseContractEntity } = require('../src/entities/lease-contract.entity.ts');
const { AgentInvoiceEntity } = require('../src/entities/agent-invoice.entity.ts');
const { AgreementSignatureEntity } = require('../src/entities/agreement-signature.entity.ts');
const { HandoverRecordEntity, HandoverItemEntity, HandoverPhotoEntity } = require('../src/entities/handover.entity.ts');

// Agent 7 made lease 11 for tenant user 8 and landlord user 9.
const GENERATED = '7/11/generated/lease_agreement/v1/lease.pdf';
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
const photo = { buffer: jpeg, size: jpeg.length };
const pdf = Buffer.from('%PDF-1.4 test');
const users = { 7: { id: 7, first_name: 'Agent', last_name: 'Seven' }, 8: { id: 8, first_name: 'Tenant', last_name: 'B' }, 9: { id: 9, first_name: 'Landlord', last_name: 'A' } };

function leaseRow(overrides = {}) {
  return {
    id: 11, tenant_id: 2, rent_room_id: 3, lead_id: 1, created_by_user_id: 7, contract_no: 'LS202600011',
    rent_room: { property: { name: 'Aria' }, room_id: '1201' },
    tenant: { id: 2, name: 'Tenant B', user_id: 8 }, owner_user_id: 9,
    agreement_type_code: 'lease', agreement_type: { form_kind: 'lease' },
    template: { form_kind: 'lease', document_template_key: 'lease/v1' },
    status: 'active', start_date: '2099-01-01', end_date: '2099-12-31', deposit: '40000.00',
    owner_signed_at: new Date('2026-10-20T03:00:00Z'), owner_signature_url: '7/11/signatures/owner.png',
    tenant_signed_at: new Date('2026-10-20T03:00:00Z'), tenant_signature_url: '7/11/signatures/tenant.png',
    agent_signed_at: null, document_url: GENERATED, data: {},
    tenant_delivered_at: new Date('2026-10-20T04:00:00Z'), owner_delivered_at: new Date('2026-10-20T04:00:00Z'),
    ...overrides,
  };
}

const isNull = (value) => value instanceof FindOperator && value.type === 'isNull';
const matches = (row, where = {}) => Object.entries(where).every(([key, value]) => (isNull(value) ? row[key] == null
  : value instanceof FindOperator && value.type === 'in' ? value.value.includes(row[key]) : row[key] === value));
const clone = (value) => structuredClone(value);

/**
 * In-memory lease 11 with its deposit invoice, handover tables and signatures. Each transaction works on a copy and
 * keeps it only when the callback succeeds (a rollback). Unique indexes of the migration answer 23505 like Postgres.
 */
function harness({ lease = {}, receipt = true, deposit = true, others = [] } = {}) {
  const row = leaseRow(lease);
  let tables = {
    invoices: deposit ? [{ id: 50, lease_contract_id: 11, invoice_kind: 'deposit', receipt_pdf_path: receipt ? '7/receipts/r.pdf' : null }] : [],
    records: [], items: [], photos: [], signatures: [],
    // Step 28 (B4): the other deals' leases of the same room.
    leases: others.map((other) => leaseRow({ id: 20, lead_id: 5, tenant_id: 4, ...other })),
  };
  let nextId = 100;
  const events = [];
  // The same events, each with the number of the transaction it happened in (tx1, tx2, ...; tx0 = outside one).
  const txEvents = [];
  let tx = 0, txCount = 0;
  const objects = new Map();
  const removed = [];
  const cloud = {
    upload: async (key, buffer) => { objects.set(key, buffer); return { error: null }; },
    createSignedUrls: async (paths) => ({ data: paths.map((path) => ({ path, signedUrl: `https://signed.example/${path}` })), error: null }),
    remove: async (paths) => { paths.forEach((path) => { removed.push(path); objects.delete(path); }); return { error: null }; },
  };
  const storage = new ContractDocumentStorageService();
  storage.storage = () => cloud;
  storage.client = { storage: { listBuckets: async () => ({ data: [{ name: 'contract-documents', public: false }], error: null }) } };

  const tableOf = (t, entity) => (entity === HandoverRecordEntity ? t.records : entity === HandoverItemEntity ? t.items
    : entity === HandoverPhotoEntity ? t.photos : entity === AgreementSignatureEntity ? t.signatures
    : entity === AgentInvoiceEntity ? t.invoices : entity === LeaseContractEntity ? t.leases : null);
  const unique = (t, entity, value) => {
    if (entity === HandoverRecordEntity && t.records.some((r) => r.agreement_id === value.agreement_id && r.kind === value.kind))
      throw Object.assign(new Error('duplicate key uq_handover_records_agreement_kind'), { code: '23505' });
    if (entity === AgreementSignatureEntity && value.handover_record_id != null &&
        t.signatures.some((s) => s.handover_record_id === value.handover_record_id && s.party === value.party && !s.voided_at))
      throw Object.assign(new Error('duplicate key uq_agreement_signatures_live_handover_party'), { code: '23505' });
  };
  const withRelations = (entity, value, relations) => (entity === AgreementSignatureEntity && relations?.signed_by
    ? { ...value, signed_by: users[value.signed_by_user_id] ?? null } : value);
  const sortRows = (rows, order) => {
    if (!order) return rows;
    const keys = Object.entries(order);
    return [...rows].sort((a, b) => { for (const [k, dir] of keys) { const d = a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0; if (d) return dir === 'ASC' ? d : -d; } return 0; });
  };
  const repo = (t, entity) => ({
    find: async ({ where, order, relations } = {}) => sortRows(tableOf(t, entity).filter((r) => matches(r, where)), order).map((r) => withRelations(entity, clone(r), relations)),
    findOne: async ({ where, relations } = {}) => { const r = tableOf(t, entity).find((x) => matches(x, where)); return r ? withRelations(entity, clone(r), relations) : null; },
    count: async ({ where } = {}) => tableOf(t, entity).filter((r) => matches(r, where)).length,
    createQueryBuilder: () => {
      let scope = {};
      const qb = {};
      for (const key of ['leftJoinAndSelect', 'orderBy']) qb[key] = () => qb;
      qb.where = (sql, params) => { scope = { ...scope, ...(params ?? {}), cancelledHidden: sql.includes("<> 'cancelled'") }; return qb; };
      qb.andWhere = (_sql, params) => { scope = { ...scope, ...(params ?? {}) }; return qb; };
      qb.getOne = async () => {
        if ('agentId' in scope && scope.agentId !== row.created_by_user_id) return null;
        if ('id' in scope && scope.id !== row.id) return null;
        if (scope.cancelledHidden && row.status === 'cancelled') return null;
        return clone(row);
      };
      return qb;
    },
  });
  // `leaseChanges` collects the lease updates of a transaction; they reach the lease only if it commits.
  const managerFor = (t, leaseChanges = []) => ({
    getRepository: (entity) => repo(t, entity),
    findOne: async (entity, { where, lock }) => {
      if (lock) { events.push(`lock ${entity === LeaseContractEntity ? 'lease' : 'record'}`); txEvents.push(`tx${tx}:${events.at(-1)}`); }
      if (entity === LeaseContractEntity) return where.id === row.id ? clone(row) : null;
      return repo(t, entity).findOne({ where });
    },
    find: async (entity, options) => repo(t, entity).find(options),
    count: async (entity, options) => repo(t, entity).count(options),
    create: (_entity, value) => ({ ...value }),
    save: async (entity, value) => {
      unique(t, entity, value);
      const saved = { id: nextId++, handover_date: null, note: null, completed_at: null, created_at: new Date(), updated_at: new Date(), ...value };
      tableOf(t, entity).push(saved);
      return clone(saved);
    },
    insert: async (entity, values) => {
      for (const value of [].concat(values)) {
        unique(t, entity, value);
        tableOf(t, entity).push({ id: nextId++, created_at: new Date(), signed_at: new Date(), voided_at: null, caption: null, ...value });
      }
    },
    update: async (entity, where, patch) => {
      if (entity === LeaseContractEntity) {
        events.push(`update lease ${JSON.stringify(where)}`);
        txEvents.push(`tx${tx}:${events.at(-1)}`);
        const hit = matches(row, where);
        if (hit) leaseChanges.push(patch);
        return { affected: hit ? 1 : 0 };
      }
      const rows = tableOf(t, entity).filter((r) => matches(r, where));
      rows.forEach((r) => Object.assign(r, patch));
      return { affected: rows.length };
    },
    delete: async (entity, where) => {
      const table = tableOf(t, entity);
      for (let i = table.length - 1; i >= 0; i--) if (matches(table[i], where)) table.splice(i, 1);
    },
  });
  const db = {
    getRepository: (entity) => repo(tables, entity),
    transaction: async (fn) => {
      const copy = structuredClone(tables);
      const leaseChanges = [];
      tx = ++txCount;
      try {
        const result = await fn(managerFor(copy, leaseChanges));
        tables = copy;
        leaseChanges.forEach((patch) => Object.assign(row, patch));
        return result;
      } finally {
        tx = 0;
      }
    },
  };
  const contracts = new AgentContractsService(db, storage);
  const handover = new HandoverService(db, contracts, storage);
  return { row, handover, contracts, objects, removed, events, txEvents, tables: () => tables };
}

async function signaturePng() {
  return sharp(Buffer.from('<svg width="240" height="100"><path d="M20 65 Q50 0 65 55 T110 50" fill="none" stroke="#203854" stroke-width="4"/></svg>')).png().toBuffer();
}
const form = (patch = {}) => ({
  handoverDate: '2099-01-01', note: 'กุญแจ 2 ดอก', revision: 0,
  items: [{ name: 'แอร์', quantity: 2, condition: 'good' }, { name: 'ตู้เย็น', quantity: 1, condition: 'damaged', note: 'ประตูบุบ' }],
  ...patch,
});
const blocked = (reason) => (e) => e.getStatus() === 400 && e.getResponse().code === 'HANDOVER_BLOCKED' &&
  e.getResponse().reason === reason && e.message === HANDOVER_BLOCKED_MESSAGES[reason];
const completedError = (e) => e.getStatus() === 400 && e.getResponse().code === 'HANDOVER_COMPLETED' && e.message === HANDOVER_COMPLETED;
const changedError = (e) => e.getStatus() === 409 && e.message === HANDOVER_CHANGED;

/** A record with the 2 items and 1 photo, ready to sign (revision 2: the save, then the photo). */
async function ready(options) {
  const h = harness(options);
  await h.handover.save(7, 11, form());
  const view = await h.handover.addPhoto(7, 11, photo);
  return { ...h, view, png: (await signaturePng()).toString('base64') };
}

test('B4 (step 28): the room hands over from the day after the previous lease\'s last day (TC-6.05, TC-8.11)', async (t) => {
  const rentSchedule = require('../src/billing/rent-schedule.ts');
  t.mock.method(rentSchedule, 'bangkokToday', () => '2027-11-01');
  const reason = async (other) => (await harness({ others: [other] }).handover.agentView(7, 11)).blockedReason;
  assert.equal(await reason({ end_date: '2027-11-01' }), 'room_occupied', 'the old lease ends today');
  assert.equal(await reason({ end_date: '2027-10-31' }), null, 'it ended yesterday');
  assert.equal(await reason({ end_date: '2027-10-31', data: { notRenewing: { recordedOn: '2027-11-01' } } }), 'room_occupied', 'not renewing recorded today, after the end');
  assert.equal(await reason({ end_date: '2027-12-31', data: { endsOn: { date: '2027-10-31' } } }), null, 'ended early yesterday');
});

test('the handover opens after the lease document and the deposit receipt; a lease without a deposit only needs the document', async () => {
  const cases = [
    [{ receipt: false }, 'deposit_unpaid'],
    [{ deposit: false }, 'deposit_unpaid'],
    [{ lease: { document_url: null, status: 'awaiting_agent_review' } }, 'lease_not_issued'],
    [{ lease: { tenant_signed_at: null } }, 'lease_not_issued'],
    [{ lease: { status: 'terminated' } }, 'contract_ended'],
    // The agent's own contract list still shows a cancelled draft, so the gate itself must refuse it.
    [{ lease: { status: 'cancelled' } }, 'contract_ended'],
    [{ lease: { status: 'expired' } }, 'contract_ended'],
    [{ lease: { template: { form_kind: 'reservation', document_template_key: 'reservation/letter-v1' }, agreement_type: { form_kind: 'reservation' } } }, 'not_lease'],
    [{ lease: { template: { form_kind: 'renewal', document_template_key: 'lease_renewal/v1' }, agreement_type: { form_kind: 'renewal' } } }, 'not_lease'],
    // Step 28 (B4, AC-6.1): the previous tenant's lease of the room has not ended (or ended with no decision yet).
    [{ others: [{ start_date: '2098-01-01', end_date: '2099-01-01' }] }, 'room_occupied'],
    [{ others: [{ status: 'expired', start_date: '2020-01-01', end_date: '2020-12-31', data: { undecided: { since: '2021-01-01' } } }] }, 'room_occupied'],
    [{ others: [{ template: { form_kind: 'renewal', document_template_key: 'lease_renewal/v1' }, agreement_type: { form_kind: 'renewal' }, end_date: '2099-01-01' }] }, 'room_occupied'],
    [{ others: [{ end_date: null }] }, 'room_occupied'],
  ];
  for (const [options, reason] of cases) {
    const h = harness(options);
    const view = await h.handover.agentView(7, 11);
    assert.deepEqual([view.status, view.blockedReason], ['blocked', reason], JSON.stringify(options));
    const png = (await signaturePng()).toString('base64');
    await assert.rejects(() => h.handover.save(7, 11, form()), blocked(reason));
    await assert.rejects(() => h.handover.addPhoto(7, 11, photo), blocked(reason));
    await assert.rejects(() => h.handover.signOnSite(7, 11, { party: 'owner', signaturePng: png, revision: 0 }), blocked(reason));
    assert.deepEqual(h.tables().records, [], 'nothing is written');
    assert.equal(h.objects.size, 0, 'nothing is uploaded');
  }
  // Deposit 0: no deposit invoice, and the handover is open once the lease is issued.
  // The previous tenant's lease is over (and the deal's own leases never count).
  const over = [{ status: 'expired', start_date: '2020-01-01', end_date: '2020-12-31' }, { lead_id: 1, end_date: '2099-06-30' },
    { rent_room_id: 4, end_date: '2099-06-30' }, { status: 'cancelled', end_date: '2099-06-30' }];
  for (const options of [{ lease: { deposit: '0.00' }, deposit: false }, {}, { others: over }]) {
    const view = await harness(options).handover.agentView(7, 11);
    assert.deepEqual([view.status, view.blockedReason, view.id, view.revision], ['not_started', null, null, 0], JSON.stringify(options));
  }
});

test('another agent, and a user who is not a party, get 404', async () => {
  const h = harness();
  await assert.rejects(() => h.handover.agentView(8, 11), (e) => e.getStatus() === 404);
  await assert.rejects(() => h.handover.save(9, 11, form()), (e) => e.getStatus() === 404);
  await assert.rejects(() => h.handover.partyView(7, 11), (e) => e.getStatus() === 404);
  // The tenant sees it only after the lease was delivered to them.
  const notDelivered = harness({ lease: { tenant_delivered_at: null } });
  await assert.rejects(() => notDelivered.handover.partyView(8, 11), (e) => e.getStatus() === 404);
  assert.deepEqual(h.tables().records, []);
});

test('the form: a date, a note up to 1,000 characters, up to 100 items; damaged or missing needs a note', () => {
  assert.deepEqual(validateHandover(form({ note: '  ', items: [{ name: ' แอร์ ', quantity: 1, condition: 'missing', note: ' หาย ' }] })),
    { handoverDate: '2099-01-01', note: null, items: [{ name: 'แอร์', quantity: 1, condition: 'missing', note: 'หาย' }] });
  assert.deepEqual(validateHandover(form({ items: [] })).items, [], 'an unfurnished room has no items');
  const bad = [
    { handoverDate: '' }, { handoverDate: '01/01/2099' }, { handoverDate: '2099-02-30' }, { note: 'x'.repeat(1001) }, { note: 5 },
    { items: 'x' }, { items: Array.from({ length: 101 }, () => ({ name: 'a', quantity: 1, condition: 'good' })) },
    { items: [{ name: ' ', quantity: 1, condition: 'good' }] }, { items: [{ name: 'a'.repeat(121), quantity: 1, condition: 'good' }] },
    { items: [{ name: 'a', quantity: 0, condition: 'good' }] }, { items: [{ name: 'a', quantity: 1000, condition: 'good' }] },
    { items: [{ name: 'a', quantity: 1.5, condition: 'good' }] }, { items: [{ name: 'a', quantity: '1', condition: 'good' }] },
    { items: [{ name: 'a', quantity: 1, condition: 'broken' }] }, { items: [{ name: 'a', quantity: 1, condition: 'damaged' }] },
    { items: [{ name: 'a', quantity: 1, condition: 'missing', note: '  ' }] }, { items: [{ name: 'a', quantity: 1, condition: 'good', note: 'x'.repeat(501) }] },
  ];
  for (const patch of bad) assert.throws(() => validateHandover(form(patch)), (e) => e.getStatus() === 400, JSON.stringify(patch).slice(0, 80));
  assert.ok(validateHandover(form({ items: Array.from({ length: 100 }, () => ({ name: 'a', quantity: 999, condition: 'good' })) })));
  // Exactly at the limits is still fine.
  const edge = validateHandover(form({ note: 'ก'.repeat(1000), items: [{ name: 'ก'.repeat(120), quantity: 1, condition: 'damaged', note: 'ข'.repeat(500) }] }));
  assert.deepEqual([edge.note.length, edge.items[0].name.length, edge.items[0].note.length], [1000, 120, 500]);
});

test('saving creates the record, then each change goes to the next revision; a stale revision is refused', async () => {
  const h = harness();
  const first = await h.handover.save(7, 11, form());
  assert.deepEqual([first.status, first.revision, first.handoverDate, first.note], ['in_progress', 1, '2099-01-01', 'กุญแจ 2 ดอก']);
  assert.deepEqual(first.items.map((i) => [i.name, i.quantity, i.condition, i.note]), [['แอร์', 2, 'good', null], ['ตู้เย็น', 1, 'damaged', 'ประตูบุบ']]);
  assert.deepEqual(h.events, ['lock lease', 'lock record'], 'the lease is locked before the record');
  await assert.rejects(() => h.handover.save(7, 11, form({ revision: 0 })), changedError, 'a second first save');
  const second = await h.handover.save(7, 11, form({ revision: 1, items: [{ name: 'ทีวี', quantity: 1, condition: 'good' }] }));
  assert.deepEqual([second.revision, second.items.map((i) => i.name)], [2, ['ทีวี']], 'the items are replaced');
  assert.equal(h.tables().items.length, 1);
  await assert.rejects(() => h.handover.save(7, 11, form({ revision: 1 })), changedError);
  // The same content again changes nothing (the revision stays, so nobody has to sign again).
  const same = await h.handover.save(7, 11, form({ revision: 2, items: [{ name: 'ทีวี', quantity: 1, condition: 'good' }] }));
  assert.equal(same.revision, 2);
  assert.equal(h.tables().records.length, 1);
  await assert.rejects(() => h.handover.save(7, 11, { revision: 2 }), (e) => e.getStatus() === 400, 'no date');
  await assert.rejects(() => h.handover.save(7, 11, form({ revision: -1 })), (e) => e.getStatus() === 400);
  await assert.rejects(() => h.handover.save(7, 11, form({ revision: '2' })), (e) => e.getStatus() === 400);
});

test('photos: JPEG or PNG, up to 30, and a removed photo is removed from storage', async () => {
  const h = harness();
  // A photo can come first: it starts the record.
  const view = await h.handover.addPhoto(7, 11, photo, { caption: ' ห้องนอน ' });
  assert.deepEqual([view.status, view.revision, view.photos.length, view.photos[0].caption], ['in_progress', 1, 1, 'ห้องนอน']);
  const path = h.tables().photos[0].storage_path;
  assert.match(path, /^7\/11\/handover\/[0-9a-f-]+\.jpg$/);
  assert.equal(view.photos[0].url, `https://signed.example/${path}`);
  await assert.rejects(() => h.handover.addPhoto(7, 11, { buffer: pdf, size: pdf.length }),
    (e) => e.getStatus() === 400 && e.message === 'รูปสภาพห้องต้องเป็นไฟล์ JPEG หรือ PNG', 'a PDF is not a photo');
  await assert.rejects(() => h.handover.addPhoto(7, 11, { buffer: Buffer.from('hello world'), size: 11 }),
    (e) => e.getStatus() === 400 && e.message === 'รูปสภาพห้องต้องเป็นไฟล์ JPEG หรือ PNG', 'another file type gets the photo message too');
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const withPng = await h.handover.addPhoto(7, 11, { buffer: png, size: png.length });
  assert.equal(withPng.photos.length, 2);
  assert.match(h.tables().photos[1].storage_path, /^7\/11\/handover\/[0-9a-f-]+\.png$/, 'a PNG is accepted');
  await h.handover.removePhoto(7, 11, h.tables().photos[1].id);
  await assert.rejects(() => h.handover.addPhoto(7, 11, photo, { caption: 'x'.repeat(201) }), (e) => e.getStatus() === 400);
  for (let i = 1; i < HANDOVER_MAX_PHOTOS; i++) await h.handover.addPhoto(7, 11, photo);
  const before = h.objects.size;
  await assert.rejects(() => h.handover.addPhoto(7, 11, photo), (e) => e.getStatus() === 400 && /30/.test(e.message));
  assert.equal(h.objects.size, before, 'the refused photo is not left in storage');
  assert.equal(h.tables().photos.length, HANDOVER_MAX_PHOTOS);
  const removed = await h.handover.removePhoto(7, 11, h.tables().photos[0].id);
  assert.equal(removed.photos.length, HANDOVER_MAX_PHOTOS - 1);
  assert.ok(h.removed.includes(path) && !h.objects.has(path));
  await assert.rejects(() => h.handover.removePhoto(7, 11, 99999), (e) => e.getStatus() === 404);
  // A photo of another lease's record is not this lease's photo, even with its id.
  h.tables().records.push({ id: 900, agreement_id: 99, kind: 'move_in', revision: 1, completed_at: null });
  h.tables().photos.push({ id: 901, handover_record_id: 900, storage_path: '8/99/handover/x.jpg', caption: null, created_at: new Date() });
  await assert.rejects(() => h.handover.removePhoto(7, 11, 901), (e) => e.getStatus() === 404);
  assert.ok(h.tables().photos.some((p) => p.id === 901), 'the other photo is kept');
  h.tables().photos.pop(); h.tables().records.pop();
  // 1 (first photo) + the PNG added and removed (2) + 29 more photos + this removal = 33: each add or remove is a change.
  assert.equal(removed.revision, HANDOVER_MAX_PHOTOS + 3, 'each photo added or removed is a change');
});

test('signing needs the date, a photo and the revision the signer saw; both signatures lock the record', async () => {
  const noPhoto = harness();
  await noPhoto.handover.save(7, 11, form());
  const png = (await signaturePng()).toString('base64');
  await assert.rejects(() => noPhoto.handover.signOnSite(7, 11, { party: 'owner', signaturePng: png, revision: 1 }),
    (e) => e.getStatus() === 400 && /รูป/.test(e.message));
  assert.equal(noPhoto.objects.size, 0, 'the signature image of a refused signature is removed');
  await assert.rejects(() => harness().handover.signOnSite(7, 11, { party: 'owner', signaturePng: png, revision: 0 }),
    (e) => e.getStatus() === 400 && /ยังไม่มีบันทึก/.test(e.message));
  const photoOnly = harness();
  await photoOnly.handover.addPhoto(7, 11, photo);
  await assert.rejects(() => photoOnly.handover.signOnSite(7, 11, { party: 'owner', signaturePng: png, revision: 1 }),
    (e) => e.getStatus() === 400 && /วันส่งมอบ/.test(e.message), 'a record started by a photo has no date yet');

  const h = await ready();
  assert.equal(h.view.revision, 2);
  await assert.rejects(() => h.handover.signOnSite(7, 11, { party: 'owner', signaturePng: h.png, revision: 1 }), changedError);
  for (const party of ['agent', 'witness', undefined])
    await assert.rejects(() => h.handover.signOnSite(7, 11, { party, signaturePng: h.png, revision: 2 }), (e) => e.getStatus() === 400, String(party));
  await assert.rejects(() => h.handover.signOnSite(7, 11, { party: 'owner', signaturePng: '', revision: 2 }), (e) => e.getStatus() === 400);
  // The landlord signs on the agent's device; the tenant then signs in their own app.
  const owner = await h.handover.signOnSite(7, 11, { party: 'owner', signaturePng: h.png, revision: 2 });
  assert.deepEqual([owner.status, owner.signatures.map((s) => [s.party, s.channel, s.signedBy])], ['in_progress', [['owner', 'on_site', null]]]);
  await assert.rejects(() => h.handover.signOnSite(7, 11, { party: 'owner', signaturePng: h.png, revision: 2 }),
    (e) => e.getStatus() === 400 && e.message === 'ฝ่ายนี้ลงนามแล้ว');
  await assert.rejects(() => h.handover.partySign(8, 11, { party: 'owner', signaturePng: h.png, revision: 2 }),
    (e) => e.getStatus() === 403, 'the tenant cannot sign for the landlord');
  const done = await h.handover.partySign(8, 11, { party: 'tenant', signaturePng: h.png, revision: 2 });
  assert.equal(done.status, 'completed');
  assert.ok(done.completedAt);
  assert.deepEqual(done.myParties, ['tenant']);
  assert.deepEqual(done.signatures.map((s) => [s.party, s.channel, s.signedBy]), [['owner', 'on_site', null], ['tenant', 'app', 'Tenant B']]);
  const rows = h.tables().signatures;
  assert.deepEqual(rows.map((s) => [s.agreement_id, s.handover_record_id, s.party, s.channel, s.signed_by_user_id]),
    [[11, h.view.id, 'owner', 'on_site', 7], [11, h.view.id, 'tenant', 'app', 8]]);
  for (const s of rows) assert.ok(h.objects.has(s.signature_url), 'the signature image is stored');
  // Locked: no change, photo or signature any more.
  await assert.rejects(() => h.handover.save(7, 11, form({ revision: 2, note: 'แก้' })), completedError);
  await assert.rejects(() => h.handover.addPhoto(7, 11, photo), completedError);
  await assert.rejects(() => h.handover.removePhoto(7, 11, h.tables().photos[0].id), completedError);
  await assert.rejects(() => h.handover.signOnSite(7, 11, { party: 'owner', signaturePng: h.png, revision: 2 }), completedError);
  assert.equal(h.tables().photos.length, 1);
  // A lease that was already active before D7 stays active (the update only moves awaiting_handover).
  assert.equal(h.row.status, 'active');
});

test('saving the same content again keeps the signatures and the revision', async () => {
  const h = await ready();
  await h.handover.signOnSite(7, 11, { party: 'owner', signaturePng: h.png, revision: 2 });
  // The same values, typed with different spaces: still the same content.
  const again = await h.handover.save(7, 11, form({ revision: 2, note: ' กุญแจ 2 ดอก ', items: [{ name: 'แอร์ ', quantity: 2, condition: 'good', note: '' }, { name: 'ตู้เย็น', quantity: 1, condition: 'damaged', note: 'ประตูบุบ' }] }));
  assert.deepEqual([again.revision, again.signatures.map((s) => s.party)], [2, ['owner']]);
  assert.equal(h.tables().signatures.filter((s) => s.voided_at).length, 0);
});

test('a change after a signature voids it: the parties sign the new content again', async () => {
  for (const [label, change] of [
    ['save', (h) => h.handover.save(7, 11, form({ revision: 3, note: 'เพิ่มกุญแจห้องน้ำ' }))],
    ['add photo', (h) => h.handover.addPhoto(7, 11, photo)],
    ['remove photo', (h) => h.handover.removePhoto(7, 11, h.tables().photos[0].id)],
  ]) {
    const h = await ready();
    await h.handover.addPhoto(7, 11, photo); // 2 photos, revision 3
    await h.handover.signOnSite(7, 11, { party: 'owner', signaturePng: h.png, revision: 3 });
    const after = await change(h);
    assert.deepEqual([after.signatures, after.status, after.revision], [[], 'in_progress', 4], label);
    assert.ok(h.tables().signatures.length === 1 && h.tables().signatures[0].voided_at, `${label}: kept as voided, not deleted`);
    await assert.rejects(() => h.handover.partySign(8, 11, { party: 'tenant', signaturePng: h.png, revision: 3 }), changedError, label);
    const again = await h.handover.signOnSite(7, 11, { party: 'owner', signaturePng: h.png, revision: 4 });
    assert.deepEqual(again.signatures.map((s) => s.party), ['owner'], label);
  }
});

test('the party view shows the record and the viewer\'s sides; the landlord signs only as landlord', async () => {
  const h = await ready();
  const landlord = await h.handover.partyView(9, 11);
  assert.deepEqual([landlord.status, landlord.myParties, landlord.items.length, landlord.photos.length], ['in_progress', ['owner'], 2, 1]);
  await assert.rejects(() => h.handover.partySign(9, 11, { party: 'tenant', signaturePng: h.png, revision: 2 }), (e) => e.getStatus() === 403);
  const signed = await h.handover.partySign(9, 11, { party: 'owner', signaturePng: h.png, revision: 2 });
  assert.deepEqual(signed.signatures.map((s) => [s.party, s.channel, s.signedBy]), [['owner', 'app', 'Landlord A']]);
  // A cancelled lease is gone from the party inbox.
  await assert.rejects(() => harness({ lease: { status: 'cancelled' } }).handover.partyView(9, 11), (e) => e.getStatus() === 404);
});

test('a lease that ends while the handover is open blocks it, and the record stays visible', async () => {
  const h = await ready();
  h.row.status = 'terminated';
  const view = await h.handover.agentView(7, 11);
  assert.deepEqual([view.status, view.blockedReason, view.items.length], ['blocked', 'contract_ended', 2]);
  await assert.rejects(() => h.handover.signOnSite(7, 11, { party: 'owner', signaturePng: h.png, revision: 2 }), blocked('contract_ended'));
});

test('a lease changed between reading it and the write is refused (the transaction re-reads the locked lease)', async () => {
  for (const change of [{ status: 'terminated' }, { document_url: '7/11/generated/lease_agreement/v1/regenerated.pdf' }]) {
    const h = harness();
    const real = h.contracts.contractForAgent.bind(h.contracts);
    h.contracts.contractForAgent = async (...args) => { const c = await real(...args); Object.assign(h.row, change); return c; };
    await assert.rejects(() => h.handover.save(7, 11, form()), (e) => e.getStatus() === 409, JSON.stringify(change));
    assert.deepEqual(h.tables().records, []);
  }
});

test('the signatures of a handover are not signatures of the lease', async () => {
  const h = await ready();
  await h.handover.signOnSite(7, 11, { party: 'owner', signaturePng: h.png, revision: 2 });
  const db = h.contracts.db;
  const leaseSignature = { id: 1, agreement_id: 11, handover_record_id: null, party: 'owner', channel: 'app', signed_by_user_id: 9, signature_url: 'x', signed_at: new Date('2026-10-20T03:00:00Z'), voided_at: null };
  // Put a lease signature beside the handover one, then read the lease's log.
  await db.transaction(async (manager) => manager.insert(AgreementSignatureEntity, leaseSignature));
  const log = await h.contracts.signatureLog(7, 11);
  assert.deepEqual(log.map((entry) => [entry.party, entry.channel]), [['owner', 'app']], 'only the lease signature');
});

test('routes: the agent edits and signs on site; the parties read and sign', () => {
  const route = (controller, name) => [Reflect.getMetadata('method', controller.prototype[name]), Reflect.getMetadata('path', controller.prototype[name])];
  // RequestMethod: 0 GET, 1 POST, 2 PUT, 3 DELETE.
  assert.deepEqual(route(AgentContractsController, 'handoverView'), [0, ':id/handover']);
  assert.deepEqual(route(AgentContractsController, 'handoverSave'), [2, ':id/handover']);
  assert.deepEqual(route(AgentContractsController, 'handoverPhoto'), [1, ':id/handover/photos']);
  assert.deepEqual(route(AgentContractsController, 'handoverPhotoRemove'), [3, ':id/handover/photos/:photoId']);
  assert.deepEqual(route(AgentContractsController, 'handoverSign'), [1, ':id/handover/sign']);
  assert.deepEqual(route(PartyContractsController, 'handoverView'), [0, 'mine/:id/handover']);
  assert.deepEqual(route(PartyContractsController, 'handoverSign'), [1, 'mine/:id/handover/sign']);
  assert.deepEqual(Reflect.getMetadata('roles', AgentContractsController), ['agent']);
  assert.deepEqual(Reflect.getMetadata('roles', PartyContractsController), ['tenant', 'landlord']);
  // The parties have no route to change the record or its photos.
  const partyRoutes = Object.getOwnPropertyNames(PartyContractsController.prototype).filter((name) => /handover/i.test(name));
  assert.deepEqual(partyRoutes.sort(), ['handoverSign', 'handoverView', 'handovers'].sort());
  // Without the handover service the routes answer 503, not a crash.
  assert.throws(() => new AgentContractsController({}).handoverView({ id: 7 }, 11), (e) => e.getStatus() === 503);
});

// D7 (AC-6.3, decided by Aof on 22 Oct 2026): the lease is in force once the handover is signed by both.
test('D7: the second handover signature makes a lease waiting for the handover active, in the same transaction', async () => {
  const h = await ready({ lease: { status: 'awaiting_handover' } });
  await h.handover.signOnSite(7, 11, { party: 'owner', signaturePng: h.png, revision: 2 });
  assert.equal(h.row.status, 'awaiting_handover', 'one signature is not enough');
  h.txEvents.length = 0;
  const done = await h.handover.partySign(8, 11, { party: 'tenant', signaturePng: h.png, revision: 2 });
  assert.equal(done.status, 'completed');
  assert.equal(h.row.status, 'active');
  // One transaction: the lease is locked first, then the record, then the lease is moved.
  const steps = h.txEvents.filter((e) => /:(lock|update lease)/.test(e));
  const txOf = (e) => e.split(':')[0];
  assert.deepEqual(steps.map((e) => e.slice(e.indexOf(':') + 1)),
    ['lock lease', 'lock record', 'update lease {"id":11,"status":"awaiting_handover"}']);
  assert.equal(new Set(steps.map(txOf)).size, 1, `all in the same transaction: ${steps.join(', ')}`);
  assert.notEqual(txOf(steps[0]), 'tx0');
  // A refused second signature (stale revision) leaves the lease waiting.
  const stale = await ready({ lease: { status: 'awaiting_handover' } });
  await stale.handover.signOnSite(7, 11, { party: 'owner', signaturePng: stale.png, revision: 2 });
  await stale.handover.addPhoto(7, 11, photo);
  await stale.handover.signOnSite(7, 11, { party: 'owner', signaturePng: stale.png, revision: 3 });
  await assert.rejects(() => stale.handover.partySign(8, 11, { party: 'tenant', signaturePng: stale.png, revision: 2 }), changedError);
  assert.equal(stale.row.status, 'awaiting_handover');
});

test('D7: a lease without a deposit goes from waiting for the handover to active once both sign', async () => {
  const h = await ready({ lease: { status: 'awaiting_handover', deposit: '0.00' }, deposit: false });
  await h.handover.signOnSite(7, 11, { party: 'owner', signaturePng: h.png, revision: 2 });
  await h.handover.signOnSite(7, 11, { party: 'tenant', signaturePng: h.png, revision: 2 });
  assert.equal(h.row.status, 'active');
});

test('D7: a lease waiting for its deposit cannot be handed over; the gate does not depend on the D7 status alone', async () => {
  // The receipt is missing: blocked whatever the status says.
  for (const status of ['awaiting_deposit', 'awaiting_handover']) {
    const h = harness({ lease: { status }, receipt: false });
    assert.equal((await h.handover.agentView(7, 11)).blockedReason, 'deposit_unpaid', status);
  }
  // Still marked as waiting for the deposit: blocked even if a receipt exists (the receipt moves the status itself).
  assert.equal((await harness({ lease: { status: 'awaiting_deposit' } }).handover.agentView(7, 11)).blockedReason, 'deposit_unpaid');
  // Received and waiting for the handover: open.
  assert.equal((await harness({ lease: { status: 'awaiting_handover' } }).handover.agentView(7, 11)).status, 'not_started');
});
