// D2 (AC-2.1 to 2.4, round 1, Aof 22 Oct 2026): the agent's offer inside the booking sheet, and the landlord's list.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { i18nMock, contractsTh, fillTemplate } = require('./test-i18n.cjs');
const { localizedError } = (() => { const m = { exports: {} }; new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../../packages/i18n/src/error-message.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(require, m, m.exports); return m.exports; })();
const load = (file, requireFn) => { const m = { exports: {} }; new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText)(requireFn, m, m.exports); return m.exports; };
const rules = load('../lib/deal-offer.ts', require);
const oc = contractsTh.offer;
const nodes = (node) => (!node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]);
const label = (n) => [].concat(n.props.children).flat().join('');

const offer = (patch = {}) => ({
  id: 5, leadId: 7, leadName: 'Lead A', rentRoomId: 42, roomLabel: 'Aria · ห้อง 1201', status: 'draft', revision: 2, monthlyRent: '15000',
  termMonths: 12, startDate: '2026-11-01', endDate: '2027-10-31', depositAmount: '30000', reservationAmount: '15000', contractDate: '2026-10-25',
  rentDueDay: 1, graceDay: 5, lateFeePerDay: '200', renewalNoticeDays: 30, coBroke: false, coBrokeAgentName: null, sentAt: null,
  confirmedAt: null, confirmationChannel: null, confirmationMethod: null, confirmationNote: null, confirmedByName: null, landlordInApp: true, closedAt: null, ...patch,
});

/** Renders a component with stand-in hooks, so effects and api calls can be driven step by step. */
function harness(file, exportName, props, api) {
  const states = [], refs = [], effectDeps = [], effects = [], callbacks = [];
  let stateIndex = 0, refIndex = 0, effectIndex = 0, callbackIndex = 0;
  const hooked = { ...React,
    useRef: (initial) => (refs[refIndex++] ??= { current: initial }),
    useState: (initial) => { const i = stateIndex++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], (next) => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; },
    useCallback: (fn, deps) => { const i = callbackIndex++, old = callbacks[i]; if (!old || deps.some((v, j) => v !== old.deps[j])) callbacks[i] = { fn, deps }; return callbacks[i].fn; },
    useEffect: (fn, deps) => { const i = effectIndex++, old = effectDeps[i]; if (!old || deps.some((v, j) => v !== old[j])) { effectDeps[i] = deps; effects.push(fn); } },
  };
  const deps = {
    react: hooked,
    'react-native': { View: 'section', Text: 'span', ActivityIndicator: 'progress' },
    '@nestyk/ui/native': { tokens: { colors: { brand: { 500: '#ff0' }, danger: '#c00' }, typography: { native: {} } }, useMobileTheme: () => ({ theme: {} }), MobileButton: 'button', MobileInput: 'input' },
    '@nestyk/i18n': { ...i18nMock({ common: { errorGeneric: 'เกิดข้อผิดพลาด' } }), localizedError },
    '../lib/deal-offer': rules,
    '../lib/deal-offers-api': api,
  };
  const requireFn = (id) => {
    if (id === './DealOfferSection') return section;
    if (!(id in deps)) throw new Error(`Unexpected dependency: ${id}`);
    return deps[id];
  };
  const section = file === 'DealOfferSection.tsx' ? null : load('DealOfferSection.tsx', requireFn);
  const mod = load(file, requireFn);
  const render = () => { stateIndex = refIndex = effectIndex = callbackIndex = 0; const tree = mod[exportName](props); effects.splice(0).forEach((fn) => fn()); return tree; };
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  const settle = async () => { render(); for (let i = 0; i < 4; i++) await tick(); return expand(render()); };
  // Summary components are rendered too, so their lines can be found.
  const expand = (tree) => [...nodes(tree), ...nodes(tree).filter((n) => typeof n.type === 'function').flatMap((n) => nodes(n.type(n.props)))];
  return { render, tick, settle, expand };
}
function agent(offers, overrides = {}) {
  const calls = [], confirmed = [];
  const api = {
    listLeadDealOffers: async (leadId) => { calls.push(['list', leadId]); return typeof offers === 'function' ? offers() : offers; },
    createDealOffer: async (body) => { calls.push(['create', body]); return overrides.create?.(body) ?? offer({ revision: 1 }); },
    updateDealOffer: async (id, body) => { calls.push(['update', id, body]); return overrides.update?.(body) ?? offer({ revision: 3 }); },
    sendDealOffer: async (id, revision) => { calls.push(['send', id, revision]); if (overrides.send) return overrides.send(); return offer({ status: 'awaiting_landlord', revision }); },
    recordDealOfferConfirmation: async (id, body) => { calls.push(['record', id, body]); return offer({ status: 'confirmed', confirmationChannel: 'agent_recorded', confirmationMethod: body.method, confirmationNote: body.note }); },
    cancelDealOffer: async (id, revision) => { calls.push(['cancel', id, revision]); return offer({ status: 'cancelled', revision }); },
  };
  const h = harness('DealOfferSection.tsx', 'DealOfferSection', { leadId: 7, roomId: 42, onConfirmedChange: (value) => confirmed.push(value) }, api);
  return { ...h, calls, confirmed };
}
const buttons = (tree) => tree.filter((n) => n.type === 'button');
const button = (tree, text) => buttons(tree).find((n) => label(n) === text);
const input = (tree, key) => tree.find((n) => n.type === 'input' && n.props.label === oc.fields[key]);
const texts = (tree) => tree.filter((n) => n.type === 'span').map(label);

