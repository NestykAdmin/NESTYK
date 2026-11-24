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
  admin: { main: 'Platform', viewing: { menu: 'Viewing requests', newCount: '{count} new' } },
  selfOwner: { main: 'My rooms', money: 'Tenants and money', listings: 'Rooms and listings', interested: 'Interested people', viewings: 'Viewings', tenants: 'Tenants', contracts: 'Contracts', billsIncome: 'Bills and income', repairs: 'Repairs' },
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

test('admin sidebar: overview, viewing requests (works, with the new count), users, tickets, services, then System', () => {
  const calls = [];
  const sections = adminWebNavSections(copy, 'dashboard', (id) => calls.push(id), 3);
  assert.deepEqual(sections.map((s) => s.caption), ['Platform', 'System']);
  const items = sections.flatMap((s) => s.items);
  assert.deepEqual(items.map((i) => i.id), ['dashboard', 'viewingRequests', 'users', 'tickets', 'services', 'audit', 'opsSettings']);
  const [overview, viewing, ...rest] = items;
  assert.equal(overview.active, true);
  assert.equal(viewing.active, false);
  assert.equal(viewing.disabled, undefined, 'viewing requests work (plan step 3, Mos 24 Nov 2026)');
  assert.equal(viewing.label, 'Viewing requests');
  assert.equal(viewing.count, 3);
  assert.equal(viewing.countLabel, '3 new', 'screen readers hear what the number means (review R9)');
  for (const item of rest) {
    assert.equal(item.disabled, true, item.id);
    assert.equal(item.badge, 'Coming soon', item.id);
  }
  overview.onPress();
  viewing.onPress();
  assert.deepEqual(calls, ['dashboard', 'viewingRequests']);
  const onViewing = adminWebNavSections(copy, 'viewingRequests', () => {}, 0).flatMap((s) => s.items);
  assert.equal(onViewing[1].active, true);
  assert.equal(onViewing[0].active, false);
  assert.equal(onViewing[1].count, undefined, 'no number when nothing is new');
  assert.equal(onViewing[1].countLabel, undefined);
});

test('self owner sidebar (round 2 sample menus): my rooms, then tenants and money', () => {
  const sections = selfOwnerWebNavSections(copy, false, () => {});
  check(sections, ['My rooms', 'Tenants and money'], ['dashboard', 'listings', 'interested', 'viewings', 'tenants', 'contracts', 'billsIncome', 'repairs']);
  assert.equal(sections[0].items[0].active, false);
});

test('admin and self owner on the web shell get no phone header (profile picture and bell are already in the shell)', () => {
  const index = fs.readFileSync(path.join(__dirname, '../app/index.tsx'), 'utf8');
  assert.match(index, /\) : isAdminWeb \|\| isSelfOwnerWeb \? \(\s*\/\/[^\n]*\n\s*null\s*\) : partyInbox \? \(/);
});
