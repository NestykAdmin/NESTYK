// D6 (AC-6.1 to 6.4): the handover card. Decisions Aof made on 22 Oct 2026: annex 1 = items in the room, annex 2 =
// photos; the landlord and the tenant sign in their app or on the agent's device; no PDF in this step.
// The form rules mirror validateHandover in apps/api/src/agent/contracts/handover.service.ts.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { i18nMock, leadFormat, contractsTh, fillTemplate } = require('./test-i18n.cjs');
// The real localizedError: an error already in Thai is shown as it is, anything else gets the fallback.
const { localizedError } = (() => { const m = { exports: {} }; new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../../packages/i18n/src/error-message.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(require, m, m.exports); return m.exports; })();

function load(file, requireFn = require) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText)(requireFn, module, module.exports);
  return module.exports;
}
const term = load('../lib/lease-term.ts');
const rules = load('../lib/handover.ts', (id) => (id === './lease-term' ? term : require(id)));
const hc = contractsTh.handover;
const nodes = (node) => (!node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]);
const texts = (tree) => nodes(tree).filter((n) => n.type === 'span').map((n) => [].concat(n.props.children).join(''));
const buttons = (tree) => nodes(tree).filter((n) => n.type === 'button').map((n) => [].concat(n.props.children).join(''));

const record = (patch = {}) => ({
  contractId: 12, id: 5, status: 'in_progress', blockedReason: null, handoverDate: '2026-11-01', note: null, revision: 2,
  items: [{ id: 1, name: 'แอร์', quantity: 2, condition: 'good', note: null }, { id: 2, name: 'ตู้เย็น', quantity: 1, condition: 'damaged', note: 'ประตูบุบ' }],
  photos: [{ id: 9, url: 'https://signed.example/p.jpg', caption: null, createdAt: '2026-10-22T03:00:00Z' }],
  signatures: [], completedAt: null, ...patch,
});

/** Renders HandoverCard with stand-in hooks, so effects and the api calls can be driven step by step. */
function harness(mode, api = {}) {
  const states = [], refs = [], effectDeps = [], effects = [], callbacks = [];
  let stateIndex = 0, refIndex = 0, effectIndex = 0, callbackIndex = 0;
  const calls = [];
  const hooked = { ...React,
    useState: (initial) => { const i = stateIndex++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], (next) => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; },
    useRef: (initial) => (refs[refIndex++] ??= { current: initial }),
    // Kept between renders while the deps are the same, like React (the load effect depends on it).
    useCallback: (fn, deps) => { const i = callbackIndex++, old = callbacks[i]; if (!old || deps.some((v, j) => v !== old.deps[j])) callbacks[i] = { fn, deps }; return callbacks[i].fn; },
    useEffect: (fn, deps) => { const i = effectIndex++, old = effectDeps[i]; if (!old || deps.some((v, j) => v !== old[j])) { effectDeps[i] = deps; effects.push(fn); } },
  };
  const saved = { current: record() };
  const agentApi = {
    getHandover: async (id) => { calls.push(['get', id]); return api.get?.() ?? saved.current; },
    saveHandover: async (id, body) => { calls.push(['save', id, body]); if (api.save) return api.save(body); return saved.current; },
    uploadHandoverPhoto: async (id, file) => { calls.push(['photo', id, file.name, file.mimeType]); return saved.current; },
    removeHandoverPhoto: async (id, photoId) => { calls.push(['remove', id, photoId]); return saved.current; },
    signHandoverOnSite: async (id, body) => { calls.push(['sign on site', id, body]); if (api.sign) return api.sign(body); return saved.current; },
  };
  const partyApi = {
    getMyHandover: async (id) => { calls.push(['get mine', id]); return api.get?.() ?? saved.current; },
    signMyHandover: async (id, body) => { calls.push(['sign mine', id, body]); return saved.current; },
  };
  const deps = {
    react: hooked,
    'react-native': { View: 'section', Text: 'span', Pressable: 'button', ScrollView: 'div', Image: 'img', ActivityIndicator: 'progress' },
    'expo-image-picker': {
      requestMediaLibraryPermissionsAsync: async () => ({ granted: api.permission !== false }),
      launchImageLibraryAsync: async () => ({ canceled: false, assets: [{ uri: 'file://room.jpg', fileName: 'room.jpg', mimeType: 'image/jpeg', fileSize: api.fileSize ?? 1000 }] }),
      UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
    },
    '@nestyk/ui/native': { tokens: { colors: { brand: { 500: '#ff0' }, danger: '#c00' }, typography: { native: {} } }, useMobileTheme: () => ({ theme: {} }),
      MobileButton: 'button', MobileInput: 'input', MobileBottomSheet: 'aside' },
    '@nestyk/i18n': { ...i18nMock(), localizedError },
    '../lib/lead-format': leadFormat,
    '../lib/handover': rules,
    '../lib/agent-contracts-api': agentApi,
    '../lib/party-contracts-api': partyApi,
    './ContractSignaturePad': { ContractSignaturePad: 'signature-pad' },
  };
  const card = load('HandoverCard.tsx', (id) => { if (!(id in deps)) throw new Error(`Unexpected dependency: ${id}`); return deps[id]; });
  const props = { contractId: 12, mode, defaultDate: '2026-11-01', refreshKey: 'a' };
  const render = () => {
    stateIndex = refIndex = effectIndex = callbackIndex = 0;
    const tree = card.HandoverCard(props);
    effects.splice(0).forEach((fn) => fn());
    return tree;
  };
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  // The summary is a component inside the card: render it too, so its buttons can be found.
  const expand = (tree) => nodes(tree).map((n) => (n.type === card.HandoverSummary ? card.HandoverSummary(n.props) : null)).filter(Boolean);
  const view = async () => { render(); await tick(); const tree = render(); return { tree, summary: expand(tree)[0], props: nodes(tree).find((n) => n.type === card.HandoverSummary)?.props }; };
  return { render, tick, view, calls, saved, card, props };
}

