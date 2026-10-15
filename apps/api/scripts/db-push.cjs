// Applies pending supabase/migrations/<version>_<name>.sql to DATABASE_URL in one transaction and records them
// in supabase_migrations.schema_migrations (same table the Supabase CLI uses, so `supabase db push` agrees later).
// Usage (from apps/api):
//   node scripts/db-push.cjs [--env=.env.api] [--check] [--mark-applied]
//   --check         run everything, then roll back
//   --mark-applied  record pending versions without running them (DB already has the schema, e.g. local docker)
const path = require('node:path');
const fs = require('node:fs');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '../../..');
const envArg = process.argv.find((a) => a.startsWith('--env='));
require('dotenv').config({
  path: path.resolve(ROOT, envArg ? envArg.slice('--env='.length) : '.env.api'),
  quiet: true,
});

const MIGRATIONS_DIR = path.resolve(ROOT, 'supabase/migrations');
const check = process.argv.includes('--check');
const markOnly = process.argv.includes('--mark-applied');

function listMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{14}_.+\.sql$/.test(f))
    .sort()
    .map((file) => {
      const [, version, name] = file.match(/^(\d{14})_(.+)\.sql$/);
      return { file, version, name };
    });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  const db = new Client({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
  });
  console.log(`Target: ${new URL(url).hostname}${check ? ' (check only)' : ''}`);
  await db.connect();
  try {
    await db.query('BEGIN');
    await db.query("SET LOCAL lock_timeout = '10s'");
    await db.query("SET LOCAL statement_timeout = '120s'");
    await db.query('CREATE SCHEMA IF NOT EXISTS supabase_migrations');
    await db.query(`
      CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
        version text PRIMARY KEY,
        statements text[],
        name text
      )`);
    const applied = new Set(
      (await db.query('SELECT version FROM supabase_migrations.schema_migrations')).rows.map(
        (r) => r.version,
      ),
    );
    const pending = listMigrations().filter((m) => !applied.has(m.version));
    if (pending.length === 0) {
      await db.query('ROLLBACK');
      console.log('No pending migrations.');
      return;
    }
    for (const m of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, m.file), 'utf8');
      if (!markOnly) {
        await db.query(sql);
        await db.query("SELECT pg_catalog.set_config('search_path', '\"$user\", public', true)");
      }
      await db.query(
        'INSERT INTO supabase_migrations.schema_migrations (version, statements, name) VALUES ($1, $2, $3)',
        [m.version, markOnly ? [] : [sql], m.name],
      );
      console.log(`${markOnly ? 'Marked' : 'Applied'} ${m.file}`);
    }
    if (check) {
      await db.query('ROLLBACK');
      console.log('Validated and rolled back.');
    } else {
      await db.query('COMMIT');
      console.log(`Committed ${pending.length} migration(s).`);
    }
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error('db:push failed:', error.code || error.name, error.message);
  process.exitCode = 1;
});
