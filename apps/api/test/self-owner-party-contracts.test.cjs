// Self owner contracts API, Task 3: the self owner lists, opens and signs only the contracts of their own rooms
// (lease_contracts.self_owner_room_id -> self_owner_rooms.owner_user_id). Fake query builders, no DB.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { brokerAppointmentLookup } = require('./broker-appointment-lookup.cjs');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { AgentContractsService } = require('../src/agent/contracts/agent-contracts.service.ts');
const { PartyContractsController } = require('../src/agent/contracts/party-contracts.controller.ts');
const { contractRoom } = require('../src/agent/contracts/contract-room.ts');
const { LeaseContractEntity } = require('../src/entities/lease-contract.entity.ts');
const { AgreementSignatureEntity } = require('../src/entities/agreement-signature.entity.ts');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEElEQVQImWNgYGD4D8UQBgAd9AP9JAD7OgAAAABJRU5ErkJggg==', 'base64');
const signaturePng = `data:image/png;base64,${png.toString('base64')}`;
const ADMIN = 1; // qa-admin creates self owner contracts
const OWNER = 9;
const TENANT_USER = 3;

function selfOwnerRow(overrides = {}) {
  return {
    id: 50,
    tenant_id: 2,
    lead_id: null,
    rent_room_id: null,
    rent_room: null,
    self_owner_room_id: 40,
    self_owner_room: { id: 40, owner_user_id: OWNER, room_name: 'ห้องวิวสระ', room_number: '805', property: { name: 'Ideo Q' } },
    owner_user_id: OWNER,
    owner_delivered_at: new Date('2026-11-20T03:00:00Z'),
    tenant: { user_id: TENANT_USER, name: 'สมหญิง' },
    tenant_delivered_at: new Date('2026-11-20T03:00:00Z'),
    party_snapshot: {},
    data: {},
    contract_no: 'LS-50',
    agreement_type_code: 'lease',
    agreement_type: { name_th: 'สัญญาเช่า', form_kind: 'lease' },
    reservation_fee: null,
    status: 'awaiting_signatures',
    start_date: '2026-12-01',
    end_date: '2027-11-30',
    monthly_rent: '15000.00',
    deposit: '30000.00',
    notes: null,
    owner_signed_at: null,
    tenant_signed_at: null,
    agent_signed_at: null,
    owner_signature_url: null,
    tenant_signature_url: null,
    agent_signature_url: null,
    document_url: null,
    invoice_url: null,
    receipt_url: null,
    created_by_user_id: ADMIN,
    ...overrides,
  };
}
const foreignRow = (overrides = {}) => selfOwnerRow({
  self_owner_room: { id: 40, owner_user_id: 10, room_name: 'ห้องวิวสระ', room_number: '805', property: { name: 'Ideo Q' } },
  ...overrides,
});

// The agent row fixture of agent-contract-sign.test.cjs, unchanged.
function agentRow(overrides = {}) {
  return {
    id: 11, tenant_id: 2, rent_room_id: 3, lead_id: 1, contract_no: 'EC-11',
    rent_room: { property: { name: 'Aria' }, listing_title: null, room_id: '1201' },
    tenant: { name: 'สมชาย' },
    agreement_type_code: 'reservation',
    agreement_type: { name_th: 'หนังสือจองห้อง', form_kind: 'reservation' },
    reservation_fee: '5000.00', status: 'draft', start_date: '2026-10-01', end_date: '2026-10-15',
    monthly_rent: null, deposit: null, notes: null,
    owner_signed_at: null, tenant_signed_at: null, agent_signed_at: null,
    owner_signature_url: null, tenant_signature_url: null, agent_signature_url: null,
    document_url: null, invoice_url: null, receipt_url: '7/11/receipt/paid.pdf', created_by_user_id: 7,
    ...overrides,
  };
}

