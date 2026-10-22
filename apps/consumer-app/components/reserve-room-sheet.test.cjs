const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const el = React.createElement;
// React Native primitives as plain elements; native-only props are dropped.
const host = tag => ({ children, accessibilityRole }) => el(tag, accessibilityRole ? { role: accessibilityRole } : null, children);
// Relative imports load for real; everything in `mocks` (keyed by the import as written) is replaced.
const modules = new Map();
const load = (file, mocks = {}) => {
  if (modules.has(file)) return modules.get(file).exports;
  const loaded = { exports: {} };
  modules.set(file, loaded);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const localRequire = name => {
    if (name in mocks) return mocks[name];
    if (!name.startsWith('.')) throw new Error(`Unexpected dependency: ${name}`);
    const base = path.resolve(path.dirname(file), name);
    return load([`${base}.ts`, `${base}.tsx`].find(candidate => fs.existsSync(candidate)), mocks);
  };
  new Function('require', 'module', 'exports', js)(localRequire, loaded, loaded.exports);
  return loaded.exports;
};
// Real wording and real rules: the sheet is checked against what the user reads and what the API accepts.
const { th } = load(path.join(__dirname, '../../../packages/i18n/src/locales/th.ts'));
const c = th.agent.tenants;
const mocks = {
  react: React,
  'react-native': { View: host('section'), Text: host('span'), ScrollView: host('div'), Pressable: host('div'), StyleSheet: { create: styles => styles, hairlineWidth: 1 }, Platform: { OS: 'ios' } },
  'react-native-reanimated': (() => {
    const anim = { duration: () => anim };
    return { __esModule: true, default: { View: host('section') }, FadeIn: anim, FadeOut: anim, LinearTransition: anim, useSharedValue: value => ({ value }), useAnimatedStyle: () => ({}), withTiming: value => value };
  })(),
  '@nestyk/i18n': { useLocale: () => ({ t: th }) },
  '@nestyk/ui/native': {
    useMobileTheme: () => ({ theme: {} }),
    tokens: { typography: { native: {} }, colors: { subtle: {}, danger: '#c43d4c' } },
    MobileBottomSheet: ({ visible, children }) => (visible ? el('aside', null, children) : null),
    MobileButton: ({ children, disabled, isLoading }) => el('button', { disabled: !!(disabled || isLoading) }, children),
    MobileIcon: () => null,
    MobileInput: ({ label, value, error, helperText }) => el('label', null, label, el('input', { 'aria-label': label, value, onChange() {} }), el('small', null, error || helperText)),
  },
  '../lib/agent-tenants-api': { createAgentTenant: async () => { throw new Error('not reached in a static render'); }, tenantRoomOptions: async () => [] },
  './AgentLeadDetailBody': { SheetHeader: ({ title }) => el('h2', null, title) },
  // D2: the offer section is tested on its own (deal-offer-section.test.cjs); here it only shows where it sits.
  './DealOfferSection': { DealOfferSection: ({ leadId, roomId }) => el('offer-section', { 'data-lead': leadId, 'data-room': roomId }) },
};
const { ReserveRoomSheet } = load(path.join(__dirname, 'ReserveRoomSheet.tsx'), mocks);
const profile = load(path.join(__dirname, '../lib/tenant-profile.ts'), mocks);
const identity = load(path.join(__dirname, '../lib/identity-number.ts'), mocks);

const lead = { id: 7, name: 'สมหญิง ใจดี', firstName: 'สมหญิง', lastName: 'ใจดี', phone: '081-234-5678', email: 'somying@example.com', nationality: 'ไทย' };
const room = { id: 42, property: 'The Nest Sukhumvit', room: '12A', bookedBy: null };
const render = props => renderToStaticMarkup(el(ReserveRoomSheet, { visible: true, lead, room, onClose() {}, onReserved() {}, ...props }));
const form = values => ({ ...profile.tenantProfileFromLead(lead), ...values });

