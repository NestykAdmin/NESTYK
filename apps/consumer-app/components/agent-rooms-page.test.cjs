// Plan step 4 (Mos 4 Nov 2026): agent web Room Listings page (table / cards, filters, pager). Phone screen untouched.
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
const stubs = {
  '../AgentRoomDetailModal': { AgentRoomDetailModal: 'AgentRoomDetailModal' },
  '../AgentRoomsScreen': { AgentRoomsScreen: 'AgentRoomsScreen' },
  '../../lib/agent-listings-api': { fetchMyAgentListings: () => new Promise(() => {}) },
};
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const localRequire = (name) => {
    if (name.endsWith('.css')) return {};
    if (stubs[name]) return stubs[name];
    if (name === 'react') return { ...React, useEffect() {}, useMemo: (fn) => fn(), useRef: () => ({ current: null }), useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], (value) => { state[index] = value; }];
    } };
    if (name === '@nestyk/i18n') return { useLocale: () => ({ locale: 'en', t: load(`${root}/packages/i18n/src/locales/en.ts`).en }), localizedError: (_e, fallback) => fallback };
    if (name === '@nestyk/ui/native') return { useMobileTheme: () => ({ theme }), MobileIcon: 'MobileIcon', MobileStatusPill: 'MobileStatusPill', MobileFilterChip: 'MobileFilterChip' };
    if (name === '@nestyk/feature-listing') return load(`${root}/packages/feature-listing/src/bedroom-label.ts`);
    // room-price-range.ts reads the shared monthly-rent scale from here.
    if (name === '@nestyk/feature-search') return load(`${root}/packages/feature-search/src/price-range.ts`);
    if (name === '@nestyk/ui/cookie-consent') return load(`${root}/packages/ui/src/consent/cookieConsent.ts`);
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
const en = load(`${root}/packages/i18n/src/locales/en.ts`).en;
const { AgentRoomsPage } = load(path.join(__dirname, 'agent-web/AgentRoomsPage.web.tsx'));
const { EMPTY_ROOM_FILTERS } = load(path.join(__dirname, '../lib/agent-room-filters.ts'));

// useState order in AgentRoomsPage: query, search, filters, draft, filterOpen, apiSort, view, page, items, total, status, busy, errorText, refresh, selected.
const SLOT = { filters: 2, view: 6, page: 7, items: 8, total: 9, status: 10 };
function render(seed = {}, props = {}) {
  state = [];
  cursor = 0;
  for (const [key, value] of Object.entries(seed)) state[SLOT[key]] = value;
  globalThis.window = { localStorage: { getItem: () => null, setItem() {} } };
  return nodes(React.createElement(AgentRoomsPage, props));
}
const cls = (tree, name) => tree.filter((node) => node?.props?.className?.split?.(' ').includes(name));
const strings = (tree) => tree.filter((node) => typeof node === 'string');

function room(id, extra = {}) {
  return {
    id,
    listingTitle: `Room ${id}`,
    visibility: 'published',
    isScoutRoom: true,
    roomStatusCode: 'available',
    property: { id: 1, name: 'Ari Place', district: 'Phaya Thai', province: 'Bangkok' },
    propertyOwner: null,
    prices: [{ contractTypeCode: 'monthly', price: 15000 }, { contractTypeCode: 'yearly', price: 14000 }],
    coverMediaUrl: null,
    roomTypeCode: 'two_bedroom',
    roomSizeSqm: '60',
    floor: '8',
    updatedAt: '2026-11-01T03:00:00Z',
    ...extra,
  };
}

test('first load: table with skeleton rows, no pager, toolbar ready', () => {
  const tree = render();
  const table = tree.find((node) => node?.type === 'table');
  assert.equal(table.props['aria-label'], en.agent.listings.web.tableLabel);
  assert.equal(table.props['aria-busy'], true);
  assert.equal(cls(tree, 'awr-pager').length, 0);
  assert.ok(tree.find((node) => node?.props?.['data-testid'] === 'rooms.search'));
  assert.ok(tree.find((node) => node?.props?.['data-testid'] === 'rooms.status'));
  const headers = tree.filter((node) => node?.type === 'th').map((th) => strings(nodes(th.props.children)).join(''));
  for (const label of ['colRoom', 'colPrice', 'colStatus', 'colUpdated']) assert.ok(headers.some((h) => h.includes(en.agent.listings.web[label])), label);
});

