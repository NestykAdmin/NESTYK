const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename,
}).outputText, filename);
const { RenterContactsService, renterContactKind } = require('../src/agent/contacts/renter-contacts.service.ts');

function fixture(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(`
    CREATE TABLE leads (id INTEGER PRIMARY KEY, created_by_user_id INTEGER, tenant_id INTEGER,
      name TEXT, first_name TEXT, last_name TEXT, phone TEXT, email TEXT, notes TEXT, other_contacts TEXT,
      status TEXT DEFAULT 'new', budget_min INTEGER DEFAULT 10000, match_settings TEXT DEFAULT '{}');
    CREATE TABLE tenants (id INTEGER PRIMARY KEY, created_by_user_id INTEGER, lead_id INTEGER UNIQUE,
      name TEXT, first_name TEXT, last_name TEXT, phone TEXT, email TEXT, note TEXT, identity_number TEXT DEFAULT 'ID-keep');
    CREATE TABLE room_tenancies (tenant_id INTEGER, status TEXT, move_in_date TEXT, created_by_user_id INTEGER);
    CREATE TABLE agreement_templates (id INTEGER PRIMARY KEY, form_kind TEXT);
    CREATE TABLE lease_contracts (tenant_id INTEGER, created_by_user_id INTEGER, template_id INTEGER,
      status TEXT, owner_signed_at TEXT, tenant_signed_at TEXT, agent_signed_at TEXT, party_snapshot TEXT DEFAULT 'keep-original');
    INSERT INTO agreement_templates VALUES (1,'lease'),(2,'reservation'),(3,'renewal');
  `);
  let failTenant = false;
  const locks = [];
  const table = entity => entity.name === 'LeadEntity' ? 'leads' : 'tenants';
  const manager = {
    findOne: async (entity, options) => {
      if (options.lock) locks.push(entity.name);
      const row = db.prepare(`SELECT * FROM ${table(entity)} WHERE ${Object.keys(options.where).map(k => `${k}=?`).join(' AND ')}`).get(...Object.values(options.where));
      if (row && entity.name === 'LeadEntity') row.other_contacts = JSON.parse(row.other_contacts);
      return row || null;
    },
    update: async (entity, where, values) => {
      if (failTenant && entity.name === 'TenantEntity') throw new Error('Tenant write failed');
      const result = db.prepare(`UPDATE ${table(entity)} SET ${Object.keys(values).map(k => `${k}=?`).join(',')} WHERE ${Object.keys(where).map(k => `${k}=?`).join(' AND ')}`)
        .run(...Object.entries(values).map(([key, value]) => key === 'other_contacts' ? JSON.stringify(value) : value), ...Object.values(where));
      return { affected: result.changes };
    },
  };
  const service = new RenterContactsService({ manager, query: async (sql, params) => db.prepare(sql).all({ '1': params[0] }),
    transaction: async fn => { db.exec('BEGIN'); try { const result = await fn(manager); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } } });
  function lead(id, agent = 7) {
    db.prepare('INSERT INTO leads (id,created_by_user_id,name,first_name,last_name,phone,email,notes,other_contacts) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, agent, `Person ${id}`, 'Person', String(id), `080${id}`, 'old@example.com', 'Original note', JSON.stringify([
        { channel: 'line', value: 'old-line' }, { channel: 'whatsapp', value: 'keep-wa' }, { channel: 'facebook', value: 'old-fb' },
      ]));
  }
  function tenant(id, leadId, agent = 7) {
    db.prepare('INSERT INTO tenants (id,created_by_user_id,lead_id,name,first_name,last_name,phone,email,note) SELECT ?,?,id,name,first_name,last_name,phone,email,notes FROM leads WHERE id=?').run(id, agent, leadId);
    db.prepare('UPDATE leads SET tenant_id=?, status=? WHERE id=?').run(id, 'booked', leadId);
  }
  const stay = (id, status, moveIn = null, agent) => db.prepare('INSERT INTO room_tenancies VALUES (?,?,?,?)')
    .run(id, status, moveIn, agent ?? db.prepare('SELECT created_by_user_id FROM tenants WHERE id=?').get(id).created_by_user_id);
  const lease = (id, status, template = 1, signed = true, agent = 7) => db.prepare('INSERT INTO lease_contracts (tenant_id,created_by_user_id,template_id,status,owner_signed_at,tenant_signed_at,agent_signed_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, agent, template, status, signed ? '2026-01-01' : null, signed ? '2026-01-01' : null, signed ? '2026-01-01' : null);
  return { db, service, lead, tenant, stay, lease, locks, failTenant: () => { failTenant = true; } };
}
const ids = rows => rows.map(r => r.id).sort((a, b) => a - b);

