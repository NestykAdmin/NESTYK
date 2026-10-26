const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const root = path.resolve(__dirname, '../../..');
let current;
const cache = new Map();
const api = { create() {}, list() {}, revoke() {} };
const theme = { mode: 'light', background: '#F8FAFC', surface: '#fff', screenTitle: '#1A2B48', textSecondary: '#64748B', border: '#E5E7EB' };
const hooks = { ...React,
  useId() { const h = current, i = h.cursor++; return h.slots[i] ??= `share-title-${i}`; },
  useState(initial) {
    const h = current, i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = typeof initial === 'function' ? initial() : initial;
    return [h.slots[i], value => { h.slots[i] = typeof value === 'function' ? value(h.slots[i]) : value; }];
  },
  useRef(initial) { const h = current, i = h.cursor++; return h.slots[i] ??= { current: initial }; },
  useCallback(callback) { return callback; },
  useMemo(callback) { return callback(); },
  useEffect(callback, deps) {
    const h = current, i = h.cursor++;
    const previous = h.effects[i];
    if (!previous || deps.some((value, n) => value !== previous.deps[n])) {
      previous?.cleanup?.();
      h.pending.push(() => { h.effects[i] = { deps, cleanup: callback() }; });
    }
  },
};
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const localRequire = name => {
    if (name.endsWith('.css')) return {};
    if (name === 'react') return hooks;
    if (name === 'expo-constants') return { expoConfig: { extra: { webGoogleMapsApiKey: 'website-config-key' } } };
    if (name === 'react-native') return { Modal: 'Modal', View: 'View', StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width: current.width ?? 390, height: 900 }) };
    if (name === '@nestyk/i18n') return { useLocale: () => ({ locale: 'en', t: load(`${root}/packages/i18n/src/locales/en.ts`).en }), localizedError: (_error, fallback) => fallback };
    if (name === '@nestyk/ui/native') return { MobileIcon: 'Icon', useMobileTheme: () => ({ theme }) };
    if (name === '@nestyk/ui/web-content') return { WebContentContainer: 'Container' };
    if (name === '@nestyk/feature-listing') return { MobileAgentRoomBody: 'RoomBody' };
    if (name === './AgentRoomEditor') return { AgentRoomEditor: 'Editor' };
    if (name === './AgentRoomDesktopBody') return { AgentRoomDesktopBody: 'DesktopBody' };
    if (name === './RoomShareLinkSheet') return { RoomShareLinkSheet: 'ShareSheet' };
    if (name === '../lib/agent-listings-api') return { fetchAgentRoom: id => current.fetch(id), createRoomShareLink: api.create, listRoomShareLinks: api.list, revokeRoomShareLink: api.revoke };
    if (!name.startsWith('.')) return require(name);
    const base = path.resolve(path.dirname(filename), name);
    return load([base, `${base}.ts`, `${base}.tsx`].find(file => fs.existsSync(file) && fs.statSync(file).isFile()));
  };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText)(localRequire, module, module.exports);
  return module.exports;
}
function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!React.isValidElement(value)) return [];
  return [value, ...nodes(value.props.children)];
}
function harness(filename, exported, props) {
  const h = { slots: [], effects: [], pending: [], props, cursor: 0, fetch: async id => ({ id }) };
  h.render = () => {
    current = h; h.cursor = 0;
    const element = load(filename)[exported](h.props);
    h.pending.splice(0).forEach(effect => effect());
    return nodes(element);
  };
  return h;
}
const modalPath = path.join(__dirname, 'AgentRoomDetailModal.web.tsx');
const bodyPath = `${root}/packages/feature-listing/src/components/MobileAgentRoomBody.web.tsx`;
const find = (tree, type) => tree.find(node => node.type === type);

