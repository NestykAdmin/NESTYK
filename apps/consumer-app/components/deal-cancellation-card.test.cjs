// D5 (AC-C.1 to C.4): the agent's deal cancellation form, the cancelled summary, and recording the refund.
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
const none = (name) => assert.fail(`Unexpected dependency: ${name}`);
const fmt = transpile('../lib/bill-format.ts', () => ({})).billFormatters('th');
const rules = transpile('../lib/deal-cancellation.ts', none);
function harness() {
  const states = []; let index = 0;
  const hooked = { ...React, useState: (initial) => { const i = index++; if (!(i in states)) states[i] = initial;
    return [states[i], (next) => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; } };
  const mod = transpile('DealCancellationCard.tsx', (name) => {
    if (name === 'react') return hooked;
    if (name === 'react-native') return { View: 'section', Text: 'span', Pressable: 'press' };
    if (name === 'expo-document-picker') return { getDocumentAsync: async () => ({ canceled: true }) };
    if (name === '@nestyk/ui/native') return { useMobileTheme: () => ({ theme: {} }), tokens: { typography: { native: {} }, colors: { danger: 'red', brand: { 50: '#eef', 500: '#00f' } } }, MobileButton: 'button', MobileInput: 'input' };
    if (name === '@nestyk/i18n') return i18nMock();
    if (name === '../lib/bill-format') return { billFormatters: () => fmt };
    if (name === '../lib/deal-cancellation') return rules;
    return none(name);
  });
  // Components inside (the summary in the card) are rendered too.
  const nodes = (n) => (!n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(nodes)
    : typeof n.type === 'function' ? nodes(n.type(n.props)) : [n, ...nodes(n.props?.children)]);
  return { render: (component, props) => { index = 0; return nodes(mod[component](props)); } };
}
const text = (n) => [n.props.children].flat().join('');
const dc = contractsTh.dealCancel;
const tick = () => new Promise((r) => setImmediate(r));
const preview = (patch = {}) => ({ mainContractId: 202, contracts: [{ id: 201, contractNo: 'RS201', formKind: 'reservation', status: 'active' }, { id: 202, contractNo: 'LS202', formKind: 'lease', status: 'awaiting_deposit' }],
  bookingReceived: 20000, depositReceived: 40000, pendingSlip: false, appointmentActive: true, refundDays: 7, ...patch });
const file = (name) => ({ uri: `file:///${name}`, name, mimeType: 'image/png' });

test('which agreements show "cancel the deal": a booking letter or lease not ended, not a handed-over lease, not a renewal (TC-C.09)', () => {
  const c = (formKind, status, agreementKind = 'new') => rules.canCancelDeal({ formKind, status, agreementKind });
  for (const status of ['draft', 'awaiting_signatures', 'awaiting_agent_review', 'active']) assert.equal(c('reservation', status), true, status);
  for (const status of ['draft', 'awaiting_signatures', 'awaiting_deposit', 'awaiting_handover']) assert.equal(c('lease', status), true, status);
  assert.equal(c('lease', 'active'), false, 'handed over');
  for (const status of ['cancelled', 'expired', 'terminated']) assert.equal(c('reservation', status), false, status);
  assert.equal(c('renewal', 'draft', 'renewal'), false);
  assert.equal(c('broker_appointment', 'active'), false);
  assert.deepEqual(rules.dealCancellationOutcome(preview(), 'tenant', ''), { kind: 'forfeit', amount: 60000 });
  assert.deepEqual(rules.dealCancellationOutcome(preview(), 'landlord', '2026-10-15'), { kind: 'refund', amount: 60000, dueOn: '2026-10-22' });
  assert.deepEqual(rules.dealCancellationOutcome(preview(), 'landlord', '15/10'), { kind: 'refund', amount: 60000, dueOn: null });
  assert.deepEqual(rules.dealCancellationOutcome(preview({ bookingReceived: 0, depositReceived: 0 }), 'landlord', '2026-10-15'), { kind: 'none' });
});

test('TC-C.08: each missing field is named and nothing is sent; filled in, the form sends who, why, the day told and the files', async () => {
  const h = harness();
  const sent = [];
  let accept = false;
  const picks = [file('chat.png'), file('letter.pdf')];
  const props = { contract: { id: 202, formKind: 'lease', status: 'awaiting_deposit', agreementKind: 'new', cancellation: null }, busy: false, today: '2026-10-26',
    loadPreview: async () => preview(), onCancel: async (input, evidence) => { sent.push([input, evidence.map((f) => f.name)]); return accept; },
    onRecordRefund: async () => true, onOpen: () => {}, pick: async () => picks.shift() ?? null };
  const label = (n) => (n.type === 'press' ? [n.props.children].flat().map((c) => (c?.props ? text(c) : String(c))).join('') : text(n));
  const find = (type, wanted) => h.render('DealCancellationCard', props).find((n) => n.type === type && (type === 'input' ? n.props.label === wanted : label(n).endsWith(wanted)));
  const lines = () => h.render('DealCancellationCard', props).filter((n) => n.type === 'span').map(text);
  find('button', dc.open).props.onPress();
  await tick();
  assert.ok(lines().includes(fillTemplate(dc.willCancel, { list: 'RS201, LS202' })));
  assert.ok(lines().includes(fillTemplate(dc.received, { booking: fmt.amount(20000), deposit: fmt.amount(40000) })));
  await find('button', dc.confirm).props.onPress();
  assert.ok(lines().includes(fillTemplate(dc.missing, { fields: [dc.fields.reason, dc.fields.evidence, dc.fields.atFault].join(', ') })), lines().join('|'));
  find('press', dc.landlord).props.onPress();
  find('input', dc.reason).props.onChangeText(' Owner sold ');
  await find('button', dc.confirm).props.onPress();
  assert.ok(lines().includes(fillTemplate(dc.missing, { fields: [dc.fields.evidence, dc.fields.notifiedOn].join(', ') })));
  await find('button', dc.addEvidence).props.onPress(); await tick();
  await find('button', dc.addEvidence).props.onPress(); await tick();
  find('input', dc.notifiedOn).props.onChangeText('15/10/2026');
  await find('button', dc.confirm).props.onPress();
  assert.ok(lines().includes(dc.dateInvalid));
  assert.deepEqual(sent, [], 'nothing sent while incomplete');
  find('input', dc.notifiedOn).props.onChangeText('2026-10-15');
  assert.ok(lines().includes(fillTemplate(dc.outcomeRefund, { amount: fmt.amount(60000), date: fmt.date('2026-10-22') })), 'TC-C.07: refund 60,000 by 22 Oct');
  assert.ok(lines().includes(dc.keepAppointment), 'not ticked: the appointment stays');
  find('press', dc.endAppointment).props.onPress();
  await find('button', dc.confirm).props.onPress();
  assert.deepEqual(sent, [[{ atFault: 'landlord', reason: 'Owner sold', notifiedOn: '2026-10-15', endAppointment: true }, ['chat.png', 'letter.pdf']]]);
  assert.ok(find('button', dc.confirm), 'refused by the API: the form stays as typed');
  find('press', dc.tenant).props.onPress();
  assert.ok(lines().includes(fillTemplate(dc.outcomeForfeit, { amount: fmt.amount(60000) })), 'TC-C.06: tenant at fault forfeits 60,000');
  assert.equal(find('press', dc.endAppointment), undefined, 'only when the landlord is at fault');
  accept = true;
  await find('button', dc.confirm).props.onPress();
  assert.deepEqual(sent[1], [{ atFault: 'tenant', reason: 'Owner sold' }, ['chat.png', 'letter.pdf']]);
  assert.ok(find('button', dc.open), 'saved: the form closes');
});

test('a slip without a receipt is flagged; a handed-over lease shows nothing; a failed preview shows why', async () => {
  const h = harness();
  const base = { busy: false, today: '2026-10-26', onCancel: async () => true, onRecordRefund: async () => true, onOpen: () => {} };
  const props = { ...base, contract: { id: 201, formKind: 'reservation', status: 'active', agreementKind: 'new', cancellation: null }, loadPreview: async () => preview({ pendingSlip: true, depositReceived: 0 }) };
  h.render('DealCancellationCard', props).find((n) => n.type === 'button' && text(n) === dc.open).props.onPress();
  await tick();
  assert.ok(h.render('DealCancellationCard', props).some((n) => n.type === 'span' && text(n) === dc.pendingSlip && n.props.accessibilityRole === 'alert'));
  assert.deepEqual(harness().render('DealCancellationCard', { ...props, contract: { ...props.contract, formKind: 'lease', status: 'active' } }), []);
  const failing = harness();
  const fp = { ...props, loadPreview: async () => { throw new Error('ส่งมอบห้องแล้ว ยกเลิกดีลไม่ได้'); } };
  failing.render('DealCancellationCard', fp).find((n) => n.type === 'button' && text(n) === dc.open).props.onPress();
  await tick();
  const tree = failing.render('DealCancellationCard', fp);
  assert.ok(tree.some((n) => n.type === 'span' && text(n) === 'ส่งมอบห้องแล้ว ยกเลิกดีลไม่ได้'));
  assert.equal(tree.find((n) => n.type === 'button' && text(n) === dc.confirm), undefined);
});

const cancellation = (patch = {}) => ({ id: 1, mainContractId: 202, contractIds: [201, 202], atFault: 'landlord', reason: 'Owner sold', notifiedOn: '2026-10-15',
  bookingReceived: 20000, depositReceived: 40000, forfeitedAmount: 0, refundAmount: 60000, refundDueOn: '2026-10-22', refundedOn: null,
  refundProofUrl: null, evidenceUrls: ['https://s/e1', 'https://s/e2'], appointmentEnded: false, cancelledAt: '2026-10-16T03:00:00Z', ...patch });

test('cancelled: who, why, the money and the due day (late from the day after); the refund needs a date and its proof, once', async () => {
  const h = harness();
  const refunds = [], opened = [];
  const picks = [file('slip.pdf')];
  const props = { contract: { id: 202, formKind: 'lease', status: 'cancelled', agreementKind: 'new', cancellation: cancellation() }, busy: false, today: '2026-10-22',
    loadPreview: async () => assert.fail('no preview once cancelled'), onCancel: async () => assert.fail('no cancel'),
    onRecordRefund: async (day, proof) => { refunds.push([day, proof.name]); return true; }, onOpen: (url, label) => opened.push([url, label]), pick: async () => picks.shift() ?? null };
  const lines = (p = props) => h.render('DealCancellationCard', p).filter((n) => n.type === 'span').map(text);
  for (const line of [dc.cancelledTitle, fillTemplate(dc.cancelledBy, { party: dc.landlord }), fillTemplate(dc.cancelledReason, { reason: 'Owner sold' }),
    fillTemplate(dc.receivedSummary, { booking: fmt.amount(20000), deposit: fmt.amount(40000) }),
    fillTemplate(dc.refund, { amount: fmt.amount(60000), date: fmt.date('2026-10-22') })]) assert.ok(lines().includes(line), line);
  assert.ok(!lines().includes(dc.refundLate), 'TC-C.05: not late on 22 Oct');
  assert.ok(lines({ ...props, today: '2026-10-23' }).includes(dc.refundLate), 'late on 23 Oct');
  const button = (label) => h.render('DealCancellationCard', props).find((n) => n.type === 'button' && text(n) === label);
  button(fillTemplate(dc.openEvidence, { n: '2' })).props.onPress();
  assert.deepEqual(opened, [['https://s/e2', fillTemplate(dc.openEvidence, { n: '2' })]]);
  await button(dc.saveRefund).props.onPress();
  assert.ok(lines().includes(dc.dateInvalid));
  h.render('DealCancellationCard', props).find((n) => n.type === 'input' && n.props.label === dc.refundedOn).props.onChangeText('2026-10-20');
  await button(dc.saveRefund).props.onPress();
  assert.ok(lines().includes(dc.refundProofMissing));
  await button(dc.refundProof).props.onPress(); await tick();
  await button(dc.saveRefund).props.onPress();
  assert.deepEqual(refunds, [['2026-10-20', 'slip.pdf']]);
  const done = { ...props, contract: { ...props.contract, cancellation: cancellation({ refundedOn: '2026-10-20', refundProofUrl: 'https://s/p' }) }, today: '2026-10-30' };
  assert.ok(lines(done).includes(fillTemplate(dc.refunded, { date: fmt.date('2026-10-20') })));
  assert.ok(!lines(done).includes(dc.refundLate));
  assert.equal(h.render('DealCancellationCard', done).find((n) => n.type === 'button' && text(n) === dc.saveRefund), undefined, 'recorded once');
  const forfeited = { ...props, contract: { ...props.contract, cancellation: cancellation({ atFault: 'tenant', forfeitedAmount: 60000, refundAmount: 0, refundDueOn: null, notifiedOn: null }) } };
  assert.ok(lines(forfeited).includes(fillTemplate(dc.forfeited, { amount: fmt.amount(60000) })));
  assert.equal(h.render('DealCancellationCard', forfeited).find((n) => n.type === 'button' && text(n) === dc.saveRefund), undefined, 'nothing to refund');
  // the parties' summary: no files
  const party = harness().render('DealCancellationSummary', { cancellation: cancellation({ evidenceUrls: [], refundProofUrl: null }), today: '2026-10-23' });
  assert.equal(party.some((n) => n.type === 'button'), false);
  assert.ok(party.some((n) => n.type === 'span' && text(n) === fillTemplate(dc.refund, { amount: fmt.amount(60000), date: fmt.date('2026-10-22') })));
});

test('every locale has the same deal-cancellation and refund reminder copy', () => {
  const loadLocale = (file) => {
    const m = { exports: {} };
    new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../../packages/i18n/src/locales/contracts', file), 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(() => ({}), m, m.exports);
    return Object.values(m.exports)[0];
  };
  const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
  const th = new Map(flat({ dealCancel: dc, refund: contractsTh.reminders.refund, kind: contractsTh.reminders.kinds.refund_late, due: contractsTh.reminders.dueLabel.refund_late }));
  for (const file of ['en.ts', 'ja.ts', 'zh.ts']) {
    const copy = loadLocale(file);
    const other = new Map(flat({ dealCancel: copy.dealCancel, refund: copy.reminders.refund, kind: copy.reminders.kinds.refund_late, due: copy.reminders.dueLabel.refund_late }));
    assert.deepEqual([...other.keys()].sort(), [...th.keys()].sort(), file);
    for (const [key, value] of other) {
      assert.ok(String(value).trim(), `${file} ${key}`);
      for (const slot of String(th.get(key)).match(/\{\w+\}/g) ?? []) assert.ok(String(value).includes(slot), `${file} ${key} keeps ${slot}`);
    }
  }
});
