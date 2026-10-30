const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, deps = {}) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(id => deps[id] ?? require(id), module, module.exports);
  return module.exports;
}
const term = load('lease-term.ts');
const { renewalCandidates, renewalClosedMessage, renewalCommissionValue, awaitingDecision, canCancelRenewal } = load('contract-renewal.ts', { './lease-term': term });
const copy = { disabled: 'no lease', needsEndDate: 'no expiry', needsActive: 'not active', alreadyRenewed: 'already renewed', tooEarly: 'ends {end}, opens {date}', leaving: 'leaving' };
const row = (patch = {}) => ({ id: 1, tenantId: 1, rentRoomId: 3, formKind: 'lease', status: 'active', startDate: '2025-11-01', endDate: '2026-10-31', previousAgreementId: null, ...patch });
const today = '2026-10-12';

test('another tenant with a later expiry cannot hide an eligible renewal', () => {
  const a = row(); const b = row({ id: 2, tenantId: 2, endDate: '2027-06-30' });
  assert.deepEqual(renewalCandidates([b, a]).map(r => r.id), [1, 2]);
  assert.equal(renewalClosedMessage([b, a], copy, undefined, today), '');
  assert.equal(renewalClosedMessage([b, a], copy, a.id, today), '');
  assert.equal(renewalClosedMessage([b, a], copy, b.id, today), 'ends 30/06/2027, opens 31/05/2027');
});
test('multiple eligible tenants remain selectable and source checks never switch chains', () => {
  const a = row(); const b = row({ id: 2, tenantId: 2, endDate: '2026-10-20' });
  assert.equal(renewalCandidates([a,b]).length, 2);
  for (const c of [a,b]) assert.equal(renewalClosedMessage([a,b], copy, c.id, today), '');
  assert.equal(renewalClosedMessage([a,b], copy, 99, today), copy.disabled);
});
test('only a chain tail can renew; drafts block its predecessor until cancelled', () => {
  const a = row(); const draft = row({ id: 2, formKind: 'renewal', previousAgreementId: 1, status: 'draft', startDate: '2026-11-01', endDate: '2027-10-31' });
  assert.equal(renewalCandidates([a,draft]).length, 0);
  assert.equal(renewalClosedMessage([a,draft], copy, 1, today), copy.alreadyRenewed);
  assert.deepEqual(renewalCandidates([a,{ ...draft, status: 'cancelled' }]).map(c=>c.id), [1]);
  const next = { ...draft, status: 'active' };
  assert.deepEqual(renewalCandidates([a,next]).map(c=>c.id), [2]);
  assert.equal(renewalClosedMessage([a,next], copy, 1, today), copy.alreadyRenewed);
});
test('renewal opens exactly 30 days before expiry and excludes ineligible documents', () => {
  assert.equal(renewalClosedMessage([row()], copy, 1, '2026-09-30'), 'ends 31/10/2026, opens 01/10/2026');
  assert.equal(renewalClosedMessage([row()], copy, 1, '2026-10-01'), '');
  assert.equal(renewalClosedMessage([row({ status: 'expired' })], copy, 1, '2026-11-03'), '');
  for (const status of ['draft','terminated','cancelled']) assert.equal(renewalCandidates([row({status})]).length, 0);
  assert.equal(renewalClosedMessage([row({endDate:null})], copy, 1, today), copy.needsEndDate);
  assert.equal(renewalClosedMessage([row({formKind:'reservation'})], copy, undefined, today), copy.disabled);
});
test('default renewal gate uses Bangkok at the UTC midnight boundary', () => {
  const RealDate = Date;
  global.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : ['2026-09-30T17:30:00Z'])); } };
  try { assert.equal(renewalClosedMessage([row()], copy, 1), ''); }
  finally { global.Date = RealDate; }
});

test('Aof 29 Oct 2026: a stay recorded as not renewing or ending early is not offered for renewal, and says why', () => {
  for (const data of [{ notRenewing: { recordedOn: '2026-10-01' } }, { endsOn: { date: '2026-12-15' } }]) {
    const a = row({ data });
    assert.deepEqual(renewalCandidates([a]), []);
    assert.equal(renewalClosedMessage([a], copy, 1, today), 'leaving');
  }
  const other = row({ id: 2, tenantId: 2, data: {} });
  assert.deepEqual(renewalCandidates([row({ data: { notRenewing: {} } }), other]).map((r) => r.id), [2], 'another stay still renews');
});

test('Aof 29 Oct 2026: the renewal commission, a lease awaiting a decision, and cancelling a renewal until both have signed', () => {
  assert.equal(renewalCommissionValue(' 7,500 '), '7500'); assert.equal(renewalCommissionValue('0'), '0'); assert.equal(renewalCommissionValue('12.50'), '12.50');
  for (const bad of ['', 'abc', '-5', '1.234']) assert.equal(renewalCommissionValue(bad), null);
  assert.equal(awaitingDecision(row({ status: 'expired', data: { undecided: { since: '2026-11-01' } } })), true);
  assert.equal(awaitingDecision(row({ status: 'expired', data: {} })), false);
  assert.equal(awaitingDecision(row({ status: 'active', data: { undecided: {} } })), false);
  const r = (patch) => row({ formKind: 'renewal', status: 'awaiting_signatures', ownerSignedAt: null, tenantSignedAt: null, ...patch });
  assert.equal(canCancelRenewal(r({ ownerSignedAt: '2026-10-20T03:00:00Z' })), true, 'one party signed');
  assert.equal(canCancelRenewal(r({ ownerSignedAt: '2026-10-20T03:00:00Z', tenantSignedAt: '2026-10-21T03:00:00Z' })), false, 'both signed');
  assert.equal(canCancelRenewal(r({ status: 'awaiting_agent_review' })), false);
  assert.equal(canCancelRenewal(r({ formKind: 'lease' })), false, 'a lease uses the deal cancellation');
});
