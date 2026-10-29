// D4 (AC-3.6, 4.6, 5.5, 7.4 to 7.6, Aof 26 Oct 2026): when agents and landlords are reminded, in the app and by e-mail.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { dueReminders, reminderEmail, handoverDueDate } = require('../src/agent/reminders/contract-reminders.ts');
const { resendMailer } = require('../src/agent/reminders/reminder-email.ts');
const { ContractRemindersService } = require('../src/agent/reminders/contract-reminders.service.ts');
const { LeaseContractEntity } = require('../src/entities/lease-contract.entity.ts');
const { TenantBillEntity } = require('../src/entities/tenant-bill.entity.ts');
const { DealOfferEntity } = require('../src/entities/deal-offer.entity.ts');
const { UserEntity } = require('../src/entities/user.entity.ts');
const { ContractReminderEntity } = require('../src/entities/contract-reminder.entity.ts');
const { DealCancellationEntity } = require('../src/entities/deal-cancellation.entity.ts');
const { ContractDepositSettlementEntity } = require('../src/entities/contract-deposit-settlement.entity.ts');

const contract = (patch = {}) => ({
  id: 11, status: 'draft', formKind: 'reservation', createdAt: new Date('2026-10-09T18:00:00Z'), contractNo: 'RS202600011', tenantId: 2,
  tenantName: 'Tenant', property: 'Aria', room: '1201', startDate: '2026-11-01', endDate: null, effectiveEndDate: null, previousAgreementId: null,
  agentId: 7, landlordUserId: 9, data: {}, noticeDays: null, ...patch,
});
const kinds = (today, contracts, bills = []) => dueReminders(today, contracts, bills).map((r) => [r.kind, r.dueDate, r.recipients]);

test('TC-3.07: a letter made 10 Oct (Bangkok) is reminded from 14 Oct until everyone signed', () => {
  assert.deepEqual(kinds('2026-10-13', [contract()]), []);
  assert.deepEqual(kinds('2026-10-14', [contract()]), [['reservation_sign_late', '2026-10-13', [7]]]);
  assert.deepEqual(kinds('2026-10-20', [contract({ status: 'awaiting_signatures' })]), [['reservation_sign_late', '2026-10-13', [7]]]);
  for (const status of ['awaiting_agent_review', 'active']) assert.deepEqual(kinds('2026-10-20', [contract({ status })]), [], status);
});

test('TC-4.06: a lease signed on 25 Oct is reminded from 26 Oct while not signed by everyone', () => {
  const lease = (patch = {}) => contract({ formKind: 'lease', data: { leaseAgreement: { issueDate: '2026-10-25' } }, ...patch });
  assert.deepEqual(kinds('2026-10-25', [lease()]), []);
  assert.deepEqual(kinds('2026-10-26', [lease()]), [['lease_sign_late', '2026-10-25', [7]]]);
  assert.deepEqual(kinds('2026-10-26', [lease({ status: 'awaiting_agent_review' })]), []);
  assert.deepEqual(kinds('2026-10-26', [lease({ data: {} })]), [], 'no signing date');
});

test('TC-5.04: no deposit by the handover day (the lease start, or the day it was moved to) is reminded from that day', () => {
  const lease = (patch = {}) => contract({ formKind: 'lease', status: 'awaiting_deposit', startDate: '2026-11-01', ...patch });
  assert.deepEqual(kinds('2026-10-31', [lease()]), []);
  assert.deepEqual(kinds('2026-11-01', [lease()]), [['deposit_unpaid', '2026-11-01', [7]]]);
  const moved = lease({ data: { handoverDue: { date: '2026-11-05', history: [] } } });
  assert.equal(handoverDueDate(moved), '2026-11-05');
  assert.deepEqual(kinds('2026-11-04', [moved]), []);
  assert.deepEqual(kinds('2026-11-05', [moved]), [['deposit_unpaid', '2026-11-05', [7]]], 'a new day is a new reminder');
  assert.deepEqual(kinds('2026-11-05', [lease({ status: 'awaiting_handover' })]), [], 'paid');
});

