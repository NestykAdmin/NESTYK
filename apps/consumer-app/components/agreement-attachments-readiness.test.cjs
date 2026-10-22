// B3 (Aof, 21 Oct 2026): the attachments card tells the contract screen which attachments the agent rejected,
// so the signing card can warn whoever signs. This drives the real component's hooks without a renderer.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { i18nMock, contractsTh, fillTemplate } = require('./test-i18n.cjs');
function load(file, requireFn = require) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText)(requireFn, module, module.exports);
  return module.exports;
}
const thai = load('../../../packages/i18n/src/locales/th.ts', id => id === './contracts/th' ? { contractsTh } : { AMENITIES_FACILITY_GROUP_LABELS: { th: {} }, AMENITIES_FACILITY_LABELS: { th: {} } });
const review = load('../lib/attachment-review.ts', id => { if (id === '@nestyk/i18n') return { fillTemplate }; throw new Error(id); });

function harness(lists) {
  const states = [], refs = [], memos = [], effectDeps = [], effects = [], readiness = [], asked = [];
  let stateIndex = 0, refIndex = 0, memoIndex = 0, effectIndex = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const hooked = { ...React,
    useState: initial => { const i = stateIndex++; if (!(i in states)) states[i] = initial; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; },
    useRef: initial => refs[refIndex++] ??= { current: initial },
    useMemo: (fn, deps) => { const i = memoIndex++; if (!memos[i] || !same(memos[i].deps, deps)) memos[i] = { deps, value: fn() }; return memos[i].value; },
    useEffect: (fn, deps) => { const i = effectIndex++; if (!same(effectDeps[i], deps)) { effectDeps[i] = deps; effects.push(fn); } },
  };
  const deps = {
    react: hooked,
    'react-native': { ActivityIndicator: 'progress', Modal: 'aside', Pressable: 'button', ScrollView: 'section', StyleSheet: { create: s => s }, Text: 'span', View: 'section' },
    'react-native-svg': { __esModule: true, default: 'svg', Path: 'path' },
    'expo-document-picker': {},
    '@nestyk/ui/native': { MobileBottomSheet: 'aside', MobileButton: 'button', MobileInput: 'input', tokens: { colors: { brand: { 500: '#ff0' }, roles: { agent: '#ff0' } }, typography: { native: {} } }, useMobileTheme: () => ({ theme: {} }) },
    '../lib/agent-contracts-api': { listAgreementAttachments: async id => { asked.push(id); return lists.shift(); } },
    '../lib/attachment-review': review,
    '@nestyk/i18n': i18nMock({ agent: thai.th.agent, common: thai.th.common }),
    './ContractDocumentPreview': { ContractDocumentPreview: 'preview' },
  };
  const { AgreementAttachments } = load('AgreementAttachments.tsx', id => { if (!(id in deps)) throw new Error(`Unexpected dependency: ${id}`); return deps[id]; });
  const onReadinessChange = value => readiness.push(value);
  const render = async (props = {}) => {
    stateIndex = refIndex = memoIndex = effectIndex = 0;
    AgreementAttachments({ contractId: 5, formKind: 'lease', refreshKey: 'a', onReadinessChange, ...props });
    effects.splice(0).forEach(fn => fn());
    await new Promise(resolve => setImmediate(resolve));
  };
  return { render, readiness, asked };
}
const checklist = (documents) => ({ editable: true, readyToSign: true, requirements: [], reusableDocuments: [],
  documentTypes: [{ code: 'national_id', nameTh: 'สำเนาบัตรประชาชน' }], documents });
const file = (patch) => ({ id: 1, agreementId: 5, documentTypeCode: 'national_id', subject: 'tenant', fileName: 'id.jpg', mimeType: 'image/jpeg', byteSize: 1,
  createdAt: '2026-10-21T00:00:00Z', reviewStatus: 'pending', reviewNote: null, reviewedAt: null, supersedesDocumentId: null, sourceDocumentId: null, isCurrent: true, ...patch });

test('the rejected attachments go up with readiness, and follow a reload after the agent rejects or the file is replaced', async () => {
  const h = harness([
    checklist([file({})]),
    checklist([file({ reviewStatus: 'rejected', reviewNote: 'ภาพไม่ชัด' })]),
    checklist([file({ isCurrent: false, reviewStatus: 'rejected', reviewNote: 'ภาพไม่ชัด' }), file({ id: 2, supersedesDocumentId: 1 })]),
  ]);
  await h.render();
  await h.render();
  assert.deepEqual(h.asked, [5]);
  assert.deepEqual(h.readiness.at(-1), { contractId: 5, ready: true, rejected: [] });
  // The agent rejects the file: the list reloads (refreshKey) and the contract screen gets the rejected file.
  await h.render({ refreshKey: 'b' });
  await h.render({ refreshKey: 'b' });
  assert.deepEqual(h.readiness.at(-1), { contractId: 5, ready: true, rejected: [{ name: 'สำเนาบัตรประชาชน', note: 'ภาพไม่ชัด' }] });
  // Rendering again without a change sends nothing new.
  const sent = h.readiness.length;
  await h.render({ refreshKey: 'b' });
  assert.equal(h.readiness.length, sent);
  // The tenant replaced it: the old version no longer counts.
  await h.render({ refreshKey: 'c' });
  await h.render({ refreshKey: 'c' });
  assert.deepEqual(h.readiness.at(-1).rejected, []);
});
