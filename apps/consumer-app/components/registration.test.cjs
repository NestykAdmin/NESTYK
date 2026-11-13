const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, randomBytes } = require('node:crypto');
const ts = require('typescript');
const React = require('react');
const root = path.resolve(__dirname, '../../..');

function load(filename, deps = {}, development = true) {
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }).outputText;
  new Function('require', 'module', 'exports', '__DEV__', source)(id => {
    if (id in deps) return deps[id];
    if (id.startsWith('.')) {
      const base = path.resolve(path.dirname(filename), id);
      const file = [base, `${base}.ts`, `${base}.tsx`].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
      if (file) return load(file, deps, development);
    }
    throw new Error(`Unexpected dependency: ${id}`);
  }, mod, mod.exports, development);
  return mod.exports;
}
function nodes(element) {
  if (element == null || typeof element === 'boolean') return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!React.isValidElement(element)) return [element];
  return [element, ...nodes(element.props.children)];
}
function screen({ result = { needsEmailConfirmation: true }, error, development = true, platform = 'web' } = {}) {
  const state = [], calls = [], routes = [], google = [], facebook = [];
  let cursor = 0;
  const t = load(`${root}/packages/i18n/src/locales/en.ts`).en;
  const deps = {
    react: { ...React, useEffect() {}, useRef: () => ({ current: null }), useState: initial => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
    } },
    'react-native': { View: 'View', Text: 'Text', ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView', TouchableOpacity: 'TouchableOpacity', Platform: { OS: platform }, StyleSheet: { create: x => x, hairlineWidth: 1, absoluteFill: {}, absoluteFillObject: {} } },
    'react-native-svg': { __esModule: true, default: 'Svg', Path: 'Path' },
    'expo-image': { Image: 'Image' },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    // register.tsx reads `next` (guest session plan A6); none here, so sign-up still goes to "/" (lib/web-routes.ts).
    'expo-router': { useRouter: () => ({ replace: route => routes.push(route) }), useLocalSearchParams: () => ({}) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@nestyk/i18n': { useLocale: () => ({ t, locale: 'en' }), localizedError: (e, fallback) => e?.message ?? fallback },
    '@nestyk/ui/native': { MobileInput: 'Input', MobileButton: 'Button', MobileIcon: 'Icon', MobileNestykLogo: 'Logo', SelectionCheck: 'SelectionCheck',
      useMobileTheme: () => ({ theme: {} }), tokens: { typography: { native: {} }, colors: { primary: '#211e1e', brand: { 500: '#f8b615' }, error: '#dc2626' } } },
    '../lib/auth/AuthContext': { useAuth: () => ({ isAuthenticated: false, signInWithGoogle: async () => { google.push('google'); }, signInWithFacebook: async () => { facebook.push('facebook'); }, verifySignupCode: async () => {}, resendSignupCode: async () => {}, signUp: async (...args) => { calls.push(args); if (error) throw error; return result; } }) },
    '../components/PhoneField': { PhoneField: 'PhoneField' },
    '../lib/phone': { phoneDraftToE164: (draft) => draft?.digits ? `+66${draft.digits}` : null },
    '../lib/auth/password-rules': { passwordIsStrong: (password) => password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) },
    'react-native-webview': { WebView: 'WebView' },
    '../assets/login-apartment.jpg': 1,
  };
  const file = path.join(__dirname, '../app/register.tsx');
  const Component = fs.existsSync(file) ? load(file, deps, development).default : () => null;
  const render = () => { cursor = 0; return nodes(Component()); };
  const fill = (label, value) => {
    const field = render().find(n => n?.type === 'Input' && n.props.accessibilityLabel === label);
    assert.ok(field, `registration field ${label} exists`);
    field.props.onChangeText(value);
  };
  const submit = () => {
    const button = render().find(n => n?.type === 'Button' && n.props.onPress);
    assert.ok(button, 'registration submit exists');
    return button.props.onPress();
  };
  return { render, fill, submit, calls, routes, google, facebook, copy: t.mobile.auth, labels: t.mobile.account };
}
function fillValid(form) {
  const password = `Aa1${randomBytes(4).toString('hex')}`;
  form.fill(form.labels.firstName, 'Mary Ann');
  form.fill(form.labels.lastName, 'Van Buren');
  form.render().find(n => n?.type === 'PhoneField').props.onChange({ region: 'TH', digits: '812345678' });
  form.render().find(n => n?.props?.accessibilityLabel === form.copy.acceptTerms).props.onPress();
  form.fill(form.copy.email, `${randomUUID()}@example.test`);
  form.fill(form.copy.password, password);
  form.fill(form.copy.confirmPassword, password);
}

test('registration offers Google below an or divider', () => {
  // Social sign-up works only when EXPO_PUBLIC_ENABLE_SOCIAL_LOGIN is "true" (off = "coming soon", next test).
  process.env.EXPO_PUBLIC_ENABLE_SOCIAL_LOGIN = 'true';
  const form = screen();
  const tree = form.render();
  assert.ok(tree.includes(form.copy.registerOr));
  const google = tree.find(n => n?.props?.accessibilityLabel === form.copy.registerWithGoogle);
  assert.ok(google);
  assert.ok(tree.includes(form.copy.registerWithGoogle));
  google.props.onPress();
  assert.deepEqual(form.google, ['google']);
  assert.equal(form.calls.length, 0);
  const facebook = tree.find(n => n?.props?.accessibilityLabel === form.copy.registerWithFacebook);
  assert.ok(facebook);
  assert.ok(tree.indexOf(form.copy.registerWithGoogle) < tree.indexOf(form.copy.registerWithFacebook));
  facebook.props.onPress();
  assert.deepEqual(form.facebook, ['facebook']);
  assert.equal(form.calls.length, 0);
  // Apple has no provider yet: still "coming soon" with the flag on.
  const apple = tree.find(n => n?.props?.accessibilityLabel === form.copy.registerWithApple);
  apple.props.onPress();
  assert.ok(form.render().includes(form.copy.unavailable));
  delete process.env.EXPO_PUBLIC_ENABLE_SOCIAL_LOGIN;
});

