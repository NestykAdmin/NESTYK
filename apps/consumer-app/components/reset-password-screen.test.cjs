// app/reset-password.tsx: the reset email links to /reset-password?token_hash=…&type=recovery. That link works on
// any device (no PKCE verifier needed). Supabase spends it once, so the page spends it when the new password is saved,
// not when the page opens: until then the email link can be opened again. The token leaves the address bar at once,
// and a device signed in to another account signs out before the link is checked (review 513fbf0 R3).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const root = path.resolve(__dirname, '../../..');

function load(filename, deps) {
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }).outputText;
  new Function('require', 'module', 'exports', source)((id) => {
    if (id in deps) return deps[id];
    if (id.startsWith('.')) {
      const base = path.resolve(path.dirname(filename), id);
      const file = [base, `${base}.ts`, `${base}.tsx`].find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
      if (file) return load(file, deps);
    }
    throw new Error(`Unexpected dependency: ${id}`);
  }, mod, mod.exports);
  return mod.exports;
}
function nodes(element) {
  if (element == null || typeof element === 'boolean') return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!React.isValidElement(element)) return [element];
  if (element.type === React.Fragment) return nodes(element.props.children);
  return [element, ...nodes(element.props.children)];
}
const en = load(`${root}/packages/i18n/src/locales/en.ts`, {}).en;
const copy = en.mobile.auth;