test('rows show the lowest price, type, size and status; a row opens the room', () => {
  const tree = render({ items: [room(1), room(2, { prices: [], roomStatusCode: 'booked', visibility: 'private' })], total: 2, status: 'ready' });
  const text = strings(tree);
  assert.ok(text.includes('฿14,000'));
  assert.ok(text.includes(en.masters.roomTypes.two_bedroom));
  assert.ok(text.includes('60 sqm · Floor 8'));
  assert.ok(tree.some((node) => node?.props?.label === en.agent.listings.booked));
  assert.ok(text.includes(en.agent.createRoom.visibilityPrivate));
  const rows = tree.filter((node) => node?.type === 'tr' && node.props.onClick);
  assert.equal(rows.length, 2);
  rows[1].props.onClick();
  assert.equal(state[14], 2);
});

test('pager: range text and page buttons; one page has no buttons', () => {
  let tree = render({ items: [room(1)], total: 36, status: 'ready', page: 2 });
  assert.ok(strings(tree).includes('25–36 of 36'));
  const current = tree.find((node) => node?.props?.['aria-current'] === 'page');
  assert.equal(current.props.children, '2');
  tree = render({ items: [room(1)], total: 5, status: 'ready' });
  assert.ok(strings(tree).includes('1–5 of 5'));
  assert.equal(cls(tree, 'awr-page-btn').length, 0);
});

test('card view: one card per room in a list, and the sort select appears', () => {
  const tree = render({ items: [room(1), room(2), room(3)], total: 3, status: 'ready', view: 'grid' });
  assert.equal(cls(tree, 'awr-card').length, 3);
  assert.equal(tree.filter((node) => node?.type === 'table').length, 0);
  assert.ok(tree.find((node) => node?.props?.['aria-label'] === en.agent.listings.sortTitle));
});

test('a room type with fixed bedrooms is one chip; removing it clears both', () => {
  const filters = { ...EMPTY_ROOM_FILTERS, roomType: 'two_bedroom', bedrooms: '2', visibility: 'private' };
  const tree = render({ filters, items: [room(1)], total: 1, status: 'ready' });
  const chips = cls(tree, 'awr-chip');
  assert.equal(chips.length, 2);
  chips[0].props.onClick();
  assert.deepEqual(state[2], { ...filters, roomType: '', bedrooms: '' });
  const count = cls(tree, 'awr-filter-count')[0];
  assert.equal(count.props.children, 2);
});

test('empty account: "No rooms yet" with Add room; a search with no match: clear filters', () => {
  let added = 0;
  let tree = render({ items: [], total: 0, status: 'ready' }, { onAddRoom: () => added++ });
  assert.ok(strings(tree).includes(en.agent.listings.web.emptyTitle));
  tree.find((node) => node?.type === 'button' && node.props.children === en.agent.listings.addRoom).props.onClick();
  assert.equal(added, 1);
  tree = render({ items: [], total: 0, status: 'ready', filters: { ...EMPTY_ROOM_FILTERS, roomStatus: 'rented' } });
  assert.ok(strings(tree).includes(en.agent.dashboard.webStates.filteredTitle));
});

test('wiring: desktop agent web uses the page, phone keeps the app screen', () => {
  const index = fs.readFileSync(path.join(__dirname, '../app/index.tsx'), 'utf8');
  assert.match(index, /if \(isAgentWeb\) \{\s*return \(\s*<AgentRoomsPage[\s\S]*?onAddRoom=\{openCreateListing\}/);
  const native = load(path.join(__dirname, 'agent-web/AgentRoomsPage.tsx'));
  const element = native.AgentRoomsPage({ reloadToken: 3 });
  assert.equal(element.type, 'AgentRoomsScreen');
  assert.equal(element.props.reloadToken, 3);
  for (const code of ['th', 'ja', 'zh']) {
    const web = load(`${root}/packages/i18n/src/locales/${code}.ts`)[code].agent.listings.web;
    assert.deepEqual(Object.keys(web), Object.keys(en.agent.listings.web), code);
    assert.ok(Object.values(web).every((value) => typeof value === 'string' && value.length), code);
  }
});
