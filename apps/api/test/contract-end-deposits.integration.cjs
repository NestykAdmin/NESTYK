// Opt-in PostgreSQL checks: disposable schema, synthetic fixtures, no customer data.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
require('dotenv').config({path:path.resolve(__dirname,'../../../.env.api'),quiet:true});

test('PostgreSQL: contract end reasons, deposit reconciliation and renewal transfers',
  {skip:process.env.RUN_CONTRACT_DEPOSIT_DB_TEST !== '1',timeout:60000},async () => {
  const schema = `contract_deposit_test_${Date.now()}_${process.pid}`;
  const client = new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000,
    ssl:/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '')?false:{rejectUnauthorized:false}});
  await client.connect();
  const bad = async (sql, values=[], code='23514') => {
    await client.query('SAVEPOINT invalid_operation');
    try { await assert.rejects(()=>client.query(sql,values),error=>error.code===code); }
    finally { await client.query('ROLLBACK TO SAVEPOINT invalid_operation'); await client.query('RELEASE SAVEPOINT invalid_operation'); }
  };
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}"`);
    await client.query(`CREATE TABLE users(id INTEGER PRIMARY KEY);
      INSERT INTO users VALUES(1);
      CREATE TABLE lease_contracts(
        id INTEGER PRIMARY KEY, status VARCHAR(40) NOT NULL,
        tenant_id INTEGER NOT NULL, rent_room_id INTEGER NOT NULL,
        agreement_kind VARCHAR(16) NOT NULL DEFAULT 'new', previous_agreement_id INTEGER,
        start_date DATE NOT NULL, end_date DATE, deposit DECIMAL(12,2)
      );
      INSERT INTO lease_contracts VALUES
        (1,'active',1,1,'new',NULL,'2026-01-01','2026-12-31',20000),
        (2,'draft',1,1,'renewal',1,'2027-01-01','2027-12-31',25000),
        (3,'terminated',1,1,'new',NULL,'2025-01-01','2025-12-31',20000),
        (4,'draft',2,1,'renewal',1,'2027-01-01','2027-12-31',25000),
        (5,'cancelled',3,2,'new',NULL,'2026-01-01','2026-12-31',0);`);
    const migration = fs.readFileSync(path.resolve(__dirname,'../migrations/20261009-contract-end-deposits.sql'),'utf8');
    await client.query(migration);
    await client.query(migration);
    assert.equal((await client.query('SELECT COUNT(*)::int n FROM master_contract_end_reasons')).rows[0].n,7);
    assert.equal((await client.query('SELECT end_reason_id FROM lease_contracts WHERE id=3')).rows[0].end_reason_id,null);
    const reasons = Object.fromEntries((await client.query('SELECT code,id FROM master_contract_end_reasons')).rows.map(r=>[r.code,r.id]));
    await bad("UPDATE lease_contracts SET status='expired' WHERE id=1");
    await bad("UPDATE lease_contracts SET end_reason_id=$1 WHERE id=1",[reasons.term_completed]);
    await bad("UPDATE lease_contracts SET status='terminated',end_reason_id=$1,effective_end_date='2026-10-01',end_recorded_at=NOW() WHERE id=1",[reasons.other_termination]);
    await client.query("UPDATE master_contract_end_reasons SET is_active=FALSE WHERE code='contract_breach'");
    await bad("UPDATE lease_contracts SET status='terminated',end_reason_id=$1,end_reason_note='Evidence',effective_end_date='2026-10-01',end_recorded_at=NOW() WHERE id=1",[reasons.contract_breach]);
    await bad("UPDATE lease_contracts SET status='expired',end_reason_id=$1,effective_end_date='2026-12-30',end_recorded_at=NOW() WHERE id=1",[reasons.term_completed]);
    await client.query("UPDATE lease_contracts SET status='expired',end_reason_id=$1,effective_end_date=end_date,end_recorded_at=NOW() WHERE id=1",[reasons.term_completed]);
    await bad("UPDATE lease_contracts SET end_reason_id=NULL WHERE id=1");
    await bad("UPDATE master_contract_end_reasons SET name_th='Changed meaning' WHERE code='term_completed'");
    await client.query("UPDATE master_contract_end_reasons SET is_active=FALSE WHERE code='term_completed'");
    await client.query("UPDATE lease_contracts SET end_recorded_at=end_recorded_at WHERE id=1");
    await client.query("UPDATE master_contract_end_reasons SET is_active=TRUE WHERE code='term_completed'");
    await bad("DELETE FROM master_contract_end_reasons WHERE code='term_completed'",[],'23503');

    const settlement = (await client.query(`INSERT INTO contract_deposit_settlements
      (lease_contract_id,created_by_user_id,deposit_received_amount,available_deposit_amount,
        deduction_total,carried_forward_total,refund_amount,decision_note)
      VALUES(1,1,20000,20000,3000,17000,0,'Carry remaining deposit to renewal') RETURNING id`)).rows[0].id;
    await bad("INSERT INTO deposit_deduction_items(settlement_id,deduction_type,description,amount,evidence_reference) VALUES($1,'rent','Rent debt',3000,'')",[settlement]);
    await client.query("INSERT INTO deposit_deduction_items(settlement_id,deduction_type,description,amount,evidence_reference) VALUES($1,'rent','Rent debt',3000,'bill:test')",[settlement]);
    await bad("INSERT INTO deposit_deduction_items(settlement_id,deduction_type,description,amount,evidence_reference) VALUES($1,'rent','Invalid',-1,'bill:test')",[settlement]);
    await bad("INSERT INTO contract_deposit_transfers(from_contract_id,to_contract_id,amount,created_by_user_id) VALUES(1,4,17000,1)");
    await bad("INSERT INTO contract_deposit_transfers(from_contract_id,to_contract_id,amount,created_by_user_id) VALUES(1,2,26000,1)");
    const transfer = (await client.query("INSERT INTO contract_deposit_transfers(from_contract_id,to_contract_id,amount,created_by_user_id) VALUES(1,2,17000,1) RETURNING id")).rows[0].id;
    await bad("DELETE FROM contract_deposit_settlements WHERE id=$1",[settlement]);
    await bad("INSERT INTO contract_deposit_transfers(from_contract_id,to_contract_id,amount,created_by_user_id) VALUES(1,2,17000,1)",[],'23505');
    await bad("UPDATE contract_deposit_transfers SET status='completed',approved_by_user_id=1,approved_at=NOW(),transferred_at=NOW() WHERE id=$1",[transfer]);
    await bad("UPDATE lease_contracts SET tenant_id=9 WHERE id=2");
    await bad("UPDATE contract_deposit_settlements SET status='approved',approved_by_user_id=1,approved_at=NOW() WHERE id=$1",[settlement]);
    await client.query("UPDATE contract_deposit_settlements SET deposit_received_reference='receipt:test' WHERE id=$1",[settlement]);
    await bad("UPDATE contract_deposit_settlements SET status='approved',approved_by_user_id=1,approved_at=NOW(),deduction_total=0,refund_amount=3000 WHERE id=$1",[settlement]);
    await bad("UPDATE contract_deposit_settlements SET status='approved',approved_by_user_id=1,approved_at=NOW(),refund_amount=100 WHERE id=$1",[settlement]);
    await client.query("UPDATE contract_deposit_settlements SET status='approved',approved_by_user_id=1,approved_at=NOW() WHERE id=$1",[settlement]);
    await bad("UPDATE deposit_deduction_items SET amount=1 WHERE settlement_id=$1",[settlement]);
    await bad("DELETE FROM deposit_deduction_items WHERE settlement_id=$1",[settlement]);
    await bad("UPDATE contract_deposit_transfers SET status='cancelled' WHERE id=$1",[transfer]);
    await bad("UPDATE contract_deposit_settlements SET status='completed' WHERE id=$1",[settlement]);
    await bad("UPDATE contract_deposit_transfers SET status='completed',approved_by_user_id=1,approved_at=NOW(),transferred_at=NOW() WHERE id=$1",[transfer]);
    await client.query("UPDATE lease_contracts SET status='active' WHERE id=2");
    await client.query("UPDATE contract_deposit_transfers SET status='completed',approved_by_user_id=1,approved_at=NOW(),transferred_at=NOW() WHERE id=$1",[transfer]);
    await client.query("UPDATE contract_deposit_settlements SET status='completed' WHERE id=$1",[settlement]);
    await bad("UPDATE contract_deposit_transfers SET amount=16000 WHERE id=$1",[transfer]);
    await bad("DELETE FROM contract_deposit_transfers WHERE id=$1",[transfer]);
    await bad("UPDATE contract_deposit_settlements SET refund_amount=17000 WHERE id=$1",[settlement]);
    await bad("DELETE FROM contract_deposit_settlements WHERE id=$1",[settlement]);

    const nextSettlement = (await client.query(`INSERT INTO contract_deposit_settlements
      (lease_contract_id,created_by_user_id,deposit_received_amount,deposit_received_reference,
        available_deposit_amount,refund_amount,decision_note)
      VALUES(2,1,8000,'topup:test',25000,25000,'Return cash plus carried deposit') RETURNING id`)).rows[0].id;
    await bad("UPDATE contract_deposit_settlements SET status='approved',approved_by_user_id=1,approved_at=NOW() WHERE id=$1",[nextSettlement]);
    await client.query("UPDATE lease_contracts SET status='expired',end_reason_id=$1,effective_end_date=end_date,end_recorded_at=NOW() WHERE id=2",[reasons.term_completed]);
    await client.query("UPDATE contract_deposit_settlements SET status='approved',approved_by_user_id=1,approved_at=NOW() WHERE id=$1",[nextSettlement]);
    await bad("UPDATE contract_deposit_settlements SET status='completed' WHERE id=$1",[nextSettlement]);
    await bad("UPDATE contract_deposit_settlements SET status='draft' WHERE id=$1",[nextSettlement]);
    await client.query("UPDATE contract_deposit_settlements SET status='completed',refunded_at=NOW(),refund_reference='bank:test' WHERE id=$1",[nextSettlement]);
    await bad("UPDATE contract_deposit_settlements SET refund_reference='another-payment' WHERE id=$1",[nextSettlement]);
    const noDeposit = (await client.query("INSERT INTO contract_deposit_settlements(lease_contract_id,created_by_user_id,decision_note) VALUES(5,1,'No deposit was received') RETURNING id")).rows[0].id;
    await client.query("UPDATE contract_deposit_settlements SET status='approved',approved_by_user_id=1,approved_at=NOW() WHERE id=$1",[noDeposit]);
    await client.query("UPDATE contract_deposit_settlements SET status='completed' WHERE id=$1",[noDeposit]);
    // Rollback removes even the scratch schema; never touches configured public tables.
  } finally { await client.query('ROLLBACK'); await client.end(); }
});