/** `appointments()` lists [roomId, tenantId] pairs with a valid broker appointment of the contract's creator. */
function serviceFor(current, { appointments = () => [], lookupLog = [] } = {}) {
  const qb = { joins: [], wheres: [] };
  qb.leftJoinAndSelect = (...args) => { qb.joins.push(args); return qb; };
  qb.where = (sql, params) => { qb.wheres.push([sql, params]); return qb; };
  qb.andWhere = qb.where;
  qb.orderBy = () => qb;
  qb.getOne = async () => current;
  qb.getMany = async () => [current];
  qb.leftJoin = (...args) => brokerAppointmentLookup(appointments, current.created_by_user_id, lookupLog).leftJoin(...args);
  const updates = []; const signatures = []; const uploaded = [];
  const documents = {
    uploadSignature: async () => ({ path: `${current.created_by_user_id}/${current.id}/signatures/sig.png` }),
    uploadPartyPreview: async (...args) => { uploaded.push(args); return { path: `${args[0]}/${args[1]}/preview.pdf` }; },
    remove: async () => undefined,
    signPaths: async (paths) => new Map(paths.filter(Boolean).map((path) => [path, `https://signed.example/${path}`])),
  };
  const db = {
    getRepository: (entity) => {
      assert.equal(entity, LeaseContractEntity);
      return {
        createQueryBuilder: () => qb,
        update: async (where, patch) => { updates.push([where, patch]); Object.assign(current, patch); return { affected: 1 }; },
      };
    },
    transaction: async (fn) => fn({
      update: async (entity, where, patch) => db.getRepository(entity).update(where, patch),
      insert: async (entity, rows) => { assert.equal(entity, AgreementSignatureEntity); signatures.push(...rows); },
    }),
  };
  return { service: new AgentContractsService(db, documents), qb, updates, signatures, uploaded, lookupLog, current };
}
const notFound = (e) => e.getStatus() === 404 && e.message === 'ไม่พบสัญญา';

test('contractRoom reads the agent room or the self owner room with the serialize fallbacks', () => {
  assert.deepEqual(contractRoom(selfOwnerRow()), { source: 'self_owner', roomId: 40, property: 'Ideo Q', roomNumber: '805' });
  assert.deepEqual(contractRoom(selfOwnerRow({ self_owner_room: { owner_user_id: OWNER, room_name: 'ห้องวิวสระ', room_number: null, property: null } })),
    { source: 'self_owner', roomId: 40, property: 'ห้องวิวสระ', roomNumber: null });
  assert.deepEqual(contractRoom(agentRow()), { source: 'agent', roomId: 3, property: 'Aria', roomNumber: '1201' });
  assert.deepEqual(contractRoom(agentRow({ rent_room: { property: null, listing_title: 'Sky Walk', room_id: null } })),
    { source: 'agent', roomId: 3, property: 'Sky Walk', roomNumber: null });
  // Relations not loaded: the room is still known from its column.
  assert.deepEqual(contractRoom({ rent_room_id: null, self_owner_room_id: 40 }), { source: 'self_owner', roomId: 40, property: 'ไม่ระบุโครงการ', roomNumber: null });
  assert.equal(contractRoom({ rent_room_id: null, self_owner_room_id: null }), null);
});

test('self owner sees their lease', async () => {
  const { service, qb } = serviceFor(selfOwnerRow());
  const rows = await service.listForUser(OWNER);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].property, 'Ideo Q');
  assert.equal(rows[0].room, '805');
  assert.equal(rows[0].selfOwnerRoomId, 40);
  assert.equal(rows[0].rentRoomId, null);
  assert.deepEqual(rows[0].myParties, ['owner']);
  assert.ok(qb.joins.some(([path, alias]) => path === 'c.self_owner_room' && alias === 'selfOwnerRoom'), 'inboxQuery joins the self owner room');
  assert.ok(qb.joins.some(([path]) => path === 'selfOwnerRoom.property'), 'inboxQuery joins the self owner room property');
});

test('foreign room is invisible', async () => {
  const list = serviceFor(foreignRow());
  await list.service.listForUser(OWNER);
  const sql = list.qb.wheres.map(([s]) => s).join(' ');
  assert.match(sql, /c\.owner_user_id = :userId AND c\.owner_delivered_at IS NOT NULL AND \(c\.self_owner_room_id IS NULL OR selfOwnerRoom\.owner_user_id = :userId\)/,
    'the owner branch of listForUser requires the self owner room to be the user\'s');
  assert.deepEqual(list.service.partiesFor(OWNER, foreignRow()), []);
  assert.deepEqual(list.service.partiesFor(OWNER, selfOwnerRow()), ['owner']);

  const doc = serviceFor(foreignRow());
  await assert.rejects(() => doc.service.documentForParty(OWNER, 50), notFound);
  assert.equal(doc.uploaded.length, 0, 'no preview is built for a foreign room');
  const sign = serviceFor(foreignRow());
  await assert.rejects(() => sign.service.signAsParty(OWNER, 50, { party: 'owner', signaturePng }), notFound);
  assert.equal(sign.updates.length, 0);
});

