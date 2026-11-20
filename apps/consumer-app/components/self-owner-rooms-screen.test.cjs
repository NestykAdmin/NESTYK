// Self owner phone rooms list (UI round, 19 Nov 2026, ClickUp z8rcteng6c).
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
    if (name === 'react') return { ...React, useMemo: fn => fn(), useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}] };
    if (name === 'react-native') return { View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: value => value, hairlineWidth: 1 } };
    if (name === '@nestyk/i18n') return { useLocale: () => ({ locale, t: load(`${root}/packages/i18n/src/locales/${locale}.ts`)[locale] }) };
    if (name === '@nestyk/ui/native') return {
      useMobileTheme: () => ({ theme }), MobileIcon: () => null, MobileButton: 'MobileButton', MobileInput: 'MobileInput', MobileProfileAvatar: 'Avatar',
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
const copyOf = (l = locale) => load(`${root}/packages/i18n/src/locales/${l}.ts`)[l];
const roomsLib = () => load(path.join(__dirname, '../lib/self-owner-rooms.ts'));
const demo = () => roomsLib().createSelfOwnerRoomsDemo(new Date('2026-11-19T04:00:00Z'));
function nodes(element) {
  if (element == null || typeof element === 'boolean') return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!React.isValidElement(element)) return [element];
  if (typeof element.type === 'function') return nodes(element.type(element.props));
  return [element, ...nodes(element.props.children)];
}
const screen = () => load(path.join(__dirname, 'self-owner/MobileSelfOwnerRoomsScreen.tsx'));
function render(props = {}) { return nodes(screen().MobileSelfOwnerRoomsScreen({ rooms: demo(), status: 'demo', isDemoPreview: true, ...props })); }
const texts = tree => tree.filter(node => typeof node === 'string' || typeof node === 'number').map(String);
const byTestId = (tree, prefix) => tree.filter(node => typeof node?.props?.testID === 'string' && node.props.testID.startsWith(prefix));

test('search, four status chips with counts, ten cards and a pager', () => {
  locale = 'th';
  const tree = render();
  const so = copyOf().selfOwnerRooms;
  const counts = roomsLib().countSelfOwnerRooms(demo());
  const input = tree.find(node => node?.type === 'MobileInput');
  assert.equal(input.props.placeholder, so.searchPlaceholder);
  const chips = byTestId(tree, 'so-filter-');
  assert.deepEqual(chips.map(chip => chip.props.testID), ['so-filter-all', 'so-filter-occupied', 'so-filter-listed', 'so-filter-unlisted']);
  assert.deepEqual(chips.map(chip => chip.props.accessibilityState.selected), [true, false, false, false]);
  chips.forEach((chip, i) => assert.ok(texts(nodes(chip.props.children)).includes(String(counts[['all', 'occupied', 'listed', 'unlisted'][i]]))));
  assert.equal(byTestId(tree, 'so-room-').length, 10);
  assert.ok(texts(tree).includes(so.pageOf.replace('{page}', '1').replace('{pages}', '2')));
  assert.equal(byTestId(tree, 'so-page-prev')[0].props.disabled, true);
  assert.equal(byTestId(tree, 'so-page-next')[0].props.disabled, false);
});

test('a status chip filters the cards', () => {
  locale = 'th';
  const counts = roomsLib().countSelfOwnerRooms(demo());
  const tree = render({ initialFilter: 'listed' });
  assert.equal(byTestId(tree, 'so-room-').length, counts.listed);
  assert.equal(byTestId(tree, 'so-filter-listed')[0].props.accessibilityState.selected, true);
  assert.equal(byTestId(tree, 'so-page-').length, 0);
});

test('no match shows a message and a clear-filters button instead of cards', () => {
  locale = 'th';
  const so = copyOf().selfOwnerRooms;
  const tree = render({ initialQuery: 'ไม่มีห้องนี้แน่นอน' });
  assert.equal(byTestId(tree, 'so-room-').length, 0);
  assert.ok(texts(tree).includes(so.noMatch));
  assert.ok(texts(nodes(byTestId(tree, 'so-clear')[0].props.children)).includes(so.clearFilters));
  const none = render({ rooms: [] });
  assert.ok(texts(none).includes(copyOf().selfOwnerDashboard.noRooms));
});

test('the listing button is disabled as coming soon; the demo note shows', () => {
  locale = 'th';
  const tree = render();
  const so = copyOf().selfOwnerDashboard;
  const button = tree.find(node => node?.type === 'MobileButton');
  assert.equal(button.props.disabled, true);
  assert.ok(texts(nodes(button.props.children)).join(' ').includes(so.comingSoon));
  assert.equal(texts(tree).filter(text => text === so.demoNote).length, 1);
});

test('thai screen has no english interface copy; other locales have no holes', () => {
  locale = 'th';
  assert.doesNotMatch(texts(render()).join('\n'), /\b(Rooms|Search|Status|All|Rent|Room|Previous|Next|Page|Coming soon|Sample|Clear filters|Rented|Listed)\b/);
  for (const l of ['en', 'ja', 'zh']) {
    locale = l;
    assert.doesNotMatch(texts(render()).join('\n'), /undefined|\{(n|name|amount|date|page|pages)\}/, l);
  }
  locale = 'th';
});

test('native fallback of SelfOwnerRoomsPage renders the phone screen', () => {
  const { SelfOwnerRoomsPage } = load(path.join(__dirname, 'self-owner/SelfOwnerRoomsPage.tsx'));
  const element = SelfOwnerRoomsPage({ rooms: demo(), status: 'demo', isDemoPreview: true });
  assert.equal(element.type, screen().MobileSelfOwnerRoomsScreen);
});

test('loading shows a spinner, chips without counts and no result count', () => {
  locale = 'th';
  const all = copyOf();
  const tree = render({ status: 'loading', rooms: [] });
  const spinner = tree.find(node => node?.type === 'ActivityIndicator');
  assert.equal(spinner.props.accessibilityLabel, all.common.loading);
  assert.ok(!texts(tree).some(text => text === '…' || text === '0'));
  assert.ok(!texts(tree).includes(all.selfOwnerRooms.resultCount.replace('{n}', '0')));
  assert.ok(!texts(tree).includes(all.selfOwnerDashboard.noRooms));
});
