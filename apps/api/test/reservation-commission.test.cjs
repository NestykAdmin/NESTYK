// D13 (AC-3.7, Aof 26 Oct 2026): the commission of a deal: 1 month of rent per full year, the rest by days ÷ 365.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { commissionFor, reservationCommission, reservationCommissionInput } = require('../src/agent/contracts/reservation-commission.ts');
const { validateCommissionConfirmation } = require('../src/agent/contracts/commission-confirmation.ts');

test('commission: under a year by days ÷ 365; a full year is 1 month; past a year, 1 month per year plus the rest by days', () => {
  for (const [label, start, end, amount, fullYears, restDays] of [
    ['TC-3.10 6 months (181 days)', '2026-11-01', '2027-04-30', 9918, 0, 181],
    ['TC-3.09 1 year', '2026-11-01', '2027-10-31', 20000, 1, 0],
    ['TC-3.14 1 year with 29 Feb (366 days) is still 1 month (Aof)', '2027-03-01', '2028-02-29', 20000, 1, 0],
    ['18 months: 1 year + 1 Nov 2027 to 30 Apr 2028 (182 days with 29 Feb)', '2026-11-01', '2028-04-30', 29973, 1, 182],
    ['24 months', '2026-11-01', '2028-10-31', 40000, 2, 0],
    ['1 day', '2026-11-01', '2026-11-01', 55, 0, 1],
    ['a year and a day', '2026-11-01', '2027-11-01', 20055, 1, 1],
    ['a start on 31 Jan: the year ends 30 Jan', '2027-01-31', '2028-01-30', 20000, 1, 0],
  ]) assert.deepEqual(commissionFor(20000, start, end), { amount, fullYears, restDays }, label);
  // Rounding to whole baht: .5 and above up, below down.
  assert.equal(commissionFor(73, '2026-11-01', '2026-11-03').amount, 1, '73 × 3 ÷ 365 = 0.6 → 1');
  assert.equal(commissionFor(73, '2026-11-01', '2026-11-02').amount, 0, '73 × 2 ÷ 365 = 0.4 → 0');
  assert.equal(commissionFor(365, '2026-11-01', '2026-11-01').amount, 1, '365 × 1 ÷ 365 = 1');
  assert.equal(commissionFor(182.5, '2026-11-01', '2026-11-01').amount, 1, '0.5 exactly rounds up');
  assert.equal(commissionFor(15000.5, '2026-11-01', '2027-10-31').amount, 15000.5, 'a full year is the rent itself, satang included');
  for (const [rent, start, end] of [[0, '2026-11-01', '2027-10-31'], [20000, '2026-11-01', '2026-10-31'], [20000, '2026-02-30', '2027-01-01'], [20000, '', '2027-01-01'], [NaN, '2026-11-01', '2027-10-31']])
    assert.equal(commissionFor(rent, start, end), null, JSON.stringify([rent, start, end]));
});

const letter = (patch = {}) => ({ id: 11, contract_no: 'RS202600011', data: { reservationLetter: {
  issueDate: '2026-10-20', landlordName: 'Owner A', landlordFirstName: 'Owner', landlordLastName: 'A', landlordId: 'L1', landlordNationality: 'Thai',
  agentName: 'Agent B', tenantName: 'Tenant C', tenantFirstName: 'Tenant', tenantLastName: 'C', tenantId: 'T1', tenantNationality: 'British',
  project: 'Aria', unitNo: '1201', address: '1 Road', monthlyRent: '20,000', termMonths: '6', termFrom: '2026-11-01', termTo: '2027-04-30',
  bankAccount: 'Landlord bank', landlordSignName: '', agentSignName: 'B. Agent', ...patch } } });

test('a reservation letter\'s commission comes from its rent and term; the end is the term when the letter has no end date', () => {
  assert.deepEqual(reservationCommission(letter()), { documentNo: 'CCM-RS202600011', monthlyRent: '20000', leaseStart: '2026-11-01',
    leaseEnd: '2027-04-30', fullYears: 0, restDays: 181, amount: '9918' });
  assert.equal(reservationCommission(letter({ termTo: '', termMonths: '12' })).leaseEnd, '2027-10-31');
  assert.equal(reservationCommission(letter({ termTo: '', termMonths: '12' })).amount, '20000');
  assert.equal(reservationCommission({ id: 12, contract_no: null, data: letter().data }).documentNo, 'CCM-RS12');
  for (const patch of [{ monthlyRent: '' }, { termFrom: '' }, { termTo: '', termMonths: '' }])
    assert.equal(reservationCommission(letter(patch)), null, JSON.stringify(patch));
  assert.equal(reservationCommission({ id: 13, data: {} }), null, 'no letter');
});

test('the commission confirmation\'s fields: the letter\'s parties and room, the amount, and the sign dates; it passes the form\'s own checks', () => {
  const input = reservationCommissionInput(letter(), { issueDate: '2026-10-20', landlordSignDate: '2026-10-21', agentSignDate: '2026-10-22' });
  assert.deepEqual(
    [input.documentNo, input.landlordName, input.landlordId, input.agentName, input.tenantName, input.tenantIdentity, input.project, input.unitNo,
      input.propertyAddress, input.leasePeriod, input.leaseStart, input.leaseEnd, input.monthlyRent, input.agreedCommission, input.bankAccount,
      input.landlordSignName, input.agentSignName, input.landlordSignDate, input.agentSignDate],
    ['CCM-RS202600011', 'Owner A', 'L1', 'Agent B', 'Tenant C', 'T1', 'Aria', '1201', '1 Road', '6 เดือน', '2026-11-01', '2027-04-30', '20000', '9918', '',
      'Owner A', 'B. Agent', '2026-10-21', '2026-10-22']);
  assert.equal(input.bankAccount, '', 'the landlord\'s rent account is not where the agent is paid');
  assert.deepEqual(validateCommissionConfirmation({ ...input }), input);
  const long = reservationCommissionInput(letter({ landlordName: 'x'.repeat(200), address: '' }), { issueDate: '2026-10-20', landlordSignDate: '', agentSignDate: '' });
  assert.equal(long.landlordName.length, 80, 'cut to the form\'s length');
  assert.equal(long.propertyAddress, 'Aria', 'no address: the project');
  assert.equal(reservationCommissionInput(letter({ monthlyRent: '' }), { issueDate: '2026-10-20', landlordSignDate: '', agentSignDate: '' }), null);
});
