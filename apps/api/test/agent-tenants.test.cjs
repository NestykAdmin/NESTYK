const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { AgentTenantsService, validateTenant, validateTenantProfile } = require('../src/agent/tenants/agent-tenants.service.ts');
const { AgentTenantsController } = require('../src/agent/tenants/agent-tenants.controller.ts');
const { LeadEntity } = require('../src/entities/lead.entity.ts');
const { TenantEntity } = require('../src/entities/tenant.entity.ts');
const { RentRoomEntity } = require('../src/entities/rent-room.entity.ts');
const { LeadViewingEntity } = require('../src/entities/lead-viewing.entity.ts');
const { QueryFailedError } = require('typeorm');
const { AuthService } = require('../src/auth/auth.service.ts');
const { Module } = require('@nestjs/common'); const { NestFactory } = require('@nestjs/core');
const valid = { leadId: 1, rentRoomId: 2, name: 'ผู้เช่าทดสอบ', phone: '0812345678', email: 'tenant@example.invalid', note: 'Test', identityNumber: '', nationality: '' };
const profile = { name: 'ผู้เช่าทดสอบ', phone: '0812345678', email: 'tenant@example.invalid', note: 'Test', identityNumber: '', nationality: '' };
// The service splits `name` into given name and surname and returns all three.
const names = { firstName: 'ผู้เช่าทดสอบ', lastName: '' };

