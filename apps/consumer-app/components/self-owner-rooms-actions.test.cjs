// Self owner rooms list actions (listing UI round, 20 Nov 2026, ClickUp z8rcteng6c / z8rcteng6d): add listing, edit a
// room, publish / unpublish with a confirm step, on the web table and the phone list. Uses a small stateful hook
// runner so a click can change state and the page renders again.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

const root = path.resolve(__dirname, '../../..');
const theme = { mode: 'light', background: '#F8FAFC', surface: '#fff', screenTitle: '#211E1E', textSecondary: '#64748B', border: '#E5E7EB', spinner: '#000' };
let hooks = [];
let hookIndex = 0;
let alerts = [];
let confirmAnswer = true;
let consentAllows = false;
const stored = new Map();
globalThis.window = globalThis.window ?? globalThis;
globalThis.localStorage = { getItem: (k) => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, String(v)) };
const fakeReact = {
  ...React,
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useEffect() {},
  useRef: () => ({ current: null }),
  useSyncExternalStore: (_s, get) => get(),
  useId: () => `id-${hookIndex}`,
  useState: (initial) => {
    const i = hookIndex++;
    if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial;
    return [hooks[i], (next) => { hooks[i] = typeof next === 'function' ? next(hooks[i]) : next; }];
  },
};
const cache = new Map();
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const localRequire = (name) => {
    if (name.endsWith('.css')) return {};
    if (name === 'react') return fakeReact;
    if (name === 'react-native') return {
      Modal: ({ visible, children }) => (visible ? children : null), useWindowDimensions: () => ({ width: 1440, height: 900 }),
      View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: (v) => v, hairlineWidth: 1 },
      Platform: { OS: 'ios' }, Alert: { alert: (...args) => alerts.push(args) },
    };
    if (name === '@nestyk/i18n') return { useLocale: () => ({ locale: 'th', t: load(`${root}/packages/i18n/src/locales/th.ts`).th }) };
    if (name === '@nestyk/ui/native') return {
      useMobileTheme: () => ({ theme }), MobileIcon: () => null, MobileStatusPill: 'MobileStatusPill', MobileButton: 'MobileButton', MobileInput: 'MobileInput', MobileSectionHeader: 'MobileSectionHeader',
      tokens: load(`${root}/packages/ui/src/theme/tokens.ts`).tokens, getCardElevation: () => ({}),
    };
    if (name === '@nestyk/ui/web-content') return { WebContentContainer: ({ children }) => children };
    if (name === '@nestyk/ui/cookie-consent') return { cookieConsentAllows: () => consentAllows };
    if (name === '@nestyk/feature-search') return { RENT_PRICE_LIMIT: 1000000, RENT_PRICE_PRESETS: [], RENT_PRICE_STEP: 500 };
    if (name === 'react-native-safe-area-context') return { SafeAreaProvider: ({ children }) => children, SafeAreaView: ({ children }) => children, initialWindowMetrics: null };
    if (name === 'expo-image-picker') return {};
    if (name === '@nestyk/feature-listing') return { ...load(`${root}/packages/feature-listing/src/dashboard/types.ts`), MobileRoomDetailBody: 'Detail', AgentRoomDesktopBody: 'DesktopDetail', MobileCreateListingWizardBody: 'Wizard', defaultOwnerListingConfig: {} };
    if (!name.startsWith('.')) return require(name);
    const base = path.resolve(path.dirname(filename), name);
    // A .web.tsx file imports the .web.tsx twin first, like Metro on the web.
    const web = filename.endsWith('.web.tsx') ? [`${base}.web.tsx`] : [];
    return load([base, ...web, `${base}.ts`, `${base}.tsx`].find((file) => fs.existsSync(file) && fs.statSync(file).isFile()));
  };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText)(localRequire, module, module.exports);
  return module.exports;
}
const th = () => load(`${root}/packages/i18n/src/locales/th.ts`).th;
const roomsLib = () => load(path.join(__dirname, '../lib/self-owner-rooms.ts'));
const demo = () => roomsLib().createSelfOwnerRoomsDemo(new Date('2026-11-20T04:00:00Z'));
function nodes(element) {
  if (element == null || typeof element === 'boolean') return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!React.isValidElement(element)) return [element];
  if (typeof element.type === 'function') return nodes(element.type(element.props));
  return [element, ...nodes(element.props.children), ...nodes(element.props.footer)];
}
const texts = (tree) => tree.filter((n) => typeof n === 'string' || typeof n === 'number').map(String);
const label = (node) => texts(nodes(node.props.children)).join('');
const interp = (s, vars) => Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), s);
const webPage = (props) => { hookIndex = 0; return nodes(load(path.join(__dirname, 'self-owner/SelfOwnerRoomsPage.web.tsx')).SelfOwnerRoomsPage({ rooms: demo(), status: 'demo', isDemoPreview: true, ...props })); };
const phone = (props) => { hookIndex = 0; return nodes(load(path.join(__dirname, 'self-owner/MobileSelfOwnerRoomsScreen.tsx')).MobileSelfOwnerRoomsScreen({ rooms: demo(), status: 'demo', isDemoPreview: true, ...props })); };
const byTestId = (tree, id) => tree.find((n) => n?.props?.['data-testid'] === id || n?.props?.testID === id);
const byClass = (tree, name) => tree.filter((n) => n?.props?.className?.split(' ').includes(name));
// WebDialog renders its panel (title, body, buttons) only while open.
const dialogOpen = (tree) => byClass(tree, 'awu-dialog-panel').length === 1;