test('every party path through contractForParty refuses a foreign room', async () => {
  const file = { buffer: png, size: png.length, originalname: 'slip.png' };
  const calls = {
    contractForParty: (s) => s.contractForParty(OWNER, 50),
    financialDocumentForParty: (s) => s.financialDocumentForParty(OWNER, 50, 'invoice'),
    earlyEndFileUrl: (s) => s.earlyEndFileUrl(OWNER, 50, 'invoice', false),
    uploadReservationPaymentSlip: (s) => s.uploadReservationPaymentSlip(OWNER, 50, file),
    uploadDepositPaymentSlip: (s) => s.uploadDepositPaymentSlip(OWNER, 50, file),
    uploadEarlyEndSlip: (s) => s.uploadEarlyEndSlip(OWNER, 50, file),
  };
  for (const [name, call] of Object.entries(calls)) {
    const { service, updates } = serviceFor(foreignRow());
    await assert.rejects(() => call(service), notFound, name);
    assert.equal(updates.length, 0, name);
  }
  // The room's own owner still reaches the contract.
  const { service } = serviceFor(selfOwnerRow());
  assert.deepEqual((await service.contractForParty(OWNER, 50)).parties, ['owner']);
});

test('owner sign keeps awaiting_signatures until the tenant signs', async () => {
  const { service, updates, signatures } = serviceFor(selfOwnerRow());
  const result = await service.signAsParty(OWNER, 50, { party: 'owner', signaturePng });
  assert.equal(updates.length, 1);
  assert.equal(updates[0][1].status, 'awaiting_signatures');
  assert.ok(updates[0][1].owner_signed_at instanceof Date);
  assert.equal(updates[0][1].tenant_signed_at, undefined);
  assert.equal(result.status, 'awaiting_signatures');
  assert.deepEqual(result.myParties, ['owner']);
  assert.equal(signatures[0].party, 'owner');
  assert.equal(signatures[0].signed_by_user_id, OWNER);
});

test('last lease signature moves to awaiting_agent_review', async () => {
  const { service, updates } = serviceFor(selfOwnerRow({ tenant_signed_at: new Date('2026-11-21T03:00:00Z'), tenant_signature_url: '1/50/signatures/t.png' }));
  const result = await service.signAsParty(OWNER, 50, { party: 'owner', signaturePng });
  assert.equal(updates[0][1].status, 'awaiting_agent_review');
  assert.equal(result.status, 'awaiting_agent_review');
});

test('second sign is refused', async () => {
  const { service, updates } = serviceFor(selfOwnerRow({ owner_signed_at: new Date('2026-11-21T03:00:00Z'), owner_signature_url: '1/50/signatures/o.png' }));
  await assert.rejects(() => service.signAsParty(OWNER, 50, { party: 'owner', signaturePng }), (e) => e.getStatus() === 400 && e.message === 'ฝ่ายนี้ลงนามแล้ว');
  assert.equal(updates.length, 0);
});

test('self owner cannot sign the tenant side', async () => {
  const { service, updates } = serviceFor(selfOwnerRow());
  await assert.rejects(() => service.signAsParty(OWNER, 50, { party: 'tenant', signaturePng }), (e) => e.getStatus() === 400 && e.message === 'ลงนามได้เฉพาะฝ่ายของคุณ');
  assert.equal(updates.length, 0);
});

test('self owner reservation needs a broker appointment of that room', async () => {
  const reservation = {
    agreement_type_code: 'reservation',
    agreement_type: { name_th: 'หนังสือจองห้อง', form_kind: 'reservation' },
    reservation_fee: '5000.00',
    receipt_url: '1/50/receipt/paid.pdf',
  };
  const missing = serviceFor(selfOwnerRow(reservation));
  await assert.rejects(() => missing.service.signAsParty(OWNER, 50, { party: 'owner', signaturePng }),
    (e) => e.getStatus() === 400 && e.getResponse().code === 'BROKER_APPOINTMENT_REQUIRED');
  assert.equal(missing.updates.length, 0);
  const asked = missing.lookupLog.filter(([, sql]) => typeof sql === 'string');
  assert.ok(asked.some(([key, sql, params]) => key === 'andWhere' && sql === 'c.self_owner_room_id IN (:...roomIds)' && params.roomIds.length === 1 && params.roomIds[0] === 40),
    'the broker lookup matches on self_owner_room_id 40');
  assert.ok(asked.some(([key, sql]) => key === 'select' && sql === 'c.self_owner_room_id'));
  assert.ok(!asked.some(([, sql]) => /rent_room_id/.test(sql)), 'not on rent_room_id');
  assert.ok(asked.some(([key, , params]) => key === 'where' && params?.agentId === ADMIN), 'same creator');
  assert.ok(asked.some(([key, , params]) => key === 'andWhere' && params?.tenantIds?.[0] === 2), 'same tenant');

  const found = serviceFor(selfOwnerRow(reservation), { appointments: () => [[40, 2]] });
  const result = await found.service.signAsParty(OWNER, 50, { party: 'owner', signaturePng });
  assert.equal(result.status, 'awaiting_signatures');
  // An appointment of another room (a rent room with the same id) does not count: the lookup is by self owner room.
  const otherRoom = serviceFor(selfOwnerRow(reservation), { appointments: () => [[41, 2]] });
  await assert.rejects(() => otherRoom.service.signAsParty(OWNER, 50, { party: 'owner', signaturePng }),
    (e) => e.getResponse().code === 'BROKER_APPOINTMENT_REQUIRED');
});