test('validates required identity/contact fields and optional email without accepting spoofed ownership', () => {
  assert.deepEqual(validateTenant({ ...valid, name: ' ผู้เช่าทดสอบ ', created_by_user_id: 99 }), { ...valid, ...names });
  assert.deepEqual(validateTenantProfile({ ...profile, name: ' ผู้เช่าทดสอบ ' }), { ...profile, ...names });
  for (const patch of [{ leadId: 0 }, { rentRoomId: '2' }, { name: '' }, { phone: '' }, { phone: 'hello' }, { phone: '123' }, { email: 'bad@' }, { note: 'a'.repeat(501) }, { identityNumber: 'ab' }, { identityNumber: 'a'.repeat(101) }, { nationality: 'a'.repeat(121) }]) assert.throws(() => validateTenant({ ...valid, ...patch }));
  assert.equal(validateTenant({ ...valid, email: '', note: undefined }).email, '');
  assert.equal(validateTenant({ ...valid, identityNumber: '1-2345-67890-12-3', nationality: ' ไทย ' }).identityNumber, '1-2345-67890-12-3');
  assert.equal(validateTenant({ ...valid, identityNumber: '1-2345-67890-12-3', nationality: ' ไทย ' }).nationality, 'ไทย');
});
function fixture(options = {}) {
  const saved = []; const reads = []; const lead = { id: 1, name: 'Original lead', phone: '0899999999', status: 'inprogress', tenant_id: null, ...options.lead };
  const manager = {
    findOne: async (entity, query) => {
      reads.push(entity === RentRoomEntity ? 'room' : query.where.rent_room_id !== undefined ? 'booked' : 'lead');
      // The room is locked like the lead, so two bookings of one room cannot both pass the lookup below.
      if (entity === RentRoomEntity) { assert.equal(query.where.id, 2); assert.equal(query.where.created_by_user_id, 7); assert.equal(query.lock.mode, 'pessimistic_write'); return options.foreignRoom ? null : { id: 2 }; }
      // The "is this room already booked" lookup; every other findOne is the locked lead read.
      if (query.where.rent_room_id !== undefined) { assert.equal(query.where.rent_room_id, 2); assert.equal(query.where.status, 'booked'); return options.roomBookedBy ?? null; }
      assert.equal(query.where.created_by_user_id, 7); assert.equal(query.lock.mode, 'pessimistic_write'); return options.foreignLead ? null : lead;
    },
    findOneBy: async (entity) => { assert.equal(entity, TenantEntity); return options.existingTenant ? { id: 8 } : null; },
    create: (_, value) => value,
    save: async (entity, value) => {
      if (entity === LeadEntity && options.failLeadSave) throw Error('save failed');
      if (entity === LeadEntity && options.bookingRace) throw new QueryFailedError('UPDATE leads', [], Object.assign(new Error('duplicate key value'), { code: '23505', constraint: 'uq_leads_one_booked_per_room' }));
      const row = { id: 8, ...value }; saved.push(row); return row;
    },
  };
  const db = { transaction: async action => { const before = { ...lead }; try { return await action(manager); } catch (e) { saved.length = 0; Object.assign(lead, before); throw e; } } };
  const service = new AgentTenantsService(db, {}); service.view = async (agent, id) => { assert.equal(agent, 7); return saved.find(t => t.id === id); };
  return { service, saved, lead, reads };
}
test('promotion links tenant and room, keeps original Lead contact, and does not create a contract', async () => {
  const f = fixture(); const result = await f.service.create(7, { ...valid, created_by_user_id: 99, user_id: 99 });
  assert.equal(result.created_by_user_id, 7); assert.equal(result.user_id, undefined); assert.equal(result.name, valid.name);
  assert.equal(f.lead.status, 'booked'); assert.equal(f.lead.tenant_id, 8); assert.equal(f.lead.rent_room_id, 2); assert.equal(f.lead.name, 'Original lead'); assert.equal(f.saved.length, 2);
});
test('rejects duplicate promotion, lost leads, and another agent’s records without writes', async () => {
  for (const options of [{ lead: { tenant_id: 8 } }, { existingTenant: true }, { lead: { status: 'lost' } }, { foreignLead: true }, { foreignRoom: true }]) {
    const f = fixture(options); await assert.rejects(() => f.service.create(7, valid)); assert.equal(f.saved.length, 0);
  }
});
test('failed Lead update rolls back tenant creation', async () => {
  const f = fixture({ failLeadSave: true }); await assert.rejects(() => f.service.create(7, valid), /save failed/); assert.equal(f.saved.length, 0); assert.equal(f.lead.tenant_id, null); assert.equal(f.lead.status, 'inprogress');
});
test('a room another lead booked is refused with 409 before any write, and the unique-index race gets the same answer', async () => {
  const booked = e => e.getStatus() === 409 && e.getResponse().code === 'ROOM_ALREADY_BOOKED';
  const taken = fixture({ roomBookedBy: { id: 5, name: 'Other lead', created_by_user_id: 7 } });
  await assert.rejects(() => taken.service.create(7, valid), e => booked(e) && e.getResponse().message.includes('Other lead'));
  assert.deepEqual(taken.reads, ['lead', 'room', 'booked']); // lead and room are locked before the lookup
  assert.equal(taken.saved.length, 0); assert.equal(taken.lead.status, 'inprogress'); assert.equal(taken.lead.tenant_id, null);
  const foreign = fixture({ roomBookedBy: { id: 5, name: 'Someone else', created_by_user_id: 9 } });
  await assert.rejects(() => foreign.service.create(7, valid), e => booked(e) && !e.getResponse().message.includes('Someone else'));
  const race = fixture({ bookingRace: true });
  await assert.rejects(() => race.service.create(7, valid), booked);
  assert.equal(race.saved.length, 0); assert.equal(race.lead.status, 'inprogress'); assert.equal(race.lead.tenant_id, null);
  // Any other database error still surfaces as it is.
  const other = fixture({ failLeadSave: true }); await assert.rejects(() => other.service.create(7, valid), /save failed/);
});
test('room choices lead with the asked-for room and the rooms the lead viewed, and name who booked a room', async () => {
  const room = (id, name, number) => ({ id, room_id: number, listing_title: null, property: { name } });
  const stock = [room(40, 'Forty Tower', '4001'), room(9, 'Nine Place', '901'), room(8, 'Eight Court', '801'), room(2, 'Two Lofts', '201')];
  const calls = []; const qb = {}; for (const k of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy', 'take']) qb[k] = () => qb;
  qb.getMany = async () => stock.filter(r => r.id !== 40); // room 40 is older than the latest 30
  const repos = new Map([
    [RentRoomEntity, { createQueryBuilder: () => qb, find: async o => { calls.push(['rooms', o.where]); return stock.filter(r => o.where.id.value.includes(r.id)); } }],
    [LeadViewingEntity, { find: async o => { calls.push(['viewings', o.where]); return [{ rent_room_id: 2 }, { rent_room_id: 2 }]; } }],
    [LeadEntity, { find: async o => { calls.push(['leads', o.where]); return [{ id: 3, name: 'Booked lead', rent_room_id: 8 }]; } }],
  ]);
  const service = new AgentTenantsService({ getRepository: e => repos.get(e) }, {});
  const rooms = await service.roomOptions(7, '', { leadId: 1, roomId: 40 });
  assert.deepEqual(rooms.map(r => r.id), [40, 2, 9, 8]);
  assert.deepEqual(rooms.map(r => r.viewed), [false, true, false, false]);
  assert.deepEqual(rooms.map(r => r.bookedBy), [null, null, null, 'Booked lead']);
  assert.deepEqual(rooms[0], { id: 40, property: 'Forty Tower', room: '4001', viewed: false, bookedBy: null });
  const where = name => calls.find(c => c[0] === name)[1];
  assert.equal(where('viewings').lead_id, 1); assert.equal(where('viewings').created_by_user_id, 7); assert.equal(where('viewings').status.value, 'cancelled');
  assert.equal(where('rooms').created_by_user_id, 7); assert.equal(where('leads').created_by_user_id, 7); assert.equal(where('leads').status, 'booked');
  // A search also narrows the pinned rooms; without a lead or room nothing is pinned.
  assert.deepEqual((await service.roomOptions(7, 'forty', { leadId: 1, roomId: 40 })).slice(0, 1).map(r => r.id), [40]);
  assert.ok(!(await service.roomOptions(7, 'nine', { leadId: 1, roomId: 40 })).slice(0, 1).some(r => r.id === 40 || r.id === 2));
  assert.deepEqual((await service.roomOptions(7)).map(r => r.id), [9, 8, 2]);
});
test('lists tenants without contracts and groups contracts by tenant id, never name', async () => {
  const calls = []; const qb = {}; for (const k of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy']) qb[k] = (...args) => { calls.push([k, ...args]); return qb; };
  qb.getMany = async () => [1, 2].map(id => ({ id, lead_id: id, name: 'Same name', created_at: new Date('2026-09-11'), lead: null })); qb.getOne = async () => null;
  const service = new AgentTenantsService({ getRepository: () => ({ createQueryBuilder: () => qb }) }, { list: async agent => { assert.equal(agent, 7); return [{ id: 4, tenantId: 2 }]; } });
  const list = await service.list(7); assert.equal(list.length, 2); assert.equal(list[0].contracts.length, 0); assert.equal(list[1].contracts[0].id, 4);
  await assert.rejects(() => service.view(9, 1), e => e.getStatus() === 404); assert.ok(calls.some(c => c[0] === 'where' && c[2].agentId === 9));
});
test('candidate searches are scoped, bounded, and parameterized', async () => {
  const calls = []; const qb = {}; for (const k of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy', 'take']) qb[k] = (...args) => { calls.push([k, ...args]); return qb; }; qb.getMany = async () => [];
  const service = new AgentTenantsService({ getRepository: () => ({ createQueryBuilder: () => qb }) }, {});
  await service.leadOptions(7, "O'Reilly"); await service.roomOptions(7, 'ห้อง');
  assert.equal(calls.filter(c => c[0] === 'where' && c[2].agentId === 7).length, 2); assert.equal(calls.filter(c => c[0] === 'take' && c[1] === 30).length, 2);
  assert.ok(calls.some(c => c[0] === 'andWhere' && c[1] === 'lead.tenant_id IS NULL')); assert.ok(calls.some(c => c[2]?.q === "%O'Reilly%"));
});
test('updates tenant profile fields without requiring lead or room ids', async () => {
  const tenant = {
    id: 8, lead_id: 1, name: 'Old', phone: '0811111111', email: null, note: null,
    identity_number: null, nationality: null, created_at: new Date('2026-09-11'), lead: null,
  };
  const qb = {};
  for (const k of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy']) qb[k] = () => qb;
  qb.getOne = async () => tenant;
  const refreshed = [];
  const service = new AgentTenantsService({
    getRepository: () => ({ createQueryBuilder: () => qb, save: async () => assert.fail('the tenant is saved by the contracts service, with its drafts') }),
  }, { list: async () => [], saveTenantAndRefreshDrafts: async (agentId, row) => { refreshed.push([agentId, { ...row }]); return []; } });
  service.view = async (agent, id) => {
    assert.equal(agent, 7);
    assert.equal(id, 8);
    return {
      id: tenant.id,
      name: tenant.name,
      phone: tenant.phone,
      email: tenant.email,
      note: tenant.note,
      identityNumber: tenant.identity_number,
      nationality: tenant.nationality,
    };
  };
  const result = await service.update(7, 8, {
    name: ' New Name ',
    phone: '0899999999',
    email: 'new@example.invalid',
    note: 'updated',
    identityNumber: 'A1234567',
    nationality: 'ไทย',
  });
  assert.equal(tenant.name, 'New Name');
  assert.equal(tenant.phone, '0899999999');
  assert.equal(tenant.identity_number, 'A1234567');
  assert.equal(tenant.nationality, 'ไทย');
  assert.equal(result.name, 'New Name');
  assert.equal(refreshed.length, 1);
  assert.equal(refreshed[0][0], 7);
  assert.equal(refreshed[0][1].name, 'New Name', 'the drafts get the edited details, not the old ones');
});
test('rejects update for missing tenant after scoped lookup', async () => {
  const qb = {};
  for (const k of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy']) qb[k] = () => qb;
  qb.getOne = async () => null;
  const service = new AgentTenantsService({ getRepository: () => ({ createQueryBuilder: () => qb }) }, {});
  await assert.rejects(() => service.update(7, 99, profile), (e) => e.getStatus() === 404);
});
test('tenant HTTP routes require agent role and pass current identity to services', async t => {
  const previous = process.env.ALLOW_DEV_AUTH; process.env.ALLOW_DEV_AUTH = 'true'; t.after(() => { if (previous === undefined) delete process.env.ALLOW_DEV_AUTH; else process.env.ALLOW_DEV_AUTH = previous; });
  class TestModule {}
  Module({ controllers: [AgentTenantsController], providers: [
    { provide: AgentTenantsService, useValue: {
      list: async id => [{ agentId: id }],
      leadOptions: async () => [],
      roomOptions: async (id, q, options) => (q === undefined ? [] : [{ q, ...options }]),
      create: async (id, input) => ({ ...validateTenant(input), agentId: id }),
      update: async (id, tenantId, input) => ({ ...validateTenantProfile(input), agentId: id, id: tenantId }),
    } },
    { provide: AuthService, useValue: { findBySupabaseUserId: async id => ({ id: Number(id) }), loadUserWithRoles: async id => ({ id, roleNames: id === 7 ? ['agent'] : ['tenant'] }) } },
  ] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false }); await app.listen(0, '127.0.0.1'); t.after(() => app.close()); const path = `${await app.getUrl()}/agent/tenants`;
  const headers = id => ({ Authorization: `Bearer dev|${id}|test@example.invalid`, 'Content-Type': 'application/json' });
  assert.equal((await fetch(path)).status, 401); assert.equal((await fetch(path, { headers: headers(8) })).status, 403);
  assert.deepEqual(await (await fetch(path, { headers: headers(7) })).json(), [{ agentId: 7 }]);
  for (const suffix of ['/leads', '/rooms']) assert.equal((await fetch(path + suffix, { headers: headers(7) })).status, 200);
  // leadId / roomId reach the service as numbers; anything that is not a positive whole number is dropped.
  assert.deepEqual(await (await fetch(`${path}/rooms?q=x&leadId=3&roomId=abc`, { headers: headers(7) })).json(), [{ q: 'x', leadId: 3 }]);
  assert.equal((await fetch(path, { method: 'POST', headers: headers(7), body: '{}' })).status, 400);
  const created = await fetch(path, { method: 'POST', headers: headers(7), body: JSON.stringify(valid) }); assert.equal(created.status, 201); assert.equal((await created.json()).agentId, 7);
  const patched = await fetch(`${path}/8`, { method: 'PATCH', headers: headers(7), body: JSON.stringify(profile) });
  assert.equal(patched.status, 200);
  assert.deepEqual(await patched.json(), { ...profile, ...names, agentId: 7, id: 8 });
  assert.equal((await fetch(`${path}/8`, { method: 'PATCH', headers: headers(8), body: JSON.stringify(profile) })).status, 403);
});

const { AgentContractsService } = require('../src/agent/contracts/agent-contracts.service.ts');
const { sameTenantPerson, ensurePartyLogin, TENANT_EMAIL_IN_USE } = require('../src/agent/contracts/party-login.ts');
const { LeaseContractEntity } = require('../src/entities/lease-contract.entity.ts');
const { UserEntity } = require('../src/entities/user.entity.ts');
const { AgreementSignInviteEntity } = require('../src/entities/agreement-sign-invite.entity.ts');

const editedTenant = { id: 8, name: 'สมชาย ใจดี', first_name: 'สมชาย', last_name: 'ใจดี', phone: '0899999999', email: 'new@example.invalid', identity_number: 'A1234567', nationality: 'ไทย' };
const draftRow = (over = {}) => ({ id: 1, contract_no: 'RS0001', status: 'draft', tenant_id: 8, created_by_user_id: 7, start_date: '2026-11-01',
  document_url: null, invoice_url: null, receipt_url: null,
  owner_signed_at: null, tenant_signed_at: null, agent_signed_at: null, owner_signature_url: null, tenant_signature_url: null, agent_signature_url: null,
  party_snapshot: { tenantName: 'Old', tenantPhone: '0811111111', ownerName: 'Owner' },
  data: { reservationLetter: { tenantName: 'Old', tenantEmail: 'old@example.invalid', project: 'Condo', reservationPayment: '1000' } }, ...over });
function refreshHarness(rows, options = {}) {
  const writes = [], invites = [], uploads = [], removed = [];
  let saved = null, query = null;
  const manager = {
    getRepository: (entity) => { assert.equal(entity, TenantEntity); return { save: async (row) => { saved = row; return row; } }; },
    find: async (entity, q) => { assert.equal(entity, LeaseContractEntity); query = q; return rows; },
    update: async (entity, where, patch) => {
      if (entity === AgreementSignInviteEntity) { invites.push(where.agreement_id); return; }
      assert.equal(entity, LeaseContractEntity);
      if (options.failWrite) throw new Error('write failed');
      writes.push([where, patch]);
    },
  };
  const documents = {
    upload: async (agentId, id, kind, file) => { assert.equal(kind, 'invoice'); assert.ok(file.size > 0); const path = `invoice/${id}/new.pdf`; uploads.push(path); return { path }; },
    remove: async (path) => { removed.push(path); },
  };
  const service = new AgentContractsService({ transaction: async (fn) => fn(manager) }, options.noStorage ? undefined : documents);
  return { service, writes, invites, uploads, removed, get saved() { return saved; }, get query() { return query; } };
}

test('editing a tenant refreshes only untouched drafts, rebuilds the booking invoice, and leaves agent-typed lease fields alone', async () => {
  const invoice = { documentNo: 'INV-RS0001', issueDate: '2026-10-01', dueDate: '2026-10-05', reference: 'RS0001', customerName: 'Old', items: [{ description: 'ค่าจอง', quantity: 1, unitPrice: 1000 }] };
  const rows = [
    draftRow({ id: 1, invoice_url: 'invoice/1/old.pdf', data: { ...draftRow().data, financialDocuments: { invoice } } }),
    draftRow({ id: 2, data: { leaseAgreement: { tenantName: 'Typed by agent' } } }),
    draftRow({ id: 3, party_snapshot: { tenantName: editedTenant.name, tenantPhone: editedTenant.phone, tenantEmail: editedTenant.email, tenantIdNumber: editedTenant.identity_number, tenantNationality: editedTenant.nationality }, data: { leaseAgreement: {} } }),
    ...['owner_signed_at', 'tenant_signed_at', 'agent_signed_at'].map((key, i) => draftRow({ id: 10 + i, [key]: new Date() })),
    ...['owner_signature_url', 'tenant_signature_url', 'agent_signature_url'].map((key, i) => draftRow({ id: 20 + i, [key]: 'sig.png' })),
    draftRow({ id: 30, receipt_url: 'receipt.pdf' }),
    draftRow({ id: 31, data: { reservationPayment: { slipPath: 'slip.jpg' } } }),
    draftRow({ id: 32, document_url: 'https://x/generated/reservation_letter/32.pdf' }),
    draftRow({ id: 33, document_url: 'https://x/generated/broker_appointment/33.pdf' }),
  ];
  const h = refreshHarness(rows);
  assert.deepEqual(await h.service.saveTenantAndRefreshDrafts(7, editedTenant), [1, 2]);
  assert.equal(h.saved, editedTenant, 'the tenant is saved in the same transaction');
  assert.deepEqual(h.query.where, { tenant_id: 8, created_by_user_id: 7, status: 'draft' });
  assert.equal(h.query.lock.mode, 'pessimistic_write');
  const [[where1, first], [where2, second]] = h.writes;
  assert.deepEqual(where1, { id: 1, created_by_user_id: 7 });
  assert.deepEqual(first.party_snapshot, { tenantName: 'สมชาย ใจดี', tenantPhone: '0899999999', ownerName: 'Owner',
    tenantEmail: 'new@example.invalid', tenantIdNumber: 'A1234567', tenantNationality: 'ไทย' });
  assert.deepEqual(first.data.reservationLetter, { tenantName: 'สมชาย ใจดี', tenantFirstName: 'สมชาย', tenantLastName: 'ใจดี', tenantPhone: '0899999999',
    tenantEmail: 'new@example.invalid', tenantId: 'A1234567', tenantNationality: 'ไทย', project: 'Condo', reservationPayment: '1000' });
  // The booking invoice keeps its number and date but now names the edited tenant.
  const rebuilt = first.data.financialDocuments.invoice;
  assert.deepEqual([rebuilt.documentNo, rebuilt.issueDate, rebuilt.customerName, rebuilt.customerEmail], ['INV-RS0001', '2026-10-01', 'สมชาย ใจดี', 'new@example.invalid']);
  assert.equal(first.invoice_url, 'invoice/1/new.pdf');
  assert.deepEqual(h.removed, ['invoice/1/old.pdf'], 'the old invoice file is removed after commit');
  assert.deepEqual(where2, { id: 2, created_by_user_id: 7 });
  assert.deepEqual(second.data, { leaseAgreement: { tenantName: 'Typed by agent' } });
  assert.equal(second.invoice_url, undefined);
  assert.deepEqual(h.invites, [1, 2], 'unused sign links of changed drafts are revoked');
  assert.equal(rows[0].data.reservationLetter.tenantName, 'Old', 'the loaded row is not mutated');
});

test('a failed refresh removes the invoice file it uploaded, and a draft with an invoice is skipped when storage is missing', async () => {
  const invoice = { documentNo: 'INV-RS0001', issueDate: '2026-10-01', dueDate: '2026-10-05', reference: 'RS0001', customerName: 'Old', items: [{ description: 'ค่าจอง', quantity: 1, unitPrice: 1000 }] };
  const withInvoice = () => draftRow({ invoice_url: 'invoice/1/old.pdf', data: { ...draftRow().data, financialDocuments: { invoice } } });
  const failing = refreshHarness([withInvoice()], { failWrite: true });
  await assert.rejects(() => failing.service.saveTenantAndRefreshDrafts(7, editedTenant), /write failed/);
  assert.deepEqual(failing.removed, ['invoice/1/new.pdf']);
  const noStorage = refreshHarness([withInvoice(), draftRow({ id: 2, data: {} })], { noStorage: true });
  assert.deepEqual(await noStorage.service.saveTenantAndRefreshDrafts(7, editedTenant), [2]);
  // Storage down while rebuilding the invoice: nothing is saved and the agent gets a Thai reason.
  const down = refreshHarness([withInvoice()]);
  down.service.documents.upload = async () => { throw new Error('storage down'); };
  await assert.rejects(() => down.service.saveTenantAndRefreshDrafts(7, editedTenant), (e) => e.getStatus() === 503 && /ใบแจ้งหนี้ค่าจอง/.test(e.message));
  assert.deepEqual(down.writes, []);
  // A draft whose letter is current but whose invoice still names the old details is refreshed.
  const current = { ...draftRow().data.reservationLetter, tenantName: 'สมชาย ใจดี', tenantFirstName: 'สมชาย', tenantLastName: 'ใจดี', tenantPhone: '0899999999', tenantEmail: 'new@example.invalid', tenantId: 'A1234567', tenantNationality: 'ไทย' };
  const stale = refreshHarness([draftRow({ invoice_url: 'invoice/1/old.pdf',
    party_snapshot: { tenantName: 'สมชาย ใจดี', tenantPhone: '0899999999', tenantEmail: 'new@example.invalid', tenantIdNumber: 'A1234567', tenantNationality: 'ไทย' },
    data: { reservationLetter: current, financialDocuments: { invoice } } })]);
  assert.deepEqual(await stale.service.saveTenantAndRefreshDrafts(7, editedTenant), [1]);
  assert.equal(stale.writes[0][1].data.financialDocuments.invoice.customerName, 'สมชาย ใจดี');
});

test('same tenant person: matching ID, or any spelling of the name after titles and invisible characters are dropped', () => {
  assert.equal(sameTenantPerson({ firstName: 'Somchai', lastName: 'Jaidee' }, { name: '  somchai   jaidee ' }), true);
  assert.equal(sameTenantPerson({ name: 'นายสมชาย ใจดี' }, { firstName: 'สมชาย', lastName: 'ใจดี' }), true);
  assert.equal(sameTenantPerson({ name: 'Mr. Somchai Jaidee' }, { name: 'Somchai Jaidee' }), true);
  assert.equal(sameTenantPerson({ name: 'สม\u200Bชาย ใจดี' }, { name: 'สมชาย ใจดี' }), true);
  assert.equal(sameTenantPerson({ name: 'น\u0E4D\u0E32ฝน' }, { name: 'นำฝน' }), true);
  // first_name filled but the full name only in `name`
  assert.equal(sameTenantPerson({ name: 'Wei Li', firstName: 'Wei', lastName: '' }, { firstName: 'Wei', lastName: 'Li' }), true);
  assert.equal(sameTenantPerson({ name: 'Somchai', identityNumber: '1-2345-67890-12-3' }, { name: 'Somchai J.', identityNumber: '1234567890123' }), true);
  // A passport on one record and a Thai ID on the other: the name decides.
  assert.equal(sameTenantPerson({ name: 'Wei Li', identityNumber: 'E12345678' }, { name: 'Wei Li', identityNumber: '1234567890123' }), true);
  assert.equal(sameTenantPerson({ name: 'Somchai Jaidee' }, { name: 'Somsri Jaidee' }), false);
  assert.equal(sameTenantPerson({ name: 'Somchai Jaidee', identityNumber: '1111111111111' }, { name: 'Somsri Jaidee' }), false);
  // Two different Thai ID numbers are two people even when the names match.
  assert.equal(sameTenantPerson({ name: 'สมชาย ใจดี', identityNumber: '1111111111111' }, { name: 'สมชาย ใจดี', identityNumber: '2222222222222' }), false);
  // An English title needs a dot or a space, so a name that only starts with those letters is kept.
  assert.equal(sameTenantPerson({ name: 'Mrinal Shah' }, { name: 'Inal Shah' }), false);
  assert.equal(sameTenantPerson({ name: 'Ms Pim Sukjai' }, { name: 'Pim Sukjai' }), true);
});

test('a tenant login is refused before any account is touched when the email belongs to a different person', async () => {
  const db = (user, tenants, after) => ({
    getRepository: (entity) => entity === UserEntity
      ? { createQueryBuilder: () => { const qb = { where: (sql, params) => { assert.equal(sql, 'LOWER(u.email) = :email'); assert.deepEqual(params, { email: 'pim@example.invalid' }); return qb; }, getOne: async () => user }; return qb; },
          findOneBy: async () => { throw new Error(after); } }
      : { find: async (q) => { assert.deepEqual(q, { where: { user_id: 5 } }); return tenants; } },
  });
  const input = { email: ' Pim@Example.invalid ', phone: '0812345678', firstName: 'Pim', lastName: 'Sukjai', role: 'tenant', who: 'ผู้เช่า', tenantLeadId: 10 };
  await assert.rejects(() => ensurePartyLogin(db({ id: 5 }, [{ lead_id: 3, name: 'Wei Li', first_name: 'Wei', last_name: 'Li' }], 'account touched'), input),
    (e) => e.getStatus() === 409 && e.getResponse().code === 'TENANT_EMAIL_IN_USE' && e.message === TENANT_EMAIL_IN_USE && !e.message.includes('Wei'));
  // No account, the same person on another lead, or this lead's own record: the login carries on.
  for (const [user, tenants] of [[null, []], [{ id: 5 }, [{ lead_id: 3, name: 'x', first_name: 'Pim', last_name: 'Sukjai' }]], [{ id: 5 }, [{ lead_id: 10, name: 'Someone else' }]]])
    await assert.rejects(() => ensurePartyLogin(db(user, tenants, 'reached login'), input), /reached login/);
  // Landlord logins are not checked; a tenant login is checked even if a caller forgets the lead
  // (the type requires tenantLeadId for tenants, so tsc also catches that).
  await assert.rejects(() => ensurePartyLogin(db({ id: 5 }, [{ lead_id: 3, name: 'Wei Li' }], 'reached login'), { ...input, role: 'landlord', tenantLeadId: undefined }), /reached login/);
  await assert.rejects(() => ensurePartyLogin(db({ id: 5 }, [{ lead_id: 3, name: 'Wei Li' }], 'reached login'), { ...input, tenantLeadId: undefined }), (e) => e.getStatus() === 409);
});

test('C2: once the tenant has a login the email stays; other details still change and the list says so', async () => {
  const qb = {}; let tenant;
  for (const k of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy']) qb[k] = () => qb;
  qb.getOne = async () => tenant;
  const refreshed = [];
  const service = new AgentTenantsService({ getRepository: () => ({ createQueryBuilder: () => qb }) },
    { list: async () => [], saveTenantAndRefreshDrafts: async (agentId, row) => { refreshed.push(row.email); return []; } });
  service.view = async () => ({ id: 8 });
  const base = { id: 8, lead_id: 1, name: 'Pim', phone: '0811111111', email: 'pim@example.invalid', note: null, identity_number: null, nationality: null, created_at: new Date('2026-09-11'), lead: null };
  for (const email of ['other@example.invalid', '']) {
    tenant = { ...base, user_id: 5 };
    await assert.rejects(() => service.update(7, 8, { ...profile, email }), (e) => e.getStatus() === 409 && e.getResponse().code === 'TENANT_EMAIL_LOCKED' && /เปลี่ยนอีเมลไม่ได้/.test(e.message));
  }
  assert.deepEqual(refreshed, [], 'nothing is saved when the email change is refused');
  tenant = { ...base, user_id: 5 };
  await service.update(7, 8, { ...profile, name: 'Pim Sukjai', email: ' PIM@example.invalid ' });
  assert.equal(tenant.name, 'Pim Sukjai', 'same email in another case is not a change');
  assert.equal(tenant.email, 'pim@example.invalid', 'the stored email is kept as it was');
  tenant = { ...base, user_id: null };
  await service.update(7, 8, { ...profile, email: 'other@example.invalid' });
  assert.equal(tenant.email, 'other@example.invalid', 'before any login the email can still change');
  const row = (user_id) => service.serialize({ ...base, user_id, lead: null }, []);
  assert.equal(row(5).hasAccount, true);
  assert.equal(row(null).hasAccount, false);
});

