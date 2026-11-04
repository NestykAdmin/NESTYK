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
    if (name === '@nestyk/ui/native') return { useMobileTheme: () => ({ theme, isDark: false, setThemeMode() {} }), MobileIcon: () => null, MobileNestykLogo: () => null, MobileModePage: 'NativePage', MobileSectionHeader: 'NativeHeader', isAgentComingSoonTab: load(`${root}/packages/ui/src/config/agentComingSoon.ts`).isAgentComingSoonTab };
    if (name === '@nestyk/ui/web-content') return load(`${root}/packages/ui/src/shells/WebContentContainer.tsx`);
    if (name === 'react-native') return { View: () => null, StyleSheet: { create: (styles) => styles } };
    if (name === 'react-native-webview') return { WebView: () => null };
    if (!name.startsWith('.')) return require(name);
    const base = path.resolve(path.dirname(filename), name);
    return load([base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find(file => fs.existsSync(file) && fs.statSync(file).isFile()));
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
const button = (tree, label) => tree.find((node) => node?.type === 'button' && node.props.children === label);
function openAccountMenu(input) {
  const manage = button(render(input), 'Manage account');
  assert.ok(manage);
  manage.props.onClick();
  return render(input);
}

test('sidebar groups: Menu (Listing and Tenants open sub-pages), More, Finance and Workspace; coming-soon items stay disabled', () => {
  state = [];
  const calls = [];
  const tree = render(props({ onNavigate: tab => calls.push(tab), activeTab: 'createLead' }));
  const items = byClass(tree, 'aw-nav-item');
  items.filter(node => !node.props.disabled).forEach(node => node.props.onClick());
  // Listing and Tenants toggle their sub-pages instead of navigating while the sidebar is open
  assert.deepEqual(calls, ['dashboard', 'listingLead', 'calendar']);
  const soon = items.filter(node => node.props.disabled).map(node => node.props.title);
  assert.deepEqual(soon, ['Contacts · Coming soon', 'Services · Coming soon', 'Contracts archive · Coming soon', 'Commission · Coming soon', 'Team · Coming soon']);
  assert.equal(items.find(node => node.props['aria-current'] === 'page').props.title, 'Leads');
  assert.equal(tree.filter(node => node?.type === 'nav').length, 4);
  assert.equal(byClass(tree, 'aw-nav-subitem').length, 0);
  assert.equal(tree.find(node => node?.type === 'h1').props.children, 'Create Lead');
});

test('the group of the current page opens with its sub-pages and the create links use onCreate', () => {
  state = [];
  const calls = [];
  const input = props({ activeTab: 'listingRoom', onNavigate: tab => calls.push(tab), onCreate: kind => calls.push(`create:${kind}`) });
  let tree = render(input);
  const subs = byClass(tree, 'aw-nav-subitem');
  assert.deepEqual(subs.map(node => node.props.children), ['Room Listings', 'Add listing']);
  assert.equal(subs[0].props['aria-current'], 'page');
  assert.equal(tree.find(node => node?.type === 'h1').props.children, 'Room Listings');
  subs.forEach(node => node.props.onClick());
  assert.deepEqual(calls, ['listingRoom', 'create:room']);
  // Opening Tenants shows the list and "Create tenant"
  byClass(tree, 'aw-nav-item').find(node => node.props.title === 'Tenants').props.onClick();
  tree = render(input);
  assert.deepEqual(byClass(tree, 'aw-nav-subitem').map(node => node.props.children), ['Room Listings', 'Add listing', 'All tenants', 'Create tenant']);
  state = [];
  tree = render(props({ activeTab: 'clients', creating: 'tenant', onCreate() {} }));
  assert.equal(tree.find(node => node?.type === 'h1').props.children, 'Create tenant');
  assert.equal(byClass(tree, 'aw-nav-subitem').find(node => node.props['aria-current'] === 'page').props.children, 'Create tenant');
});

test('collapsed sidebar: a group icon goes straight to its first page', () => {
  state = [];
  const calls = [];
  const input = props({ onNavigate: tab => calls.push(tab) });
  byClass(render(input), 'aw-collapse')[0].props.onClick();
  const tree = render(input);
  byClass(tree, 'aw-nav-item').find(node => node.props.title === 'Listing').props.onClick();
  byClass(tree, 'aw-nav-item').find(node => node.props.title === 'Tenants').props.onClick();
  assert.deepEqual(calls, ['listingRoom', 'clients']);
  assert.equal(byClass(tree, 'aw-nav-subitem').length, 0);
});

test('the + Create menu lists add room, create lead and create tenant for the agent only', () => {
  state = [];
  const calls = [];
  const input = props({ onCreate: kind => calls.push(kind) });
  const trigger = render(input).find(node => node?.type === 'button' && node.props['aria-label'] === 'Create');
  assert.ok(trigger);
  trigger.props.onClick();
  const menu = render(input).filter(node => node?.props?.className === 'awu-menu-item' && ['Add listing', 'New lead', 'Create tenant'].includes(node.props.children[1]?.props?.children));
  assert.equal(menu.length, 3);
  menu.forEach(node => node.props.onClick());
  assert.deepEqual(calls, ['room', 'lead', 'tenant']);
  state = [];
  assert.equal(render(props({ activeRole: 'landlord' })).some(node => node?.type === 'button' && node.props['aria-label'] === 'Create'), false);
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
    const t = load(`${root}/packages/i18n/src/locales/${language}.ts`)[language];
    const copy = t.agent.dashboard.webWorkspace;
    for (const key of ['menu', 'create', 'team', 'switchWorkspace', 'addWorkspace', 'manageWorkspace', 'collapse', 'expand']) assert.ok(copy[key], `${language}.${key}`);
    assert.ok(tree.includes(t.agent.dashboard.workspaceLabel));
    assert.ok(tree.includes(copy.menu));
    assert.equal(byClass(tree, 'aw-collapse')[0].props['aria-label'], copy.collapse);
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
  const open = openAccountMenu(props(editor));
  const edit = button(open, 'Edit Profile');
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

test('desktop account menu changes the password on every role', async () => {
  state = [];
  const saved = [];
  const opened = [];
  const menu = openAccountMenu(props({
    activeRole: 'landlord',
    onNavigate: (tab) => opened.push(tab),
    onChangePassword: async (input) => { saved.push(input); },
  }));
  const open = button(menu, 'Change Password');
  assert.ok(open);
  open.props.onClick();
  const formTree = render(props({
    activeRole: 'landlord',
    onNavigate: (tab) => opened.push(tab),
    onChangePassword: async (input) => { saved.push(input); },
  }));
  const fields = formTree.filter((node) => node?.type === 'input' && node.props.type === 'password');
  fields[0].props.onChange({ target: { value: 'old-secret' } });
  fields[1].props.onChange({ target: { value: 'Newsecret1' } });
  fields[2].props.onChange({ target: { value: 'Newsecret1' } });
  const submitted = render(props({
    activeRole: 'landlord',
    onNavigate: (tab) => opened.push(tab),
    onChangePassword: async (input) => { saved.push(input); },
  }));
  await submitted.find((node) => node?.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.deepEqual(saved, [{ currentPassword: 'old-secret', newPassword: 'Newsecret1' }]);
  const done = render(props({
    activeRole: 'landlord',
    onNavigate: (tab) => opened.push(tab),
    onChangePassword: async (input) => { saved.push(input); },
  }));
  assert.ok(done.includes('Your password has been updated.'));
  done.find((node) => node?.type === 'button' && node.props.children === 'OK').props.onClick();
  assert.deepEqual(opened, ['dashboard']);
});

test('Manage account groups edit profile, change password and delete account behind one button', () => {
  state = [];
  const input = props({
    onSaveProfile: async () => {},
    onChangePassword: async () => {},
    onLoadAccountDeletion: async () => ({ blocked: false, reasons: [], scheduledFor: null }),
    onDeleteAccount: async () => {},
  });
  const closed = render(input);
  assert.ok(button(closed, 'Manage account'));
  for (const label of ['Edit Profile', 'Change Password', 'Delete account']) assert.equal(button(closed, label), undefined);
  assert.equal(closed.some((node) => node?.type === 'select'), false);

  const opened = openAccountMenu(input);
  assert.equal(button(opened, 'Manage account'), undefined);
  for (const label of ['Edit Profile', 'Change Password', 'Delete account']) assert.ok(button(opened, label));

  button(opened, 'Cancel').props.onClick();
  assert.ok(button(render(input), 'Manage account'));

  state = [];
  assert.equal(button(render(props()), 'Manage account'), undefined);
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
  assert.ok(tree.includes('Landlord'));
  assert.ok(tree.includes('Landlord workspace'));
  assert.ok(tree.includes('Soon'));
  assert.equal(tree.filter(node => node?.type === 'nav').length, 2);
  assert.equal(byClass(tree, 'aw-nav-item').find(node => node.props['aria-current'] === 'page').props.title, 'Overview');
  byClass(tree, 'aw-nav-item').forEach(node => node.props.onClick());
  assert.deepEqual(calls, ['dashboard', 'contracts']);
  assert.equal(tree.find(node => node?.type === 'h1').props.children, 'Overview');
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

test('the workspace switcher lists only the roles the account holds, plus the active role', () => {
  const ROLE_VALUES = ['guest', 'tenant', 'landlord', 'agent', 'admin'];
  const listed = (input) => {
    state = [];
    render(input).find(node => node?.type === 'button' && node.props['aria-label'] === 'Switch workspace').props.onClick();
    return render(input).filter(node => node?.props?.role === 'menuitemradio').map(node => node.props['data-testid'].split('.').pop()).filter(role => ROLE_VALUES.includes(role));
  };
  assert.deepEqual(listed(props({ allowedRoles: ['guest', 'agent'] })), ['guest', 'agent']);
  assert.deepEqual(listed(props({ activeRole: 'landlord', allowedRoles: ['agent'] })), ['landlord', 'agent']);
  assert.deepEqual(listed(props()), ['guest', 'tenant', 'landlord', 'agent', 'admin']);
});

test('choosing another workspace changes role; add and manage workspace are coming soon', () => {
  const roles = [];
  const input = props({ allowedRoles: ['agent', 'tenant'], onRoleChange: role => roles.push(role) });
  state = [];
  render(input).find(node => node?.type === 'button' && node.props['aria-label'] === 'Switch workspace').props.onClick();
  const tree = render(input);
  const items = tree.filter(node => node?.props?.className === 'awu-menu-item');
  const byId = id => items.find(node => node.props['data-testid'] === `shell.workspace.${id}`);
  assert.equal(byId('agent').props['aria-checked'], true);
  byId('agent').props.onClick();
  byId('tenant').props.onClick();
  assert.deepEqual(roles, ['tenant']);
  assert.equal(items.filter(node => node.props.disabled).length, 2);
  assert.ok(tree.includes('Coming soon'));
});


test('top-level pages show their title only in the top bar; deep pages keep it beside the back button', () => {
  const { AgentSectionHeader } = load(path.join(__dirname, 'agent-web/AgentSectionHeader.web.tsx'));
  const top = nodes(AgentSectionHeader({ title: 'Leads' }));
  assert.equal(top.some(node => node?.type === 'h1' || node?.type === 'h2'), false);
  const deep = nodes(AgentSectionHeader({ title: 'Lead details', leading: 'back', onBackPress() {} }));
  assert.equal(deep.find(node => node?.type === 'h2').props.children, 'Lead details');
});
