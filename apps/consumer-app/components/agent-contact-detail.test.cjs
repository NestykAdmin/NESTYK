const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const original = { id: 1, name: 'Original', phone: '0801', email: null, lineId: 'old-line', facebook: null, note: 'Original note' };
const copy = { roomsCount: '{count} linked rooms', roomsEmpty: 'No linked rooms', roomsLoadError: 'Room load failed', roomNumber: 'Room {number}', rentNotSpecified: 'Rent not specified', confirmEditTitle: 'Confirm edit', confirmEditBody: 'Edit {name}?', confirmSaveTitle: 'Confirm save', confirmSaveBody: 'Save {name} everywhere?', confirmCreateTitle: 'Confirm creation', confirmCreateBody: 'Create {name}?', cancel: 'Cancel', createCoAgentTitle: 'Add Co-Agent', title: 'Contact details', editTitle: 'Edit contact', name: 'Name', phone: 'Phone', email: 'Email', lineId: 'LINE', facebook: 'Facebook', note: 'Notes',
  loadError: 'Load failed', saveError: 'Save failed', required: 'Name and phone required', invalidEmail: 'Invalid email', duplicatePhone: 'Duplicate phone', sharedHint: 'Shared by linked rooms', notSpecified: 'Not specified' };
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

function harness() {
  const states = [], refs = [], effectDeps = [], cleanups = [], effects = [], inputs = new Map(), saved = [], requests = [], reads = [], settled = [];
  const roomReads = [], roomResults = [];
  const fetchRequest = deferred(), actionsRef = { current: null }, buttons = new Map();
  let modal;
  let stateIndex, refIndex, effectIndex, currentState, closed = 0;
  class ApiError extends Error { constructor(status) { super('API error'); this.status = status; } }
  const hookedReact = { ...React,
    useState(initial) { const i = stateIndex++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef(initial) { const i = refIndex++; return refs[i] ??= { current: initial }; },
    useCallback: fn => fn,
    useEffect(fn, deps) {
      const i = effectIndex++, old = effectDeps[i];
      if (!old || deps.some((value, j) => value !== old[j])) {
        effects.push(() => { cleanups[i]?.(); cleanups[i] = fn(); });
        effectDeps[i] = deps;
      }
    },
  };
  const nativeElement = tag => ({ children }) => React.createElement(tag, {}, children);
  const mockRequire = name => {
    if (name === 'react') return hookedReact;
    if (name === 'react-native') return { Keyboard: { dismiss() {} }, View: nativeElement('div'), Text: nativeElement('span'), StyleSheet: { create: x => x } };
    if (name === 'react-native-reanimated') return { __esModule: true, default: { View: nativeElement('section') }, FadeIn: { duration() {} } };
    if (name === '@nestyk/i18n') return { useLocale: () => ({ locale: 'en', t: { common: { confirm: 'Confirm' }, masters: {roomTypes: {studio:'Studio'}}, agent: { dashboard: { contactDetails: copy }, listings: { retry: 'Retry', roomInformation: 'Room information', available: 'Available', rented: 'Rented', notSpecified: 'Not specified', specFloor: 'Floor {floor}', specSqm: '{size} sqm', specBed: '{count} bedrooms', rentPerMonthShort: '{price} / month' } } } }), localizedError: (_, fallback) => fallback };
    if (name === '@nestyk/ui/native') return {
      tokens: { typography: { native: {} }, colors: { error: 'red' } }, useMobileTheme: () => ({ theme: {} }),
      MobileStatusPill: ({label}) => React.createElement('span', {}, label),
      MobileBrandLoader: () => React.createElement('span', {}, 'Loading'),
      MobileButton: props => { buttons.set(props.children, props); return React.createElement('button', {}, props.children); },
      MobileBottomSheet: props => { modal = props; return props.visible ? React.createElement('aside', {}, props.children) : null; },
      MobileInput: props => { inputs.set(props.label, props); return React.createElement('input', { value: props.value, readOnly: true }); },
    };
    if (name === '../lib/api') return { ApiError };
    if (name === '../lib/agent-contacts-api') return {
      fetchContactRooms: id => { roomReads.push(id); return roomResults.shift() ?? Promise.resolve([]); },
      fetchDirectoryContact: (kind, id) => {
        assert.equal(id, 1);
        const request = reads.length ? deferred() : fetchRequest;
        request.kind = kind; reads.push(request);
        return request.promise;
      },
      createCoAgentContact: values => { const request = { ...deferred(), kind: 'coAgent', create: true, values }; requests.push(request); return request.promise; },
      updateDirectoryContact: (kind, id, values) => { const request = { ...deferred(), kind, id, values }; requests.push(request); return request.promise; },
    };
    throw new Error(`Unexpected dependency: ${name}`);
  };
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, 'AgentContactDetailBody.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText)(mockRequire, loaded, loaded.exports);
  const props = { contactId: 1, actionsRef, reloadToken: 0, onReloadSettled: token => settled.push(token), onClose: () => closed++, onSaved: contact => saved.push(contact), onStateChange: state => { currentState = state; } };
  function render() {
    stateIndex = refIndex = effectIndex = 0;
    inputs.clear(); buttons.clear();
    const html = renderToStaticMarkup(React.createElement(loaded.exports.AgentContactDetailBody, props));
    effects.splice(0).forEach(fn => fn());
    return html;
  }
  async function initialLoad() { render(); fetchRequest.resolve(original); await tick(); return render(); }
  function confirm() { buttons.get('Confirm').onPress(); render(); }
  function edit() { actionsRef.current.edit(); render(); confirm(); }
  function save() { actionsRef.current.save(); render(); if (modal?.visible) confirm(); }
  return { render, initialLoad, roomReads, roomResults, edit, save, confirm, modal: () => modal, buttons, actionsRef, inputs, saved, requests, ApiError, fetchRequest, props, reads, settled,
    state: () => currentState, closed: () => closed, unmount: () => cleanups.forEach(fn => fn?.()) };
}

test('opens details, edits the existing ID, blocks duplicate submissions and back during save, then shows saved details', async () => {
  const h = harness();
  assert.match(await h.initialLoad(), /Original note/);
  assert.equal(h.state().canEdit, true);
  h.edit();
  h.inputs.get('Name').onChangeText('Updated'); h.inputs.get('Phone').onChangeText('0900'); h.render();
  h.save(); h.save(); h.render();
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0].id, 1);
  assert.equal(h.requests[0].values.name, 'Updated'); assert.equal(h.state().saving, true);
  h.actionsRef.current.back(); assert.equal(h.closed(), 0);
  h.requests[0].resolve({ ...original, name: 'Updated', phone: '0900' }); await tick();
  const html = h.render();
  assert.match(html, /Updated/); assert.match(html, /0900/);
  assert.equal(h.state().editing, false); assert.equal(h.state().title, 'Updated');
  assert.equal(h.saved.length, 1);
});

