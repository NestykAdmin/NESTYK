const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

const root = path.resolve(__dirname, '../../..');
const cache = new Map();
let state = [];
let cursor = 0;
const theme = { screenTitle: '#211E1E', textSecondary: '#64748B' };
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const localRequire = name => {
    if (name.endsWith('.css')) return {};
    if (name === 'react') return { ...React, useEffect() {}, useRef: () => ({ current: null }), useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], value => { state[index] = value; }];
    } };
    if (name === '@nestyk/i18n') return { useLocale: () => ({ locale: 'en', t: load(`${root}/packages/i18n/src/locales/en.ts`).en }) };
    if (name === '@nestyk/ui/native') return { useMobileTheme: () => ({ theme }), MobileIcon: 'MobileIcon', MobileStatusPill: 'MobileStatusPill', MobileFilterChip: 'MobileFilterChip' };
    if (!name.startsWith('.')) return require(name);
    const base = path.resolve(path.dirname(filename), name);
    return load([base, `${base}.ts`, `${base}.tsx`].find(file => fs.existsSync(file) && fs.statSync(file).isFile()));
  };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText)(localRequire, module, module.exports);
  return module.exports;
}
function nodes(element) {
  if (element == null || typeof element === 'boolean') return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!React.isValidElement(element)) return [element];
  if (element.type === React.Fragment) return nodes(element.props.children);
  if (typeof element.type === 'function') return nodes(element.type(element.props));
  return [element, ...nodes(element.props.children)];
}
const ui = load(path.join(__dirname, 'agent-web/ui/index.ts'));
const render = (Component, props) => { cursor = 0; return nodes(React.createElement(Component, props)); };
const byType = (tree, type) => tree.filter(node => node?.type === type);
const text = tree => tree.filter(node => typeof node === 'string' || typeof node === 'number').join('|');

test('status intents map every app status and fall back to neutral', () => {
  assert.deepEqual(['available', 'booked', 'rented', 'needs_edit', 'draft', null].map(ui.roomStatusIntent), ['done', 'prog', 'neutral', 'crit', 'neutral', 'neutral']);
  assert.deepEqual(['new', 'inprogress', 'viewing', 'booked', 'lost'].map(ui.leadStatusIntent), ['attn', 'prog', 'prog', 'done', 'neutral']);
  assert.deepEqual(['pending', 'awaiting_review', 'overdue', 'paid'].map(ui.billStatusIntent), ['prog', 'attn', 'crit', 'done']);
  assert.deepEqual(['slip', 'overdue', 'signing', 'renewal'].map(ui.tenantWorkIntent), ['attn', 'crit', 'prog', 'attn']);
  const now = new Date('2026-11-03T10:00:00+07:00');
  assert.equal(ui.viewingIntent('scheduled', '2026-11-03T09:00:00+07:00', now), 'attn');
  assert.equal(ui.viewingIntent('scheduled', '2026-11-03T11:00:00+07:00', now), 'prog');
  assert.equal(ui.viewingIntent('done', null, now), 'done');
  assert.equal(ui.viewingIntent('cancelled', null, now), 'neutral');
  assert.deepEqual([...ui.STATUS_INTENTS].sort(), Object.keys(ui.STATUS_INTENT_TONES).sort());
});

test('StatusBadge and StatusFilterChip reuse the app components with intent colours', () => {
  const [pill] = byType(render(ui.StatusBadge, { label: 'Overdue', intent: 'crit' }), 'MobileStatusPill');
  assert.equal(pill.props.label, 'Overdue');
  // v1.2: badges have no border; the pill gets the intent fill, text and dot (dark mode is resolved by the pill).
  const { bg, fg, dot } = ui.STATUS_INTENT_TONES.crit;
  assert.deepEqual(pill.props.tone, { bg, fg, dot });
  assert.equal(pill.props.style, undefined);
  const onPress = () => {};
  const [all] = byType(render(ui.StatusFilterChip, { label: 'All', count: 36, selected: true, onPress }), 'MobileFilterChip');
  assert.equal(all.props.tone, undefined);
  assert.equal(all.props.count, 36);
  const [fresh] = byType(render(ui.StatusFilterChip, { label: 'New', count: 6, onPress, intent: 'attn', testID: 'leads.filter.new' }), 'MobileFilterChip');
  assert.equal(fresh.props.tone, ui.STATUS_INTENT_TONES.attn);
  assert.equal(fresh.props.testID, 'leads.filter.new');
  assert.equal(fresh.props.onPress, onPress);
});

