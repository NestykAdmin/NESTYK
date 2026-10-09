const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const file = path.join(__dirname, '../../../packages/i18n/src/error-message.ts');
const loaded = { exports: {} };
const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
new Function('module', 'exports', 'require', source)(loaded, loaded.exports, require);
const { localizedError, isInLocale } = loaded.exports;

test('server messages show only in their own language', () => {
  const thai = new Error('ไม่พบผู้เช่า');
  const english = new Error('User not found');
  assert.equal(localizedError(thai, 'fallback', 'th'), 'ไม่พบผู้เช่า');
  assert.equal(localizedError(thai, 'Tenant not found', 'en'), 'Tenant not found');
  assert.equal(localizedError(english, 'ไม่พบผู้ใช้', 'th'), 'ไม่พบผู้ใช้');
  assert.equal(localizedError(english, 'fallback', 'en'), 'User not found');
  assert.equal(localizedError(english, '找不到用户', 'zh'), '找不到用户');
  assert.equal(localizedError(thai, 'ユーザーが見つかりません', 'ja'), 'ユーザーが見つかりません');
});

test('non-errors, blank and technical messages fall back', () => {
  assert.equal(localizedError('boom', 'fallback', 'en'), 'fallback');
  assert.equal(localizedError(new Error('  '), 'fallback', 'en'), 'fallback');
  assert.equal(localizedError(new Error('HTTP 500'), 'เกิดข้อผิดพลาด', 'th'), 'เกิดข้อผิดพลาด');
});

test('script detection tells Chinese from Japanese', () => {
  assert.equal(isInLocale('文件加载失败', 'zh'), true);
  assert.equal(isInLocale('書類を読み込めませんでした', 'zh'), false);
  assert.equal(isInLocale('書類を読み込めませんでした', 'ja'), true);
  assert.equal(isInLocale('Network request failed', 'th'), false);
});