test('desktop detail loads through existing API, keeps edit/save callbacks and blocks back while saving', async () => {
  let closed = 0, saved = 0;
  const h = harness(modalPath, 'AgentRoomDetailModal', { roomId: 17, onClose: () => closed++, onSaved: () => saved++ });
  assert.equal(find(h.render(), 'Modal').props.visible, true);
  await Promise.resolve();
  const body = find(h.render(), 'RoomBody');
  assert.equal(body.props.room.id, 17);
  assert.equal(body.props.mapsApiKey, 'website-config-key');
  assert.deepEqual(body.props.shareLinkApi, api);
  body.props.onEdit();
  let tree = h.render();
  find(tree, 'Editor').props.onBusy(true);
  find(h.render(), 'Modal').props.onRequestClose();
  assert.equal(closed, 0);
  tree = h.render();
  find(tree, 'Editor').props.onBusy(false);
  find(tree, 'Editor').props.onSaved({ promoCopyStale: true });
  assert.equal(saved, 1);
  assert.equal(find(h.render(), 'Editor'), undefined);
  await Promise.resolve();
  find(h.render(), 'Modal').props.onRequestClose();
  assert.equal(closed, 1);
});

test('stale room responses never replace a newly selected room', async () => {
  const requests = new Map();
  const h = harness(modalPath, 'AgentRoomDetailModal', { roomId: 1, onClose() {} });
  h.fetch = id => new Promise(resolve => requests.set(id, resolve));
  h.render();
  h.props = { ...h.props, roomId: 2 };
  assert.equal(find(h.render(), 'RoomBody'), undefined);
  requests.get(2)({ id: 2 }); await Promise.resolve();
  assert.equal(find(h.render(), 'RoomBody').props.room.id, 2);
  requests.get(1)({ id: 1 }); await Promise.resolve();
  assert.equal(find(h.render(), 'RoomBody').props.room.id, 2);
});

test('Escape closes a photo before the room and ignores events from a portalled share sheet', () => {
  let closed = 0, stopped = 0;
  const h = harness(modalPath, 'AgentRoomDetailModal', { roomId: 17, onClose: () => closed++ });
  const section = find(h.render(), 'section');
  let photoOpen = true;
  const currentTarget = { contains: () => true, querySelector: () => photoOpen ? {} : null };
  const event = { key: 'Escape', currentTarget, target: {}, stopPropagation() { stopped++; } };
  section.props.onKeyDownCapture(event);
  photoOpen = false;
  section.props.onKeyUpCapture(event);
  assert.equal(closed, 0);
  assert.equal(stopped, 1);
  section.props.onKeyUpCapture({ ...event, currentTarget: { contains: () => false } });
  assert.equal(closed, 0);
  section.props.onKeyDownCapture(event);
  section.props.onKeyUpCapture(event);
  assert.equal(closed, 1);
});

test('desktop share preview uses exactly the selected visibility and the existing share API', () => {
  const visibility = { photos: true, price: false, facilities: false, location: false, contact: false };
  const room = { id: 17, property: null, layout: [], prices: [], medias: [], facilities: [], contacts: [], nearbyPlaces: [] };
  const h = harness(bodyPath, 'MobileAgentRoomBody', { room, shareLinkApi: api });
  find(h.render(), 'DesktopBody').props.onShare();
  let tree = h.render();
  assert.equal(find(tree, 'ShareSheet').props.visible, true);
  assert.equal(find(tree, 'ShareSheet').props.api, api);
  find(tree, 'ShareSheet').props.onPreview(visibility, 5);
  tree = h.render();
  assert.equal(find(tree, 'ShareSheet'), undefined);
  assert.equal(find(tree, 'DesktopBody').props.mode, 'preview');
  assert.deepEqual(find(tree, 'DesktopBody').props.shareVisibility, visibility);
  assert.equal(find(tree, 'DesktopBody').props.shareContactId, 5);
});

test('a desktop room opens a desktop share dialog instead of the mobile bottom sheet', () => {
  const room = { id: 17, property: null, layout: [], prices: [], medias: [], facilities: [], contacts: [], nearbyPlaces: [] };
  const h = harness(bodyPath, 'MobileAgentRoomBody', { room, shareLinkApi: api });
  h.width = 1280;
  find(h.render(), 'DesktopBody').props.onShare();
  const tree = h.render();
  const dialog = tree.find(node => node.type?.name === 'AgentRoomShareDialog');
  assert.ok(dialog, 'Desktop sharing must open the desktop dialog');
  assert.equal(dialog.props.visible, true);
  assert.equal(find(tree, 'ShareSheet'), undefined);
  dialog.props.onClose();
  assert.equal(h.render().find(node => node.type?.name === 'AgentRoomShareDialog').props.visible, false);
});