test('TC-7.02, 7.03: rent after its grace day reminds the agent; from the 16th day after the due day the landlord too', () => {
  const lease = contract({ formKind: 'lease', status: 'active', endDate: '2027-10-31' });
  const bill = (patch = {}) => ({ id: 50, leaseContractId: 11, period: '2026-12', dueDate: '2026-12-01', graceUntil: '2026-12-05', amount: 20000, status: 'pending', ...patch });
  assert.deepEqual(kinds('2026-12-05', [lease], [bill()]), []);
  assert.deepEqual(kinds('2026-12-06', [lease], [bill()]), [['rent_overdue', '2026-12-05', [7]]]);
  assert.deepEqual(kinds('2026-12-16', [lease], [bill()]).map((r) => r[0]), ['rent_overdue'], '16 Dec: the 15th day is not over');
  assert.deepEqual(kinds('2026-12-17', [lease], [bill()]), [['rent_overdue_15', '2026-12-01', [7, 9]]]);
  assert.deepEqual(kinds('2026-12-17', [{ ...lease, landlordUserId: null }], [bill()]), [['rent_overdue_15', '2026-12-01', [7]]], 'no landlord account');
  assert.deepEqual(kinds('2026-12-20', [lease], [bill({ status: 'paid' })]), []);
  // H2 (Aof 29 Oct 2026): rent left unpaid is still chased after the lease ended; not after it was cancelled.
  assert.deepEqual(kinds('2026-12-10', [{ ...lease, status: 'terminated' }], [bill()]), [['rent_overdue', '2026-12-05', [7]]], 'ended early');
  assert.deepEqual(kinds('2026-12-20', [{ ...lease, status: 'expired' }], [bill()]), [['rent_overdue_15', '2026-12-01', [7, 9]]], 'ended');
  assert.deepEqual(kinds('2026-12-20', [{ ...lease, status: 'cancelled' }], [bill()]), [], 'not for a cancelled lease');
  const [r] = dueReminders('2026-12-17', [lease], [bill()]);
  assert.deepEqual([r.billId, r.billPeriod, r.amount], [50, '2026-12', 20000]);
});

test('TC-7.04, 7.05: the renewal reminder starts when as many days are left as the notice days (30 unless the offer says)', () => {
  const lease = (patch = {}) => contract({ formKind: 'lease', status: 'active', startDate: '2026-11-01', endDate: '2027-10-31', ...patch });
  assert.deepEqual(kinds('2027-09-30', [lease()]), [], '31 days left');
  assert.deepEqual(kinds('2027-10-01', [lease()]), [['renewal_notice', '2027-10-31', [7]]]);
  assert.deepEqual(kinds('2027-10-31', [lease()]).length, 1, 'still on the last day');
  assert.deepEqual(kinds('2027-11-01', [lease()]), [], 'ended');
  assert.deepEqual(kinds('2027-08-31', [lease({ noticeDays: 60 })]), []);
  assert.deepEqual(kinds('2027-09-01', [lease({ noticeDays: 60 })]).map((r) => r[0]), ['renewal_notice']);
  const renewal = contract({ id: 12, formKind: 'renewal', status: 'draft', previousAgreementId: 11 });
  assert.deepEqual(kinds('2027-10-01', [lease(), renewal]), [], 'a renewal is being made');
  assert.deepEqual(kinds('2027-10-01', [lease(), { ...renewal, status: 'cancelled' }]).map((r) => r[0]), ['renewal_notice']);
  assert.deepEqual(kinds('2027-10-01', [lease({ effectiveEndDate: '2027-01-15' })]), [], 'ended early');
});

test('TC-C.05, C.07: a refund told 15 Oct is due 22 Oct; the agent is reminded from 23 Oct until it is recorded', () => {
  const refund = { contractId: 30, agentId: 7, refundDueOn: '2026-10-22', amount: 60000, contractNo: 'LS30', tenantId: 2, tenantName: 'Tenant', property: 'Aria', room: '1201' };
  const due = (today) => dueReminders(today, [], [], [refund]).map((r) => [r.kind, r.contractId, r.dueDate, r.amount, r.recipients]);
  assert.deepEqual(due('2026-10-22'), []);
  assert.deepEqual(due('2026-10-23'), [['refund_late', 30, '2026-10-22', 60000, [7]]]);
  assert.deepEqual(due('2026-11-30'), [['refund_late', 30, '2026-10-22', 60000, [7]]], 'until recorded (the service passes only unrecorded ones)');
  const mail = reminderEmail(dueReminders('2026-10-23', [], [], [refund])[0]);
  assert.equal(mail.subject, '[NESTYK] เลยกำหนดคืนเงินให้ผู้เช่าแล้ว ยังไม่ได้บันทึกการคืน / Refund to the tenant overdue and not recorded');
  assert.ok(mail.text.includes('ยอดที่ต้องคืน: 60,000 บาท') && mail.text.includes('To refund: 60,000 THB') && mail.text.includes('ครบกำหนด: 22/10/2026'), mail.text);
});

