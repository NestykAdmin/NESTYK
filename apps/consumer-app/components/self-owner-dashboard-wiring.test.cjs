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
  assert.match(code, /selfOwnerWebNavSections\(roleMenuCopy, activeTab, \(tab\) => handleTabPress\(tab\)\)/);
});

test('first load of the self owner dashboard shows the brand loader, like the agent dashboard', () => {
  const branch = body.slice(body.indexOf("if (activeRole === 'self_owner')"), body.indexOf('const summaries'));
  assert.match(branch, /if \(selfOwnerDashboardSnapshot\.rooms\.status === 'loading'\) \{\s*return \(\s*<View style=\{styles\.bodyContainer\}>\s*<MobileBrandLoader fill size="md" \/>/);
});