test('social sign-up off: Google, Facebook and Apple say "coming soon" and only explain when pressed', () => {
  delete process.env.EXPO_PUBLIC_ENABLE_SOCIAL_LOGIN;
  const form = screen();
  let tree = form.render();
  const labels = [form.copy.registerWithGoogle, form.copy.registerWithFacebook, form.copy.registerWithApple];
  for (const label of labels) {
    const button = tree.find(n => n?.props?.accessibilityLabel === label);
    assert.ok(button, label);
    assert.equal(button.props.accessibilityHint, form.copy.socialComingSoon, label);
  }
  assert.equal(tree.filter(n => n === form.copy.socialComingSoon).length, 3);
  assert.equal(tree.includes(form.copy.unavailable), false);
  for (const label of labels) {
    form.render().find(n => n?.props?.accessibilityLabel === label).props.onPress();
  }
  tree = form.render();
  assert.ok(tree.includes(form.copy.unavailable));
  assert.deepEqual(form.google, []);
  assert.deepEqual(form.facebook, []);
  assert.equal(form.calls.length, 0);
});

test('registration validates empty fields, invalid email and mismatched passwords before contacting auth', async () => {
  const form = screen();
  await form.submit();
  assert.ok(form.render().includes(form.copy.registrationRequiredFields));
  fillValid(form);
  form.fill(form.copy.email, 'invalid');
  await form.submit();
  assert.ok(form.render().includes(form.copy.invalidEmail));
  form.fill(form.copy.email, `${randomUUID()}@example.test`);
  form.fill(form.copy.confirmPassword, randomBytes(12).toString('hex'));
  await form.submit();
  assert.ok(form.render().includes(form.copy.passwordMismatch));
  assert.equal(form.calls.length, 0);
});

test('registration explains email confirmation and does not enter the app before confirmation', async () => {
  const form = screen();
  fillValid(form);
  await form.submit();
  assert.equal(form.calls.length, 1);
  assert.deepEqual(form.calls[0].slice(2, 4), ['Mary Ann', 'Van Buren']);
  assert.ok(form.render().includes(form.copy.emailConfirmationBody));
  assert.equal(form.render().includes(form.copy.registerOr), false);
  assert.deepEqual(form.routes, []);
});

test('registration requires both first and last name before contacting auth', async () => {
  const form = screen();
  fillValid(form);
  form.fill(form.labels.lastName, '   ');
  await form.submit();
  assert.equal(form.calls.length, 0);
  assert.ok(form.render().includes(form.copy.registrationRequiredFields));
  form.fill(form.labels.lastName, 'Van Buren');
  form.fill(form.labels.firstName, '   ');
  await form.submit();
  assert.equal(form.calls.length, 0);
});

test('successful registration enters the app; a signup rejection stays on the form with feedback', async () => {
  // Mobile goes home from the handler as before.
  const success = screen({ result: { needsEmailConfirmation: false }, platform: 'ios' });
  fillValid(success);
  await success.submit();
  assert.deepEqual(success.routes, ['/']);
  // Web leaves through the signed-in effect, which has the account's roles (review R1, 13 Nov 2026): the handler
  // still holds the signed-out session, so on agent.nestyk.com it would have sent a new agent to /no-access.
  const web = screen({ result: { needsEmailConfirmation: false } });
  fillValid(web);
  await web.submit();
  assert.deepEqual(web.routes, []);
  const failed = screen({ error: new Error('Email already registered') });
  fillValid(failed);
  await failed.submit();
  // QA reply item 3 (9 Nov 2026): our own text, never the raw message.
  assert.ok(failed.render().includes(failed.copy.registrationFailed));
  assert.ok(!failed.render().includes('Email already registered'));
  assert.deepEqual(failed.routes, []);
});

test('test registration is opt-in, can be toggled, and requests the no-email flow only when selected', async () => {
  const form = screen({ result: { needsEmailConfirmation: false } });
  const checkbox = () => form.render().find(n => n?.props?.accessibilityLabel === form.copy.testRegistration);
  assert.ok(checkbox(), 'development registration offers a test checkbox');
  assert.equal(checkbox().props.accessibilityState.checked, false);
  assert.equal(checkbox().props['aria-checked'], false);
  checkbox().props.onPress();
  assert.equal(checkbox().props.accessibilityState.checked, true);
  assert.equal(checkbox().props['aria-checked'], true);
  fillValid(form);
  await form.submit();
  assert.equal(form.calls[0][5], true);
});

test('registration asks for the captcha before signup when hCaptcha is configured', async () => {
  process.env.EXPO_PUBLIC_HCAPTCHA_SITE_KEY = 'site-key';
  try {
    const form = screen();
    fillValid(form);
    await form.submit();
    assert.equal(form.calls.length, 0);
    assert.ok(form.render().includes(form.copy.captchaRequired));
  } finally {
    delete process.env.EXPO_PUBLIC_HCAPTCHA_SITE_KEY;
  }
});

test('production registration never offers the test checkbox and keeps normal signup', async () => {
  const form = screen({ development: false });
  assert.equal(form.render().some(n => n?.props?.accessibilityLabel === form.copy.testRegistration), false);
  fillValid(form);
  await form.submit();
  assert.ok(!form.calls[0][5]);
  assert.ok(form.render().includes(form.copy.emailConfirmationBody));
});
