const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, deps = {}) {
  const loaded = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('module', 'exports', 'require', source)(loaded, loaded.exports, (id) => deps[id] ?? require(id));
  return loaded.exports;
}
const term = load('lease-term.ts');
const { canCloseContract, closeOptions, closeDateProblem, closeInput } = load('contract-close.ts', { './lease-term': term });
const { fillTemplate } = load('../../../packages/i18n/src/template.ts');
const { attachmentReviewText, canReviewAttachment } = load('attachment-review.ts', { '@nestyk/i18n': { fillTemplate } });

// Codes from master_contract_end_reasons (baseline ids 1-3 and migration 20261014120000 id 8);
// the API leaves out draft_cancelled before the app sees the list.
const reasons = [
  { code: 'term_completed', status: 'expired', requiresNote: false },
  { code: 'non_payment', status: 'terminated', requiresNote: true },
  { code: 'tenant_requested', status: 'terminated', requiresNote: true },
  { code: 'before_start_cancelled', status: 'cancelled', requiresNote: true },
];
const lease = (over = {}) => ({ id: 1, formKind: 'lease', status: 'active', templateId: 3, startDate: '2026-01-01', endDate: '2026-12-31', ...over });
const codes = (rows) => rows.map((row) => row.reason.code);

test('only an active lease or renewal can be closed; one waiting for its deposit or handover is cancelled with its deal', () => {
  assert.equal(canCloseContract(lease()), true);
  assert.equal(canCloseContract(lease({ formKind: 'renewal' })), true);
  // D5 + D8 (Aof, 27 Oct 2026): not handed over yet: "cancel the deal" (who caused it, evidence), not this card.
  for (const status of ['awaiting_deposit', 'awaiting_handover', 'draft', 'awaiting_signatures', 'awaiting_agent_review', 'expired', 'terminated', 'cancelled'])
    assert.equal(canCloseContract(lease({ status })), false, status);
  for (const formKind of ['reservation', 'broker_appointment'])
    assert.equal(canCloseContract(lease({ formKind })), false, formKind);
  // The API takes the kind from the template and refuses a contract without one.
  assert.equal(canCloseContract(lease({ templateId: null })), false);
  assert.deepEqual(closeOptions(lease({ status: 'expired' }), reasons, '2027-01-05'), []);
});

test('reasons follow the API date rules: cancel before start, terminate during the term, expire after the end', () => {
  assert.deepEqual(codes(closeOptions(lease(), reasons, '2025-12-20')), ['before_start_cancelled']);
  assert.equal(closeOptions(lease(), reasons, '2025-12-20')[0].date, '2025-12-20', 'before the start the suggestion is today');
  // The first day of the lease can already be terminated.
  const firstDay = closeOptions(lease(), reasons, '2026-01-01');
  assert.deepEqual(codes(firstDay).slice(0, 2), ['non_payment', 'tenant_requested']);
  assert.equal(firstDay[0].date, '2026-01-01');
  // The API does not look at today for a cancellation, only that the end date is before the start,
  // so a cancellation recorded late is still offered, dated the day before the start.
  const during = closeOptions(lease(), reasons, '2026-06-15');
  assert.deepEqual(codes(during), ['non_payment', 'tenant_requested', 'before_start_cancelled']);
  assert.equal(during[2].date, '2025-12-31');
  assert.equal(during[0].date, '2026-06-15');
  assert.equal(during[0].dateLocked, false);
  // On the end date itself nothing can expire yet, and terminating must be the day before the end.
  const lastDay = closeOptions(lease(), reasons, '2026-12-31');
  assert.deepEqual(codes(lastDay), ['non_payment', 'tenant_requested', 'before_start_cancelled']);
  assert.equal(lastDay[0].date, '2026-12-30');
  const after = closeOptions(lease(), reasons, '2027-01-05');
  assert.deepEqual(codes(after), ['term_completed', 'non_payment', 'tenant_requested', 'before_start_cancelled']);
  assert.deepEqual([after[0].date, after[0].dateLocked], ['2026-12-31', true]);
  assert.equal(after[1].date, '2026-12-30');
  // A lease without an end date can be terminated but never expires.
  assert.deepEqual(codes(closeOptions(lease({ endDate: null }), reasons, '2027-03-01')), ['non_payment', 'tenant_requested', 'before_start_cancelled']);
  // A one-day lease has no day to terminate on.
  assert.deepEqual(codes(closeOptions(lease({ startDate: '2026-06-01', endDate: '2026-06-01' }), reasons, '2026-06-01')), ['before_start_cancelled']);
});

