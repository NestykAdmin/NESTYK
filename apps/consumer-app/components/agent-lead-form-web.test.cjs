// W17 (Mos 6 Nov 2026): agent web add/edit lead page. Same CreateLeadForm and flow as the app; the web adds a frame and a side panel.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

test('CreateLeadForm: the web props are optional and only report or switch tabs', () => {
  const form = read('CreateLeadForm.tsx');
  assert.match(form, /onDraftChange\?: \(draft: LeadFormDraft\) => void;/);
  assert.match(form, /requestedTab\?: \{ tab: LeadFormTab; nonce: number \};/);
  assert.match(form, /onDraftChange\?\.\(\{\s*firstName: form\.firstName,\s*phoneDigits: phone\.digits,\s*budgetMax: form\.budgetMax,\s*pinCount: pins\.length,\s*tab,\s*\}\);/);
  assert.match(form, /\}, \[onDraftChange, form\.firstName, phone\.digits, form\.budgetMax, pins\.length, tab\]\);/);
  // A tab request goes through the existing switchTab (scroll to top), nothing else.
  assert.match(form, /if \(requestedTab\) switchTab\(requestedTab\.tab\);/);
  // Validation, body and save stay as they were.
  assert.match(form, /if \(!firstName\) next\.firstName = c\.required;/);
  assert.match(form, /if \(!phone\.digits\) next\.phone = c\.required;/);
});

const WEB_FORM_KEYS = [
  'createHint', 'editHint', 'readinessTitle', 'matchReady', 'matchMissing', 'itemFirstName', 'itemPhone',
  'itemBudgetMax', 'itemPins', 'itemDone', 'itemMissing', 'noteNeedContact', 'noteSaveFirst', 'noteReady',
  'statusOnSave', 'newTag', 'showPanel', 'hidePanel', 'requiredForSave', 'usedForMatch',
];
test('panel words exist in all four languages and in the types', () => {
  for (const lang of ['en', 'th', 'zh', 'ja']) {
    const s = fs.readFileSync(path.join(root, `packages/i18n/src/locales/${lang}.ts`), 'utf8');
    const leads = s.slice(s.indexOf('\n    leads: {'));
    const block = leads.slice(leads.indexOf('\n      webForm: {'), leads.indexOf('\n      web: {'));
    assert.ok(block.startsWith('\n      webForm: {'), `${lang}: agent.leads.webForm before agent.leads.web`);
    for (const key of WEB_FORM_KEYS) assert.match(block, new RegExp(`\\n        ${key}: '[^']+',`), `${lang}.${key}`);
  }
  const types = fs.readFileSync(path.join(root, 'packages/i18n/src/types.ts'), 'utf8');
  const leads = types.slice(types.indexOf('\n    leads: {'));
  const block = leads.slice(leads.indexOf('\n      webForm: {'), leads.indexOf('\n      web: {'));
  for (const key of WEB_FORM_KEYS) assert.match(block, new RegExp(`\\n        ${key}: string;`), `types.${key}`);
});

test('native and phone keep the form as it is (no frame, no props)', () => {
  const native = read('agent-web/AgentLeadFormPage.tsx');
  assert.match(native, /return <>\{children\(\{\}\)\}<\/>;/);
});

test('add lead pages are wider than the other forms (form + side panel)', () => {
  const nav = read('agent-web/navigation.ts');
  assert.match(nav, /export type AgentWebPageWidth = "wide" \| "form" \| "form-aside";/);
  assert.match(nav, /tab === "createLead"\) return "form-aside";/);
  const css = read('agent-web/agent-workspace.css');
  assert.match(css, /\.aw-main\[data-page-width="form-aside"\] \{\s*--nestyk-web-content-max-width:/);
});

// ---- render harness for the web page ----
const ts = require('typescript');
const React = require('react');
const cache = new Map();
let current, locale = 'en';
const hooks = {
  ...React,
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useEffect() {},
  useState(initial) {
    const h = current, i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = typeof initial === 'function' ? initial() : initial;
    return [h.slots[i], (value) => { h.slots[i] = typeof value === 'function' ? value(h.slots[i]) : value; }];
  },
};
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', output)((name) => {
    if (name === 'react') return hooks;
    if (name.endsWith('.css')) return {};
    if (name === '@nestyk/i18n') return { useLocale: () => ({ locale, t: load(`${root}/packages/i18n/src/locales/${locale}.ts`)[locale] }) };
    if (name === '@nestyk/ui/native') return { MobileIcon: 'MobileIcon' };
    if (name === './ui') return { StatusBadge: 'StatusBadge' };
    if (!name.startsWith('.')) return require(name);
    const base = path.resolve(path.dirname(filename), name);
    return load([`${base}.ts`, `${base}.tsx`].find((f) => fs.existsSync(f) && fs.statSync(f).isFile()));
  }, module, module.exports);
  return module.exports;
}
function nodes(element) {
  if (element == null || typeof element === 'boolean') return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!React.isValidElement(element)) return [element];
  return [element, ...nodes(element.props.children)];
}
const byTestId = (tree, id) => tree.find((n) => n?.props?.['data-testid'] === id);
const copy = () => load(`${root}/packages/i18n/src/locales/${locale}.ts`)[locale].agent.leads.webForm;
function harness(mode = 'create') {
  const binds = [];
  const h = { cursor: 0, slots: [], binds, props: { mode, children: (bind) => { binds.push(bind); return React.createElement('CreateLeadForm', bind); } } };
  h.render = () => { current = h; h.cursor = 0; return nodes(load(path.join(__dirname, 'agent-web/AgentLeadFormPage.web.tsx')).AgentLeadFormPage(h.props)); };
  return h;
}
const draft = (over = {}) => ({ firstName: '', phoneDigits: '', budgetMax: '', pinCount: 0, tab: 'profile', ...over });

