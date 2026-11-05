// W3 (Mos 5 Nov 2026): agent web tenants lists as tables. Same data, filters, pills and actions as the app bodies.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const screen = read('AgentTenantsScreen.tsx');
const work = read('agent-web/TenantWorkTable.web.tsx');
const all = read('agent-web/TenantDirectoryTable.web.tsx');

test('only the desktop web shell (768px+) swaps in the tables; the phone keeps the app bodies', () => {
  assert.match(screen, /const webTables = Platform\.OS === "web" && windowWidth >= 768;/);
  assert.match(screen, /const WorkList = webTables \? TenantWorkTable : TenantWorkBody;/);
  assert.match(screen, /const DirectoryList = webTables \? TenantDirectoryTable : TenantDirectoryBody;/);
  assert.match(screen, /<View style=\{\[s\.root, webTables && s\.rootWide\]\}>/);
  assert.match(read('agent-web/TenantWorkTable.tsx'), /<TenantWorkBody \{\.\.\.props\} \/>/);
  assert.match(read('agent-web/TenantDirectoryTable.tsx'), /<TenantDirectoryBody \{\.\.\.props\} \/>/);
});

test('the tables use the same rules as the app: work items, counts, directory filter, grouping and status', () => {
  assert.match(work, /workCounts\(items\)/);
  assert.match(work, /onAction\(item\)/);
  assert.match(work, /onRowPress=\{busy \? undefined : \(item\) => onOpenTenant\(item\)\}/);
  assert.match(all, /groupByProperty\(visible, locale\)/);
  assert.match(all, /tenantListStatus\(tenant, items\)/);
  assert.match(all, /onRowPress=\{busy \? undefined : \(tenant\) => onOpen\(tenant\)\}/);
});

test('table words exist in all four languages', () => {
  for (const lang of ['en', 'th', 'zh', 'ja']) {
    const s = fs.readFileSync(path.join(root, `packages/i18n/src/locales/${lang}.ts`), 'utf8');
    for (const key of ['colWork', 'colTenant', 'colRoom', 'colDetail', 'colUnit', 'colRent', 'colStatus', 'tableWork', 'tableAll']) {
      assert.match(s, new RegExp(`\\n          ${key}: '[^']+',`), `${lang}.${key}`);
    }
  }
});
