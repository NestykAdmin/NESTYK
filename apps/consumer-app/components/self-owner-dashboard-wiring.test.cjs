// Self owner Dashboard wiring in app/index.tsx (UI round, 19 Nov 2026, ClickUp z8rcteng6b).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const code = fs.readFileSync(path.join(__dirname, '../app/index.tsx'), 'utf8');
const body = code.slice(code.indexOf('const renderDashboardBody = () => {'), code.indexOf('const renderTabBody = () => {'));

test('renderDashboardBody has a self_owner branch before the old summary card', () => {
  const branch = body.indexOf("if (activeRole === 'self_owner')");
  assert.ok(branch > 0, 'branch missing');
  assert.ok(branch < body.indexOf('const summaries'), 'branch must come before the summary card');
});

test('wide web uses SelfOwnerOverview, everything else the phone body', () => {
  const branch = body.slice(body.indexOf("if (activeRole === 'self_owner')"), body.indexOf('const summaries'));
  assert.match(branch, /isSelfOwnerWeb\s*\?\s*\(?\s*<SelfOwnerOverview\b/);
  assert.match(branch, /<MobileSelfOwnerDashboardBody\b[^>]*snapshot=\{selfOwnerDashboardSnapshot\}/);
});

test('the snapshot comes from the demo hook and the agent dashboard stays agent-only', () => {
  assert.match(code, /const selfOwnerDashboardSnapshot = useSelfOwnerDashboard\(\{\s*greetingName: dashboardGreetingName,\s*locale,?\s*\}\)/);
  assert.match(code, /useAgentDashboard\(\{\s*enabled: activeRole === 'agent' && activeTab === 'dashboard' && isAuthenticated,/);
});

// Rooms and listings (UI round, 19 Nov 2026, ClickUp z8rcteng6c)
test('the phone tab bar of the self owner: dashboard, rooms, services, menu', () => {
  const matrix = fs.readFileSync(path.join(__dirname, '../../../packages/ui/src/config/mobileTabMatrix.ts'), 'utf8');
  const block = matrix.slice(matrix.indexOf('  self_owner: ['), matrix.indexOf('],', matrix.indexOf('  self_owner: [')));
  const keys = block.replace(/\/\/[^\n]*/g, '').match(/key: '([a-zA-Z]+)'|SERVICES_TAB|MENU_TAB/g);
  assert.deepEqual(keys, ["key: 'dashboard'", "key: 'listingRoom'", 'SERVICES_TAB', 'MENU_TAB']);
});

test('the rooms tab of the self owner opens the rooms page (web) or screen (phone) before the agent rooms branch', () => {
  const tabs = code.slice(code.indexOf('const renderTabBody = () => {'));
  const branch = tabs.indexOf("if (activeRole === 'self_owner' && activeTab === 'listingRoom')");
  assert.ok(branch > 0, 'branch missing');
  assert.ok(branch < tabs.indexOf("if (activeTab === 'listingRoom') {"), 'must come before the agent rooms branch');
  const part = tabs.slice(branch, tabs.indexOf("if (activeTab === 'listingRoom') {"));
  assert.match(part, /isSelfOwnerWeb\s*\?\s*\(?\s*<SelfOwnerRoomsPage\b/);
  assert.match(part, /<MobileSelfOwnerRoomsScreen\b/);
  assert.match(code, /const selfOwnerRooms = useSelfOwnerRooms\(\);/);
});

test('the dashboard links to the rooms tab and the sidebar gets the active tab', () => {
  assert.match(body, /onOpenRooms=\{\(\) => handleTabPress\('listingRoom'\)\}/);
  // The sidebar call itself is pinned in 'the self owner sidebar opens the add form like the agent' (20 Nov 2026).
  assert.match(code, /selfOwnerWebNavSections\(roleMenuCopy, activeTab, /);
});

test('first load of the self owner dashboard shows the brand loader, like the agent dashboard', () => {
  const branch = body.slice(body.indexOf("if (activeRole === 'self_owner')"), body.indexOf('const summaries'));
  assert.match(branch, /if \(selfOwnerDashboardSnapshot\.rooms\.status === 'loading'\) \{\s*return \(\s*<View style=\{styles\.bodyContainer\}>\s*<MobileBrandLoader fill size="md" \/>/);
});

// Listing UI round (20 Nov 2026, ClickUp z8rcteng6c / z8rcteng6d): add, edit, publish / unpublish.
const tabs = code.slice(code.indexOf('const renderTabBody = () => {'));

test('the add-room tab of the self owner opens the self owner form before the agent wizard', () => {
  const branch = tabs.indexOf("if (activeRole === 'self_owner' && activeTab === 'createListing')");
  assert.ok(branch > 0, 'branch missing');
  assert.ok(branch < tabs.indexOf("if (activeTab === 'createListing') {"), 'must come before the agent wizard');
  const part = tabs.slice(branch, tabs.indexOf("if (activeTab === 'createListing') {"));
  assert.match(part, /<SelfOwnerListingEditor\b/);
  assert.match(part, /backHandlerRef=\{createListingBackRef\}/);
  assert.doesNotMatch(part, /createAgentScoutRoom|MobileCreateListingWizardBody/);
});

test('the rooms tab passes add to the page and the phone screen; the room detail modal does edit and publish', () => {
  const part = tabs.slice(tabs.indexOf("if (activeRole === 'self_owner' && activeTab === 'listingRoom')"), tabs.indexOf("if (activeTab === 'listingRoom') {"));
  assert.doesNotMatch(part, /selfOwnerEditingRoom|onEditRoom|onToggleListing/);
  for (const component of ['SelfOwnerRoomsPage', 'MobileSelfOwnerRoomsScreen']) {
    const tag = part.slice(part.indexOf(`<${component}`), part.indexOf('/>', part.indexOf(`<${component}`)));
    assert.match(tag, /onAddListing=\{openCreateListing\}/, component);
  }
});

test('the dashboard add button opens the same form', () => {
  const branch = body.slice(body.indexOf("if (activeRole === 'self_owner')"), body.indexOf('const summaries'));
  assert.equal((branch.match(/onAddListing=\{openCreateListing\}/g) ?? []).length, 2);
});

test('the add form has a back header; back steps through the wizard first; no edit page in the shell', () => {
  assert.match(code, /const handleSelfOwnerFormBack = useCallback\(\(\) => \{\s*if \(createListingBackRef\.current\?\.\(\)\) return;\s*goBackFromSecondary\(\);/);
  const header = code.slice(code.indexOf('header={'), code.indexOf('bottomBar={'));
  const own = header.indexOf("activeRole === 'self_owner' && activeTab === 'createListing' ?");
  assert.ok(own > 0 && own < header.indexOf('isAdminWeb || isSelfOwnerWeb ?'), 'self owner form header comes before the web-shell null');
  assert.match(header.slice(own, own + 700), /onBackPress=\{handleSelfOwnerFormBack\}/);
  assert.doesNotMatch(code, /selfOwnerEditingRoom/);
});

test('going back from the add form of the self owner lands on the rooms list', () => {
  const back = code.slice(code.indexOf('const goBackFromSecondary = useCallback'), code.indexOf('const goBackFromSecondary = useCallback') + 500);
  assert.match(back, /activeRole === 'landlord'\s*\?\s*'dashboard'\s*:\s*'listingRoom'/);
});

// Jom 20 Nov 2026: the edit form has its own URL, and the sidebar group's "add room" opens the add form.
test('no room edit URL: the route has no room id', () => {
  const href = code.slice(code.indexOf('const routeHref ='), code.indexOf('useAppRouteSync(routeHref'));
  assert.doesNotMatch(href, /roomId/);
});

test('the self owner sidebar opens the add form like the agent', () => {
  assert.match(code, /selfOwnerWebNavSections\(roleMenuCopy, activeTab, \(tab\) => \(tab === 'createListing' \? openCreateListing\(\) : handleTabPress\(tab\)\)\)/);
});

// Self owner create form (Jom 20 Nov 2026): the owner's profile is the room contact everywhere the form opens.
test('the add form, the rooms page and the phone rooms screen get the owner contact from the profile', () => {
  assert.match(code, /const selfOwnerContact = useMemo\(\s*\(\) => \(\{ name: isAuthenticated \? displayName : '', phone: session\?\.phone \?\? '' \}\),\s*\[isAuthenticated, displayName, session\?\.phone\],?\s*\);/);
  const add = tabs.slice(tabs.indexOf("if (activeRole === 'self_owner' && activeTab === 'createListing')"), tabs.indexOf("if (activeTab === 'createListing') {"));
  assert.match(add, /<SelfOwnerListingEditor[^]*?ownerContact=\{selfOwnerContact\}/);
  const list = tabs.slice(tabs.indexOf("if (activeRole === 'self_owner' && activeTab === 'listingRoom')"), tabs.indexOf("if (activeTab === 'listingRoom') {"));
  for (const component of ['SelfOwnerRoomsPage', 'MobileSelfOwnerRoomsScreen']) {
    const tag = list.slice(list.indexOf(`<${component}`), list.indexOf('/>', list.indexOf(`<${component}`)));
    assert.match(tag, /ownerContact=\{selfOwnerContact\}/, component);
  }
});

// Review fix (20 Nov 2026): the self owner Dashboard and rooms page refresh the API rooms (a failed load can recover).
test('self owner: page refresh reloads the rooms from the API and then stops spinning', async () => {
  const ts = require('typescript');
  const source = fs.readFileSync(path.resolve(__dirname, '../app/index.tsx'), 'utf8');
  const ast = ts.createSourceFile('index.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const initializers = {};
  (function visit(node) {
    if (ts.isVariableDeclaration(node) && ['handlePageRefresh', 'onPageRefresh'].includes(node.name.getText(ast))) {
      initializers[node.name.getText(ast)] = node.initializer.getText(ast);
    }
    ts.forEachChild(node, visit);
  })(ast);
  for (const activeTab of ['dashboard', 'listingRoom']) {
    const refreshed = [], finished = [], reloads = [];
    const env = {
      useCallback: (fn) => fn, activeRole: 'self_owner', activeTab, partyInbox: false,
      pendingRefresh: { current: null }, refreshSequence: { current: 0 },
      setPageRefreshing() {}, setRoomsReloadToken: (t) => reloads.push(t), finishPageRefresh: (t) => finished.push(t),
      selfOwnerRoomStore: { refresh: async () => { refreshed.push(activeTab); } },
      isTenantWorkspace: false, isWizardTab: false, isLandlordWeb: false, isTenantWeb: false,
    };
    const compile = (code) => new Function(...Object.keys(env), `return (${code});`)(...Object.values(env));
    env.handlePageRefresh = compile(initializers.handlePageRefresh);
    const callback = compile(initializers.onPageRefresh);
    assert.equal(callback, env.handlePageRefresh, activeTab);
    callback();
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(refreshed, [activeTab]);
    assert.deepEqual(finished, [1]);
    assert.deepEqual(reloads, [], 'not the agent rooms');
  }
});

// Browser check 23 Nov 2026 (phone width): the self owner rooms page said "Room Listings" and its tab "Listing" in
// Thai; it is "ห้องของฉัน" like the web sidebar. Other roles keep their words.
test('self owner: the rooms page title and tab use the self owner words', () => {
  const ts = require('typescript');
  const source = fs.readFileSync(path.resolve(__dirname, '../app/index.tsx'), 'utf8');
  const ast = ts.createSourceFile('index.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let screenTitle;
  (function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'screenTitle') screenTitle = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  })(ast);
  const t = { selfOwnerWeb: { listingsView: 'ห้องของฉัน' } };
  const title = (activeRole, activeTab) => new Function('activeRole', 'activeTab', 'partyInbox', 'isTenantWorkspace', 'getScreenTitle', 't', `return (${screenTitle});`)(
    activeRole, activeTab, false, false, (tab) => `screen:${tab}`, t);
  assert.equal(title('self_owner', 'listingRoom'), 'ห้องของฉัน');
  assert.equal(title('self_owner', 'dashboard'), 'screen:dashboard');
  assert.equal(title('landlord', 'listingRoom'), 'screen:listingRoom');
  assert.match(source, /<MobileBottomTabBar[\s\S]{0,400}labels=\{activeRole === 'self_owner' \? \{ listingRoom: t\.selfOwnerWeb\.listingsView \} : undefined\}/);
  const bar = fs.readFileSync(path.resolve(__dirname, '../../../packages/ui/src/components/MobileBottomTabBar.tsx'), 'utf8');
  assert.match(bar, /labels\?: Partial<Record<MobileAppTab, string>>/);
  assert.match(bar, /const label = labels\?\.\[tab\.key\] \?\? t\.mobile\.tabs\[tab\.key\];/);
});

// Contracts and income (24 Nov 2026, ClickUp z8rcteng6e / z8rcteng6f): read-only pages, demo data.
test('the contracts and income tabs of the self owner open their pages (web) or screens (phone)', () => {
  for (const [tab, page, screen, hook] of [
    ['contracts', 'SelfOwnerContractsPage', 'MobileSelfOwnerContractsScreen', 'selfOwnerContracts'],
    ['income', 'SelfOwnerIncomePage', 'MobileSelfOwnerIncomeScreen', 'selfOwnerIncome'],
  ]) {
    const start = code.indexOf(`if (activeRole === 'self_owner' && activeTab === '${tab}')`);
    assert.ok(start > 0, tab);
    const branch = code.slice(start, code.indexOf('\n    }\n', start));
    assert.match(branch, new RegExp(`isSelfOwnerWeb \\? \\(?\\s*<${page}`), tab);
    assert.match(branch, new RegExp(`<${screen}`), tab);
    assert.match(branch, new RegExp(`${hook}\\.`), tab);
    assert.ok(start < code.indexOf("if (activeRole === 'agent'", start) || code.indexOf("if (activeRole === 'agent'", start) < 0);
  }
  assert.match(code, /const selfOwnerContracts = useSelfOwnerContracts\(\)/);
  assert.match(code, /const selfOwnerIncome = useSelfOwnerIncome\(\)/);
});

test('the contracts and income pages are titled with the self owner words', () => {
  assert.match(code, /activeRole === 'self_owner' && activeTab === 'contracts'\s*\?\s*t\.selfOwnerWeb\.contracts/);
  assert.match(code, /activeRole === 'self_owner' && activeTab === 'income'\s*\?\s*t\.selfOwnerWeb\.billsIncome/);
});

test('the dashboard links to income and contracts on web and phone', () => {
  const branch = body.slice(body.indexOf("if (activeRole === 'self_owner')"), body.indexOf('const summaries'));
  assert.equal((branch.match(/onOpenIncome=\{\(\) => handleTabPress\('income'\)\}/g) ?? []).length, 2);
  assert.equal((branch.match(/onOpenContracts=\{\(\) => handleTabPress\('contracts'\)\}/g) ?? []).length, 2);
});

test('the phone menu opens the contracts and income pages; add room is unchanged', () => {
  const drawer = fs.readFileSync(path.join(__dirname, '../../../packages/ui/src/config/mobileDrawerMenuMatrix.ts'), 'utf8');
  const section = drawer.slice(drawer.indexOf('  self_owner: ['), drawer.indexOf('  admin: ['));
  assert.match(section, /id: 'incomeReport',[^}]*action: \{ type: 'tab', tab: 'income' \}/);
  assert.match(section, /id: 'documents',[^}]*action: \{ type: 'tab', tab: 'contracts' \}/);
  const line = (id) => section.split('\n').find((l) => l.includes(`id: '${id}'`));
  assert.doesNotMatch(line('incomeReport'), /comingSoon/);
  assert.doesNotMatch(line('documents'), /comingSoon/);
  assert.match(line('createListing'), /comingSoon: true/);
});

// The landlord's "income" tab (TenantBillsScreen, landlord API) and the agent's mock "contracts" card match any role:
// the self owner branches must come first, or the owner would land on the landlord bills screen (24 Nov 2026).
test('the self owner contracts and income branches come before the shared income / contracts tabs', () => {
  const tabs = code.slice(code.indexOf('const renderTabBody = () => {'));
  for (const tab of ['contracts', 'income']) {
    const ours = tabs.indexOf(`if (activeRole === 'self_owner' && activeTab === '${tab}')`);
    const shared = tabs.indexOf(`if (activeTab === '${tab}') {`);
    assert.ok(ours > 0 && shared > 0, tab);
    assert.ok(ours < shared, `${tab}: self owner branch first`);
  }
});
