const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// F7: Metro does not tree-shake, so a value import from the package root pulls every
// phosphor-react-native icon (all 1,512 × 6 weights) into the web bundle. Icons are imported
// one file each from the package's `src/icons/<Name>.tsx`; type-only root imports are erased.
// packages/ui resolves its own 2.x copy (default exports), consumer-app the root 3.x (named exports).
const repo = path.resolve(__dirname, '../../..');
// The copy Node/Metro resolve from `file`: the nearest node_modules/phosphor-react-native above it.
const iconsDirFor = file => {
  for (let dir = path.dirname(file); dir.startsWith(repo); dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules/phosphor-react-native/src/icons');
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`phosphor-react-native not found from ${file}`);
};
const roots = ['apps/consumer-app/app', 'apps/consumer-app/components', 'apps/consumer-app/lib', 'packages'];
const sources = [];
const walk = dir => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.tsx?$/.test(entry.name)) sources.push(full);
  }
};
roots.forEach(root => walk(path.join(repo, root)));
const imports = file => [...fs.readFileSync(file, 'utf8').matchAll(/import\s+(type\s+)?(?:(\w+)|\{([^}]*)\})\s*from\s*['"](phosphor-react-native[^'"]*)['"]/g)]
  .map(([, typeOnly, defaultName, names, from]) => ({ typeOnly: Boolean(typeOnly), defaultName, names: (names ?? '').split(',').map(n => n.trim()).filter(Boolean), from }));

test('F7: no value import from the phosphor-react-native package root', () => {
  const offenders = sources.flatMap(file => imports(file)
    .filter(i => i.from === 'phosphor-react-native' && !i.typeOnly && (i.defaultName || i.names.some(n => !n.startsWith('type '))))
    .map(() => path.relative(repo, file)));
  assert.deepEqual(offenders, []);
});

test('F7: every deep icon import names a real icon file that exports it', () => {
  const deep = sources.flatMap(file => imports(file).filter(i => i.from.startsWith('phosphor-react-native/')).map(i => ({ ...i, file })));
  assert.ok(deep.length > 0, 'expected deep icon imports');
  for (const { from, names, defaultName, file } of deep) {
    const where = path.relative(repo, file);
    const match = from.match(/^phosphor-react-native\/src\/icons\/([A-Za-z0-9]+)$/);
    assert.ok(match, `${where}: ${from} is not phosphor-react-native/src/icons/<Name>`);
    const name = match[1];
    const icon = path.join(iconsDirFor(file), `${name}.tsx`);
    assert.ok(fs.existsSync(icon), `${where}: ${icon} does not exist`);
    const source = fs.readFileSync(icon, 'utf8');
    if (defaultName) {
      assert.equal(defaultName, name, `${where}: import ${name} from ${from}`);
      assert.match(source, new RegExp(`export default ${name}\\b`), `${where}: ${from} has no default export`);
    } else {
      assert.deepEqual(names, [name], `${where}: import exactly { ${name} } from ${from}`);
      assert.match(source, new RegExp(`export const ${name} = I\\b`), `${where}: ${from} does not export ${name}`);
    }
  }
});