test('WebPageHeader shows the breadcrumb only on deep pages', () => {
  let shallow = render(ui.WebPageHeader, { breadcrumb: [{ label: 'Rooms' }], description: 'All rooms' });
  assert.equal(byType(shallow, 'nav').length, 0);
  assert.ok(text(shallow).includes('All rooms'));
  const calls = [];
  const deep = render(ui.WebPageHeader, { breadcrumb: [{ label: 'Room Listings', onPress: () => calls.push('rooms') }, { label: 'Add room' }], actions: React.createElement('button', null, 'Save') });
  const [nav] = byType(deep, 'nav');
  assert.equal(nav.props['aria-label'], 'Breadcrumb');
  const [link] = byType(deep, 'button').filter(node => node.props.onClick);
  link.props.onClick();
  assert.deepEqual(calls, ['rooms']);
  assert.equal(deep.find(node => node?.props?.['aria-current'] === 'page').props.children, 'Add room');
  assert.ok(text(deep).includes('Save'));
});

test('WebMenu opens, runs the chosen item, closes, and keeps disabled items inert', () => {
  state = [];
  const calls = [];
  const props = { label: 'Create', trigger: '+ Create', items: [
    { key: 'room', label: 'Add room', onSelect: () => calls.push('room') },
    { key: 'team', label: 'Team', disabled: true, badge: 'Coming soon' },
    { key: 'th', label: 'ไทย', checked: true },
  ] };
  let tree = render(ui.WebMenu, props);
  const trigger = byType(tree, 'button')[0];
  assert.equal(trigger.props['aria-expanded'], false);
  assert.equal(tree.filter(node => node?.props?.role === 'menu').length, 0);
  trigger.props.onClick();
  tree = render(ui.WebMenu, props);
  const items = tree.filter(node => node?.props?.className === 'awu-menu-item');
  assert.equal(items.length, 3);
  assert.equal(items[1].props.disabled, true);
  assert.ok(text(tree).includes('Coming soon'));
  assert.equal(items[2].props.role, 'menuitemradio');
  assert.equal(items[2].props['aria-checked'], true);
  items[0].props.onClick();
  assert.deepEqual(calls, ['room']);
  tree = render(ui.WebMenu, props);
  assert.equal(tree.filter(node => node?.props?.role === 'menu').length, 0);
});

test('WebDialog labels itself with its title and closes from the button and Esc', () => {
  const calls = [];
  const tree = render(ui.WebDialog, { open: true, title: 'Schedule viewing', onClose: () => calls.push('close'), testID: 'viewing', footer: React.createElement('button', null, 'Save') });
  const [dialog] = byType(tree, 'dialog');
  const [heading] = byType(tree, 'h2');
  assert.equal(dialog.props['aria-labelledby'], heading.props.id);
  assert.equal(heading.props.children, 'Schedule viewing');
  byType(tree, 'button').find(node => node.props['aria-label'] === 'Close').props.onClick();
  dialog.props.onCancel({ preventDefault() {} });
  dialog.props.onClick({ target: 1, currentTarget: 2 });
  assert.deepEqual(calls, ['close', 'close']);
  assert.equal(byType(render(ui.WebDialog, { open: false, title: 'x', onClose() {} }), 'h2').length, 0);
});

test('the breadcrumb label exists in all four locales', () => {
  for (const locale of ['en', 'th', 'ja', 'zh']) {
    const t = load(`${root}/packages/i18n/src/locales/${locale}.ts`)[locale];
    assert.ok(t.agent.dashboard.webWorkspace.breadcrumb, locale);
  }
});
