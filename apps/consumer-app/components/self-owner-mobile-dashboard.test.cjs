// Self owner phone Dashboard (UI round, 19 Nov 2026, ClickUp z8rcteng6b).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

const root = path.resolve(__dirname, '../../..');
const theme = { mode: 'light', background: '#F8FAFC', surface: '#fff', screenTitle: '#211E1E', textSecondary: '#64748B', border: '#E5E7EB' };
let locale = 'th';
const cache = new Map();
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const localRequire = (name) => {
    if (name === 'react') return { ...React, useMemo: fn => fn() };
    if (name === 'react-native') return { View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: value => value, hairlineWidth: 1 } };
    if (name === '@nestyk/i18n') return { useLocale: () => ({ locale, t: load(`${root}/packages/i18n/src/locales/${locale}.ts`)[locale] }) };
    if (name === '@nestyk/ui/native') return {
      useMobileTheme: () => ({ theme }), MobileIcon: () => null, MobileButton: 'MobileButton', MobileProfileAvatar: 'Avatar',
      AccountDeletionNotice: 'AccountDeletionNotice', tokens: load(`${root}/packages/ui/src/theme/tokens.ts`).tokens, getCardElevation: () => ({}),
    };
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
const copyOf = () => load(`${root}/packages/i18n/src/locales/${locale}.ts`)[locale].selfOwnerDashboard;
function fixture() {
  return load(path.join(__dirname, '../lib/self-owner-dashboard.ts')).createSelfOwnerDashboardDemoFixture({ greetingName: 'Jom', localDateLabel: 'วันพฤหัสบดี', now: new Date('2026-11-19T04:00:00Z') });
}
function nodes(element) {
  if (element == null || typeof element === 'boolean') return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!React.isValidElement(element)) return [element];
  if (typeof element.type === 'function') return nodes(element.type(element.props));
  return [element, ...nodes(element.props.children)];
}
const body = () => load(path.join(__dirname, 'self-owner/MobileSelfOwnerDashboardBody.tsx'));
function render(snapshot = fixture(), extra = {}) { return nodes(body().MobileSelfOwnerDashboardBody({ snapshot, initials: 'J', ...extra })); }
const texts = tree => tree.filter(node => typeof node === 'string' || typeof node === 'number').map(String);
const byTestId = (tree, prefix) => tree.filter(node => typeof node?.props?.testID === 'string' && node.props.testID.startsWith(prefix));

test('sections follow the web order and list every item', () => {
  locale = 'th';
  const snapshot = fixture();
  const tree = render(snapshot);
  const all = texts(tree);
  const copy = copyOf();
  const order = [copy.myRooms, copy.todoTitle, copy.viewingsTitle].map(title => all.indexOf(title));
  const rentIndex = all.findIndex(text => text.startsWith(copy.rentTitle.split('{period}')[0]) && text !== copy.myRooms);
  assert.ok(order.every(i => i >= 0), String(order));
  assert.ok(order[0] < rentIndex && rentIndex < order[1] && order[1] < order[2], `${order} ${rentIndex}`);
  const { SELF_OWNER_PREVIEW: limit } = load(path.join(__dirname, '../lib/self-owner-dashboard.ts'));
  assert.equal(byTestId(tree, 'so-room-').length, Math.min(snapshot.rooms.items.length, limit.rooms));
  assert.equal(byTestId(tree, 'so-rent-').length, Math.min(snapshot.rent.items.length, limit.rent));
  assert.equal(byTestId(tree, 'so-todo-').length, 4);
  assert.equal(byTestId(tree, 'so-viewing-').length, snapshot.viewings.items.length);
  assert.equal(all.filter(text => text === copy.demoNote).length, 1);
});

test('the listing button is disabled and says coming soon', () => {
  locale = 'th';
  const tree = render();
  const buttons = tree.filter(node => node?.type === 'MobileButton');
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].props.disabled, true);
  assert.ok(texts(nodes(buttons[0].props.children)).join(' ').includes(copyOf().comingSoon));
});

test('the thai screen carries no english interface copy, other locales have no holes', () => {
  locale = 'th';
  assert.doesNotMatch(texts(render()).join('\n'), /\b(Dashboard|Listing|Lead|Tenant|Income|Rent|Paid|Overdue|Coming soon|Sample)\b/);
  for (const l of ['en', 'ja', 'zh']) {
    locale = l;
    assert.doesNotMatch(texts(render()).join('\n'), /undefined|\{(n|name|amount|date|days|period|received|total)\}/, l);
  }
  locale = 'th';
});

