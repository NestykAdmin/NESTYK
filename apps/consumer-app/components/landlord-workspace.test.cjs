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

const nav = load(path.join(__dirname, 'landlord-web/navigation.ts'));

test('landlord desktop menu follows the mobile destinations', () => {
  assert.deepEqual(nav.LANDLORD_WEB_MENU.map(item => item.id), [
    'dashboard', 'contracts', 'tenants', 'income', 'services', 'occupancy',
  ]);
  assert.deepEqual(
    nav.LANDLORD_WEB_MENU.filter(item => item.section === 'main').map(item => item.id),
    ['dashboard', 'contracts', 'tenants', 'income'],
  );
  assert.equal(nav.LANDLORD_WEB_MENU.find(item => item.id === 'occupancy').target.type, 'soon');
});

test('landlord sidebar highlight follows the open inbox before the tab underneath', () => {
  assert.equal(nav.landlordWebActiveId({ partyInbox: true, contractHistory: false, activeTab: 'income' }), 'contracts');
  assert.equal(nav.landlordWebActiveId({ partyInbox: true, contractHistory: true, activeTab: 'dashboard' }), 'tenants');
  assert.equal(nav.landlordWebActiveId({ partyInbox: false, contractHistory: true, activeTab: 'income' }), 'income');
  assert.equal(nav.landlordWebActiveId({ partyInbox: false, contractHistory: false, activeTab: 'services' }), 'services');
  assert.equal(nav.landlordWebActiveId({ partyInbox: false, contractHistory: false, activeTab: 'menu' }), null);
});

test('landlord menu labels and workspace name exist in all four locales', () => {
  for (const language of ['th', 'en', 'zh', 'ja']) {
    const messages = load(`${root}/packages/i18n/src/locales/${language}.ts`)[language];
    for (const item of nav.LANDLORD_WEB_MENU) assert.ok(nav.landlordWebLabel(item.id, messages.mobile));
    assert.ok(messages.owner.webWorkspace.brandTag);
    assert.ok(messages.owner.webWorkspace.workspaceLabel);
    assert.ok(messages.owner.webWorkspace.main);
    assert.notEqual(messages.owner.webWorkspace.brandTag, messages.agent.dashboard.webWorkspace.brandTag);
  }
});
