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

test('admin sidebar: overview, users, tickets, services, then System: audit log and operations settings', () => {
  const calls = [];
  const sections = adminWebNavSections(copy, true, () => calls.push('dashboard'));
  check(sections, ['Platform', 'System'], ['dashboard', 'users', 'tickets', 'services', 'audit', 'opsSettings']);
  assert.equal(sections[0].items[0].active, true);
  sections[0].items[0].onPress();
  assert.deepEqual(calls, ['dashboard']);
});

test('self owner sidebar (round 2 sample menus): my rooms, then tenants and money', () => {
  const sections = selfOwnerWebNavSections(copy, false, () => {});
  check(sections, ['My rooms', 'Tenants and money'], ['dashboard', 'listings', 'interested', 'viewings', 'tenants', 'contracts', 'billsIncome', 'repairs']);
  assert.equal(sections[0].items[0].active, false);
});
