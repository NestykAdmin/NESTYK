// Sign-in redesign (Mos 17 Nov 2026): Turnstile runs hidden, so a press before its token arrives waits and goes on
// by itself. These run the real login screen (effects included) with CaptchaField and AuthLayout stubbed.
// Review findings R1 (no answer = stuck), R2 (fields cleared while waiting), R5 (failed flag after a new token).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const root = path.resolve(__dirname, '../../..');

function load(filename, deps = {}) {
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }).outputText;
  new Function('require', 'module', 'exports', '__DEV__', source)(id => {
    if (id in deps) return deps[id];
    if (id.startsWith('.')) {
      const base = path.resolve(path.dirname(filename), id);
      const file = [base, `${base}.ts`, `${base}.tsx`].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
      if (file) return load(file, deps);
    }
    throw new Error(`Unexpected dependency: ${id}`);
  }, mod, mod.exports, true);
  return mod.exports;
}
function nodes(element) {
  if (element == null || typeof element === 'boolean') return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!React.isValidElement(element)) return [element];
  const { children, topBar, hero, action, after, footer } = element.props;
  return [element, ...[children, topBar, hero, action, after, footer].flatMap(nodes)];
}
const t = load(`${root}/packages/i18n/src/locales/en.ts`).en;

/** The login screen with a Turnstile site key. Effects run after each render when their deps change; timers are manual. */
function screen({ signInError } = {}) {
  const state = [], effects = [], signIns = [], timers = new Map();
  let cursor = 0, effectCursor = 0, nextTimer = 1, pending = [];
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const deps = {
    react: { ...React,
      useRef: () => ({ current: null }),
      useState: initial => {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
      },
      useEffect: (fn, list) => {
        const index = effectCursor++;
        const prev = effects[index];
        if (!prev || !sameDeps(prev.deps, list)) {
          if (prev?.cleanup) pending.push(prev.cleanup);
          const slot = { deps: list, cleanup: null };
          effects[index] = slot;
          pending.push(() => { const c = fn(); slot.cleanup = typeof c === 'function' ? c : null; });
        }
      } },
    'react-native': { View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', TextInput: 'TextInput',
      Platform: { OS: 'web' }, Keyboard: { dismiss() {} },
      StyleSheet: { create: x => x, hairlineWidth: 1, absoluteFill: {}, absoluteFillObject: {} } },
    'react-native-svg': { __esModule: true, default: 'Svg', Path: 'Path' },
    'phosphor-react-native': { Eye: 'Eye', EyeSlash: 'EyeSlash', LockKey: 'LockKey', ArrowRight: 'ArrowRight' },
    // F7 (Jom 18 Nov 2026): login.tsx imports each icon from its own file.
    'phosphor-react-native/src/icons/Eye': { Eye: 'Eye' },
    'phosphor-react-native/src/icons/EyeSlash': { EyeSlash: 'EyeSlash' },
    'phosphor-react-native/src/icons/LockKey': { LockKey: 'LockKey' },
    'phosphor-react-native/src/icons/ArrowRight': { ArrowRight: 'ArrowRight' },
    'expo-router': { useRouter: () => ({ replace() {}, push() {} }), useLocalSearchParams: () => ({}) },
    '@nestyk/i18n': { useLocale: () => ({ t, locale: 'en' }), localizedError: (e, fallback) => e?.message ?? fallback },
    '@nestyk/ui/native': { MobileIcon: 'Icon', MobileBottomSheet: 'BottomSheet', MobileButton: 'Button', MobileInput: 'Input', MobileLanguagePickerBody: 'LanguagePicker', MobileNestykLogo: 'Logo',
      useMobileTheme: () => ({ theme: {}, isDark: false }), tokens: { typography: { native: {} }, colors: { primary: '#211e1e', brand: { 500: '#f8b615' }, danger: '#dc2626' } } },
    '../lib/auth/AuthContext': { useAuth: () => ({ isAuthenticated: false, session: null, sessionExpired: false, dismissSessionExpired() {},
      signInWithGoogle: async () => {}, signInWithFacebook: async () => {},
      signIn: async (...args) => { signIns.push(args); if (signInError) throw signInError; } }) },
    '../lib/auth/captcha-site-key': { captchaSiteKey: () => '1x00000000000000000000AA' },
    '../components/CaptchaField': { CaptchaField: 'CaptchaField' },
    '../components/auth/AuthLayout': { AuthLayout: 'AuthLayout' },
    '../components/legal/AuthLegalFooter': { AuthLegalFooter: 'AuthLegalFooter' },
    '../lib/auth/dev-auth': { DEV_AUTH_CONFIG: { enabled: false, email: '', password: '' } },
    '../lib/auth/google-oauth': { socialLoginProvider: () => null },
    '../lib/auth/role-gate': { requestGuestBrowse() {} },
    '../lib/config': { APP_CONFIG: { defaultRole: 'tenant' } },
    '../lib/web-routes': { goAfterSignIn() {}, goToGuestHome() {} },
    '../lib/app-routes': { withNextParam: p => p },
    '../assets/login-apartment.jpg': 1,
  };
  const realSetTimeout = global.setTimeout, realClearTimeout = global.clearTimeout;
  global.setTimeout = (fn, ms) => { const id = nextTimer++; timers.set(id, { fn, ms }); return id; };
  global.clearTimeout = id => { timers.delete(id); };
  const Component = load(path.join(__dirname, '../app/login.tsx'), deps).default;
  /** Render until state settles (effects may set state). */
  const render = () => {
    let tree;
    for (let i = 0; i < 10; i++) {
      cursor = 0; effectCursor = 0; pending = [];
      tree = nodes(Component());
      if (!pending.length) break;
      for (const run of pending) run();
    }
    return tree;
  };
  const flush = async () => { for (let i = 0; i < 5; i++) { await new Promise(r => setImmediate(r)); render(); } };
  const find = (type, test = () => true) => render().find(n => n?.type === type && test(n.props));
  const captcha = () => find('CaptchaField');
  const button = () => find('Button', p => p.onPress);
  const buttonLabel = () => {
    const b = button();
    return nodes(b.props.children).filter(n => typeof n === 'string').join('');
  };
  const fill = (label, value) => find('Input', p => p.accessibilityLabel === label).props.onChangeText(value);
  const shownError = () => find('Text', p => p.accessibilityRole === 'alert')?.props.children ?? null;
  const runTimers = () => { const all = [...timers.values()]; timers.clear(); all.forEach(({ fn }) => fn()); render(); };
  const restore = () => { global.setTimeout = realSetTimeout; global.clearTimeout = realClearTimeout; };
  return { render, flush, captcha, button, buttonLabel, fill, shownError, runTimers, timers, signIns, restore };
}

