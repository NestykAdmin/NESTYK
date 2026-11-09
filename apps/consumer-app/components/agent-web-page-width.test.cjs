// W1 (Mos 5 Nov 2026): create forms in a centred column on the agent web; lists keep the full width.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const dir = path.join(__dirname, 'agent-web');
const source = ts.transpileModule(fs.readFileSync(path.join(dir, 'navigation.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', source)(() => ({}), mod, mod.exports);
const { agentWebPageWidth } = mod.exports;

test('add room, add lead and create tenant are form pages', () => {
  assert.equal(agentWebPageWidth('createListing'), 'form');
  // W17 (Mos 6 Nov 2026): add lead also has the readiness panel beside the form.
  assert.equal(agentWebPageWidth('createLead'), 'form-aside');
  assert.equal(agentWebPageWidth('clients', 'tenant'), 'form');
});

test('lists, Dashboard, calendar and detail pages keep the full width', () => {
  for (const tab of ['dashboard', 'listingRoom', 'listingLead', 'clients', 'calendar', 'leadDetail', 'contracts']) {
    assert.equal(agentWebPageWidth(tab, null), 'wide', tab);
  }
});

test('the shell marks <main> and the CSS narrows every content box through the shared width variable', () => {
  const shell = fs.readFileSync(path.join(dir, 'AgentWorkspace.web.tsx'), 'utf8');
  assert.match(shell, /data-page-width=\{agentWebPageWidth\(props\.activeTab, props\.creating\)\}/);
  const css = fs.readFileSync(path.join(dir, 'agent-workspace.css'), 'utf8');
  assert.match(css, /\.aw-main\[data-page-width="form"\] \{\s*--nestyk-web-content-max-width:/);
});
