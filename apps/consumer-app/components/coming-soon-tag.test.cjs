// "Coming soon" in the app (Mos, 12 Nov 2026, design B "soft fill"): a quiet tag that follows the theme,
// regular 11px muted text, the same height in th/en/ja/zh and a capped width, instead of the bold light-grey pill.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ui = path.join(__dirname, '../../../packages/ui/src');
const read = (p) => fs.readFileSync(p, 'utf8');

test('MobileComingSoonTag follows the theme: soft fill per mode, muted text, regular 11px, one line, capped width', () => {
  const code = read(path.join(ui, 'components/MobileComingSoonTag.tsx'));
  assert.match(code, /useMobileTheme\(\)/);
  assert.match(code, /backgroundColor: isDark \? [^:]+ : '#F1F5F9'/);
  // Muted text that still reads at 11px: textSecondary on dark (4.6:1), slate 600 #475569 on the light fill (6.9:1).
  assert.match(code, /color: isDark \? theme\.textSecondary : '#475569'/);
  assert.match(code, /fontSize: 11/);
  assert.match(code, /lineHeight: 16/);
  assert.match(code, /numberOfLines=\{1\}/);
  assert.match(code, /maxWidth: \d+/);
  assert.doesNotMatch(code, /fontWeight: '(6|7|8|9)00'|fontWeight: 'bold'/);
  assert.match(read(path.join(ui, 'native.ts')), /export \* from '\.\/components\/MobileComingSoonTag'/);
});

test('the drawer and More tools use the tag, not the slate status pill, for "Coming soon"', () => {
  const files = [path.join(ui, 'shells/MobileProfileDrawer.tsx'), path.join(__dirname, 'AgentMoreToolsBody.tsx')];
  for (const f of files) {
    const code = read(f);
    assert.doesNotMatch(code, /<MobileStatusPill label=\{[^}]*comingSoon\}/, path.basename(f));
    assert.match(code, /<MobileComingSoonTag label=\{[^}]*comingSoon\} \/>/, path.basename(f));
  }
});