test('no offer yet: the agent fills in the terms; the form checks them before creating it for this lead and room', async () => {
  const h = agent([offer({ rentRoomId: 99 }), offer({ status: 'cancelled' })]);
  let tree = await h.settle();
  assert.deepEqual(h.calls, [['list', 7]]);
  assert.equal(h.confirmed.at(-1), false);
  assert.ok(texts(tree).includes(oc.intro));
  assert.deepEqual(buttons(tree).map(label), [oc.yes, oc.no, oc.save], 'no send, record or cancel before saving');
  button(tree, oc.save).props.onPress();
  tree = h.expand(h.render());
  assert.equal(input(tree, 'monthlyRent').props.error, oc.issues.required);
  assert.equal(h.calls.length, 1, 'nothing sent with issues');
  for (const [key, value] of Object.entries({ monthlyRent: '15000', startDate: '2026-11-01', depositAmount: '30000', contractDate: '2026-10-25', rentDueDay: '1' }))
    input(h.expand(h.render()), key).props.onChangeText(value);
  tree = h.expand(h.render());
  assert.equal(input(tree, 'monthlyRent').props.error, undefined, 'typing clears the message');
  assert.ok(texts(tree).includes(fillTemplate(oc.reservationAmount, { amount: '15000' })), 'the reservation is 1 month of rent');
  button(tree, oc.yes).props.onPress();
  tree = h.expand(h.render());
  assert.ok(input(tree, 'coBrokeAgentName'), 'another agent asks for the name');
  button(tree, oc.save).props.onPress();
  assert.equal(h.expand(h.render()).find((n) => n.type === 'input' && n.props.label === oc.fields.coBrokeAgentName).props.error, oc.issues.coBrokeName);
  input(h.expand(h.render()), 'coBrokeAgentName').props.onChangeText('Other Agent');
  button(h.expand(h.render()), oc.save).props.onPress();
  await h.tick(); await h.tick();
  assert.deepEqual(h.calls[1], ['create', { monthlyRent: '15000', termMonths: 12, startDate: '2026-11-01', depositAmount: '30000', contractDate: '2026-10-25',
    rentDueDay: 1, graceDay: null, lateFeePerDay: null, renewalNoticeDays: null, coBroke: true, coBrokeAgentName: 'Other Agent', leadId: 7, rentRoomId: 42 }]);
});

