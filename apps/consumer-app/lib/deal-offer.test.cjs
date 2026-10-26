// D2 (AC-2.1 to 2.4, round 1, Aof 22 Oct 2026): the offer form. Its rules mirror validateDealOfferTerms in
// apps/api/src/agent/contracts/deal-offers.service.ts, so the agent sees the API's refusals before sending.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const load = (file) => { const m = { exports: {} }; new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(require, m, m.exports); return m.exports; };
const o = load('deal-offer.ts');
const form = { ...o.EMPTY_DEAL_OFFER_FORM, monthlyRent: '15,000', termMonths: '12', startDate: '2026-11-01', depositAmount: '30000', contractDate: '2026-10-25', rentDueDay: '1' };

test('a complete form has no issues and becomes the body the API takes; blanks become null', () => {
  assert.deepEqual(o.dealOfferIssues(form), {});
  assert.deepEqual(o.dealOfferBody(form), { monthlyRent: '15,000', termMonths: 12, startDate: '2026-11-01', depositAmount: '30000', contractDate: '2026-10-25',
    rentDueDay: 1, graceDay: null, lateFeePerDay: null, renewalNoticeDays: null, coBroke: false, coBrokeAgentName: null });
  const full = { ...form, graceDay: '5', lateFeePerDay: '200', renewalNoticeDays: '45', coBroke: true, coBrokeAgentName: ' Other ' };
  assert.deepEqual(o.dealOfferIssues(full), {});
  assert.deepEqual(o.dealOfferBody(full), { ...o.dealOfferBody(form), graceDay: 5, lateFeePerDay: '200', renewalNoticeDays: 45, coBroke: true, coBrokeAgentName: 'Other' });
  assert.equal(o.dealOfferBody({ ...form, coBrokeAgentName: 'left over' }).coBrokeAgentName, null, 'no other agent: no name is sent');
  assert.deepEqual(o.dealOfferIssues({ ...form, depositAmount: '0', contractDate: '2026-11-01' }), {}, 'no deposit, signed on the start day');
});

test('the same refusals as the API, field by field', () => {
  const cases = [
    [{ monthlyRent: '' }, 'monthlyRent', 'required'], [{ monthlyRent: '0' }, 'monthlyRent', 'amount'], [{ monthlyRent: '1.234' }, 'monthlyRent', 'amount'],
    [{ monthlyRent: 'abc' }, 'monthlyRent', 'amount'], [{ depositAmount: '' }, 'depositAmount', 'required'], [{ depositAmount: '-1' }, 'depositAmount', 'amount'],
    [{ lateFeePerDay: 'x' }, 'lateFeePerDay', 'amount'], [{ termMonths: '' }, 'termMonths', 'required'], [{ termMonths: '0' }, 'termMonths', 'months'],
    [{ termMonths: '121' }, 'termMonths', 'months'], [{ termMonths: '1.5' }, 'termMonths', 'months'], [{ startDate: '' }, 'startDate', 'required'],
    [{ startDate: '2026-02-30' }, 'startDate', 'date'], [{ contractDate: '25/10/2026' }, 'contractDate', 'date'],
    [{ contractDate: '2026-11-02' }, 'contractDate', 'contractAfterStart'], [{ rentDueDay: '' }, 'rentDueDay', 'required'],
    [{ rentDueDay: '32' }, 'rentDueDay', 'day'], [{ rentDueDay: '0' }, 'rentDueDay', 'day'], [{ graceDay: '32' }, 'graceDay', 'day'],
    [{ renewalNoticeDays: '0' }, 'renewalNoticeDays', 'notice'], [{ renewalNoticeDays: '366' }, 'renewalNoticeDays', 'notice'],
    [{ coBroke: true, coBrokeAgentName: ' ' }, 'coBrokeAgentName', 'coBrokeName'], [{ coBroke: true, coBrokeAgentName: 'a'.repeat(121) }, 'coBrokeAgentName', 'coBrokeName'],
  ];
  for (const [patch, key, issue] of cases) assert.deepEqual(o.dealOfferIssues({ ...form, ...patch }), { [key]: issue }, JSON.stringify(patch));
});

