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
    if (name === 'expo-constants') return { __esModule: true, default: { expoConfig: { extra: {} } } }; // self-owner-maps-key.ts
    if (name.endsWith('.css')) return {};
    if (name === 'react') return { ...React, useMemo: fn => fn(), useCallback: fn => fn, useSyncExternalStore: (_s, get) => get(), useEffect() {}, useRef: () => ({ current: null }), useId: () => `test-${sequence++}`, useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}] };
    if (name === '@nestyk/i18n') return { useLocale: () => ({ locale, t: load(`${root}/packages/i18n/src/locales/${locale}.ts`)[locale] }) };
    if (name === '@nestyk/ui/native') return { useMobileTheme: () => ({ theme }), MobileIcon: () => null, MobileStatusPill: 'MobileStatusPill', MobileSectionHeader: 'MobileSectionHeader', tokens: load(`${root}/packages/ui/src/theme/tokens.ts`).tokens };
    if (name === '@nestyk/ui/web-content') return load(`${root}/packages/ui/src/shells/WebContentContainer.tsx`);
    if (name === '@nestyk/ui/cookie-consent') return { cookieConsentAllows: () => false };
    if (name === '@nestyk/feature-search') return { RENT_PRICE_LIMIT: 1000000, RENT_PRICE_PRESETS: [], RENT_PRICE_STEP: 500 };
    if (name === 'react-native') return { Modal: ({ visible, children }) => (visible ? children : null), useWindowDimensions: () => ({ width: 1440, height: 900 }), View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: v => v }, Platform: { OS: 'web' }, Alert: { alert() {} } };
    if (name === 'react-native-safe-area-context') return { SafeAreaProvider: ({ children }) => children, SafeAreaView: ({ children }) => children, initialWindowMetrics: null };
    if (name === 'expo-image-picker') return {};
    if (name === '@nestyk/feature-listing') return { ...load(`${root}/packages/feature-listing/src/dashboard/types.ts`), MobileRoomDetailBody: 'Detail', MobileCreateListingWizardBody: 'Wizard', defaultOwnerListingConfig: {} };
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

// Rebuilt like the agent rooms page (Jom 20 Nov 2026): awr-* layout, 24 a page, filters, cards, row opens the detail.
test('first page: every demo room in the agent table card, 24 a page, so one page and no page buttons', () => {
  locale = 'th';
  const tree = render();
  const web = copyOf().agent.listings.web;
  assert.equal(byClass(tree, 'awr-room').length, 14);
  assert.equal(byClass(tree, 'awr-table-card').length, 1);
  assert.ok(texts(tree).includes(web.pageRange.replace('{from}', '1').replace('{to}', '14').replace('{total}', '14')));
  assert.equal(byClass(tree, 'awr-page-btn').length, 0);
  const many = Array.from({ length: 30 }, (_, i) => ({ ...demo()[i % 14], id: `r${i + 1}` }));
  const big = render({ rooms: many });
  assert.equal(byClass(big, 'awr-room').length, 24);
  const pager = byClass(big, 'awr-page-btn');
  assert.deepEqual(pager.map(button => button.props['aria-label'] ?? label(button)), [web.prevPage, '1', '2', web.nextPage]);
  assert.equal(pager[1].props['aria-current'], 'page');
});

test('rows match the agent table: photo cell, status pill with the agent tones, the row is pressable', () => {
  locale = 'th';
  const tree = render({ initialFilter: 'listed' });
  const so = copyOf().selfOwnerDashboard;
  const tones = load(path.join(__dirname, 'agent-web/ui/statusIntent.ts')).STATUS_INTENT_TONES;
  const counts = roomsLib().countSelfOwnerRooms(demo());
  assert.equal(byClass(tree, 'awr-thumb').length, counts.listed);
  const pills = tree.filter(node => node?.type === 'MobileStatusPill');
  assert.equal(pills.length, counts.listed);
  assert.ok(pills.every(pill => pill.props.label === so.roomState.listed && pill.props.tone.bg === tones.done.bg));
  const rows = tree.filter(node => node?.type === 'tr' && typeof node.props.onClick === 'function');
  assert.equal(rows.length, counts.listed, 'rows open the room like the agent table');
});

test('status is one dropdown like the agent rooms page, with counts in the options', () => {
  locale = 'th';
  const all = copyOf();
  const so = all.selfOwnerRooms;
  const state = all.selfOwnerDashboard.roomState;
  const counts = roomsLib().countSelfOwnerRooms(demo());
  const tree = render();
  const selects = tree.filter(node => node?.type === 'select');
  assert.equal(selects.length, 1, 'no sort dropdown and no open filter dialog in the table view');
  const select = byClass(tree, 'awr-status-select').flatMap(wrap => nodes(wrap.props.children)).find(node => node?.type === 'select');
  assert.equal(select.props.value, 'all');
  assert.equal(select.props['aria-label'], so.filterLabel);
  const options = nodes(select.props.children).filter(node => node?.type === 'option');
  assert.deepEqual(options.map(option => option.props.value), ['all', 'occupied', 'listed', 'unlisted']);
  assert.deepEqual(options.map(label), [
    `${so.filterLabel}: ${so.filterAll}`,
    `${state.occupied} (${counts.occupied})`,
    `${state.listed} (${counts.listed})`,
    `${state.unlisted} (${counts.unlisted})`,
  ]);
  const listed = render({ initialFilter: 'listed' });
  assert.equal(byClass(listed, 'awr-room').length, counts.listed);
});

