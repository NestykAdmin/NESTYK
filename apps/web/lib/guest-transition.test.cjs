// Page change animation, design A (Mos 27 Nov 2026, canvas page "pageanim"): a deeper page slides in from the right,
// going back slides it away, tabs and same-level pages fade. Phones and the app only; never with reduced motion.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);

const nav = require('./guest-transition.ts');

test('page depth: tabs, then search and areas, then results and area pages, then a room; other paths are not guest pages', () => {
  for (const p of ['/', '/saved', '/viewing-requests', '/profile', '/en', '/en/saved', '/ja/profile']) assert.equal(nav.pageDepth(p), 0, p);
  for (const p of ['/find', '/areas', '/zh/find']) assert.equal(nav.pageDepth(p), 1, p);
  for (const p of ['/search', '/rent/sukhumvit', '/en/search']) assert.equal(nav.pageDepth(p), 2, p);
  for (const p of ['/rooms/41', '/ja/rooms/abc']) assert.equal(nav.pageDepth(p), 3, p);
  for (const p of ['/login', '/privacy', '/commute', '/rooms', '/rooms/1/x', '/sign/abc', '/enx', '/api/public/rooms']) assert.equal(nav.pageDepth(p), null, p);
});

test('direction: deeper pushes, a room from a room pushes, back from a room or to a middle page slides back, the rest fades', () => {
  const cases = [
    ['/search', '/rooms/41', 'push'],
    ['/', '/find', 'push'],
    ['/find', '/search', 'push'],
    ['/rooms/41', '/rooms/42', 'push'],
    ['/rooms/41', '/search', 'back'],
    ['/rooms/41', '/', 'back'],
    ['/rent/sukhumvit', '/areas', 'back'],
    ['/search', '/find', 'back'],
    ['/search', '/', 'fade'],
    ['/', '/saved', 'fade'],
    ['/saved', '/viewing-requests', 'fade'],
    ['/rent/sukhumvit', '/search', 'fade'],
    ['/en/search', '/en/rooms/41', 'push'],
    ['/search', '/search', 'none'],
    ['/', '/login', 'none'],
    [null, '/saved', 'none'],
  ];
  for (const [from, to, want] of cases) assert.equal(nav.navDirection(from, to), want, `${from} → ${to}`);
});

// Full page loads (a room is opened with a plain link for its own CSP, review R1) animate with cross-document view
// transitions: the leaving page keeps its path, the new page reads it before its first frame and marks <html>.
test('the head script marks the new page with the same direction as navDirection, from the path the old page left', () => {
  const script = nav.NAV_REVEAL_SCRIPT;
  assert.ok(script.length < 1500, 'small enough to inline');
  const run = (from, to) => {
    const store = new Map(from ? [[nav.NAV_FROM_KEY, from]] : []);
    const listeners = {};
    const attrs = {};
    let finished;
    const context = {
      sessionStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
      location: { pathname: to },
      document: { documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; } } },
      addEventListener: (type, fn) => { listeners[type] = fn; },
    };
    vm.runInNewContext(script, context);
    listeners.pagereveal({ viewTransition: { finished: new Promise((resolve) => { finished = resolve; }) } });
    const marked = attrs['data-nk-nav'];
    listeners.pagehide();
    return { marked, kept: store.get(nav.NAV_FROM_KEY), finished };
  };
  for (const [from, to] of [['/search', '/rooms/41'], ['/rooms/41', '/search'], ['/', '/saved'], ['/rooms/1', '/rooms/2'], ['/en/rooms/9', '/en']]) {
    const want = nav.navDirection(from, to);
    assert.equal(run(from, to).marked, want === 'none' ? undefined : want, `${from} → ${to}`);
  }
  assert.equal(run(null, '/rooms/41').marked, undefined, 'a first visit is not animated');
  assert.equal(run('/search', '/rooms/41').kept, '/rooms/41', 'the page keeps its own path when it is left');
  // No transition (desktop, reduced motion, an old browser): nothing is marked.
  const listeners = {};
  const attrs = {};
  vm.runInNewContext(script, {
    sessionStorage: { getItem: () => '/search', setItem() {}, removeItem() {} },
    location: { pathname: '/rooms/1' },
    document: { documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute() {} } },
    addEventListener: (type, fn) => { listeners[type] = fn; },
  });
  listeners.pagereveal({ viewTransition: null });
  assert.deepEqual(attrs, {});
});

test('the script never throws when storage is blocked', () => {
  const listeners = {};
  vm.runInNewContext(nav.NAV_REVEAL_SCRIPT, {
    get sessionStorage() { throw new Error('blocked'); },
    location: { pathname: '/' },
    document: { documentElement: { setAttribute() {}, removeAttribute() {} } },
    addEventListener: (type, fn) => { listeners[type] = fn; },
  });
  assert.doesNotThrow(() => listeners.pagereveal({ viewTransition: { finished: Promise.resolve() } }));
  assert.doesNotThrow(() => listeners.pagehide());
});

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('guest pages put the head script in <head>; the share pages do not', () => {
  const doc = read('lib/root-document.tsx');
  assert.match(doc, /headScript\?: string/);
  assert.match(doc, /\{headScript \? <script dangerouslySetInnerHTML=\{\{ __html: headScript \}\} \/> : null\}/);
  assert.match(read('app/[locale]/layout.tsx'), /<RootDocument lang=\{locale\} headScript=\{NAV_REVEAL_SCRIPT\}>/);
  assert.doesNotMatch(read('app/(share)/layout.tsx'), /headScript/);
});

