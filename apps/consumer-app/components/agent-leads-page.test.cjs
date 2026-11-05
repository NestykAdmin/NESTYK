// W2 (Mos 5 Nov 2026): agent web leads table. Same API, filters and lead detail as the app; the phone keeps its screen.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const web = read('agent-web/AgentLeadsPage.web.tsx');
const native = read('agent-web/AgentLeadsPage.tsx');
const index = fs.readFileSync(path.join(__dirname, '../app/index.tsx'), 'utf8');

test('desktop web shows the table; phone and phone-width web keep AgentLeadsScreen', () => {
  assert.match(index, /if \(activeTab === 'listingLead'\) \{[\s\S]{0,200}if \(isAgentWeb\) \{[\s\S]{0,120}<AgentLeadsPage/);
  assert.match(index, /<AgentLeadsScreen\s+workFilter=\{leadsWorkFilter\}/);
  assert.match(native, /<AgentLeadsScreen[\s\S]*onOpenLead=\{onOpenLead\}/);
});

test('the table loads through the app API with the same filters and opens the same lead page', () => {
  assert.match(web, /listAgentLeads\(search, page, \{[\s\S]*province: location\.province,[\s\S]*status: status \?\? undefined,/);
  assert.match(web, /onRowPress=\{\(lead\) => onOpenLead\(lead\)\}/);
  assert.match(web, /<LeadStatusBadge status=\{shown\} \/>\s*<LeadNewBadge lead=\{lead\} \/>/);
  for (const s of ['updated_desc', 'created_desc', 'created_asc', 'name_asc', 'budget_asc', 'budget_desc', 'status_asc', 'status_desc']) {
    assert.match(web, new RegExp(`value: "${s}"`), s);
  }
  assert.match(web, /const STATUS_CHIPS: Array<LeadDisplayStatus \| null> = \[null, "new", "inprogress", "viewing", "booked", "lost"\];/);
});

test('table words exist in all four languages', () => {
  for (const lang of ['en', 'th', 'zh', 'ja']) {
    const s = fs.readFileSync(path.join(root, `packages/i18n/src/locales/${lang}.ts`), 'utf8');
    for (const key of ['tableLabel', 'colLead', 'colArea', 'colBudget', 'colStatus', 'colMatch', 'colUpdated', 'emptyTitle', 'emptyBody']) {
      assert.match(s, new RegExp(`\\n        ${key}: '[^']+',`), `${lang}.${key}`);
    }
  }
});

// W6 (Mos 5 Nov 2026): lead page in two columns on the desktop web; the same cards in the same order.
test('the lead page wrappers add nothing on native and phone-width web', () => {
  const native = read('agent-web/LeadDetailColumns.tsx');
  assert.equal((native.match(/return <>\{children\}<\/>;/g) || []).length, 2);
  const web = read('agent-web/LeadDetailColumns.web.tsx');
  assert.equal((web.match(/if \(!web\) return <>\{children\}<\/>;/g) || []).length, 2);
});

test('the lead card, full-info link and viewings sit left; matched rooms right; the sheet stays outside', () => {
  const body = read('AgentLeadDetailBody.tsx');
  assert.match(body, /const webColumns = Platform\.OS === 'web' && windowWidth >= 768;/);
  assert.match(
    body,
    /<LeadDetailColumns web=\{webColumns\}>\s*<LeadDetailColumn web=\{webColumns\} side="main">[\s\S]*?<LeadViewingsSection[\s\S]*?<\/LeadDetailColumn>\s*<LeadDetailColumn web=\{webColumns\} side="rooms">[\s\S]*?<\/LeadDetailColumn>\s*<\/LeadDetailColumns>\s*<MobileBottomSheet\s+visible=\{sheetOpen\}/,
  );
});

test('suggested rooms start open on the desktop web and folded on the phone (unchanged there)', () => {
  const body = read('AgentLeadDetailBody.tsx');
  assert.match(body, /const \[suggestionsOpen, setSuggestionsOpen\] = useState\(webColumns\);/);
  assert.match(body, /useEffect\(\(\) => setSuggestionsOpen\(webColumns\), \[lead\.id, webColumns\]\);/);
});