test('a saved draft: send it to the landlord or record the confirmation, but save edits first; the revision goes with each step', async () => {
  const h = agent([offer()]);
  let tree = await h.settle();
  assert.equal(h.confirmed.at(-1), false, 'a draft does not allow booking');
  assert.equal(button(tree, oc.save).props.disabled, true, 'nothing to save');
  assert.ok(button(tree, oc.send) && button(tree, oc.record) && button(tree, oc.cancel));
  input(tree, 'monthlyRent').props.onChangeText('16000');
  tree = h.expand(h.render());
  assert.ok(texts(tree).includes(oc.unsaved));
  assert.deepEqual([button(tree, oc.save).props.disabled, button(tree, oc.send).props.disabled, button(tree, oc.record).props.disabled], [false, true, true]);
  button(tree, oc.save).props.onPress();
  await h.tick(); await h.tick();
  assert.deepEqual(h.calls[1], ['update', 5, { ...rules.dealOfferBody({ ...rules.dealOfferForm(offer()), monthlyRent: '16000' }), revision: 2 }]);
  tree = h.expand(h.render());
  button(tree, oc.send).props.onPress();
  await h.tick(); await h.tick();
  assert.deepEqual(h.calls[2], ['send', 5, 3]);
  tree = h.expand(h.render());
  assert.equal(h.confirmed.at(-1), false, 'waiting for the landlord does not allow booking');
  assert.ok(texts(tree).includes(oc.sentHint));
  assert.equal(button(tree, oc.send), undefined, 'sent once');
  // Recording: a note is required.
  button(tree, oc.record).props.onPress();
  tree = h.expand(h.render());
  button(tree, oc.methods.line).props.onPress();
  button(h.expand(h.render()), oc.recordConfirm).props.onPress();
  tree = h.expand(h.render());
  assert.equal(tree.find((n) => n.type === 'input' && n.props.label === oc.recordNote).props.error, oc.recordNoteRequired);
  assert.equal(h.calls.length, 3);
  tree.find((n) => n.type === 'input' && n.props.label === oc.recordNote).props.onChangeText('  said yes on LINE  ');
  button(h.expand(h.render()), oc.recordConfirm).props.onPress();
  await h.tick(); await h.tick();
  assert.deepEqual(h.calls[3], ['record', 5, { revision: 3, method: 'line', note: 'said yes on LINE' }]);
  tree = h.expand(h.render());
  assert.equal(h.confirmed.at(-1), true, 'the sheet may now book');
  assert.ok(texts(tree).includes(fillTemplate(oc.confirmedRecorded, { method: oc.methods.line, note: 'said yes on LINE' })));
});

test('a landlord without an app account: no send button, and the agent is told to record the confirmation', async () => {
  const tree = await agent([offer({ landlordInApp: false })]).settle();
  assert.equal(button(tree, oc.send), undefined);
  assert.ok(texts(tree).includes(oc.noLandlordApp));
  assert.ok(button(tree, oc.record));
});

test('a confirmed offer is read-only: its terms, how it was confirmed, and a cancel to start again', async () => {
  const h = agent([offer({ status: 'confirmed', confirmationChannel: 'app', coBroke: true, coBrokeAgentName: 'Other Agent', graceDay: null })]);
  let tree = await h.settle();
  assert.equal(h.confirmed.at(-1), true);
  assert.equal(tree.filter((n) => n.type === 'input').length, 0);
  const lines = texts(tree);
  const sc = oc.summary;
  for (const line of [`${sc.rent}: 15000`, `${sc.term}: ${fillTemplate(sc.termValue, { months: '12', from: '2026-11-01', to: '2027-10-31' })}`, `${sc.reservation}: 15000`,
    `${sc.grace}: ${sc.none}`, `${sc.coBroke}: Other Agent`, oc.confirmedInApp, oc.locked]) assert.ok(lines.includes(line), line);
  assert.deepEqual(buttons(tree).map(label), [oc.cancel]);
  button(tree, oc.cancel).props.onPress();
  await h.tick(); await h.tick();
  assert.deepEqual(h.calls[1], ['cancel', 5, 2]);
  tree = h.expand(h.render());
  assert.equal(h.confirmed.at(-1), false, 'cancelled: booking waits again');
  assert.ok(input(tree, 'monthlyRent'), 'a new offer starts');
});

