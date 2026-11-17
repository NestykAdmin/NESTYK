// Sign-in page layout, mixed design (Mos 17 Nov 2026): wide screens = card on the photo (design B),
// 768 px and below = photo band + form sheet (design A); the keyboard folds the band and keeps the button above it;
// Cloudflare Turnstile stays hidden until it needs the person ("interaction-only").
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const app = path.join(__dirname, '..', '..');
const root = path.join(app, '..', '..');
const read = (file) => fs.readFileSync(path.join(app, file), 'utf8');
function loadTs(file) {
  const out = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', out)((id) => { throw new Error(`unexpected import ${id}`); }, mod, mod.exports);
  return mod.exports;
}
const rules = loadTs('lib/auth/auth-layout-rules.ts');

test('wider than 768 px = card on the photo; 768 px and below = the sheet', () => {
  assert.equal(rules.authLayoutMode(1440), 'card');
  assert.equal(rules.authLayoutMode(769), 'card');
  assert.equal(rules.authLayoutMode(768), 'sheet');
  assert.equal(rules.authLayoutMode(390), 'sheet');
});

test('the browser keyboard is what hides at least 120 px of the page (a toolbar or zoom is not)', () => {
  assert.deepEqual(rules.keyboardFrame(844, 470, 0), { open: true, height: 470, top: 0 });
  assert.deepEqual(rules.keyboardFrame(844, 470, 30), { open: true, height: 470, top: 30 });
  assert.deepEqual(rules.keyboardFrame(844, 780, 0), { open: false, height: 844, top: 0 });
  assert.deepEqual(rules.keyboardFrame(844, 844, 0), { open: false, height: 844, top: 0 });
  // Review R6: a pinch zoom also shrinks the visual viewport; it is not a keyboard.
  assert.deepEqual(rules.keyboardFrame(844, 600, 120, 1.4), { open: false, height: 844, top: 0 });
  assert.deepEqual(rules.keyboardFrame(844, 470, 0, 1), { open: true, height: 470, top: 0 });
});

test('pressing sign in before Turnstile has its token waits for it instead of showing an error', () => {
  assert.equal(rules.captchaSubmitStep(false, null), 'submit');
  assert.equal(rules.captchaSubmitStep(true, 'token'), 'submit');
  assert.equal(rules.captchaSubmitStep(true, null), 'wait');
});

test('AuthLayout: card or sheet by width; the keyboard folds the band to 56 px and pins the action above it', () => {
  const layout = read('components/auth/AuthLayout.tsx');
  assert.match(layout, /authLayoutMode\(width\)/);
  assert.match(layout, /useKeyboardFrame\(\)/);
  assert.match(layout, /BAND_FOLDED = 56/);
  // With the keyboard up the action leaves the scroll view, so it sits right above the keyboard.
  assert.match(layout, /keyboard\.open \? \(\s*<View style=\{\[styles\.actionBar/);
  // The page passes its own footer (legal-footer.test.cjs pins `<AuthLegalFooter testID="login.footer" />`); the layout sets the tone.
  assert.match(layout, /cloneElement\(footer, \{ tone: mode === "card" \? "photo" : "plain" \}\)/);
  const web = read('lib/auth/keyboard-frame.web.ts');
  assert.match(web, /visualViewport/);
  assert.match(web, /keyboardFrame\(/);
  const native = read('lib/auth/keyboard-frame.ts');
  assert.match(native, /keyboardWillShow/);
  assert.match(native, /keyboardDidShow/);
});

test('login uses AuthLayout, keeps its test ids, and waits for the Turnstile token', () => {
  const login = read('app/login.tsx');
  assert.match(login, /<AuthLayout\b/);
  assert.match(login, /action=\{/);
  assert.match(login, /footer=\{<AuthLegalFooter testID="login.footer" \/>\}/);
  assert.match(login, /appearance="interaction-only"/);
  assert.match(login, /captchaSubmitStep\(captchaRequired, captchaToken\)/);
  assert.match(login, /t\.webSession\.captchaChecking/);
  assert.match(login, /t\.webSession\.captchaNote/);
});

test('Turnstile can stay hidden until Cloudflare needs the person (web and app)', () => {
  const web = read('components/CaptchaField.web.tsx');
  assert.match(web, /appearance/);
  assert.match(web, /'before-interactive-callback'/);
  assert.match(web, /'after-interactive-callback'/);
  assert.match(web, /onFailed/);
  const native = read('components/CaptchaField.tsx');
  assert.match(native, /appearance/);
  assert.match(native, /before-interactive-callback/);
  assert.match(native, /onFailed/);
});

test('the auth footer has a plain look for the white sheet', () => {
  const footer = read('components/legal/AuthLegalFooter.web.tsx');
  assert.match(footer, /tone = 'photo'/);
  assert.match(footer, /lg-auth-footer--plain/);
  assert.match(read('components/legal/legal.css'), /\.lg-auth-footer--plain\b/);
});

test('the two new texts exist in all four languages', () => {
  for (const lang of ['th', 'en', 'ja', 'zh']) {
    const s = fs.readFileSync(path.join(root, `packages/i18n/src/locales/web-session/${lang}.ts`), 'utf8');
    assert.match(s, /\n  captchaNote: '[^']+',/, `${lang}.captchaNote`);
    assert.match(s, /\n  captchaChecking: '[^']+',/, `${lang}.captchaChecking`);
  }
});