test('the form rules: a date, items with a name, quantity 1–999, and a note when damaged or missing', () => {
  const draft = { handoverDate: '2026-11-01', note: '', items: [{ name: 'แอร์', quantity: '2', condition: 'good', note: '' }] };
  assert.deepEqual(rules.handoverFormIssues(draft), { items: {} });
  assert.ok(rules.handoverFormValid(rules.handoverFormIssues({ ...draft, items: [] })), 'an empty room is fine');
  for (const handoverDate of ['', '2026-02-30', '01/11/2026', '1899-12-31'])
    assert.equal(rules.handoverFormIssues({ ...draft, handoverDate }).handoverDate, true, handoverDate);
  assert.equal(rules.handoverFormIssues({ ...draft, note: 'x'.repeat(1001) }).note, true);
  const item = (patch) => rules.handoverFormIssues({ ...draft, items: [{ ...draft.items[0], ...patch }] }).items[0];
  for (const quantity of ['0', '1000', '1.5', '', 'a', '-1']) assert.deepEqual(item({ quantity }), { quantity: true }, quantity);
  for (const quantity of ['1', '999', ' 5 ']) assert.equal(item({ quantity }), undefined, quantity);
  assert.deepEqual(item({ name: '  ' }), { name: true });
  assert.deepEqual(item({ name: 'a'.repeat(121) }), { name: true });
  for (const condition of ['damaged', 'missing']) assert.deepEqual(item({ condition, note: ' ' }), { note: true }, condition);
  assert.equal(item({ condition: 'missing', note: 'หาย' }), undefined);
  assert.deepEqual(item({ note: 'x'.repeat(501) }), { note: true });
  // Exactly at the limits is still fine (the same limits as the API).
  assert.equal(item({ name: 'ก'.repeat(120), condition: 'damaged', note: 'ข'.repeat(500) }), undefined);
  assert.equal(rules.handoverFormIssues({ ...draft, note: 'ก'.repeat(1000) }).note, undefined);
  assert.ok(rules.handoverFormValid(rules.handoverFormIssues({ ...draft, items: Array.from({ length: 100 }, () => draft.items[0]) })));
  assert.equal(rules.handoverFormIssues({ ...draft, items: Array.from({ length: 101 }, () => draft.items[0]) }).tooManyItems, true);
  assert.deepEqual(rules.handoverBody({ handoverDate: ' 2026-11-01 ', note: ' ', items: [{ name: ' แอร์ ', quantity: ' 2 ', condition: 'damaged', note: ' บุบ ' }] }, 3),
    { handoverDate: '2026-11-01', note: null, items: [{ name: 'แอร์', quantity: 2, condition: 'damaged', note: 'บุบ' }], revision: 3 });
  // The form starts from the saved record, or from the lease start date.
  assert.deepEqual(rules.handoverDraft(null, '2026-11-01'), { handoverDate: '2026-11-01', note: '', items: [] });
  assert.deepEqual(rules.handoverDraft(record({ note: 'กุญแจ' })).items[1], { name: 'ตู้เย็น', quantity: '1', condition: 'damaged', note: 'ประตูบุบ' });
});

