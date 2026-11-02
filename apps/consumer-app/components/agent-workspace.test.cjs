const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

const root = path.resolve(__dirname, '../../..');
const cache = new Map();
let locale = 'en';
let state = [];
let cursor = 0;
const theme = { mode: 'light', background: '#F8FAFC', surface: '#fff', screenTitle: '#1A2B48', textSecondary: '#64748B', border: '#E5E7EB' };
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
    if (name === '@nestyk/i18n') return { useLocale: () => ({ locale, t: load(`${root}/packages/i18n/src/locales/${locale}.ts`)[locale], setLocale() {} }) };
    if (name === '@nestyk/ui/native') return { useMobileTheme: () => ({ theme, isDark: false, setThemeMode() {} }), MobileIcon: () => null, MobileNestykLogo: () => null, MobileModePage: 'NativePage', MobileSectionHeader: 'NativeHeader' };
    if (name === '@nestyk/ui/web-content') return load(`${root}/packages/ui/src/shells/WebContentContainer.tsx`);
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
const byClass = (tree, name) => tree.filter(node => node?.props?.className?.split(' ').includes(name));
function props(overrides = {}) {
  return { enabled: true, activeTab: 'dashboard', onNavigate() {}, onRoleChange() {}, onSignOut() {}, userName: 'Agent', userEmail: '', initials: 'AG', notificationCount: 2, notificationsOpen: false, onNotificationsOpen() {}, onNotificationsClose() {}, activityItems: [], messageItems: [], onNotificationsClear() {}, children: React.createElement('p', null, 'Body'), ...overrides };
}
function render(input) {
  cursor = 0;
  return nodes(load(path.join(__dirname, 'agent-web/AgentWorkspace.web.tsx')).AgentWorkspace(input));
}

test('sidebar provides the four main destinations and the same four More shortcuts', () => {
  state = [];
  const calls = [];
  const tree = render(props({ onNavigate: tab => calls.push(tab), activeTab: 'createLead' }));
  const buttons = byClass(tree, 'aw-nav-item').filter(node => !node.props.disabled);
  buttons.forEach(button => button.props.onClick());
  assert.deepEqual(calls, ['dashboard', 'listingRoom', 'listingLead', 'clients', 'calendar', 'contact', 'services', 'contracts']);
  assert.equal(buttons.find(node => node.props['aria-current'] === 'page').props.title, 'Leads');
  assert.equal(tree.filter(node => node?.type === 'nav').length, 3);
});

test('collapse state persists across page changes and busy forms disable navigation', () => {
  state = [];
  let tree = render(props());
  byClass(tree, 'aw-collapse')[0].props.onClick();
  tree = render(props({ activeTab: 'listingRoom', navigationDisabled: true }));
  assert.equal(byClass(tree, 'aw-collapsed').length, 1);
  assert.ok(byClass(tree, 'aw-nav-item').every(node => node.props.disabled));
  assert.equal(byClass(tree, 'aw-collapse')[0].props['aria-expanded'], false);
});

test('inactive and native workspaces pass through children without desktop containers', () => {
  state = [];
  assert.deepEqual(render(props({ enabled: false })).filter(node => React.isValidElement(node)).map(node => node.type), ['p']);
  const native = load(path.join(__dirname, 'agent-web/AgentWorkspace.tsx'));
  assert.deepEqual(nodes(native.AgentWorkspace(props())).filter(node => React.isValidElement(node)).map(node => node.type), ['p']);
  assert.equal(native.AgentWorkspacePage, 'NativePage');
});

test('web page preserves header, content and action bar but excludes mobile tabs', () => {
  const { AgentWorkspacePage } = load(path.join(__dirname, 'agent-web/AgentWorkspace.web.tsx'));
  const tree = nodes(AgentWorkspacePage({ header: 'Page heading', children: 'Page body', bottomBar: 'Save actions', tabBar: 'Mobile tabs', scrollable: false }));
  assert.ok(tree.includes('Page heading'));
  assert.ok(tree.includes('Page body'));
  assert.ok(tree.includes('Save actions'));
  assert.ok(!tree.includes('Mobile tabs'));
  assert.equal(byClass(tree, 'aw-page-fixed').length, 1);
});

test('web section header keeps existing add, back and edit callbacks', () => {
  const { AgentSectionHeader } = load(path.join(__dirname, 'agent-web/AgentSectionHeader.web.tsx'));
  const calls = [];
  const tree = nodes(AgentSectionHeader({ title: 'Room', leading: 'back', onBackPress: () => calls.push('back'), onAddPress: () => calls.push('add'), addAccessibilityLabel: 'Add room', onActionPress: () => calls.push('edit'), actionLabel: 'Edit' }));
  tree.filter(node => node?.type === 'button').forEach(node => node.props.onClick());
  assert.deepEqual(calls, ['back', 'edit', 'add']);
});

