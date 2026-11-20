// Self owner listing editor (UI round, 20 Nov 2026, ClickUp z8rcteng6c / z8rcteng6d): the agent listing wizard with
// the owner preset and demo choices; saving goes to the in-memory room store, never to `/agent/*`.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

const root = path.resolve(__dirname, '../../..');
let locale = 'th';
const Platform = { OS: 'web' };
let windowWidth = 1440;
const cache = new Map();
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const localRequire = (name) => {
    if (name === 'react') return { ...React, useMemo: fn => fn(), useCallback: fn => fn, useSyncExternalStore: (_s, get) => get() };
    if (name === 'react-native') return { Platform, useWindowDimensions: () => ({ width: windowWidth, height: 900 }) };
    if (name === 'expo-image-picker') return { launchImageLibraryAsync: async () => ({ canceled: true }), UIImagePickerPreferredAssetRepresentationMode: {} };
    if (name === '@nestyk/i18n') return { useLocale: () => ({ locale, t: load(`${root}/packages/i18n/src/locales/${locale}.ts`)[locale] }), localizedError: (e, fallback) => e?.message || fallback };
    if (name === '@nestyk/feature-listing') return { MobileCreateListingWizardBody: 'Wizard', defaultOwnerListingConfig: { actorRole: 'landlord' }, interpolate: (t, v) => Object.entries(v).reduce((a, [k, x]) => a.replace(`{${k}}`, String(x)), t) };
    if (!name.startsWith('.')) return require(name);
    const base = path.resolve(path.dirname(filename), name);
    return load([base, `${base}.ts`, `${base}.tsx`].find(file => fs.existsSync(file) && fs.statSync(file).isFile()));
  };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText)(localRequire, module, module.exports);
  return module.exports;
}
const editorFile = path.join(__dirname, 'self-owner/SelfOwnerListingEditor.tsx');
const roomsLib = () => load(path.join(__dirname, '../lib/self-owner-rooms.ts'));
const listingLib = () => load(path.join(__dirname, '../lib/self-owner-listing.ts'));
const copyOf = (l) => load(`${root}/packages/i18n/src/locales/${l}.ts`)[l];
const now = new Date('2026-11-20T04:00:00Z');

function wizardProps(props = {}) {
  const element = load(editorFile).SelfOwnerListingEditor({ onDone: () => {}, ...props });
  assert.equal(element.type, 'Wizard');
  return element.props;
}
const room = (id) => roomsLib().selfOwnerRoomStore.get().find((r) => r.id === id);

beforeEach(() => { locale = 'th'; roomsLib().selfOwnerRoomStore.reset(now); listingLib().selfOwnerListingDrafts.clear(); });

test('create passes owner preset and demo lists', async () => {
  const props = wizardProps();
  const { SELF_OWNER_DEMO_OPTIONS } = listingLib();
  assert.equal(props.presetListingSource, 'owner');
  assert.equal(props.initialData, undefined);
  assert.equal(props.title, copyOf('th').selfOwnerRooms.createTitle);
  assert.deepEqual(await props.listPropertyTypes(), SELF_OWNER_DEMO_OPTIONS.propertyTypes);
  assert.deepEqual(await props.listContractTypes(), SELF_OWNER_DEMO_OPTIONS.contractTypes);
  assert.deepEqual(await props.listRoomTypes(), SELF_OWNER_DEMO_OPTIONS.roomTypes);
  assert.deepEqual(await props.listFacilities(), SELF_OWNER_DEMO_OPTIONS.facilities);
  assert.equal(await props.uploadPhoto({ uri: 'file:///a.jpg', name: 'a.jpg', mimeType: 'image/jpeg' }), 'file:///a.jpg');
});

test('no agent-only helpers', () => {
  const props = wizardProps();
  for (const key of ['searchPlaces', 'getPlaceDetails', 'reverseGeocode', 'searchNearby', 'generateListingPromo', 'enhancePhoto', 'listContacts']) {
    assert.equal(props[key], undefined, key);
  }
});

