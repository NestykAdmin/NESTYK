// Aof (QA) confirmed 3 Nov 2026: an account can be deleted only when no agreement holds it, in any role (tenant,
// landlord, or the agent who manages the deal). The rule itself is agreement-hold.ts (agreement-hold.test.cjs).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename,
  }).outputText, filename);
};
const { AuthService } = require('../src/auth/auth.service.ts');
const { bangkokToday } = require('../src/billing/rent-schedule.ts');

/** Bangkok today moved by whole months (dates in fixtures are relative, so the 11/13-month cases never go stale). */
function monthsAgo(n) {
  const [y, m, d] = bangkokToday().split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1 - n, d));
  return at.toISOString().slice(0, 10);
}
const agreement = (o) => ({ id: 1, form_kind: 'lease', status: 'active', start_date: monthsAgo(1), data: {},
  as_agent: false, as_party: false, lease_started: false, ...o });

function service({ agreements = [], unpaid = 0, review = 0, deposits = 0 } = {}) {
  const queries = [];
  const db = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (/tenant_bills/.test(sql)) return [{ unpaid, review }];
      if (/contract_deposit_settlements/.test(sql)) return [{ n: deposits }];
      return agreements;
    },
  };
  const users = { findOne: async () => ({ id: 5, deletion_effective_at: null }) };
  return { auth: new AuthService(users, {}, {}, db), queries };
}
const reasonsOf = async (options) => (await service(options).auth.deletionPreview(5)).reasons;

test('an agent with an open lease cannot delete (open_agent_contract); an agent with only cancelled drafts can', async () => {
  const { auth, queries } = service({ agreements: [agreement({ as_agent: true })] });
  assert.deepEqual(await auth.deletionPreview(5), { blocked: true, reasons: ['open_agent_contract'], scheduledFor: null, deleteNowAvailable: false });
  await assert.rejects(() => auth.scheduleAccountDeletion(5), (e) => e.getStatus() === 409 && e.getResponse().reasons.includes('open_agent_contract'));
  const sql = queries.find((q) => /lease_started/.test(q.sql));
  assert.ok(sql, 'one query reads the agreements of every role');
  assert.deepEqual(sql.params, [5]);
  assert.match(sql.sql, /c\.created_by_user_id = \$1 OR c\.owner_user_id = \$1 OR t\.user_id = \$1/);
  assert.match(sql.sql, /c\.status <> 'cancelled'/);
  assert.deepEqual(await reasonsOf({ agreements: [agreement({ as_agent: true, status: 'cancelled' }), agreement({ id: 2, as_agent: true, status: 'cancelled', form_kind: 'reservation' })] }), []);
});

test('a broker appointment holds the landlord and the agent for 1 year: 11 months cannot delete, 13 months can', async () => {
  const appointment = (months) => agreement({ form_kind: 'broker_appointment', start_date: monthsAgo(months), as_party: true });
  assert.deepEqual(await reasonsOf({ agreements: [appointment(11)] }), ['open_contract']);
  assert.deepEqual(await reasonsOf({ agreements: [appointment(13)] }), []);
  assert.deepEqual(await reasonsOf({ agreements: [{ ...appointment(11), as_party: false, as_agent: true }] }), ['open_agent_contract']);
});

test('an expired lease still waiting for a decision blocks; once the stay is released it does not', async () => {
  const lease = (data) => agreement({ status: 'expired', data, as_party: true });
  assert.deepEqual(await reasonsOf({ agreements: [lease({ undecided: { since: monthsAgo(1) } })] }), ['open_contract']);
  assert.deepEqual(await reasonsOf({ agreements: [lease({})] }), []);
});

test('a booking letter left active after its lease started does not block; one with no lease yet does', async () => {
  const letter = (lease_started) => agreement({ form_kind: 'reservation', as_party: true, lease_started });
  assert.deepEqual(await reasonsOf({ agreements: [letter(true)] }), []);
  assert.deepEqual(await reasonsOf({ agreements: [letter(false)] }), ['open_contract']);
});

