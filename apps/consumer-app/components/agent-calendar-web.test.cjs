// W13 (Mos 6 Nov 2026): agent web calendar. Same rows and editor as the app; the phone keeps its screen.
process.env.TZ = 'Asia/Bangkok';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

const root = path.resolve(__dirname, '../../..');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

const WEB_KEYS = [
  'headerHint', 'openLeads', 'pickDay', 'statusTitle', 'stateScheduled', 'stateDone', 'stateOverdue',
  'dayTitle', 'monthCount', 'searchPlaceholder', 'searchLabel', 'searchScope', 'viewLabel', 'viewMonth',
  'viewWeek', 'viewWeekSoon', 'viewAgenda', 'moreCount', 'monthGridLabel', 'agendaLabel', 'emptyMonth',
  'noMatch', 'viewingOf',
];

test('calendar web words exist in all four languages and in the types', () => {
  for (const lang of ['en', 'th', 'zh', 'ja']) {
    const s = fs.readFileSync(path.join(root, `packages/i18n/src/locales/${lang}.ts`), 'utf8');
    const block = s.slice(s.indexOf('\n    calendar: {'), s.indexOf('\n    tenants: {'));
    const web = block.slice(block.indexOf('\n      web: {'));
    assert.ok(block.includes('\n      web: {'), `${lang}: agent.calendar.web`);
    for (const key of WEB_KEYS) assert.match(web, new RegExp(`\\n        ${key}: '[^']+',`), `${lang}.${key}`);
    for (const key of ['dayTitle', 'monthCount', 'moreCount']) assert.match(web, new RegExp(`\\n        ${key}: '[^']*\\{count\\}`), `${lang}.${key} {count}`);
    assert.match(web, /\n        viewingOf: '[^']*\{room\}/, `${lang}.viewingOf {room}`);
  }
  const types = fs.readFileSync(path.join(root, 'packages/i18n/src/types.ts'), 'utf8');
  const block = types.slice(types.indexOf('\n    calendar: {'));
  const web = block.slice(block.indexOf('\n      web: {'), block.indexOf('\n      };'));
  for (const key of WEB_KEYS) assert.match(web, new RegExp(`\\n        ${key}: string;`), `types.${key}`);
});

test('native and phone keep the app calendar with every prop', () => {
  const native = read('agent-web/AgentCalendarPage.tsx');
  assert.match(native, /import \{ AgentCalendarScreen \} from "\.\.\/AgentCalendarScreen";/);
  for (const prop of ['viewings', 'status', 'onRetry', 'onSaved', 'selectedDate', 'onSelectDate', 'visibleMonth', 'onMonthChange']) {
    assert.match(native, new RegExp(`\\b${prop}=\\{${prop}\\}`), prop);
  }
  assert.doesNotMatch(native, /onOpenLeads=/);
});