function filled(opts) {
  const s = screen(opts);
  s.render();
  s.fill(t.mobile.auth.email, 'qa@example.test');
  s.fill(t.mobile.auth.password, 'Secret123');
  return s;
}

test('a press before the token waits ("Checking…", button off), then signs in once when the token arrives', async () => {
  const s = filled();
  try {
    await s.button().props.onPress();
    assert.equal(s.signIns.length, 0, 'no sign in without a token');
    assert.equal(s.button().props.disabled, true);
    assert.equal(s.buttonLabel(), t.webSession.captchaChecking);
    s.captcha().props.onToken('tok-1');
    await s.flush();
    assert.equal(s.signIns.length, 1, 'signed in by itself, once');
    assert.equal(s.signIns[0][2], 'tok-1');
  } finally { s.restore(); }
});

test('the check fails while waiting: the press stops, says so, and the next press restarts the widget', async () => {
  const s = filled();
  try {
    await s.button().props.onPress();
    const key = s.captcha().props.resetKey;
    s.captcha().props.onFailed();
    s.render();
    assert.equal(s.button().props.disabled, false);
    assert.equal(s.shownError(), t.webSession.captchaFailed);
    await s.button().props.onPress();
    assert.equal(s.captcha().props.resetKey, key + 1, 'a new check for this press');
  } finally { s.restore(); }
});

test('R1: no answer from Turnstile at all (script blocked): the wait ends after a while with a message', async () => {
  const s = filled();
  try {
    await s.button().props.onPress();
    s.render();
    assert.ok(s.timers.size >= 1, 'a time limit is set while waiting');
    s.runTimers();
    assert.equal(s.button().props.disabled, false, 'the button works again');
    assert.equal(s.shownError(), t.webSession.captchaFailed);
    assert.equal(s.signIns.length, 0);
  } finally { s.restore(); }
});

test('R2: fields cleared while waiting: the token ends the wait with "fill in", not a stuck "Checking…"', async () => {
  const s = filled();
  try {
    await s.button().props.onPress();
    s.fill(t.mobile.auth.email, '');
    s.captcha().props.onToken('tok-1');
    await s.flush();
    assert.equal(s.signIns.length, 0);
    assert.equal(s.button().props.disabled, false);
    assert.equal(s.buttonLabel(), t.mobile.auth.loginButton);
    assert.equal(s.shownError(), t.mobile.auth.requiredFields);
  } finally { s.restore(); }
});

test('R5: a new token after a failure clears the failure, so the next press does not restart a working check', async () => {
  const s = filled();
  try {
    s.captcha().props.onFailed();       // e.g. expired
    s.captcha().props.onToken('tok-2'); // Turnstile refreshed by itself
    s.captcha().props.onToken(null);    // spent by a sign-in attempt elsewhere in the flow
    s.render();
    const key = s.captcha().props.resetKey;
    await s.button().props.onPress();
    assert.equal(s.captcha().props.resetKey, key, 'no restart');
  } finally { s.restore(); }
});

test('a wrong password after waiting shows its own text and a fresh check starts', async () => {
  const s = filled({ signInError: Object.assign(new Error('Invalid login credentials'), { name: 'AuthApiError', status: 400, code: 'invalid_credentials' }) });
  try {
    await s.button().props.onPress();
    const key = s.captcha().props.resetKey;
    s.captcha().props.onToken('tok-1');
    await s.flush();
    assert.equal(s.shownError(), t.mobile.auth.invalidCredentials);
    assert.equal(s.captcha().props.resetKey, key + 1);
    assert.equal(s.button().props.disabled, false);
  } finally { s.restore(); }
});
