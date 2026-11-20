// Self owner web Dashboard (UI round, 19 Nov 2026, ClickUp z8rcteng6b).
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
    if (name === '@nestyk/ui/native') return { useMobileTheme: () => ({ theme }), MobileIcon: () => null, tokens: load(`${root}/packages/ui/src/theme/tokens.ts`).tokens };
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
const lib = () => load(path.join(__dirname, '../lib/self-owner-dashboard.ts'));
const copyOf = (l = locale) => load(`${root}/packages/i18n/src/locales/${l}.ts`)[l].selfOwnerDashboard;
function fixture() { return lib().createSelfOwnerDashboardDemoFixture({ greetingName: 'Jom', localDateLabel: 'วันพฤหัสบดี', now: new Date('2026-11-19T04:00:00Z') }); }
function nodes(element) {
  if (element == null || typeof element === 'boolean') return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!React.isValidElement(element)) return [element];
  if (typeof element.type === 'function') return nodes(element.type(element.props));
  return [element, ...nodes(element.props.children)];
}
function render(snapshot = fixture(), extra = {}) {
  const { SelfOwnerOverview } = load(path.join(__dirname, 'self-owner/SelfOwnerOverview.web.tsx'));
  return nodes(SelfOwnerOverview({ snapshot, ...extra }));
}
const byClass = (tree, name) => tree.filter(node => node?.props?.className?.split(' ').includes(name));
const texts = (tree) => tree.filter(node => typeof node === 'string' || typeof node === 'number').map(String);

test('renders rooms, rent rows, to-dos and viewings from the snapshot', () => {
  locale = 'th';
  const snapshot = fixture();
  const tree = render(snapshot);
  const { SELF_OWNER_PREVIEW: limit } = lib();
  assert.equal(byClass(tree, 'sov-room').length, Math.min(snapshot.rooms.items.length, limit.rooms));
  assert.equal(byClass(tree, 'sov-rent-row').length, Math.min(snapshot.rent.items.length, limit.rent));
  assert.equal(byClass(tree, 'sov-todo-row').length, 4);
  assert.equal(byClass(tree, 'sov-viewing').length, snapshot.viewings.items.length);
  assert.equal(tree.filter(node => node?.props?.role === 'note').length, 1);
  const all = texts(tree).join('\n');
  const copy = copyOf();
  const sum = lib().summarizeRooms(snapshot.rooms.items);
  assert.ok(all.includes(copy.roomCount.replace('{n}', String(sum.total))));
  assert.ok(all.includes(copy.occupiedCount.replace('{n}', String(sum.occupied))));
  assert.ok(all.includes(copy.vacantCount.replace('{n}', String(sum.vacant))));
  assert.ok(all.includes(copy.rentState.overdue.replace('{days}', '3')));
});

test('the listing action and the view-all links are all disabled as coming soon', () => {
  locale = 'th';
  const copy = copyOf();
  const buttons = render().filter(node => node?.type === 'button');
  assert.equal(buttons.length, 4);
  for (const button of buttons) {
    assert.equal(button.props.disabled, true);
    assert.equal(button.props.title, copy.comingSoon);
  }
  const labels = buttons.map(button => texts(nodes(button.props.children)).join(''));
  for (const key of ['addListing', 'viewAllRooms', 'viewAllRent', 'viewCalendar']) assert.ok(labels.some(label => label.includes(copy[key])), key);
});

