// One rule for "this agreement still holds the parties" (QA Aof, 3 Nov 2026), shared by account deletion, rent
// bills and room status: booking letters until their lease starts, leases (and renewals) until ended or while the
// stay is still undecided (AC-8.7), broker appointments while within their 1-year term (D1).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const file = path.join(__dirname, '../src/agent/contracts/agreement-hold.ts');
const mod = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(() => { throw new Error('agreement-hold must not import anything'); }, mod, mod.exports);
const { holdsAccount, leaseStillHeld, hasUndecidedStay, brokerAppointmentValid, LEASE_STILL_HELD_SQL, BROKER_APPOINTMENT_TERM_YEARS } = mod.exports;

const today = '2026-11-03';
const row = (o) => ({ formKind: 'lease', status: 'active', startDate: '2026-01-01', data: {}, leaseStarted: false, ...o });

test('a broker appointment holds for 1 year from its start, as D1: 11 months yes, 13 months no, the first anniversary no', () => {
  assert.equal(BROKER_APPOINTMENT_TERM_YEARS, 1);
  const broker = (startDate, status = 'active') => holdsAccount(row({ formKind: 'broker_appointment', startDate, status }), today);
  assert.equal(broker('2025-12-03'), true, '11 months');
  assert.equal(broker('2025-10-03'), false, '13 months');
  assert.equal(broker('2025-11-03'), false, 'start + 1 year = today: D1 needs start + 1 year > today');
  assert.equal(broker('2025-11-04'), true, 'one day before the anniversary');
  assert.equal(broker('2026-10-01', 'draft'), true, 'an unsigned appointment still holds');
  assert.equal(broker('2026-10-01', 'terminated'), false, 'ended (landlord withdrew)');
  // Postgres: date '2024-02-29' + interval '1 year' = 2025-02-28.
  assert.equal(brokerAppointmentValid('2024-02-29', '2025-02-27'), true);
  assert.equal(brokerAppointmentValid('2024-02-29', '2025-02-28'), false);
});

test('a lease past its end holds while the stay is undecided (the key is there), including "not renewing" recorded but not yet over', () => {
  const undecided = { since: '2026-10-01' };
  assert.equal(holdsAccount(row({ status: 'expired', data: { undecided } }), today), true);
  assert.equal(holdsAccount(row({ status: 'expired', data: { undecided, notRenewing: { recordedOn: '2026-11-10' } } }), today), true);
  assert.equal(holdsAccount(row({ status: 'expired', data: {} }), today), false, 'the stay was released (key removed)');
  assert.equal(holdsAccount(row({ status: 'expired', data: null }), today), false);
  assert.equal(holdsAccount(row({ status: 'terminated', data: { undecided } }), today), false, 'only an expired lease waits for a decision');
  for (const status of ['draft', 'awaiting_signatures', 'awaiting_agent_review', 'awaiting_deposit', 'awaiting_handover', 'active'])
    assert.equal(holdsAccount(row({ status }), today), true, status);
  assert.equal(holdsAccount(row({ formKind: 'renewal', status: 'active' }), today), true, 'a renewal is a lease');
  assert.equal(leaseStillHeld({ status: 'expired', data: { undecided } }), true);
  assert.equal(leaseStillHeld({ status: 'active', data: { undecided } }), false);
  assert.equal(hasUndecidedStay({ undecided }), true);
  assert.equal(hasUndecidedStay({}), false);
});

test('a booking letter holds until its deal\'s first lease starts, even if it is still marked active', () => {
  const letter = (o) => holdsAccount(row({ formKind: 'reservation', ...o }), today);
  assert.equal(letter({ status: 'active' }), true);
  assert.equal(letter({ status: 'draft' }), true);
  assert.equal(letter({ status: 'active', leaseStarted: true }), false, 'left active by mistake after its lease started');
  assert.equal(letter({ status: 'terminated' }), false, 'reservation_fulfilled or withdrawn');
});

test('cancelled agreements and unknown kinds never hold', () => {
  for (const formKind of ['reservation', 'lease', 'renewal', 'broker_appointment'])
    assert.equal(holdsAccount(row({ formKind, status: 'cancelled', startDate: today }), today), false, formKind);
  assert.equal(holdsAccount(row({ formKind: null }), today), false);
});

test('rent bills and room status use the shared rule; the bill condition is unchanged', () => {
  assert.equal(LEASE_STILL_HELD_SQL, "(c.status = 'expired' AND (c.data->'undecided') IS NOT NULL)");
  const billing = fs.readFileSync(path.join(__dirname, '../src/billing/tenant-billing.service.ts'), 'utf8');
  assert.match(billing, /\$\{LEASE_STILL_HELD_SQL\}/);
  assert.doesNotMatch(billing, /c\.data->'undecided'\) IS NOT NULL/);
  const rooms = fs.readFileSync(path.join(__dirname, '../src/agent/rooms/room-deal-status.ts'), 'utf8');
  assert.match(rooms, /undecided: hasUndecidedStay\(/);
  // D1 keeps its own SQL during the code freeze; it must use the same 1-year term.
  const contracts = fs.readFileSync(path.join(__dirname, '../src/agent/contracts/agent-contracts.service.ts'), 'utf8');
  assert.match(contracts, /c\.start_date \+ INTERVAL '1 year' > CAST\(:today AS date\)/);
});