test('cancel restores the saved contact and a second back returns to the people list', async () => {
  const h = harness(); await h.initialLoad();
  h.edit(); h.inputs.get('Name').onChangeText('Unsaved'); h.render();
  h.actionsRef.current.back(); const html = h.render();
  assert.match(html, /Original/); assert.doesNotMatch(html, /Unsaved/);
  assert.equal(h.requests.length, 0); assert.equal(h.closed(), 0);
  h.actionsRef.current.back(); assert.equal(h.closed(), 1);
});

test('validation and failed saves preserve editing values for correction and retry', async () => {
  const h = harness(); await h.initialLoad(); h.edit();
  h.inputs.get('Name').onChangeText(' '); h.render(); h.save(); h.render();
  assert.equal(h.state().error, 'Name and phone required'); assert.equal(h.requests.length, 0);
  h.inputs.get('Name').onChangeText('Updated'); h.inputs.get('Email').onChangeText('invalid'); h.render();
  h.save(); h.render(); assert.equal(h.state().error, 'Invalid email');
  h.inputs.get('Email').onChangeText('new@example.com'); h.render(); h.save();
  h.requests[0].reject(new h.ApiError(409)); await tick(); h.render();
  assert.equal(h.state().editing, true); assert.equal(h.state().error, 'Duplicate phone');
  assert.equal(h.inputs.get('Name').value, 'Updated'); assert.equal(h.state().saving, false);
  h.save(); h.requests[1].reject(new Error('Network')); await tick(); h.render();
  assert.equal(h.state().error, 'Save failed'); assert.equal(h.saved.length, 0);
});

test('unmount clears shell actions and ignores a late detail response', async () => {
  const h = harness(); h.render(); h.unmount();
  h.fetchRequest.resolve(original); await tick();
  assert.equal(h.actionsRef.current, null); assert.equal(h.state(), null);
});