test('the e-mail says what, which document, tenant and room, and the day', () => {
  const [r] = dueReminders('2026-12-17', [contract({ formKind: 'lease', status: 'active' })],
    [{ id: 50, leaseContractId: 11, period: '2026-12', dueDate: '2026-12-01', graceUntil: '2026-12-05', amount: 20000, status: 'pending' }]);
  const mail = reminderEmail(r);
  assert.equal(mail.subject, '[NESTYK] ค่าเช่าค้างชำระครบ 15 วัน / Rent 15 days overdue');
  for (const part of ['RS202600011', 'ผู้เช่า: Tenant', 'Aria ห้อง 1201', 'บิลรอบ: 2026-12 ยอด 20,000 บาท', 'ครบกำหนด: 01/12/2026', 'เปิดแอป NESTYK',
    'Tenant: Tenant', 'Room: Aria room 1201', 'Bill: 2026-12, 20,000 THB', 'Due: 01/12/2026', 'Open the NESTYK app'])
    assert.ok(mail.text.includes(part), part);
  assert.ok(mail.text.indexOf('ครบกำหนด') < mail.text.indexOf('— English —') && mail.text.indexOf('— English —') < mail.text.indexOf('Due:'), 'Thai first, then English');
  const renewal = reminderEmail({ ...r, kind: 'renewal_notice', billId: null, billPeriod: null, amount: null, dueDate: '2027-10-31' });
  assert.ok(renewal.text.includes('สัญญาสิ้นสุด: 31/10/2027') && renewal.text.includes('Lease ends: 31/10/2027') && !renewal.text.includes('Bill:'));
});

test('Resend: nothing without the key and the sender; with them one POST per e-mail, and a refusal is an error', async () => {
  assert.equal(resendMailer({}), null);
  assert.equal(resendMailer({ RESEND_API_KEY: 'k' }), null);
  const calls = [];
  const send = resendMailer({ RESEND_API_KEY: ' k ', REMINDER_EMAIL_FROM: 'NESTYK <noreply@example.test>' },
    async (url, init) => { calls.push([url, init]); return { ok: calls.length === 1, status: 422 }; });
  await send('agent@example.test', 'S', 'T');
  const [url, init] = calls[0];
  assert.equal(url, 'https://api.resend.com/emails');
  assert.equal(init.headers.Authorization, 'Bearer k');
  assert.deepEqual(JSON.parse(init.body), { from: 'NESTYK <noreply@example.test>', to: ['agent@example.test'], subject: 'S', text: 'T' });
  await assert.rejects(() => send('agent@example.test', 'S', 'T'), /Resend 422/);
});

