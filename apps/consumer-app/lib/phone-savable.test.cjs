// QA 9 Nov 2026 (lead readiness): the Save button and the agent web panel must accept the same phones.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const file = path.join(__dirname, 'phone.ts');
const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', source)(require, mod, mod.exports);
const { savablePhone, parseStoredPhone, switchPhoneRegion, nextPhoneDraft } = mod.exports;

const th = (digits) => ({ region: 'TH', digits });
const empty = th('');

test('a valid number for its country can be saved, as E.164', () => {
  assert.equal(savablePhone(th('812345678'), empty, null), '+66812345678');
  assert.equal(savablePhone(th('0812345678'), empty, undefined), '+66812345678');
});

test('1 digit and 5 digits cannot be saved (QA L3)', () => {
  assert.equal(savablePhone(th('1'), empty, null), '');
  assert.equal(savablePhone(th('12345'), empty, null), '');
});

test('nothing typed cannot be saved', () => {
  assert.equal(savablePhone(empty, empty, null), '');
});

test('a country the number does not belong to cannot be saved', () => {
  assert.equal(savablePhone({ region: 'TH', digits: '2025550123' }, empty, null), '');
  assert.equal(savablePhone({ region: 'US', digits: '2025550123' }, empty, null), '+12025550123');
});

test('editing: an untouched stored number that is not valid still saves as stored', () => {
  const stored = '12345';
  const initial = parseStoredPhone(stored);
  assert.equal(savablePhone(initial, initial, stored), stored);
});

test('editing: once the number is changed to something invalid it no longer saves', () => {
  const stored = '12345';
  const initial = parseStoredPhone(stored);
  assert.equal(savablePhone({ ...initial, digits: '123456' }, initial, stored), '');
});

test('editing: changing it to a valid number saves the new one', () => {
  const initial = parseStoredPhone('12345');
  assert.equal(savablePhone(th('812345678'), initial, '12345'), '+66812345678');
});

test('creating (no stored number): the legacy path is never taken', () => {
  assert.equal(savablePhone(th('12345'), th('12345'), undefined), '');
  assert.equal(savablePhone(th('12345'), th('12345'), null), '');
});

test('OTHER ("+code") mode: a valid international number saves, a short one does not', () => {
  const other = (digits) => ({ region: 'OTHER', digits });
  assert.equal(savablePhone(other('8613800138000'), empty, null), '+8613800138000');
  assert.equal(savablePhone(other('86'), empty, null), '');
  assert.equal(savablePhone(other('1'), empty, null), '');
});

test('switching the country keeps the typed digits and re-decides by the new country', () => {
  const typed = th('812345678');
  assert.equal(savablePhone(typed, empty, null), '+66812345678');
  const toOther = switchPhoneRegion(typed, 'OTHER');
  assert.equal(savablePhone(toOther, empty, null), '+66812345678');
  const toUs = switchPhoneRegion(typed, 'US');
  assert.equal(savablePhone(toUs, empty, null), '');
  assert.equal(savablePhone(switchPhoneRegion(toOther, 'TH'), empty, null), '+66812345678');
});

test('typing digit by digit: not savable until the number is complete', () => {
  let draft = empty;
  const seen = [];
  for (const ch of '0812345678') {
    draft = nextPhoneDraft(draft, `${draft.digits}${ch}`);
    seen.push(savablePhone(draft, empty, null) !== '');
  }
  assert.equal(seen.slice(0, 5).some(Boolean), false);
  assert.equal(seen.at(-1), true);
});

test('an unedited legacy number stays savable after switching country away and back', () => {
  const stored = '12345';
  const initial = parseStoredPhone(stored);
  const away = switchPhoneRegion(initial, 'US');
  assert.equal(savablePhone(away, initial, stored), '');
  assert.equal(savablePhone(switchPhoneRegion(away, initial.region), initial, stored), stored);
});
