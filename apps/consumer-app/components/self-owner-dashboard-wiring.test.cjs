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
