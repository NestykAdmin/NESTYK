// Opt-in PostgreSQL checks for migration 20261126100000_self_owner_contracts.sql: a lease / tenancy points at an agent
// room (rent_rooms) or a self owner room (self_owner_rooms), exactly one of the two. LOCAL database only.
// Run: RUN_SELF_OWNER_CONTRACTS_DB_TEST=1 npm run test:self-owner-contracts-db (after db:push). Everything is rolled back.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Client } = require('pg');
require('dotenv').config({path:path.resolve(__dirname,'../../../.env.api'),quiet:true});

const localHost = (url) => { try { return ['127.0.0.1','localhost'].includes(new URL(url).hostname); } catch { return false; } };

test('PostgreSQL: lease and tenancy of a self owner room',
  {skip:process.env.RUN_SELF_OWNER_CONTRACTS_DB_TEST !== '1',timeout:60000},async (t) => {
  const url = process.env.DATABASE_URL || '';
  assert.ok(localHost(url), 'DATABASE_URL must point at 127.0.0.1 or localhost (local database only)');
  const client = new Client({connectionString:url,connectionTimeoutMillis:10000,ssl:false});
  await client.connect();
  const bad = async (sql, values=[], code='23514') => {
    await client.query('SAVEPOINT invalid_operation');
    try { await assert.rejects(()=>client.query(sql,values),error=>error.code===code); }
    finally { await client.query('ROLLBACK TO SAVEPOINT invalid_operation'); await client.query('RELEASE SAVEPOINT invalid_operation'); }
  };
  const one = async (sql, values=[]) => (await client.query(sql,values)).rows[0];
  try {
    await client.query('BEGIN');
    const user = (await one("INSERT INTO users(email) VALUES('t1-owner-'||extract(epoch from clock_timestamp())::text||'@example.test') RETURNING id")).id;
    const property = (await one("INSERT INTO properties(name,address,district,province) VALUES('T1 building','1 Test Rd','Test','Test') RETURNING id")).id;
    const status = (await one('SELECT id FROM master_room_statuses ORDER BY id LIMIT 1')).id;
    const template = (await one("SELECT id FROM agreement_templates WHERE form_kind='lease' ORDER BY id LIMIT 1")).id;
    const selfRoom = async (name) => (await one(`INSERT INTO self_owner_rooms(owner_user_id,properties_id,room_status_id,room_name,bedrooms,bathrooms,contact_name,contact_phone)
      VALUES($1,$2,$3,$4,1,1,'T1','0800000000') RETURNING id`,[user,property,status,name])).id;
    const roomA = await selfRoom('T1 A'), roomB = await selfRoom('T1 B');
    const agentRoom = (await one(`INSERT INTO rent_rooms(properties_id,room_status_id,is_scout_room,created_by_user_id,visibility)
      VALUES($1,$2,true,$3,'private') RETURNING id`,[property,status,user])).id;
    const lead = (await one("INSERT INTO leads(name,phone,created_by_user_id) VALUES('T1 lead','0800000001',$1) RETURNING id",[user])).id;
    const tenant = (await one("INSERT INTO tenants(lead_id,name,phone,created_by_user_id) VALUES($1,'T1 tenant','0800000001',$2) RETURNING id",[lead,user])).id;

    const tenancy = async (rent, self, status='prospect') => (await one(
      'INSERT INTO room_tenancies(rent_room_id,self_owner_room_id,tenant_id,created_by_user_id,status) VALUES($1,$2,$3,$4,$5) RETURNING id',
      [rent,self,tenant,user,status])).id;
    const lease = async (rent, self, extra={}) => {
      const e = {kind:'new',previous:null,root:null,start:'2026-01-01',end:'2026-12-31',deposit:20000,...extra};
      return (await one(`INSERT INTO lease_contracts(room_tenancy_id,rent_room_id,self_owner_room_id,tenant_id,lead_id,created_by_user_id,
          template_id,start_date,end_date,deposit,agreement_kind,previous_agreement_id,root_agreement_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [e.tenancy,rent,self,tenant,lead,user,template,e.start,e.end,e.deposit,e.kind,e.previous,e.root])).id;
    };
    const plainTenancy = await tenancy(agentRoom,null);

    await t.test('lease with both rooms is refused',async () => {
      await bad('INSERT INTO lease_contracts(room_tenancy_id,rent_room_id,self_owner_room_id,tenant_id,lead_id,created_by_user_id,template_id,start_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [plainTenancy,agentRoom,roomA,tenant,lead,user,template,'2026-01-01']);
    });
    await t.test('lease with no room is refused',async () => {
      await bad('INSERT INTO lease_contracts(room_tenancy_id,rent_room_id,self_owner_room_id,tenant_id,lead_id,created_by_user_id,template_id,start_date) VALUES($1,NULL,NULL,$2,$3,$4,$5,$6)',
        [plainTenancy,tenant,lead,user,template,'2026-01-01']);
    });
    await t.test('lease with only a self owner room is stored',async () => {
      const id = await lease(null,roomA,{tenancy:await tenancy(null,roomA)});
      const row = await one('SELECT rent_room_id, self_owner_room_id FROM lease_contracts WHERE id=$1',[id]);
      assert.deepEqual(row,{rent_room_id:null,self_owner_room_id:roomA});
    });
    await t.test('agent lease with only a rent room still stores',async () => {
      const id = await lease(agentRoom,null,{tenancy:plainTenancy});
      const row = await one('SELECT rent_room_id, self_owner_room_id FROM lease_contracts WHERE id=$1',[id]);
      assert.deepEqual(row,{rent_room_id:agentRoom,self_owner_room_id:null});
    });
    await t.test('two active tenancies of one self owner room are refused',async () => {
      await tenancy(null,roomB,'active');
      await bad("INSERT INTO room_tenancies(rent_room_id,self_owner_room_id,tenant_id,created_by_user_id,status) VALUES(NULL,$1,$2,$3,'active')",[roomB,tenant,user],'23505');
    });

    // A source lease with a draft settlement; renewal(source, room) is its renewal on a given self owner room (one renewal per source).
    const makeSource = async () => {
      const id = await lease(null,roomA,{tenancy:await tenancy(null,roomA)});
      await client.query("INSERT INTO contract_deposit_settlements(lease_contract_id,created_by_user_id,decision_note) VALUES($1,$2,'T1')",[id,user]);
      return id;
    };
    const renewal = async (source, room) => lease(null,room,{tenancy:await tenancy(null,room),kind:'renewal',previous:source,root:source,start:'2027-01-01',end:'2027-12-31',deposit:25000});
    const transferSql = 'INSERT INTO contract_deposit_transfers(from_contract_id,to_contract_id,amount,created_by_user_id) VALUES($1,$2,1000,$3)';

    await t.test('deposit transfer across two self owner rooms is refused',async () => {
      const source = await makeSource();
      await bad(transferSql,[source,await renewal(source,roomB),user]);
    });
    let transferred;
    await t.test('deposit transfer within one self owner room passes the room check',async () => {
      const source = await makeSource();
      transferred = await renewal(source,roomA);
      await client.query(transferSql,[source,transferred,user]);
      assert.equal((await one('SELECT count(*)::int n FROM contract_deposit_transfers WHERE to_contract_id=$1 AND status=\'pending\'',[transferred])).n,1);
    });
    await t.test('contract room change with a pending transfer is refused',async () => {
      await bad('UPDATE lease_contracts SET self_owner_room_id=$1 WHERE id=$2',[roomB,transferred]);
    });
  } finally { await client.query('ROLLBACK'); await client.end(); }
});