test('Lead means room seeker; Tenant includes current and former renters but excludes booking-only prospects', async t => {
  const f = fixture(t);
  for (let i = 1; i <= 12; i++) { f.lead(i); if (i > 1) f.tenant(100 + i, i); }
  f.stay(102, 'prospect'); f.stay(103, 'active'); f.stay(104, 'moved_out', '2025-01-01');
  f.lease(105, 'expired'); f.lease(106, 'terminated', 3); f.lease(107, 'cancelled');
  f.lease(108, 'cancelled', 1, false); f.stay(108, 'moved_out');
  f.lease(109, 'active', 2); f.lease(110, 'draft'); f.lease(111, 'active');
  f.lease(112, 'active', 1, true, 8);
  f.lead(13, 8); f.tenant(113, 13, 8); f.stay(113, 'active');
  assert.deepEqual(ids(await f.service.list(7, 'lead')), [1, 2, 8, 9, 10, 12]);
  assert.deepEqual(ids(await f.service.list(7, 'tenant')), [103, 104, 105, 106, 107, 111]);
  assert.deepEqual(ids(await f.service.list(8, 'tenant')), [113]);
});

test('Tenant never returns to Lead after move-out, expiry, termination or cancellation', async t => {
  const f = fixture(t);
  f.lead(1); f.tenant(101, 1); f.stay(101, 'active', '2026-01-01'); f.lease(101, 'active');
  for (const status of ['active', 'expired', 'terminated', 'cancelled']) {
    f.db.prepare('UPDATE lease_contracts SET status=?').run(status);
    if (status !== 'active') f.db.exec("UPDATE room_tenancies SET status='moved_out'");
    assert.deepEqual(ids(await f.service.list(7, 'tenant')), [101]);
    assert.deepEqual(await f.service.list(7, 'lead'), []);
  }
});

for (const kind of ['lead', 'tenant']) test(`${kind} edits update both profiles without changing preferences, rental history or documents`, async t => {
  const f = fixture(t);
  f.lead(1); f.tenant(101, 1); f.lease(101, 'expired');
  const updated = await f.service.update(7, kind, kind === 'lead' ? 1 : 101, {
    name: ' New Name ', phone: '+66 812 345 678', email: 'new@example.com', lineId: 'new-line', facebook: 'new-fb', note: 'New note',
  });
  assert.equal(updated.name, 'New Name'); assert.equal(updated.phone, '+66812345678');
  const a = await f.service.get(7, 'lead', 1), b = await f.service.get(7, 'tenant', 101);
  assert.deepEqual({ ...a, id: 0 }, { ...b, id: 0 });
  assert.equal(a.lineId, 'new-line'); assert.equal(a.facebook, 'new-fb'); assert.equal(a.note, 'New note');
  const lead = f.db.prepare('SELECT * FROM leads WHERE id=1').get();
  assert.equal(lead.first_name, 'New'); assert.equal(lead.last_name, 'Name');
  assert.equal(lead.budget_min, 10000); assert.equal(lead.status, 'booked'); assert.equal(lead.tenant_id, 101);
  assert.deepEqual(JSON.parse(lead.other_contacts).find(c => c.channel === 'whatsapp'), { channel: 'whatsapp', value: 'keep-wa' });
  assert.equal(f.db.prepare('SELECT identity_number FROM tenants').get().identity_number, 'ID-keep');
  assert.equal(f.db.prepare('SELECT party_snapshot FROM lease_contracts').get().party_snapshot, 'keep-original');
  assert.deepEqual(f.locks, ['LeadEntity', 'TenantEntity']);
});

test('updates roll back both profiles together when the linked tenant write fails', async t => {
  const f = fixture(t); f.lead(1); f.tenant(101, 1); f.failTenant();
  await assert.rejects(f.service.update(7, 'tenant', 101, { name: 'Changed' }), /Tenant write failed/);
  assert.equal((await f.service.get(7, 'lead', 1)).name, 'Person 1');
  assert.equal((await f.service.get(7, 'tenant', 101)).name, 'Person 1');
});