test('who can sign: an open record with a date and a photo, once per side', () => {
  assert.equal(rules.handoverSignBlocker(record(), 'owner'), null);
  assert.equal(rules.handoverSignBlocker(record({ photos: [] }), 'owner'), 'needs_photo');
  assert.equal(rules.handoverSignBlocker(record({ handoverDate: null }), 'tenant'), 'needs_date');
  assert.equal(rules.handoverSignBlocker(record({ signatures: [{ party: 'owner', channel: 'app', signedAt: '2026-10-22T03:00:00Z', signedBy: 'A' }] }), 'owner'), 'signed');
  for (const status of ['blocked', 'not_started', 'completed']) assert.equal(rules.handoverSignBlocker(record({ status }), 'owner'), 'not_open', status);
  assert.equal(rules.handoverEditable(record({ status: 'completed' })), false);
  assert.equal(rules.handoverEditable(record({ status: 'blocked' })), false);
  assert.equal(rules.handoverEditable(record({ status: 'not_started', id: null })), true);
});

test('blocked: the card says why, with no buttons', async () => {
  for (const reason of ['deposit_unpaid', 'lease_not_issued', 'contract_ended']) {
    const h = harness('agent', { get: () => record({ id: null, status: 'blocked', blockedReason: reason, items: [], photos: [], handoverDate: null }) });
    const { summary } = await h.view();
    assert.ok(texts(summary).includes(hc.blocked[reason]), reason);
    assert.ok(texts(summary).includes(hc.status.blocked));
    assert.deepEqual(buttons(summary), [], `${reason}: nothing to press`);
  }
});

test('the agent fills in the form; a wrong form is not sent, a good one is sent with the revision the agent saw', async () => {
  const h = harness('agent', { get: () => record({ id: null, status: 'not_started', revision: 0, items: [], photos: [], handoverDate: null }) });
  const { summary, props } = await h.view();
  assert.ok(texts(summary).includes(hc.notStarted));
  assert.deepEqual(buttons(summary), [hc.fill, hc.addPhoto]);
  props.onEdit();
  let tree = h.render();
  const sheet = () => nodes(tree).find((n) => n.type === 'aside' && n.props.visible);
  assert.ok(sheet(), 'the form opens');
  const date = () => nodes(sheet()).find((n) => n.type === 'input' && n.props.label === hc.form.date);
  assert.equal(date().props.value, '2026-11-01', 'starts on the lease start date');
  // Add an item, mark it damaged with no note, and try to save.
  nodes(sheet()).find((n) => n.type === 'button' && n.props.children === hc.form.addItem).props.onPress();
  tree = h.render();
  nodes(sheet()).find((n) => n.type === 'input' && n.props.label === hc.form.itemName).props.onChangeText('ตู้เย็น');
  tree = h.render();
  nodes(sheet()).find((n) => n.type === 'button' && n.props.children === hc.condition.damaged).props.onPress();
  tree = h.render();
  nodes(sheet()).find((n) => n.type === 'button' && n.props.children === hc.form.save).props.onPress();
  await h.tick(); tree = h.render();
  assert.equal(h.calls.filter((c) => c[0] === 'save').length, 0, 'not sent');
  assert.equal(nodes(sheet()).find((n) => n.type === 'input' && n.props.label === hc.form.itemNote).props.error, contractsTh.handover.form.errors.itemNote);
  nodes(sheet()).find((n) => n.type === 'input' && n.props.label === hc.form.itemNote).props.onChangeText('ประตูบุบ');
  tree = h.render();
  nodes(sheet()).find((n) => n.type === 'button' && n.props.children === hc.form.save).props.onPress();
  await h.tick(); await h.tick(); tree = h.render();
  assert.deepEqual(h.calls.find((c) => c[0] === 'save'), ['save', 12, {
    handoverDate: '2026-11-01', note: null, revision: 0, items: [{ name: 'ตู้เย็น', quantity: 1, condition: 'damaged', note: 'ประตูบุบ' }],
  }]);
  assert.equal(sheet(), undefined, 'the form closes after saving');
  assert.ok(texts(tree).includes(hc.saved));
});

