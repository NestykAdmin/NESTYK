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
  const service = new AgentTenantsService({
    getRepository: () => ({
      createQueryBuilder: () => qb,
      save: async (row) => row,
    }),
  }, { list: async () => [] });
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