test('submit adds an unlisted room', async () => {
  let done = null;
  const props = wizardProps({ onDone: (r) => { done = r; } });
  const data = listingLib().wizardDataFromRoom(room('r6'));
  await props.onSubmitListing({ ...data, listingTitle: 'ห้อง 3305' });
  assert.equal(roomsLib().selfOwnerRoomStore.get().length, 15);
  assert.equal(done.id, 'r15');
  assert.equal(done.state, 'unlisted');
  assert.equal(done.title, 'ห้อง 3305');
  assert.equal(listingLib().selfOwnerListingDrafts.get('r15').listingTitle, 'ห้อง 3305');
});

test('edit passes initial data and updates in place', async () => {
  let done = null;
  const props = wizardProps({ room: room('r5'), onDone: (r) => { done = r; } });
  assert.equal(props.initialData.listingTitle, room('r5').title);
  assert.equal(props.title, copyOf('th').selfOwnerRooms.editTitle);
  await props.onSubmitListing({ ...props.initialData, prices: [{ contractTypeId: 2, price: 43000 }] });
  assert.equal(roomsLib().selfOwnerRoomStore.get().length, 14);
  assert.equal(room('r5').monthlyRent, 43000);
  assert.equal(room('r5').state, 'listed');
  assert.equal(done.id, 'r5');
});

test('cancel on edit is wired as abandon', () => {
  let cancelled = false;
  const props = wizardProps({ room: room('r5'), onCancel: () => { cancelled = true; } });
  props.onAbandonUnsaved();
  assert.equal(cancelled, true);
});

test('no network imports', () => {
  const code = fs.readFileSync(editorFile, 'utf8');
  assert.doesNotMatch(code, /agent-listings-api|places-api|room-photos|lib\/api/);
});

test('locales complete', () => {
  const keys = ['createTitle', 'editTitle', 'edit', 'savedDemo', 'publish', 'unpublish', 'publishConfirm', 'unpublishConfirm', 'occupiedNoToggle'];
  for (const l of ['th', 'en', 'ja', 'zh']) {
    const so = copyOf(l).selfOwnerRooms;
    for (const key of keys) assert.ok(typeof so[key] === 'string' && so[key].trim(), `${l}.${key}`);
    assert.match(so.publishConfirm, /\{title\}/);
    assert.match(so.unpublishConfirm, /\{title\}/);
  }
  for (const key of keys) assert.doesNotMatch(copyOf('th').selfOwnerRooms[key].replace('{title}', ''), /[A-Za-z]/, `th.${key}`);
});

// Web leave prompt (Jom 20 Nov 2026): the wizard's Alert does nothing on the web, so the editor asks with confirm.
test('web asks before leaving unsaved edits; the phone keeps the wizard alert', () => {
  const asked = [];
  const original = globalThis.confirm;
  let discarded = 0;
  try {
    Platform.OS = 'web';
    globalThis.confirm = (message) => { asked.push(message); return true; };
    wizardProps({ room: room('r5') }).confirmLeave(() => { discarded += 1; });
    globalThis.confirm = () => false;
    wizardProps({ room: room('r5') }).confirmLeave(() => { discarded += 1; });
    const cr = copyOf('th').agent.createRoom;
    assert.deepEqual(asked, [`${cr.setupUnsavedLeaveTitle}\n${cr.setupUnsavedLeaveBody}`]);
    assert.equal(discarded, 1);
    Platform.OS = 'ios';
    assert.equal(wizardProps({ room: room('r5') }).confirmLeave, undefined);
  } finally {
    globalThis.confirm = original;
    Platform.OS = 'web';
  }
});

// Self owner create form (Jom 20 Nov 2026): room name not required (blank -> "ห้อง {เลขห้อง}" or the project),
// renamed texts, and the owner's profile as the only contact.
const owner = { name: 'กฤษณพงศ์ เฟื้องทอง', phone: '0812345678' };