test('detail refresh reads once and settles only after the latest detail response', async () => {
  const h = harness(); await h.initialLoad();
  assert.deepEqual(h.settled, [0]);
  h.props.reloadToken = 1; h.render(); h.render();
  assert.equal(h.reads.length, 2); assert.deepEqual(h.settled, [0]);
  h.reads[1].resolve({ ...original, name: 'Refreshed' }); await tick();
  assert.match(h.render(), /Refreshed/);
  assert.deepEqual(h.settled, [0, 1]);
});

test('failed detail refresh stops refreshing and offers retry', async () => {
  const h = harness(); await h.initialLoad();
  h.props.reloadToken = 1; h.render();
  h.reads[1].reject(new Error('Network')); await tick();
  assert.match(h.render(), /Load failed/); assert.deepEqual(h.settled, [0, 1]);
});

for (const kind of ['owner', 'landlord', 'lead', 'tenant', 'coAgent']) test(`${kind} details read and save the correct person category`, async () => {
  const h = harness(); h.props.kind = kind;
  await h.initialLoad();
  assert.equal(h.reads[0].kind, kind);
  h.edit();
  h.inputs.get('Name').onChangeText(`${kind} Updated`); h.render();
  h.save();
  assert.equal(h.requests[0].kind, kind); assert.equal(h.requests[0].id, 1);
  h.requests[0].resolve({ ...original, name: `${kind} Updated` }); await tick();
  assert.match(h.render(), new RegExp(`${kind} Updated`));
  assert.equal(h.state().editing, false);
});

test('adding a Co-Agent starts an empty form, validates and saves once without fetching a nonexistent ID', async () => {
  const h = harness(); h.props.kind = 'coAgent'; h.props.contactId = null; h.render();
  assert.equal(h.state().title, 'Add Co-Agent'); assert.equal(h.state().editing, true);
  assert.equal(h.inputs.get('Name').value, ''); assert.equal(h.reads.length, 0);
  h.save(); h.render();
  assert.equal(h.state().error, 'Name and phone required'); assert.equal(h.requests.length, 0);
  h.inputs.get('Name').onChangeText('New partner'); h.inputs.get('Phone').onChangeText('0900'); h.render();
  h.save(); h.save(); h.render();
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0].create, true);
  h.actionsRef.current.back(); assert.equal(h.closed(), 0);
  h.requests[0].reject(new h.ApiError(409)); await tick(); h.render();
  assert.equal(h.state().error, 'Duplicate phone'); assert.equal(h.inputs.get('Name').value, 'New partner');
  h.inputs.get('Phone').onChangeText('0901'); h.render(); h.save();
  h.requests[1].resolve({ ...original, id: 4, name: 'New partner', phone: '0901' }); await tick();
  assert.match(h.render(), /New partner/); assert.equal(h.state().editing, false);
  assert.equal(h.saved[0].id, 4); assert.equal(h.reads.length, 0);
});

test('canceling a new Co-Agent returns to the list without a write', () => {
  const h = harness(); h.props.kind = 'coAgent'; h.props.contactId = null; h.render();
  h.inputs.get('Name').onChangeText('Unsaved'); h.render(); h.actionsRef.current.back();
  assert.equal(h.closed(), 1); assert.equal(h.saved.length, 0); assert.equal(h.requests.length, 0);
});

test('edit requires confirmation; cancel, backdrop and back keep the saved details untouched', async () => {
  const h = harness(); await h.initialLoad();
  h.actionsRef.current.edit(); h.render();
  assert.equal(h.state().editing, false); assert.equal(h.state().confirming, true);
  assert.equal(h.modal().visible, true); assert.equal(h.inputs.size, 0);
  h.buttons.get('Cancel').onPress(); h.render();
  assert.equal(h.state().editing, false); assert.equal(h.modal().visible, false);
  h.actionsRef.current.edit(); h.render(); h.modal().onClose(); h.render();
  assert.equal(h.state().confirming, false); assert.equal(h.closed(), 0);
  h.actionsRef.current.edit(); h.render(); h.actionsRef.current.back(); h.render();
  assert.equal(h.modal().visible, false); assert.equal(h.closed(), 0);
  h.edit(); assert.equal(h.state().editing, true); assert.equal(h.requests.length, 0);
});