test('typed end dates are checked the same way the API checks them', () => {
  const [terminate] = closeOptions(lease(), reasons, '2026-06-15');
  const today = '2026-06-15';
  assert.equal(closeDateProblem(terminate, '2026-06-01', lease(), today), null);
  assert.equal(closeDateProblem(terminate, '2026-6-1', lease(), today), 'format');
  assert.equal(closeDateProblem(terminate, '2026-02-30', lease(), today), 'format');
  assert.equal(closeDateProblem(terminate, '2026-06-16', lease(), today), 'future');
  assert.equal(closeDateProblem(terminate, '2025-12-31', lease(), today), 'beforeStart');
  assert.equal(closeDateProblem(terminate, '2026-01-01', lease(), today), null, 'the start date itself is allowed');
  const late = closeOptions(lease(), reasons, '2027-01-05')[1];
  assert.equal(closeDateProblem(late, '2026-12-31', lease(), '2027-01-05'), 'notBeforeEnd');
  assert.equal(closeDateProblem(late, '2026-12-30', lease(), '2027-01-05'), null);
  const [cancel] = closeOptions(lease(), reasons, '2025-12-20');
  assert.equal(closeDateProblem(cancel, '2025-12-20', lease(), '2025-12-20'), null);
  assert.equal(closeDateProblem(cancel, '2026-01-01', lease(), '2026-01-01'), 'notBeforeStart');
  const lateCancel = closeOptions(lease(), reasons, '2026-06-15').find((row) => row.reason.status === 'cancelled');
  assert.equal(closeDateProblem(lateCancel, '2025-12-31', lease(), '2026-06-15'), null);
  assert.equal(closeDateProblem(lateCancel, '2026-03-01', lease(), '2026-06-15'), 'notBeforeStart');
});

test('the close request sends the reason, the right date and a trimmed note only when there is one', () => {
  const after = closeOptions(lease(), reasons, '2027-01-05');
  assert.deepEqual(closeInput(after[0], '2027-01-01', '  '), { endReasonCode: 'term_completed', effectiveEndDate: '2026-12-31' });
  assert.deepEqual(closeInput(after[2], '2026-11-30', ' ค้างค่าเช่า '), { endReasonCode: 'tenant_requested', effectiveEndDate: '2026-11-30', note: 'ค้างค่าเช่า' });
});

test('attachment review line and when the agent may still review a file', () => {
  const copy = { pending: 'P', accepted: 'A', rejected: 'R', rejectedWithNote: 'R: {note}' };
  const doc = (over = {}) => ({ id: 1, isCurrent: true, reviewStatus: 'pending', reviewNote: null, ...over });
  assert.equal(attachmentReviewText(doc(), copy), 'P');
  assert.equal(attachmentReviewText(doc({ reviewStatus: 'accepted' }), copy), 'A');
  assert.equal(attachmentReviewText(doc({ reviewStatus: 'rejected', reviewNote: '  ' }), copy), 'R');
  assert.equal(attachmentReviewText(doc({ reviewStatus: 'rejected', reviewNote: ' blurry ' }), copy), 'R: blurry');
  assert.equal(attachmentReviewText(doc({ reviewStatus: 'rejected', reviewNote: "pay $& again" }), copy), 'R: pay $& again');
  assert.equal(canReviewAttachment(doc(), true), true);
  assert.equal(canReviewAttachment(doc(), false), false);
  assert.equal(canReviewAttachment(doc({ isCurrent: false }), true), false);
  for (const reviewStatus of ['accepted', 'rejected']) assert.equal(canReviewAttachment(doc({ reviewStatus }), true), false);
});
