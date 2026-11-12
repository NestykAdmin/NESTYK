// Colour system v1.1: the role colours are deep tones, so text and icons in a role colour need a light
// counterpart in dark mode. roleOnDark() maps a role colour to it; solid role fills keep the deep tone.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const src = fs.readFileSync(path.join(__dirname, '../../../packages/ui/src/theme/tokens.ts'), 'utf8');
const loaded = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText)(require, loaded, loaded.exports);
const { tokens, roleOnDark } = loaded.exports;

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

test('every role has a dark-mode colour that reads on the dark background and surface (4.5:1)', () => {
  assert.deepEqual(Object.keys(tokens.colors.rolesOnDark).sort(), Object.keys(tokens.colors.roles).sort());
  for (const [role, hex] of Object.entries(tokens.colors.rolesOnDark)) {
    for (const bg of ['#211e1e', '#2f2b2b']) {
      assert.ok(contrast(hex, bg) >= 4.5, `${role} ${hex} on ${bg} = ${contrast(hex, bg).toFixed(2)}`);
    }
  }
});

test('the agent reads as brand yellow on dark (ink + yellow pair)', () => {
  assert.equal(tokens.colors.rolesOnDark.agent, tokens.colors.brand[500]);
});

test('roleOnDark maps a role colour only in dark mode and leaves other colours alone', () => {
  const { roles, rolesOnDark } = tokens.colors;
  for (const role of Object.keys(roles)) {
    assert.equal(roleOnDark(roles[role], true), rolesOnDark[role]);
    assert.equal(roleOnDark(roles[role], false), roles[role]);
    assert.equal(roleOnDark(roles[role].toUpperCase(), true), rolesOnDark[role]);
  }
  assert.equal(roleOnDark('#123456', true), '#123456');
  assert.equal(roleOnDark(tokens.colors.brand[500], true), tokens.colors.brand[500]);
});

test('no screen paints text, icons or spinners straight from a role colour (dark mode would hide them)', () => {
  const dirs = [__dirname, path.join(__dirname, '../../../packages/ui/src')];
  const offenders = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith('.tsx')) {
        fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
          if (/\b(color|tintColor)\s*[:=]\s*\{?\s*tokens\.colors\.roles\.[a-z_]+\s*\}?\s*[,}/>]?\s*$/.test(line)
            || /\b(color|tintColor)=\{tokens\.colors\.roles\.[a-z_]+\}/.test(line)) offenders.push(`${path.relative(dirs[1], p)}:${i + 1}`);
        });
      }
    }
  };
  dirs.forEach(walk);
  assert.deepEqual(offenders, []);
});

test('on/off switches in settings and the drawer are ink when on (yellow in dark mode), not the tenant green', () => {
  for (const file of ['shells/MobileAccountSettingsBody.tsx', 'shells/MobileProfileDrawer.tsx']) {
    const code = fs.readFileSync(path.join(__dirname, '../../../packages/ui/src', file), 'utf8');
    const tracks = code.match(/trackColor=\{\{[^}]*\}\}/g) || [];
    assert.ok(tracks.length > 0, file);
    for (const track of tracks) assert.match(track, /true: switchOn\b/, `${file}: ${track}`);
    assert.match(code, /const switchOn = isDark \? tokens\.colors\.brand\[500\] : tokens\.colors\.primary;/);
  }
});

test('role colours passed through variables (roleColor, roleAccent, agentColor, ...) also go through roleOnDark for text, icons and borders', () => {
  const roots = [__dirname, path.join(__dirname, '../../../packages/ui/src')];
  const vars = /\b(roleColor|roleAccent|agentColor|optionColor|agent)\b/;
  const offenders = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!p.endsWith('.tsx')) continue;
      const code = fs.readFileSync(p, 'utf8');
      // AppBadge is the DOM badge for the Next.js web, which has no dark mode.
      if (!/colors\.roles/.test(code) || e.name === 'AppBadge.tsx') continue;
      code.split('\n').forEach((line, i) => {
        const m = line.match(/\b(color|tintColor|borderColor)\s*[:=]\s*\{?([^,}]*)/);
        if (/android_ripple/.test(line)) return; // a translucent press overlay, not text
        if (m && vars.test(m[2]) && !/roleOnDark/.test(m[2])) offenders.push(`${path.basename(p)}:${i + 1}`);
      });
    }
  };
  roots.forEach(walk);
  assert.deepEqual(offenders, []);
});

test('the workspace header shows the white wordmark in dark mode', () => {
  const code = fs.readFileSync(path.join(__dirname, '../../../packages/ui/src/components/MobileWorkspaceHeader.tsx'), 'utf8');
  assert.match(code, /variant=\{isDark \? 'wordmarkOnDark' : 'wordmark'\}/);
});

test('switches keep a white thumb when on in the browser (react-native-web defaults it to teal)', () => {
  for (const file of ['shells/MobileAccountSettingsBody.tsx', 'shells/MobileProfileDrawer.tsx']) {
    const code = fs.readFileSync(path.join(__dirname, '../../../packages/ui/src', file), 'utf8');
    const switches = code.match(/<Switch[\s\S]*?\/>/g) || [];
    assert.ok(switches.length > 0, file);
    for (const sw of switches) assert.match(sw, /activeThumbColor/, `${file}: ${sw.slice(0, 80)}`);
  }
});
