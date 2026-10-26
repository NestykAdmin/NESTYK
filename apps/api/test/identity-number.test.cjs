const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
require('reflect-metadata');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(require('node:fs').readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true }, fileName: filename }).outputText, filename);
const { isValidThaiId, identityNumberProblem, normalizeIdentityNumber, isThaiNationality, IDENTITY_NUMBER_MESSAGES } = require('../src/common/identity-number.ts');
const { validateReservationLetter, TENANT_ID_REQUIRED } = require('../src/agent/contracts/reservation-letter.ts');

// C3 (Aof, 22 Oct 2026): the person is matched by ID number only, so the number has to be right.
test('Thai ID check digit', () => {
  // Sum of digit x weight (13..2) over the first 12 digits, then (11 - sum % 11) % 10 is the 13th digit:
  // 1234567890121: 352, 352 % 11 = 0, 11 % 10 = 1 · 3101234567893: 261, % 11 = 8, 3 · 1100100000000: 34, % 11 = 1, 10 % 10 = 0.
  for (const id of ['1234567890121', '3101234567893', '1100100000000']) assert.equal(isValidThaiId(id), true, id);
  for (const id of ['1234567890123', '1234567890120', '123456789012', '12345678901211', '123456789012a', '']) assert.equal(isValidThaiId(id), false, id);
  // Every wrong last digit of a valid number fails.
  for (let d = 0; d <= 9; d++) assert.equal(isValidThaiId(`123456789012${d}`), d === 1, `last digit ${d}`);
});

test('identity number problems: format, Thai ID when 13 digits or a Thai national', () => {
  assert.equal(normalizeIdentityNumber(' e 1234-5678 '), 'E12345678');
  for (const n of ['ไทย', 'Thai', ' THAI ', 'TH', 'tha', 'สัญชาติไทย']) assert.equal(isThaiNationality(n), true, n);
  for (const n of ['', null, 'British', 'Thailand-born Lao']) assert.equal(isThaiNationality(n), false, String(n));
  assert.equal(identityNumberProblem('1-2345-67890-12-1', 'ไทย'), null);
  assert.equal(identityNumberProblem('1 2345 67890 12 1'), null);
  assert.equal(identityNumberProblem('1-2345-67890-12-3'), 'thai_id', 'with no nationality, 13 digits are a Thai ID');
  assert.equal(identityNumberProblem('1-2345-67890-12-3', 'ไทย'), 'thai_id');
  assert.equal(identityNumberProblem('900101-1234567', 'Korean'), null, 'another nationality with 13 digits (a Korean ID) is not checked as a Thai ID');
  assert.equal(identityNumberProblem('E12345678', 'ไทย'), 'thai_id', 'a Thai national gives the Thai ID');
  assert.equal(identityNumberProblem('E12345678', 'British'), null);
  assert.equal(identityNumberProblem('AB/123-45', ''), null);
  for (const bad of ['ab', '1234', '-1234567', 'E1234567!', 'a'.repeat(101)]) assert.equal(identityNumberProblem(bad, ''), 'format', bad);
  assert.ok(IDENTITY_NUMBER_MESSAGES.format && IDENTITY_NUMBER_MESSAGES.thai_id);
});

const letter = { tenantName: 'Pim Sukjai', landlordName: 'Owner', project: 'Condo', issueDate: '2026-10-22', reservationPayment: '5,000' };
const fill = (patch) => {
  const out = {};
  for (const key of ['documentNo', 'tenantName', 'tenantPhone', 'tenantId', 'tenantNationality', 'landlordName', 'landlordPhone', 'landlordId', 'landlordNationality', 'agentName', 'companyName', 'agentPhone', 'project', 'address', 'unitNo', 'floor', 'area', 'beds', 'baths', 'termMonths', 'termFrom', 'termTo', 'monthlyRent', 'advanceMonths', 'advanceAmount', 'depositMonths', 'depositAmount', 'reservationPayment', 'reservationWords', 'balanceDue', 'payee', 'paymentMethod', 'bankAccount', 'tenantSignName', 'landlordSignName', 'agentSignName', 'issueDate']) out[key] = '';
  return { ...out, ...letter, ...patch };
};

test('a reservation letter needs the tenant ID number, and a valid one', () => {
  assert.equal(validateReservationLetter(fill({ tenantId: '1-2345-67890-12-1', tenantNationality: 'ไทย' })).tenantId, '1-2345-67890-12-1');
  assert.equal(validateReservationLetter(fill({ tenantId: 'E12345678', tenantNationality: 'British' })).tenantId, 'E12345678');
  assert.equal(validateReservationLetter(fill({ tenantId: '9001011234567', tenantNationality: 'Korean' })).tenantId, '9001011234567');
  for (const tenantId of ['', '   '])
    assert.throws(() => validateReservationLetter(fill({ tenantId })), (e) => e.getStatus() === 400 && e.getResponse().code === 'TENANT_ID_REQUIRED' && e.message === TENANT_ID_REQUIRED);
  for (const [tenantId, tenantNationality, message] of [['1234567890123', '', IDENTITY_NUMBER_MESSAGES.thai_id], ['E12345678', 'ไทย', IDENTITY_NUMBER_MESSAGES.thai_id], ['ab', '', IDENTITY_NUMBER_MESSAGES.format]])
    assert.throws(() => validateReservationLetter(fill({ tenantId, tenantNationality })),
      (e) => e.getStatus() === 400 && e.getResponse().code === 'TENANT_ID_INVALID' && e.message.startsWith(message) && e.message.includes('แก้ในข้อมูลผู้เช่า'), `${tenantId} / ${tenantNationality}`);
  // The other required fields are still checked first.
  assert.throws(() => validateReservationLetter(fill({ tenantId: '', project: '' })), (e) => e.message === 'กรุณากรอกข้อมูลที่จำเป็นให้ครบ');
});