test('the agent adds and removes photos, and the landlord or tenant signs on the agent\'s device', async () => {
  const h = harness('agent');
  const { summary, props } = await h.view();
  assert.ok(texts(summary).includes(fillTemplate(hc.item, { name: 'ตู้เย็น', quantity: '1', condition: hc.condition.damaged })));
  assert.ok(texts(summary).includes(fillTemplate(hc.annex2, { count: '1', max: '30' })));
  assert.deepEqual(buttons(summary).filter((b) => b.startsWith('ให้')), [
    fillTemplate(hc.signOnSite, { party: contractsTh.common.parties.owner }), fillTemplate(hc.signOnSite, { party: contractsTh.common.parties.tenant })]);
  props.onAddPhoto();
  await h.tick(); await h.tick();
  assert.deepEqual(h.calls.find((c) => c[0] === 'photo'), ['photo', 12, 'room.jpg', 'image/jpeg']);
  props.onRemovePhoto(9);
  await h.tick();
  assert.deepEqual(h.calls.find((c) => c[0] === 'remove'), ['remove', 12, 9]);
  props.onSign('owner');
  let tree = h.render();
  const pad = nodes(tree).find((n) => n.type === 'signature-pad');
  assert.ok(pad, 'the signature sheet opens');
  assert.ok(texts(tree).includes(fillTemplate(hc.signTitle, { party: contractsTh.common.parties.owner })));
  pad.props.onOK('data:image/png;base64,AAAA');
  await h.tick(); await h.tick(); tree = h.render();
  assert.deepEqual(h.calls.find((c) => c[0] === 'sign on site'), ['sign on site', 12, { party: 'owner', signaturePng: 'data:image/png;base64,AAAA', revision: 2 }]);
  assert.equal(nodes(tree).find((n) => n.type === 'signature-pad'), undefined, 'the sheet closes after signing');
});

test('a photo over 10 MB or without permission is not uploaded', async () => {
  for (const [options, message] of [[{ fileSize: 11 * 1024 * 1024 }, hc.photoTooLarge], [{ permission: false }, hc.photoPermission]]) {
    const h = harness('agent', options);
    const { props } = await h.view();
    props.onAddPhoto();
    await h.tick(); await h.tick();
    assert.equal(h.calls.some((c) => c[0] === 'photo'), false);
    assert.ok(texts(h.render()).includes(message));
  }
});

test('a refused signature reloads the record and closes the sheet; the next signature carries the new revision', async () => {
  let reads = 0, refuse = true;
  const h = harness('agent', { get: () => record({ revision: ++reads + 1 }), sign: async (body) => { if (refuse) throw new Error('409'); return record({ revision: body.revision }); } });
  let { props } = await h.view();
  props.onSign('tenant');
  let tree = h.render();
  nodes(tree).find((n) => n.type === 'signature-pad').props.onOK('data:image/png;base64,AAAA');
  await h.tick(); await h.tick(); tree = h.render();
  assert.ok(texts(tree).includes(hc.signFailed), 'an English API message falls back to the Thai one');
  assert.equal(h.calls.filter((c) => c[0] === 'get').length, 2, 'read again after the refusal');
  assert.equal(nodes(tree).find((n) => n.type === 'signature-pad'), undefined, 'closed: the signer looks at the new content first');
  refuse = false;
  props = nodes(tree).find((n) => n.type === h.card.HandoverSummary).props;
  props.onSign('tenant');
  tree = h.render();
  nodes(tree).find((n) => n.type === 'signature-pad').props.onOK('data:image/png;base64,BBBB');
  await h.tick(); await h.tick();
  assert.deepEqual(h.calls.filter((c) => c[0] === 'sign on site').map((c) => c[2].revision), [2, 3], 'the second try signs revision 3');
});