test('owner texts, optional room name and the profile contact go to the form', () => {
  const so = copyOf('th').selfOwnerRooms;
  const props = wizardProps({ ownerContact: owner });
  assert.equal(props.listingTitleOptional, true);
  assert.deepEqual(props.ownerContact, owner);
  assert.deepEqual(props.copyOverrides, {
    listingTitle: so.titleField,
    listingTitleHint: so.titleFieldHint,
    listingTitlePlaceholder: so.titlePlaceholder,
    sourceSection: so.contactSection,
    contactStepTitle: so.contactSection,
    visibilityPrivateHint: so.privateHint,
  });
  for (const l of ['th', 'en', 'ja', 'zh']) {
    const c = copyOf(l).selfOwnerRooms;
    for (const key of ['titleField', 'titleFieldHint', 'titlePlaceholder', 'contactSection', 'autoTitle', 'privateHint']) assert.ok(c[key]?.trim(), `${l}.${key}`);
    assert.match(c.autoTitle, /\{room\}/);
  }
  assert.doesNotMatch(Object.values(copyOf('th').selfOwnerRooms).join(' ').replace(/\{room\}/g, ''), /Agent|agent/);
});

test('a blank room name is filled from the room number, else the project', async () => {
  const so = copyOf('th').selfOwnerRooms;
  let done = null;
  const props = wizardProps({ ownerContact: owner, onDone: (r) => { done = r; } });
  const data = listingLib().wizardDataFromRoom(room('r6'));
  await props.onSubmitListing({ ...data, listingTitle: '  ', roomId: '3305' });
  assert.equal(done.title, so.autoTitle.replace('{room}', '3305'));
  assert.equal(listingLib().selfOwnerListingDrafts.get(done.id).listingTitle, done.title);
  await props.onSubmitListing({ ...data, listingTitle: '', roomId: '' });
  assert.equal(roomsLib().selfOwnerRoomStore.get().at(-1).title, data.property.name);
});

test('no profile given: the form gets no owner contact (it asks like before)', () => {
  assert.equal(wizardProps({}).ownerContact, undefined);
});

test('desktop look on wide web only (768 and up, like the web shell); phone and narrow web keep the phone form', () => {
  try {
    Platform.OS = 'web'; windowWidth = 1440;
    assert.equal(wizardProps({}).desktopLayout, true);
    windowWidth = 767;
    assert.equal(wizardProps({}).desktopLayout, false);
    Platform.OS = 'ios'; windowWidth = 1440;
    assert.equal(wizardProps({}).desktopLayout, false);
  } finally {
    Platform.OS = 'web'; windowWidth = 1440;
  }
});

// Connected to the self owner API (20 Nov 2026, D4): choices, photos and saving go through the store's backend.
function connectedBackend(over = {}) {
  const seen = [];
  const options = { propertyTypes: [{ id: 9, code: 'condo' }], contractTypes: [{ id: 31, code: 'twelve_months', termMonths: 12 }], roomTypes: [{ id: 41, code: 'one_bedroom', bedroomCount: 1 }], facilities: [{ code: 'wifi', groupCode: 'appliances' }] };
  const backend = {
    seen,
    list: async () => { seen.push(['list']); return []; },
    options: async () => options,
    uploadPhoto: async (photo) => { seen.push(['upload', photo.uri]); return `https://cdn/${photo.name}`; },
    save: async (id, data) => { seen.push(['save', id, data.listingTitle]); return id ?? '77'; },
    setVisibility: async () => 'listed',
    detail: async () => { throw new Error('not used'); },
    ...over,
  };
  return backend;
}
const settle = () => new Promise((r) => setImmediate(r));

test('connected: the form gets the API choices and uploads photos to the API', async () => {
  const backend = connectedBackend();
  roomsLib().selfOwnerRoomStore.connect(backend, 'u1');
  const props = wizardProps();
  assert.deepEqual(await props.listContractTypes(), [{ id: 31, code: 'twelve_months', termMonths: 12 }]);
  assert.deepEqual(await props.listPropertyTypes(), [{ id: 9, code: 'condo' }]);
  assert.deepEqual(await props.listRoomTypes(), [{ id: 41, code: 'one_bedroom', bedroomCount: 1 }]);
  assert.deepEqual(await props.listFacilities(), [{ code: 'wifi', groupCode: 'appliances' }]);
  assert.equal(await props.uploadPhoto({ uri: 'file:///a.jpg', name: 'a.jpg', mimeType: 'image/jpeg' }), 'https://cdn/a.jpg');
});

