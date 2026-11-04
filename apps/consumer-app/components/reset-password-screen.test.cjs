// app/reset-password.tsx: the reset email links to /reset-password?token_hash=…&type=recovery. That link works on
// any device (no PKCE verifier needed), works once, and is dropped from the address after it is checked.
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

function screen({ tokenHash = null, pkceLink = false, verify = async () => {}, ready = true, signedIn = false } = {}) {
  const state = [], refs = [], verified = [], replaced = [], order = [];
  const auth = { ready, signedIn };
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
    '../lib/auth/AuthContext': { useAuth: () => ({ ready: auth.ready, isAuthenticated: auth.signedIn, requestPasswordReset: async () => {},
      saveResetPassword: async () => {}, enterAfterPasswordReset: async () => {},
      signOut: async () => { order.push('signOut'); auth.signedIn = false; },
      verifyRecoveryLink: (hash) => { order.push('verify'); verified.push(hash); return verify(hash); } }) },
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
  return { render, labels, texts, verified, replaced, order, auth, flush: () => new Promise((r) => setImmediate(r)) };
}

test('a reset link opened on any device checks the token, then asks for the new password', async () => {
  const page = screen({ tokenHash: 'abc123' });
  assert.ok(page.texts().includes(copy.resetLinkChecking));
  assert.deepEqual(page.labels(), []);
  await page.flush();
  page.render();
  assert.deepEqual(page.verified, ['abc123'], 'the link is checked once, even though the page renders again');
  assert.deepEqual(page.labels(), [copy.password, copy.confirmPassword]);
  assert.deepEqual(page.replaced, [[null, '', '/reset-password']], 'the token leaves the address bar');
});

test('a used or expired link goes back to the email step and says so', async () => {
  const page = screen({ tokenHash: 'used', verify: async () => { throw new Error('Token has expired or is invalid'); } });
  page.render();
  await page.flush();
  assert.deepEqual(page.labels(), [copy.email]);
  assert.ok(page.texts().includes(copy.resetLinkInvalid));
});

test('the page opened without a link starts at the email step and checks nothing', () => {
  const page = screen();
  assert.deepEqual(page.labels(), [copy.email]);
  assert.deepEqual(page.verified, []);
  assert.deepEqual(page.replaced, []);
});

test('an older PKCE link (?code=) still opens the new-password step', () => {
  const page = screen({ pkceLink: true });
  assert.deepEqual(page.labels(), [copy.password, copy.confirmPassword]);
  assert.deepEqual(page.verified, []);
});

test('signed in (maybe as another account): this device signs out before the link is checked (review 513fbf0 R3)', async () => {
  const page = screen({ tokenHash: 'abc123', signedIn: true });
  page.render();
  await page.flush();
  await page.flush();
  page.render();
  assert.deepEqual(page.order, ['signOut', 'verify']);
  assert.deepEqual(page.labels(), [copy.password, copy.confirmPassword]);
});

test('the link waits for the saved sign-in to load, but leaves the address bar at once', async () => {
  const page = screen({ tokenHash: 'abc123', ready: false });
  page.render();
  await page.flush();
  assert.deepEqual(page.verified, []);
  assert.deepEqual(page.replaced, [[null, '', '/reset-password']]);
  page.auth.ready = true;
  page.render();
  await page.flush();
  assert.deepEqual(page.order, ['verify']);
  assert.deepEqual(page.replaced.length, 1);
});