test('workspace labels exist in all four central locales', () => {
  for (const language of ['th', 'en', 'zh', 'ja']) {
    locale = language;
    state = [];
    const tree = render(props());
    const copy = load(`${root}/packages/i18n/src/locales/${language}.ts`)[language].agent.dashboard.webWorkspace;
    assert.ok(copy);
    assert.ok(tree.includes(copy.brandTag));
    assert.ok(tree.includes(copy.collapse));
  }
  locale = 'en';
});

test('the agent account menu saves a profile and other roles do not get that editor', async () => {
  state = [];
  const saved = [];
  const editor = {
    userName: 'Ann Agent',
    userPhone: '0800000000',
    onSaveProfile: async (input) => { saved.push(input); },
    onUploadAvatar: async () => 'https://cdn.example/a.jpg',
    onRemoveAvatar: async () => {},
  };
  const open = render(props(editor));
  const edit = open.find((node) => node?.type === 'button' && node.props.children === 'Edit Profile');
  assert.ok(edit);
  edit.props.onClick();
  const formTree = render(props(editor));
  formTree.find((node) => node?.type === 'input' && node.props.autoComplete === 'given-name').props.onChange({ target: { value: 'Anne' } });
  const submitted = render(props(editor));
  await submitted.find((node) => node?.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.deepEqual(saved, [{ firstName: 'Anne', lastName: 'Agent', phone: '0800000000' }]);

  state = [];
  const landlord = render(props({ activeRole: 'landlord', onSaveProfile: async () => {} }));
  assert.equal(landlord.some((node) => node?.props?.children === 'Edit Profile'), false);
});

test('a custom sidebar replaces the agent menu and ignores disabled items', () => {
  locale = 'en';
  state = [];
  const calls = [];
  const tree = render(props({
    activeRole: 'landlord',
    brandTag: 'LANDLORD WORKSPACE',
    workspaceLabel: 'Landlord workspace',
    navSections: [
      {
        id: 'main',
        caption: 'Workspace',
        items: [
          { id: 'dashboard', icon: 'grid', label: 'Overview', active: true, onPress: () => calls.push('dashboard') },
          { id: 'contracts', icon: 'clipboard', label: 'Contracts', onPress: () => calls.push('contracts') },
        ],
      },
      {
        id: 'more',
        caption: 'More',
        items: [
          { id: 'occupancy', icon: 'home', label: 'Occupancy', disabled: true, badge: 'Soon', title: 'Occupancy · Soon', onPress: () => calls.push('occupancy') },
        ],
      },
    ],
  }));
  assert.ok(tree.includes('LANDLORD WORKSPACE'));
  assert.ok(tree.includes('Landlord workspace'));
  assert.ok(tree.includes('Soon'));
  assert.equal(tree.filter(node => node?.type === 'nav').length, 2);
  assert.equal(byClass(tree, 'aw-nav-item').find(node => node.props['aria-current'] === 'page').props.title, 'Overview');
  byClass(tree, 'aw-nav-item').forEach(node => node.props.onClick());
  assert.deepEqual(calls, ['dashboard', 'contracts']);
  assert.equal(tree.find(node => node?.type === 'select').props.value, 'landlord');
  assert.ok(!tree.includes('Commission'));
});

test('desktop shell is used for the Agent, Landlord and Tenant roles on web', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../app/index.tsx'), 'utf8');
  const ast = ts.createSourceFile('index.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = ['isAgentWeb', 'isLandlordWeb', 'isTenantWeb', 'isDesktopWeb', 'Page', 'AgentHeader'];
  const expressions = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(ast))) expressions.set(node.name.getText(ast), node.initializer.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(expressions.size, names.length);
  const select = new Function('Platform', 'activeRole', 'AgentWorkspacePage', 'MobileModePage', 'AgentSectionHeader', 'MobileSectionHeader', `${[...expressions].map(([name, expression]) => `const ${name} = ${expression};`).join('\n')} return [${names.join(', ')}];`);
  for (const platform of ['web', 'ios', 'android']) {
    for (const role of ['guest', 'tenant', 'landlord', 'agent', 'admin']) {
      const agent = platform === 'web' && role === 'agent';
      const landlord = platform === 'web' && role === 'landlord';
      const tenant = platform === 'web' && role === 'tenant';
      const desktop = agent || landlord || tenant;
      assert.deepEqual(
        select({ OS: platform }, role, 'WebPage', 'NativePage', 'WebHeader', 'NativeHeader'),
        [agent, landlord, tenant, desktop, desktop ? 'WebPage' : 'NativePage', agent ? 'WebHeader' : 'NativeHeader'],
      );
    }
  }
  assert.match(source, /enabled=\{isDesktopWeb\}/);
  assert.match(source, /navSections=\{isLandlordWeb \? landlordNavSections : isTenantWeb \? tenantNavSections : undefined\}/);
  assert.match(source, /visible=\{!isDesktopWeb && drawerOpen\}/);
  assert.match(source, /visible=\{!isDesktopWeb && notificationsOpen\}/);
  assert.match(source, /isDesktopWeb \|\| \['createListing'/);
});
