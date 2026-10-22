const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

const root = path.resolve(__dirname, '../../..');
const theme = { mode: 'light', background: '#F8FAFC', surface: '#fff', screenTitle: '#1A2B48', textSecondary: '#64748B', border: '#E5E7EB' };
let locale = 'en';
let sequence = 0;
const cache = new Map();
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const localRequire = (name) => {
    if (name.endsWith('.css')) return {};
    if (name === 'react') return { ...React, useMemo: fn => fn(), useEffect() {}, useId: () => `test-${sequence++}`, useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}] };
    if (name === 'react-native') return { View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: value => value, hairlineWidth: 1 } };
    if (name === '@nestyk/i18n') return { useLocale: () => ({ locale, t: load(`${root}/packages/i18n/src/locales/${locale}.ts`)[locale] }) };
    if (name === '@nestyk/ui/native') return { useMobileTheme: () => ({ theme }), MobileIcon: () => null, MobileButton: 'MobileButton', MobileProfileAvatar: 'Avatar', tokens: load(`${root}/packages/ui/src/theme/tokens.ts`).tokens, getCardElevation: () => ({}) };
    if (name === '@nestyk/ui/web-content') return load(`${root}/packages/ui/src/shells/WebContentContainer.tsx`);
    if (name === '@nestyk/feature-listing') return load(`${root}/packages/feature-listing/src/dashboard/types.ts`);
    if (!name.startsWith('.')) return require(name);
    const base = path.resolve(path.dirname(filename), name);
    return load([base, `${base}.ts`, `${base}.tsx`].find(file => fs.existsSync(file) && fs.statSync(file).isFile()));
  };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText)(localRequire, module, module.exports);
  return module.exports;
}
const { createAgentDashboardDemoFixture } = load(`${root}/packages/feature-listing/src/dashboard/demo-fixture.ts`);
function fixture() { return createAgentDashboardDemoFixture({ greetingName: 'Agent', localDateLabel: 'Today' }); }
function nodes(element) {
  if (element == null || typeof element === 'boolean') return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!React.isValidElement(element)) return [element];
  if (typeof element.type === 'function') return nodes(element.type(element.props));
  return [element, ...nodes(element.props.children)];
}
function render(snapshot = fixture(), onRefresh) {
  const calls = [];
  const { AgentOverview } = load(path.join(__dirname, 'agent-web/AgentOverview.web.tsx'));
  return { calls, tree: nodes(AgentOverview({ snapshot, onNavigate: link => calls.push(link), onRefresh })) };
}
function byClass(tree, name) { return tree.filter(node => node?.props?.className?.split(' ').includes(name)); }

test('desktop quick actions, work filters, room rows and calendar keep existing destinations', () => {
  const snapshot = fixture();
  snapshot.schedule.items[0].startsAt = new Date().toISOString();
  snapshot.actionRequired.items.reverse();
  const { tree, calls } = render(snapshot);
  const actions = byClass(tree, 'aw-button');
  actions[0].props.onClick();
  actions[1].props.onClick();
  const work = byClass(tree, 'aov-work-row');
  work.forEach(button => button.props.onClick());
  byClass(tree, 'aov-property')[0].props.onClick();
  byClass(tree, 'aov-appointment')[0].props.onClick();
  assert.deepEqual(calls.slice(0, 2), [{ type: 'action', id: 'addListing' }, { type: 'action', id: 'newLead' }]);
  assert.deepEqual(calls.slice(2, 6).map(link => link.filter.work), ['overdue_payment', 'lead_follow_up', 'awaiting_signature', 'renewal']);
  assert.deepEqual(calls[6], { type: 'tab', tab: 'listingRoom' });
  assert.deepEqual(calls[7], { type: 'action', id: 'viewAppointment', appointmentId: 'apt-1' });
  const calendarLabel = load(`${root}/packages/i18n/src/locales/en.ts`).en.agent.dashboard.viewCalendar;
  tree.find(node => node?.type === 'button' && nodes(node.props.children).includes(calendarLabel)).props.onClick();
  assert.deepEqual(calls[8], { type: 'tab', tab: 'calendar' });
  assert.equal(work.length, 4);
  assert.equal(byClass(tree, 'aov-kpi').length, 5);
  assert.equal(tree.filter(node => node?.props?.role === 'note').length, 1);
});

test('error retry, loading and empty states do not display stale section data', () => {
  const snapshot = fixture();
  snapshot.actionRequired.status = 'error';
  snapshot.inventory.status = 'loading';
  snapshot.schedule.items = [];
  let retries = 0;
  const { tree } = render(snapshot, () => retries++);
  assert.equal(byClass(tree, 'aov-work-row').length, 0);
  assert.equal(byClass(tree, 'aov-property').length, 0);
  assert.equal(byClass(tree, 'aov-appointment').length, 0);
  assert.ok(tree.includes('Unable to load data'));
  const retryLabel = load(`${root}/packages/i18n/src/locales/en.ts`).en.agent.tenants.retry;
  const retry = tree.find(node => node?.type === 'button' && nodes(node.props.children).includes(retryLabel));
  assert.ok(retry);
  retry.props.onClick();
  assert.equal(retries, 1);
});

