const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { dateLocale, THAI_DATE_LOCALE } = require('../src/date-locale.ts');

const DAY = new Date(Date.UTC(2026, 11, 1));
const fmt = (tag) => new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(DAY);

test('Thai dates keep Thai month names but use the Gregorian year (Mos 11 Nov 2026)', () => {
  assert.equal(dateLocale('th'), THAI_DATE_LOCALE);
  assert.equal(fmt(dateLocale('th')), '1 ธ.ค. 2026');
  assert.equal(fmt(dateLocale('th-TH')), '1 ธ.ค. 2026');
});

test('other languages pass through unchanged', () => {
  for (const tag of ['en', 'en-GB', 'ja', 'ja-JP', 'zh', 'zh-CN']) assert.equal(dateLocale(tag), tag);
});

const ROOT = path.join(__dirname, '../../..');
const SOURCE_DIRS = ['apps/consumer-app/app', 'apps/consumer-app/components', 'apps/consumer-app/lib', 'apps/web/app', 'apps/web/lib', 'apps/api/src', 'packages'];
function* sourceFiles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(full);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) yield full;
  }
}

test('no source formats Thai dates with plain th-TH or a raw locale (both give the Buddhist year)', () => {
  const offenders = [];
  for (const dir of SOURCE_DIRS) {
    for (const file of sourceFiles(path.join(ROOT, dir))) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const plainThai = /['"`]th-TH['"`]/.test(line);
        const rawLocale = /(toLocaleDateString|DateTimeFormat)\(\s*(locale|lang)\s*[,)]/.test(line);
        if (plainThai || rawLocale) offenders.push(`${path.relative(ROOT, file)}:${i + 1}`);
      });
    }
  }
  assert.deepEqual(offenders, []);
});
