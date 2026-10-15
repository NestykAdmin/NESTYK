// Loads supabase/seed/*.sql files into DATABASE_URL in one transaction.
// {{SUPABASE_URL}} in a seed is replaced with SUPABASE_URL (public URLs of demo room photos).
// Usage (from apps/api):
//   node scripts/db-seed.cjs [--env=.env.api] [--check] masters [demo]
//   --check  load, print row counts, then roll back
const path = require('node:path');
const fs = require('node:fs');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '../../..');
const envArg = process.argv.find((a) => a.startsWith('--env='));
require('dotenv').config({
  path: path.resolve(ROOT, envArg ? envArg.slice('--env='.length) : '.env.api'),
  quiet: true,
});

const check = process.argv.includes('--check');
const seeds = process.argv.slice(2).filter((a) => !a.startsWith('--'));

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  if (seeds.length === 0) throw new Error('Name at least one seed, e.g. masters demo');
  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const files = seeds.map((s) => path.resolve(ROOT, 'supabase/seed', `${s}.sql`));
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
    for (const file of files) {
      let sql = fs.readFileSync(file, 'utf8');
      if (sql.includes('{{SUPABASE_URL}}')) {
        if (!supabaseUrl) throw new Error(`SUPABASE_URL missing (needed by ${path.basename(file)})`);
        sql = sql.replaceAll('{{SUPABASE_URL}}', supabaseUrl);
      }
      await db.query(sql);
      await db.query('SET session_replication_role = origin');
      await db.query("SELECT pg_catalog.set_config('search_path', '\"$user\", public', true)");
      console.log(`Loaded ${path.basename(file)}`);
    }
    const counts = await db.query(`
      SELECT c.relname AS table, (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM public.%I', c.relname), false, true, '')))[1]::text::int AS rows
      FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
      ORDER BY 1`);
    console.log(
      counts.rows
        .filter((r) => r.rows > 0)
        .map((r) => `${r.table}=${r.rows}`)
        .join(' '),
    );
    if (check) {
      await db.query('ROLLBACK');
      console.log('Validated and rolled back.');
    } else {
      await db.query('COMMIT');
      console.log('Committed.');
    }
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error('db:seed failed:', error.code || error.name, error.message);
  process.exitCode = 1;
});