test('the open offer of a room, the saved form, and whether the form has unsaved changes', () => {
  const offer = { id: 5, rentRoomId: 3, status: 'awaiting_landlord', monthlyRent: '15000', termMonths: 12, startDate: '2026-11-01', depositAmount: '30000',
    contractDate: '2026-10-25', rentDueDay: 1, graceDay: null, lateFeePerDay: null, renewalNoticeDays: 30, coBroke: false, coBrokeAgentName: null };
  assert.equal(o.openDealOfferFor([{ ...offer, status: 'cancelled' }, { ...offer, rentRoomId: 4 }, offer], 3), offer);
  assert.equal(o.openDealOfferFor([{ ...offer, status: 'room_taken' }], 3), null);
  const saved = o.dealOfferForm(offer);
  assert.deepEqual(saved, { monthlyRent: '15000', termMonths: '12', startDate: '2026-11-01', depositAmount: '30000', contractDate: '2026-10-25',
    rentDueDay: '1', graceDay: '', lateFeePerDay: '', renewalNoticeDays: '30', coBroke: false, coBrokeAgentName: '' });
  assert.equal(o.dealOfferDirty(saved, offer), false);
  assert.equal(o.dealOfferDirty({ ...saved, monthlyRent: '16000' }, offer), true);
  assert.equal(o.dealOfferDirty({ ...saved, coBroke: true }, offer), true);
  assert.equal(o.dealOfferDirty({ ...saved, coBrokeAgentName: 'typed then switched off' }, offer), false);
  assert.equal(o.dealOfferDirty(saved, null), true, 'nothing saved yet');
});

test('the locked letter and lease keys are the ones the API fixes from the offer', () => {
  const api = fs.readFileSync(path.join(__dirname, '../../api/src/agent/contracts/deal-offers.service.ts'), 'utf8');
  const keysOf = (name) => [...api.slice(api.indexOf(`export function ${name}`)).split('\n}\n')[0].matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]).sort();
  assert.deepEqual([...o.OFFER_RESERVATION_LOCKED_KEYS].sort(), keysOf('offerReservationFields'));
  assert.deepEqual([...o.OFFER_LEASE_LOCKED_KEYS].sort(), keysOf('offerLeaseFields'));
});

test('D2 round 2: what a change changed, and the booking money paid above the new rent', () => {
  const before = o.dealOfferBody(form);
  assert.deepEqual(o.revisionChanges({ before, after: { ...before, monthlyRent: '14000', graceDay: 5, coBroke: true, coBrokeAgentName: 'X' } }),
    [{ key: 'monthlyRent', from: '15,000', to: '14000' }, { key: 'graceDay', from: null, to: 5 }, { key: 'coBroke', from: false, to: true },
      { key: 'coBrokeAgentName', from: null, to: 'X' }]);
  assert.deepEqual(o.revisionChanges({ before, after: { ...before } }), []);
  assert.deepEqual(o.revisionChanges({ before: { ...before, lateFeePerDay: undefined }, after: { ...before, lateFeePerDay: null } }), [], 'missing and null are the same');
  assert.deepEqual(o.reservationOverpaid({ reservationPaid: '15000', monthlyRent: '14000' }), { paid: '15000', rent: '14000' });
  for (const offer of [{ reservationPaid: '14000', monthlyRent: '14000' }, { reservationPaid: '13000.5', monthlyRent: '14000' }, { reservationPaid: null, monthlyRent: '1' },
    { reservationPaid: undefined, monthlyRent: '1' }])
    assert.equal(o.reservationOverpaid(offer), null, JSON.stringify(offer));
  assert.deepEqual([...o.DEAL_OFFER_TERM_KEYS].sort(), Object.keys(before).sort(), 'every term the API keeps');
});

test('D2 round 2: the day of a change is Bangkok\'s (UTC+7)', () => {
  assert.deepEqual(['2026-10-25T16:59:59.000Z', '2026-10-25T17:00:00.000Z', '2026-10-26T03:00:00Z'].map(o.bangkokDay),
    ['2026-10-25', '2026-10-26', '2026-10-26']);
});
