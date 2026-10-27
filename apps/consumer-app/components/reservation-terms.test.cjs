// D13 (AC-3.7) and D3 (AC-3.6): the commission confirmation and the signing due day on a reservation letter.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { i18nMock, contractsTh, fillTemplate } = require('./test-i18n.cjs');

const load = (file, deps) => {
  const m = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText)(deps, m, m.exports);
  return m.exports;
};
const fmt = load('../lib/bill-format.ts', (name) => assert.fail(`Unexpected dependency: ${name}`)).billFormatters('th');
const signing = load('../lib/contract-signing.ts', (name) => assert.fail(`Unexpected dependency: ${name}`));
const { ReservationTerms } = load('ReservationTerms.tsx', (name) => {
  if (name === 'react') return React;
  if (name === 'react-native') return { View: 'section', Text: 'span' };
  if (name === '@nestyk/ui/native') return { useMobileTheme: () => ({ theme: {} }), tokens: { typography: { native: {} }, colors: { danger: 'red' } }, MobileButton: 'button' };
  if (name === '@nestyk/i18n') return i18nMock();
  if (name === '../lib/bill-format') return { billFormatters: () => fmt };
  if (name === '../lib/contract-signing') return signing;
  throw new Error(`Unexpected dependency: ${name}`);
});
const nodes = (node) => (!node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]);
const text = (node) => [node.props.children].flat().join('');
const render = (props) => nodes(ReservationTerms(props));
const rt = contractsTh.reservationTerms;
const commission = { documentNo: 'CCM-RS202600011', monthlyRent: '20000', leaseStart: '2026-11-01', leaseEnd: '2028-04-30', fullYears: 1, restDays: 182, amount: '29973', url: null };
const letter = (patch = {}) => ({ formKind: 'reservation', commission, signDueDate: '2026-10-13', ...patch });

test('the agent sees the due day, then a warning once it is past (TC-3.07: due 13 Oct, warned from 14 Oct)', () => {
  const due = fillTemplate(rt.signDue, { date: fmt.date('2026-10-13') });
  const late = fillTemplate(rt.signLate, { date: fmt.date('2026-10-13') });
  const on13 = render({ contract: letter(), today: '2026-10-13' });
  assert.ok(on13.some((n) => n.type === 'span' && text(n) === due && n.props.accessibilityRole === undefined));
  const on14 = render({ contract: letter(), today: '2026-10-14' });
  assert.ok(on14.some((n) => n.type === 'span' && text(n) === late && n.props.accessibilityRole === 'alert'));
  assert.ok(!render({ contract: letter(), today: '2026-10-14', showDue: false }).some((n) => text(n) === late), 'the landlord gets no due day');
  assert.ok(!render({ contract: letter({ signDueDate: null }), today: '2026-10-14' }).some((n) => text(n) === late || text(n) === due), 'signed by everyone');
});

test('the commission: amount, lease and rent, how it was worked out; the PDF button once generated', () => {
  const lines = render({ contract: letter(), today: '2026-10-13' }).filter((n) => n.type === 'span').map(text);
  for (const line of [
    fillTemplate(rt.commissionTitle, { no: 'CCM-RS202600011' }),
    fillTemplate(rt.commissionAmount, { amount: fmt.amount(29973) }),
    fillTemplate(rt.commissionPeriod, { from: fmt.date('2026-11-01'), to: fmt.date('2028-04-30'), rent: fmt.amount(20000) }),
    fillTemplate(rt.commissionYears, { years: '1' }),
    fillTemplate(rt.commissionDays, { days: '182' }),
    rt.commissionSignNote,
  ]) assert.ok(lines.includes(line), line);
  const short = render({ contract: letter({ commission: { ...commission, fullYears: 0, restDays: 181 } }), today: '2026-10-13' }).map(text);
  assert.ok(!short.includes(fillTemplate(rt.commissionYears, { years: '0' })), 'no full-year line under a year');
  const year = render({ contract: letter({ commission: { ...commission, fullYears: 1, restDays: 0 } }), today: '2026-10-13' }).map(text);
  assert.ok(!year.includes(fillTemplate(rt.commissionDays, { days: '0' })), 'no days line for whole years');
  assert.equal(render({ contract: letter(), today: '2026-10-13', onOpenCommission: () => {} }).find((n) => n.type === 'button'), undefined, 'no PDF yet');
  const opened = [];
  const button = render({ contract: letter({ commission: { ...commission, url: 'https://signed/c.pdf' } }), today: '2026-10-13', onOpenCommission: (url) => opened.push(url) })
    .find((n) => n.type === 'button');
  assert.equal(text(button), rt.openCommission);
  button.props.onPress();
  assert.deepEqual(opened, ['https://signed/c.pdf']);
});

test('nothing for other agreements, or for a letter with neither (the tenant\'s view after everyone signed)', () => {
  assert.equal(ReservationTerms({ contract: letter({ formKind: 'lease' }), today: '2026-10-14' }), null);
  assert.equal(ReservationTerms({ contract: letter({ commission: null, signDueDate: null }), today: '2026-10-14' }), null);
});

test('every locale has the same reservation-terms copy keys', () => {
  const loadLocale = (file) => {
    const m = { exports: {} };
    new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../../packages/i18n/src/locales/contracts', file), 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(() => ({}), m, m.exports);
    return Object.values(m.exports)[0];
  };
  for (const file of ['en.ts', 'ja.ts', 'zh.ts']) {
    const copy = loadLocale(file).reservationTerms;
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(rt).sort(), file);
    for (const [key, value] of Object.entries(copy)) {
      assert.ok(value.trim(), `${file} ${key}`);
      for (const slot of rt[key].match(/\{\w+\}/g) ?? []) assert.ok(value.includes(slot), `${file} ${key} keeps ${slot}`);
    }
  }
});
