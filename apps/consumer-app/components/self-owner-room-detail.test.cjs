// Self owner room detail modal (Jom 20 Nov 2026): like the agent's AgentRoomDetailModal: the agent room detail page
// (no share bar), edit inside the modal, plus publish / unpublish in the header. Web and phone.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

const root = path.resolve(__dirname, '../../..');
const theme = { mode: 'light', background: '#F8FAFC', surface: '#fff', screenTitle: '#211E1E', textSecondary: '#64748B', border: '#E5E7EB', spinner: '#000', textHeading: '#111' };
let hooks = [];
let hookIndex = 0;
let alerts = [];
const fakeReact = {
  ...React,
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useEffect() {},
  useRef: (() => { const refs = []; return (initial) => { const i = hookIndex++; if (!(i in refs)) refs[i] = { current: initial ?? null }; return refs[i]; }; })(),
  useSyncExternalStore: (_s, get) => get(),
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
    if (name === 'expo-constants') return { __esModule: true, default: { expoConfig: { extra: {} } } }; // self-owner-maps-key.ts
    if (name.endsWith('.css')) return {};
    if (name === 'react') return fakeReact;
    if (name === 'react-native') return {
      Modal: ({ visible, children }) => (visible ? children : null), useWindowDimensions: () => ({ width: 1440, height: 900 }), View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator',
      StyleSheet: { create: (v) => v, hairlineWidth: 1 }, Platform: { OS: 'ios' }, Alert: { alert: (...args) => alerts.push(args) },
    };
    if (name === 'react-native-safe-area-context') return { SafeAreaProvider: ({ children }) => children, SafeAreaView: ({ children }) => children, initialWindowMetrics: null };
    if (name === 'expo-image-picker') return {};
    if (name === '@nestyk/i18n') return { useLocale: () => ({ locale: 'th', t: load(`${root}/packages/i18n/src/locales/th.ts`).th }) };
    if (name === '@nestyk/ui/native') return {
      useMobileTheme: () => ({ theme }), MobileIcon: () => null, MobileButton: 'MobileButton', MobileSectionHeader: 'MobileSectionHeader',
      tokens: load(`${root}/packages/ui/src/theme/tokens.ts`).tokens, getCardElevation: () => ({}),
    };
    if (name === '@nestyk/ui/web-content') return { WebContentContainer: ({ children }) => children };
    if (name === '@nestyk/feature-listing') return { MobileRoomDetailBody: 'Detail', AgentRoomDesktopBody: 'DesktopDetail', MobileCreateListingWizardBody: 'Wizard', defaultOwnerListingConfig: {}, interpolate: (s, v) => Object.entries(v).reduce((a, [k, x]) => a.replace(`{${k}}`, String(x)), s) };
    if (!name.startsWith('.')) return require(name);
    const base = path.resolve(path.dirname(filename), name);
    return load([base, `${base}.ts`, `${base}.tsx`].find((file) => fs.existsSync(file) && fs.statSync(file).isFile()));
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
const th = () => load(`${root}/packages/i18n/src/locales/th.ts`).th;
const roomsLib = () => load(path.join(__dirname, '../lib/self-owner-rooms.ts'));
const listingLib = () => load(path.join(__dirname, '../lib/self-owner-listing.ts'));
const now = new Date('2026-11-20T04:00:00Z');
const texts = (tree) => tree.filter((n) => typeof n === 'string' || typeof n === 'number').map(String);
const label = (node) => texts(nodes(node.props.children)).join('');
const byTestId = (tree, id) => tree.find((n) => n?.props?.['data-testid'] === id || n?.props?.testID === id);
const byClass = (tree, name) => tree.filter((n) => n?.props?.className?.split(' ').includes(name));
const room = (id) => roomsLib().selfOwnerRoomStore.get().find((r) => r.id === id);
const web = (props) => { hookIndex = 0; return nodes(load(path.join(__dirname, 'self-owner/SelfOwnerRoomDetailModal.web.tsx')).SelfOwnerRoomDetailModal({ onClose() {}, ...props })); };
const phone = (props) => { hookIndex = 0; return nodes(load(path.join(__dirname, 'self-owner/SelfOwnerRoomDetailModal.tsx')).SelfOwnerRoomDetailModal({ onClose() {}, ...props })); };

beforeEach(() => { hooks = []; alerts = []; roomsLib().selfOwnerRoomStore.reset(now); listingLib().selfOwnerListingDrafts.clear(); });

test('web: closed when no room; open shows the agent desktop detail page without sharing', () => {
  assert.equal(web({ roomId: null }).length, 0);
  const tree = web({ roomId: 'r5' });
  const detail = tree.find((n) => n?.type === 'DesktopDetail');
  assert.equal(detail.props.mode, 'agent');
  assert.equal(detail.props.room.id, 5);
  assert.equal(detail.props.room.listingTitle, room('r5').title);
  assert.equal(detail.props.onShare, undefined);
  assert.equal(tree.find((n) => n?.type === 'h1').props.children, th().agent.listings.details);
});

test('web: edit opens the form in the modal; back steps through the wizard, then returns to the detail', () => {
  let closed = 0;
  const props = { roomId: 'r5', onClose: () => { closed += 1; } };
  let tree = web(props);
  byTestId(tree, 'sord-edit').props.onClick();
  tree = web(props);
  const wizard = tree.find((n) => n?.type === 'Wizard');
  assert.ok(wizard, 'the listing form shows');
  assert.equal(wizard.props.initialData.listingTitle, room('r5').title);
  assert.equal(tree.find((n) => n?.type === 'DesktopDetail'), undefined);
  // The wizard handles back first (a section open): the modal stays in the form.
  wizard.props.backHandlerRef.current = () => true;
  byTestId(tree, 'sord-back').props.onClick();
  tree = web(props);
  assert.ok(tree.find((n) => n?.type === 'Wizard'));
  // Nothing left inside the wizard: back returns to the detail, the modal stays open.
  tree.find((n) => n?.type === 'Wizard').props.backHandlerRef.current = () => false;
  byTestId(tree, 'sord-back').props.onClick();
  tree = web(props);
  assert.ok(tree.find((n) => n?.type === 'DesktopDetail'));
  assert.equal(closed, 0);
  byTestId(tree, 'sord-back').props.onClick();
  assert.equal(closed, 1);
});

test('web: saving in the modal goes back to the detail with the new data', async () => {
  const props = { roomId: 'r5' };
  let tree = web(props);
  byTestId(tree, 'sord-edit').props.onClick();
  tree = web(props);
  const wizard = tree.find((n) => n?.type === 'Wizard');
  await wizard.props.onSubmitListing({ ...wizard.props.initialData, prices: [{ contractTypeId: 2, price: 44000 }] });
  tree = web(props);
  const detail = tree.find((n) => n?.type === 'DesktopDetail');
  assert.ok(detail);
  assert.equal(detail.props.room.prices[0].price, 44000);
});

test('web: publish / unpublish in the header asks first; rented rooms have no switch', () => {
  const so = th().selfOwnerRooms;
  const props = { roomId: 'r5' };
  let tree = web(props);
  const toggle = byTestId(tree, 'sord-toggle');
  assert.equal(label(toggle), so.unpublish);
  toggle.props.onClick();
  tree = web(props);
  assert.equal(byClass(tree, 'awu-dialog-panel').length, 1);
  assert.equal(room('r5').state, 'listed');
  byTestId(tree, 'sord-toggle-confirm').props.onClick();
  assert.equal(room('r5').state, 'unlisted');
  tree = web(props);
  assert.equal(label(byTestId(tree, 'sord-toggle')), so.publish);
  assert.equal(byTestId(web({ roomId: 'r1' }), 'sord-toggle'), undefined);
});

test('web: a room that is gone shows a message, not a blank modal', () => {
  const tree = web({ roomId: 'r99' });
  assert.ok(texts(tree).includes(th().selfOwnerRooms.noMatch));
});

test('phone: header with back and edit, the detail without sharing, publish asks with an alert', () => {
  const so = th().selfOwnerRooms;
  let closed = 0;
  const props = { roomId: 'r14', onClose: () => { closed += 1; } };
  let tree = phone(props);
  const header = tree.find((n) => n?.type === 'MobileSectionHeader');
  assert.equal(header.props.title, th().agent.listings.details);
  assert.equal(header.props.actionLabel, th().agent.listings.edit);
  const detail = tree.find((n) => n?.type === 'Detail');
  assert.equal(detail.props.onShare, undefined);
  const toggle = byTestId(tree, 'sord-toggle');
  assert.equal(label(toggle), so.publish);
  toggle.props.onPress();
  const [title, , buttons] = alerts[0];
  assert.equal(title, so.publish);
  buttons.find((b) => b.style !== 'cancel').onPress();
  assert.equal(room('r14').state, 'listed');
  header.props.onActionPress();
  tree = phone(props);
  assert.ok(tree.find((n) => n?.type === 'Wizard'));
  tree.find((n) => n?.type === 'MobileSectionHeader').props.onBackPress();
  tree = phone(props);
  assert.ok(tree.find((n) => n?.type === 'Detail'));
  tree.find((n) => n?.type === 'MobileSectionHeader').props.onBackPress();
  assert.equal(closed, 1);
});

// Review fix (20 Nov 2026): Escape in the publish confirm closes only the confirm, never the room modal.
function escape(tree, { dialogOpen }) {
  const section = tree.find((n) => n?.props?.className?.split(' ').includes('ard-dialog'));
  let stopped = 0;
  const event = {
    key: 'Escape', target: {}, stopPropagation: () => { stopped += 1; },
    currentTarget: { contains: () => true, querySelector: (sel) => (dialogOpen && sel.includes('dialog[open]') ? {} : null) },
  };
  section.props.onKeyDownCapture(event);
  section.props.onKeyUpCapture(event);
  return stopped;
}

test('web: Escape in the publish confirm keeps the room modal open', () => {
  let closed = 0;
  const props = { roomId: 'r5', onClose: () => { closed += 1; } };
  let tree = web(props);
  byTestId(tree, 'sord-toggle').props.onClick();
  tree = web(props);
  assert.equal(escape(tree, { dialogOpen: true }), 1);
  assert.equal(closed, 0);
  // The modal's own close request (RN Web listens for Escape too) closes the confirm first.
  hookIndex = 0;
  const modalProps = load(path.join(__dirname, 'self-owner/SelfOwnerRoomDetailModal.web.tsx')).SelfOwnerRoomDetailModal(props).props;
  modalProps.onRequestClose();
  assert.equal(closed, 0);
  tree = web(props);
  assert.equal(byClass(tree, 'awu-dialog-panel').length, 0);
  // With no confirm open, Escape goes back (here: closes the modal).
  escape(tree, { dialogOpen: false });
  assert.equal(closed, 1);
});

test('the room modal hands the owner contact to the edit form (web and phone)', () => {
  const owner = { name: 'Jom', phone: '0811111111' };
  let tree = web({ roomId: 'r5', ownerContact: owner });
  byTestId(tree, 'sord-edit').props.onClick();
  tree = web({ roomId: 'r5', ownerContact: owner });
  assert.deepEqual(tree.find((n) => n?.type === 'Wizard').props.ownerContact, owner);
  hooks = [];
  tree = phone({ roomId: 'r5', ownerContact: owner });
  tree.find((n) => n?.type === 'MobileSectionHeader').props.onActionPress();
  tree = phone({ roomId: 'r5', ownerContact: owner });
  assert.deepEqual(tree.find((n) => n?.type === 'Wizard').props.ownerContact, owner);
});

// Connected to the self owner API (20 Nov 2026, D4): the modal loads the room's form data, publishing asks the API.
const settle = () => new Promise((r) => setImmediate(r));
function apiRoom(over = {}) {
  return { id: '7', title: 'ห้อง 3305', project: 'Ideo Q', monthlyRent: 19000, state: 'unlisted', bedrooms: 1, sizeSqm: 33, updatedAt: now.toISOString(), ...over };
}
function apiForm(photos) {
  return {
    visibility: 'private', listingTitle: 'ห้อง 3305', listingSourceCode: 'owner', isScoutRoom: true, documents: [],
    property: { name: 'Ideo Q', address: 'x', district: 'd', province: 'p', propertyTypeId: 9 }, roomTypeId: 41,
    prices: [{ contractTypeId: 31, price: 19000 }], advanceRentMonths: 1, depositMonths: 2, layout: [{ code: 'bedroom', value: '1' }],
    facilities: [], medias: Array.from({ length: photos }, (_, i) => ({ mediaUrl: `https://cdn/${i}.jpg`, category: 'room', sortOrder: i })),
    contact: { name: 'Jom', phone: '081' },
  };
}
async function connect({ photos = 5, detail, visibility } = {}) {
  const seen = [];
  const backend = {
    seen,
    list: async () => [apiRoom()],
    detail: detail ?? (async (id) => { seen.push(['detail', id]); return apiForm(photos); }),
    options: async () => ({ propertyTypes: [{ id: 9, code: 'condo' }], contractTypes: [{ id: 31, code: 'twelve_months', termMonths: 12 }], roomTypes: [{ id: 41, code: 'one_bedroom', bedroomCount: 1 }], facilities: [] }),
    setVisibility: visibility ?? (async (id, v) => { seen.push(['visibility', id, v]); return v === 'published' ? 'listed' : 'unlisted'; }),
    save: async () => '7',
    uploadPhoto: async () => '',
  };
  roomsLib().selfOwnerRoomStore.connect(backend, 'u1');
  await settle();
  return backend;
}
async function withEffects(fn) {
  const before = fakeReact.useEffect;
  fakeReact.useEffect = (effect) => { effect(); };
  try { return await fn(); } finally { fakeReact.useEffect = before; }
}

test('connected web: loads the form data, then shows the detail with the API lease lengths', () => withEffects(async () => {
  const backend = await connect();
  let tree = web({ roomId: '7' });
  assert.equal(tree.find((n) => n?.type === 'DesktopDetail'), undefined, 'nothing to show until the room is loaded');
  assert.equal(byTestId(tree, 'sord-edit'), undefined, 'no edit before the form data is here');
  await settle();
  tree = web({ roomId: '7' });
  const detail = tree.find((n) => n?.type === 'DesktopDetail');
  assert.equal(detail.props.room.prices[0].termMonths, 12);
  assert.equal(detail.props.room.roomTypeCode, 'one_bedroom');
  // Read from the API (the harness runs effects on every render, so count is not checked; 23 Nov 2026: no session cache).
  assert.ok(backend.seen.length >= 1 && backend.seen.every(([k, id]) => k === 'detail' && id === '7'));
}));

test('connected web: a failed load says so', () => withEffects(async () => {
  await connect({ detail: async () => { throw new Error('down'); } });
  web({ roomId: '7' });
  await settle();
  assert.ok(texts(web({ roomId: '7' })).includes(th().selfOwnerRooms.detailLoadError));
}));

test('connected web: publish needs 5 photos; the API decides, and a refusal stays in the confirm', () => withEffects(async () => {
  const so = th().selfOwnerRooms;
  let backend = await connect({ photos: 4 });
  web({ roomId: '7' });
  await settle();
  byTestId(web({ roomId: '7' }), 'sord-toggle').props.onClick();
  byTestId(web({ roomId: '7' }), 'sord-toggle-confirm').props.onClick();
  await settle();
  assert.ok(texts(web({ roomId: '7' })).includes(so.publishNeedsPhotos));
  assert.equal(backend.seen.some(([k]) => k === 'visibility'), false, 'not sent when the room has too few photos');

  await settle(); // the last render's load finishes before the next room set
  hooks = [];
  roomsLib().selfOwnerRoomStore.reset(now);
  listingLib().selfOwnerListingDrafts.clear();
  backend = await connect({ photos: 5 });
  web({ roomId: '7' });
  await settle();
  byTestId(web({ roomId: '7' }), 'sord-toggle').props.onClick();
  byTestId(web({ roomId: '7' }), 'sord-toggle-confirm').props.onClick();
  await settle();
  assert.deepEqual(backend.seen.at(-1), ['visibility', '7', 'published']);
  assert.equal(room('7').state, 'listed');
  assert.equal(byClass(web({ roomId: '7' }), 'awu-dialog-panel').length, 0, 'the confirm closes');

  await settle(); // the last render's load finishes before the next room set
  hooks = [];
  roomsLib().selfOwnerRoomStore.reset(now);
  listingLib().selfOwnerListingDrafts.clear();
  await connect({ photos: 5, visibility: async () => { throw new Error('409'); } });
  web({ roomId: '7' });
  await settle();
  byTestId(web({ roomId: '7' }), 'sord-toggle').props.onClick();
  byTestId(web({ roomId: '7' }), 'sord-toggle-confirm').props.onClick();
  await settle();
  const tree = web({ roomId: '7' });
  assert.ok(texts(tree).includes(so.toggleFailed));
  assert.equal(room('7').state, 'unlisted');
}));

test('connected phone: too few photos or a refusal is said with an alert', () => withEffects(async () => {
  const so = th().selfOwnerRooms;
  await connect({ photos: 2 });
  phone({ roomId: '7' });
  await settle();
  byTestId(phone({ roomId: '7' }), 'sord-toggle').props.onPress();
  alerts[0][2].find((b) => b.style !== 'cancel').onPress();
  await settle();
  assert.equal(alerts[1][1], so.publishNeedsPhotos);
}));

// Review fix (20 Nov 2026): publish waits for the room's photos to be known (loading or failed: no switch).
test('connected: no publish switch while the room loads or after it failed to load', () => withEffects(async () => {
  await connect({ detail: () => new Promise(() => {}) });
  assert.equal(byTestId(web({ roomId: '7' }), 'sord-toggle'), undefined);
  assert.equal(byTestId(phone({ roomId: '7' }), 'sord-toggle'), undefined);
  hooks = [];
  roomsLib().selfOwnerRoomStore.reset(now);
  await connect({ detail: async () => { throw new Error('down'); } });
  web({ roomId: '7' });
  await settle();
  assert.equal(byTestId(web({ roomId: '7' }), 'sord-toggle'), undefined);
}));

// Follow-up (23 Nov 2026): the API's reason codes become the owner's own words; a room rented meanwhile reloads the list.
test('connected web: a refusal with a reason code says that reason', () => withEffects(async () => {
  const so = th().selfOwnerRooms;
  const refuse = (code) => async () => { throw Object.assign(new Error('english from the API'), { status: code === 'ROOM_RENTED' ? 409 : 400, code }); };
  for (const [code, words] of [['ROOM_RENTED', so.occupiedNoToggle], ['PUBLISH_NEEDS_PHOTOS', so.publishNeedsPhotos]]) {
    await settle();
    hooks = [];
    roomsLib().selfOwnerRoomStore.reset(now);
    listingLib().selfOwnerListingDrafts.clear();
    const backend = await connect({ photos: 5, visibility: refuse(code) });
    let lists = 0;
    backend.list = async () => { lists += 1; return [apiRoom()]; };
    web({ roomId: '7' });
    await settle();
    byTestId(web({ roomId: '7' }), 'sord-toggle').props.onClick();
    byTestId(web({ roomId: '7' }), 'sord-toggle-confirm').props.onClick();
    await settle();
    assert.ok(texts(web({ roomId: '7' })).includes(words), code);
    assert.equal(lists, code === 'ROOM_RENTED' ? 1 : 0, `${code}: the list reloads only when the room changed meanwhile`);
  }
}));

test('connected phone: a rented room refusal is said with an alert in the owner words', () => withEffects(async () => {
  const so = th().selfOwnerRooms;
  await connect({ photos: 5, visibility: async () => { throw Object.assign(new Error('x'), { code: 'ROOM_RENTED' }); } });
  phone({ roomId: '7' });
  await settle();
  byTestId(phone({ roomId: '7' }), 'sord-toggle').props.onPress();
  alerts[0][2].find((b) => b.style !== 'cancel').onPress();
  await settle();
  assert.equal(alerts[1][1], so.occupiedNoToggle);
}));

// Follow-up (23 Nov 2026): every time the room opens it is read again from the API (it may have been edited on
// another device); edit waits for that, so a save never sends an older copy over a newer one.
test('connected: reopening a room reads it again before edit is offered', () => withEffects(async () => {
  let price = 19000;
  const backend = await connect({
    detail: async () => ({ ...apiForm(5), prices: [{ contractTypeId: 31, price }] }),
  });
  web({ roomId: '7' });
  await settle();
  assert.equal(web({ roomId: '7' }).find((n) => n?.type === 'DesktopDetail').props.room.prices[0].price, 19000);
  web({ roomId: null }); // closed
  price = 25000; // edited on another device
  let tree = web({ roomId: '7' });
  assert.equal(byTestId(tree, 'sord-edit'), undefined, 'no edit until the room is read again');
  await settle();
  tree = web({ roomId: '7' });
  assert.equal(tree.find((n) => n?.type === 'DesktopDetail').props.room.prices[0].price, 25000);
  byTestId(tree, 'sord-edit').props.onClick();
  assert.equal(web({ roomId: '7' }).find((n) => n?.type === 'Wizard').props.initialData.prices[0].price, 25000);
  assert.ok(backend);
}));

// Browser check 23 Nov 2026 (390 px wide): the header title broke into three lines beside the buttons. Under the web
// shell width the buttons show only their icons (the label stays for screen readers) and the title keeps one line.
test('web: on a narrow window the header buttons show icons only and the title stays on one line', () => {
  const so = th().selfOwnerRooms;
  const tree = web({ roomId: 'r5' });
  assert.ok(byClass(tree, 'sord-header').length === 1);
  for (const id of ['sord-toggle', 'sord-edit']) {
    const button = byTestId(tree, id);
    assert.equal(byClass(nodes(button.props.children), 'sord-btn-label').length, 1, id);
    assert.ok(button.props['aria-label'], `${id} keeps a name when its label is hidden`);
  }
  assert.equal(byTestId(tree, 'sord-toggle').props['aria-label'], so.unpublish);
  const css = fs.readFileSync(path.join(__dirname, 'self-owner/self-owner-rooms.css'), 'utf8');
  const narrow = css.slice(css.indexOf('@media (max-width: 767px)'));
  assert.ok(css.includes('@media (max-width: 767px)'));
  assert.match(narrow, /\.sord-header \.sord-btn-label\s*\{[^}]*display:\s*none/);
  assert.match(narrow, /\.sord-header \.ard-header-title h1\s*\{[^}]*white-space:\s*nowrap/);
  assert.match(fs.readFileSync(path.join(__dirname, 'self-owner/SelfOwnerRoomDetailModal.web.tsx'), 'utf8'), /import ["']\.\/self-owner-rooms\.css["']/);
});

// Jom 23 Nov 2026: the room detail's internal card uses the owner's words (no team, no share page).
test('web and phone: the detail gets the owner words for its internal card', () => {
  const so = th().selfOwnerRooms;
  const state = th().selfOwnerDashboard.roomState;
  const expected = { hint: so.internalHint, titleLabel: so.titleField, visibilityLabel: so.internalVisibility, publishedLabel: state.listed, privateLabel: state.unlisted };
  assert.equal(state.listed, 'ประกาศอยู่');
  assert.equal(state.unlisted, 'ยังไม่ประกาศ');
  assert.deepEqual(web({ roomId: 'r5' }).find((n) => n?.type === 'DesktopDetail').props.ownerInternalCopy, expected);
  assert.deepEqual(phone({ roomId: 'r5' }).find((n) => n?.type === 'Detail').props.ownerInternalCopy, expected);
  for (const l of ['en', 'ja', 'zh']) {
    const copy = load(`${root}/packages/i18n/src/locales/${l}.ts`)[l].selfOwnerRooms;
    assert.ok(copy.internalHint && copy.internalVisibility, l);
  }
  assert.doesNotMatch(so.internalHint, /ทีม|แชร์/);
});
