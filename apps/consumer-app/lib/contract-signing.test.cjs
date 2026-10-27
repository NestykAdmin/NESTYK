const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const loaded = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, 'contract-signing.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(loaded, loaded.exports);
const { bookingPaymentBlocksSigning, reservationSigningOverdue } = loaded.exports;

test('D3 (AC-3.6, TC-3.06): no party signs a reservation letter until the booking receipt is issued', () => {
  const reservation = { formKind: 'reservation', receiptUrl: null };
  for (const party of ['tenant', 'owner', 'agent']) {
    assert.equal(bookingPaymentBlocksSigning(reservation, party), true, party);
    assert.equal(bookingPaymentBlocksSigning({ ...reservation, reservationPayment: { status: 'submitted' } }, party), true, `${party}: a slip waiting for review is not enough`);
    assert.equal(bookingPaymentBlocksSigning({ ...reservation, receiptUrl: 'receipt.pdf' }, party), false, party);
  }
  assert.equal(bookingPaymentBlocksSigning(reservation, undefined), false, 'no party chosen yet');
});

test('the booking payment gate is only for reservation letters', () => {
  for (const formKind of ['lease', 'renewal', 'broker_appointment'])
    for (const party of ['tenant', 'owner', 'agent'])
      assert.equal(bookingPaymentBlocksSigning({ formKind, receiptUrl: null }, party), false, `${formKind} ${party}`);
});

test('D3 (TC-3.07): a letter made 10 Oct is due by the end of 13 Oct; the warning starts on 14 Oct', () => {
  const letter = { signDueDate: '2026-10-13' };
  assert.equal(reservationSigningOverdue(letter, '2026-10-13'), false);
  assert.equal(reservationSigningOverdue(letter, '2026-10-14'), true);
  assert.equal(reservationSigningOverdue({ signDueDate: null }, '2027-01-01'), false, 'signed by everyone, or not a letter');
});