test('web: the form gets a draft reporter; the panel follows what is typed', () => {
  const h = harness();
  let tree = h.render();
  assert.ok(tree.some((n) => n?.type === 'CreateLeadForm'));
  assert.equal(typeof h.binds.at(-1).onDraftChange, 'function');
  assert.equal(byTestId(tree, 'leadForm.readiness.firstName').props['data-done'], 'false');
  assert.ok(tree.includes(copy().noteNeedContact));
  h.binds.at(-1).onDraftChange(draft({ firstName: 'Nalin', phoneDigits: '812345678' }));
  tree = h.render();
  assert.equal(byTestId(tree, 'leadForm.readiness.firstName').props['data-done'], 'true');
  assert.equal(byTestId(tree, 'leadForm.readiness.pins').props['data-done'], 'false');
  assert.ok(tree.includes(copy().noteSaveFirst));
  assert.ok(tree.includes(copy().matchMissing));
  h.binds.at(-1).onDraftChange(draft({ firstName: 'Nalin', phoneDigits: '812345678', budgetMax: '18000', pinCount: 1 }));
  tree = h.render();
  assert.ok(tree.includes(copy().matchReady));
  assert.ok(tree.includes(copy().noteReady));
});

test('web: a panel row opens its tab through a new request each time', () => {
  const h = harness();
  byTestId(h.render(), 'leadForm.readiness.budgetMax').props.onClick();
  h.render();
  assert.deepEqual(h.binds.at(-1).requestedTab, { tab: 'matching', nonce: 1 });
  byTestId(h.render(), 'leadForm.readiness.phone').props.onClick();
  h.render();
  assert.deepEqual(h.binds.at(-1).requestedTab, { tab: 'profile', nonce: 2 });
});

test('web: "status when saved: New" only when adding; edit says edit', () => {
  let tree = harness('create').render();
  assert.ok(tree.includes(copy().statusOnSave));
  assert.ok(tree.some((n) => n?.type === 'StatusBadge' && n.props.label === copy().newTag));
  assert.ok(tree.includes(copy().createHint));
  tree = harness('edit').render();
  assert.equal(tree.includes(copy().statusOnSave), false);
  assert.ok(tree.includes(copy().editHint));
});

test('web: the checklist folds on narrow screens with a real toggle', () => {
  const h = harness();
  let toggle = byTestId(h.render(), 'leadForm.readiness.toggle');
  assert.equal(toggle.type, 'button');
  assert.equal(toggle.props['aria-expanded'], false);
  toggle.props.onClick();
  toggle = byTestId(h.render(), 'leadForm.readiness.toggle');
  assert.equal(toggle.props['aria-expanded'], true);
});

test('web: all four languages render without missing words', () => {
  for (const language of ['th', 'en', 'zh', 'ja']) {
    locale = language;
    const tree = harness().render();
    assert.equal(tree.some((n) => n === undefined || (typeof n === 'string' && n.includes('undefined'))), false, language);
  }
  locale = 'en';
});

test('index: desktop agent web frames both add and edit; phone and phone-width web render the form alone, same props', () => {
  const index = fs.readFileSync(path.join(__dirname, '../app/index.tsx'), 'utf8');
  assert.match(index, /import \{ AgentLeadFormPage \} from '\.\.\/components\/agent-web\/AgentLeadFormPage';/);
  const branch = index.slice(index.indexOf("if (activeTab === 'createLead') {"), index.indexOf("if (activeTab === 'createListing') {"));
  assert.match(branch, /const leadForm = \(bind: LeadFormBind\) =>/);
  assert.equal((branch.match(/\{\.\.\.bind\}/g) || []).length, 2, 'both forms get the bind props');
  assert.match(branch, /\{isAgentWeb \? \(\s*<AgentLeadFormPage[^>]*mode=\{leadEdit && activeLead \? 'edit' : 'create'\}>\s*\{leadForm\}\s*<\/AgentLeadFormPage>\s*\) : \(\s*leadForm\(\{\}\)\s*\)\}/);
  // The save flow is the app's: edit returns to where it came from, add shows "saved" and opens the leads list.
  assert.match(branch, /setActiveTab\(leadEdit\.returnTab\);/);
  assert.match(branch, /Alert\.alert\(t\.agent\.leads\.saved\);\s*setSecondaryReturnTab\(null\);\s*setActiveTab\('listingLead'\);/);
});