test('an unpaid bill and a bill whose slip waits for the agent are told apart', async () => {
  assert.deepEqual(await reasonsOf({ unpaid: 1 }), ['unpaid_bill']);
  assert.deepEqual(await reasonsOf({ review: 1 }), ['bill_awaiting_review']);
  assert.deepEqual(await reasonsOf({ unpaid: 1, review: 2, deposits: 1 }), ['unpaid_bill', 'bill_awaiting_review', 'unrefunded_deposit']);
  const { auth, queries } = service();
  await auth.deletionPreview(5);
  const bills = queries.find((q) => /tenant_bills/.test(q.sql)).sql;
  assert.match(bills, /payment_slip_path IS NOT NULL AND b\.slip_submitted_at IS NOT NULL/);
});

// QA A2/D3: the "account deleted" email goes out only after the login and the profile are really gone.
const emailModule = require('../src/auth/account-deleted-email.ts');
function deletion({ loginError = null, failTransaction = false, avatar = null } = {}) {
  const events = [];
  const user = { id: 5, email: 'ann@example.test', supabase_user_id: 'sb-5', avatar_url: avatar };
  emailModule.notifyAccountDeleted = async (email) => { events.push(`email ${email}`); return true; };
  const counts = async (sql) => {
    events.push('check blockers');
    return /tenant_bills/.test(sql) ? [{ unpaid: 0, review: 0 }] : /contract_deposit_settlements/.test(sql) ? [{ n: 0 }] : [];
  };
  const db = {
    query: async () => { throw new Error('the checks must run inside the deletion transaction'); },
    transaction: async (fn) => {
      const saved = structuredClone(user);
      const manager = {
        query: counts,
        getRepository: () => ({
          findOne: async ({ lock }) => { events.push(`lock user ${lock?.mode}`); return structuredClone(user); },
          delete: async () => { events.push('remove roles'); },
          update: async (_id, patch) => {
            if (failTransaction) throw new Error('database down');
            events.push('anonymize user'); Object.assign(user, patch);
          },
        }),
      };
      try { return await fn(manager); } catch (e) { Object.assign(user, saved); throw e; }
    },
  };
  const avatars = { removeOwned: async (id, url) => { events.push(`remove photo ${id} ${url}`); return true; } };
  const auth = new AuthService({}, {}, {}, db, avatars);
  auth.adminClient = () => ({ auth: { admin: { deleteUser: async () => { events.push('delete login'); return { error: loginError }; } } } });
  return { auth, events, user };
}

test('the deleted email is sent after the login and the profile are gone, and never when deleting fails', async () => {
  const ok = deletion();
  assert.deepEqual(await ok.auth.deleteAccount(5), { deleted: true });
  assert.deepEqual(ok.events.filter((e) => !e.startsWith('check')), ['lock user pessimistic_write', 'delete login', 'remove roles', 'anonymize user', 'email ann@example.test']);

  const login = deletion({ loginError: { message: 'Supabase is down' } });
  await assert.rejects(() => login.auth.deleteAccount(5), (e) => e.getStatus() === 503);
  assert.ok(!login.events.some((e) => e.startsWith('email')), 'no email when the login could not be deleted');

  const profile = deletion({ failTransaction: true });
  await assert.rejects(() => profile.auth.deleteAccount(5), /database down/);
  assert.ok(!profile.events.some((e) => e.startsWith('email')), 'no email when the profile was not cleared');
});

test('A9: deletion locks the user row and checks the blockers inside that transaction; a second request sends nothing again', async () => {
  const h = deletion();
  await h.auth.deleteAccount(5);
  const lock = h.events.indexOf('lock user pessimistic_write');
  const check = h.events.indexOf('check blockers');
  assert.ok(lock >= 0 && check > lock, 'the blockers are read after the row lock, in the transaction');
  assert.ok(check < h.events.indexOf('delete login'));
  h.events.length = 0;
  // The second of two taps waits for the lock, then finds the account already deleted.
  assert.deepEqual(await h.auth.deleteAccount(5), { deleted: true });
  assert.deepEqual(h.events, ['lock user pessimistic_write'], 'no second login deletion, no second email');
});

