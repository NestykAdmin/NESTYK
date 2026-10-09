const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const source = require('node:fs').readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  }, fileName: filename }).outputText, filename);
};
const {
  compareSchema,
  describeSchemaDrift,
  isSchemaDriftError,
  migrationsForDrift,
  uncoveredDrift,
} = require('../src/database/schema-drift.ts');

const col = (column, type, extra = {}) => ({ column, type, isArray: false, nullable: false, ...extra });
const db = (table, column, dataType, extra = {}) => ({ table, column, dataType, udtName: dataType, nullable: false, ...extra });

test('matching entities and columns report nothing; arrays and enums compare by kind', () => {
  const entities = [{ table: 'leads', columns: [
    col('id', 'integer'),
    col('locations', 'text', { isArray: true }),
    col('status', 'enum'),
    col('note', 'text', { nullable: true }),
  ] }];
  const columns = [
    db('leads', 'id', 'integer'),
    db('leads', 'locations', 'ARRAY', { udtName: '_text' }),
    db('leads', 'status', 'character varying'),
    db('leads', 'note', 'text', { nullable: true }),
  ];
  assert.deepEqual(compareSchema(entities, columns), []);
  assert.deepEqual(compareSchema(entities, [...columns.slice(0, 2), db('leads', 'status', 'USER-DEFINED', { udtName: 'lead_status' }), columns[3]]), []);
});

test('missing tables, missing columns, type and nullability mismatches are errors; extra DB columns only warn', () => {
  const entities = [
    { table: 'tenant_bills', columns: [col('id', 'integer')] },
    { table: 'leads', columns: [
      col('id', 'integer'),
      col('budget', 'numeric'),
      col('note', 'text', { nullable: true }),
      col('locations', 'text', { isArray: true }),
      col('phone', 'character varying'),
    ] },
  ];
  const issues = compareSchema(entities, [
    db('leads', 'id', 'integer'),
    db('leads', 'budget', 'integer'),
    db('leads', 'note', 'text'),
    db('leads', 'locations', 'text'),
    db('leads', 'legacy', 'text'),
  ]);
  assert.deepEqual(issues, [
    { kind: 'missing_table', table: 'tenant_bills' },
    { kind: 'type_mismatch', table: 'leads', column: 'budget', expected: 'numeric', actual: 'integer' },
    { kind: 'nullable_mismatch', table: 'leads', column: 'note', expected: true, actual: false },
    { kind: 'type_mismatch', table: 'leads', column: 'locations', expected: 'text[]', actual: 'text' },
    { kind: 'missing_column', table: 'leads', column: 'phone' },
    { kind: 'extra_column', table: 'leads', column: 'legacy' },
  ]);
  assert.deepEqual(issues.map(isSchemaDriftError), [true, true, true, true, true, false]);
  assert.equal(describeSchemaDrift(issues[0]), 'ขาดตาราง tenant_bills');
  assert.match(describeSchemaDrift(issues[2]), /entity: NULL ได้, ฐานข้อมูล: NOT NULL/);
});

test('missing tables and columns map to the migration files that create them, CREATE before ALTER', () => {
  const migrations = [
    { name: '20261006-tenant-bills.sql', sql: 'CREATE TABLE IF NOT EXISTS tenant_bills (\n  id SERIAL PRIMARY KEY\n);' },
    { name: '20261006-tenant-bill-invoice.sql', sql: 'ALTER TABLE tenant_bills\n  ADD COLUMN IF NOT EXISTS invoice_path TEXT;' },
    { name: '20260920-leads-phone.sql', sql: 'ALTER TABLE "public"."leads" ADD COLUMN phone VARCHAR(20);' },
    { name: '20260921-tenant-bills-archive.sql', sql: 'CREATE TABLE tenant_bills_archive (id INT);' },
    { name: '20260922-leads-note.sql', sql: 'ALTER TABLE leads ADD COLUMN phone_note TEXT;' },
  ];
  assert.deepEqual(migrationsForDrift([{ kind: 'missing_table', table: 'tenant_bills' }], migrations), [
    '20261006-tenant-bills.sql',
    '20261006-tenant-bill-invoice.sql',
  ]);
  assert.deepEqual(migrationsForDrift([{ kind: 'missing_column', table: 'leads', column: 'phone' }], migrations), [
    '20260920-leads-phone.sql',
  ]);
  assert.deepEqual(
    migrationsForDrift([{ kind: 'type_mismatch', table: 'leads', column: 'phone', expected: 'text', actual: 'integer' }], migrations),
    [],
  );
});

test('drift without a migration file is left uncovered; extra columns never count', () => {
  const migrations = [{ name: '20261006-tenant-bills.sql', sql: 'CREATE TABLE tenant_bills (id INT);' }];
  const issues = [
    { kind: 'missing_table', table: 'tenant_bills' },
    { kind: 'missing_table', table: 'payouts' },
    { kind: 'nullable_mismatch', table: 'leads', column: 'note', expected: true, actual: false },
    { kind: 'extra_column', table: 'leads', column: 'legacy' },
  ];
  assert.deepEqual(uncoveredDrift(issues, migrations), [issues[1], issues[2]]);
});