test('rent and updated sort from the column headers; newest first by default; no action column', () => {
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
  assert.equal(byClass(render({ initialQuery: '  EMILY ' }), 'awr-room').length, 1);
  const tree = render({ initialQuery: 'ไม่มีห้องนี้แน่นอน' });
  const states = copyOf().agent.dashboard.webStates;
  assert.equal(byClass(tree, 'awr-room').length, 0);
  assert.ok(texts(tree).includes(states.filteredTitle));
  assert.ok(tree.some(node => node?.type === 'button' && label(node) === states.clearFilters));
  assert.equal(byClass(tree, 'awr-pager').length, 0);
});

test('the listing action is disabled as coming soon and the demo note shows', () => {
  locale = 'th';
  const tree = render();
  const so = copyOf().selfOwnerDashboard;
  const action = byClass(tree, 'sor-action')[0];
  assert.equal(action.props.disabled, true);
  assert.equal(action.props.title, so.comingSoon);
  assert.equal(tree.filter(node => node?.props?.role === 'note').length, 1);
  assert.equal(render({ isDemoPreview: false }).filter(node => node?.props?.role === 'note').length, 0);
});

test('thai page has no english interface copy; every locale fills its copy', () => {
  locale = 'th';
  assert.doesNotMatch(texts(render()).join('\n'), /\b(Rooms|Search|Status|All|Sort|Rent|Room|Size|Details|Updated|Previous|Next|Page|Coming soon|Sample|Clear filters|Filters|Table|Cards|bed|sq m)\b/);
  for (const l of ['en', 'ja', 'zh']) {
    locale = l;
    assert.doesNotMatch(texts(render()).join('\n'), /undefined|\{(n|name|amount|date|beds|sqm|page|pages|count|price|from|to|total)\}/, l);
  }
  locale = 'th';
});

test('loading shows the table skeleton and no counts', () => {
  locale = 'th';
  const all = copyOf();
  const tree = render({ status: 'loading', rooms: [] });
  assert.ok(tree.some(node => node?.props?.className === 'awu-skeleton'));
  assert.equal(texts(byClass(tree, 'awr-count')).join('').trim(), '');
  const options = tree.filter(node => node?.type === 'option').map(label);
  assert.deepEqual(options, [`${all.selfOwnerRooms.filterLabel}: ${all.selfOwnerRooms.filterAll}`, ...['occupied', 'listed', 'unlisted'].map(key => all.selfOwnerDashboard.roomState[key])]);
});

// Jom 23 Nov 2026: the green pill was wider than its text. A table cell is not a flex parent, so the
// pill's alignSelf did nothing and it filled the cell. The status cell wraps it in an inline-flex box.
test('status pill in the table sits in an inline-flex box so it hugs its text', () => {
  locale = 'th';
  const tree = render({ initialFilter: 'listed' });
  const cells = byClass(tree, 'sor-status-cell');
  const counts = roomsLib().countSelfOwnerRooms(demo());
  assert.equal(cells.length, counts.listed);
  assert.ok(cells.every(cell => nodes(cell.props.children).some(node => node?.type === 'MobileStatusPill')));
  const css = fs.readFileSync(path.join(__dirname, 'self-owner/self-owner-rooms.css'), 'utf8');
  assert.match(css, /\.sor-status-cell\s*\{[^}]*display:\s*inline-flex/);
});

// Jom 23 Nov 2026 (UI minors 7–8): the rooms page moved to the agent awr-* classes on 20 Nov, so the old sor-*
// rules were dead; one of them (`:where(.sor-page) p { margin: 0 }`) was what kept the demo note's <p> margin at 0.
test('self-owner-rooms.css only keeps sor-* classes the self owner screens use', () => {
  const dir = path.join(__dirname, 'self-owner');
  const css = fs.readFileSync(path.join(dir, 'self-owner-rooms.css'), 'utf8');
  const sources = fs.readdirSync(dir).filter(f => /\.tsx?$/.test(f)).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const classes = [...new Set([...css.matchAll(/\.(sor-[a-z-]+)/g)].map(m => m[1]))];
  // Only a className use counts (data-testid="sor-search" is not a class).
  const unused = classes.filter(name => !new RegExp(`className=\\{?["'\`][^"'\`]*(?<![\\w-])${name}(?![\\w-])`).test(sources));
  assert.deepEqual(unused, []);
});

test('the demo note has no browser paragraph margin', () => {
  const css = fs.readFileSync(path.join(__dirname, 'self-owner/self-owner-rooms.css'), 'utf8');
  assert.match(css, /\.sor-demo\s*\{[^}]*\bmargin:\s*0;/);
});
