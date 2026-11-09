// PDPA / cookie plan (project-docs/nestyk-cookie-consent-plan-20261109.md, Mos + QA 9 Nov 2026; consent bar Mos 17:08):
// cookie consent bar (necessary always on; "Remember my settings" and Google Maps only when allowed), FE2 storage list on
// /privacy, FE3 "Cookie settings" links, FE4 no dev identity in production, FE5 register text, L3 versions, 3.3a proof.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const appRoot = path.join(__dirname, '..');
const repoRoot = path.join(appRoot, '..', '..');

function loadTs(file, deps = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)((id) => {
    if (id in deps) return deps[id];
    throw new Error(`${file} must not import ${id}`);
  }, mod, mod.exports);
  return mod.exports;
}
const read = (rel) => fs.readFileSync(path.join(appRoot, rel), 'utf8');
const readRepo = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const notice = loadTs(path.join(__dirname, 'cookie-notice.ts'));
const consentFile = path.join(repoRoot, 'packages/ui/src/consent/cookieConsent.ts');
const loadConsent = () => loadTs(consentFile); // fresh module state each time
const legalDir = path.join(repoRoot, 'packages/i18n/src/locales/legal');
const copies = {
  th: loadTs(path.join(legalDir, 'th.ts')).legalTh,
  en: loadTs(path.join(legalDir, 'en.ts'), { './th': {} }).legalEn,
  ja: loadTs(path.join(legalDir, 'ja.ts'), { './th': {} }).legalJa,
  zh: loadTs(path.join(legalDir, 'zh.ts'), { './th': {} }).legalZh,
};

/** A minimal browser page: window (events + localStorage) and document. */
function withBrowser(fn, { blockedStorage = false } = {}) {
  const store = new Map();
  const win = new EventTarget();
  Object.defineProperty(win, 'localStorage', {
    get() {
      if (blockedStorage) throw new Error('SecurityError');
      return {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
      };
    },
  });
  globalThis.window = win;
  globalThis.document = {};
  try {
    return fn({ store, win });
  } finally {
    delete globalThis.window;
    delete globalThis.document;
  }
}