test('the profile photo leaves the public bucket once the account is deleted, and only then', async () => {
  const url = 'https://x.supabase.co/storage/v1/object/public/profile-avatars/5/a.jpg';
  const ok = deletion({ avatar: url });
  await ok.auth.deleteAccount(5);
  assert.deepEqual(ok.events.slice(-2), ['email ann@example.test', `remove photo 5 ${url}`]);
  const failed = deletion({ avatar: url, failTransaction: true });
  await assert.rejects(() => failed.auth.deleteAccount(5));
  assert.ok(!failed.events.some((e) => e.startsWith('remove photo')));
  const none = deletion();
  await none.auth.deleteAccount(5);
  assert.ok(!none.events.some((e) => e.startsWith('remove photo')));
});

test('the scheduled deletion job runs on one API instance at a time (advisory lock)', async () => {
  const run = (locked) => {
    const calls = [];
    const runner = {
      connect: async () => calls.push('connect'),
      query: async (sql) => { calls.push(sql.includes('pg_try_advisory_lock') ? 'try lock' : sql.includes('pg_advisory_unlock') ? 'unlock' : sql); return [{ locked }]; },
      release: async () => calls.push('release'),
    };
    const qb = { where: () => qb, andWhere: () => qb, getMany: async () => { calls.push('find due'); return []; } };
    const auth = new AuthService({ createQueryBuilder: () => qb }, {}, {}, { createQueryRunner: () => runner });
    return { auth, calls };
  };
  const first = run(true);
  assert.equal(await first.auth.deleteDueAccounts(new Date()), 0);
  assert.deepEqual(first.calls, ['connect', 'try lock', 'find due', 'unlock', 'release']);
  const other = run(false);
  assert.equal(await other.auth.deleteDueAccounts(new Date()), 0);
  assert.deepEqual(other.calls, ['connect', 'try lock', 'release'], 'another instance holds the job: skip it');
});

// "Delete now" is for QA only (Jom, 3 Nov 2026): off unless ALLOW_IMMEDIATE_ACCOUNT_DELETION=true. A scheduled
// deletion retries itself the next night, so production keeps only that one.
test('delete now answers 404 unless ALLOW_IMMEDIATE_ACCOUNT_DELETION=true; the preview tells the app', async (t) => {
  const previous = process.env.ALLOW_IMMEDIATE_ACCOUNT_DELETION;
  t.after(() => { if (previous === undefined) delete process.env.ALLOW_IMMEDIATE_ACCOUNT_DELETION; else process.env.ALLOW_IMMEDIATE_ACCOUNT_DELETION = previous; });
  for (const value of [undefined, 'false', '1', 'TRUE']) {
    if (value === undefined) delete process.env.ALLOW_IMMEDIATE_ACCOUNT_DELETION; else process.env.ALLOW_IMMEDIATE_ACCOUNT_DELETION = value;
    const off = deletion();
    await assert.rejects(() => off.auth.deleteAccountNow(5), (e) => e.getStatus() === 404 && e.getResponse().code === 'IMMEDIATE_DELETION_UNAVAILABLE', String(value));
    assert.deepEqual(off.events, [], 'nothing is touched');
    assert.equal((await service().auth.deletionPreview(5)).deleteNowAvailable, false);
  }
  process.env.ALLOW_IMMEDIATE_ACCOUNT_DELETION = 'true';
  const on = deletion();
  assert.deepEqual(await on.auth.deleteAccountNow(5), { deleted: true });
  assert.ok(on.events.includes('delete login'));
  assert.equal((await service().auth.deletionPreview(5)).deleteNowAvailable, true);
  // The route goes through the switch; the scheduled job keeps calling deleteAccount itself.
  const controller = require('node:fs').readFileSync(require('node:path').join(__dirname, '../src/auth/auth.controller.ts'), 'utf8');
  assert.match(controller, /@Delete\('account'\)[\s\S]{0,200}?this\.authService\.deleteAccountNow\(user\.id\)/);
  const example = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../../.env.api.example'), 'utf8');
  assert.match(example, /^ALLOW_IMMEDIATE_ACCOUNT_DELETION=false$/m);
});