beforeEach(() => { hooks = []; alerts = []; confirmAnswer = true; consentAllows = false; stored.clear(); roomsLib().selfOwnerRoomStore.reset(new Date('2026-11-20T04:00:00Z')); });

// Rebuilt like the agent rooms page (Jom 20 Nov 2026): row / card opens the room detail modal; edit and publish
// moved into the modal; filters dialog with chips; table / cards switch remembered with consent only.
const detailOpen = (tree) => tree.find((n) => n?.type === 'DesktopDetail');

test('web: add listing is enabled with a callback and calls it', () => {
  let added = 0;
  const tree = webPage({ onAddListing: () => { added += 1; } });
  const button = byClass(tree, 'sor-action')[0];
  assert.equal(!!button.props.disabled, false);
  assert.ok(!label(button).includes(th().selfOwnerDashboard.comingSoon));
  button.props.onClick();
  assert.equal(added, 1);
});

test('web: clicking a row opens the room detail like the agent; closing it returns to the list', () => {
  let tree = webPage({});
  assert.equal(detailOpen(tree), undefined);
  const row = tree.find((n) => n?.type === 'tr' && typeof n.props.onClick === 'function' && texts(nodes(n.props.children)).includes(demo().find((r) => r.id === 'r5').title));
  row.props.onClick();
  tree = webPage({});
  assert.equal(detailOpen(tree).props.room.id, 5);
  byTestId(tree, 'sord-close').props.onClick();
  assert.equal(detailOpen(webPage({})), undefined);
});

test('web: no edit or publish buttons in the rows any more (they are in the modal)', () => {
  const tree = webPage({});
  assert.equal(tree.filter((n) => /^sor-(edit|toggle)-/.test(n?.props?.['data-testid'] ?? '')).length, 0);
});

