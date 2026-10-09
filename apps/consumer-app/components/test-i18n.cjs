const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTs(file) {
  const loaded = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'module', 'exports', output)(require, loaded, loaded.exports);
  return loaded.exports;
}

const i18nSrc = path.join(__dirname, '../../../packages/i18n/src');
const { contractsTh } = loadTs(path.join(i18nSrc, 'locales/contracts/th.ts'));
const { fillTemplate } = loadTs(path.join(i18nSrc, 'template.ts'));
const leadFormat = loadTs(path.join(__dirname, '../lib/lead-format.ts'));

/** `@nestyk/i18n` stand-in that serves the real Thai contract copy. */
function i18nMock(t = {}) {
  return {
    useLocale: () => ({ t: { contracts: contractsTh, ...t }, locale: 'th' }),
    fillTemplate,
    localizedError: (error, fallback) => fallback,
  };
}

module.exports = { contractsTh, fillTemplate, i18nMock, leadFormat };