test('CSS: transitions only on phones without reduced motion; bars stay still on a fade; each direction has its moves', () => {
  const css = read('app/[locale]/guest.css');
  const start = css.indexOf('/* ===== Page change animation');
  assert.ok(start > 0, 'one block for the page change animation');
  const block = css.slice(start, css.indexOf('/* ===== End page change animation'));
  assert.match(block, /@media \(max-width: 960px\) and \(prefers-reduced-motion: no-preference\) \{\s*@view-transition \{\s*navigation: auto;\s*\}/);
  for (const dir of ['push', 'back', 'fade']) {
    assert.match(block, new RegExp(`html\\[data-nk-nav="${dir}"\\]::view-transition-old\\(root\\)`), `${dir} old`);
    assert.match(block, new RegExp(`html\\[data-nk-nav="${dir}"\\]::view-transition-new\\(root\\)`), `${dir} new`);
    assert.match(block, new RegExp(`html\\[data-nk-enter="${dir}"\\] \\.nk-route \\{`), `${dir} enter-only fallback`);
  }
  assert.match(block, /html\[data-nk-nav="fade"\] \.nk-tabbar \{\s*view-transition-name: nk-tabbar;/);
  assert.match(block, /html\[data-nk-nav="fade"\] \.nk-appbar \{\s*view-transition-name: nk-appbar;/);
  // Back: the page that comes back slides in from the left over the leaving one, which moves right and dims. No
  // z-index on the old picture: WebKit (iOS 27 simulator, 27 Nov 2026) drew it under the new one and it vanished.
  assert.match(block, /html\[data-nk-nav="back"\]::view-transition-new\(root\) \{[^}]*animation: nk-nav-slide-in-left 280ms/);
  assert.match(block, /html\[data-nk-nav="back"\]::view-transition-old\(root\) \{[^}]*animation: nk-nav-shift-right 280ms/);
  assert.doesNotMatch(block, /z-index/);
  assert.match(block, /280ms/);
  assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}\b/);
});

test('the template wraps each page so a page that comes in can move', () => {
  // Not "nk-page": that class already pads the content pages (guest.css), and wrapping every page in it inset the
  // home's ink header in the app (Mos 27 Nov 2026).
  assert.match(read('app/[locale]/(marketplace)/template.tsx'), /<div className="nk-route">\{children\}<\/div>/);
  assert.doesNotMatch(read('app/[locale]/guest.css'), /^\.nk-route \{/m, 'the wrapper has no box styles of its own');
});

test('SPA page changes: guest links on phones are wrapped in a view transition; pages with their own CSP and other sites are left alone', () => {
  const code = read('app/components/guest/GuestPageTransition.tsx');
  assert.match(code, /document\.addEventListener\('click', onClick, true\)/, 'before the link does its own change');
  assert.match(code, /MOTION_QUERY = '\(max-width: 960px\) and \(prefers-reduced-motion: no-preference\)'/);
  assert.match(code, /if \(event\.defaultPrevented \|\| event\.button !== 0 \|\| event\.metaKey \|\| event\.ctrlKey \|\| event\.shiftKey \|\| event\.altKey\) return;/);
  // Rooms and search have their own CSP (maps): a plain link there is a full load, so it is never turned into an
  // in-page change; the head script animates a full load, and a Next link there still gets the enter-only move.
  assert.match(code, /if \(ownCsp\(from\) \|\| ownCsp\(to\)\) \{\s*html\.setAttribute\('data-nk-nav', direction\);\s*markEnter\(direction\);\s*return;\s*\}/);
  assert.match(code, /url\.origin !== window\.location\.origin/);
  assert.match(code, /const start = \(document as ViewTransitionDocument\)\.startViewTransition;/);
  assert.match(code, /start\.call\(\s*document,/);
  assert.match(code, /window\.addEventListener\('popstate', onPop\)/);
  assert.match(code, /setTimeout\(done, NAV_WAIT_MS\)/, 'a slow page never keeps the screen frozen');
  // A page that draws no frame (hidden, busy) never calls the update: the change still happens, without the move.
  assert.match(code, /window\.setTimeout\(\(\) => \{\s*if \(!pushed\) \{\s*transition\.skipTransition\?\.\(\);\s*go\(\);\s*\}\s*\}, START_WAIT_MS\);/);
  assert.match(code, /const go = \(\) => \{\s*if \(pushed\) return;\s*pushed = true;/, 'the page changes once');
  assert.match(read('app/components/guest/GuestShell.tsx'), /<GuestPageTransition \/>/);
});

test('pages with their own CSP are the room and search pages, as in next.config (lib/guest-csp.js)', () => {
  for (const p of ['/rooms/41', '/en/rooms/x', '/search', '/ja/search']) assert.equal(nav.ownCsp(p), true, p);
  for (const p of ['/', '/find', '/saved', '/rent/sukhumvit', '/searchx', '/rooms']) assert.equal(nav.ownCsp(p), false, p);
  const csp = require('./guest-csp.js');
  assert.deepEqual(csp.GUEST_ROOM_CSP_SOURCES, ['/rooms/:id*', '/:locale(en|ja|zh)/rooms/:id*']);
  assert.deepEqual(csp.GUEST_SEARCH_CSP_SOURCES, ['/search', '/:locale(en|ja|zh)/search']);
});
