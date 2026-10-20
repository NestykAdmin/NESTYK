const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { i18nMock, contractsTh } = require('./test-i18n.cjs');
function load(file, requireFn = require) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText)(requireFn, module, module.exports);
  return module.exports;
}
const term = load('../lib/lease-term.ts');
const thai = load('../../../packages/i18n/src/locales/th.ts', id => id === './contracts/th' ? { contractsTh } : { AMENITIES_FACILITY_GROUP_LABELS: { th: {} }, AMENITIES_FACILITY_LABELS: { th: {} } });
const cc = thai.th.agent.contracts.closeContract;
function nodes(node) { return !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]; }
const tick = () => new Promise(resolve => setImmediate(resolve));

function harness({ reasons, close, contract, today }) {
  const states = [], effectDeps = [], effects = [];
  let stateIndex = 0, effectIndex = 0, closed = null;
  const hookedReact = { ...React,
    useState: initial => { const i = stateIndex++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; },
    useEffect: (fn, deps) => { const i = effectIndex++, old = effectDeps[i]; if (!old || deps.some((v, j) => v !== old[j])) { effectDeps[i] = deps; effects.push(fn); } },
  };
  const calls = [];
  const deps = {
    react: hookedReact,
    'react-native': { View: 'view', Text: 'text', StyleSheet: { create: s => s } },
    '@nestyk/ui/native': { MobileButton: 'button', MobileFilterChip: 'chip', MobileInput: 'input', tokens: { typography: { native: {} } }, useMobileTheme: () => ({ theme: {} }) },
    '@nestyk/i18n': { ...i18nMock({ agent: thai.th.agent }), localizedError: e => `error:${e.message}` },
    '@nestyk/types': {},
    '../lib/agent-contracts-api': {
      listContractEndReasons: async () => { if (reasons instanceof Error) throw reasons; return reasons; },
      closeAgentContract: async (id, input) => { calls.push([id, input]); return close(id, input); },
    },
    '../lib/contract-close': load('../lib/contract-close.ts', id => id === './lease-term' ? term : require(id)),
    '../lib/lease-term': term,
  };
  const { ContractCloseCard, closeResultNotice } = load('ContractCloseCard.tsx', id => { if (!(id in deps)) throw new Error(`Unexpected dependency: ${id}`); return deps[id]; });
  const render = () => { stateIndex = effectIndex = 0; const tree = ContractCloseCard({ contract, today, onClosed: r => { closed = r; } }); effects.splice(0).forEach(fn => fn()); return tree; };
  const find = (type, text) => nodes(render()).find(n => n.type === type && (text == null || [].concat(n.props.children ?? n.props.label).join('') === text));
  return { render, find, calls, get closed() { return closed; }, closeResultNotice };
}
const reasons = [
  { code: 'term_completed', nameTh: 'ครบกำหนดสัญญา', nameEn: 'Term completed', status: 'expired', requiresNote: false },
  { code: 'tenant_requested', nameTh: 'ผู้เช่าขอยุติก่อนกำหนด', nameEn: 'Early', status: 'terminated', requiresNote: true },
  { code: 'before_start_cancelled', nameTh: 'ยกเลิกก่อนเริ่มเช่า', nameEn: 'Cancelled', status: 'cancelled', requiresNote: true },
];
const lease = { id: 9, contractNo: 'LS009', formKind: 'lease', status: 'active', templateId: 3, startDate: '2026-01-01', endDate: '2026-12-31' };
const result = { contract: { ...lease, status: 'terminated' }, billing: { policy: 'retain_existing', unpaidCount: 2, unpaidAmount: '15000.00', paidCount: 3, billsDueAfterEndCount: 1 } };