test('long lists show a preview and disabled view-all links', () => {
  locale = 'th';
  const copy = copyOf();
  const { SELF_OWNER_PREVIEW: limit } = load(path.join(__dirname, '../lib/self-owner-dashboard.ts'));
  const big = fixture();
  big.rooms.items = Array.from({ length: 36 }, (_, i) => ({ ...big.rooms.items[i % 6], id: `r${i}` }));
  big.rent.items = Array.from({ length: 12 }, (_, i) => ({ ...big.rent.items[i % 4], id: `p${i}` }));
  big.viewings.items = Array.from({ length: 9 }, (_, i) => ({ ...big.viewings.items[i % 2], id: `v${i}` }));
  const tree = render(big);
  assert.equal(byTestId(tree, 'so-room-').length, limit.rooms);
  assert.equal(byTestId(tree, 'so-rent-').length, limit.rent);
  assert.equal(byTestId(tree, 'so-viewing-').length, limit.viewings);
  const links = byTestId(tree, 'so-link-');
  assert.equal(links.length, 3);
  assert.ok(links.every(link => link.props.accessibilityState?.disabled === true));
  const all = texts(tree);
  for (const key of ['viewAllRooms', 'viewAllRent', 'viewCalendar']) assert.ok(all.some(text => text.includes(copy[key])), key);
  for (const hidden of [36 - limit.rooms, 12 - limit.rent, 9 - limit.viewings]) {
    assert.ok(all.includes(copy.moreItems.replace('{n}', String(hidden))), String(hidden));
  }
});

test('native fallback of SelfOwnerOverview renders the phone body', () => {
  const { SelfOwnerOverview } = load(path.join(__dirname, 'self-owner/SelfOwnerOverview.tsx'));
  const element = SelfOwnerOverview({ snapshot: fixture() });
  assert.equal(element.type, body().MobileSelfOwnerDashboardBody);
});

test('with onOpenRooms the phone "view all rooms" row works', () => {
  locale = 'th';
  let opened = 0;
  const tree = nodes(body().MobileSelfOwnerDashboardBody({ snapshot: fixture(), initials: 'J', onOpenRooms: () => { opened += 1; } }));
  const rooms = byTestId(tree, 'so-link-rooms')[0];
  assert.equal(rooms.props.accessibilityState.disabled, false);
  rooms.props.onPress();
  assert.equal(opened, 1);
  assert.equal(byTestId(tree, 'so-link-rent')[0].props.accessibilityState.disabled, true);
});

test('loading sections show a spinner, never stale rows or counts', () => {
  locale = 'th';
  const copy = copyOf();
  const snapshot = fixture();
  for (const key of ['rooms', 'rent', 'todo', 'viewings']) snapshot[key].status = 'loading';
  const tree = nodes(body().MobileSelfOwnerDashboardBody({ snapshot, initials: 'J' }));
  const spinners = tree.filter(node => node?.type === 'ActivityIndicator');
  assert.equal(spinners.length, 4);
  assert.ok(spinners.every(s => s.props.accessibilityLabel === load(`${root}/packages/i18n/src/locales/th.ts`).th.common.loading));
  for (const prefix of ['so-room-', 'so-rent-', 'so-todo-', 'so-viewing-']) assert.equal(byTestId(tree, prefix).length, 0, prefix);
  assert.ok(!texts(tree).some(text => text === '…'));
  assert.doesNotMatch(texts(tree).join('\n'), new RegExp(copy.roomCount.replace('{n}', '\\d+')));
});

// Listing UI round (20 Nov 2026, ClickUp z8rcteng6d)
test('the listing button opens the form when the shell passes onAddListing', () => {
  locale = 'th';
  let added = 0;
  const button = render(fixture(), { onAddListing: () => { added += 1; } }).find(node => node?.type === 'MobileButton');
  assert.equal(!!button.props.disabled, false);
  assert.ok(!texts(nodes(button.props.children)).join(' ').includes(copyOf().comingSoon));
  button.props.onPress();
  assert.equal(added, 1);
});

test('phone: rent "view all" and the to-dos link to income and contracts (24 Nov 2026)', () => {
  locale = 'th';
  const calls = [];
  const tree = nodes(body().MobileSelfOwnerDashboardBody({ snapshot: fixture(), initials: 'J', onOpenIncome: () => calls.push('income'), onOpenContracts: () => calls.push('contracts') }));
  const rent = byTestId(tree, 'so-link-rent')[0];
  assert.equal(rent.props.accessibilityState.disabled, false);
  rent.props.onPress();
  for (const kind of ['overdue_rent', 'awaiting_signature', 'renewal']) {
    const row = byTestId(tree, `so-todo-${kind}`)[0];
    assert.equal(row.props.accessibilityRole, 'button', kind);
    row.props.onPress();
  }
  assert.deepEqual(calls, ['income', 'income', 'contracts', 'contracts']);
  assert.equal(byTestId(tree, 'so-todo-new_interest')[0].props.onPress, undefined);
});
