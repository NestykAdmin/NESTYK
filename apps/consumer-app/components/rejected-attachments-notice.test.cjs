// B3 (Aof, 21 Oct 2026): whoever signs is told which attached documents the agent rejected; signing is not blocked.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { i18nMock, fillTemplate } = require('./test-i18n.cjs');
function load(file, requireFn) {
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText)(requireFn, loaded, loaded.exports);
  return loaded.exports;
}
const { rejectedAttachments } = load('../lib/attachment-review.ts', (name) => {
  if (name === '@nestyk/i18n') return { fillTemplate };
  throw new Error(`Unexpected dependency: ${name}`);
});
const { RejectedAttachmentsNotice } = load('RejectedAttachmentsNotice.tsx', (name) => {
  if (name === 'react') return React;
  if (name === 'react-native') return { View: 'section', Text: 'span' };
  if (name === '@nestyk/ui/native') return { tokens: { typography: { native: {} } } };
  if (name === '@nestyk/i18n') return i18nMock();
  throw new Error(`Unexpected dependency: ${name}`);
});
const doc = (patch) => ({ id: 1, documentTypeCode: 'national_id', fileName: 'id.jpg', isCurrent: true, reviewStatus: 'rejected', reviewNote: null, ...patch });

test('only current rejected attachments are listed, by document type name or else file name, with the trimmed reason', () => {
  const checklist = {
    documentTypes: [{ code: 'national_id', nameTh: 'สำเนาบัตรประชาชน' }],
    documents: [
      doc({ reviewNote: '  ภาพไม่ชัด  ' }),
      doc({ id: 2, documentTypeCode: 'unknown_type', fileName: 'other.pdf', reviewNote: '   ' }),
      doc({ id: 3, isCurrent: false, reviewNote: 'old version' }),
      doc({ id: 4, reviewStatus: 'accepted' }),
      doc({ id: 5, reviewStatus: 'pending' }),
    ],
  };
  assert.deepEqual(rejectedAttachments(checklist), [
    { name: 'สำเนาบัตรประชาชน', note: 'ภาพไม่ชัด' },
    { name: 'other.pdf', note: null },
  ]);
  assert.deepEqual(rejectedAttachments(null), []);
  assert.deepEqual(rejectedAttachments(undefined), []);
});

test('the notice shows the count, each document with its reason, and says signing is still allowed', () => {
  const markup = renderToStaticMarkup(React.createElement(RejectedAttachmentsNotice, { items: [
    { name: 'สำเนาบัตรประชาชน', note: 'ภาพไม่ชัด' }, { name: 'other.pdf', note: null },
  ] }));
  assert.match(markup, /เอกสารแนบที่ถูกตีกลับ 2 รายการ/);
  assert.match(markup, /• (<!-- -->)?สำเนาบัตรประชาชน: ภาพไม่ชัด/);
  assert.match(markup, /• (<!-- -->)?other\.pdf</);
  assert.match(markup, /ยังลงนามได้ แต่ควรอ่านเหตุผลก่อนลงนาม/);
  assert.equal(renderToStaticMarkup(React.createElement(RejectedAttachmentsNotice, { items: [] })), '');
});