const shareDialogPath = `${root}/packages/feature-listing/src/components/AgentRoomShareDialog.web.tsx`;
const shareRoom = { id: 17, property: null, layout: [], prices: [], medias: [], facilities: [], contacts: [], nearbyPlaces: [] };
const copy = () => load(`${root}/packages/i18n/src/locales/en.ts`).en.agent.roomDetail;
const button = (tree, label) => tree.find(node => node.type === 'button' && nodesText(node.props.children) === label);
function nodesText(value) {
  if (Array.isArray(value)) return value.map(nodesText).join('');
  if (React.isValidElement(value)) return nodesText(value.props.children);
  return value == null || typeof value === 'boolean' ? '' : String(value);
}

test('desktop sharing sends the selected expiry and visibility without internal contact data', async () => {
  const calls = [];
  const shareApi = { list: async () => ({ items: [] }), create: async (...args) => {
    calls.push(args);
    return { id: 1, url: 'https://example.com/s/room', expiresAt: '2027-01-01T00:00:00Z', status: 'active' };
  } };
  const h = harness(shareDialogPath, 'AgentRoomShareDialog', { visible: true, room: shareRoom, api: shareApi, onClose() {}, onPreview() {} });
  h.render(); await Promise.resolve();
  let tree = h.render();
  tree.find(node => node.type === 'input' && node.props.name === 'price').props.onChange();
  tree.find(node => node.type === 'input' && node.props.value === 14).props.onChange();
  tree = h.render();
  await button(tree, copy().shareCreateLink).props.onClick();
  assert.deepEqual(calls, [[17, { expiresInDays: 14, shareSections: { photos: true, price: false, facilities: true, location: true, contact: false }, contactId: null }]]);
  assert.ok(h.render().some(node => node.type === 'input' && node.props.value === 'https://example.com/s/room'));
});

test('desktop preview keeps selection and Escape closes only the share dialog', async () => {
  let closed = 0, stopped = 0, prevented = 0, preview;
  const h = harness(shareDialogPath, 'AgentRoomShareDialog', { visible: true, room: shareRoom, api: { list: async () => ({ items: [] }) }, onClose() { closed++; }, onPreview(...args) { preview = args; } });
  h.render(); await Promise.resolve();
  let tree = h.render();
  tree.find(node => node.type === 'input' && node.props.name === 'location').props.onChange();
  button(h.render(), copy().sharePreviewCta).props.onClick();
  assert.deepEqual(preview, [{ photos: true, price: true, facilities: true, location: false, contact: false }, null]);
  assert.equal(closed, 1);
  const dialog = find(h.render(), 'dialog');
  dialog.props.onKeyDown({ key: 'Escape', preventDefault() { prevented++; }, stopPropagation() { stopped++; } });
  assert.equal(closed, 1, 'Keep focus in the share dialog until keyup so the parent modal cannot receive Escape');
  assert.equal(prevented, 1);
  dialog.props.onKeyUp({ key: 'Escape', stopPropagation() { stopped++; } });
  assert.equal(closed, 2);
  assert.equal(stopped, 2);
});

test('desktop link revocation requires confirmation and preserves inactive links', async () => {
  const revoked = [];
  const items = ['active', 'expired', 'revoked'].map((status, i) => ({ id: i + 1, status, expiresAt: '2027-01-01T00:00:00Z', revokedAt: null, contactId: null, shareSections: {} }));
  const h = harness(shareDialogPath, 'AgentRoomShareDialog', { visible: true, room: shareRoom, api: { list: async () => ({ items }), revoke: async (...args) => { revoked.push(args); } }, onClose() {}, onPreview() {} });
  h.render(); await new Promise(resolve => setImmediate(resolve));
  let tree = h.render();
  assert.equal(tree.filter(node => node.type === 'button' && nodesText(node.props.children) === copy().shareDisableLink).length, 1);
  button(tree, copy().shareDisableLink).props.onClick();
  assert.deepEqual(revoked, []);
  tree = h.render();
  assert.ok(tree.some(node => nodesText(node.props.children) === copy().shareRevokeConfirm));
  button(tree, copy().shareCancel).props.onClick();
  assert.deepEqual(revoked, []);
  button(h.render(), copy().shareDisableLink).props.onClick();
  await button(h.render(), copy().shareDisableLink).props.onClick();
  assert.deepEqual(revoked, [[17, 1]]);
});
