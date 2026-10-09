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
  assert.match(markup, new RegExp(`<button>${c.reserveConfirm}</button>`));
});

test('a lead without an email can still be booked, with a warning that the letter needs one', () => {
  const markup = render({ lead: { ...lead, email: null } });
  assert.ok(markup.includes(c.reserveEmailMissing));
  assert.ok(!markup.includes(c.reserveEmailHint));
  assert.match(markup, new RegExp(`<button>${c.reserveConfirm}</button>`));
});

test('a room another lead has booked says who booked it and cannot be confirmed', () => {
  const markup = render({ room: { ...room, bookedBy: 'สมชาย' } });
  assert.ok(markup.includes(c.reserveTaken.replace('{name}', 'สมชาย')));
  assert.match(markup, new RegExp(`<button disabled="">${c.reserveConfirm}</button>`));
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
  for (const identityNumber of ['A1234', '1-2345-67890-12-3', 'AB 1234567']) assert.deepEqual(profile.tenantProfileIssues(form({ identityNumber })), {}, identityNumber);
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
  for (const [, shown] of cases.slice(0, 8)) assert.deepEqual(profile.tenantProfileIssues(form({ identityNumber: shown })), {}, shown);
});

test('the request body is trimmed and carries the display name', () => {
  assert.deepEqual(profile.tenantProfileBody(form({ firstName: ' สมหญิง ', lastName: '', phone: ' 0812345678 ', email: ' a@b.co ', identityNumber: ' A1234567 ', note: ' vip ' })), { name: 'สมหญิง', firstName: 'สมหญิง', lastName: '', phone: '0812345678', email: 'a@b.co', note: 'vip', identityNumber: 'A1234567', nationality: 'ไทย' });
});