test('profiles are scoped by agent; invalid patches cannot spoof identities or rental state', async t => {
  const f = fixture(t); f.lead(1, 8); f.tenant(101, 1, 8);
  for (const [kind, id] of [['lead', 1], ['tenant', 101]]) {
    await assert.rejects(f.service.get(7, kind, id), e => e.getStatus() === 404);
    await assert.rejects(f.service.update(7, kind, id, { name: 'Changed' }), e => e.getStatus() === 404);
  }
  for (const input of [null, {}, { id: 2 }, { status: 'active' }, { created_by_user_id: 7 }, { phone: '' }, { email: 'invalid' }, { phone: '+123' }]) {
    await assert.rejects(f.service.update(8, 'lead', 1, input), e => e.getStatus() === 400);
  }
  for (const invalid of ['owner', 'coAgent', "lead' OR 1=1"]) assert.throws(() => renterContactKind(invalid), e => e.getStatus() === 400);
});

test('returns all people rather than one page and supports clearing optional details', async t => {
  const f = fixture(t);
  for (let i = 1; i <= 55; i++) f.lead(i);
  assert.equal((await f.service.list(7, 'lead')).length, 55);
  await f.service.update(7, 'lead', 1, { email: null, lineId: '', facebook: null, note: '' });
  const row = await f.service.get(7, 'lead', 1);
  assert.equal(row.email, null); assert.equal(row.lineId, null); assert.equal(row.facebook, null); assert.equal(row.note, null);
});

test('adding contact channels respects the existing lead channel limit without losing saved channels', async t => {
  const f = fixture(t); f.lead(1);
  const channels = Array.from({ length: 5 }, (_, i) => ({ channel: 'other', value: `Keep ${i}` }));
  f.db.prepare('UPDATE leads SET other_contacts=? WHERE id=1').run(JSON.stringify(channels));
  await assert.rejects(f.service.update(7, 'lead', 1, { lineId: 'new-line', facebook: 'new-fb' }), e => e.getStatus() === 400);
  assert.deepEqual(JSON.parse(f.db.prepare('SELECT other_contacts FROM leads WHERE id=1').get().other_contacts), channels);
});

for (const kind of ['lead', 'tenant']) test(`${kind}: clearing LINE and Facebook removes every stored value for those channels`, async t => {
  const f = fixture(t); f.lead(1); f.tenant(101, 1);
  f.db.prepare('UPDATE leads SET other_contacts=? WHERE id=1').run(JSON.stringify([
    {channel:'line',value:'line-one'}, {channel:'line',value:'line-two'},
    {channel:'facebook',value:'fb-one'}, {channel:'facebook',value:'fb-two'},
    {channel:'whatsapp',value:'keep'},
  ]));
  const updated = await f.service.update(7, kind, kind === 'lead' ? 1 : 101, {lineId:null,facebook:''});
  assert.equal(updated.lineId, null); assert.equal(updated.facebook, null);
  assert.deepEqual(JSON.parse(f.db.prepare('SELECT other_contacts FROM leads WHERE id=1').get().other_contacts), [{channel:'whatsapp',value:'keep'}]);
});

test('another agent occupancy cannot promote a Lead to Tenant, including a recorded past move-in', async t => {
  const f = fixture(t); f.lead(1); f.tenant(101,1);
  f.stay(101,'active','2026-01-01',8);
  assert.deepEqual(ids(await f.service.list(7,'lead')),[1]);
  assert.deepEqual(await f.service.list(7,'tenant'),[]);
  f.db.exec("UPDATE room_tenancies SET status='moved_out'");
  assert.deepEqual(ids(await f.service.list(7,'lead')),[1]);
  assert.deepEqual(await f.service.list(7,'tenant'),[]);
  f.stay(101,'active','2026-02-01',7);
  assert.deepEqual(ids(await f.service.list(7,'tenant')),[101]);
});

test('editing one channel preserves other explicit values and unrelated channels', async t => {
  const f = fixture(t); f.lead(1);
  const channels=[{channel:'line',value:'first'},{channel:'line',value:'second'},{channel:'whatsapp',value:'keep'}];
  f.db.prepare('UPDATE leads SET other_contacts=? WHERE id=1').run(JSON.stringify(channels));
  await f.service.update(7,'lead',1,{lineId:'updated'});
  assert.deepEqual(JSON.parse(f.db.prepare('SELECT other_contacts FROM leads WHERE id=1').get().other_contacts),[{channel:'line',value:'updated'},...channels.slice(1)]);
});
