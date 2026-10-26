const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

process.env.TZ = 'Asia/Bangkok';
const root = path.resolve(__dirname, '../../..');
const cache = new Map();
let current, locale = 'en', platform = 'web';
const hooks = {
  ...React,
  useMemo: fn => fn(),
  useState(initial) {
    const h = current, i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = typeof initial === 'function' ? initial() : initial;
    return [h.slots[i], value => { h.slots[i] = typeof value === 'function' ? value(h.slots[i]) : value; }];
  },
};
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', output)(name => {
    if (name === 'react') return hooks;
    if (name === 'react-native') return { Platform: { OS: platform }, View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: styles => styles } };
    if (name === 'react-native-calendars') return { Calendar: 'Calendar' };
    if (name === '@nestyk/i18n') return { useLocale: () => ({ locale, t: load(`${root}/packages/i18n/src/locales/${locale}.ts`)[locale] }) };
    if (name === '@nestyk/ui/native') return {
      MobileButton: 'MobileButton', MobileIcon: 'MobileIcon',
      tokens: load(`${root}/packages/ui/src/theme/tokens.ts`).tokens,
      useMobileTheme: () => ({ theme: { mode: 'light', background: '#fafafa', card: '#fff', screenTitle: '#222', textHeading: '#222', textSecondary: '#666', border: '#ddd' } }),
    };
    // Exercise the calendar's record selection and callbacks at the existing editor boundary.
    if (name === './LeadViewingSheet') return { LeadViewingSheet: 'LeadViewingSheet' };
    if (name === './agent-leads-api') return {};
    if (!name.startsWith('.')) return require(name);
    const base = path.resolve(path.dirname(filename), name);
    return load([base, `${base}.ts`, `${base}.tsx`].find(file => fs.existsSync(file) && fs.statSync(file).isFile()));
  }, module, module.exports);
  return module.exports;
}
function nodes(element) {
  if (element == null || typeof element === 'boolean') return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!React.isValidElement(element)) return [element];
  return [element, ...nodes(element.props.children)];
}
const record = (overrides = {}) => ({
  id: 41, leadId: 12, leadName: 'Lead', rentRoomId: 32, roomTitle: 'Condo', roomNumber: '1208',
  scheduledAt: '2026-10-22T10:30:00+07:00', status: 'scheduled', note: null, createdAt: '2026-10-20T00:00:00Z', ...overrides,
});
function harness(extra = {}) {
  const saved = [], retries = [];
  const viewings = [record(), record({ id: 42, leadName: 'Completed lead', status: 'done' })];
  const h = { cursor: 0, slots: [], props: {
    viewings, events: viewings.map(load(`${root}/apps/consumer-app/lib/agent-calendar-viewings.ts`).viewingToCalendarEvent),
    status: 'available', selectedDate: '2026-10-22', visibleMonth: '2026-10-01',
    onSelectDate() {}, onMonthChange() {}, onRetry: () => retries.push(true), onSaved: row => saved.push(row), ...extra,
  }, saved, retries };
  h.render = () => {
    current = h; h.cursor = 0;
    return nodes(load(path.join(__dirname, 'AgentCalendarScreen.tsx')).AgentCalendarScreen(h.props));
  };
  return h;
}
const copy = () => load(`${root}/packages/i18n/src/locales/${locale}.ts`)[locale].agent.calendar;
const buttons = (tree, label) => tree.filter(node => node?.type === 'MobileButton' && nodes(node.props.children).includes(label));

for (const surface of ['web', 'ios', 'android']) {
  test(`${surface}: manual creation is disabled and only scheduled viewings open the existing reschedule/cancel editor`, () => {
    platform = surface;
    const h = harness();
    let tree = h.render();
    const add = buttons(tree, `＋ ${copy().add}`)[0];
    assert.ok(add);
    assert.equal(add.props.disabled, true);
    assert.equal(tree.some(node => node?.type === 'TextInput'), false);
    assert.ok(tree.includes(copy().creationDisabled));
    assert.ok(tree.includes(copy().done));
    const manage = buttons(tree, copy().manage);
    assert.equal(manage.length, 1);
    manage[0].props.onPress();
    tree = h.render();
    const sheet = tree.find(node => node?.type === 'LeadViewingSheet');
    assert.ok(sheet?.props.visible);
    assert.equal(sheet.props.viewing.id, 41);
    assert.equal(sheet.props.leadId, 12);
    assert.equal(sheet.props.roomId, 32);
    const moved = record({ scheduledAt: '2026-11-01T14:00:00+07:00' });
    sheet.props.onSaved(moved);
    assert.deepEqual(h.saved, [moved]);
    assert.equal(h.render().some(node => node?.type === 'LeadViewingSheet' && node.props.visible), false);
    buttons(h.render(), copy().manage)[0].props.onPress();
    h.render().find(node => node?.type === 'LeadViewingSheet').props.onSaved(record({ status: 'cancelled' }));
    assert.equal(h.saved[1].status, 'cancelled');
  });
}

