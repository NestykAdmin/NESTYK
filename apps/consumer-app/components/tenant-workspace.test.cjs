const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '../../..');
const cache = new Map();
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const localRequire = name => {
    if (!name.startsWith('.')) return require(name);
    const base = path.resolve(path.dirname(filename), name);
    return load([base, `${base}.ts`, `${base}.tsx`].find(file => fs.existsSync(file) && fs.statSync(file).isFile()));
  };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText)(localRequire, module, module.exports);
  return module.exports;
}

const nav = load(path.join(__dirname, 'tenant-web/navigation.ts'));

test('tenant desktop menu follows the mobile destinations', () => {
  assert.deepEqual(nav.TENANT_WEB_MENU.map(item => item.id), [
    'dashboard', 'living', 'contracts', 'bills', 'services', 'leaseDoc', 'receipts',
  ]);
  assert.deepEqual(
    nav.TENANT_WEB_MENU.filter(item => item.section === 'main').map(item => item.id),
    ['dashboard', 'living', 'contracts', 'bills'],
  );
  assert.deepEqual(
    nav.TENANT_WEB_MENU.filter(item => item.target.type === 'soon').map(item => item.id),
    ['living', 'leaseDoc', 'receipts'],
  );
});

// QA web flow bugs 6 Nov 2026 item 1: Living (/tenant/home) showed one sample lease ("The Base Sukhumvit 77
// (Room 1804)") to every tenant. It is "coming soon" in the web sidebar and the mobile tab bar until it is real.
test('Living is coming soon on web and in the mobile tab bar, and the sample lease is gone', () => {
  const { getTabsForRole } = load(path.join(root, 'packages/ui/src/config/mobileTabMatrix.ts'));
  const tenantTabs = getTabsForRole('tenant');
  assert.deepEqual(tenantTabs.filter(tab => tab.comingSoon).map(tab => tab.key), ['living']);
  // Guest services are closed for now (Mos 24 Nov 2026): the tab shows "coming soon" and cannot be pressed.
  assert.deepEqual(getTabsForRole('guest').filter(tab => tab.comingSoon).map(tab => tab.key), ['services']);
  const shell = fs.readFileSync(path.join(__dirname, '../app/index.tsx'), 'utf8');
  assert.ok(shell.includes("activeTab === 'living' || (activeRole === 'guest' && activeTab === 'services')"), 'a direct link to guest services shows coming soon');
  for (const role of ['landlord', 'agent', 'admin']) {
    assert.deepEqual(getTabsForRole(role).filter(tab => tab.comingSoon), [], role);
  }
  const home = fs.readFileSync(path.join(__dirname, '../app/index.tsx'), 'utf8');
  assert.ok(!home.includes('The Base Sukhumvit 77'));
  assert.ok(!home.includes('Active Lease'));
});

test('tenant sidebar highlight keeps room history on Contracts', () => {
  assert.equal(nav.tenantWebActiveId({ partyInbox: true, activeTab: 'bills' }), 'contracts');
  assert.equal(nav.tenantWebActiveId({ partyInbox: false, activeTab: 'living' }), 'living');
  assert.equal(nav.tenantWebActiveId({ partyInbox: false, activeTab: 'bills' }), 'bills');
  assert.equal(nav.tenantWebActiveId({ partyInbox: false, activeTab: 'services' }), 'services');
  assert.equal(nav.tenantWebActiveId({ partyInbox: false, activeTab: 'menu' }), null);
});

test('tenant menu labels and workspace name exist in all four locales', () => {
  for (const language of ['th', 'en', 'zh', 'ja']) {
    const messages = load(`${root}/packages/i18n/src/locales/${language}.ts`)[language];
    for (const item of nav.TENANT_WEB_MENU) assert.ok(nav.tenantWebLabel(item.id, messages.mobile));
    assert.ok(messages.tenant.webWorkspace.brandTag);
    assert.ok(messages.tenant.webWorkspace.workspaceLabel);
    assert.ok(messages.tenant.webWorkspace.main);
    assert.notEqual(messages.tenant.webWorkspace.brandTag, messages.owner.webWorkspace.brandTag);
  }
});

// Mos 24 Nov 2026: every role's bottom tab bar uses the agent style (ink icon and label, a short underline under the
// picked tab), and the underline takes the role's own colour (its role ring: guest yellow, agent emerald, admin gold).
test('bottom tab bar: underline style for every role, in the role colour', () => {
  const shell = fs.readFileSync(path.join(__dirname, '../app/index.tsx'), 'utf8');
  const bar = shell.slice(shell.indexOf('<MobileBottomTabBar'), shell.indexOf('/>', shell.indexOf('<MobileBottomTabBar')));
  assert.ok(!bar.includes("activeRole === 'agent' || isTenantWorkspace"), 'no longer only for the agent and the tenant workspace');
  assert.ok(bar.includes('indicatorColor={roleTileColors(activeRole, isDark).ring}'));
  assert.ok(bar.includes('activeTintColor={theme.screenTitle}'));
});
