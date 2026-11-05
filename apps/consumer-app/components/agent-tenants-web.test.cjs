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

// W5 (Mos 5 Nov 2026): tenant page side menu on the desktop web; same sections and state as the hub.
test('the tenant page frame adds nothing on native and on phone-width web', () => {
  assert.match(read('agent-web/TenantDetailFrame.tsx'), /return <>\{children\}<\/>;/);
  const web = read('agent-web/TenantDetailFrame.web.tsx');
  assert.match(web, /if \(!web\) return <>\{children\}<\/>;/);
  assert.match(screen, /<TenantDetailFrame\s+web=\{webTables\}/);
});

test('the side menu lists the hub sections and changes section the same way as the hub', () => {
  const web = read('agent-web/TenantDetailFrame.web.tsx');
  for (const key of ['profile', 'room', 'contracts', 'bills', 'payments', 'attachments']) {
    assert.match(web, new RegExp(`key: "${key}"`), key);
  }
  assert.match(web, /\{ key: null, icon: "grid", label: d\.webOverview \}/);
  assert.match(web, /disabled=\{disabled && !current\}/);
  assert.match(screen, /disabled=\{editing \|\| savingEdit\}/);
  assert.match(screen, /onSection=\{\(next\) => \{[\s\S]{0,200}setContractStart\(null\);[\s\S]{0,200}setSection\(next\);/);
});