test('loading and errors do not present empty success or stale rows; retry is actionable', () => {
  const h = harness({ status: 'loading' });
  let tree = h.render();
  assert.ok(tree.some(node => node?.type === 'ActivityIndicator'));
  assert.equal(tree.includes('Lead · Condo'), false);
  assert.equal(tree.includes(copy().emptyTitle), false);
  h.props.status = 'error';
  tree = h.render();
  assert.ok(tree.includes(copy().loadError));
  assert.equal(tree.includes(copy().emptyTitle), false);
  buttons(tree, load(`${root}/packages/i18n/src/locales/en.ts`).en.agent.tenants.retry)[0].props.onPress();
  assert.equal(h.retries.length, 1);
});

test('all four languages describe real lead viewings and disabled creation, with counts excluding cancelled records', () => {
  for (const language of ['th', 'en', 'zh', 'ja']) {
    locale = language;
    const h = harness({ viewings: [record(), record({ id: 42, status: 'cancelled' })] });
    const tree = h.render();
    assert.ok(typeof copy().liveNotice === 'string' && copy().liveNotice.length);
    assert.ok(typeof copy().creationDisabled === 'string' && copy().creationDisabled.length);
    assert.ok(tree.includes(copy().liveNotice));
    const calendar = tree.find(node => node?.type === 'Calendar');
    const day = nodes(calendar.props.dayComponent({ date: { dateString: '2026-10-22', day: 22 } }));
    assert.equal(day[0].props.accessibilityLabel, `2026-10-22, ${copy().eventCount.replace('{count}', '1')}`);
  }
  locale = 'en';
});

test('the application calendar passes only API rows and follows a rescheduled appointment across months', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../app/index.tsx'), 'utf8');
  const ast = ts.createSourceFile('index.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let branch;
  function visit(node) {
    if (ts.isIfStatement(node) && node.expression.getText(ast) === "activeTab === 'calendar' && activeRole === 'agent'") branch = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const rows = [record()];
  const selected = [], months = [], reloads = [];
  const env = {
    React, AgentCalendarScreen: 'AgentCalendarScreen', activeTab: 'calendar', activeRole: 'agent', session: { userId: 'account-a' },
    calendarViewings: Object.assign([...rows], { viewings: rows, status: 'available' }),
    calendarEvents: [{ id: 'local-demo' }], calendarDraft: {}, setCalendarEvents() {}, setCalendarDraft() {},
    calendarSelectedDate: '2026-10-22', calendarMonth: '2026-10-01', refreshSequence: { current: 0 },
    calendarDateKey: load(`${root}/apps/consumer-app/lib/agent-calendar-demo.ts`).calendarDateKey,
    setCalendarSelectedDate: date => selected.push(date), setCalendarMonth: month => months.push(month),
    setCalendarReloadToken: token => reloads.push(token),
  };
  const output = ts.transpileModule(`function renderCalendar() { ${branch.getText(ast)} } return renderCalendar();`, {
    compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const screen = new Function(...Object.keys(env), output)(...Object.values(env));
  assert.deepEqual(screen.props.viewings, rows);
  assert.equal(screen.props.status, 'available');
  assert.equal(screen.key, 'account-a');
  screen.props.onSaved(record({ scheduledAt: '2026-11-01T14:00:00+07:00' }));
  assert.deepEqual(selected, ['2026-11-01']);
  assert.deepEqual(months, ['2026-11-01']);
  assert.deepEqual(reloads, [1]);
  screen.props.onSaved(record({ status: 'cancelled' }));
  assert.deepEqual(selected, ['2026-11-01']);
  assert.deepEqual(reloads, [1, 2]);
  screen.props.onRetry();
  assert.deepEqual(reloads, [1, 2, 3]);
});

test('calendar exposes the shared desktop refresh and mobile pull-to-refresh callback', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../app/index.tsx'), 'utf8');
  const ast = ts.createSourceFile('index.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const initializers = {};
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ['handlePageRefresh', 'onPageRefresh'].includes(node.name.getText(ast))) {
      initializers[node.name.getText(ast)] = node.initializer.getText(ast);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const reloads = [], refreshing = [];
  const env = {
    useCallback: fn => fn, activeRole: 'agent', activeTab: 'calendar', partyInbox: false,
    pendingRefresh: { current: null }, refreshSequence: { current: 0 },
    setPageRefreshing: value => refreshing.push(value), setCalendarReloadToken: token => reloads.push(token), finishPageRefresh() {},
    isTenantWorkspace: false, isWizardTab: false,
  };
  env.handlePageRefresh = new Function(...Object.keys(env), `return (${initializers.handlePageRefresh});`)(...Object.values(env));
  const callback = new Function(...Object.keys(env), `return (${initializers.onPageRefresh});`)(...Object.values(env));
  assert.equal(callback, env.handlePageRefresh);
  callback();
  callback();
  assert.deepEqual(reloads, [1]);
  assert.deepEqual(refreshing, [true]);
});