test('the web page gets rows from props only (no fetch of its own)', () => {
  const web = read('agent-web/AgentCalendarPage.web.tsx');
  assert.doesNotMatch(web, /listAgentViewings|fetch\(|agent-leads-api/);
  assert.match(web, /viewingIntent\(/);
});

// ---- render harness (fixed clock: Tue 3 Nov 2026 12:00 Bangkok) ----
const FIXED = Date.parse('2026-11-03T12:00:00+07:00');
const RealDate = Date;
class FixedDate extends RealDate {
  constructor(...args) { if (args.length) super(...args); else super(FIXED); }
  static now() { return FIXED; }
}
const cache = new Map();
let current, locale = 'en';
const hooks = {
  ...React,
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useEffect() {},
  useRef: (value) => ({ current: value }),
  useState(initial) {
    const h = current, i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = typeof initial === 'function' ? initial() : initial;
    return [h.slots[i], (value) => { h.slots[i] = typeof value === 'function' ? value(h.slots[i]) : value; }];
  },
};
const uiReal = () => load(path.join(__dirname, 'agent-web/ui/statusIntent.ts'));
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', output)((name) => {
    if (name === 'react') return hooks;
    if (name.endsWith('.css')) return {};
    if (name === '@nestyk/i18n') return { useLocale: () => ({ locale, t: load(`${root}/packages/i18n/src/locales/${locale}.ts`)[locale] }) };
    if (name === '@nestyk/ui/native') return { MobileIcon: 'MobileIcon' };
    if (name === './ui') return { ...uiReal(), StatusBadge: 'StatusBadge', WebCard: 'WebCard', WebState: 'WebState', WebSkeleton: 'WebSkeleton' };
    if (name === '../LeadViewingSheet') return { LeadViewingSheet: 'LeadViewingSheet' };
    if (name.endsWith('/agent-leads-api')) return {};
    if (!name.startsWith('.')) return require(name);
    const base = path.resolve(path.dirname(filename), name);
    return load([`${base}.ts`, `${base}.tsx`].find((f) => fs.existsSync(f) && fs.statSync(f).isFile()));
  }, module, module.exports);
  return module.exports;
}
function nodes(element) {
  if (element == null || typeof element === 'boolean') return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!React.isValidElement(element)) return [element];
  return [element, ...nodes(element.props.children)];
}
const text = (node) => nodes(node.props.children).filter((n) => typeof n === 'string' || typeof n === 'number').join('');
const byTestId = (tree, id) => tree.find((n) => n?.props?.['data-testid'] === id);
const record = (over = {}) => ({
  id: 41, leadId: 12, leadName: 'Nalin', rentRoomId: 32, roomTitle: 'Ari Garden', roomNumber: '1204',
  scheduledAt: '2026-11-04T10:30:00+07:00', status: 'scheduled', note: null, createdAt: '2026-10-20T00:00:00Z', ...over,
});
const copy = () => load(`${root}/packages/i18n/src/locales/${locale}.ts`)[locale].agent.calendar;
function harness(extra = {}) {
  const calls = { saved: [], retries: 0, selected: [], months: [], leads: 0 };
  const h = { cursor: 0, slots: [], calls, props: {
    viewings: [
      record(),
      record({ id: 42, leadName: 'Kenji', roomTitle: 'Ekkamai Nest', roomNumber: '908', status: 'done', scheduledAt: '2026-11-02T14:00:00+07:00' }),
      record({ id: 43, leadName: 'Somjai', scheduledAt: '2026-11-02T17:00:00+07:00' }),
      record({ id: 44, leadName: 'Gone', status: 'cancelled', scheduledAt: '2026-11-04T09:00:00+07:00' }),
      ...['09:00', '10:00', '11:00', '13:00', '15:00'].map((time, i) => record({ id: 50 + i, leadName: `Busy ${i}`, scheduledAt: `2026-11-06T${time}:00+07:00` })),
    ],
    status: 'available', selectedDate: '2026-11-04', visibleMonth: '2026-11-01',
    onRetry: () => { calls.retries += 1; }, onSaved: (row) => calls.saved.push(row),
    onSelectDate: (d) => calls.selected.push(d), onMonthChange: (m) => calls.months.push(m), onOpenLeads: () => { calls.leads += 1; },
    ...extra,
  } };
  h.render = () => {
    current = h; h.cursor = 0;
    global.Date = FixedDate;
    try { return nodes(load(path.join(__dirname, 'agent-web/AgentCalendarPage.web.tsx')).AgentCalendarPage(h.props)); }
    finally { global.Date = RealDate; }
  };
  return h;
}

test('loading shows skeletons and never the empty texts; error shows the page retry', () => {
  const h = harness({ status: 'loading' });
  let tree = h.render();
  assert.ok(tree.some((n) => n?.type === 'WebSkeleton'));
  assert.equal(tree.includes(copy().emptyTitle), false);
  assert.equal(tree.includes(copy().web.emptyMonth), false);
  assert.equal(tree.includes('Nalin'), false);
  h.props.status = 'error';
  tree = h.render();
  const state = tree.find((n) => n?.type === 'WebState' && n.props.kind === 'error');
  assert.ok(state);
  state.props.onRetry();
  assert.equal(h.calls.retries, 1);
  assert.equal(tree.includes(copy().emptyTitle), false);
});

test('month grid: Monday first, 6 rows for Nov 2026, at most 3 viewings a day then +N', () => {
  const tree = harness().render();
  const cells = tree.filter((n) => typeof n?.props?.['data-testid'] === 'string' && n.props['data-testid'].startsWith('calendar.day.'));
  assert.equal(cells.length, 42);
  assert.equal(cells[0].props['data-testid'], 'calendar.day.2026-10-26');
  const busy = byTestId(tree, 'calendar.day.2026-11-06');
  assert.equal(nodes(busy.props.children).filter((n) => n?.props?.className?.split?.(' ').includes('awc-chip')).length, 3);
  assert.ok(text(busy).includes(copy().web.moreCount.replace('{count}', '2')));
  assert.equal(busy.type, 'button');
  assert.match(busy.props['aria-label'], new RegExp(copy().eventCount.replace('{count}', '5')));
});

test('cancelled viewings never show; the month count leaves them out', () => {
  const tree = harness().render();
  assert.equal(tree.some((n) => typeof n === 'string' && n.includes('Gone')), false);
  assert.ok(tree.includes(copy().web.monthCount.replace('{count}', '8')));
});

test('a day outside the month selects it and moves to its month', () => {
  const h = harness();
  byTestId(h.render(), 'calendar.day.2026-12-02').props.onClick();
  assert.deepEqual(h.calls.selected, ['2026-12-02']);
  assert.deepEqual(h.calls.months, ['2026-12-01']);
});

