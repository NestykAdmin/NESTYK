// First open of the guest web was slow (Mos 27 Nov 2026): one colour helper pulled the whole @nestyk/ui package into
// every guest page, app components and phosphor-react (1.1 MB in dev) with it. Guest code takes narrow entry points.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const webRoot = path.join(__dirname, '..');
const files = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return files(full);
    return /\.(tsx?|jsx?)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
  });

test('guest pages and components never import the whole @nestyk/ui package', () => {
  const guest = [
    ...files(path.join(webRoot, 'app', 'components', 'guest')),
    ...files(path.join(webRoot, 'app', '[locale]')),
    ...files(path.join(webRoot, 'lib')),
  ];
  // HomeMock.tsx is an old mock no page imports (not a route), so it is never in a bundle.
  const unused = new Set([path.join(webRoot, 'app/[locale]/(marketplace)/HomeMock.tsx')]);
  const offenders = guest.filter((file) => !unused.has(file) && /from '@nestyk\/ui'/.test(fs.readFileSync(file, 'utf8')));
  assert.deepEqual(offenders.map((file) => path.relative(webRoot, file)), []);
});

test('the role colours come from the tokens entry point, which imports nothing', () => {
  assert.match(fs.readFileSync(path.join(webRoot, 'app/components/guest/GuestRole.tsx'), 'utf8'), /import \{ roleTileColors \} from '@nestyk\/ui\/tokens';/);
  const pkg = JSON.parse(fs.readFileSync(path.join(webRoot, '../../packages/ui/package.json'), 'utf8'));
  assert.deepEqual(pkg.exports['./tokens'], { types: './src/theme/tokens.ts', default: './src/theme/tokens.ts' });
  assert.doesNotMatch(fs.readFileSync(path.join(webRoot, '../../packages/ui/src/theme/tokens.ts'), 'utf8'), /^import /m);
});