test('tenant sees the self owner lease with its room', async () => {
  const { service } = serviceFor(selfOwnerRow());
  const rows = await service.listForUser(TENANT_USER);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].property, 'Ideo Q');
  assert.equal(rows[0].room, '805');
  assert.equal(rows[0].selfOwnerRoomId, 40);
  assert.deepEqual(rows[0].myParties, ['tenant']);
  // The tenant's side does not depend on who owns the room.
  assert.deepEqual(service.partiesFor(TENANT_USER, foreignRow()), ['tenant']);
});

test('party_snapshot still wins over the room', async () => {
  const { service } = serviceFor(selfOwnerRow({ party_snapshot: { property: 'Snapshot Tower', room: 'A-1' } }));
  const [row] = await service.listForUser(OWNER);
  assert.equal(row.property, 'Snapshot Tower');
  assert.equal(row.room, 'A-1');
});

test('agent rows still serialize from rent_room', async () => {
  const { service } = serviceFor(agentRow({ owner_user_id: OWNER, owner_delivered_at: new Date('2026-10-01T00:00:00Z') }));
  const [row] = await service.listForUser(OWNER);
  assert.equal(row.property, 'Aria');
  assert.equal(row.room, '1201');
  assert.equal(row.rentRoomId, 3);
  assert.equal(row.selfOwnerRoomId, null);
  assert.deepEqual(row.myParties, ['owner']);
  // An agent row (no self owner room) is the landlord's by owner_user_id alone, as before.
  assert.deepEqual(service.partiesFor(OWNER, agentRow({ owner_user_id: OWNER, owner_delivered_at: new Date() })), ['owner']);
});

// Bills plan (27 Nov 2026): self owner leases are billed like agent leases again, so both show the next rent bill.
test('an active self owner lease shows its next rent bill, like the same lease on an agent room', async (t) => {
  const rentSchedule = require('../src/billing/rent-schedule.ts');
  t.mock.method(rentSchedule, 'bangkokToday', () => '2026-12-10');
  const active = { status: 'active', start_date: '2026-12-01', end_date: '2027-11-30', data: { leaseAgreement: { advanceMonths: '1' } } };
  const own = serviceFor(selfOwnerRow(active));
  const [selfOwner] = await own.service.listForUser(TENANT_USER);
  assert.ok(selfOwner.nextRentBill && selfOwner.nextRentBill.period, 'self owner lease shows its next bill');
  const agent = serviceFor(selfOwnerRow({ ...active, self_owner_room_id: null, self_owner_room: null, rent_room_id: 3,
    rent_room: { property: { name: 'Aria' }, listing_title: null, room_id: '1201' } }));
  const [agentLease] = await agent.service.listForUser(TENANT_USER);
  assert.ok(agentLease.nextRentBill && agentLease.nextRentBill.period, 'agent lease keeps its next bill');
});

test('controller allows self_owner', () => {
  const roles = Reflect.getMetadata('roles', PartyContractsController);
  assert.ok(roles.includes('self_owner'));
  assert.ok(roles.includes('tenant') && roles.includes('landlord'));
  // The landlord-only deal-offer confirm stays landlord-only.
  assert.deepEqual(Reflect.getMetadata('roles', PartyContractsController.prototype.landlordConfirm), ['landlord']);
  assert.deepEqual(Reflect.getMetadata('roles', PartyContractsController.prototype.landlordOffers), ['landlord']);
  assert.deepEqual(Reflect.getMetadata('roles', PartyContractsController.prototype.landlordReminders), ['landlord']);
});
