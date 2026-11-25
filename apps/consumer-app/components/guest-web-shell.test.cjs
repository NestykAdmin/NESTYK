// Step 2 (design W, Mos 24 Nov 2026): on the phone the guest web is the guest's whole screen. The app shows no header
// or tab bar for guest; the page's app bar opens the app's side menu and notifications; sign-in and legal links open
// the app's own screens; the side menu's Favourites / My viewing requests move the page.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const index = read('app/index.tsx');
const view = read('components/GuestWebView.tsx');

test('guest on the phone: the guest web instead of the app page frame', () => {
  assert.match(index, /const guestWebShell = Platform\.OS !== 'web' && activeRole === 'guest';/);
  assert.match(index, /\{guestWebShell \? \(\s*<GuestWebView\s+ref=\{guestWebRef\}\s+onOpenMenu=\{\(\) => setDrawerOpen\(true\)\}\s+onOpenNotifications=\{\(\) => setNotificationsOpen\(true\)\}\s+onOpenPage=\{\(page\) => router\.push\(APP_PAGE_ROUTE\[page\] as never\)\}\s+backEnabled=\{!drawerOpen && !notificationsOpen\}\s+\/>\s*\) : \(\s*<AgentWorkspace/);
  assert.match(index, /<\/AgentWorkspace>\s*\)\}\s*<MobileProfileDrawer/, 'the side menu and notifications stay outside, for guest too');
  assert.equal(/guestWebTab/.test(index), false);
});

test("the side menu's guest items move the page", () => {
  assert.match(index, /const webPath = guestWebShell \? guestWebPathForMenu\(action\.path\) : null;\s*if \(webPath\) \{\s*guestWebRef\.current\?\.navigate\(webPath\);\s*setDrawerOpen\(false\);\s*return;/);
});

test('the view answers the app bar and hands account pages to the app', () => {
  assert.match(view, /if \(message\.type === 'app\.menu'\) \{\s*onOpenMenu\(\);/);
  assert.match(view, /if \(message\.type === 'app\.notifications'\) \{\s*onOpenNotifications\(\);/);
  assert.match(view, /if \(message\.type === 'app\.open'\) \{\s*onOpenPage\(message\.page\);/);
  assert.match(view, /if \(decision === 'app'\) \{\s*const page = appPageOf\(request\.url, origin\);\s*if \(page\) onOpenPage\(page\);/);
  assert.match(view, /return decision === 'allow';/, "'app' never loads in the view");
  assert.match(view, /injectedJavaScriptBeforeContentLoaded=\{boot\}/);
  assert.match(view, /bootScript\(origin, \{ top: insets\.top, bottom: insets\.bottom \}\)/);
  assert.match(view, /useImperativeHandle\(handle, \(\) => \(\{ navigate: \(path: string\) => reply\(\{ type: 'navigate', path \}\) \}\), \[reply\]\);/);
});

test('Android Back walks back through the web pages, only on this screen and with the menus closed (review R1)', () => {
  assert.match(view, /useFocusEffect\(\s*useCallback\(\(\) => \{\s*if \(Platform\.OS !== 'android'\) return undefined;\s*const sub = BackHandler\.addEventListener\('hardwareBackPress', \(\) => \{\s*if \(!backOn\.current \|\| !canGoBack\.current\) return false;\s*ref\.current\?\.goBack\(\);\s*return true;/);
  assert.match(view, /onNavigationStateChange=\{onNavigationStateChange\}/);
  assert.match(view, /canGoBack\.current = state\.canGoBack;/);
});