test('desktop labels resolve from all four central locale dictionaries', () => {
  for (const language of ['th', 'en', 'zh', 'ja']) {
    locale = language;
    const { tree } = render();
    const copy = load(`${root}/packages/i18n/src/locales/${language}.ts`)[language].agent.dashboard.webOverview;
    assert.ok(copy);
    assert.ok(tree.includes(copy.property));
    assert.ok(tree.includes(copy.viewingsToday));
  }
  locale = 'en';
});

test('Agent web uses the desktop body while iOS and Android retain the original body and initials', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../app/index.tsx'), 'utf8');
  const ast = ts.createSourceFile('index.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'renderDashboardBody') initializer = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const compiled = ts.transpileModule(`const render = ${initializer};`, { compilerOptions: { jsx: ts.JsxEmit.React } }).outputText;
  const desktop = () => null;
  const mobile = () => null;
  for (const platform of ['web', 'ios', 'android']) {
    const result = new Function('React', 'Platform', 'AgentOverview', 'MobileAgentDashboardBody', 'View', 'styles', 'activeRole', 'agentDashboardSnapshot', 'handleAgentDashboardNavigate', 'profileInitials', 'handlePageRefresh', `${compiled}; return render();`)(React, { OS: platform }, desktop, mobile, 'View', { bodyContainer: {} }, 'agent', fixture(), () => {}, 'AG', () => {});
    if (platform === 'web') assert.equal(result.type, desktop);
    else {
      assert.equal(result.type, 'View');
      assert.equal(result.props.children.type, mobile);
      assert.equal(result.props.children.props.initials, 'AG');
    }
  }
});

function renderMobile(snapshot, onRefresh) {
  const calls = [];
  const { MobileAgentDashboardBody } = load(`${root}/packages/feature-listing/src/components/MobileAgentDashboardBody.tsx`);
  return { calls, tree: nodes(MobileAgentDashboardBody({ snapshot, onNavigate: link => calls.push(link), onRefresh })) };
}

test('native errors hide stale totals and expose retry; commission without a ledger hides all money', () => {
  const snapshot = fixture();
  snapshot.isDemoPreview = false;
  for (const key of ['business', 'actionRequired', 'schedule', 'inventory', 'clients', 'rent', 'activity']) snapshot[key].status = 'error';
  snapshot.commission.status = 'not_configured';
  let retries = 0;
  const { tree } = renderMobile(snapshot, () => retries++);
  assert.ok(!tree.includes('฿288,000'), 'Failed rent data must not remain visible');
  assert.ok(!tree.includes('฿117,000'), 'Unconfigured commission must not display money');
  assert.ok(!tree.includes('Life Asoke'), 'Failed sections must not retain their preview rows');
  const dictionary = load(`${root}/packages/i18n/src/locales/en.ts`).en;
  assert.ok(tree.includes(dictionary.agent.dashboard.webOverview.loadFailed));
  const retry = tree.find(node => node?.type === 'MobileButton' && nodes(node.props.children).includes(dictionary.agent.tenants.retry));
  assert.ok(retry);
  retry.props.onPress();
  assert.equal(retries, 1);
});

test('native loading is visible and successful empty sections use empty states instead of demo content', () => {
  const snapshot = fixture();
  snapshot.isDemoPreview = false;
  snapshot.inventory.status = 'loading';
  snapshot.actionRequired.items = [];
  snapshot.schedule.items = [];
  snapshot.activity.items = [];
  snapshot.commission.status = 'not_configured';
  const { tree } = renderMobile(snapshot);
  const dictionary = load(`${root}/packages/i18n/src/locales/en.ts`).en;
  assert.ok(tree.some(node => node?.type === 'ActivityIndicator'));
  assert.ok(tree.includes(dictionary.agent.dashboard.emptyActions));
  assert.ok(tree.includes(dictionary.agent.dashboard.noAppointments));
  assert.ok(tree.includes(dictionary.common.noData));
  assert.ok(!tree.includes(dictionary.agent.dashboard.demoBanner));
});

test('web and native show a Bangkok appointment across the UTC midnight boundary', () => {
  const NativeDate = Date;
  global.Date = class extends NativeDate {
    constructor(...args) { super(...(args.length ? args : ['2026-10-31T18:45:00Z'])); }
    static now() { return NativeDate.parse('2026-10-31T18:45:00Z'); }
  };
  try {
    const snapshot = fixture();
    snapshot.isDemoPreview = false;
    snapshot.schedule.items = [{ id: 'viewing-1', startsAt: '2026-10-31T19:00:00Z', title: 'Bangkok appointment', contactName: 'Client', kind: 'viewing', status: 'confirmed' }];
    assert.ok(render(snapshot).tree.includes('02:00'));
    assert.ok(renderMobile(snapshot).tree.includes('02:00'));
  } finally { global.Date = NativeDate; }
});
