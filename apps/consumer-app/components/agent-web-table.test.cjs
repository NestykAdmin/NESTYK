// Plan step 3 · A7 (Mos 4 Nov 2026): shared states + WebTable for the agent web list pages.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

const root = path.resolve(__dirname, '../../..');
const cache = new Map();
let state = [];
let cursor = 0;
const theme = { screenTitle: '#211E1E', textSecondary: '#64748B' };
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const localRequire = (name) => {
    if (name.endsWith('.css')) return {};
    if (name === 'react') return { ...React, useEffect() {}, useRef: () => ({ current: null }), useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], (value) => { state[index] = value; }];
    } };
    if (name === '@nestyk/i18n') return { useLocale: () => ({ locale: 'en', t: load(`${root}/packages/i18n/src/locales/en.ts`).en }) };
    if (name === '@nestyk/ui/native') return { useMobileTheme: () => ({ theme }), MobileIcon: 'MobileIcon', MobileStatusPill: 'MobileStatusPill', MobileFilterChip: 'MobileFilterChip' };
    if (!name.startsWith('.')) return require(name);
    const base = path.resolve(path.dirname(filename), name);
    return load([base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find((file) => fs.existsSync(file) && fs.statSync(file).isFile()));
  };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText)(localRequire, module, module.exports);
  return module.exports;
}
function nodes(element) {
  if (element == null || typeof element === 'boolean') return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!React.isValidElement(element)) return [element];
  if (element.type === React.Fragment) return nodes(element.props.children);
  if (typeof element.type === 'function') return nodes(element.type(element.props));
  return [element, ...nodes(element.props.children)];
}
const ui = load(path.join(__dirname, 'agent-web/ui/index.ts'));
const render = (Component, props) => { state = []; cursor = 0; return nodes(React.createElement(Component, props)); };
const text = (tree) => tree.filter((node) => typeof node === 'string' || typeof node === 'number').join('|');
const byTestId = (tree, id) => tree.find((node) => node?.props?.['data-testid'] === id);
const button = (tree, label) => tree.find((node) => node?.type === 'button' && (node.props.children === label || node.props['aria-label'] === label));
function setOnline(value) {
  Object.defineProperty(globalThis, 'navigator', { value: value === undefined ? undefined : { onLine: value }, configurable: true, writable: true });
}

const ROOMS = [
  { id: 1, name: 'Ari 1204', price: 18000 },
  { id: 2, name: 'Asoke 8', price: null },
  { id: 3, name: 'Ari 301', price: 12000 },
];
const columns = [
  { key: 'name', header: 'Room', cell: (r) => r.name, sortable: true, sortValue: (r) => r.name },
  { key: 'price', header: 'Price', cell: (r) => String(r.price ?? '—'), sortable: true, sortValue: (r) => r.price, align: 'end', hideBelow: 'md' },
];
const base = (over = {}) => ({ label: 'Rooms', columns, rows: ROOMS, rowKey: (r) => r.id, ...over });

test('sort: a new column starts ascending, the same column flips; empty values go last, order is stable', () => {
  assert.deepEqual(ui.nextSort(null, 'price'), { key: 'price', direction: 'asc' });
  assert.deepEqual(ui.nextSort({ key: 'price', direction: 'asc' }, 'price'), { key: 'price', direction: 'desc' });
  assert.deepEqual(ui.nextSort({ key: 'price', direction: 'desc' }, 'name'), { key: 'name', direction: 'asc' });
  assert.deepEqual(ui.sortRows(ROOMS, { key: 'price', direction: 'asc' }, columns).map((r) => r.id), [3, 1, 2]);
  assert.deepEqual(ui.sortRows(ROOMS, { key: 'price', direction: 'desc' }, columns).map((r) => r.id), [1, 3, 2]);
  assert.deepEqual(ui.sortRows(ROOMS, { key: 'name', direction: 'asc' }, columns).map((r) => r.id), [3, 1, 2], 'numeric-aware text sort');
  assert.equal(ui.sortRows(ROOMS, null, columns), ROOMS);
});

test('rows render with sortable headers that report the next sort', () => {
  setOnline(undefined);
  const sorts = [];
  const tree = render(ui.WebTable, base({ sort: { key: 'price', direction: 'asc' }, onSortChange: (s) => sorts.push(s) }));
  const table = tree.find((n) => n?.type === 'table');
  assert.equal(table.props['aria-label'], 'Rooms');
  assert.ok(text(tree).includes('Ari 1204'));
  const ths = tree.filter((n) => n?.type === 'th');
  assert.deepEqual(ths.map((th) => th.props['aria-sort']), ['none', 'ascending']);
  assert.ok(ths[1].props.className.includes('awu-align-end') && ths[1].props.className.includes('awu-hide-md'));
  button(tree, 'Sort by Price').props.onClick();
  button(tree, 'Sort by Room').props.onClick();
  assert.deepEqual(sorts, [{ key: 'price', direction: 'desc' }, { key: 'name', direction: 'asc' }]);
});