test('close card: shows only reasons valid today, needs a note when the reason asks, and sends the request once confirmed', async () => {
  const h = harness({ reasons, close: async () => result, contract: lease, today: '2026-06-15' });
  assert.equal(h.find('chip'), undefined);
  h.find('button', cc.action).props.onPress();
  h.render(); await tick();
  const chips = nodes(h.render()).filter(n => n.type === 'chip');
  assert.deepEqual(chips.map(c => c.props.label), ['ผู้เช่าขอยุติก่อนกำหนด', 'ยกเลิกก่อนเริ่มเช่า']);
  assert.equal(h.find('button', cc.confirm).props.disabled, true);
  chips[0].props.onPress();
  const [date] = nodes(h.render()).filter(n => n.type === 'input');
  assert.equal(date.props.value, '2026-06-15');
  assert.equal(h.find('text', cc.cancelAfterStart.replace('{start}', '2026-01-01')), undefined);
  // The effects are listed before the agent confirms.
  assert.ok(nodes(h.render()).some(n => n.type === 'text' && String(n.props.children).includes(cc.effectBills)));
  assert.ok(nodes(h.render()).some(n => n.type === 'text' && String(n.props.children).includes(cc.effectStatus.replace('{status}', contractsTh.common.status.terminated))));
  assert.equal(h.find('button', cc.confirm).props.disabled, true, 'note is required for this reason');
  nodes(h.render()).filter(n => n.type === 'input')[1].props.onChangeText('   ');
  assert.equal(h.find('button', cc.confirm).props.disabled, true, 'spaces are not a note');
  nodes(h.render()).filter(n => n.type === 'input')[1].props.onChangeText('  ย้ายงาน  ');
  date.props.onChangeText('2026-06-20');
  assert.equal(nodes(h.render()).filter(n => n.type === 'input')[0].props.error, cc.problems.future);
  assert.equal(h.find('button', cc.confirm).props.disabled, true);
  nodes(h.render()).filter(n => n.type === 'input')[0].props.onChangeText('2026-06-10');
  assert.equal(nodes(h.render()).filter(n => n.type === 'input')[0].props.error, undefined);
  const confirm = h.find('button', cc.confirm);
  assert.equal(confirm.props.disabled, false);
  confirm.props.onPress(); await tick();
  assert.deepEqual(h.calls, [[9, { endReasonCode: 'tenant_requested', effectiveEndDate: '2026-06-10', note: 'ย้ายงาน' }]]);
  assert.equal(h.closed, result);
  assert.ok(h.find('button', cc.action), 'the card folds back after closing');
});

test('close card: an expired close keeps the original end date and a failed request stays open with the error', async () => {
  const h = harness({ reasons, close: async () => { throw new Error('busy'); }, contract: lease, today: '2027-01-05' });
  h.find('button', cc.action).props.onPress(); h.render(); await tick();
  nodes(h.render()).find(n => n.type === 'chip' && n.props.label === 'ครบกำหนดสัญญา').props.onPress();
  assert.equal(nodes(h.render()).filter(n => n.type === 'input').length, 1, 'only the note field; the date is fixed');
  assert.ok(h.find('text', cc.dateLocked.replace('{date}', '2026-12-31')));
  h.find('button', cc.confirm).props.onPress(); await tick();
  assert.deepEqual(h.calls, [[9, { endReasonCode: 'term_completed', effectiveEndDate: '2026-12-31' }]]);
  assert.equal(h.closed, null);
  assert.ok(h.find('text', 'error:busy'));
  assert.ok(h.find('button', cc.confirm));
});

test('close card: says so when reasons cannot load or none applies', async () => {
  const broken = harness({ reasons: new Error('down'), close: async () => result, contract: lease, today: '2026-06-15' });
  broken.find('button', cc.action).props.onPress(); broken.render(); await tick();
  assert.ok(broken.find('text', 'error:down'));
  assert.equal(broken.find('text', cc.loading), undefined);
  assert.equal(broken.find('button', cc.confirm).props.disabled, true);
  // Only "term completed" exists, and mid-term it does not apply.
  const none = harness({ reasons: [reasons[0]], close: async () => result, contract: lease, today: '2026-06-15' });
  none.find('button', cc.action).props.onPress(); none.render(); await tick();
  assert.ok(none.find('text', cc.noOption));
  assert.equal(none.find('button', cc.confirm).props.disabled, true);
});

test('close notice reports unpaid bills and bills due after the end', () => {
  const { closeResultNotice } = harness({ reasons, close: async () => result, contract: lease, today: '2026-06-15' });
  assert.equal(closeResultNotice(result, cc), [cc.done, 'มีบิลค้างชำระ 2 ใบ รวม 15,000.00 บาท', cc.doneAfterEnd.replace('{count}', '1')].join(' · '));
  assert.equal(closeResultNotice({ ...result, billing: { ...result.billing, unpaidCount: 0, billsDueAfterEndCount: 0 } }, cc), cc.done);
});

test('close card: picking "cancelled before start" on a lease that already started shows a warning', async () => {
  const h = harness({ reasons, close: async () => result, contract: lease, today: '2026-06-15' });
  h.find('button', cc.action).props.onPress(); h.render(); await tick();
  nodes(h.render()).find(n => n.type === 'chip' && n.props.label === 'ยกเลิกก่อนเริ่มเช่า').props.onPress();
  assert.ok(h.find('text', cc.cancelAfterStart.replace('{start}', '2026-01-01')));
  assert.equal(nodes(h.render()).filter(n => n.type === 'input')[0].props.value, '2025-12-31');
  const early = harness({ reasons, close: async () => result, contract: lease, today: '2025-12-20' });
  early.find('button', cc.action).props.onPress(); early.render(); await tick();
  nodes(early.render()).find(n => n.type === 'chip').props.onPress();
  assert.equal(early.find('text', cc.cancelAfterStart.replace('{start}', '2026-01-01')), undefined);
});
