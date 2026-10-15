const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename,
}).outputText, filename);
const { QueryFailedError } = require('typeorm');
const { AgentRoomsService } = require('../src/agent/rooms/agent-rooms.service.ts');
const { AgentListingsService } = require('../src/agent/listings/agent-listings.service.ts');
const { RoomShareLinksService } = require('../src/agent/listings/room-share-links.service.ts');

function fixture(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(`
    CREATE TABLE contacts (id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL,
      email TEXT, line_id TEXT, facebook TEXT, note TEXT, created_by_user_id INTEGER,
      UNIQUE (created_by_user_id, phone));
    CREATE TABLE rent_rooms (id INTEGER PRIMARY KEY, created_by_user_id INTEGER, is_scout_room BOOLEAN, listing_source_id INTEGER);
    CREATE TABLE rent_room_contacts (rent_room_id INTEGER, contact_id INTEGER, is_primary BOOLEAN);
    CREATE TABLE master_listing_sources (id INTEGER PRIMARY KEY, code TEXT);
    CREATE TABLE room_tenancies (rent_room_id INTEGER, status TEXT, move_in_date TEXT, created_by_user_id INTEGER DEFAULT 7);
    CREATE TABLE agreement_templates (id INTEGER PRIMARY KEY, form_kind TEXT);
    CREATE TABLE lease_contracts (rent_room_id INTEGER, created_by_user_id INTEGER, template_id INTEGER, status TEXT,
      owner_signed_at TEXT, tenant_signed_at TEXT, agent_signed_at TEXT);
    INSERT INTO contacts VALUES (1,'Original','0801','old@example.com','old-line','old-fb','old note',7),
      (2,'Another','0802',NULL,NULL,NULL,NULL,7),(3,'Foreign','0803',NULL,NULL,NULL,NULL,8);
    INSERT INTO rent_rooms VALUES (11,7,TRUE,1),(12,7,TRUE,1);
    INSERT INTO rent_room_contacts VALUES (11,1,TRUE),(12,1,TRUE);
    INSERT INTO master_listing_sources VALUES (1,'owner');
    INSERT INTO room_tenancies (rent_room_id,status,move_in_date) VALUES (12,'active','2026-01-01');
  `);
  let writes = 0;
  const contactsRepo = {
    findOneBy: async where => db.prepare('SELECT * FROM contacts WHERE id=? AND created_by_user_id=?').get(where.id, where.created_by_user_id) || null,
    update: async (where, values) => {
      const keys = Object.keys(values);
      try {
        const result = db.prepare(`UPDATE contacts SET ${keys.map(key => `${key}=?`).join(',')} WHERE id=? AND created_by_user_id=?`)
          .run(...Object.values(values), where.id, where.created_by_user_id);
        writes += result.changes;
        return { affected: result.changes };
      } catch (err) {
        if (err.message.includes('UNIQUE constraint')) {
          throw new QueryFailedError('UPDATE contacts', [], { code: '23505', constraint: 'uq_contacts_agent_phone' });
        }
        throw err;
      }
    },
  };
  const service = new AgentRoomsService(null, { query: async (sql, params) => db.prepare(sql).all({ '1': params[0] }) }, null, null, contactsRepo);
  function readRoom(id) {
    const room = db.prepare('SELECT * FROM rent_rooms WHERE id=?').get(id);
    if (!room) return null;
    return { ...room, room_contacts: db.prepare('SELECT c.*, rrc.is_primary FROM rent_room_contacts rrc JOIN contacts c ON c.id=rrc.contact_id WHERE rrc.rent_room_id=?')
      .all(id).map(contact => ({ contact_id: contact.id, is_primary: !!contact.is_primary, contact })) };
  }
  const roomsRepo = { findOne: async ({ where }) => readRoom(where.id), find: async () => [readRoom(11), readRoom(12)] };
  const listings = new AgentListingsService(roomsRepo);
  const sharing = new RoomShareLinksService({ findOne: async () => ({
    id: 1, rent_room_id: 11, contact_id: 1, expires_at: new Date('2099-01-01'),
    share_sections: { photos: false, price: false, facilities: false, location: false, contact: true },
  }) }, roomsRepo, null);
  return { service, listings, sharing, db, writes: () => writes };
}

