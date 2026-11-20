// Self owner web rooms page (UI round, 19 Nov 2026, ClickUp z8rcteng6c).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

const root = path.resolve(__dirname, '../../..');
const theme = { mode: 'light', background: '#F8FAFC', surface: '#fff', screenTitle: '#211E1E', textSecondary: '#64748B', border: '#E5E7EB' };
let locale = 'th';
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
    if (name === '@nestyk/i18n') return { useLocale: () => ({ locale, t: load(`${root}/packages/i18n/src/locales/${locale}.ts`)[locale] }) };
    if (name === '@nestyk/ui/native') return { useMobileTheme: () => ({ theme }), MobileIcon: () => null, MobileStatusPill: 'MobileStatusPill', tokens: load(`${root}/packages/ui/src/theme/tokens.ts`).tokens };
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

const roomsLib = () => load(path.join(__dirname, '../lib/self-owner-rooms.ts'));
const copyOf = (l = locale) => load(`${root}/packages/i18n/src/locales/${l}.ts`)[l];
const demo = () => roomsLib().createSelfOwnerRoomsDemo(new Date('2026-11-19T04:00:00Z'));
function nodes(element) {
  if (element == null || typeof element === 'boolean') return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!React.isValidElement(element)) return [element];
  if (typeof element.type === 'function') return nodes(element.type(element.props));
  return [element, ...nodes(element.props.children)];
}
function render(props = {}) {
  const { SelfOwnerRoomsPage } = load(path.join(__dirname, 'self-owner/SelfOwnerRoomsPage.web.tsx'));
  return nodes(SelfOwnerRoomsPage({ rooms: demo(), status: 'demo', isDemoPreview: true, ...props }));
}
const byClass = (tree, name) => tree.filter(node => node?.props?.className?.split(' ').includes(name));
const texts = (tree) => tree.filter(node => typeof node === 'string' || typeof node === 'number').map(String);
const label = (node) => texts(nodes(node.props.children)).join('');

test('first page: ten rooms in a bordered table card, agent pager (range + numbered pages)', () => {
  locale = 'th';
  const tree = render();
  const web = copyOf().agent.listings.web;
  assert.equal(byClass(tree, 'sor-room').length, 10);
  assert.equal(byClass(tree, 'sor-table-card').length, 1);
  assert.ok(texts(tree).includes(web.pageRange.replace('{from}', '1').replace('{to}', '10').replace('{total}', '14')));
  const pager = byClass(tree, 'sor-page-btn');
  assert.deepEqual(pager.map(button => button.props['aria-label'] ?? label(button)), [web.prevPage, '1', '2', web.nextPage]);
  assert.deepEqual(pager.map(button => !!button.props.disabled), [true, false, false, false]);
  assert.equal(pager[1].props['aria-current'], 'page');
  assert.ok(pager[1].props.className.split(' ').includes('is-current'));
});

test('rows match the agent table: photo cell, status pill with the agent tones', () => {
  locale = 'th';
  const tree = render({ initialFilter: 'listed' });
  const so = copyOf().selfOwnerDashboard;
  const tones = load(path.join(__dirname, 'agent-web/ui/statusIntent.ts')).STATUS_INTENT_TONES;
  const counts = roomsLib().countSelfOwnerRooms(demo());
  assert.equal(byClass(tree, 'sor-thumb').length, counts.listed);
  const pills = tree.filter(node => node?.type === 'MobileStatusPill');
  assert.equal(pills.length, counts.listed);
  assert.ok(pills.every(pill => pill.props.label === so.roomState.listed && pill.props.tone.bg === tones.done.bg));
});

