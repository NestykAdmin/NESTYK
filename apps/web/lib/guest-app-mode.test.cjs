// Guest web inside the NESTYK app, step 2 (design W, Mos 24 Nov 2026): the web is the guest's whole screen in the
// app; an app bar (avatar → app menu, logo, bell → app notifications) replaces the header; the 4th tab is "More".
// In a browser nothing changes: every app-only rule hangs on html[data-nk-app], which only the app sets.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const css = read('app/[locale]/guest.css');
const app = css.slice(css.indexOf('/* ===== Inside the NESTYK app'));

test('app-only and web-only parts switch on the mark the app sets, nothing else', () => {
  assert.match(app, /html:not\(\[data-nk-app\]\) \.nk-app-only \{\s*display: none !important;/);
  assert.match(app, /html\[data-nk-app\] \.nk-web-only \{\s*display: none !important;/);
  assert.match(app, /\n\.nk-appbar \{\s*display: none;/, 'no app bar in a browser');
  assert.match(app, /html\[data-nk-app\] \.nk-appbar \{[^}]*display: flex;[^}]*padding: calc\(var\(--nk-safe-top\) \+ 8px\)/);
  assert.match(app, /@media \(max-width: 960px\) \{\s*html\[data-nk-app\] \.nk-header \{\s*display: none;/, 'a tablet in the app keeps the header (review R2)');
  // The phone's edges: env() in a browser, the app's numbers in the app (the page there cannot read env()).
  assert.match(css, /--nk-safe-top: env\(safe-area-inset-top, 0px\);\s*--nk-safe-bottom: env\(safe-area-inset-bottom, 0px\);/);
  assert.match(app, /html\[data-nk-app\] \{\s*--nk-safe-top: var\(--nk-app-top, 0px\);\s*--nk-safe-bottom: var\(--nk-app-bottom, 0px\);/);
  for (const file of ['guest.css', 'guest-map.css', 'guest-location.css', 'guest-areas.css']) {
    const text = read(`app/[locale]/${file}`).replace(/--nk-safe-(top|bottom): env\(safe-area-inset-(top|bottom), 0px\);/g, '');
    assert.equal(/env\(safe-area-inset/.test(text), false, `${file}: use var(--nk-safe-top / -bottom)`);
  }
  for (const rule of app.match(/^[^\s/@}][^{]*\{/gm) ?? []) {
    if (/nk-app|nk-appbar|nk-tab__part|nk-contents|nk-web-only/.test(rule) && !/data-nk-app/.test(rule)) {
      assert.match(rule, /^(\.nk-appbar|\.nk-tab__part|\.nk-contents|\.nk-appbar__|\.nk-appbar :is)/, `browser-visible rule: ${rule}`);
    }
  }
  assert.match(read('lib/root-document.tsx'), /<html lang=\{lang\} className=\{`[^`]+`\} suppressHydrationWarning>/);
});

test('the status bar is always on ink in the app; portals get the site focus ring', () => {
  assert.match(app, /html\[data-nk-app\] body::after \{[^}]*position: fixed;[^}]*height: var\(--nk-safe-top\);[^}]*background: var\(--nk-color-ink\);/);
  assert.match(css, /:is\(\.nk-loc-sheet, \.nk-prompt\) :is\(a, button, input\):focus-visible \{\s*outline: 3px solid var\(--nk-color-focus\);/);
});

test('the shell has the app bar; the 4th tab reads "More" in the app; profile hides the account there', () => {
  const shell = read('app/components/guest/GuestShell.tsx');
  assert.match(shell, /<GuestAppBar \/>\s*<GuestAppNavigator \/>\s*<GuestHeader \/>/);
  const bar = read('app/components/guest/GuestAppBar.tsx');
  assert.match(bar, /onClick=\{\(\) => openAppMenu\(\)\}/);
  assert.match(bar, /onClick=\{\(\) => openAppNotifications\(\)\}/);
  assert.match(bar, /if \(!showsTabBar\(pathname\)\) return null;/, 'not on the room page');
  assert.match(bar, /if \(!inApp\(\)\) return;\s*return onAppNavigate\(\(path\) => router\.push\(path\)\);/);
  const tabs = read('app/components/guest/GuestTabBar.tsx');
  assert.match(tabs, /<span className="nk-tab__part nk-web-only">\{webContent\}<\/span>\s*<span className="nk-tab__part nk-app-only">[\s\S]*?<MoreIcon size=\{22\} \/>[\s\S]*?\{copy\.more\}/);
  const profile = read('app/[locale]/(marketplace)/profile/page.tsx');
  assert.match(profile, /<div className="nk-contents nk-web-only">\s*<ProfileAccount \/>/);
  assert.match(profile, /<div className="nk-contents nk-web-only">\s*<ProfileSignOut \/>/);
  assert.match(profile, /className="nk-card nk-list nk-web-only">\s*<details className="nk-details" data-testid="profile.language">/, 'language and theme are the app\'s');
  assert.match(profile, /className="nk-card nk-list nk-app-only" data-testid="profile.explore"/);
  assert.match(profile, /<AccountPageLink page="privacy"/);
  assert.match(profile, /<AccountPageLink page="terms"/);
});

test('sign-in, sign-up and legal links open the app screen when in the app, the link otherwise', () => {
  const link = read('app/components/guest/AccountLink.tsx');
  const calls = link.match(/if \(!event\.defaultPrevented && inApp\(\) && openAppPage\(appPageFor\(page\)\)\) event\.preventDefault\(\);/g) ?? [];
  assert.equal(calls.length, 2, 'AccountLink and AccountPageLink');
});

test('every language has the app bar and "More" words', () => {
  for (const lang of ['th', 'en', 'ja', 'zh']) {
    const copy = fs.readFileSync(path.join(root, '..', '..', 'packages', 'i18n', 'src', 'locales', 'guest', `${lang}.ts`), 'utf8');
    for (const key of ['more', 'myMenu', 'notifications', 'moreTitle', 'moreSubtitle', 'exploreLabel']) {
      assert.match(copy, new RegExp(`\\n\\s+${key}: '[^']+',`), `${lang} ${key}`);
    }
  }
});
