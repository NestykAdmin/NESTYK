const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true },
  fileName: filename,
}).outputText, filename);
const { AgentRoomsService } = require('../src/agent/rooms/agent-rooms.service.ts');

// Execute the service's portable SELECT against relational fixtures, without a live user database.
function fixture(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(`
    CREATE TABLE contacts (id INTEGER PRIMARY KEY, name TEXT, phone TEXT, created_by_user_id INTEGER);
    CREATE TABLE rent_room_contacts (contact_id INTEGER, rent_room_id INTEGER);
    CREATE TABLE rent_rooms (id INTEGER PRIMARY KEY, created_by_user_id INTEGER, is_scout_room BOOLEAN, listing_source_id INTEGER);
    CREATE TABLE master_listing_sources (id INTEGER PRIMARY KEY, code TEXT);
    CREATE TABLE room_tenancies (id INTEGER PRIMARY KEY, rent_room_id INTEGER, status TEXT, move_in_date TEXT, created_by_user_id INTEGER);
    CREATE TABLE agreement_templates (id INTEGER PRIMARY KEY, form_kind TEXT);
    CREATE TABLE lease_contracts (rent_room_id INTEGER, status TEXT, template_id INTEGER, created_by_user_id INTEGER,
      owner_signed_at TEXT, tenant_signed_at TEXT, agent_signed_at TEXT);
    INSERT INTO agreement_templates VALUES (1,'lease'),(2,'reservation'),(3,'renewal');
    INSERT INTO master_listing_sources VALUES (1, 'owner'), (2, 'co_agent');
  `);
  const service = new AgentRoomsService(null, {
    query: async (sql, params) => {
      assert.equal(params.length, 1);
      return db.prepare(sql).all({ '1': params[0] });
    },
  });
  const contact = (id, name, agent = 7) => db.prepare('INSERT INTO contacts VALUES (?, ?, ?, ?)').run(id, name, `080${id}`, agent);
  const room = (id, contacts, { agent = 7, source = 1, scout = 1 } = {}) => {
    db.prepare('INSERT INTO rent_rooms VALUES (?, ?, ?, ?)').run(id, agent, scout, source);
    for (const contactId of contacts) db.prepare('INSERT INTO rent_room_contacts VALUES (?, ?)').run(contactId, id);
  };
  const agreement = (roomId, status, type = 'lease', signed = false, agent = 7) => db.prepare('INSERT INTO lease_contracts VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(roomId, status, type === 'reservation' ? 2 : type === 'renewal' ? 3 : 1, agent, ...Array(3).fill(signed ? '2026-01-01' : null));
  const tenancy = (roomId, status, agent) => Number(db.prepare('INSERT INTO room_tenancies (rent_room_id, status, move_in_date, created_by_user_id) VALUES (?, ?, ?, ?)')
    .run(roomId, status, status === 'active' ? '2026-01-01' : null, agent ?? db.prepare('SELECT created_by_user_id FROM rent_rooms WHERE id=?').get(roomId).created_by_user_id).lastInsertRowid);
  const setTenancyStatus = (id, status) => db.prepare('UPDATE room_tenancies SET status = ?, move_in_date = CASE WHEN ? = \'active\' THEN COALESCE(move_in_date, \'2026-01-01\') ELSE move_in_date END WHERE id = ?').run(status, status, id);
  return { service, contact, room, agreement, tenancy, setTenancyStatus, db };
}

test('owner contacts belong to the agent, exclude co-agents and unlinked contacts, and count distinct eligible rooms', async (t) => {
  const { service, contact, room } = fixture(t);
  contact(1, 'B Owner'); contact(2, 'A Owner'); contact(3, 'Co-Agent');
  contact(4, 'Other agent owner', 8); contact(5, 'Unlinked'); contact(6, 'Foreign rooms only');
  contact(7, 'Non-scout only');
  room(1, [1, 2]); room(2, [1]); room(3, [3], { source: 2 });
  room(4, [4], { agent: 8 }); room(5, [6], { agent: 8 });
  room(6, [4]); room(7, [7], { scout: 0 }); room(8, [1], { source: 2 });
  assert.deepEqual(await service.listOwnerContacts(7), [
    { id: 2, name: 'A Owner', phone: '0802', roomCount: 1 },
    { id: 1, name: 'B Owner', phone: '0801', roomCount: 2 },
  ]);
  assert.deepEqual(await service.listOwnerContacts(8), [
    { id: 4, name: 'Other agent owner', phone: '0804', roomCount: 1 },
  ]);
});

test('drafts, reservations and prospects do not establish a landlord history', async (t) => {
  const { service, contact, room, agreement, tenancy } = fixture(t);
  const statuses = ['draft', 'awaiting_signatures', 'awaiting_agent_review', 'awaiting_payment',
    'awaiting_payment_verification', 'cancelled'];
  statuses.forEach((status, i) => {
    contact(i + 1, status); room(i + 1, [i + 1]); agreement(i + 1, status);
    tenancy(i + 1, 'prospect');
  });
  contact(20, 'Reservation'); room(20, [20]); agreement(20, 'draft', 'reservation');
  assert.equal((await service.listOwnerContacts(7)).length, statuses.length + 1);
  assert.deepEqual(await service.listLandlordContacts(7), []);
});

test('a contact becomes Landlord and stays Landlord after move-out, expiry and cancellation', async (t) => {
  const { service, contact, room, agreement, tenancy, setTenancyStatus } = fixture(t);
  contact(1, 'Owner'); room(1, [1]); agreement(1, 'draft');
  const occupancy = tenancy(1, 'prospect');
  assert.equal((await service.listOwnerContacts(7))[0].roomCount, 1);
  assert.deepEqual(await service.listLandlordContacts(7), []);

  setTenancyStatus(occupancy, 'active');
  assert.deepEqual(await service.listOwnerContacts(7), []);
  assert.deepEqual(await service.listLandlordContacts(7), [
    { id: 1, name: 'Owner', phone: '0801', roomCount: 1 },
  ]);

  setTenancyStatus(occupancy, 'moved_out');
  assert.deepEqual(await service.listOwnerContacts(7), []);
  assert.equal((await service.listLandlordContacts(7))[0].roomCount, 1);
  agreement(1, 'expired');
  assert.deepEqual(await service.listOwnerContacts(7), []);
  assert.equal((await service.listLandlordContacts(7))[0].roomCount, 1);
  agreement(1, 'cancelled');
  assert.equal((await service.listLandlordContacts(7))[0].roomCount, 1);

  tenancy(1, 'active');
  assert.deepEqual(await service.listOwnerContacts(7), []);
  assert.equal((await service.listLandlordContacts(7))[0].roomCount, 1);
});

test('historical leases and renewals keep contacts in Landlord even without an active stay', async t => {
  const f = fixture(t);
  for (const [index, status] of ['active', 'expired', 'terminated', 'cancelled'].entries()) {
    const id = index + 1;
    f.contact(id, `Landlord ${id}`); f.room(id, [id]);
    f.agreement(id, status, id === 3 ? 'renewal' : 'lease', true);
  }
  assert.deepEqual(await f.service.listOwnerContacts(7), []);
  assert.equal((await f.service.listLandlordContacts(7)).length, 4);
});

test('foreign rooms, co-agent rooms and foreign agreements cannot promote an Owner to Landlord', async t => {
  const f = fixture(t);
  f.contact(1, 'Owner'); f.room(1, [1]);
  f.room(2, [1], { agent: 8 }); f.tenancy(2, 'active');
  f.room(3, [1], { source: 2 }); f.tenancy(3, 'active');
  f.agreement(1, 'active', 'lease', true, 8);
  assert.equal((await f.service.listOwnerContacts(7))[0].roomCount, 1);
  assert.deepEqual(await f.service.listLandlordContacts(7), []);
});

test('a landlord with vacant and occupied rooms appears once in Landlord only, counting all their rooms', async (t) => {
  const { service, contact, room, tenancy, db } = fixture(t);
  contact(1, 'Owner'); room(1, [1]); room(2, [1]); room(3, [1]);
  tenancy(1, 'moved_out'); tenancy(2, 'active'); tenancy(3, 'active');
  assert.deepEqual(await service.listOwnerContacts(7), []);
  assert.equal((await service.listLandlordContacts(7))[0].roomCount, 3);
  db.exec("UPDATE room_tenancies SET status = 'moved_out'");
  assert.deepEqual(await service.listOwnerContacts(7), []);
  assert.equal((await service.listLandlordContacts(7))[0].roomCount, 3);
});

test('Landlord includes all contacts for occupied owner rooms and enforces the same agent and source scope', async (t) => {
  const { service, contact, room, tenancy } = fixture(t);
  contact(1, 'B Landlord'); contact(2, 'A Landlord'); contact(3, 'Co-Agent');
  contact(4, 'Foreign contact', 8); contact(5, 'Foreign room'); contact(6, 'Non-scout');
  room(1, [1, 2]); room(2, [1]); room(3, [3], { source: 2 });
  room(4, [4]); room(5, [5], { agent: 8 }); room(6, [6], { scout: 0 });
  for (let id = 1; id <= 6; id++) tenancy(id, 'active');
  assert.deepEqual(await service.listOwnerContacts(7), []);
  assert.deepEqual(await service.listLandlordContacts(7), [
    { id: 2, name: 'A Landlord', phone: '0802', roomCount: 1 },
    { id: 1, name: 'B Landlord', phone: '0801', roomCount: 2 },
  ]);
});

test('returns all owners rather than only the first listing page, preserving people with the same name', async (t) => {
  const { service, contact, room } = fixture(t);
  for (let id = 1; id <= 55; id++) { contact(id, 'Owner'); room(id, [id]); }
  const owners = await service.listOwnerContacts(7);
  assert.equal(owners.length, 55);
  assert.equal(owners[0].id, 1);
  assert.equal(owners[54].id, 55);
});

test('foreign occupancy on an agent room cannot promote its Owner to Landlord', async t => {
  const f=fixture(t);f.contact(1,'Owner');f.room(1,[1]);f.tenancy(1,'active',8);
  assert.equal((await f.service.listOwnerContacts(7)).length,1);
  assert.deepEqual(await f.service.listLandlordContacts(7),[]);
  f.db.exec("UPDATE room_tenancies SET status='moved_out'");
  assert.equal((await f.service.listOwnerContacts(7)).length,1);
  f.tenancy(1,'active',7);
  assert.deepEqual(await f.service.listOwnerContacts(7),[]);
  assert.equal((await f.service.listLandlordContacts(7)).length,1);
});
