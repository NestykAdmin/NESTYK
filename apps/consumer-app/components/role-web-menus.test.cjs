// Admin and self owner web sidebars (Mos 18 Nov 2026): only the overview works; the rest is "coming soon".
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const mod = { exports: {} };
new Function('require', 'module', 'exports', ts.transpile(fs.readFileSync(path.join(__dirname, 'agent-web/role-web-menus.ts'), 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }))(() => ({}), mod, mod.exports);
const { adminWebNavSections, selfOwnerWebNavSections } = mod.exports;
const copy = {
  comingSoon: 'Coming soon', dashboard: 'Dashboard', services: 'Services',
  drawer: { users: 'Users', tickets: 'Tickets', system: 'System', audit: 'Audit log', opsSettings: 'Operations settings' },
  admin: { main: 'Platform' },
  selfOwner: { main: 'My rooms', money: 'Tenants and money', listings: 'Rooms and listings', listingsView: 'View rooms', listingsCreate: 'Add room', interested: 'Interested people', viewings: 'Viewings', tenants: 'Tenants', contracts: 'Contracts', billsIncome: 'Bills and income', repairs: 'Repairs' },
};

function check(sections, captions, ids) {
  assert.deepEqual(sections.map((s) => s.caption), captions);
  const items = sections.flatMap((s) => s.items);
  assert.deepEqual(items.map((i) => i.id), ids);
  const [overview, ...rest] = items;
  assert.equal(overview.disabled, undefined);
  for (const item of rest) {
    assert.equal(item.disabled, true, item.id);
    assert.equal(item.badge, 'Coming soon', item.id);
    assert.equal(item.title, `${item.label} · Coming soon`);
  }
}

test('admin sidebar: overview, users, tickets, services, then System: audit log and operations settings', () => {
  const calls = [];
  const sections = adminWebNavSections(copy, true, () => calls.push('dashboard'));
  check(sections, ['Platform', 'System'], ['dashboard', 'users', 'tickets', 'services', 'audit', 'opsSettings']);
  assert.equal(sections[0].items[0].active, true);
  sections[0].items[0].onPress();
  assert.deepEqual(calls, ['dashboard']);
});

test('self owner sidebar: my rooms (overview and rooms work, 19 Nov 2026), then tenants and money', () => {
  const calls = [];
  const sections = selfOwnerWebNavSections(copy, 'listingRoom', (tab) => calls.push(tab));
  assert.deepEqual(sections.map((s) => s.caption), ['My rooms', 'Tenants and money']);
  const items = sections.flatMap((s) => s.items);
  assert.deepEqual(items.map((i) => i.id), ['dashboard', 'listings', 'interested', 'viewings', 'tenants', 'contracts', 'billsIncome', 'repairs']);
  const [overview, listings, ...rest] = items;
  for (const item of [overview, listings]) assert.equal(item.disabled, undefined, item.id);
  assert.equal(overview.active, false);
  assert.equal(listings.active, true);
  assert.equal(listings.label, 'Rooms and listings');
  overview.onPress();
  listings.onPress();
  assert.deepEqual(calls, ['dashboard', 'listingRoom']);
  for (const item of rest) {
    assert.equal(item.disabled, true, item.id);
    assert.equal(item.title, `${item.label} · Coming soon`);
  }
  assert.equal(selfOwnerWebNavSections(copy, 'dashboard', () => {})[0].items[0].active, true);
});

test('admin and self owner on the web shell get no phone header (profile picture and bell are already in the shell)', () => {
  const index = fs.readFileSync(path.join(__dirname, '../app/index.tsx'), 'utf8');
  assert.match(index, /\) : isAdminWeb \|\| isSelfOwnerWeb \? \(\s*\/\/[^\n]*\n\s*null\s*\) : partyInbox \? \(/);
});

// Sub menu like the agent's Listing group (Jom 20 Nov 2026): view rooms and add a room.
test('self owner "rooms and listings" is a group with view rooms and add room', () => {
  const calls = [];
  const listings = (tab) => selfOwnerWebNavSections(copy, tab, (next) => calls.push(next))[0].items[1];
  const group = listings('createListing');
  assert.deepEqual(group.children.map((c) => [c.id, c.label]), [['rooms', 'View rooms'], ['add', 'Add room']]);
  assert.equal(group.active, true);
  assert.deepEqual(group.children.map((c) => !!c.active), [false, true]);
  assert.deepEqual(listings('listingRoom').children.map((c) => !!c.active), [true, false]);
  assert.equal(listings('dashboard').active, false);
  group.children.forEach((c) => c.onPress());
  group.onPress();
  assert.deepEqual(calls, ['listingRoom', 'createListing', 'listingRoom']);
});
