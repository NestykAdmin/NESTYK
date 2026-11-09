// QA 9 Nov 2026: the "Not proceeding" reason box must stop at the API limit, and a failed status change says "save", not "load".
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const body = read('AgentLeadDetailBody.tsx');
const api = read('../../api/src/agent/leads/agent-leads.service.ts');

const apiLimit = Number(api.match(/function parseLostReason[\s\S]*?value\.trim\(\)\.length > (\d+)/)[1]);
const appLimit = Number(body.match(/const LOST_REASON_MAX = (\d+);/)?.[1]);

test('the lost reason limit in the app matches parseLostReason in the API', () => {
  assert.equal(apiLimit, 500);
  assert.equal(appLimit, apiLimit);
});

test('the lost reason box stops at the limit and shows a typed/limit counter', () => {
  const sheet = body.match(/if \(sheetMode === 'lost'\) \{[\s\S]*?<\/MobileButton>/)[0];
  assert.match(sheet, /<MobileInput[\s\S]*?value=\{lostReason\}[\s\S]*?maxLength=\{LOST_REASON_MAX\}[\s\S]*?\/>/);
  assert.match(sheet, /\{lostReason\.length\}\/\{LOST_REASON_MAX\}/);
});

test('a failed status change is titled as a save error, not a load error', () => {
  const change = body.match(/const changeStatus = [\s\S]*?finally \{/)[0];
  assert.match(change, /catch \(err\) \{\s*Alert\.alert\(c\.saveError,/);
  assert.doesNotMatch(change, /c\.loadError/);
});