test('status is one dropdown like the agent rooms page, with counts in the options', () => {
  locale = 'th';
  const all = copyOf();
  const so = all.selfOwnerRooms;
  const state = all.selfOwnerDashboard.roomState;
  const counts = roomsLib().countSelfOwnerRooms(demo());
  const tree = render();
  const selects = tree.filter(node => node?.type === 'select');
  assert.equal(selects.length, 1, 'no separate sort dropdown in the table view');
  const select = byClass(tree, 'sor-status-select').flatMap(wrap => nodes(wrap.props.children)).find(node => node?.type === 'select');
  assert.equal(select.props.value, 'all');
  assert.equal(select.props['aria-label'], so.filterLabel);
  const options = nodes(select.props.children).filter(node => node?.type === 'option');
  assert.deepEqual(options.map(option => option.props.value), ['all', 'occupied', 'listed', 'unlisted']);
  assert.deepEqual(options.map(label), [
    so.filterAll,
    `${state.occupied} (${counts.occupied})`,
    `${state.listed} (${counts.listed})`,
    `${state.unlisted} (${counts.unlisted})`,
  ]);
  const listed = render({ initialFilter: 'listed' });
  assert.equal(byClass(listed, 'sor-room').length, counts.listed);
  assert.equal(listed.find(node => node?.type === 'select').props.value, 'listed');
});

test('rent and updated sort from the column headers; newest first by default', () => {
  locale = 'th';
  const web = copyOf().agent.listings.web;
  const tree = render();
  const sortable = byClass(tree, 'awu-sort').map(button => texts(nodes(button.props.children))[0]);
  assert.deepEqual(sortable, [web.colPrice, web.colUpdated]);
  const headers = tree.filter(node => node?.type === 'th');
  assert.deepEqual(headers.map(th => texts(nodes(th.props.children))[0] ?? ''), ['', web.colRoom, web.colSize, web.colPrice, web.colStatus, copyOf().selfOwnerRooms.colDetail, web.colUpdated]);
  const sortedHeader = headers.find(th => th.props['aria-sort'] === 'descending');
  assert.ok(texts(nodes(sortedHeader.props.children)).includes(web.colUpdated));
});

test('search narrows the rows; no match shows the filtered state with clear filters', () => {
  locale = 'th';
  assert.equal(byClass(render({ initialQuery: '  EMILY ' }), 'sor-room').length, 1);
  const tree = render({ initialQuery: 'ไม่มีห้องนี้แน่นอน' });
  const states = copyOf().agent.dashboard.webStates;
  assert.equal(byClass(tree, 'sor-room').length, 0);
  assert.ok(texts(tree).includes(states.filteredTitle));
  assert.ok(tree.some(node => node?.type === 'button' && label(node) === states.clearFilters));
  assert.equal(byClass(tree, 'sor-pager').length, 0);
});

test('the listing action is disabled as coming soon and the demo note shows', () => {
  locale = 'th';
  const tree = render();
  const so = copyOf().selfOwnerDashboard;
  const action = byClass(tree, 'sor-action')[0];
  assert.equal(action.props.disabled, true);
  assert.equal(action.props.title, so.comingSoon);
  assert.equal(tree.filter(node => node?.props?.role === 'note').length, 1);
  assert.equal(byClass(render({ isDemoPreview: false }), 'sov-demo').length + render({ isDemoPreview: false }).filter(node => node?.props?.role === 'note').length, 0);
});

test('thai page has no english interface copy; every locale fills its copy', () => {
  locale = 'th';
  assert.doesNotMatch(texts(render()).join('\n'), /\b(Rooms|Search|Status|All|Sort|Rent|Room|Size|Details|Updated|Previous|Next|Page|Coming soon|Sample|Clear filters|bed|sq m)\b/);
  for (const l of ['en', 'ja', 'zh']) {
    locale = l;
    assert.doesNotMatch(texts(render()).join('\n'), /undefined|\{(n|name|amount|date|beds|sqm|page|pages)\}/, l);
  }
  locale = 'th';
});

test('loading shows the table skeleton and no counts', () => {
  locale = 'th';
  const all = copyOf();
  const tree = render({ status: 'loading', rooms: [] });
  assert.ok(tree.some(node => node?.props?.className === 'awu-skeleton'));
  assert.equal(byClass(tree, 'sor-count').length, 0);
  const options = tree.filter(node => node?.type === 'option').map(label);
  assert.deepEqual(options, [all.selfOwnerRooms.filterAll, ...['occupied', 'listed', 'unlisted'].map(key => all.selfOwnerDashboard.roomState[key])]);
});