test('web: cards view like the agent: a card per room, the sort select shows, a card opens the room', () => {
  const so = th();
  let tree = webPage({});
  assert.equal(tree.filter((n) => n?.type === 'select').length, 1);
  const cardsButton = byClass(tree, 'awr-view-btn').find((b) => b.props['aria-label'] === so.agent.listings.web.viewCards);
  cardsButton.props.onClick();
  tree = webPage({});
  assert.equal(byClass(tree, 'awr-card').length, 14);
  assert.equal(byClass(tree, 'awr-table-card').length, 0);
  const selects = tree.filter((n) => n?.type === 'select');
  assert.equal(selects.length, 2);
  assert.deepEqual(nodes(selects[1].props.children).filter((n) => n?.type === 'option').map((o) => o.props.value), ['updated_desc', 'updated_asc', 'rent_asc', 'rent_desc']);
  byTestId(tree, 'sor-card-r14').props.onClick();
  assert.equal(detailOpen(webPage({})).props.room.id, 14);
});

test('web: the view choice is remembered only with the preferences consent', () => {
  const cards = (tree) => byClass(tree, 'awr-view-btn').find((b) => b.props['aria-label'] === th().agent.listings.web.viewCards);
  cards(webPage({})).props.onClick();
  assert.equal(stored.size, 0);
  hooks = [];
  consentAllows = true;
  cards(webPage({})).props.onClick();
  assert.equal(stored.get('nestyk.agentRooms.view'), 'grid');
  hooks = [];
  assert.equal(byClass(webPage({}), 'awr-card').length, 14, 'a new visit opens in the remembered view');
});

test('web: filters dialog: bedrooms and rent range, chips with remove, wrong range blocks the button', () => {
  const listings = th().agent.listings;
  let tree = webPage({});
  byTestId(tree, 'sor-filters').props.onClick();
  tree = webPage({});
  assert.equal(byClass(tree, 'awu-dialog-panel').length, 1);
  byTestId(tree, 'sor-filter-beds').props.onChange({ target: { value: '1' } });
  tree = webPage({});
  byTestId(tree, 'sor-filter-min').props.onChange({ target: { value: '30,000' } });
  tree = webPage({});
  byTestId(tree, 'sor-filter-max').props.onChange({ target: { value: '20000' } });
  tree = webPage({});
  assert.equal(byTestId(tree, 'sor-filter-apply').props.disabled, true, 'min above max');
  assert.ok(texts(tree).includes(listings.filterPriceError));
  byTestId(tree, 'sor-filter-max').props.onChange({ target: { value: '' } });
  tree = webPage({});
  assert.equal(byTestId(tree, 'sor-filter-apply').props.disabled, false);
  byTestId(tree, 'sor-filter-apply').props.onClick();
  tree = webPage({});
  assert.equal(byClass(tree, 'awu-dialog-panel').length, 0);
  const rows = byClass(tree, 'awr-room');
  const expected = demo().filter((r) => r.bedrooms === 1 && r.monthlyRent >= 30000);
  assert.equal(rows.length, expected.length);
  const chips = byClass(tree, 'awr-chip');
  assert.equal(chips.length, 2);
  assert.equal(label(byClass(tree, 'awr-filter-count')[0]), '2');
  chips[0].props.onClick();
  tree = webPage({});
  assert.equal(byClass(tree, 'awr-chip').length, 1);
  byClass(tree, 'awr-clear')[0].props.onClick();
  tree = webPage({});
  assert.equal(byClass(tree, 'awr-chip').length, 0);
  assert.equal(byClass(tree, 'awr-room').length, 14);
});

test('web: publishing from the modal updates the list and its counts', () => {
  let tree = webPage({ rooms: roomsLib().selfOwnerRoomStore.get() });
  tree.find((n) => n?.type === 'tr' && typeof n.props.onClick === 'function' && texts(nodes(n.props.children)).includes(demo().find((r) => r.id === 'r14').title)).props.onClick();
  tree = webPage({ rooms: roomsLib().selfOwnerRoomStore.get() });
  byTestId(tree, 'sord-toggle').props.onClick();
  tree = webPage({ rooms: roomsLib().selfOwnerRoomStore.get() });
  byTestId(tree, 'sord-toggle-confirm').props.onClick();
  const after = roomsLib().selfOwnerRoomStore.get();
  tree = webPage({ rooms: after });
  const counts = roomsLib().countSelfOwnerRooms(after);
  const options = tree.filter((n) => n?.type === 'option').map(label);
  assert.ok(options.some((o) => o.endsWith(`(${counts.listed})`)) && counts.listed === 4);
});