test('L3: every legal text has a dated version', () => {
  for (const v of [notice.TERMS_VERSION, notice.PRIVACY_VERSION, loadConsent().COOKIE_CONSENT_VERSION]) {
    assert.match(v, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('consent: a saved choice counts only for the current version', () => {
  const c = loadConsent();
  assert.equal(c.parseCookieConsent(null), null);
  assert.equal(c.parseCookieConsent(''), null);
  assert.equal(c.parseCookieConsent('not json'), null);
  assert.equal(c.parseCookieConsent('{"version":"1999-01-01","at":"x","maps":true}'), null, 'a new version asks again');
  const record = c.cookieConsentRecord({ preferences: true, maps: 'yes' }, new Date('2026-11-09T10:00:00Z'));
  assert.deepEqual(record, { version: c.COOKIE_CONSENT_VERSION, at: '2026-11-09T10:00:00.000Z', preferences: true, maps: false });
  assert.deepEqual(c.parseCookieConsent(JSON.stringify(record)), record);
});

test('consent: outside a web page (phone app, server render) nothing is blocked', () => {
  const c = loadConsent();
  assert.equal(c.cookieConsentAllows('preferences'), true);
  assert.equal(c.cookieConsentAllows('maps'), true);
  assert.equal(c.readCookieConsent(), null);
  assert.equal(typeof c.onCookieConsentChange(() => {}), 'function');
});

test('consent: opt-in on the web; "necessary only" removes saved settings; listeners hear every choice', () => {
  withBrowser(({ store }) => {
    const c = loadConsent();
    assert.equal(c.cookieConsentAllows('preferences'), false, 'nothing before a choice');
    assert.equal(c.cookieConsentAllows('maps'), false, 'no map before a choice');
    for (const key of c.PREFERENCE_STORAGE_KEYS) store.set(key, 'old');
    store.set('nestyk.auth.session.v1', 'keep');
    let heard = 0;
    const off = c.onCookieConsentChange(() => heard++);

    c.saveCookieConsent({ preferences: false, maps: true });
    assert.equal(heard, 1);
    assert.equal(c.cookieConsentAllows('preferences'), false);
    assert.equal(c.cookieConsentAllows('maps'), true);
    for (const key of c.PREFERENCE_STORAGE_KEYS) assert.equal(store.has(key), false, `${key} removed`);
    assert.equal(store.get('nestyk.auth.session.v1'), 'keep', 'necessary items stay');
    assert.equal(JSON.parse(store.get(c.COOKIE_CONSENT_KEY)).maps, true);

    store.set('nestyk.web.theme', 'dark');
    c.saveCookieConsent({ preferences: true, maps: false });
    assert.equal(heard, 2);
    assert.equal(store.get('nestyk.web.theme'), 'dark', 'allowed settings are kept');
    assert.equal(c.cookieConsentAllows('maps'), false, 'a choice can be taken back');
    off();
    c.saveCookieConsent({ preferences: true, maps: true });
    assert.equal(heard, 2, 'unsubscribed');
  });
});

test('consent: blocked browser storage keeps the choice for this page only', () => {
  withBrowser(() => {
    const c = loadConsent();
    assert.equal(c.cookieConsentAllows('maps'), false);
    c.saveCookieConsent({ preferences: false, maps: true });
    assert.equal(c.cookieConsentAllows('maps'), true);
  }, { blockedStorage: true });
});

test('consent: the settings link and the stored keys match the /privacy table', () => {
  const c = loadConsent();
  assert.equal(notice.COOKIE_SETTINGS_HREF, c.COOKIE_SETTINGS_HREF);
  const byName = new Map(notice.BROWSER_STORAGE_ITEMS.map((item) => [item.name, item]));
  assert.equal(byName.get(c.COOKIE_CONSENT_KEY)?.type, 'necessary');
  const preferences = notice.BROWSER_STORAGE_ITEMS.filter((item) => item.type === 'preference').map((item) => item.name);
  assert.deepEqual([...c.PREFERENCE_STORAGE_KEYS].sort(), preferences.sort());
});

test('3.3a: sign-up proof = accepted terms version + time, and the privacy version that was shown (not "accepted")', () => {
  assert.deepEqual(notice.signupLegalMetadata(new Date('2026-11-13T01:02:03Z')), {
    terms_version: notice.TERMS_VERSION,
    terms_accepted_at: '2026-11-13T01:02:03.000Z',
    privacy_version_shown: notice.PRIVACY_VERSION,
  });
  const auth = read('lib/auth/AuthContext.tsx');
  assert.match(auth, /registration_source: 'self_service',[\s\S]{0,200}\.\.\.signupLegalMetadata\(\),/);
  // The register button only runs sign-up after the terms checkbox is ticked.
  const register = read('app/register.tsx');
  assert.ok(register.indexOf('if (!acceptedTerms)') < register.indexOf('await signUp('));
});

test('FE2: every key the web writes is listed on /privacy, and nothing else (no dev identity)', () => {
  const listed = new Set(notice.BROWSER_STORAGE_ITEMS.map((item) => item.name));
  const written = new Set([loadConsent().COOKIE_CONSENT_KEY]);
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && full !== path.join(__dirname, 'cookie-notice.ts')) {
        for (const m of fs.readFileSync(full, 'utf8').matchAll(/['"](nestyk\.[A-Za-z0-9.]+|@nestyk\/preferred_locale)['"]/g)) written.add(m[1]);
      }
    }
  };
  for (const dir of ['lib', 'components', 'app']) walk(path.join(appRoot, dir));
  written.delete('nestyk.dev.agent.identity.v1'); // dev builds only (FE4)
  for (const key of written) assert.ok(listed.has(key), `${key} is written but not listed on /privacy`);
  for (const item of notice.BROWSER_STORAGE_ITEMS) {
    if (item.id !== 'supabase') assert.ok(written.has(item.name), `${item.name} is listed but never written`);
  }
  assert.ok(!listed.has('nestyk.dev.agent.identity.v1'));
});

test('consent: every remembered setting is written only when "Remember my settings" is allowed', () => {
  const guarded = (source, write) =>
    new RegExp(`cookieConsentAllows\\(["']preferences["']\\)\\) return;\\s*try \\{\\s*${write}`).test(source);
  assert.ok(guarded(read('lib/web-routes.web.ts'), 'window\\.localStorage\\.setItem\\(LAST_ROLE_KEY'), 'last role');
  assert.ok(guarded(read('components/agent-web/AgentWorkspace.web.tsx'), 'window\\.localStorage\\.setItem\\(THEME_PREF_KEY'), 'theme');
  assert.ok(guarded(read('components/agent-web/AgentRoomsPage.web.tsx'), 'window\\.localStorage\\.setItem\\(VIEW_KEY'), 'rooms view');
  assert.ok(guarded(read('lib/locale-storage.ts'), 'await AsyncStorage\\.setItem\\(PREFERRED_LOCALE_KEY'), 'language');
  // No other writes of these keys.
  for (const [file, key] of [
    ['lib/web-routes.web.ts', 'LAST_ROLE_KEY'],
    ['components/agent-web/AgentWorkspace.web.tsx', 'THEME_PREF_KEY'],
    ['components/agent-web/AgentRoomsPage.web.tsx', 'VIEW_KEY'],
    ['lib/locale-storage.ts', 'PREFERRED_LOCALE_KEY'],
  ]) {
    assert.equal(read(file).split(`setItem(${key}`).length - 1, 1, `${file} writes ${key} once`);
  }
});

test('consent: Google Maps (script or embed) loads only behind MapConsentGate', () => {
  const dir = 'packages/feature-listing/src/components';
  const nearby = readRepo(`${dir}/NearbyPlacesMap.web.tsx`);
  const place = readRepo(`${dir}/PropertyPlaceMap.web.tsx`);
  const share = readRepo(`${dir}/PublicRoomDesktopBody.tsx`);
  for (const [name, source] of [['nearby', nearby], ['place', place], ['share', share]]) {
    const providers = source.split('<APIProvider').length - 1;
    assert.ok(providers >= 1, name);
    assert.equal(source.match(/<MapConsentGate[^>]*>\s*<APIProvider/g)?.length, providers, `${name}: every map is gated`);
  }
  assert.match(place, /<MapConsentGate[^>]*>\s*<View style=\{styles\.wrap\}>\s*\{createElement\('iframe'/, 'embed fallback gated');
  // Nothing else on the web loads Google Maps.
  const hits = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'test') walk(full);
      } else if (/\.tsx?$/.test(entry.name) && /<APIProvider|google\.com\/maps\?/.test(fs.readFileSync(full, 'utf8'))) {
        hits.push(path.relative(repoRoot, full));
      }
    }
  };
  walk(path.join(repoRoot, 'packages/feature-listing/src'));
  walk(path.join(appRoot, 'components'));
  walk(path.join(appRoot, 'app'));
  assert.deepEqual(hits.sort(), [`${dir}/NearbyPlacesMap.web.tsx`, `${dir}/PropertyPlaceMap.web.tsx`, `${dir}/PublicRoomDesktopBody.tsx`]);
  const gate = readRepo(`${dir}/MapConsentGate.tsx`);
  assert.match(gate, /cookieConsentAllows\('maps'\)/);
  assert.match(gate, /saveCookieConsent\(\{ preferences: readCookieConsent\(\)\?\.preferences \?\? false, maps: true \}\)/);
});

test('consent bar: equal choice, necessary locked, settings reachable from footers and /privacy', () => {
  assert.match(read('app/_layout.tsx'), /<CookieNotice \/>/);
  assert.match(read('components/legal/CookieNotice.tsx'), /return null;/);
  const bar = read('components/legal/CookieNotice.web.tsx');
  assert.match(bar, /className="ck-btn" onClick=\{\(\) => choose\(ALL\)\} data-testid="cookieNotice\.acceptAll"/);
  assert.match(bar, /className="ck-btn" onClick=\{\(\) => choose\(NONE\)\} data-testid="cookieNotice\.necessaryOnly"/);
  assert.match(bar, /\{ id: 'necessary' as const, on: true, locked: true \}/);
  assert.match(bar, /disabled=\{category\.locked\}/);
  assert.match(bar, /if \(!readCookieConsent\(\)\) setOpen\(true\);/);
  assert.match(bar, /closest\?\.\(`a\[href="\$\{COOKIE_SETTINGS_HREF\}"\]`\)/);
  assert.match(bar, /const NONE: CookieChoice = \{ preferences: false, maps: false \};/, 'settings start unticked');
  assert.doesNotMatch(read('components/legal/cookie-notice.css'), /\.ck-notice::before|backdrop|inset: 0/, 'the bar does not block the page');
  assert.equal(notice.COOKIES_HREF, '/privacy#cookies');
  const page = read('components/legal/LegalPage.web.tsx');
  assert.match(page, /<section id="cookies"/);
  assert.match(page, /\{ id: 'cookies', title: cookies\.title \}/);
  assert.match(page, /<a href=\{COOKIE_SETTINGS_HREF\} className="lg-cookie-settings" data-testid="legal\.cookies\.settings">/);
  assert.match(read('components/legal/AuthLegalFooter.web.tsx'), /<a href=\{COOKIE_SETTINGS_HREF\} data-testid=/);
  assert.match(read('components/agent-web/AgentWorkspaceFooter.web.tsx'), /<a href=\{COOKIE_SETTINGS_HREF\} data-testid="shell\.footer\.cookies">/);
  for (const host of ['components/legal/LegalPage.web.tsx', 'components/legal/GuestPublicFooter.web.tsx']) {
    assert.match(read(host), /cookies: COOKIE_SETTINGS_HREF,/, host);
  }
  assert.match(readRepo('packages/ui/src/shells/PublicFooter.tsx'), /links\.cookies \?/);
  assert.match(readRepo('packages/ui/package.json'), /"\.\/cookie-consent": \{/);
});

test('copy: cookie bar, settings, map gate and cookie tables in all 4 languages', () => {
  for (const [locale, copy] of Object.entries(copies)) {
    const bar = copy.cookieNotice;
    for (const key of ['label', 'text', 'learnMore', 'acceptAll', 'necessaryOnly', 'settings', 'settingsTitle', 'save', 'close', 'alwaysOn', 'mapOff', 'mapShow']) {
      assert.ok(bar[key], `${locale} bar ${key}`);
    }
    for (const id of ['necessary', 'preferences', 'maps']) {
      assert.ok(bar.categories[id]?.title && bar.categories[id]?.text, `${locale} category ${id}`);
    }
    assert.notEqual(bar.acceptAll, bar.necessaryOnly);
    for (const item of notice.BROWSER_STORAGE_ITEMS) {
      assert.ok(copy.cookies.storage[item.id]?.purpose && copy.cookies.storage[item.id]?.kept, `${locale} ${item.id}`);
      assert.ok(copy.cookies.types[item.type], `${locale} type ${item.type}`);
    }
    for (const service of notice.THIRD_PARTY_SERVICES) {
      assert.ok(copy.cookies.services[service.id]?.purpose && copy.cookies.services[service.id]?.data, `${locale} ${service.id}`);
    }
    assert.ok(copy.cookies.settingsButton, `${locale} settings button`);
    assert.ok(copy.footer.cookies, `${locale} footer link`);
    assert.equal(copy.cookies.storage.cookieNotice, undefined, `${locale}: old notice row removed`);
  }
});

test('FE4: a production build never creates or stores a dev identity', async () => {
  const writes = [];
  const storage = { getItem: async () => null, setItem: async (k, v) => writes.push([k, v]) };
  const devIdentity = loadTs(path.join(__dirname, 'dev-identity.ts'), {
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    './auth/dev-auth': { DEV_AUTH_CONFIG: { enabled: false } },
  });
  assert.equal(await devIdentity.getOrCreateDevIdentity(), null);
  assert.equal(await devIdentity.getOrCreateDevIdentity(false), null);
  assert.deepEqual(writes, []);
  const made = await devIdentity.getOrCreateDevIdentity(true);
  assert.match(made.email, /@nestyk\.local$/);
  assert.equal(writes[0][0], 'nestyk.dev.agent.identity.v1');
});
