const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);

const dir = path.join(__dirname, '../src/locales/guest');
const LOCALES = { en: 'guestEn', th: 'guestTh', ja: 'guestJa', zh: 'guestZh' };
const copies = Object.fromEntries(Object.entries(LOCALES).map(([code, name]) => [code, require(path.join(dir, `${code}.ts`))[name]]));

/** Flatten nested copy into { 'a.b.c': 'text' }. */
function flatten(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const id = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') flatten(value, id, out);
    else out[id] = value;
  }
  return out;
}
const flat = Object.fromEntries(Object.entries(copies).map(([code, copy]) => [code, flatten(copy)]));
const placeholders = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('every locale has exactly the same keys as English', () => {
  const base = Object.keys(flat.en).sort();
  assert.ok(base.length > 50, 'English guest copy looks too small');
  for (const code of ['th', 'ja', 'zh']) assert.deepEqual(Object.keys(flat[code]).sort(), base, `keys differ in ${code}`);
});

test('every value is a non-empty string', () => {
  for (const [code, entries] of Object.entries(flat)) {
    for (const [key, value] of Object.entries(entries)) {
      assert.equal(typeof value, 'string', `${code}.${key} is not a string`);
      assert.ok(value.trim().length > 0, `${code}.${key} is empty`);
    }
  }
});

test('placeholders such as {count} and {date} match English in every locale', () => {
  for (const key of Object.keys(flat.en)) {
    const expected = placeholders(flat.en[key]);
    for (const code of ['th', 'ja', 'zh']) assert.deepEqual(placeholders(flat[code][key]), expected, `${code}.${key} placeholders`);
  }
});

test('labels the shared formatters need are present', () => {
  for (const copy of Object.values(copies)) {
    assert.match(copy.spec.bedroom.one, /\{count\}/);
    assert.match(copy.spec.bedroom.many, /\{count\}/);
    assert.match(copy.spec.area, /\{count\}/);
    assert.match(copy.availability.on, /\{date\}/);
    for (const code of ['nearTransit', 'moveInReady', 'petFriendly', 'shortTerm']) assert.ok(copy.quick[code], `quick.${code}`);
    for (const code of ['condo', 'apartment', 'house', 'townhome']) assert.ok(copy.propertyType[code], `propertyType.${code}`);
    for (const code of ['price_asc', 'price_desc', 'newest', 'distance']) assert.ok(copy.results.sort[code], `results.sort.${code}`);
  }
});

test('the guest group is wired into every full locale bundle', () => {
  for (const code of Object.keys(LOCALES)) {
    const source = fs.readFileSync(path.join(__dirname, `../src/locales/${code}.ts`), 'utf8');
    assert.match(source, new RegExp(`guest: ${LOCALES[code]},`), `${code}.ts does not set guest`);
  }
  assert.match(fs.readFileSync(path.join(__dirname, '../src/types.ts'), 'utf8'), /\n  guest: GuestCopy;/);
});

test('the v2.3 shell copy is there: tabs, saved, profile, cookie link and the placeholders it fills', () => {
  for (const [code, copy] of Object.entries(copies)) {
    for (const key of ['label', 'home', 'search', 'saved', 'profile']) assert.ok(copy.tabs[key], `${code} tabs.${key}`);
    for (const key of ['title', 'emptyTitle', 'emptyBody', 'browse']) assert.ok(copy.saved[key], `${code} saved.${key}`);
    for (const key of ['signIn', 'register', 'language', 'privacy', 'terms', 'cookies', 'call', 'email']) assert.ok(copy.profile[key], `${code} profile.${key}`);
    assert.ok(copy.footer.cookieSettings, `${code} footer.cookieSettings`);
    assert.match(copy.nav.soonItem, /\{label\}/, `${code} nav.soonItem`);
    assert.match(copy.nav.languageButton, /\{name\}/, `${code} nav.languageButton`);
    assert.match(copy.footer.copyright, /\{year\}/, `${code} footer.copyright`);
  }
});