// The daily job against an in-memory database: the unique index (kind, contract, bill, due day, recipient) is a Set.
function jobHarness({ mail = async () => {} } = {}) {
  const contracts = [{ id: 11, status: 'draft', created_at: new Date('2026-10-09T18:00:00Z'), contract_no: 'RS202600011', tenant_id: 2, lead_id: 1, rent_room_id: 3,
    created_by_user_id: 7, owner_user_id: 9, template: { form_kind: 'reservation' }, agreement_type: null, tenant: { name: 'Tenant' },
    rent_room: { room_id: '1201', property: { name: 'Aria' } }, party_snapshot: {}, data: {}, start_date: '2026-11-01', end_date: null, effective_end_date: null, previous_agreement_id: null }];
  const reminders = [], sent = [], seen = new Set();
  // D5: deal cancellations with a refund not recorded (refunded_on null and refund_amount > 0 is the service's query).
  const refunds = [];
  const refundQuery = () => {
    let agentId;
    const q = { leftJoinAndSelect: () => q, where: () => q, orderBy: () => q,
      andWhere: (_sql, params) => { agentId = params?.agentId; return q; },
      getMany: async () => refunds.filter((r) => r.refunded_on == null && (agentId == null || r.agent_user_id === agentId)) };
    return q;
  };
  let nextId = 1;
  const repos = new Map([
    [LeaseContractEntity, { find: async () => contracts }],
    [TenantBillEntity, { find: async () => [] }],
    [DealOfferEntity, { find: async () => [] }],
    [DealCancellationEntity, { createQueryBuilder: refundQuery }],
    [ContractDepositSettlementEntity, { find: async () => [] }],
    [UserEntity, { find: async ({ where }) => [{ id: 7, email: 'agent@example.test' }].filter((u) => where.id._value.includes(u.id)) }],
    [ContractReminderEntity, {
      find: async () => reminders.filter((r) => r.emailed_at == null).map((r) => ({ ...r })),
      update: async (where, patch) => {
        const row = reminders.find((r) => r.id === where.id && (!('emailed_at' in where) || r.emailed_at == null));
        if (row) Object.assign(row, patch);
        return { affected: row ? 1 : 0 };
      },
    }],
  ]);
  const db = {
    getRepository: (entity) => repos.get(entity) ?? assert.fail(`unexpected ${entity.name}`),
    createQueryBuilder: () => ({ insert: () => ({ into: (entity) => { assert.equal(entity, ContractReminderEntity); return { values: (rows) => ({ orIgnore: () => ({ execute: async () => {
      for (const row of rows) {
        const key = [row.kind, row.lease_contract_id, row.tenant_bill_id ?? 0, row.due_date, row.recipient_user_id].join(':');
        if (seen.has(key)) continue;
        seen.add(key); reminders.push({ ...row, id: nextId++, emailed_at: null, email_error: null, created_at: new Date() });
      }
    } }) }) }; } }) }),
  };
  const service = new ContractRemindersService(db);
  service.mailer = async (to, subject, text) => { sent.push([to, subject]); await mail(to, subject, text); };
  return { service, contracts, reminders, sent, refunds };
}

test('the daily job records each reminder once and e-mails it once, even when run again', async () => {
  const h = jobHarness();
  assert.deepEqual(await h.service.run('2026-10-14'), { due: 1, recorded: 1, emailed: 1 });
  assert.deepEqual(h.sent, [['agent@example.test', '[NESTYK] หนังสือจองเลยกำหนดลงนาม ตามให้ทุกฝ่ายลงนามให้ครบ / Booking letter past its signing date: follow up so everyone signs']]);
  assert.deepEqual(h.reminders.map((r) => [r.kind, r.lease_contract_id, r.due_date, r.recipient_user_id, !!r.emailed_at]),
    [['reservation_sign_late', 11, '2026-10-13', 7, true]]);
  await h.service.run('2026-10-15');
  assert.equal(h.reminders.length, 1, 'the same reminder is not added again');
  assert.equal(h.sent.length, 1, 'nor e-mailed again');
});

test('a failed e-mail is tried again on the next run; one done meanwhile is closed without sending', async () => {
  let fail = true;
  const h = jobHarness({ mail: async () => { if (fail) throw new Error('Resend 500'); } });
  assert.equal((await h.service.run('2026-10-14')).emailed, 0);
  assert.deepEqual([h.reminders[0].emailed_at, h.reminders[0].email_error], [null, 'Resend 500']);
  fail = false;
  assert.equal((await h.service.run('2026-10-15')).emailed, 1);
  const done = jobHarness({ mail: async () => { throw new Error('down'); } });
  await done.service.run('2026-10-14');
  done.contracts[0].status = 'awaiting_agent_review';
  await done.service.run('2026-10-15');
  assert.equal(done.reminders[0].email_error, 'resolved');
  assert.ok(done.reminders[0].emailed_at, 'closed, not tried again');
});

test('without a mail key the job only records; the app lists come from the current state', async () => {
  const h = jobHarness();
  const quiet = new ContractRemindersService(h.service.db);
  quiet.mailer = null;
  assert.deepEqual(await quiet.run('2026-10-14'), { due: 1, recorded: 1, emailed: 0 });
  assert.equal(h.reminders[0].emailed_at, null);
  assert.deepEqual((await quiet.forAgent(7, '2026-10-14')).map((r) => [r.kind, r.contractId, r.tenantName]), [['reservation_sign_late', 11, 'Tenant']]);
  assert.deepEqual(await quiet.forAgent(8, '2026-10-14'), [], 'another agent');
  assert.deepEqual(await quiet.forLandlord(9, '2026-10-14'), [], 'the landlord is told only about rent 15 days late');
});

