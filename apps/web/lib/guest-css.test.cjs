const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);

const { tokens } = require('../../../packages/ui/src/theme/tokens.ts');
const CSS_FILE = path.join(__dirname, '../app/[locale]/guest.css');
const COMPONENTS_DIR = path.join(__dirname, '../app/components/guest');

function readCss() {
  return fs.readFileSync(CSS_FILE, 'utf8');
}

/** `--name: value;` pairs declared in the :root block. */
function rootVariables(css) {
  const root = css.match(/:root\s*\{([^}]*)\}/);
  assert.ok(root, 'guest.css has no :root block');
  return Object.fromEntries([...root[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

// S2.1: guest colours come from packages/ui tokens, so the guest web and the app stay one brand.
const FROM_TOKENS = {
  '--nk-color-ink': tokens.colors.primary,
  '--nk-color-brand': tokens.colors.brand[500],
  '--nk-color-brand-soft': tokens.colors.brand[100],
  '--nk-color-bg': tokens.colors.background,
  '--nk-color-surface': tokens.colors.white,
  '--nk-color-border': tokens.colors.border,
  '--nk-color-divider': tokens.colors.divider,
  '--nk-color-heading': tokens.colors.textHeading,
  '--nk-color-text-disabled': tokens.colors.textSecondary,
  '--nk-color-placeholder': tokens.colors.placeholder,
  '--nk-color-neutral-bg': tokens.colors.subtle.neutralBg,
  '--nk-color-track': tokens.colors.subtle.track,
  '--nk-color-focus': tokens.colors.accent,
  '--nk-color-danger': tokens.colors.danger,
};

test('guest colours are the same values as packages/ui tokens', () => {
  const vars = rootVariables(readCss());
  for (const [name, value] of Object.entries(FROM_TOKENS)) {
    assert.ok(vars[name], `${name} is missing`);
    assert.equal(vars[name].toLowerCase(), value.toLowerCase(), `${name} differs from tokens`);
  }
});

test('the type scale has exactly the 8 sizes of the design (12 13 15 17 20 24 32 48)', () => {
  const vars = rootVariables(readCss());
  const sizes = Object.entries(vars).filter(([name]) => name.startsWith('--nk-text-'));
  assert.deepEqual(
    sizes.map(([, value]) => value).sort((a, b) => parseFloat(a) - parseFloat(b)),
    ['12px', '13px', '15px', '17px', '20px', '24px', '32px', '48px'],
  );
});

test('radius and spacing scales are declared', () => {
  const vars = rootVariables(readCss());
  for (const [name, value] of [['--nk-radius-sm', '8px'], ['--nk-radius-md', '12px'], ['--nk-radius-lg', '16px'], ['--nk-radius-pill', '999px']]) {
    assert.equal(vars[name], value, name);
  }
  for (const step of [1, 2, 3, 4, 6, 8]) assert.equal(vars[`--nk-space-${step}`], `${step * 4}px`, `--nk-space-${step}`);
});

test('the mobile layout switches at 960px, where the header gives way to the tab bar', () => {
  assert.match(readCss(), /@media \(max-width: 960px\)/);
});

test('guest components take colours and font sizes from guest.css, not from inline values', () => {
  if (!fs.existsSync(COMPONENTS_DIR)) return;
  for (const file of fs.readdirSync(COMPONENTS_DIR).filter((name) => name.endsWith('.tsx'))) {
    const source = fs.readFileSync(path.join(COMPONENTS_DIR, file), 'utf8');
    assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b/, `${file} has a hex colour`);
    assert.doesNotMatch(source, /fontSize\s*:/, `${file} sets a font size inline`);
  }
});