test('the sheet names the customer and the room, and asks only for what the reservation letter needs', () => {
  const markup = render();
  for (const text of [c.reserveTitle, 'สมหญิง ใจดี', '081-234-5678', 'The Nest Sukhumvit', 'ห้อง 12A', c.reserveEmailHint, c.reserveProfileTitle, c.reserveProfileHint, c.reserveInfo]) assert.ok(markup.includes(text), `Missing: ${text}`);
  assert.ok(!markup.includes(c.reserveProfileIssue));
  assert.deepEqual([...markup.matchAll(/aria-label="([^"]+)"/g)].map(match => match[1]), [c.reserveEmail, c.reserveIdentity]);
  assert.match(markup, /<input[^>]*value="somying@example.com"/);
  // D2 (Aof, 22 Oct 2026): the offer for this lead and room comes first, and booking waits for the landlord's confirmation.
  assert.match(markup, /<offer-section data-lead="7" data-room="42"><\/offer-section>/);
  assert.ok(markup.includes(th.contracts.offer.needConfirmed));
  assert.match(markup, new RegExp(`<button disabled="">${c.reserveConfirm}</button>`));
});

test('a lead without an email can still be booked, with a warning that the letter needs one', () => {
  const markup = render({ lead: { ...lead, email: null } });
  assert.ok(markup.includes(c.reserveEmailMissing));
  assert.ok(!markup.includes(c.reserveEmailHint));
  assert.ok(!markup.includes(c.errorEmail), 'the missing email is a warning, not an error');
});

test('a room another lead has booked says who booked it and cannot be confirmed', () => {
  const markup = render({ room: { ...room, bookedBy: 'สมชาย' } });
  assert.ok(markup.includes(c.reserveTaken.replace('{name}', 'สมชาย')));
  assert.match(markup, new RegExp(`<button disabled="">${c.reserveConfirm}</button>`));
  assert.ok(!markup.includes('<offer-section'), 'no offer for a room another lead booked');
  assert.ok(!markup.includes(th.contracts.offer.needConfirmed));
});

test('a room without a number says so instead of showing an internal id', () => {
  const markup = render({ room: { ...room, room: null } });
  assert.ok(markup.includes(c.roomNoNumber));
  assert.doesNotMatch(markup, /#42/);
});

test('nothing is rendered while closed or without a lead and a room', () => {
  assert.equal(render({ visible: false }), '');
  assert.equal(render({ lead: null }), '');
  assert.equal(render({ room: null }), '');
});

test('the tenant starts as a copy of the lead, splitting a single name when needed', () => {
  assert.deepEqual(profile.tenantProfileFromLead(lead), { firstName: 'สมหญิง', lastName: 'ใจดี', phone: '081-234-5678', email: 'somying@example.com', identityNumber: '', nationality: 'ไทย', note: '' });
  assert.deepEqual(profile.tenantProfileFromLead({ ...lead, name: 'John  Ronald Doe', firstName: '', lastName: '', email: null, nationality: null }), { firstName: 'John', lastName: 'Ronald Doe', phone: '081-234-5678', email: '', identityNumber: '', nationality: '', note: '' });
});

// Same rules as `parseTenantProfile` in apps/api/src/agent/tenants/agent-tenants.service.ts.
test('profile rules: name and phone required, email and ID number checked only when filled in', () => {
  assert.deepEqual(profile.tenantProfileIssues(form({})), {});
  assert.deepEqual(profile.tenantProfileIssues(form({ email: '', identityNumber: '', lastName: '' })), {});
  assert.deepEqual(profile.tenantProfileIssues(form({ firstName: '  ', phone: ' ' })), { firstName: 'required', phone: 'required' });
  for (const phone of ['123456', '1234567890123456', '08x-123-4567']) assert.deepEqual(profile.tenantProfileIssues(form({ phone })), { phone: 'phone' }, phone);
  for (const phone of ['1234567', '+66 (0)81-234.5678', '123456789012345']) assert.deepEqual(profile.tenantProfileIssues(form({ phone })), {}, phone);
  for (const email of ['a@b', 'a b@c.d', '@c.d']) assert.deepEqual(profile.tenantProfileIssues(form({ email })), { email: 'email' }, email);
  for (const identityNumber of ['A123', '-12345', 'เลขบัตร']) assert.deepEqual(profile.tenantProfileIssues(form({ identityNumber })), { identityNumber: 'identity' }, identityNumber);
  for (const identityNumber of ['A1234', '1-2345-67890-12-1', 'AB 1234567']) assert.deepEqual(profile.tenantProfileIssues(form({ identityNumber, nationality: '' })), {}, identityNumber);
});

// C3 (Aof, 22 Oct 2026): the tenant is matched by this number, so a Thai ID has to be right. Same rule as the API.
test('C3: a Thai national needs a valid Thai ID; with no nationality 13 digits are checked; other nationalities are not', () => {
  const issues = (identityNumber, nationality) => profile.tenantProfileIssues(form({ identityNumber, nationality }));
  for (const nationality of ['ไทย', 'Thai', ' THAI ', 'th', 'THA', 'สัญชาติไทย']) {
    assert.deepEqual(issues('1-2345-67890-12-1', nationality), {}, nationality);
    assert.deepEqual(issues('AA1234567', nationality), { identityNumber: 'thai_id' }, nationality);
  }
  for (const identityNumber of ['1-2345-67890-12-3', '1234567890122', '123456789012', 'AA1234567'])
    assert.deepEqual(issues(identityNumber, 'ไทย'), { identityNumber: 'thai_id' }, identityNumber);
  assert.deepEqual(issues('1234567890122', ''), { identityNumber: 'thai_id' }, 'no nationality: 13 digits are taken as a Thai ID');
  assert.deepEqual(issues('AA1234567', ''), {});
  for (const identityNumber of ['9001011234567', '1234567890122', 'AA1234567', '11010519491231002X'])
    assert.deepEqual(issues(identityNumber, 'เกาหลี'), {}, identityNumber);
  assert.deepEqual(issues('A12', 'ไทย'), { identityNumber: 'identity' }, 'a bad format is still a format problem');
  // Booking keeps the lead's nationality when the field is cleared, and the API checks with it.
  assert.deepEqual(profile.tenantProfileIssues(form({ identityNumber: 'E12345678', nationality: '' }), 'Thai'), { identityNumber: 'thai_id' });
  assert.deepEqual(profile.tenantProfileIssues(form({ identityNumber: 'E12345678', nationality: 'British' }), 'Thai'), {}, 'the typed nationality wins');
  // The sheet has a message for the new problem.
  assert.ok(c.errorThaiId && c.reservedNeedsIdentity && c.addIdentity);
});

test('ID numbers from any country keep only A–Z and 0–9; a valid Thai 13-digit ID gets its usual dashes', () => {
  const cases = [
    ['1234567890121', '1-2345-67890-12-1'],
    ['1-2345-67890-12-1', '1-2345-67890-12-1'],
    ['6123456789015', '6-1234-56789-01-5'], // pink card for non-Thais, same check digit
    ['1234567890122', '1234567890122'], // wrong check digit: left as typed, not rejected
    ['1-2345-67890-12-', '123456789012'], // deleting a digit drops the dashes
    ['aa 123-4567', 'AA1234567'],
    ['11010519491231002x', '11010519491231002X'], // China, 18 characters
    ['900101-1234567', '9001011234567'], // Korea, 13 digits with its own check digit
    ['เลขบัตร A1', 'A1'],
    ['A'.repeat(30), 'A'.repeat(identity.IDENTITY_NUMBER_MAX)],
  ];
  for (const [typed, shown] of cases) assert.equal(identity.nextIdentityNumberDraft(typed), shown, typed);
  // The field never refuses while typing; the Thai ID rule is checked on save (see the C3 test above).
  for (const [, shown] of cases.slice(0, 8)) assert.deepEqual(profile.tenantProfileIssues(form({ identityNumber: shown, nationality: 'เกาหลี' })), {}, shown);
});

test('the request body is trimmed and carries the display name', () => {
  assert.deepEqual(profile.tenantProfileBody(form({ firstName: ' สมหญิง ', lastName: '', phone: ' 0812345678 ', email: ' a@b.co ', identityNumber: ' A1234567 ', note: ' vip ' })), { name: 'สมหญิง', firstName: 'สมหญิง', lastName: '', phone: '0812345678', email: 'a@b.co', note: 'vip', identityNumber: 'A1234567', nationality: 'ไทย' });
});

// D2 (Aof, 22 Oct 2026): driven with stand-in hooks, so the offer section's answer reaches the sheet.
function liveSheet({ createAgentTenant, visible = true }) {
  const states = [], refs = [], effectDeps = [], effects = [];
  let stateIndex = 0, refIndex = 0, effectIndex = 0;
  const hooked = { ...React,
    useState: (initial) => { const i = stateIndex++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], (next) => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; },
    useRef: (initial) => (refs[refIndex++] ??= { current: initial }),
    useEffect: (fn, deps) => { const i = effectIndex++, old = effectDeps[i]; if (!old || !deps || deps.some((v, j) => v !== old[j])) { effectDeps[i] = deps; effects.push(fn); } },
  };
  const Section = () => null;
  const own = new Map();
  const live = { ...mocks, react: hooked, './DealOfferSection': { DealOfferSection: Section },
    '../lib/agent-tenants-api': { createAgentTenant, tenantRoomOptions: async () => [] } };
  const loadLive = (file) => {
    if (own.has(file)) return own.get(file).exports;
    const loaded = { exports: {} }; own.set(file, loaded);
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', js)((name) => {
      if (name in live) return live[name];
      const base = path.resolve(path.dirname(file), name);
      return loadLive([`${base}.ts`, `${base}.tsx`].find((candidate) => fs.existsSync(candidate)));
    }, loaded, loaded.exports);
    return loaded.exports;
  };
  const { ReserveRoomSheet: Sheet } = loadLive(path.join(__dirname, 'ReserveRoomSheet.tsx'));
  const tree = () => { stateIndex = refIndex = effectIndex = 0; const out = Sheet({ visible, lead, room, onClose() {}, onReserved() {}, showBookedState: false }); effects.splice(0).forEach((fn) => fn()); return out; };
  const all = (node) => (!node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(all) : [node, ...all(node.props?.children)]);
  const confirmButton = (nodesList) => nodesList.find((n) => n.type === mocks['@nestyk/ui/native'].MobileButton && [].concat(n.props.children).join('') === c.reserveConfirm);
  return { tree, all, confirmButton, Section };
}