test('connected: saving creates through the API, then the list loads again', async () => {
  const backend = connectedBackend();
  roomsLib().selfOwnerRoomStore.connect(backend, 'u1');
  await settle();
  let done;
  const props = wizardProps({ onDone: (r) => { done = r; } });
  const data = listingLib().wizardDataFromRoom({ id: 'x', title: 'ห้อง 3305', project: 'Ideo Q', monthlyRent: 19000, state: 'unlisted', bedrooms: 1, sizeSqm: 33, updatedAt: now.toISOString() });
  await props.onSubmitListing({ ...data, prices: [{ contractTypeId: 31, price: 19000 }], roomTypeId: 41 });
  await settle();
  assert.deepEqual(backend.seen.filter(([k]) => k === 'save'), [['save', undefined, 'ห้อง 3305']]);
  assert.equal(done.id, '77');
  assert.equal(done.monthlyRent, 19000, 'the 12-month rent of the API choices');
  assert.equal(listingLib().selfOwnerListingDrafts.get('77').listingTitle, 'ห้อง 3305');
  assert.equal(backend.seen.filter(([k]) => k === 'list').length, 2, 'loaded on connect and again after saving');
});

test('connected: editing saves the same room; a failed save tells the owner on the web and keeps the form', async () => {
  const backend = connectedBackend({ save: async () => { throw new Error('API down'); } });
  roomsLib().selfOwnerRoomStore.connect(backend, 'u1');
  await settle();
  const asked = [];
  const previous = globalThis.alert;
  globalThis.alert = (text) => asked.push(text);
  try {
    let done;
    const props = wizardProps({ onDone: (r) => { done = r; } });
    const data = listingLib().wizardDataFromRoom({ id: 'x', title: 'ห้อง 3305', project: 'Ideo Q', monthlyRent: 19000, state: 'unlisted', bedrooms: 1, sizeSqm: 33, updatedAt: now.toISOString() });
    await assert.rejects(props.onSubmitListing(data), /API down/);
    assert.equal(done, undefined);
    assert.equal(asked.length, 1);
    assert.match(asked[0], /API down/);
  } finally {
    globalThis.alert = previous;
  }
});

// Review fix (20 Nov 2026): once the API has saved the room, nothing after it reports a failure (a retry would add
// the room twice).
test('connected: a saved room counts as saved even if the choices cannot be read afterwards', async () => {
  let saves = 0;
  const backend = connectedBackend({ save: async () => { saves += 1; return '77'; }, options: async () => { throw new Error('options down'); } });
  roomsLib().selfOwnerRoomStore.connect(backend, 'u1');
  await settle();
  let done;
  const props = wizardProps({ onDone: (r) => { done = r; } });
  const data = listingLib().wizardDataFromRoom({ id: 'x', title: 'ห้อง 3305', project: 'Ideo Q', monthlyRent: 19000, state: 'unlisted', bedrooms: 1, sizeSqm: 33, updatedAt: now.toISOString() });
  await props.onSubmitListing(data);
  assert.equal(saves, 1);
  assert.equal(done.id, '77');
});

// Browser check (20 Nov 2026): opening "add room" straight from a page load renders the form before the app connects
// the store. The form must start again on the API choices once it connects (nothing typed yet at that moment).
test('a form opened before the store connects switches to the API once it connects', async () => {
  const before = load(editorFile).SelfOwnerListingEditor({ onDone: () => {} });
  assert.deepEqual(await before.props.listContractTypes(), listingLib().SELF_OWNER_DEMO_OPTIONS.contractTypes);
  roomsLib().selfOwnerRoomStore.connect(connectedBackend(), 'u1');
  const after = load(editorFile).SelfOwnerListingEditor({ onDone: () => {} });
  assert.notEqual(after.key, before.key, 'the wizard starts again when the store connects');
  assert.deepEqual(await after.props.listContractTypes(), [{ id: 31, code: 'twelve_months', termMonths: 12 }]);
  assert.deepEqual(await before.props.listContractTypes(), [{ id: 31, code: 'twelve_months', termMonths: 12 }], 'a list asked later reads the connected store');
});
