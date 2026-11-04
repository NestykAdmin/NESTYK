// Sign out = this device only; "sign out of all devices" is its own action (Mos 4 Nov 2026).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(app, rel), 'utf8');

test('AuthContext: sign out uses scope local, sign out everywhere uses scope global and stops on error', () => {
  const ctx = read('lib/auth/AuthContext.tsx');
  assert.match(ctx, /const signOut = useCallback\(\(\) => endSession\('local', 'signedOut'\), \[endSession\]\);/);
  assert.match(ctx, /const signOutEverywhere = useCallback\(\(\) => endSession\('global', 'signedOut'\), \[endSession\]\);/);
  assert.match(ctx, /signOut\(\{ scope: 'global' \}\);\n\s*if \(error\) throw error;/);
  assert.match(ctx, /signOut\(\{ scope: 'local' \}\)/);
  assert.doesNotMatch(ctx, /supabase\.auth\.signOut\(\);/, 'no sign out without a scope (auth-js default is global)');
});

test('web account menu: "Sign out of all devices" asks first and keeps the dialog open on failure', () => {
  const shell = read('components/agent-web/AgentWorkspace.web.tsx');
  assert.match(shell, /data-testid="account\.signOutAll"/);
  assert.match(shell, /testID="account\.signOutAllDialog"/);
  assert.match(shell, /await props\.onSignOutEverywhere\(\);\n\s*setSignOutAllOpen\(false\);/);
  assert.match(shell, /setSignOutAllError\(t\.webSession\.signOutAllFailed\)/);
  const index = read('app/index.tsx');
  assert.match(index, /onSignOutEverywhere=\{isAuthenticated \? handleSignOutEverywhere : undefined\}/);
  assert.match(index, /await signOutEverywhere\(\);/);
});