test('D2: the booking button opens once the offer section says the landlord confirmed, and books', async () => {
  const calls = [];
  const s = liveSheet({ createAgentTenant: async (body) => { calls.push(body); return { id: 9, name: 'สมหญิง ใจดี' }; } });
  let nodesList = s.all(s.tree());
  const section = nodesList.find((n) => n.type === s.Section);
  assert.deepEqual([section.props.leadId, section.props.roomId], [7, 42]);
  assert.equal(s.confirmButton(nodesList).props.disabled, true);
  section.props.onConfirmedChange(true);
  nodesList = s.all(s.tree());
  assert.equal(s.confirmButton(nodesList).props.disabled, false);
  assert.equal(nodesList.some((n) => [].concat(n.props?.children).includes(th.contracts.offer.needConfirmed)), false);
  s.confirmButton(nodesList).props.onPress();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 1); assert.equal(calls[0].leadId, 7); assert.equal(calls[0].rentRoomId, 42);
  // The section changing its mind (e.g. the offer was cancelled) closes the button again.
  s.all(s.tree()).find((n) => n.type === s.Section).props.onConfirmedChange(false);
  assert.equal(s.confirmButton(s.all(s.tree())).props.disabled, true);
});

test('D2: the API\'s OFFER_NOT_CONFIRMED refusal is explained in the app\'s words', async () => {
  const s = liveSheet({ createAgentTenant: async () => { throw Object.assign(new Error('Some server text'), { code: 'OFFER_NOT_CONFIRMED', status: 400 }); } });
  s.all(s.tree()).find((n) => n.type === s.Section).props.onConfirmedChange(true);
  s.confirmButton(s.all(s.tree())).props.onPress();
  await new Promise((resolve) => setImmediate(resolve));
  const shown = s.all(s.tree()).filter((n) => n.props?.accessibilityRole === 'alert').map((n) => [].concat(n.props.children).join(''));
  assert.deepEqual(shown, [th.contracts.offer.needConfirmed]);
});

test('D2: the offer section exists only while the sheet is open, so reopening reads the offer again', () => {
  const closed = liveSheet({ createAgentTenant: async () => assert.fail('not booked'), visible: false });
  assert.equal(closed.all(closed.tree()).some((n) => n.type === closed.Section), false);
  const open = liveSheet({ createAgentTenant: async () => assert.fail('not booked') });
  assert.equal(open.all(open.tree()).some((n) => n.type === open.Section), true);
});
