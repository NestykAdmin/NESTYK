// D5 (AC-C.1 to C.4, Aof 26 Oct 2026): cancelling a deal before the handover: the form, the money, the refund.
// What it does to the database (statuses, invoices, booking, appointment, one refund) is checked on a lab database.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { validateDealCancellation, dealMoney, validateRefund, DEAL_CANCELLATION_REASONS } = require('../src/agent/contracts/deal-cancellation.ts');
const { contractEndReasons } = require('../src/agent/contracts/contract-closure.ts');

const TODAY = '2026-10-26';
const status = (fn) => { try { fn(); } catch (e) { return [e.getStatus(), e.getResponse()]; } return null; };

test('TC-C.08: a reason, evidence and who caused it are required, each missing one named; the landlord at fault needs the day told', () => {
  const full = { atFault: 'tenant', reason: 'Tenant changed plans' };
  assert.deepEqual(validateDealCancellation(full, 1, TODAY), { atFault: 'tenant', reason: 'Tenant changed plans', notifiedOn: null, endAppointment: false });
  for (const [label, input, files, missing] of [
    ['no reason', { ...full, reason: '  ' }, 1, ['reason']],
    ['no evidence', full, 0, ['evidence']],
    ['no party', { reason: 'x' }, 1, ['atFault']],
    ['not a party', { ...full, atFault: 'agent' }, 1, ['atFault']],
    ['landlord without the day told', { ...full, atFault: 'landlord' }, 1, ['notifiedOn']],
    ['nothing', {}, 0, ['reason', 'evidence', 'atFault']],
  ]) {
    const [code, body] = status(() => validateDealCancellation(input, files, TODAY));
    assert.equal(code, 400, label);
    assert.equal(body.code, 'CANCELLATION_INCOMPLETE', label);
    assert.deepEqual(body.missing, missing, label);
  }
  assert.match(status(() => validateDealCancellation({}, 0, TODAY))[1].message, /เหตุผล, หลักฐาน \(รูปหรือ PDF\), ฝ่ายที่เป็นเหตุ/);
  for (const [label, input, files] of [
    ['reason over 1,000', { ...full, reason: 'x'.repeat(1001) }, 1],
    ['6 files', full, 6],
    ['day told in the future', { ...full, atFault: 'landlord', notifiedOn: '2026-10-27' }, 1],
    ['day told not a date', { ...full, atFault: 'landlord', notifiedOn: '15/10/2026' }, 1],
    ['ending the appointment when the tenant is at fault', { ...full, endAppointment: true }, 1],
    ['an unknown field', { ...full, refund: 0 }, 1],
  ]) assert.equal(status(() => validateDealCancellation(input, files, TODAY))?.[0], 400, label);
  assert.deepEqual(validateDealCancellation({ atFault: 'landlord', reason: 'Owner sold', notifiedOn: '2026-10-15', endAppointment: true }, 5, TODAY),
    { atFault: 'landlord', reason: 'Owner sold', notifiedOn: '2026-10-15', endAppointment: true });
});

test('the money: tenant at fault forfeits what has a receipt; landlord at fault refunds it all within 7 days of being told', () => {
  for (const [label, atFault, booking, deposit, told, expected] of [
    ['TC-C.01/02/03 tenant, booking paid', 'tenant', 20000, 0, null, [20000, 0, null]],
    ['TC-C.04 landlord, told 15 Oct: due 22 Oct', 'landlord', 20000, 0, '2026-10-15', [0, 20000, '2026-10-22']],
    ['TC-C.06 tenant after the lease, booking and deposit paid', 'tenant', 20000, 40000, null, [60000, 0, null]],
    ['TC-C.07 landlord after the lease', 'landlord', 20000, 40000, '2026-10-15', [0, 60000, '2026-10-22']],
    ['TC-C.10 tenant asked, landlord at fault', 'landlord', 20000, 0, '2026-10-20', [0, 20000, '2026-10-27']],
    ['TC-C.11 deposit invoice unpaid (no receipt, so not counted)', 'tenant', 20000, 0, null, [20000, 0, null]],
    ['TC-C.12 nothing paid yet', 'tenant', 0, 0, null, [0, 0, null]],
    ['landlord at fault, nothing paid: nothing to refund, no due day', 'landlord', 0, 0, '2026-10-15', [0, 0, null]],
    ['satang kept exact', 'landlord', 15000.5, 30000.25, '2026-10-31', [0, 45000.75, '2026-11-07']],
  ]) {
    const m = dealMoney(atFault, booking, deposit, told);
    assert.deepEqual([m.forfeitedAmount, m.refundAmount, m.refundDueOn], expected, label);
    assert.equal(m.forfeitedAmount + m.refundAmount, m.bookingReceived + m.depositReceived, `${label}: nothing lost or added`);
  }
});