test('a late refund is recorded and e-mailed once to the agent, and stops once the refund is recorded', async () => {
  const h = jobHarness();
  h.contracts.length = 0;
  h.refunds.push({ id: 1, agent_user_id: 7, lease_contract_id: 30, tenant_id: 2, refund_amount: '20000.00', refund_due_on: '2026-10-22', refunded_on: null,
    lease_contract: { contract_no: 'RS30', party_snapshot: {}, tenant: { name: 'Tenant' }, rent_room: { room_id: '1201', property: { name: 'Aria' } } } });
  assert.deepEqual(await h.service.run('2026-10-22'), { due: 0, recorded: 0, emailed: 0 });
  assert.deepEqual(await h.service.run('2026-10-23'), { due: 1, recorded: 1, emailed: 1 });
  assert.deepEqual(h.reminders.map((r) => [r.kind, r.lease_contract_id, r.tenant_bill_id, r.due_date, r.recipient_user_id]), [['refund_late', 30, null, '2026-10-22', 7]]);
  assert.deepEqual((await h.service.forAgent(7, '2026-10-23')).map((r) => [r.kind, r.contractNo, r.amount, r.tenantName, r.room]), [['refund_late', 'RS30', 20000, 'Tenant', '1201']]);
  assert.deepEqual(await h.service.forAgent(8, '2026-10-23'), [], 'another agent');
  assert.deepEqual(await h.service.forLandlord(9, '2026-10-23'), [], 'not the landlord');
  h.refunds[0].refunded_on = '2026-10-24';
  assert.deepEqual(await h.service.forAgent(7, '2026-10-25'), []);
});

test('reminder routes: the agent\'s needs the agent role, the landlord\'s the landlord role; Nest builds the real service', async (t) => {
  const { Module } = require('@nestjs/common');
  const { NestFactory } = require('@nestjs/core');
  const { DataSource } = require('typeorm');
  const { AgentRemindersController } = require('../src/agent/reminders/contract-reminders.controller.ts');
  const { PartyContractsController } = require('../src/agent/contracts/party-contracts.controller.ts');
  const { AgentContractsService } = require('../src/agent/contracts/agent-contracts.service.ts');
  const { AgreementAttachmentsService } = require('../src/agent/contracts/agreement-attachments.service.ts');
  const { AuthService } = require('../src/auth/auth.service.ts');
  const previous = process.env.ALLOW_DEV_AUTH; process.env.ALLOW_DEV_AUTH = 'true';
  t.after(() => { if (previous === undefined) delete process.env.ALLOW_DEV_AUTH; else process.env.ALLOW_DEV_AUTH = previous; });
  class TestModule {}
  Module({ controllers: [AgentRemindersController, PartyContractsController], providers: [
    ContractRemindersService,
    { provide: DataSource, useValue: {} },
    { provide: AgentContractsService, useValue: {} },
    { provide: AgreementAttachmentsService, useValue: {} },
    { provide: AuthService, useValue: { findBySupabaseUserId: async (id) => ({ id: Number(id) }),
      loadUserWithRoles: async (id) => ({ id, roleNames: id === 7 ? ['agent'] : id === 50 ? ['landlord'] : ['tenant'] }) } },
  ] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false }); await app.listen(0, '127.0.0.1'); t.after(() => app.close());
  const service = app.get(ContractRemindersService);
  const calls = [];
  service.forAgent = async (id) => { calls.push(['agent', id]); return []; };
  service.forLandlord = async (id) => { calls.push(['landlord', id]); return []; };
  const base = await app.getUrl();
  const as = (id) => ({ headers: { Authorization: `Bearer dev|${id}|u@example.invalid` } });
  assert.equal((await fetch(`${base}/agent/reminders`)).status, 401);
  assert.equal((await fetch(`${base}/agent/reminders`, as(50))).status, 403);
  assert.equal((await fetch(`${base}/agent/reminders`, as(7))).status, 200);
  assert.equal((await fetch(`${base}/contracts/mine/reminders`, as(9))).status, 403, 'a tenant');
  assert.equal((await fetch(`${base}/contracts/mine/reminders`, as(50))).status, 200);
  assert.deepEqual(calls, [['agent', 7], ['landlord', 50]]);
});

