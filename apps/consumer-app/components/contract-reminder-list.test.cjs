// D4 (AC-3.6, 4.6, 5.5, 7.4 to 7.6): the reminder list (the agent's "to do" tab, the landlord's contracts screen).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { i18nMock, contractsTh, fillTemplate } = require('./test-i18n.cjs');

const transpile = (file, req) => {
  const m = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText)(req, m, m.exports);
  return m.exports;
};
const fmt = transpile('../lib/bill-format.ts', () => ({})).billFormatters('th');
function harness(component, file, extra = {}) {
  const states = []; const effects = []; let index = 0;
  const hooked = { ...React,
    useState: (initial) => { const i = index++; if (!(i in states)) states[i] = initial; return [states[i], (next) => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; },
    useEffect: (fn) => { effects.push(fn); },
  };
  const mod = transpile(file, (name) => {
    if (name === 'react') return hooked;
    if (name === 'react-native') return { View: 'section', Text: 'span', Pressable: 'press' };
    if (name === '@nestyk/ui/native') return { useMobileTheme: () => ({ theme: {} }), tokens: { typography: { native: {} }, colors: { danger: 'red' } }, MobileButton: 'button', MobileInput: 'input' };
    if (name === '@nestyk/i18n') return i18nMock();
    if (name === '../lib/bill-format') return { billFormatters: () => fmt };
    if (name in extra) return extra[name];
    throw new Error(`Unexpected dependency: ${name}`);
  });
  const nodes = (n) => (!n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(nodes) : [n, ...nodes(n.props?.children)]);
  const render = (props) => { index = 0; effects.length = 0; const tree = mod[component](props); return nodes(tree); };
  return { render, runEffects: () => effects.splice(0).forEach((fn) => fn()) };
}
const text = (n) => [n.props.children].flat().join('');
const rc = contractsTh.reminders;
const reminder = (patch = {}) => ({ kind: 'rent_overdue_15', contractId: 21, tenantId: 2, billId: 50, billPeriod: '2026-12', amount: 20000,
  dueDate: '2026-12-01', contractNo: 'LS202600021', tenantName: 'Tenant', property: 'Aria', room: '1201', ...patch });

test('reminders show what, which contract, the bill and the day, and open on tap; nothing when there are none or it fails', async () => {
  const rows = [reminder(), reminder({ kind: 'renewal_notice', billId: null, billPeriod: null, amount: null, dueDate: '2027-10-31' }),
    reminder({ kind: 'refund_late', contractId: 30, billId: null, billPeriod: null, amount: 60000, dueDate: '2026-10-22' })];
  const h = harness('ContractReminderList', 'ContractReminderList.tsx');
  const opened = [];
  const props = { load: async () => rows, audience: 'agent', onOpen: (r) => opened.push(r.kind) };
  assert.deepEqual(h.render(props), [], 'nothing before it loads');
  h.runEffects(); await new Promise((r) => setImmediate(r));
  const tree = h.render(props);
  const lines = tree.filter((n) => n.type === 'span').map(text);
  for (const line of [rc.title, rc.kinds.rent_overdue_15, 'LS202600021 · Tenant · Aria ห้อง 1201',
    fillTemplate(rc.bill, { period: fmt.month('2026-12'), amount: fmt.amount(20000) }), fillTemplate(rc.dueLabel.rent_overdue_15, { date: fmt.date('2026-12-01') }),
    rc.kinds.renewal_notice, fillTemplate(rc.dueLabel.renewal_notice, { date: fmt.date('2027-10-31') }),
    // D5 (TC-C.05): the late refund with its amount and due day
    rc.kinds.refund_late, fillTemplate(rc.refund, { amount: fmt.amount(60000) }), fillTemplate(rc.dueLabel.refund_late, { date: fmt.date('2026-10-22') })]) assert.ok(lines.includes(line), line);
  tree.filter((n) => n.type === 'press').forEach((n) => n.props.onPress());
  assert.deepEqual(opened, ['rent_overdue_15', 'renewal_notice', 'refund_late']);
  const landlord = harness('ContractReminderList', 'ContractReminderList.tsx');
  const lp = { load: async () => [reminder()], audience: 'landlord' };
  landlord.render(lp); landlord.runEffects(); await new Promise((r) => setImmediate(r));
  const ltree = landlord.render(lp);
  assert.ok(ltree.some((n) => n.type === 'span' && text(n) === rc.landlordTitle));
  assert.equal(ltree.some((n) => n.type === 'press'), false, 'the landlord\'s list is for reading');
  for (const load of [async () => [], async () => { throw new Error('offline'); }]) {
    const empty = harness('ContractReminderList', 'ContractReminderList.tsx');
    empty.render({ load, audience: 'agent' }); empty.runEffects(); await new Promise((r) => setImmediate(r));
    assert.deepEqual(empty.render({ load, audience: 'agent' }), []);
  }
});

test('D4 (AC-5.5): the handover day is moved only with a date and a reason; the moves are listed', async () => {
  const h = harness('HandoverDueControl', 'HandoverDueControl.tsx');
  const hc = contractsTh.handoverDue;
  const moves = [];
  let accept = false;
  const props = { busy: false, onMove: async (date, reason) => { moves.push([date, reason]); return accept; },
    contract: { handoverDue: { date: '2026-11-05', history: [{ from: '2026-11-01', to: '2026-11-05', reason: 'ผู้เช่าขอเลื่อน', at: '2026-10-26T03:00:00Z' }] } } };
  let tree = h.render(props);
  const lines = tree.filter((n) => n.type === 'span').map(text);
  assert.ok(lines.includes(fillTemplate(hc.title, { date: fmt.date('2026-11-05') })));
  assert.ok(lines.includes(fillTemplate(hc.historyItem, { from: fmt.date('2026-11-01'), to: fmt.date('2026-11-05'), reason: 'ผู้เช่าขอเลื่อน' })));
  const button = (label) => h.render(props).find((n) => n.type === 'button' && text(n) === label);
  const input = (label) => h.render(props).find((n) => n.type === 'input' && n.props.label === label);
  button(hc.move).props.onPress();
  await button(hc.save).props.onPress();
  assert.equal(input(hc.date).props.error, hc.dateInvalid);
  input(hc.date).props.onChangeText('2026-11-10');
  input(hc.reason).props.onChangeText('   ');
  await button(hc.save).props.onPress();
  assert.equal(input(hc.reason).props.error, hc.reasonRequired);
  assert.deepEqual(moves, [], 'nothing sent without a date and a reason');
  input(hc.reason).props.onChangeText(' ห้องยังไม่พร้อม ');
  await button(hc.save).props.onPress();
  assert.deepEqual(moves, [['2026-11-10', 'ห้องยังไม่พร้อม']]);
  assert.equal(input(hc.date).props.value, '2026-11-10', 'refused: what was typed stays');
  accept = true;
  await button(hc.save).props.onPress();
  assert.equal(input(hc.date), undefined, 'saved: the form closes');
  assert.deepEqual(h.render({ ...props, contract: { handoverDue: null } }), []);
});