function screen({ tokenHash = null, pkceLink = false, verify = async () => {}, save = async () => {}, signedIn = false } = {}) {
  const state = [], refs = [], replaced = [], calls = [];
  const auth = { signedIn };
  let cursor = 0, refCursor = 0;
  global.window = { location: { pathname: '/reset-password', search: tokenHash ? `?token_hash=${tokenHash}&type=recovery` : '' },
    history: { replaceState: (...args) => { replaced.push(args); global.window.location.search = ''; } } };
  const deps = {
    react: { ...React,
      useEffect: (effect) => { effect(); },
      useRef: (initial) => { const i = refCursor++; if (!(i in refs)) refs[i] = { current: initial }; return refs[i]; },
      useState: (initial) => {
        const i = cursor++;
        if (!(i in state)) state[i] = initial;
        return [state[i], (next) => { state[i] = typeof next === 'function' ? next(state[i]) : next; }];
      } },
    'react-native': { View: 'View', Text: 'Text', ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'web' },
      StyleSheet: { create: (x) => x, absoluteFill: {}, absoluteFillObject: {} } },
    'expo-image': { Image: 'Image' },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'expo-router': { useRouter: () => ({ replace() {} }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@nestyk/i18n': { useLocale: () => ({ t: en, locale: 'en' }), localizedError: (e, fallback) => fallback },
    '@nestyk/ui/native': { AccountCompleteModal: 'Modal', MobileButton: 'Button', MobileInput: 'Input', MobileNestykLogo: 'Logo',
      useMobileTheme: () => ({ theme: {} }), tokens: { typography: { native: {} }, colors: { error: '#dc2626' } } },
    '../lib/auth/AuthContext': { useAuth: () => ({ isAuthenticated: auth.signedIn, requestPasswordReset: async () => {},
      signOut: async () => { calls.push(['sign-out']); auth.signedIn = false; },
      saveResetPassword: (password) => { calls.push(['save', password]); return save(password); },
      enterAfterPasswordReset: async () => {}, verifyRecoveryLink: (hash) => { calls.push(['verify', hash]); return verify(hash); } }) },
    '../lib/auth/supabase': { openedPasswordResetLink: pkceLink || Boolean(tokenHash), openedRecoveryTokenHash: tokenHash },
    '../lib/auth/password-rules': { passwordIsStrong: () => true },
    '../lib/auth/hcaptcha-site-key': { hcaptchaSiteKey: () => '' },
    '../components/HcaptchaField': { HcaptchaField: 'Hcaptcha' },
    '../assets/login-apartment.jpg': 1,
  };
  const Component = load(path.join(__dirname, '../app/reset-password.tsx'), deps).default;
  const render = () => { cursor = 0; refCursor = 0; return nodes(Component()); };
  const labels = () => render().filter((n) => n?.type === 'Input').map((n) => n.props.accessibilityLabel);
  const texts = () => render().filter((n) => typeof n === 'string');
  const fill = (label, value) => render().find((n) => n?.type === 'Input' && n.props.accessibilityLabel === label).props.onChangeText(value);
  const press = (label) => render().find((n) => n?.type === 'Button' && n.props.children === label).props.onPress();
  const saveNewPassword = async (password = 'Abcdefg1') => {
    fill(copy.password, password);
    fill(copy.confirmPassword, password);
    press(copy.resetNewTitle);
    await new Promise((r) => setImmediate(r));
  };
  const done = () => render().find((n) => n?.type === 'Modal').props.visible;
  return { render, labels, texts, calls, replaced, saveNewPassword, done, auth };
}

test('opening the reset link does not spend it, and the token leaves the address bar at once', () => {
  const page = screen({ tokenHash: 'abc123' });
  page.render();
  page.render();
  assert.deepEqual(page.labels(), [copy.password, copy.confirmPassword]);
  assert.deepEqual(page.calls, [], 'nothing is sent to Supabase just by opening the page, so the email link still works');
  assert.deepEqual(page.replaced, [[null, '', '/reset-password']], 'dropped once, before anything is checked');
});

test('saving the new password spends the link, then stores the password', async () => {
  const page = screen({ tokenHash: 'abc123' });
  await page.saveNewPassword('Abcdefg1');
  assert.deepEqual(page.calls, [['verify', 'abc123'], ['save', 'Abcdefg1']]);
  assert.deepEqual(page.replaced, [[null, '', '/reset-password']]);
  assert.equal(page.done(), true);
});

test('a used or expired link is found at save: nothing is saved, the page stays and shows the message', async () => {
  const page = screen({ tokenHash: 'used', verify: async () => { throw new Error('Email link is invalid or has expired'); } });
  await page.saveNewPassword();
  assert.deepEqual(page.calls, [['verify', 'used']], 'the new password is never sent');
  assert.deepEqual(page.labels(), [copy.password, copy.confirmPassword], 'still the new-password page, not the email step');
  assert.ok(page.texts().includes(copy.resetLinkInvalid));
  assert.equal(page.done(), false);
  await page.saveNewPassword();
  assert.deepEqual(page.calls, [['verify', 'used'], ['verify', 'used']], 'trying again checks the link again and still saves nothing');
});

test('a rejected password keeps the spent link sign-in: the retry does not check the link again', async () => {
  let attempts = 0;
  const page = screen({ tokenHash: 'abc123', save: async () => { attempts += 1; if (attempts === 1) throw new Error('New password should be different from the old password.'); } });
  await page.saveNewPassword('Abcdefg1');
  assert.equal(page.done(), false);
  assert.deepEqual(page.labels(), [copy.password, copy.confirmPassword]);
  await page.saveNewPassword('Abcdefg2');
  assert.deepEqual(page.calls, [['verify', 'abc123'], ['save', 'Abcdefg1'], ['save', 'Abcdefg2']]);
  assert.equal(page.done(), true);
});

test('the page opened without a link starts at the email step and checks nothing', () => {
  const page = screen();
  assert.deepEqual(page.labels(), [copy.email]);
  assert.deepEqual(page.calls, []);
});

test('an older PKCE link (?code=) opens the new-password step and saves without a token check', async () => {
  const page = screen({ pkceLink: true });
  assert.deepEqual(page.labels(), [copy.password, copy.confirmPassword]);
  await page.saveNewPassword('Abcdefg1');
  assert.deepEqual(page.calls, [['save', 'Abcdefg1']]);
});

test('signed in (maybe as another account): this device signs out before the link is checked (review 513fbf0 R3)', async () => {
  const page = screen({ tokenHash: 'abc123', signedIn: true });
  page.render();
  assert.deepEqual(page.calls, [], 'opening the page signs nobody out');
  await page.saveNewPassword('Abcdefg1');
  assert.deepEqual(page.calls, [['sign-out'], ['verify', 'abc123'], ['save', 'Abcdefg1']]);
  assert.equal(page.done(), true);
});
