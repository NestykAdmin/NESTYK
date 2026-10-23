const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

const copy = {
  count: '{count} leads', details: 'Details', statuses: { new: 'New', inprogress: 'In progress', viewing: 'Viewing', booked: 'Booked', lost: 'Lost' },
  loadError: 'Unable to load leads', retry: 'Retry', next: 'Next', previous: 'Previous',
};
const flush = () => new Promise(resolve => setImmediate(resolve));
function compile(filename, localRequire) {
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', output)(localRequire, module, module.exports, schedule, cancel);
  return module.exports;
}
let timers;
function schedule(fn) { const id = {}; timers.set(id, fn); return id; }
function cancel(id) { timers.delete(id); }
function runTimers() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); }
function nodes(element) {
  if (!React.isValidElement(element)) return Array.isArray(element) ? element.flatMap(nodes) : [];
  return [element, ...nodes(element.props.children)];
}
function find(tree, type) { return nodes(tree).find(node => node.type === type); }
function environment(platform = 'ios') {
  timers = new Map();
  let current;
  const requests = [];
  const hooks = {
    ...React,
    useState(initial) {
      const h = current, index = h.cursor++;
      if (!(index in h.slots)) h.slots[index] = typeof initial === 'function' ? initial() : initial;
      return [h.slots[index], value => {
        const next = typeof value === 'function' ? value(h.slots[index]) : value;
        if (!Object.is(next, h.slots[index])) { h.slots[index] = next; h.dirty = true; }
      }];
    },
    useRef(initial) {
      const h = current, index = h.cursor++;
      return h.slots[index] ??= { current: initial };
    },
    useMemo: fn => fn(),
    useEffect(effect, deps) {
      const h = current, index = h.cursor++, previous = h.effects[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        previous?.cleanup?.();
        h.pending.push(() => { h.effects[index] = { deps, cleanup: effect() }; });
      }
    },
  };
  const { tokens } = compile(path.resolve(__dirname, '../../../packages/ui/src/theme/tokens.ts'), name => { throw new Error(name); });
  const ui = new Proxy({ tokens, STATUS_PILL_TONES: { slate: {}, yellow: {}, red: {} }, useMobileTheme: () => ({ theme: {} }) }, { get: (target, name) => target[name] ?? name });
  const { AgentLeadsScreen } = compile(path.join(__dirname, 'AgentLeadsScreen.tsx'), name => {
    if (name === 'react') return hooks;
    if (name === 'react-native') return { View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', Platform: { OS: platform }, StyleSheet: { create: value => value } };
    if (name === '@nestyk/ui/native') return ui;
    if (name === '@nestyk/i18n') return { useLocale: () => ({ locale: 'en', t: { agent: { leads: copy, dashboard: {} }, common: { noData: 'No data', cancel: 'Cancel' } } }), localizedError: err => err.message };
    if (name === '../lib/agent-leads-api') return { listAgentLeads: (...args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject })) };
    if (name === '../lib/lead-match-preview') return { leadMatchReady: () => false };
    if (name === './AgentLeadDetailBody') return { LeadStatusBadge: 'LeadStatusBadge', leadAvatarInitials: () => 'L', leadDisplayStatus: lead => lead.status, leadStatusTone: () => 'slate' };
    if (name === './LeadLocationPicker') return { LeadLocationPicker: 'LeadLocationPicker' };
    if (name === './ViewingDateTile') return { ViewingDateTile: 'ViewingDateTile' };
    throw new Error(`Unexpected dependency: ${name}`);
  });
  function mount(props = {}) {
    const h = { cursor: 0, slots: [], effects: [], pending: [], props: { onOpenLead() {}, ...props } };
    h.render = () => {
      let tree;
      do {
        current = h; h.cursor = 0; h.dirty = false;
        tree = AgentLeadsScreen(h.props);
        h.pending.splice(0).forEach(effect => effect());
      } while (h.dirty);
      return tree;
    };
    h.unmount = () => h.effects.forEach(effect => effect?.cleanup?.());
    return h;
  }
  return { mount, requests };
}
const lead = { id: 41, name: 'Lead', status: 'new', pins: [], locations: [], province: null, lastMatch: null };
const page = { items: [lead], total: 45, statusCounts: { new: 45, inprogress: 0, viewing: 0, booked: 0, lost: 0 } };
async function finishLoading(h, request, response = page) {
  request.resolve(response);
  await flush();
  const loader = find(h.render(), 'MobileBrandLoader');
  assert.equal(loader.props.done, true);
  loader.props.onComplete();
  return h.render();
}

test('leads keep the brand loader until the request settles, then reveal the result', async () => {
  const { mount, requests } = environment();
  const h = mount();
  const tree = h.render();
  assert.equal(find(tree, 'MobileBrandLoader').props.done, false);
  assert.equal(find(tree, 'MobileCompactListRow'), undefined);
  runTimers();
  const loaded = await finishLoading(h, requests[0]);
  assert.equal(find(loaded, 'MobileBrandLoader'), undefined);
  assert.equal(find(loaded, 'MobileCompactListRow').props.title, 'Lead');
  h.unmount();
});