for (const creating of [false, true]) test(`${creating ? 'create' : 'save'} waits for confirmation and retains the draft when dismissed`, async () => {
  const h = harness();
  if (creating) { h.props.kind = 'coAgent'; h.props.contactId = null; h.render(); }
  else { await h.initialLoad(); h.edit(); }
  h.inputs.get('Name').onChangeText('Draft'); h.inputs.get('Phone').onChangeText('0900'); h.render();
  h.actionsRef.current.save(); const html = h.render();
  assert.match(html, creating ? /Confirm creation/ : /Confirm save/);
  assert.equal(h.requests.length, 0); assert.equal(h.state().saving, false);
  assert.equal(h.state().confirming, true);
  assert.equal(h.inputs.get('Name').editable, false);
  const staleConfirm = h.buttons.get('Confirm').onPress;
  h.buttons.get('Cancel').onPress(); h.render(); staleConfirm();
  assert.equal(h.requests.length, 0); assert.equal(h.state().editing, true);
  assert.equal(h.inputs.get('Name').value, 'Draft'); assert.equal(h.closed(), 0);
  h.actionsRef.current.save(); h.render();
  const confirm = h.buttons.get('Confirm').onPress;
  confirm(); confirm(); h.render();
  assert.equal(h.requests.length, 1); assert.equal(h.state().saving, true);
  assert.equal(h.requests[0].values.name, 'Draft');
  h.requests[0].resolve({ ...original, name: 'Draft', phone: '0900' }); await tick(); h.render();
  assert.equal(h.saved.length, 1); assert.equal(h.state().editing, false);
});

const linkedRooms = [
  {id:11,roomId:'A101',listingTitle:'Quiet room',propertyName:'Demo Condo',district:'District',province:'Bangkok',roomStatusCode:'rented',roomTypeCode:'two_bedroom',bedroomCount:'2',roomSizeSqm:'45.5',floor:'18',minRent:13000},
  {id:12,roomId:'A102',listingTitle:null,propertyName:'Demo Condo',district:null,province:null,roomStatusCode:'available',roomTypeCode:'studio',bedroomCount:'0',roomSizeSqm:null,floor:null,minRent:15000},
];
test('Landlord details show every linked room, including vacant rooms, with project, number, rent and specs', async () => {
  const h=harness();h.props.kind='landlord';h.roomResults.push(Promise.resolve(linkedRooms));
  const html=await h.initialLoad();
  for(const text of ['Room information','2 linked rooms','Demo Condo','Room A101','Room A102','Rented','Available','Floor 18','45.5 sqm','2 bedrooms','Studio','13,000 / month','15,000 / month']) assert.ok(html.includes(text),text);
  assert.deepEqual(h.roomReads,[1]);
  h.edit();assert.doesNotMatch(h.render(),/Room information/);
  h.actionsRef.current.back();assert.match(h.render(),/Room information/);assert.deepEqual(h.roomReads,[1]);
});

test('Landlord room errors preserve the profile and offer a retry that settles refresh', async()=>{
  const h=harness();h.props.kind='landlord';h.roomResults.push(Promise.reject(new Error('Network')));
  const html=await h.initialLoad();assert.match(html,/Original note/);assert.match(html,/Room load failed/);
  assert.deepEqual(h.settled,[0]);
  h.buttons.get('Retry').onPress();h.render();h.reads[1].resolve(original);await tick();
  assert.match(h.render(),/No linked rooms/);assert.deepEqual(h.roomReads,[1,1]);
});

test('Landlord refresh completes only when profile and room data both finish', async()=>{
  const h=harness();h.props.kind='landlord';await h.initialLoad();
  const rooms=deferred();h.roomResults.push(rooms.promise);h.props.reloadToken=1;h.render();
  h.reads[1].resolve({...original,name:'Refreshed'});await tick();
  assert.deepEqual(h.settled,[0]);
  rooms.resolve(linkedRooms);await tick();const html=h.render();
  assert.match(html,/Refreshed/);assert.match(html,/Room A101/);assert.deepEqual(h.settled,[0,1]);
});

test('other contact categories never fetch linked landlord rooms',async()=>{
  for(const kind of ['owner','lead','tenant','coAgent']){const h=harness();h.props.kind=kind;await h.initialLoad();assert.deepEqual(h.roomReads,[]);}
});