test('saving updates the same person in Landlord, both room details, listing cards and an existing share link', async t => {
  const { service, listings, sharing, db, writes } = fixture(t);
  const input = { name: ' Updated ', phone: ' 0900 ', email: 'new@example.com', lineId: 'new-line', facebook: 'new-fb', note: 'new note' };
  const updated = await service.updateContact(7, 1, input);
  assert.deepEqual(updated, { ...input, id: 1, name: 'Updated', phone: '0900' });
  assert.equal(writes(), 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM contacts').get().count, 3);
  assert.deepEqual(await service.listOwnerContacts(7), []);
  for (const list of [await service.listLandlordContacts(7)]) {
    assert.equal(list[0].id, 1); assert.equal(list[0].name, 'Updated'); assert.equal(list[0].phone, '0900');
    assert.equal(list[0].roomCount, 2);
  }
  for (const id of [11, 12]) {
    const contact = (await listings.viewMine(7, id)).contacts[0];
    assert.deepEqual(contact, { ...updated, isPrimary: true });
  }
  for (const card of await listings.cardsByIds(7, [11, 12])) {
    assert.deepEqual(card.contact, { id: 1, name: 'Updated', phone: '0900' });
  }
  const shared = await sharing.publicResolve('valid-existing-share-token');
  assert.equal(shared.contacts[0].name, 'Updated');
  assert.equal(shared.contacts[0].phone, '0900');
  assert.equal(shared.contacts[0].lineId, 'new-line');
  assert.equal(shared.contacts[0].note, undefined);
});

test('optional fields can be cleared; partial updates preserve other fields', async t => {
  const { service } = fixture(t);
  const updated = await service.updateContact(7, 1, { email: '', lineId: null, facebook: '  ', note: null });
  assert.deepEqual(updated, { id: 1, name: 'Original', phone: '0801', email: null, lineId: null, facebook: null, note: null });
});

test('foreign and missing people cannot be read or changed', async t => {
  const { service, writes } = fixture(t);
  for (const id of [3, 99]) {
    await assert.rejects(service.getContact(7, id), err => err.getStatus() === 404);
    await assert.rejects(service.updateContact(7, id, { name: 'Changed' }), err => err.getStatus() === 404);
  }
  assert.equal(writes(), 0);
});

test('a duplicate phone is rejected without merging or modifying either contact; another agent may use the number', async t => {
  const { service, writes } = fixture(t);
  await assert.rejects(service.updateContact(7, 1, { name: 'Changed', phone: '0802' }), err => err.getStatus() === 409);
  assert.equal(writes(), 0);
  assert.equal((await service.getContact(7, 1)).name, 'Original');
  assert.equal((await service.getContact(7, 2)).name, 'Another');
  assert.equal((await service.updateContact(7, 1, { phone: '0803' })).phone, '0803');
});

test('invalid input and spoofed identity fields are rejected before any writes', async t => {
  const { service, writes } = fixture(t);
  for (const input of [null, [], {}, { id: 3 }, { created_by_user_id: 8 }, { room_links: [] },
    { name: '' }, { name: null }, { phone: ' ' }, { phone: 12 }, { email: false }, { email: 'invalid' },
    { name: 'x'.repeat(256) }, { phone: 'x'.repeat(51) }, { lineId: 'x'.repeat(101) },
    { name: 'bad\u0000name' }, { note: 'bad\u0000note' }, { note: 'x'.repeat(501) }, { facebook: 'x'.repeat(256) }]) {
    await assert.rejects(service.updateContact(7, 1, input), err => err.getStatus() === 400);
  }
  assert.equal(writes(), 0);
});