test('the refund: once dated, not in the future, not before the day told', () => {
  assert.deepEqual(validateRefund({ refundedOn: '2026-10-20' }, TODAY, '2026-10-15'), { refundedOn: '2026-10-20' });
  assert.deepEqual(validateRefund({ refundedOn: '2026-10-15' }, TODAY, '2026-10-15'), { refundedOn: '2026-10-15' });
  for (const [label, input] of [['future', { refundedOn: '2026-10-27' }], ['before told', { refundedOn: '2026-10-14' }],
    ['no date', {}], ['bad date', { refundedOn: '2026-02-30' }], ['extra field', { refundedOn: '2026-10-20', amount: 1 }]])
    assert.equal(status(() => validateRefund(input, TODAY, '2026-10-15'))?.[0], 400, label);
});

test('closing a lease does not offer the deal cancellation reasons (they need who caused it and evidence)', async () => {
  const rows = ['term_completed', 'draft_cancelled', ...DEAL_CANCELLATION_REASONS, 'before_start_cancelled']
    .map((code, id) => ({ id, code, name_th: code, name_en: code, applicable_status: 'cancelled', requires_note: true, is_active: true }));
  const listed = await contractEndReasons({ getRepository: () => ({ find: async () => rows }) });
  assert.deepEqual(listed.map((r) => r.code), ['term_completed', 'before_start_cancelled']);
});

test('routes: only an agent cancels a deal or records a refund (TC-S.02, S.03); evidence files and the JSON payload reach the service', async (t) => {
  const { Module } = require('@nestjs/common');
  const { NestFactory } = require('@nestjs/core');
  const { AgentContractsController } = require('../src/agent/contracts/agent-contracts.controller.ts');
  const { AgentContractsService } = require('../src/agent/contracts/agent-contracts.service.ts');
  const { AuthService } = require('../src/auth/auth.service.ts');
  const previous = process.env.ALLOW_DEV_AUTH; process.env.ALLOW_DEV_AUTH = 'true';
  t.after(() => { if (previous === undefined) delete process.env.ALLOW_DEV_AUTH; else process.env.ALLOW_DEV_AUTH = previous; });
  const calls = [];
  class TestModule {}
  Module({ controllers: [AgentContractsController], providers: [
    { provide: AgentContractsService, useValue: {
      dealCancellationPreview: async (agentId, id) => { calls.push(['preview', agentId, id]); return {}; },
      cancelDeal: async (agentId, id, input, files) => { calls.push(['cancel', agentId, id, input, (files ?? []).map((f) => [f.originalname, f.buffer.toString()])]); return {}; },
      recordDealRefund: async (agentId, id, input, file) => { calls.push(['refund', agentId, id, input, file?.buffer.toString()]); return {}; },
    } },
    { provide: AuthService, useValue: { findBySupabaseUserId: async (id) => ({ id: Number(id) }),
      loadUserWithRoles: async (id) => ({ id, roleNames: id === 7 ? ['agent'] : id === 50 ? ['landlord'] : ['tenant'] }) } },
  ] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false }); await app.listen(0, '127.0.0.1'); t.after(() => app.close());
  const base = await app.getUrl();
  const as = (id, init = {}) => ({ ...init, headers: { Authorization: `Bearer dev|${id}|u@example.invalid` } });
  const cancelForm = (files = 2) => {
    const form = new FormData();
    form.append('payload', JSON.stringify({ atFault: 'landlord', reason: 'Owner sold', notifiedOn: '2026-10-15' }));
    for (let i = 0; i < files; i++) form.append('evidence', new Blob([`file${i}`], { type: 'image/png' }), `e${i}.png`);
    return form;
  };
  for (const user of [9, 50]) {
    assert.equal((await fetch(`${base}/agent/contracts/30/cancel-deal`, as(user, { method: 'POST', body: cancelForm() }))).status, 403, `user ${user}`);
    assert.equal((await fetch(`${base}/agent/contracts/30/cancellation-preview`, as(user))).status, 403);
    assert.equal((await fetch(`${base}/agent/contracts/30/cancellation/refund`, as(user, { method: 'POST', body: new FormData() }))).status, 403);
  }
  assert.equal(calls.length, 0);
  assert.equal((await fetch(`${base}/agent/contracts/30/cancellation-preview`, as(7))).status, 200);
  assert.equal((await fetch(`${base}/agent/contracts/30/cancel-deal`, as(7, { method: 'POST', body: cancelForm() }))).status, 200);
  assert.notEqual((await fetch(`${base}/agent/contracts/30/cancel-deal`, as(7, { method: 'POST', body: cancelForm(6) }))).status, 200, 'over 5 files');
  const refund = new FormData();
  refund.append('payload', JSON.stringify({ refundedOn: '2026-10-20' }));
  refund.append('file', new Blob(['slip'], { type: 'application/pdf' }), 'slip.pdf');
  assert.equal((await fetch(`${base}/agent/contracts/30/cancellation/refund`, as(7, { method: 'POST', body: refund }))).status, 200);
  assert.deepEqual(calls, [
    ['preview', 7, 30],
    ['cancel', 7, 30, { atFault: 'landlord', reason: 'Owner sold', notifiedOn: '2026-10-15' }, [['e0.png', 'file0'], ['e1.png', 'file1']]],
    ['refund', 7, 30, { refundedOn: '2026-10-20' }, 'slip'],
  ]);
});