test('phone: add listing button is live with a callback', () => {
  let added = 0;
  const tree = phone({ onAddListing: () => { added += 1; } });
  const button = tree.find((n) => n?.type === 'MobileButton');
  assert.equal(!!button.props.disabled, false);
  assert.ok(!label(button).includes(th().selfOwnerDashboard.comingSoon));
  button.props.onPress();
  assert.equal(added, 1);
});

test('phone: tapping a card opens the room detail like the agent; cards have no publish switch', () => {
  let tree = phone({});
  assert.equal(tree.find((n) => n?.type === 'Detail'), undefined);
  assert.equal(tree.filter((n) => /-toggle$/.test(n?.props?.testID ?? '')).length, 0);
  byTestId(tree, 'so-room-r5').props.onPress();
  tree = phone({});
  assert.equal(tree.find((n) => n?.type === 'Detail').props.room.id, 5);
  tree.find((n) => n?.type === 'MobileSectionHeader').props.onBackPress();
  assert.equal(phone({}).find((n) => n?.type === 'Detail'), undefined);
});

// Final review fix (20 Nov 2026): the page's own surfaces were left as they were.
// 23 Nov 2026: the page uses the agent rooms classes (awr-*, since 20 Nov) and the dead sor-* copies were removed,
// so this checks the rules that style the page now.
test('web css: the self owner page surfaces keep the shell surface colour', () => {
  const page = fs.readFileSync(path.join(__dirname, 'self-owner/SelfOwnerRoomsPage.web.tsx'), 'utf8');
  assert.match(page, /className="awr-search"/);
  const css = fs.readFileSync(path.join(__dirname, 'agent-web/agent-rooms.css'), 'utf8');
  const rule = (selector) => css.slice(css.indexOf(`${selector} {`), css.indexOf('}', css.indexOf(`${selector} {`)));
  assert.match(rule('.awr-search'), /background:\s*var\(--aw-surface\)/);
  assert.match(rule('.awr-search input'), /background:\s*transparent/, 'the search input stays see-through inside its box');
  const own = fs.readFileSync(path.join(__dirname, 'self-owner/self-owner-rooms.css'), 'utf8');
  assert.doesNotMatch(own, /background:\s*transparent/, 'no see-through surface of its own');
});

// Jom 20 Nov 2026: no dark focus ring on a row or card after a mouse click (the modal hands focus back on close).
// A mouse press does not move focus to the row / card; keyboard focus (Tab, Enter) keeps its ring.
test('web: a mouse press on a row or card does not focus it; other presses are left alone', () => {
  const results = (tree) => byClass(tree, 'awr-results')[0];
  const press = (tree, target) => {
    let prevented = 0;
    results(tree).props.onMouseDownCapture({ target, preventDefault: () => { prevented += 1; } });
    return prevented;
  };
  const inside = (selector) => ({ closest: (sel) => (sel === 'tr.awu-row-press, button.awr-card' && selector ? {} : null) });
  let tree = webPage({});
  assert.equal(press(tree, inside(true)), 1, 'table row');
  assert.equal(press(tree, inside(false)), 0, 'a header sort button or anything else');
  byClass(tree, 'awr-view-btn').find((b) => b.props['aria-label'] === th().agent.listings.web.viewCards).props.onClick();
  tree = webPage({});
  assert.equal(press(tree, inside(true)), 1, 'card');
});

test('web: an API room shows its cover photo', () => {
  const tree = webPage({ rooms: [{ ...demo()[5], id: '7', coverUrl: 'https://cdn/c.jpg' }], status: 'available', isDemoPreview: false });
  assert.ok(tree.some((n) => n?.type === 'img' && n.props.src === 'https://cdn/c.jpg'));
});
