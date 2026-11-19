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