test('a party sees the record and signs only their own side; signed and locked records show no buttons', async () => {
  const tenant = harness('party', { get: () => record({ myParties: ['tenant'] }) });
  const { summary, props } = await tenant.view();
  assert.equal(tenant.calls[0][0], 'get mine');
  assert.deepEqual(buttons(summary), [fillTemplate(hc.signMine, { party: contractsTh.common.parties.tenant })], 'no edit, photo or other side');
  props.onSign('tenant');
  const tree = tenant.render();
  nodes(tree).find((n) => n.type === 'signature-pad').props.onOK('data:image/png;base64,AAAA');
  await tenant.tick(); await tenant.tick();
  assert.deepEqual(tenant.calls.find((c) => c[0] === 'sign mine'), ['sign mine', 12, { party: 'tenant', signaturePng: 'data:image/png;base64,AAAA', revision: 2 }]);
  // After the landlord signed, the tenant still sees only their own sign button, and no note about editing.
  const half = harness('party', { get: () => record({ myParties: ['tenant'], signatures: [{ party: 'owner', channel: 'app', signedAt: '2026-10-22T03:00:00Z', signedBy: 'Landlord A' }] }) });
  const halfView = (await half.view()).summary;
  assert.deepEqual(buttons(halfView), [fillTemplate(hc.signMine, { party: contractsTh.common.parties.tenant })]);
  assert.equal(texts(halfView).includes(hc.editVoidsSignatures), false, 'a party cannot edit, so no edit note');
  // Not started yet, from the party's side.
  const early = harness('party', { get: () => record({ id: null, status: 'not_started', items: [], photos: [], handoverDate: null, myParties: ['owner'] }) });
  assert.ok(texts((await early.view()).summary).includes(hc.partyNotStarted));
  // No photo yet: the party is told why they cannot sign.
  const noPhoto = harness('party', { get: () => record({ photos: [], myParties: ['owner'] }) });
  const np = (await noPhoto.view()).summary;
  assert.ok(texts(np).includes(hc.needsPhoto));
  assert.deepEqual(buttons(np), []);
  // Completed: who signed and how, and no button anywhere.
  const signatures = [{ party: 'owner', channel: 'on_site', signedAt: '2026-10-22T03:00:00Z', signedBy: null }, { party: 'tenant', channel: 'app', signedAt: '2026-10-22T04:00:00Z', signedBy: 'Tenant B' }];
  for (const mode of ['agent', 'party']) {
    const done = harness(mode, { get: () => record({ status: 'completed', completedAt: '2026-10-22T04:00:00Z', signatures, myParties: ['tenant'] }) });
    const s = (await done.view()).summary;
    assert.deepEqual(buttons(s), [], mode);
    assert.ok(texts(s).includes(hc.completed));
    assert.ok(texts(s).some((line) => line.includes(hc.signedOnSite.split(' {')[0])) && texts(s).some((line) => line.includes(hc.signed.split(' {')[0])), mode);
  }
});

test('a failed first load shows its error until the screen reloads the card successfully', async () => {
  let fail = true;
  const h = harness('agent', { get: () => { if (fail) throw new Error('offline'); return record(); } });
  h.render(); await h.tick();
  assert.ok(texts(h.render()).includes(hc.loadFailed));
  fail = false;
  h.props.refreshKey = 'b'; // e.g. the deposit receipt was issued
  h.render(); await h.tick();
  const tree = h.render();
  assert.equal(texts(tree).includes(hc.loadFailed), false, 'the old error is gone');
  assert.ok(nodes(tree).some((n) => n.type === h.card.HandoverSummary));
});

test('the copy exists in every language with the same keys', () => {
  const keys = (value, prefix = '') => Object.entries(value).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`])).sort();
  const th = keys(contractsTh.handover);
  for (const locale of ['en', 'ja', 'zh']) {
    const file = path.join(__dirname, `../../../packages/i18n/src/locales/contracts/${locale}.ts`);
    const loaded = load(path.relative(__dirname, file), () => ({}));
    const copy = Object.values(loaded)[0];
    assert.deepEqual(keys(copy.handover), th, locale);
  }
});