test('H2: the job reads ended leases too (their refunds and unpaid rent are still due), only cancelled ones are left out', async () => {
  let where;
  const db = { getRepository: (entity) => { assert.equal(entity, LeaseContractEntity); return { find: async (options) => { where = options.where; return []; } }; } };
  assert.deepEqual(await new ContractRemindersService(db).due('2027-12-01', { landlordUserId: 9 }), []);
  assert.equal(where.status.type, 'not');
  assert.equal(where.status.child.type, 'in');
  assert.deepEqual(where.status.child.value, ['cancelled']);
});

test('M2 (Aof 29 Oct 2026): refunds are reminded even before the agent starts them; L3: no renewal reminder for a leaving stay', () => {
  const lease = contract({ formKind: 'lease', status: 'active', startDate: '2026-11-01', endDate: '2027-10-31', deposit: 40000 });
  const at = (today, c, deposits = []) => dueReminders(today, [c], [], [], deposits).map((r) => [r.kind, r.dueDate, r.amount]);
  // Ends early on 15 Jan, no amount typed: from 23 Jan (7 days after).
  const early = { ...lease, data: { endsOn: { date: '2027-01-15', reason: 'x' } } };
  assert.deepEqual(at('2027-01-22', early), []);
  assert.deepEqual(at('2027-01-23', early).filter((r) => r[0] === 'early_end_refund_late'), [['early_end_refund_late', '2027-01-22', null]]);
  assert.deepEqual(at('2027-01-23', { ...early, data: { endsOn: { date: '2027-01-15', money: { kind: 'collect', amount: 5000, dueOn: '2027-01-15' } } } })
    .filter((r) => r[0] === 'early_end_refund_late'), [], 'an amount to collect is not a refund');
  // Not renewing, ends 31 Oct, no settlement approved: from 1 Dec; also after the daily close.
  const leaving = { ...lease, data: { notRenewing: { recordedOn: '2027-09-01' } } };
  assert.deepEqual(at('2027-11-30', leaving), []);
  assert.deepEqual(at('2027-12-01', leaving), [['deposit_refund_late', '2027-11-30', null]]);
  assert.deepEqual(at('2027-12-01', { ...lease, status: 'expired', effectiveEndDate: '2027-10-31' }), [['deposit_refund_late', '2027-11-30', null]], 'closed by hand or by the job');
  assert.deepEqual(at('2027-12-01', leaving, [{ contractId: 11, status: 'draft', refundAmount: 0, refunded: false }]), [['deposit_refund_late', '2027-11-30', null]], 'a draft is not approved');
  assert.deepEqual(at('2027-12-01', leaving, [{ contractId: 11, status: 'completed', refundAmount: 0, refunded: false }]), [], 'settled');
  assert.deepEqual(at('2027-12-01', leaving, [{ contractId: 11, status: 'approved', refundAmount: 35000, refunded: false }]), [['deposit_refund_late', '2027-11-30', 35000]], 'once only, with the amount');
  assert.deepEqual(at('2027-12-01', { ...leaving, deposit: 0 }), [], 'no deposit');
  assert.deepEqual(at('2027-12-01', lease), [], 'past its end, undecided: the stay goes on (AC-8.7)');
  assert.deepEqual(dueReminders('2027-12-01', [{ ...lease, status: 'expired' }, contract({ id: 12, formKind: 'renewal', status: 'active', previousAgreementId: 11, endDate: '2028-10-31' })], []).filter((r) => r.contractId === 11), [], 'renewed');
  // L3: the renewal reminder stops once the stay is recorded as leaving.
  assert.deepEqual(at('2027-10-15', lease).map((r) => r[0]), ['renewal_notice']);
  assert.deepEqual(at('2027-10-15', leaving), []);
  assert.deepEqual(at('2027-10-15', { ...lease, endDate: '2027-10-31', data: { endsOn: { date: '2027-10-20', reason: 'x' } } }), []);
});
