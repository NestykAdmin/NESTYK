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
const theme = { mode: 'light', background: '#F8FAFC', surface: '#fff', screenTitle: '#211E1E', textSecondary: '#64748B', border: '#E5E7EB' };
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
    if (name === '@nestyk/ui/native') return { useMobileTheme: () => ({ theme, isDark: false, setThemeMode() {} }), roleOnDark: (c) => c, roleTileColors: load(`${root}/packages/ui/src/theme/tokens.ts`).roleTileColors, MobileIcon: () => null, MobileNestykLogo: () => null, MobileModePage: 'NativePage', MobileSectionHeader: 'NativeHeader', isAgentComingSoonTab: load(`${root}/packages/ui/src/config/agentComingSoon.ts`).isAgentComingSoonTab };
    if (name === '@nestyk/ui/web-content') return load(`${root}/packages/ui/src/shells/WebContentContainer.tsx`);
    if (name === '@nestyk/ui/cookie-consent') return load(`${root}/packages/ui/src/consent/cookieConsent.ts`);
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

test('sidebar groups (design จ2): Menu with Calendar, Documents and finance, one coming-soon row; coming-soon items stay disabled', () => {
  state = [];
  const calls = [];
  const tree = render(props({ onNavigate: tab => calls.push(tab), activeTab: 'createLead' }));
  const items = byClass(tree, 'aw-nav-item');
  items.filter(node => !node.props.disabled).forEach(node => node.props.onClick());
  // Listing and Tenants toggle their sub-pages instead of navigating while the sidebar is open
  assert.deepEqual(calls, ['dashboard', 'listingLead', 'calendar']);
  const soon = items.filter(node => node.props.disabled).map(node => node.props.title);
  assert.deepEqual(soon, ['Contracts archive · Coming soon', 'Commission · Coming soon', 'Contacts · Services · Team · Coming soon']);
  assert.equal(items.find(node => node.props['aria-current'] === 'page').props.title, 'Leads');
  assert.deepEqual(byClass(tree, 'aw-nav').map(node => node.props['aria-label']), ['Menu', 'Documents and finance']);
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
  const creatingTenant = props({ activeTab: 'clients', creating: 'tenant', onCreate() {} });
  tree = render(creatingTenant);
  assert.equal(tree.find(node => node?.type === 'h1').props.children, 'Create tenant');
  // W4 layout ก (Mos 17 Nov 2026): the menu folds to icons on the create-tenant page; the toggle opens it again.
  assert.equal(byClass(tree, 'aw-nav-subitem').length, 0);
  byClass(tree, 'aw-collapse')[0].props.onClick();
  tree = render(creatingTenant);
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

/** A settings row or menu row: a button whose content (icon + label) holds the label. */
const row = (tree, label) => tree.find((node) => node?.type === 'button' && nodes(node.props.children).includes(label));

test('settings profile: the agent edits inline with a save bar; other roles see it read-only (Mos 18 Nov 2026)', async () => {
  locale = 'en';
  state = [];
  const saved = [];
  const editor = {
    settingsSection: 'profile',
    userName: 'Ann Agent',
    userEmail: 'ann@example.com',
    userPhone: '0800000000',
    onSaveProfile: async (input) => { saved.push(input); },
    onUploadAvatar: async () => 'https://cdn.example/a.jpg',
    onRemoveAvatar: async () => {},
  };
  const page = render(props(editor));
  assert.ok(page.some((node) => node?.props?.['data-testid'] === 'settings.page'));
  assert.ok(page.some((node) => node?.props?.['data-testid'] === 'settings.section.profile'));
  assert.equal(page.includes('Body'), false, 'the settings page replaces the page body');
  // The form is open straight away with the saved values; nothing to save yet.
  const first = page.find((node) => node?.type === 'input' && node.props.autoComplete === 'given-name');
  assert.equal(first.props.value, 'Ann');
  const email = page.find((node) => node?.type === 'input' && node.props.value === 'ann@example.com');
  assert.equal(email.props.readOnly, true, 'email is read-only');
  const submit = (tree) => tree.find((node) => node?.type === 'button' && node.props.type === 'submit');
  assert.equal(submit(page).props.disabled, true, 'save waits for a change');
  first.props.onChange({ target: { value: 'Anne' } });
  const edited = render(props(editor));
  assert.equal(submit(edited).props.disabled, false);
  await edited.find((node) => node?.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.deepEqual(saved, [{ firstName: 'Anne', lastName: 'Agent', phone: '0800000000' }]);
  // Cancel brings back the saved value.
  state = [];
  render(props(editor)).find((node) => node?.type === 'input' && node.props.autoComplete === 'given-name').props.onChange({ target: { value: 'X' } });
  const dirty = render(props(editor));
  dirty.find((node) => node?.type === 'button' && node.props.children === 'Cancel').props.onClick();
  assert.equal(render(props(editor)).find((node) => node?.type === 'input' && node.props.autoComplete === 'given-name').props.value, 'Ann');

  for (const role of ['tenant', 'landlord']) {
    state = [];
    const view = render(props({ activeRole: role, settingsSection: 'profile', userName: 'Lee', onSaveProfile: async () => {} }));
    assert.equal(view.some((node) => node?.type === 'form'), false, role);
    assert.ok(view.some((node) => node?.props?.['data-testid'] === 'settings.profile.readOnly'), role);
    assert.ok(view.some((node) => node?.type === 'dd' && node.props.children === 'Lee'), role);
  }
});

test('settings profile lists the roles of this account; picking another role switches to it', () => {
  locale = 'en';
  state = [];
  const changed = [];
  const tree = render(props({ settingsSection: 'profile', allowedRoles: ['agent', 'tenant'], otherSiteRoles: ['tenant'], onRoleChange: (role) => changed.push(role) }));
  const roles = tree.filter((node) => node?.props?.['data-testid']?.startsWith('settings.role.'));
  assert.deepEqual(roles.map((node) => node.props['data-testid']), ['settings.role.tenant', 'settings.role.agent']);
  assert.equal(roles.find((node) => node.props['aria-current'] === 'true').props['data-testid'], 'settings.role.agent');
  roles.find((node) => node.props['data-testid'] === 'settings.role.agent').props.onClick();
  roles.find((node) => node.props['data-testid'] === 'settings.role.tenant').props.onClick();
  assert.deepEqual(changed, ['tenant']);
});

test('settings security: password form shown directly on every role, linked accounts, devices, danger zone last', async () => {
  locale = 'en';
  state = [];
  const saved = [];
  const opened = [];
  const input = props({
    activeRole: 'landlord',
    userEmail: 'lee@example.com',
    settingsSection: 'security',
    onNavigate: (tab) => opened.push(tab),
    onChangePassword: async (value) => { saved.push(value); },
    onSignOutEverywhere: async () => {},
    onLoadAccountDeletion: async () => ({ blocked: false, reasons: [], scheduledFor: null }),
    onDeleteAccount: async () => {},
  });
  const tree = render(input);
  assert.ok(tree.some((node) => node?.props?.['data-testid'] === 'settings.password.form'));
  const fields = tree.filter((node) => node?.type === 'input' && node.props.type === 'password');
  assert.equal(fields.length, 3);
  fields[0].props.onChange({ target: { value: 'old-secret' } });
  fields[1].props.onChange({ target: { value: 'Newsecret1' } });
  fields[2].props.onChange({ target: { value: 'Newsecret1' } });
  await render(input).find((node) => node?.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.deepEqual(saved, [{ currentPassword: 'old-secret', newPassword: 'Newsecret1' }]);
  const done = render(input);
  assert.ok(done.includes('Your password has been updated.'));
  done.find((node) => node?.type === 'button' && node.props.children === 'OK').props.onClick();
  assert.deepEqual(opened, [], 'the user stays on the settings page');

  state = [];
  const page = render(input);
  assert.ok(page.includes('Linked Accounts'));
  assert.ok(page.includes('Connected'), 'email is connected');
  for (const provider of ['Google', 'Facebook', 'Apple']) assert.ok(page.includes(provider), provider);
  assert.equal(byClass(page, 'aw-settings-row').filter((node) => node.props.className.includes('is-soon')).length, 3, 'Google, Facebook, Apple are coming soon');
  assert.ok(page.some((node) => node?.props?.['data-testid'] === 'account.signOutAll'));
  assert.equal(byClass(page, 'aw-signout').length, 3, 'account menu sign out + devices card: sign out and sign out all devices');
  const cards = byClass(page, 'aw-settings-card');
  assert.equal(cards[cards.length - 1].props['data-testid'], 'settings.danger', 'the danger zone is the last card');
  assert.ok(row(page, 'Delete account'));
  // One yellow button per view.
  assert.equal(page.filter((node) => node?.type === 'button' && node.props.className === 'aw-button aw-button-primary').length, 1);

  state = [];
  const tenant = render(props({ activeRole: 'tenant', settingsSection: 'security' }));
  assert.equal(tenant.some((node) => node?.props?.['data-testid'] === 'settings.danger'), false, 'no delete without the delete flow');
});

test('settings display: language and theme lists', () => {
  locale = 'en';
  state = [];
  const tree = render(props({ settingsSection: 'display' }));
  const languages = tree.filter((node) => node?.props?.['data-testid']?.startsWith('settings.language.'));
  assert.deepEqual(languages.map((node) => node.props['data-testid']), ['settings.language.th', 'settings.language.en', 'settings.language.zh', 'settings.language.ja']);
  assert.equal(languages.find((node) => node.props['aria-checked']).props['data-testid'], 'settings.language.en');
  const themes = tree.filter((node) => node?.props?.['data-testid']?.startsWith('settings.theme.'));
  assert.deepEqual(themes.map((node) => node.props['data-testid']), ['settings.theme.light', 'settings.theme.dark', 'settings.theme.system']);
  themes[1].props.onClick();
  const after = render(props({ settingsSection: 'display' }));
  assert.equal(after.find((node) => node?.props?.['data-testid'] === 'settings.theme.dark').props['aria-checked'], true);
});

test('settings help: FAQ, contact, about, terms, privacy, cookie settings and version', () => {
  locale = 'en';
  state = [];
  const page = render(props({ settingsSection: 'help' }));
  for (const label of ['FAQ', 'Contact NESTYK', 'About NESTYK', '0.1.0']) assert.ok(page.includes(label), label);
  for (const href of ['/terms', '/privacy', '#cookie-settings']) assert.ok(page.some((node) => node?.type === 'a' && node.props.href === href), href);
});

test('the account menu is short: role, settings, help, sign out; settings and help open their sections', () => {
  locale = 'en';
  state = [];
  const calls = [];
  const input = props({
    onSaveProfile: async () => {},
    onChangePassword: async () => {},
    onLoadAccountDeletion: async () => ({ blocked: false, reasons: [], scheduledFor: null }),
    onDeleteAccount: async () => {},
    onOpenSettings: (section) => calls.push(section),
  });
  const menu = render(input);
  for (const label of ['Edit Profile', 'Change Password', 'Delete account', 'Manage account']) assert.equal(row(menu, label), undefined, label);
  assert.equal(byClass(menu, 'aw-signout').length, 1);
  assert.deepEqual(byClass(menu, 'aw-menu-row').map((node) => node.props['data-testid']), ['account.settings', 'account.help']);
  assert.ok(row(menu, 'Settings'));
  menu.find((node) => node?.props?.['data-testid'] === 'account.settings').props.onClick();
  menu.find((node) => node?.props?.['data-testid'] === 'account.help').props.onClick();
  assert.deepEqual(calls, ['profile', 'help']);
});

test('settings page: section menu marks the open section, breadcrumb Home / Settings / section, any sidebar choice closes it', () => {
  locale = 'en';
  state = [];
  const calls = [];
  const input = props({ settingsSection: 'security', onOpenSettings: (section) => calls.push(`open:${section}`), onCloseSettings: () => calls.push('close'), onNavigate: (tab) => calls.push(tab) });
  const tree = render(input);
  assert.equal(tree.find((node) => node?.type === 'h1').props.children, 'Security');
  const nav = tree.filter((node) => node?.props?.['data-testid']?.startsWith('settings.nav.'));
  assert.deepEqual(nav.map((node) => node.props['data-testid']), ['settings.nav.profile', 'settings.nav.security', 'settings.nav.display', 'settings.nav.help']);
  assert.equal(nav.find((node) => node.props['aria-current'] === 'page').props['data-testid'], 'settings.nav.security');
  nav[2].props.onClick();
  tree.find((node) => node?.props?.['data-testid'] === 'settings.crumb').props.onClick();
  assert.equal(byClass(tree, 'aw-nav-item').some((node) => node.props['aria-current'] === 'page'), false);
  const home = byClass(tree, 'aw-crumb-link')[0];
  assert.equal(home.props['aria-label'], 'Home');
  home.props.onClick();
  assert.deepEqual(calls, ['open:display', 'open:profile', 'close', 'dashboard']);

  locale = 'th';
  state = [];
  const thai = render(props({ settingsSection: 'profile' }));
  assert.ok(thai.some((node) => node?.props?.['data-testid'] === 'settings.crumb' && node.props.children === 'การตั้งค่า'));
  locale = 'en';
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
  assert.equal(byClass(tree, 'aw-nav').length, 2);
  assert.equal(byClass(tree, 'aw-crumb-link').length, 0, 'custom sidebars get no breadcrumb links');
  assert.equal(byClass(tree, 'aw-nav-item').find(node => node.props['aria-current'] === 'page').props.title, 'Overview');
  byClass(tree, 'aw-nav-item').forEach(node => node.props.onClick());
  assert.deepEqual(calls, ['dashboard', 'contracts']);
  assert.equal(tree.find(node => node?.type === 'h1').props.children, 'Overview');
  assert.ok(!tree.includes('Commission'));
});

test('desktop shell is used for the Agent, Landlord, Tenant, Admin and Self owner roles on wide web; phone-width web uses the app screens', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../app/index.tsx'), 'utf8');
  const ast = ts.createSourceFile('index.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = ['isWideWeb', 'isAgentWeb', 'isLandlordWeb', 'isTenantWeb', 'isAdminWeb', 'isSelfOwnerWeb', 'isDesktopWeb', 'Page', 'AgentHeader'];
  const expressions = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(ast))) expressions.set(node.name.getText(ast), node.initializer.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(expressions.size, names.length);
  const minWidth = Number(source.match(/const WEB_SHELL_MIN_WIDTH = (\d+);/)[1]);
  assert.equal(minWidth, 768);
  const select = new Function('Platform', 'activeRole', 'windowWidth', 'WEB_SHELL_MIN_WIDTH', 'AgentWorkspacePage', 'MobileModePage', 'AgentSectionHeader', 'MobileSectionHeader', `${[...expressions].map(([name, expression]) => `const ${name} = ${expression};`).join('\n')} return [${names.join(', ')}];`);
  for (const platform of ['web', 'ios', 'android']) {
    for (const width of [375, 767, 768, 1440]) {
      for (const role of ['guest', 'tenant', 'landlord', 'agent', 'admin', 'self_owner']) {
        const wide = platform === 'web' && width >= 768;
        const agent = wide && role === 'agent';
        const landlord = wide && role === 'landlord';
        const tenant = wide && role === 'tenant';
        const admin = wide && role === 'admin';
        const selfOwner = wide && role === 'self_owner';
        const desktop = agent || landlord || tenant || admin || selfOwner;
        assert.deepEqual(
          select({ OS: platform }, role, width, minWidth, 'WebPage', 'NativePage', 'WebHeader', 'NativeHeader'),
          [wide, agent, landlord, tenant, admin, selfOwner, desktop, desktop ? 'WebPage' : 'NativePage', agent ? 'WebHeader' : 'NativeHeader'],
        );
      }
    }
  }
  assert.match(source, /const \{ width: windowWidth \} = useWindowDimensions\(\);/);
  assert.match(source, /if \(isAgentWeb\) \{\s*return \(\s*<AgentOverview/);
  assert.match(source, /if \(isDesktopWeb\) setDrawerOpen\(false\);/, 'the app drawer closes when the desktop shell takes over');
  assert.match(source, /enabled=\{isDesktopWeb\}/);
  assert.match(source, /navSections=\{workspaceNav\}/);
  assert.match(source, /const workspaceNav = isLandlordWeb\s*\? landlordNavSections\s*: isTenantWeb\s*\? tenantNavSections\s*: isAdminWeb\s*\? adminWebNavSections\(/);
  assert.match(source, /visible=\{!isDesktopWeb && drawerOpen\}/);
  assert.match(source, /visible=\{!isDesktopWeb && notificationsOpen\}/);
  assert.match(source, /isDesktopWeb \|\| \['createListing'/);
});

test('the role list in the account menu shows only the roles the account holds, plus the active role', () => {
  const ROLE_VALUES = ['guest', 'tenant', 'landlord', 'agent', 'self_owner', 'admin'];
  const listed = (input) => {
    state = [];
    const row = render(input).find(node => node?.props?.['data-testid'] === 'account.role');
    if (row.props.disabled) return ['(single)'];
    row.props.onClick();
    return render(input).map(node => node?.props?.['data-testid']).filter(id => typeof id === 'string' && id.startsWith('account.role.')).map(id => id.split('.').pop()).filter(role => ROLE_VALUES.includes(role));
  };
  assert.deepEqual(listed(props({ allowedRoles: ['guest', 'agent'] })), ['guest', 'agent']);
  assert.deepEqual(listed(props({ activeRole: 'landlord', allowedRoles: ['agent'] })), ['landlord', 'agent']);
  assert.deepEqual(listed(props()), ['guest', 'tenant', 'landlord', 'agent', 'self_owner', 'admin']);
  assert.deepEqual(listed(props({ activeRole: 'self_owner', allowedRoles: ['guest', 'self_owner'] })), ['guest', 'self_owner']);
});

test('the sidebar role box only shows the current role: it is not a button or a menu (Mos 18 Nov 2026)', () => {
  state = [];
  const tree = render(props({ activeRole: 'agent', allowedRoles: ['agent', 'tenant'] }));
  const box = tree.find(node => node?.props?.['data-testid'] === 'shell.workspace');
  assert.equal(box.type, 'div');
  assert.equal(box.props.onClick, undefined);
  assert.equal(tree.some(node => node?.props?.['aria-label'] === 'Switch workspace'), false);
  assert.equal(tree.some(node => typeof node?.props?.['data-testid'] === 'string' && node.props['data-testid'].startsWith('shell.workspace.')), false);
  assert.ok(tree.includes('Agent workspace'));
});

test('top-level pages show their title only in the top bar; deep pages keep it beside the back button', () => {
  const { AgentSectionHeader } = load(path.join(__dirname, 'agent-web/AgentSectionHeader.web.tsx'));
  const top = nodes(AgentSectionHeader({ title: 'Leads' }));
  assert.equal(top.some(node => node?.type === 'h1' || node?.type === 'h2'), false);
  const deep = nodes(AgentSectionHeader({ title: 'Lead details', leading: 'back', onBackPress() {} }));
  assert.equal(deep.find(node => node?.type === 'h2').props.children, 'Lead details');
});

test('there is no refresh button on the web: not in the top bar and not on the page (D4)', () => {
  state = [];
  const tree = render(props({ onRefresh() {}, refreshing: false }));
  assert.equal(byClass(tree, 'aw-refresh').length, 0);
  assert.equal(tree.some(node => node?.props?.['aria-label'] === 'Refresh'), false);
  const { AgentWorkspacePage } = load(path.join(__dirname, 'agent-web/AgentWorkspace.web.tsx'));
  const page = nodes(AgentWorkspacePage({ header: 'Heading', children: 'Body' }));
  assert.equal(page.some(node => node?.props?.['data-testid'] === 'page.refresh'), false);
  assert.ok(page.includes('Heading'));
  assert.ok(page.includes('Body'));
});

test('theme menu offers light, dark and match device, and remembers the choice in this browser', () => {
  const stored = {};
  global.window = { localStorage: { getItem: key => stored[key] ?? null, setItem: (key, value) => { stored[key] = value; } } };
  try {
    state = [];
    const input = props();
    const trigger = render(input).find(node => node?.type === 'button' && node.props['aria-label'] === 'Theme: Light');
    assert.ok(trigger, 'light is the default');
    trigger.props.onClick();
    const items = render(input).filter(node => node?.props?.className === 'awu-menu-item');
    const labels = items.map(node => node.props.children[1]?.props?.children);
    assert.ok(['Light', 'Dark', 'Match device'].every(label => labels.includes(label)));
    items.find(node => node.props.children[1]?.props?.children === 'Match device').props.onClick();
    assert.equal(stored['nestyk.web.theme'], 'system');
    assert.ok(render(input).find(node => node?.type === 'button' && node.props['aria-label'] === 'Theme: Match device'));
    state = [];
    assert.ok(render(input).find(node => node?.type === 'button' && node.props['aria-label'] === 'Theme: Match device'), 'read back after reload');
  } finally {
    delete global.window;
  }
  for (const language of ['en', 'th', 'ja', 'zh']) {
    const copy = load(`${root}/packages/i18n/src/locales/${language}.ts`)[language].agent.dashboard.webWorkspace;
    for (const key of ['theme', 'themeLight', 'themeDark', 'themeSystem']) assert.ok(copy[key], `${language}.${key}`);
  }
});

test('the shell keeps one sidebar toggle (collapse/expand); phone widths use the app screens instead of a drawer', () => {
  state = [];
  const input = props();
  const toggle = byClass(render(input), 'aw-collapse')[0];
  assert.equal(toggle.props['aria-label'], 'Collapse navigation');
  toggle.props.onClick();
  assert.equal(byClass(render(input), 'aw-collapsed').length, 1);
  const css = fs.readFileSync(path.resolve(__dirname, 'agent-web/agent-workspace.css'), 'utf8');
  assert.doesNotMatch(css, /aw-mnav|max-width: 760px/);
});

test('breadcrumb (design จ2): home and the parent page link back; the dashboard shows only its title', () => {
  locale = 'en';
  state = [];
  const calls = [];
  const deep = render(props({ activeTab: 'createLead', onNavigate: tab => calls.push(tab) }));
  const links = byClass(deep, 'aw-crumb-link');
  assert.deepEqual(links.map(node => node.props['aria-label'] ?? node.props.children), ['Home', 'Leads']);
  links.forEach(node => node.props.onClick());
  assert.deepEqual(calls, ['dashboard', 'listingLead']);
  assert.equal(deep.find(node => node?.type === 'h1').props.children, 'Create Lead');
  state = [];
  const rooms = render(props({ activeTab: 'listingRoom' }));
  assert.deepEqual(byClass(rooms, 'aw-crumb-link').map(node => node.props['aria-label'] ?? node.props.children), ['Home', 'Listing']);
  state = [];
  assert.equal(byClass(render(props({ activeTab: 'dashboard' })), 'aw-crumb-link').length, 0);
});

test('account menu (design จ2): the role row opens the role list in the same menu; only another role changes role', () => {
  locale = 'en';
  state = [];
  const changes = [];
  const input = props({ activeRole: 'agent', allowedRoles: ['agent', 'tenant'], otherSiteRoles: ['tenant'], onRoleChange: role => changes.push(role) });
  const row = render(input).find(node => node?.props?.['data-testid'] === 'account.role');
  assert.equal(row.props.disabled, false);
  row.props.onClick();
  const picker = render(input);
  assert.equal(picker.some(node => node?.props?.['data-testid'] === 'account.role'), false, 'the row is replaced by the list');
  assert.equal(button(picker, 'Sign out'), undefined, 'the rest of the menu hides while the list is open');
  const agent = picker.find(node => node?.props?.['data-testid'] === 'account.role.agent');
  const tenant = picker.find(node => node?.props?.['data-testid'] === 'account.role.tenant');
  assert.equal(agent.props['aria-current'], 'true');
  assert.ok(picker.includes('Other site'));
  agent.props.onClick();
  tenant.props.onClick();
  assert.deepEqual(changes, ['tenant']);
});

test('account menu: an account with one role sees its role without a change action', () => {
  locale = 'en';
  state = [];
  const tree = render(props({ activeRole: 'agent', allowedRoles: ['agent'] }));
  const row = tree.find(node => node?.props?.['data-testid'] === 'account.role');
  assert.equal(row.props.disabled, true);
  assert.equal(tree.includes('Change'), false);
});

test('role identity colours (20 Nov 2026): deep tile with a light icon in both modes, deep ring in light and light ring in dark; admin is ink and gold in both', () => {
  const { roleTileColors, tokens } = load(`${root}/packages/ui/src/theme/tokens.ts`);
  const agent = tokens.colors.roleIdentity.agent;
  assert.deepEqual(roleTileColors('agent', false), { bg: agent.deep, fg: agent.light, ring: agent.deep });
  for (const role of Object.keys(tokens.colors.roleIdentity)) {
    const set = tokens.colors.roleIdentity[role];
    assert.equal(roleTileColors(role, false).bg, set.deep, `${role}: light mode is the deep tile too`);
    assert.equal(roleTileColors(role, false).fg, set.light, role);
    assert.equal(roleTileColors(role, false).ring, role === 'admin' ? set.light : set.deep, `${role}: light-mode ring`);
    assert.equal(roleTileColors(role, true).ring, set.light, `${role}: dark-mode ring`);
  }
  assert.deepEqual(roleTileColors('agent', true), { bg: agent.deep, fg: agent.light, ring: agent.light });
  assert.deepEqual(roleTileColors('admin', false), { bg: '#211E1E', fg: '#F8B615', ring: '#F8B615' });
  assert.deepEqual(roleTileColors('admin', true), { bg: '#211E1E', fg: '#F8B615', ring: '#F8B615' });
  assert.deepEqual(roleTileColors('unknown', false), roleTileColors('services', false));
  // The role colours of the screens (accents, spinners) are not changed by the identity set.
  assert.equal(tokens.colors.roles.agent, '#211e1e');
});

test('settings header card (canvas page "setting"): photo, name, role chip, contact; camera and edit button only for the agent', () => {
  locale = 'en';
  state = [];
  const opened = [];
  const agent = props({ settingsSection: 'profile', userName: 'Ann Agent', userEmail: 'ann@example.com', userPhone: '0800000000', onSaveProfile: async () => {}, onOpenSettings: (s) => opened.push(s) });
  const profile = render(agent);
  assert.ok(profile.some((node) => node?.type === 'h2' && node.props.children === 'Ann Agent'));
  assert.ok(profile.some((node) => node?.props?.['data-testid'] === 'settings.photo'), 'camera on the profile tab');
  assert.equal(profile.some((node) => node?.props?.['data-testid'] === 'settings.editProfile'), false, 'no edit button on the profile tab itself');
  assert.equal(byClass(profile, 'aw-settings-tab').length, 4);

  state = [];
  const security = render({ ...agent, settingsSection: 'security' });
  assert.equal(security.some((node) => node?.props?.['data-testid'] === 'settings.photo'), false, 'camera only on the profile tab');
  security.find((node) => node?.props?.['data-testid'] === 'settings.editProfile').props.onClick();
  assert.deepEqual(opened, ['profile']);

  state = [];
  const tenant = render(props({ activeRole: 'tenant', settingsSection: 'security', onSaveProfile: async () => {} }));
  assert.equal(tenant.some((node) => ['settings.photo', 'settings.editProfile'].includes(node?.props?.['data-testid'])), false);
});

test('review R3: settings opened from a form page marks no sidebar item and uses the full width', () => {
  locale = 'en';
  state = [];
  const tree = render(props({ activeTab: 'createListing', settingsSection: 'profile' }));
  assert.equal(tree.some((node) => node?.props?.['aria-current'] === 'page' && !String(node.props['data-testid'] ?? '').startsWith('settings.nav.')), false);
  assert.equal(byClass(tree, 'aw-active-dot').length, 0);
  assert.equal(tree.find((node) => node?.type === 'main').props['data-page-width'], 'wide');
});

test('review R10: picking a photo clears the file input so the same file can be picked again', () => {
  locale = 'en';
  state = [];
  const input = props({ settingsSection: 'profile', onSaveProfile: async () => {} });
  const picker = render(input).find((node) => node?.props?.['data-testid'] === 'settings.photo');
  const target = { files: [], value: 'C:\\fakepath\\me.jpg' };
  picker.props.onChange({ target });
  assert.equal(target.value, '');
});

test('option ก (Mos 18 Nov 2026): the initials avatar uses the role colours, so ink and gold mean admin only', () => {
  locale = 'en';
  const { roleTileColors } = load(`${root}/packages/ui/src/theme/tokens.ts`);
  for (const role of ['agent', 'tenant', 'landlord']) {
    state = [];
    const tree = render(props({ activeRole: role, settingsSection: 'profile', avatarUrl: null }));
    const tile = roleTileColors(role, false);
    const avatars = byClass(tree, 'aw-avatar');
    assert.equal(avatars.length, 2, `${role}: header avatar and settings header`);
    for (const avatar of avatars) assert.deepEqual(avatar.props.style, { background: tile.bg, color: tile.fg }, role);
  }
  assert.deepEqual(roleTileColors('admin', false), { bg: '#211E1E', fg: '#F8B615', ring: '#F8B615' });
});

test('admin settings (Mos 18 Nov 2026): edits the profile, 2FA coming soon, no danger zone, a note that another admin closes the account', () => {
  locale = 'en';
  state = [];
  const admin = { activeRole: 'admin', onSaveProfile: async () => {}, onChangePassword: async () => {} };
  const profile = render(props({ ...admin, settingsSection: 'profile' }));
  assert.ok(profile.some((node) => node?.props?.['data-testid'] === 'settings.profile.form'), 'admin edits the profile on the web');
  assert.ok(profile.some((node) => node?.props?.['data-testid'] === 'settings.admin.note'));
  state = [];
  const security = render(props({ ...admin, settingsSection: 'security' }));
  assert.ok(security.some((node) => node?.props?.['data-testid'] === 'settings.twoFactor'));
  assert.equal(security.some((node) => node?.props?.['data-testid'] === 'settings.danger'), false);
  assert.ok(security.some((node) => node?.props?.['data-testid'] === 'settings.admin.deleteNote'));
  // Other roles get neither.
  state = [];
  const agent = render(props({ settingsSection: 'security', onChangePassword: async () => {} }));
  assert.equal(agent.some((node) => ['settings.twoFactor', 'settings.admin.deleteNote'].includes(node?.props?.['data-testid'])), false);
});

test('self owner (round 2) edits the profile on the web and shows its own role colours', () => {
  locale = 'en';
  state = [];
  const { roleTileColors } = load(`${root}/packages/ui/src/theme/tokens.ts`);
  const tree = render(props({ activeRole: 'self_owner', settingsSection: 'profile', onSaveProfile: async () => {} }));
  assert.ok(tree.some((node) => node?.props?.['data-testid'] === 'settings.profile.form'));
  const tile = roleTileColors('self_owner', false);
  assert.deepEqual(byClass(tree, 'aw-avatar')[0].props.style, { background: tile.bg, color: tile.fg });
  assert.ok(tree.includes('Owner'), 'role chip says Owner');
});

test('review R1: an account with the admin role sees the "another admin closes it" note on any role, never the danger zone', () => {
  locale = 'en';
  state = [];
  const tree = render(props({ activeRole: 'agent', adminAccount: true, settingsSection: 'security', onChangePassword: async () => {} }));
  assert.ok(tree.some((node) => node?.props?.['data-testid'] === 'settings.admin.deleteNote'));
  assert.equal(tree.some((node) => node?.props?.['data-testid'] === 'settings.danger'), false);
});

test('review R2: the password Turnstile is always visible and is not drawn while the delete dialog asks for the password', () => {
  const shell = fs.readFileSync(path.join(__dirname, 'agent-web/AgentWorkspace.web.tsx'), 'utf8');
  const security = shell.slice(shell.indexOf('const securitySection'), shell.indexOf('const displaySection'));
  assert.match(security, /\{captchaRequired && !deletePending \? <CaptchaField resetKey=\{captchaKey\} onToken=\{setCaptchaToken\} \/> : null\}/);
  assert.doesNotMatch(security, /interaction-only/);
});

test('overview quick actions (Mos 18 Nov 2026): CI pair, yellow add room + ink new lead, one yellow button; ink turns light in dark mode', () => {
  const overview = fs.readFileSync(path.join(__dirname, 'agent-web/AgentOverview.web.tsx'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, 'agent-web/agent-overview.css'), 'utf8');
  const quick = overview.slice(overview.indexOf('className="aov-quick-actions"'), overview.indexOf('</header>', overview.indexOf('className="aov-quick-actions"')));
  assert.equal((quick.match(/aw-button aw-button-primary/g) || []).length, 1);
  assert.match(quick, /className="aw-button aw-button-ink"/);
  assert.match(css, /\.aov-scroll \.aw-button-ink \{\s*background: #211e1e;\s*color: #ffffff !important;/);
  assert.match(css, /\.aov-scroll\[data-theme="dark"\] \.aw-button-ink \{\s*background: #f1f5f9;\s*color: #211e1e !important;/);
});