test('status filter: three states with counts; switching one off hides its rows', () => {
  const h = harness();
  let tree = h.render();
  const boxes = tree.filter((n) => n?.type === 'input' && n.props.type === 'checkbox');
  assert.equal(boxes.length, 3);
  const status = byTestId(tree, 'calendar.status');
  const words = text(status);
  for (const [label, n] of [[copy().web.stateScheduled, 6], [copy().web.stateDone, 1], [copy().web.stateOverdue, 1]]) {
    assert.ok(words.includes(label) && words.includes(String(n)), label);
  }
  assert.ok(tree.some((n) => typeof n === 'string' && n.includes('Ekkamai Nest')));
  byTestId(tree, 'calendar.status.done').props.onChange();
  tree = h.render();
  assert.equal(tree.some((n) => typeof n === 'string' && n.includes('Ekkamai Nest')), false);
});

test('search narrows grid, day list and agenda; nothing found says so and clears', () => {
  const h = harness();
  byTestId(h.render(), 'calendar.search').props.onChange({ target: { value: '  ekkamai ' } });
  let tree = h.render();
  assert.ok(tree.some((n) => typeof n === 'string' && n.includes('Ekkamai Nest')));
  assert.equal(tree.some((n) => typeof n === 'string' && n.includes('Ari Garden')), false);
  byTestId(tree, 'calendar.search').props.onChange({ target: { value: 'zzz' } });
  tree = h.render();
  const none = tree.find((n) => n?.props?.['data-testid'] === 'calendar.noMatch');
  assert.ok(none && text(none).includes(copy().web.noMatch));
  nodes(none.props.children).find((n) => n?.type === 'button').props.onClick();
  tree = h.render();
  assert.equal(byTestId(tree, 'calendar.search').props.value, '');
  assert.ok(tree.some((n) => typeof n === 'string' && n.includes('Ari Garden')));
});

test('agenda: manage only on still-scheduled rows; it opens the app editor and passes the saved row up', () => {
  const h = harness();
  byTestId(h.render(), 'calendar.view.agenda').props.onClick();
  let tree = h.render();
  assert.ok(byTestId(tree, 'calendar.agenda'));
  const manage = nodes(byTestId(tree, 'calendar.agenda')).filter((n) => n?.type === 'button' && text(n) === copy().manage);
  assert.equal(manage.length, 7); // 5 busy + Nalin + overdue Somjai; done Kenji has none
  manage[0].props.onClick();
  tree = h.render();
  const sheet = tree.find((n) => n?.type === 'LeadViewingSheet');
  assert.ok(sheet?.props.visible);
  assert.equal(sheet.props.leadId, 12);
  assert.equal(sheet.props.roomId, 32);
  const moved = record({ id: 43, scheduledAt: '2026-11-20T10:00:00+07:00' });
  sheet.props.onSaved(moved);
  assert.deepEqual(h.calls.saved, [moved]);
  assert.equal(h.render().some((n) => n?.type === 'LeadViewingSheet'), false);
});

test('week view is shown but off; viewings are scheduled from leads, never created here', () => {
  const h = harness();
  const tree = h.render();
  const week = byTestId(tree, 'calendar.view.week');
  assert.equal(week.props.disabled, true);
  assert.equal(week.props.title, copy().web.viewWeekSoon);
  assert.equal(tree.includes(`＋ ${copy().add}`), false);
  byTestId(tree, 'calendar.openLeads').props.onClick();
  assert.equal(h.calls.leads, 1);
});

test('all four languages render without missing words', () => {
  for (const language of ['th', 'en', 'zh', 'ja']) {
    locale = language;
    const tree = harness().render();
    assert.equal(tree.some((n) => n === undefined || (typeof n === 'string' && /undefined|\{count\}|\{room\}|\{day\}/.test(n))), false, language);
  }
  locale = 'en';
});

test('desktop agent web renders the calendar page; phone and phone-width web keep the app screen with the same props', () => {
  const index = fs.readFileSync(path.join(__dirname, '../app/index.tsx'), 'utf8');
  assert.match(index, /import \{ AgentCalendarPage \} from '\.\.\/components\/agent-web\/AgentCalendarPage';/);
  const branch = index.slice(index.indexOf("if (activeTab === 'calendar' && activeRole === 'agent') {"));
  assert.match(branch, /const calendarProps: AgentCalendarPageProps = \{/);
  assert.match(branch, /if \(isAgentWeb\) \{\s*return <AgentCalendarPage key=\{session\?\.userId \?\? 'guest'\} \{\.\.\.calendarProps\} onOpenLeads=\{\(\) => handleTabPress\('listingLead'\)\} \/>;\s*\}/);
  assert.match(branch, /return <AgentCalendarScreen key=\{session\?\.userId \?\? 'guest'\} \{\.\.\.calendarProps\} \/>;/);
});
