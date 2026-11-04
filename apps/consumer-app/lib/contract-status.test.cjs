const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const loaded = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, 'contract-status.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText)(require, loaded, loaded.exports);
const { isFulfilledReservation, RESERVATION_FULFILLED_REASON } = loaded.exports;

test('a booking letter ended by its lease (terminated, reservation_fulfilled) is "used"; other ends are not', () => {
  assert.equal(RESERVATION_FULFILLED_REASON, 'reservation_fulfilled');
  assert.equal(isFulfilledReservation({ status: 'terminated', endReasonCode: 'reservation_fulfilled' }), true);
  // An early termination, the landlord withdrawing, an API without the field, and other statuses with the code.
  assert.equal(isFulfilledReservation({ status: 'terminated', endReasonCode: 'tenant_requested' }), false);
  assert.equal(isFulfilledReservation({ status: 'terminated', endReasonCode: 'landlord_withdrew' }), false);
  assert.equal(isFulfilledReservation({ status: 'terminated' }), false);
  assert.equal(isFulfilledReservation({ status: 'terminated', endReasonCode: null }), false);
  for (const status of ['active', 'cancelled', 'expired']) assert.equal(isFulfilledReservation({ status, endReasonCode: 'reservation_fulfilled' }), false, status);
});
