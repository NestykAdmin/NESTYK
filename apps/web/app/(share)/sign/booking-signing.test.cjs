const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function render(signingBlockedReason) {
  let stateIndex = 0;
  const preview = { party: 'tenant', partyLabel: 'ผู้เช่า', contractNo: 'RS202600011', property: 'Project', tenant: 'Tenant', agreementTypeName: 'หนังสือจอง', signingBlockedReason };
  const mockRequire = name => {
    if (name === 'react') return { ...React, useRef: value => ({ current: value }), useEffect() {}, useState: initial => {
      const index = stateIndex++;
      return [index === 0 ? preview : index === 4 ? false : initial, () => {}];
    } };
    if (name === 'next/navigation') return { useParams: () => ({ token: 'test-token' }) };
    throw new Error(`Unexpected dependency: ${name}`);
  };
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '[token]/page.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText)(mockRequire, loaded, loaded.exports);
  return renderToStaticMarkup(React.createElement(loaded.exports.default));
}

test('public tenant link explains pending payment and hides signature submission', () => {
  const markup = render('ผู้เช่าต้องชำระค่าจองก่อนลงนาม');
  assert.match(markup, /ต้องชำระค่าจอง/);
  assert.match(markup, /ตรวจสอบการชำระอีกครั้ง/);
  assert.doesNotMatch(markup, /<canvas|ยืนยันลายเซ็น/);
});

test('public signing pad is available after server payment approval', () => {
  const markup = render(null);
  assert.match(markup, /<canvas/);
  assert.match(markup, /ยืนยันลายเซ็น/);
  assert.doesNotMatch(markup, /ตรวจสอบการชำระอีกครั้ง/);
});