test('long lists show a preview, say how many are hidden, and keep the totals', () => {
  locale = 'th';
  const copy = copyOf();
  const { SELF_OWNER_PREVIEW: limit } = lib();
  const big = fixture();
  big.rooms.items = Array.from({ length: 36 }, (_, i) => ({ ...big.rooms.items[i % 6], id: `r${i}` }));
  big.rent.items = Array.from({ length: 12 }, (_, i) => ({ ...big.rent.items[i % 4], id: `p${i}` }));
  big.viewings.items = Array.from({ length: 9 }, (_, i) => ({ ...big.viewings.items[i % 2], id: `v${i}` }));
  const tree = render(big);
  assert.equal(byClass(tree, 'sov-room').length, limit.rooms);
  assert.equal(byClass(tree, 'sov-rent-row').length, limit.rent);
  assert.equal(byClass(tree, 'sov-viewing').length, limit.viewings);
  const all = texts(tree);
  assert.ok(all.includes(copy.roomCount.replace('{n}', '36')));
  for (const hidden of [36 - limit.rooms, 12 - limit.rent, 9 - limit.viewings]) {
    assert.ok(all.includes(copy.moreItems.replace('{n}', String(hidden))), String(hidden));
  }
});

test('the thai page carries no english interface copy', () => {
  locale = 'th';
  const all = texts(render()).join('\n');
  assert.doesNotMatch(all, /\b(Dashboard|Listing|Lead|Tenant|Income|Rent|Paid|Overdue|Coming soon|Sample)\b/);
});

test('error and empty sections show a message instead of data', () => {
  locale = 'th';
  const copy = copyOf();
  const failed = fixture();
  failed.rooms.status = 'error';
  let tree = render(failed);
  assert.equal(byClass(tree, 'sov-room').length, 0);
  assert.ok(texts(tree).includes(copy.sectionError));
  const empty = fixture();
  empty.rooms.items = [];
  empty.rent.items = [];
  empty.viewings.items = [];
  empty.todo.items = empty.todo.items.map(item => ({ ...item, count: 0 }));
  tree = render(empty);
  const all = texts(tree);
  for (const key of ['noRooms', 'noRent', 'noViewings', 'noTodo']) assert.ok(all.includes(copy[key]), key);
});

test('every locale renders without missing copy', () => {
  for (const l of ['th', 'en', 'ja', 'zh']) {
    locale = l;
    const all = texts(render()).join('\n');
    assert.doesNotMatch(all, /undefined|\{(n|name|amount|date|days|period|received|total)\}/, l);
  }
  locale = 'th';
});

test('with onOpenRooms the "view all rooms" link works; the others stay coming soon', () => {
  locale = 'th';
  const copy = copyOf();
  let opened = 0;
  const buttons = render(fixture(), { onOpenRooms: () => { opened += 1; } }).filter(node => node?.type === 'button');
  const rooms = buttons.find(button => texts(nodes(button.props.children)).join('').includes(copy.viewAllRooms));
  assert.equal(rooms.props.disabled, undefined);
  rooms.props.onClick();
  assert.equal(opened, 1);
  assert.equal(buttons.filter(button => button.props.disabled === true).length, 3);
});

test('loading sections show a skeleton, never stale rows or counts', () => {
  locale = 'th';
  const copy = copyOf();
  const snapshot = fixture();
  for (const key of ['rooms', 'rent', 'todo', 'viewings']) snapshot[key].status = 'loading';
  const tree = render(snapshot);
  assert.equal(tree.filter(node => node?.props?.className === 'awu-skeleton').length, 4);
  for (const name of ['sov-room', 'sov-rent-row', 'sov-todo-row', 'sov-viewing', 'sov-counts']) assert.equal(byClass(tree, name).length, 0, name);
  assert.ok(!texts(tree).some(text => text === '…'));
  const all = texts(tree).join('\n');
  assert.doesNotMatch(all, new RegExp(copy.roomCount.replace('{n}', '\\d+')));
});

// Listing UI round (20 Nov 2026, ClickUp z8rcteng6d)
test('the listing action opens the form when the shell passes onAddListing', () => {
  locale = 'th';
  const copy = copyOf();
  let added = 0;
  const button = render(fixture(), { onAddListing: () => { added += 1; } })
    .filter(node => node?.type === 'button')
    .find(node => texts(nodes(node.props.children)).join('').includes(copy.addListing));
  assert.equal(!!button.props.disabled, false);
  assert.ok(!texts(nodes(button.props.children)).join('').includes(copy.comingSoon));
  button.props.onClick();
  assert.equal(added, 1);
});
