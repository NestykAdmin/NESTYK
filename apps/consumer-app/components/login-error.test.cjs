// QA Aof 10 Nov 2026 (login network error, item 2): open the login screen, make signIn fail, and check the text on screen.
// auth-error-messages.test.cjs only checks that login.tsx names each text; this one fails if "network" shows another text.
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
  return [element, ...nodes(element.props.children)];
}

// The real ApiError and NETWORK_ERROR from lib/api.ts (its network and session modules stubbed).
const { ApiError, NETWORK_ERROR } = load(path.join(__dirname, '../lib/api.ts'), {
  './config': { APP_CONFIG: {}, toDeviceUrls: s => s, toServerUrls: s => s },
  './dev-identity': { getOrCreateDevIdentity: async () => null, toDevBearer: () => '' },
  './auth/session-storage': { loadAuthSession: async () => null },
  './auth/supabase': { getSupabaseClient: () => null },
});
const t = load(`${root}/packages/i18n/src/locales/en.ts`).en;

/** The login screen with signIn throwing `error`; lib/auth/auth-error.ts is the real one. */
function screen(error) {
  const state = [], signIns = [], routes = [];
  let cursor = 0;
  const deps = {
    react: { ...React, useEffect() {}, useRef: () => ({ current: null }), useState: initial => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
    } },
    'react-native': { View: 'View', Text: 'Text', ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView', TouchableOpacity: 'TouchableOpacity', TextInput: 'TextInput',
      Platform: { OS: 'web' }, useWindowDimensions: () => ({ width: 390, height: 844 }),
      StyleSheet: { create: x => x, hairlineWidth: 1, absoluteFill: {}, absoluteFillObject: {} } },
    'react-native-svg': { __esModule: true, default: 'Svg', Path: 'Path' },
    'phosphor-react-native': { Eye: 'Eye', EyeSlash: 'EyeSlash', LockKey: 'LockKey', ArrowRight: 'ArrowRight' },
    'expo-image': { Image: 'Image' },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'expo-router': { useRouter: () => ({ replace: r => routes.push(r), push: r => routes.push(r) }), useLocalSearchParams: () => ({}) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@nestyk/i18n': { useLocale: () => ({ t, locale: 'en' }), localizedError: (e, fallback) => e?.message ?? fallback },
    '@nestyk/ui/native': { MobileIcon: 'Icon', MobileBottomSheet: 'BottomSheet', MobileButton: 'Button', MobileInput: 'Input', MobileLanguagePickerBody: 'LanguagePicker', MobileNestykLogo: 'Logo',
      useMobileTheme: () => ({ theme: {}, isDark: false }), tokens: { typography: { native: {} }, colors: { primary: '#211e1e', brand: { 500: '#f8b615' }, error: '#dc2626' } } },
    '../lib/auth/AuthContext': { useAuth: () => ({ isAuthenticated: false, session: null, sessionExpired: false, dismissSessionExpired() {},
      signInWithGoogle: async () => {}, signInWithFacebook: async () => {},
      signIn: async (...args) => { signIns.push(args); throw error; } }) },
    '../lib/auth/captcha-site-key': { captchaSiteKey: () => '' },
    '../components/CaptchaField': { CaptchaField: 'CaptchaField' },
    '../components/legal/AuthLegalFooter': { AuthLegalFooter: 'AuthLegalFooter' },
    '../lib/auth/dev-auth': { DEV_AUTH_CONFIG: { enabled: false, email: '', password: '' } },
    '../lib/auth/google-oauth': { socialLoginProvider: () => null },
    '../lib/auth/role-gate': { requestGuestBrowse() {} },
    '../lib/config': { APP_CONFIG: { defaultRole: 'tenant' } },
    '../lib/web-routes': { postLoginHref: () => '/' },
    '../assets/login-apartment.jpg': 1,
  };
  const Component = load(path.join(__dirname, '../app/login.tsx'), deps).default;
  const render = () => { cursor = 0; return nodes(Component()); };
  const fill = (label, value) => {
    const field = render().find(n => n?.type === 'Input' && n.props.accessibilityLabel === label);
    assert.ok(field, `login field ${label} exists`);
    field.props.onChangeText(value);
  };
  const submit = () => {
    const button = render().find(n => n?.type === 'Button' && n.props.onPress);
    assert.ok(button, 'login button exists');
    return button.props.onPress();
  };
  /** Text of the error line under the form (accessibilityRole "alert"), or null. */
  const shownError = () => {
    const alert = render().find(n => n?.type === 'Text' && n.props.accessibilityRole === 'alert');
    return alert ? alert.props.children : null;
  };
  return { fill, submit, shownError, signIns, routes };
}

async function failSignIn(error) {
  const login = screen(error);
  login.fill(t.mobile.auth.email, 'qa@example.test');
  login.fill(t.mobile.auth.password, 'Secret123');
  await login.submit();
  assert.equal(login.signIns.length, 1, 'signIn was called');
  assert.deepEqual(login.routes, [], 'stays on the login screen');
  return login.shownError();
}

test('the network and wrong-password texts are different, so the checks below can tell them apart', () => {
  assert.notEqual(t.mobile.auth.networkError, t.mobile.auth.invalidCredentials);
});

test('/auth/sync gets no answer (ApiError status 0, NETWORK_ERROR): the screen shows networkError, not the wrong-password text', async () => {
  const shown = await failSignIn(new ApiError('Failed to fetch', 0, NETWORK_ERROR));
  assert.equal(shown, t.mobile.auth.networkError);
  assert.notEqual(shown, t.mobile.auth.invalidCredentials);
  assert.notEqual(shown, 'Failed to fetch');
});

test('/auth/sync answers 5xx (API down or a proxy page): the screen shows networkError', async () => {
  const shown = await failSignIn(new ApiError('Bad Gateway', 502));
  assert.equal(shown, t.mobile.auth.networkError);
});

test('a real wrong password (Supabase invalid_credentials) still shows invalidCredentials', async () => {
  const shown = await failSignIn(Object.assign(new Error('Invalid login credentials'), { name: 'AuthApiError', status: 400, code: 'invalid_credentials' }));
  assert.equal(shown, t.mobile.auth.invalidCredentials);
});
