#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env.api"), quiet: true });

const tables = ["master_contract_end_reasons", "contract_deposit_settlements", "deposit_deduction_items", "contract_deposit_transfers"];
const columns = ["end_reason_id", "end_reason_note", "effective_end_date", "end_recorded_at", "end_recorded_by_user_id"];
const quote = value => '"' + value.replaceAll('"', '""') + '"';

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !["--check", "--apply"].includes(arg)) || (args.includes("--check") && args.includes("--apply"))) {
    throw new Error("Use --check (default) or --apply");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const schema = process.env.DB_SCHEMA || "public";
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000,
    ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false } });
  await client.connect();
  try {
    if (args.includes("--apply")) {
      await client.query("BEGIN");
      try {
        await client.query("SELECT set_config('search_path', $1, true)", [quote(schema)]);
        await client.query("SET LOCAL lock_timeout = '5s'");
        await client.query("SET LOCAL statement_timeout = '30s'");
        await client.query("SELECT pg_advisory_xact_lock(hashtext(current_schema()), hashtext('contract-end-deposits'))");
        await client.query(fs.readFileSync(path.resolve(__dirname, "../migrations/20261009-contract-end-deposits.sql"), "utf8"));
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; }
    }
    const foundTables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema=$1 AND table_name=ANY($2::text[])", [schema, tables]);
    const foundColumns = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='lease_contracts' AND column_name=ANY($2::text[])", [schema, columns]);
    const missingTables = tables.filter(name => !foundTables.rows.some(row => row.table_name === name));
    const missingColumns = columns.filter(name => !foundColumns.rows.some(row => row.column_name === name));
    console.log(JSON.stringify({ schema, applied: args.includes("--apply"), missingTables, missingColumns }, null, 2));
    if (missingTables.length || missingColumns.length) process.exitCode = 1;
  } finally { await client.end(); }
}
main().catch(error => { console.error("Contract deposit migration failed:", error.code || error.message); process.exitCode = 1; });
