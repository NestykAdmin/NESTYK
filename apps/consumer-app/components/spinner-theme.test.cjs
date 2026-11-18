// Loading spinners follow the theme (Mos, 12 Nov 2026, colour v1.2): ink #211E1E in light mode, brand yellow
// #F8B615 in dark mode, from `theme.spinner`. A fixed yellow spinner was hard to see on white (1.9:1), a fixed ink
// one vanished in dark mode, and a spinner with no colour fell back to the platform grey.
// Exceptions: spinners inside a button (they take the button's text colour), the photo viewer (white on black),
// role-coloured spinners via roleOnDark (already theme-aware) and the contract preview overlay (white paper).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('the theme has a spinner colour: ink in light mode, brand yellow in dark mode', () => {
  const src = read('packages/ui/src/theme/ThemeContext.tsx');
  assert.match(src, /interface MobileThemeColors \{[^}]*\bspinner: string;/);
  assert.match(src, /const LIGHT_THEME[^;]*?\{[^}]*\bspinner: tokens\.colors\.primary,/);
  assert.match(src, /const DARK_THEME[^;]*?\{[^}]*\bspinner: tokens\.colors\.brand\[500\],/);
});

function files(dir) {
  const out = [];
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...files(p));
    else if (/\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}

const ALLOWED = new Map([
  ['packages/ui/src/components/MobileButton.tsx', 'inside a button'],
  ['packages/ui/src/components/MobileAiQuotaAction.tsx', 'inside a button'],
  ['packages/ui/src/components/MobilePhotoViewer.tsx', 'white on the black photo viewer'],
  ['apps/consumer-app/components/ContractDocumentPreview.tsx', 'overlay on the white contract paper'],
  ['apps/consumer-app/components/TenantPaymentsBody.tsx:color', 'colour passed in by the caller'],
  ['apps/consumer-app/components/ContractsScreen.tsx:accentText', 'inside a button'],
]);

test('every other loading spinner uses theme.spinner or a role colour through roleOnDark', () => {
  const bad = [];
  for (const f of [...files('apps/consumer-app/components'), ...files('apps/consumer-app/app'), ...files('packages/ui/src')]) {
    const src = read(f);
    for (const m of src.matchAll(/<ActivityIndicator\b([\s\S]*?)\/?>/g)) {
      const attrs = m[1];
      const color = (attrs.match(/color=\{([^}]*)\}/) || attrs.match(/color="([^"]*)"/) || [])[1] || '(none)';
      if (color === 'theme.spinner' || color.startsWith('roleOnDark(')) continue;
      if (ALLOWED.has(f) || ALLOWED.has(`${f}:${color}`)) continue;
      bad.push(`${f}:${src.slice(0, m.index).split('\n').length} color=${color}`);
    }
  }
  assert.deepEqual(bad, []);
});
