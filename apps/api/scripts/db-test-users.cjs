// Creates one QA login per role in Supabase Auth and links it to public.users + user_roles.
// Usage (from apps/api):
//   node scripts/db-test-users.cjs [--env=.env.api] [--check]
//   --check  show what would change, write nothing (no Supabase Auth calls that create or update)
// Needs in the env file: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   ALLOW_TEST_USERS=true (opt-in, keep it out of prod), TEST_USER_PASSWORD (8+ chars, shared by all QA logins)
//   optional TEST_USER_EMAIL_DOMAIN (default nestyk.test; the API's email checks need a dot in the domain)
// Safe to re-run: existing logins get the password reset to TEST_USER_PASSWORD and their roles set to exactly
// the list below. Only qa-<role>@<domain> accounts are touched.
//
// Role catalog transition (docs/ROLE-CHANGE-PLAN.md):
//   legacy catalog = master_roles has 'owner' (meaning landlord) and no 'landlord'
//   new catalog    = master_roles has 'landlord' (renamed from owner, same id); 'self_owner' arrives in round 2
// In the legacy catalog qa-landlord gets the legacy 'owner' row; after the rename that same row is 'landlord',
// so the account keeps the right role without a re-run. qa-self-owner shows "pending" until 'self_owner' exists.
// The role code 'owner' is retired for good after round 1 and is never assigned by this script in the new catalog.
const path = require('node:path');
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.resolve(__dirname, '../../..');
const envArg = process.argv.find((a) => a.startsWith('--env='));
require('dotenv').config({
  path: path.resolve(ROOT, envArg ? envArg.slice('--env='.length) : '.env.api'),
  quiet: true,
});
const check = process.argv.includes('--check');

/** Role code of the owner who lists rooms without an agent (decision D1 in docs/ROLE-CHANGE-PLAN.md). */
const SELF_OWNER_ROLE = 'self_owner';

const ACCOUNTS = [
  { key: 'guest', label: 'Guest', roles: () => ['guest'] },
  { key: 'tenant', label: 'Tenant', roles: () => ['guest', 'tenant'] },
  { key: 'landlord', label: 'Landlord', roles: (cat) => ['guest', cat.isNew ? 'landlord' : 'owner'] },
  { key: 'self-owner', label: 'Self Owner', roles: (cat) => (cat.isNew ? ['guest', SELF_OWNER_ROLE] : null) },
  { key: 'agent', label: 'Agent', roles: () => ['guest', 'agent'] },
  { key: 'admin', label: 'Admin', roles: () => ['guest', 'admin'] },
];

function env(name) {
  return (process.env[name] ?? '').trim().replace(/^['"]|['"]$/g, '');
}

function fail(message) {
  console.error(`db:test-users: ${message}`);
  process.exit(1);
}

async function findAuthUser(admin, email) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`list auth users: ${error.message}`);
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureAuthUser(admin, email, password, name) {
  const existing = await findAuthUser(admin, email);
  if (check) return { id: existing?.id ?? null, action: existing ? 'auth: reset password' : 'auth: create' };
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (error) throw new Error(`update ${email}: ${error.message}`);
    return { id: existing.id, action: 'auth: password reset' };
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error || !data.user) throw new Error(`create ${email}: ${error?.message ?? 'no user returned'}`);
  return { id: data.user.id, action: 'auth: created' };
}