test('loading shows the skeleton; errors offer retry, or "offline" when the browser is offline', () => {
  setOnline(undefined);
  const loading = render(ui.WebTable, base({ status: 'loading' }));
  assert.ok(byTestId(loading, 'state.loading'));
  assert.equal(loading.find((n) => n?.type === 'table').props['aria-busy'], true);
  assert.ok(!text(loading).includes('Ari 1204'), 'old rows are not shown while loading');

  const retried = [];
  const failed = render(ui.WebTable, base({ status: 'error', onRetry: () => retried.push(1) }));
  assert.ok(byTestId(failed, 'state.error'));
  assert.equal(byTestId(failed, 'state.error').props.role, 'alert');
  button(failed, 'Try again').props.onClick();
  assert.equal(retried.length, 1);

  setOnline(false);
  const offline = render(ui.WebTable, base({ status: 'error', onRetry() {} }));
  assert.ok(byTestId(offline, 'state.offline'));
  assert.ok(text(offline).includes('You are offline'));
  setOnline(undefined);

  const forbidden = render(ui.WebTable, base({ status: 'forbidden' }));
  assert.ok(text(forbidden).includes('This account cannot open this page'));
});

test('no rows: "Nothing here yet" (or the page\'s own words), "No matches" + Clear filters when filtering', () => {
  setOnline(undefined);
  const empty = render(ui.WebTable, base({ rows: [], empty: { title: 'No rooms yet', action: React.createElement('button', { type: 'button' }, 'Add room') } }));
  assert.ok(byTestId(empty, 'state.empty'));
  assert.ok(text(empty).includes('No rooms yet'));
  assert.ok(button(empty, 'Add room'));
  const cleared = [];
  const filtered = render(ui.WebTable, base({ rows: [], filtered: true, onClearFilters: () => cleared.push(1), empty: { title: 'No rooms yet' } }));
  assert.ok(byTestId(filtered, 'state.filtered'));
  assert.ok(!text(filtered).includes('No rooms yet'), 'filtered lists use the no-match words');
  button(filtered, 'Clear filters').props.onClick();
  assert.equal(cleared.length, 1);
});

test('selection: select all / one row, mixed header state, selected count; Enter opens a row', () => {
  setOnline(undefined);
  let picked = new Set();
  const opened = [];
  const props = () => base({ selectable: true, selected: picked, onSelectionChange: (next) => { picked = next; }, rowLabel: (r) => r.name, onRowPress: (r) => opened.push(r.id), testID: 'rooms.table' });
  let tree = render(ui.WebTable, props());
  const box = (label) => tree.find((n) => n?.type === 'input' && n.props['aria-label'] === label);
  assert.equal(tree.filter((n) => n?.type === 'input' && n.props.type === 'checkbox').length, 4, 'header + 3 rows');
  box('Select all rows').props.onChange();
  assert.deepEqual([...picked].sort(), [1, 2, 3]);
  tree = render(ui.WebTable, props());
  assert.ok(text(tree).includes('3 selected'));
  box('Select Asoke 8').props.onChange();
  assert.deepEqual([...picked].sort(), [1, 3]);
  tree = render(ui.WebTable, props());
  const header = box('Select all rows');
  assert.equal(header.props['aria-checked'], 'mixed');
  assert.equal(header.props.checked, false);
  const row = byTestId(tree, 'rooms.table.row.3');
  row.props.onKeyDown({ key: 'Enter', target: 1, currentTarget: 1 });
  row.props.onKeyDown({ key: 'Enter', target: 2, currentTarget: 1 });
  row.props.onClick();
  assert.deepEqual(opened, [3, 3]);
});

test('WebState: every kind has words in all four languages, with the same placeholders', () => {
  const load2 = (code) => load(`${root}/packages/i18n/src/locales/${code}.ts`)[code].agent.dashboard.webStates;
  const en = load2('en');
  const placeholders = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join();
  for (const code of ['th', 'ja', 'zh']) {
    const other = load2(code);
    assert.deepEqual(Object.keys(other).sort(), Object.keys(en).sort(), code);
    for (const key of Object.keys(en)) {
      assert.ok(other[key].trim(), `${code}.${key}`);
      assert.equal(placeholders(other[key]), placeholders(en[key]), `${code}.${key} placeholders`);
    }
  }
  const backs = [];
  const notFound = render(ui.WebState, { kind: 'notFound', onBack: () => backs.push(1) });
  assert.equal(byTestId(notFound, 'state.notFound').props.role, 'status');
  button(notFound, 'Back to the list').props.onClick();
  assert.equal(backs.length, 1);
});
