// Footer plan (nestyk-web-footer-plan.md, Mos 4 Nov 2026): footer helpers, legal copy in 4 languages, and wiring.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const appRoot = path.join(__dirname, '..');
const repoRoot = path.join(appRoot, '..', '..');

function loadTs(file, requireFn = () => { throw new Error(`${file} must stay dependency free`); }) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)(requireFn, mod, mod.exports);
  return mod.exports;
}

const { buildBadge, consentParts, legalHref, lineOaUrl, supportMailto, SUPPORT_EMAIL } = loadTs(path.join(__dirname, 'legal-footer.ts'));
const legalDir = path.join(repoRoot, 'packages/i18n/src/locales/legal');
const th = loadTs(path.join(legalDir, 'th.ts')).legalTh;
const copies = {
  th,
  en: loadTs(path.join(legalDir, 'en.ts'), () => ({})).legalEn,
  ja: loadTs(path.join(legalDir, 'ja.ts'), () => ({})).legalJa,
  zh: loadTs(path.join(legalDir, 'zh.ts'), () => ({})).legalZh,
};
const read = (rel) => fs.readFileSync(path.join(appRoot, rel), 'utf8');

test('build badge shows on every env except production (F-Q2) and never shows odd values', () => {
  assert.deepEqual(buildBadge('staging', '0f99388abcdef', '/agent/leads'), {
    label: 'staging · 0f99388',
    copyText: 'NESTYK staging · 0f99388 · /agent/leads',
  });
  assert.equal(buildBadge('production', 'abc1234'), null);
  assert.equal(buildBadge(' Prod ', 'abc1234'), null);
  assert.equal(buildBadge(undefined, undefined).label, 'dev · local');
  assert.equal(buildBadge('qa', 'not a sha<script>').label, 'qa · local');
  assert.equal(buildBadge('development', 'ABCDEF1234').label, 'development · abcdef1');
});

test('links: document paths, support mail and LINE OA', () => {
  assert.equal(legalHref('privacy'), '/privacy');
  assert.equal(legalHref('terms'), '/terms');
  assert.equal(supportMailto(), `mailto:${SUPPORT_EMAIL}`);
  assert.equal(supportMailto('NESTYK help'), `mailto:${SUPPORT_EMAIL}?subject=NESTYK%20help`);
  assert.equal(lineOaUrl(), 'https://line.me/R/ti/p/%40nestyk');
  assert.equal(lineOaUrl('nestyk'), 'https://line.me/R/ti/p/%40nestyk');
});

test('consent sentence splits into text and two links in any word order', () => {
  const labels = { terms: 'T', privacy: 'P' };
  assert.deepEqual(consentParts('I accept the {terms} and the {privacy}', labels), [
    { kind: 'text', text: 'I accept the ' },
    { kind: 'link', page: 'terms', text: 'T' },
    { kind: 'text', text: ' and the ' },
    { kind: 'link', page: 'privacy', text: 'P' },
  ]);
  assert.deepEqual(consentParts('{privacy}{terms}', labels).map((p) => p.kind), ['link', 'link']);
  assert.deepEqual(consentParts('no {links} here', labels), [{ kind: 'text', text: 'no {links} here' }]);
});

test('legal copy: same keys, same sections and both consent links in all 4 languages', () => {
  const shape = (value) =>
    Array.isArray(value)
      ? value.map((s) => s.id)
      : value && typeof value === 'object'
        ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, shape(value[k])]))
        : typeof value;
  for (const [locale, copy] of Object.entries(copies)) {
    assert.deepEqual(shape(copy), shape(th), locale);
    assert.ok(copy.consent.includes('{terms}') && copy.consent.includes('{privacy}'), `${locale} consent`);
    for (const doc of [copy.privacy, copy.terms]) {
      for (const section of doc.sections) assert.ok(section.title && section.body, `${locale} ${section.id}`);
    }
    assert.ok(copy.page.draftNotice.includes('{email}'), `${locale} draft notice`);
  }
});

test('wiring: routes, auth footers, register links; mobile twins stay as before', () => {
  for (const page of ['privacy', 'terms']) assert.match(read(`app/${page}.tsx`), new RegExp(`<LegalPage page="${page}" />`));
  assert.match(read('app/login.tsx'), /<AuthLegalFooter testID="login.footer" \/>/);
  assert.match(read('app/register.tsx'), /<AuthLegalFooter testID="register.footer" \/>/);
  assert.match(read('app/reset-password.tsx'), /<AuthLegalFooter testID="resetPassword.footer" \/>/);
  assert.match(read('app/register.tsx'), /<ConsentLabel fallback=\{copy\.acceptTerms\}/);
  assert.match(read('app/register.tsx'), /accessibilityLabel=\{copy\.acceptTerms\}/);
  // Mobile (frozen): no footer, plain consent text, document pages go home.
  assert.match(read('components/legal/AuthLegalFooter.tsx'), /return null;/);
  assert.match(read('components/legal/ConsentLabel.tsx'), /<Text style=\{style\}>\{fallback\}<\/Text>/);
  assert.match(read('components/legal/LegalPage.tsx'), /<Redirect href="\/" \/>/);
  assert.match(read('components/agent-web/AgentWorkspaceFooter.tsx'), /return null;/);
  // Web: links to the documents open in a new tab from forms; the page has the draft banner.
  const consent = read('components/legal/ConsentLabel.web.tsx');
  assert.match(consent, /target="_blank"/);
  assert.match(consent, /onClick=\{stop\}/);
  assert.match(read('components/legal/LegalPage.web.tsx'), /data-testid="legal\.draft"/);
  const footer = read('components/agent-web/AgentWorkspaceFooter.web.tsx');
  for (const id of ['shell.footer', 'shell.footer.privacy', 'shell.footer.terms', 'shell.footer.help', 'shell.footer.build']) {
    assert.ok(footer.includes(`"${id}"`), id);
  }
  assert.match(footer, /process\.env\.EXPO_PUBLIC_APP_ENV, process\.env\.EXPO_PUBLIC_BUILD_SHA/);
});
