const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const filename = path.join(__dirname, '../src/components/RoomShareLinkSheet.tsx');
const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function findHandler(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'onShareUrl') handler = node.initializer;
  ts.forEachChild(node, findHandler);
}
findHandler(source);
assert.ok(handler, 'The copy button must have a share handler');
const compiled = ts.transpileModule(`exports.onShareUrl = ${handler.getText(source)};`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture(os, { clipboardWorks = false, action = 'shared', error } = {}) {
  const activityPayloads = [], clipboardWrites = [], alerts = [];
  const loaded = {};
  new Function('Platform', 'Share', 'Alert', 'rd', 'copyTextToClipboard', 'exports', compiled)(
    { OS: os },
    { sharedAction: 'shared', share: async payload => {
      activityPayloads.push(payload);
      if (error) throw error;
      return { action };
    } },
    { alert: (...args) => alerts.push(args) },
    { shareManageTitle: 'Share', shareLinkCopied: 'Copied', shareLinkCopyFailed: 'Copy failed' },
    async value => { clipboardWrites.push(value); return clipboardWorks; },
    loaded,
  );
  return { copy: loaded.onShareUrl, activityPayloads, clipboardWrites, alerts };
}

// No bearer token or account data is needed to test native share activity items.
const link = 'https://example.com/room';

test('iOS Copy receives one URL activity item so pasting into Safari cannot duplicate it', async () => {
  const f = fixture('ios');
  await f.copy(link);
  assert.equal(f.activityPayloads.length, 1);
  const items = [f.activityPayloads[0].message, f.activityPayloads[0].url].filter(Boolean);
  assert.deepEqual(items, [link]);
  assert.equal(f.activityPayloads[0].url, link);
  assert.equal(f.alerts.length, 1);
});

test('Android still shares the URL once as message text', async () => {
  const f = fixture('android');
  await f.copy(link);
  const items = [f.activityPayloads[0].message, f.activityPayloads[0].url].filter(Boolean);
  assert.deepEqual(items, [link]);
  assert.equal(f.activityPayloads[0].message, link);
});

test('successful clipboard writes do not also open native sharing', async () => {
  const f = fixture('web', { clipboardWorks: true });
  await f.copy(link);
  assert.deepEqual(f.clipboardWrites, [link]);
  assert.deepEqual(f.activityPayloads, []);
  assert.equal(f.alerts.length, 1);
});

test('dismissed and cancelled native sharing do not report a successful copy or an error', async () => {
  const dismissed = fixture('ios', { action: 'dismissed' });
  await dismissed.copy(link);
  assert.deepEqual(dismissed.alerts, []);
  const cancelled = fixture('ios', { error: Object.assign(new Error('Cancelled'), { name: 'AbortError' }) });
  await cancelled.copy(link);
  assert.deepEqual(cancelled.alerts, []);
});

test('share failures still display the existing failure message', async () => {
  const f = fixture('ios', { error: new Error('Unavailable') });
  await f.copy(link);
  assert.deepEqual(f.alerts, [['Copy failed']]);
});