test('reopening cached leads loads again while preserving search, filter and pagination', async () => {
  const { mount, requests } = environment();
  const first = mount();
  first.render(); runTimers();
  let tree = await finishLoading(first, requests[0]);
  find(tree, 'MobileListSearchRow').props.onChangeText('Lead');
  tree = first.render(); runTimers(); requests[1].resolve(page); await flush();
  tree = first.render();
  nodes(tree).find(node => node.type === 'MobileFilterChip' && node.props.label === 'New').props.onPress();
  tree = first.render(); runTimers(); requests[2].resolve(page); await flush();
  tree = first.render();
  nodes(tree).find(node => node.type === 'MobileButton' && node.props.children === 'Next').props.onPress();
  first.render(); runTimers(); requests[3].resolve(page); await flush(); first.render();
  first.unmount();

  const second = mount();
  tree = second.render();
  const loader = find(tree, 'MobileBrandLoader');
  assert.ok(loader, 'cached data must not bypass the loader on reentry');
  assert.equal(loader.props.done, false);
  assert.equal(find(tree, 'MobileCompactListRow'), undefined);
  runTimers();
  assert.equal(requests[4].args[0], 'Lead');
  assert.equal(requests[4].args[1], 2);
  assert.equal(requests[4].args[2].status, 'new');
  tree = await finishLoading(second, requests[4], { ...page, items: [{ ...lead, name: 'Updated lead' }] });
  assert.equal(find(tree, 'MobileListSearchRow').props.value, 'Lead');
  assert.equal(find(tree, 'MobileCompactListRow').props.title, 'Updated lead');
  second.unmount();
});

test('failed lead requests complete the loader and expose retry, which can recover', async () => {
  const { mount, requests } = environment();
  const h = mount();
  h.render(); runTimers();
  requests[0].reject(new Error('Offline'));
  await flush();
  const loader = find(h.render(), 'MobileBrandLoader');
  assert.equal(loader.props.done, true);
  loader.props.onComplete();
  let tree = h.render();
  assert.equal(find(tree, 'MobileBrandLoader'), undefined);
  const retry = nodes(tree).find(node => node.type === 'MobileButton' && node.props.children === 'Retry');
  assert.ok(retry);
  retry.props.onPress();
  h.render(); runTimers(); requests[1].resolve(page); await flush();
  tree = h.render();
  assert.equal(find(tree, 'MobileCompactListRow').props.title, 'Lead');
  assert.equal(nodes(tree).some(node => node.type === 'MobileButton' && node.props.children === 'Retry'), false);
  h.unmount();
});

function selectStatus(h, label) {
  const chip = nodes(h.render()).find(node => node.type === 'MobileFilterChip' && node.props.label === label);
  assert.ok(chip, 'status filters stay available during loading');
  chip.props.onPress();
  return h.render();
}

for (const platform of ['ios', 'android', 'web']) {
  test(`${platform}: status filtering shows a list loader, keeps controls and hides old results until success`, async () => {
    const { mount, requests } = environment(platform);
    const h = mount();
    h.render(); runTimers(); await finishLoading(h, requests[0]);
    let tree = selectStatus(h, 'New');
    assert.ok(find(tree, 'MobileBrandLoader'));
    assert.ok(find(tree, 'MobileListSearchRow'));
    assert.equal(find(tree, 'MobileCompactListRow'), undefined);
    assert.equal(nodes(tree).some(node => node.props.children === 'No data'), false);
    assert.equal(nodes(tree).some(node => node.type === 'MobileButton' && node.props.children === 'Next'), false);
    runTimers();
    assert.equal(requests[1].args[2].status, 'new');
    requests[1].resolve({ ...page, items: [{ ...lead, name: 'Filtered lead' }] });
    await flush(); tree = h.render();
    assert.equal(find(tree, 'MobileBrandLoader'), undefined);
    assert.equal(find(tree, 'MobileCompactListRow').props.title, 'Filtered lead');
    h.unmount();
  });

  test(`${platform}: filter failure removes the list loader and retry recovers`, async () => {
    const { mount, requests } = environment(platform);
    const h = mount();
    h.render(); runTimers(); await finishLoading(h, requests[0]);
    let tree = selectStatus(h, 'Lost');
    assert.ok(find(tree, 'MobileBrandLoader'));
    runTimers(); requests[1].reject(new Error('Offline')); await flush();
    tree = h.render();
    assert.equal(find(tree, 'MobileBrandLoader'), undefined);
    assert.ok(nodes(tree).some(node => node.props.children === 'Unable to load leads'));
    nodes(tree).find(node => node.type === 'MobileButton' && node.props.children === 'Retry').props.onPress();
    tree = h.render();
    assert.ok(find(tree, 'MobileBrandLoader'));
    runTimers(); requests[2].resolve({ ...page, items: [], total: 0 }); await flush();
    tree = h.render();
    assert.equal(find(tree, 'MobileBrandLoader'), undefined);
    assert.ok(nodes(tree).some(node => node.props.children === 'No data'));
    h.unmount();
  });

  for (const order of ['old-first', 'old-last']) {
    test(`${platform}: rapid filter switching ignores stale responses (${order})`, async () => {
      const { mount, requests } = environment(platform);
      const h = mount();
      h.render(); runTimers(); await finishLoading(h, requests[0]);
      selectStatus(h, 'New'); runTimers();
      let tree = selectStatus(h, 'Lost'); runTimers();
      assert.ok(find(tree, 'MobileBrandLoader'));
      assert.equal(requests[2].args[2].status, 'lost');
      const stale = async () => { requests[1].resolve({ ...page, items: [{ ...lead, name: 'Stale lead' }] }); await flush(); };
      if (order === 'old-first') {
        await stale(); tree = h.render();
        assert.ok(find(tree, 'MobileBrandLoader'), 'stale completion cannot stop the active loader');
        assert.equal(find(tree, 'MobileCompactListRow'), undefined);
      }
      requests[2].resolve({ ...page, items: [{ ...lead, name: 'Latest lead', status: 'lost' }] });
      await flush();
      if (order === 'old-last') await stale();
      tree = h.render();
      assert.equal(find(tree, 'MobileBrandLoader'), undefined);
      assert.equal(find(tree, 'MobileCompactListRow').props.title, 'Latest lead');
      h.unmount();
    });
  }
}