async function main() {
  const dbUrl = env('DATABASE_URL');
  const supaUrl = env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const password = env('TEST_USER_PASSWORD');
  const domain = (env('TEST_USER_EMAIL_DOMAIN') || 'nestyk.test').toLowerCase();
  if (env('ALLOW_TEST_USERS') !== 'true') fail('ALLOW_TEST_USERS=true is not set in the env file (never set it for prod)');
  if (!dbUrl || !supaUrl || !serviceKey) fail('DATABASE_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  if (password.length < 8) fail('TEST_USER_PASSWORD must be at least 8 characters');
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) fail(`TEST_USER_EMAIL_DOMAIN "${domain}" needs a dot (API email checks reject it otherwise)`);

  console.log(`Target: ${new URL(supaUrl).hostname} / ${new URL(dbUrl).hostname}${check ? ' (check only)' : ''}`);
  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const db = new Client({
    connectionString: dbUrl,
    ssl: /localhost|127\.0\.0\.1|host=\//.test(dbUrl) ? false : { rejectUnauthorized: false },
  });
  await db.connect();
  try {
    const roleRows = (await db.query('SELECT id, name FROM public.master_roles')).rows;
    const roleId = new Map(roleRows.map((r) => [r.name, r.id]));
    const cat = { isNew: roleId.has('landlord') };
    console.log(`Role catalog: ${cat.isNew ? 'new (landlord)' : "legacy ('owner' means landlord)"}`);

    const report = [];
    let failed = 0;
    for (const [i, acc] of ACCOUNTS.entries()) {
      const email = `qa-${acc.key}@${domain}`;
      const wanted = acc.roles(cat);
      if (!wanted) {
        report.push({ email, roles: '-', result: `pending: needs role "${SELF_OWNER_ROLE}" (round 2 of docs/ROLE-CHANGE-PLAN.md)` });
        continue;
      }
      const missing = wanted.filter((r) => !roleId.has(r));
      if (missing.length) {
        report.push({ email, roles: wanted.join(','), result: `pending: master_roles has no ${missing.join(', ')}` });
        continue;
      }
      const name = `QA ${acc.label}`;
      try {
        const auth = await ensureAuthUser(admin, email, password, name);
        const notes = [auth.action];

        if (check) {
          const row = (await db.query('SELECT id FROM public.users WHERE email = $1', [email])).rows[0];
          notes.push(row ? 'users: exists' : 'users: insert');
          if (row) {
            const extra = (await db.query(
              `SELECT r.name FROM public.user_roles ur JOIN public.master_roles r ON r.id = ur.role_id
                WHERE ur.user_id = $1 AND NOT (r.name = ANY($2::text[])) ORDER BY r.id`,
              [row.id, wanted],
            )).rows.map((r) => r.name);
            if (extra.length) notes.push(`roles: would remove ${extra.join(', ')}`);
          }
          report.push({ email, roles: wanted.join(','), result: notes.join(' · ') });
          continue;
        }

        await db.query('BEGIN');
        try {
          const byEmail = (await db.query('SELECT id, supabase_user_id FROM public.users WHERE email = $1 FOR UPDATE', [email])).rows[0];
          const byAuth = (await db.query('SELECT id, email FROM public.users WHERE supabase_user_id = $1 FOR UPDATE', [auth.id])).rows[0];
          if (byAuth && (!byEmail || byAuth.id !== byEmail.id))
            throw new Error(`${email}: auth id already linked to users.id=${byAuth.id} (${byAuth.email})`);
          let userId;
          if (byEmail) {
            userId = byEmail.id;
            await db.query(
              `UPDATE public.users SET supabase_user_id = $2, first_name = 'QA', last_name = $3,
                 phone = COALESCE(phone, $4), profile_completed = true WHERE id = $1`,
              [userId, auth.id, acc.label, `0990000${String(i + 1).padStart(3, '0')}`],
            );
            notes.push(byEmail.supabase_user_id === auth.id ? 'users: kept' : 'users: relinked to auth id');
          } else {
            userId = (await db.query(
              `INSERT INTO public.users (supabase_user_id, email, first_name, last_name, phone, profile_completed)
               VALUES ($1, $2, 'QA', $3, $4, true) RETURNING id`,
              [auth.id, email, acc.label, `0990000${String(i + 1).padStart(3, '0')}`],
            )).rows[0].id;
            notes.push('users: inserted');
          }
          const ids = wanted.map((r) => roleId.get(r));
          const removed = await db.query(
            'DELETE FROM public.user_roles WHERE user_id = $1 AND NOT (role_id = ANY($2::int[]))',
            [userId, ids],
          );
          for (const id of ids)
            await db.query('INSERT INTO public.user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, id]);
          if (removed.rowCount) notes.push(`roles: removed ${removed.rowCount} extra`);
          await db.query('COMMIT');
        } catch (error) {
          await db.query('ROLLBACK').catch(() => {});
          throw error;
        }
        report.push({ email, roles: wanted.join(','), result: notes.join(' · ') });
      } catch (error) {
        failed += 1;
        report.push({ email, roles: wanted.join(','), result: `ERROR: ${error.message}` });
      }
    }
    console.table(report);
    if (failed) {
      console.error(`${failed} account(s) failed — see ERROR rows above; the others were processed.`);
      process.exitCode = 1;
    }
    if (!check) console.log('Password for every account: the TEST_USER_PASSWORD value in the env file.');
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error('db:test-users failed:', error.message);
  process.exitCode = 1;
});
