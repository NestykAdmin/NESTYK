// W4 (Mos 13–17 Nov 2026): agent web "create tenant" as a full page wizard (layout ก): steps rail on the left,
// click a lead → rooms, click a room → "Confirm booking" step on the page (not a sheet), then a "Booked" dialog.
// Same API, rules and words as the app's TenantForm + ReserveRoomSheet; the app files stay as they are.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const page = () => read('agent-web/AgentTenantCreatePage.web.tsx');

test('native and phone keep TenantForm; wide web uses the new page', () => {
  const native = read('agent-web/AgentTenantCreatePage.tsx');
  assert.match(native, /return \(\s*<TenantForm\s/);
  const screen = read('AgentTenantsScreen.tsx');
  assert.match(screen, /if \(creating\) \{[\s\S]*?return webTables \? \(\s*<AgentTenantCreatePage/);
  assert.match(screen, /<TenantForm\s/);
});

test('the page uses the same API, profile rules and offer section as the app sheet', () => {
  const p = page();
  for (const name of ['tenantLeadOptions', 'tenantRoomOptions', 'createAgentTenant', 'tenantProfileFromLead', 'tenantProfileIssues', 'tenantProfileBody', 'nextIdentityNumberDraft', 'DealOfferSection']) {
    assert.match(p, new RegExp(`\\b${name}\\b`), name);
  }
  // same refusal message as the sheet when the landlord has not confirmed the offer
  assert.match(p, /code === "OFFER_NOT_CONFIRMED" \? t\.contracts\.offer\.needConfirmed : localizedError\(/);
  const sheet = read('ReserveRoomSheet.tsx');
  assert.match(sheet, /code === 'OFFER_NOT_CONFIRMED' \? t\.contracts\.offer\.needConfirmed : localizedError\(/);
  // booking waits for the offer and a free room
  assert.match(p, /disabled=\{busy \|\| !!takenBy \|\| !offerConfirmed\}/);
});

test('like the app: clicking a lead opens the rooms, clicking a room opens the confirm step; no "Next" button', () => {
  const p = page();
  assert.match(p, /function pickLead\([^)]*\) \{[\s\S]*?setStep\(2\);/);
  assert.match(p, /function pickRoom\([^)]*\) \{\s*if \(next\.bookedBy\) return;[\s\S]*?setStep\(3\);/);
  assert.match(p, /<button[^>]*className=\{`awtc-pick[^`]*`\}[^>]*onClick=\{\(\) => pickLead\(/);
  assert.match(p, /disabled=\{!!r\.bookedBy\}/);
  assert.doesNotMatch(p, /c\.next\b/);
});

test('steps rail: "step x of 3", picked values with "change", step 3 named like the app sheet', () => {
  const p = page();
  assert.match(p, /web\.stepOf\.replace\("\{step\}", String\(step\)\)/);
  assert.match(p, /role="progressbar"/);
  assert.match(p, /c\.stepLead/);
  assert.match(p, /c\.stepRoom/);
  assert.match(p, /c\.reserveTitle/);
  assert.match(p, /web\.change/);
});

test('booked dialog: next step follows email + ID like the app; reservation opens the letter', () => {
  const p = page();
  assert.match(p, /booked\.email && booked\.identityNumber \? c\.continueToLetter : c\.openTenant/);
  assert.match(p, /onDone\(booked, booked\.email && booked\.identityNumber \? "reservation" : "tenant"\)/);
  assert.match(p, /onDone\(booked, "list"\)/);
  const screen = read('AgentTenantsScreen.tsx');
  assert.match(screen, /if \(next === "reservation"\) \{\s*setSection\("contracts"\);\s*setContractStart\("reservation"\);/);
});

test('shell: the create-tenant page folds the main menu to icons; the user can still open it', () => {
  const shell = read('agent-web/AgentWorkspace.web.tsx');
  assert.match(shell, /const formCompact = props\.creating === "tenant";/);
  assert.match(shell, /const isCollapsed = formCompact \? !formMenuOpen : collapsed;/);
  assert.match(shell, /onClick=\{\(\) => \(formCompact \? setFormMenuOpen\(!formMenuOpen\) : setCollapsed\(!collapsed\)\)\}/);
  const nav = read('agent-web/navigation.ts');
  assert.match(nav, /if \(creating === "tenant"\) return "wide";/);
});

const WEB_KEYS = ['stepsLabel', 'stepOf', 'change', 'leadSub', 'roomSub', 'confirmSub', 'pickLeadHint', 'pickRoomHint', 'docTitle', 'docHint', 'customerTitle', 'customerHint', 'editCustomer', 'hideCustomer'];
test('new words exist in all four languages and in the types', () => {
  for (const lang of ['en', 'th', 'ja', 'zh']) {
    const s = fs.readFileSync(path.join(root, `packages/i18n/src/locales/${lang}.ts`), 'utf8');
    const block = s.slice(s.indexOf('\n      webCreate: {'), s.indexOf('\n      },', s.indexOf('\n      webCreate: {')));
    assert.ok(block.length > 20, `${lang}: agent.tenants.webCreate`);
    for (const key of WEB_KEYS) assert.match(block, new RegExp(`\\n        ${key}: '[^']+',`), `${lang}.${key}`);
  }
  const types = fs.readFileSync(path.join(root, 'packages/i18n/src/types.ts'), 'utf8');
  const block = types.slice(types.indexOf('\n      webCreate: {'));
  for (const key of WEB_KEYS) assert.match(block, new RegExp(`\\n        ${key}: string;`), `types.${key}`);
});

test('review R1: the list and the shell hear about the new tenant as soon as it is created, before the dialog closes', () => {
  const s = page();
  // Same moment as the app sheet's onReserved: right after the POST, before the dialog.
  assert.match(s, /await createAgentTenant\([\s\S]*?\);\s*(?:\/\/[^\n]*\n\s*)*onCreated\(tenant\);\s*setBooked\(tenant\);/);
  // Back while the dialog is open acts as "Later" and never steps the wizard back.
  assert.match(s, /backRef\.current = \(\) => \{[\s\S]*?if \(booked\) \{\s*onDone\(booked, "list"\);\s*return true;\s*\}\s*if \(step <= 1\) return false;/);
  const screen = read('AgentTenantsScreen.tsx');
  assert.match(screen, /onCreated=\{addCreated\}/);
  assert.match(screen, /const addCreated = \(tenant: AgentTenant\) => \{[\s\S]*?onTenantCreated\?\.\(tenant\);\s*\};/);
  // The phone form still adds the tenant and opens it in one go.
  assert.match(screen, /<TenantForm[\s\S]*?onCreated=\{\(tenant\) => \{\s*addCreated\(tenant\);\s*finishCreate\(tenant, true\);/);
});

test('review R2/R3/R5: dialog keyboard, booking notice and field help', () => {
  const s = page();
  assert.match(s, /event\.key === "Escape"[\s\S]*?onDone\(booked, "list"\)/);
  assert.match(s, /className="awtc-layout" inert=\{!!booked\}/);
  assert.match(s, /aria-describedby="awtc-booked-body"/);
  assert.match(s, /!takenBy \? \(\s*<p className="awtc-notice" data-testid="reserve\.info">\s*\{c\.reserveInfo\}/);
  assert.match(s, /setFocusBad\(\(n\) => n \+ 1\);\s*return;/);
  assert.match(s, /aria-valuetext=\{/);
  assert.match(s, /aria-describedby=\{`\$\{uid\}-email-help`\}/);
  assert.doesNotMatch(s, /<label className="awtc-field/);
});
