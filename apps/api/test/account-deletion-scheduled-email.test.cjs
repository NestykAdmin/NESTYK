// D (Jom, 3 Nov 2026): the owner is told by email as soon as a deletion is scheduled, so a deletion someone else
// scheduled with a stolen session can be cancelled in time. Best effort: a failed send never undoes the schedule.
process.env.TZ = 'UTC';
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
const scheduledEmail = require('../src/auth/account-deletion-scheduled-email.ts');
const { AuthService } = require('../src/auth/auth.service.ts');

test('the message gives the Bangkok day in Thai and English, how to cancel, and what to do if it was not you', () => {
  const at = new Date('2026-12-02T17:00:00.000Z'); // 00:00 Bangkok, 3 Dec 2026
  const { subject, text } = scheduledEmail.accountDeletionScheduledMessage(at);
  assert.match(subject, /NESTYK/);
  assert.match(text, /3 ธันวาคม 2569/);
  assert.match(text, /3 December 2026/);
  assert.doesNotMatch(text, /2 ธันวาคม|2 December/);
  assert.match(text, /ยกเลิกการลบ/);
  assert.match(text, /Cancel deletion/);
  assert.match(text, /ไม่ได้เป็นคนขอ/);
  assert.match(text, /รหัสผ่าน/);
});

test('notify sends once to a real address, skips deleted or missing addresses, and swallows a failed send', async () => {
  const sent = [];
  const mailer = async (to, subject, text) => { sent.push({ to, subject, text }); };
  const at = new Date('2026-12-02T17:00:00.000Z');
  assert.equal(await scheduledEmail.notifyAccountDeletionScheduled('ann@example.test', at, mailer), true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'ann@example.test');
  for (const email of [null, '', 'deleted+5@users.invalid', 'no-at-sign']) assert.equal(await scheduledEmail.notifyAccountDeletionScheduled(email, at, mailer), false);
  assert.equal(sent.length, 1);
  assert.equal(await scheduledEmail.notifyAccountDeletionScheduled('ann@example.test', at, null), false, 'no mailer configured');
  assert.equal(await scheduledEmail.notifyAccountDeletionScheduled('ann@example.test', at, async () => { throw new Error('Resend down'); }), false);
});

function scheduling({ blocked = false, sendFails = false } = {}) {
  const events = [];
  scheduledEmail.notifyAccountDeletionScheduled = async (email, at) => {
    events.push(`email ${email} ${at.toISOString()}`);
    if (sendFails) throw new Error('should be caught inside notify, but never undoes the schedule');
    return true;
  };
  const db = { query: async (sql) => (/tenant_bills/.test(sql) ? [{ unpaid: blocked ? 1 : 0, review: 0 }] : /contract_deposit_settlements/.test(sql) ? [{ n: 0 }] : []) };
  const users = {
    update: async (_id, patch) => { events.push(`schedule ${patch.deletion_effective_at.toISOString()}`); },
    findOne: async () => ({ id: 5, email: 'ann@example.test' }),
  };
  return { auth: new AuthService(users, {}, {}, db), events };
}

test('scheduling a deletion emails the owner the day, after the schedule is saved; a blocked request sends nothing', async () => {
  const ok = scheduling();
  const { scheduledFor } = await ok.auth.scheduleAccountDeletion(5);
  assert.deepEqual(ok.events, [`schedule ${scheduledFor}`, `email ann@example.test ${scheduledFor}`]);

  const blocked = scheduling({ blocked: true });
  await assert.rejects(() => blocked.auth.scheduleAccountDeletion(5), (e) => e.getStatus() === 409);
  assert.deepEqual(blocked.events, []);

  const failing = scheduling({ sendFails: true });
  const result = await failing.auth.scheduleAccountDeletion(5);
  assert.ok(result.scheduledFor, 'the schedule stands even if the email could not be sent');
});