test('a refused step shows why and reads the offer again (e.g. the landlord confirmed meanwhile)', async () => {
  let list = [offer()];
  const h = agent(() => list, { send: () => { throw Object.assign(new Error('ข้อเสนอถูกแก้ไขแล้ว กรุณาเปิดใหม่ก่อนดำเนินการ'), { status: 409 }); } });
  let tree = await h.settle();
  list = [offer({ status: 'confirmed', confirmationChannel: 'app' })];
  button(tree, oc.send).props.onPress();
  for (let i = 0; i < 4; i++) await h.tick();
  tree = h.expand(h.render());
  assert.deepEqual(h.calls.map((c) => c[0]), ['list', 'send', 'list']);
  assert.ok(tree.some((n) => n.type === 'span' && n.props.accessibilityRole === 'alert' && label(n) === 'ข้อเสนอถูกแก้ไขแล้ว กรุณาเปิดใหม่ก่อนดำเนินการ'));
  assert.ok(texts(tree).includes(oc.confirmedInApp), 'the offer read again is shown');
  assert.equal(h.confirmed.at(-1), true);
});

function landlord(list, failConfirm = false) {
  const calls = [];
  const api = {
    listLandlordDealOffers: async () => { calls.push(['list']); return typeof list === 'function' ? list() : list; },
    confirmLandlordDealOffer: async (id, revision) => {
      calls.push(['confirm', id, revision]);
      if (failConfirm) throw Object.assign(new Error('ข้อเสนอถูกแก้ไขแล้ว กรุณาเปิดใหม่ก่อนดำเนินการ'), { status: 409 });
      return offer({ id, status: 'confirmed', confirmationChannel: 'app' });
    },
  };
  const h = harness('LandlordDealOffers.tsx', 'LandlordDealOffers', { reloadToken: 1 }, api);
  return { ...h, calls };
}

test('the landlord sees offers waiting for them on their rooms and confirms the revision they read', async () => {
  const h = landlord([offer({ status: 'awaiting_landlord', revision: 3 }), offer({ id: 6, status: 'confirmed', leadName: 'Lead B' })]);
  let tree = await h.settle();
  const lines = texts(tree);
  for (const line of [oc.landlordTitle, oc.landlordConfirmedTitle, 'Aria · ห้อง 1201', fillTemplate(oc.landlordTenant, { name: 'Lead A' }),
    fillTemplate(oc.landlordTenant, { name: 'Lead B' }), oc.landlordConfirmHint, `${oc.summary.rent}: 15000`]) assert.ok(lines.includes(line), line);
  assert.deepEqual(buttons(tree).map(label), [oc.landlordConfirm], 'only the waiting offer can be confirmed');
  button(tree, oc.landlordConfirm).props.onPress();
  for (let i = 0; i < 3; i++) await h.tick();
  assert.deepEqual(h.calls, [['list'], ['confirm', 5, 3]]);
  tree = h.expand(h.render());
  assert.deepEqual(buttons(tree).map(label), [], 'confirmed now');
  assert.equal(texts(tree).includes(oc.landlordTitle), false);
});

test('the landlord\'s confirmation refused (the agent changed the terms): the reason shows and the list is read again', async () => {
  let list = [offer({ status: 'awaiting_landlord', revision: 3 })];
  const h = landlord(() => list, true);
  let tree = await h.settle();
  list = [offer({ status: 'awaiting_landlord', revision: 4, monthlyRent: '15500' })];
  button(tree, oc.landlordConfirm).props.onPress();
  for (let i = 0; i < 4; i++) await h.tick();
  tree = h.expand(h.render());
  assert.deepEqual(h.calls.map((c) => c[0]), ['list', 'confirm', 'list']);
  assert.ok(texts(tree).includes('ข้อเสนอถูกแก้ไขแล้ว กรุณาเปิดใหม่ก่อนดำเนินการ'));
  assert.ok(texts(tree).includes(`${oc.summary.rent}: 15500`), 'the latest terms are shown');
});

test('a landlord with no offer sees nothing', async () => {
  const h = landlord([offer({ status: 'draft' }), offer({ status: 'cancelled' })]);
  await h.settle();
  assert.equal(h.render(), null);
});

test('the landlord\'s view has no other agent\'s name: the summary says there is one', async () => {
  const h = landlord([offer({ status: 'awaiting_landlord', coBroke: true, coBrokeAgentName: null })]);
  const tree = await h.settle();
  assert.ok(texts(tree).includes(`${oc.summary.coBroke}: ${oc.yes}`));
});
