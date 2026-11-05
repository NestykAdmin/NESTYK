// Plan step 2 · A6 (Mos 4 Nov 2026): on the web, Alert.alert becomes a toast or a confirm dialog (N-Q2, E3).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '../../..');
function loadTs(file, requireFn = () => { throw new Error(`${path.basename(file)} must stay dependency free`); }) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)(requireFn, mod, mod.exports);
  return mod.exports;
}
const notify = loadTs(path.join(__dirname, 'web-notify.ts'));
const cache = new Map();
function loadDeep(file) {
  if (cache.has(file)) return cache.get(file);
  const exportsHolder = {};
  cache.set(file, exportsHolder);
  const loaded = loadTs(file, (id) => {
    if (!id.startsWith('.')) return {};
    const base = path.resolve(path.dirname(file), id);
    const hit = [`${base}.ts`, `${base}/index.ts`, base].find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
    return loadDeep(hit);
  });
  Object.assign(exportsHolder, loaded);
  return exportsHolder;
}
const locale = (code) => loadDeep(`${root}/packages/i18n/src/locales/${code}.ts`)[code];

test('a message without choices is a toast; two choices or a button that does something is a dialog', () => {
  assert.equal(notify.isDialog(undefined), false);
  assert.equal(notify.isDialog([]), false);
  assert.equal(notify.isDialog([{ text: 'OK' }]), false);
  assert.equal(notify.isDialog([{ text: 'OK', onPress() {} }]), true);
  assert.equal(notify.isDialog([{ text: 'Cancel', style: 'cancel' }, { text: 'Sign in' }]), true);
});

test('tone comes from the i18n key of the title or message, in every language', () => {
  for (const code of ['en', 'th', 'ja', 'zh']) {
    const t = locale(code);
    const tables = notify.buildToneTables(t);
    // Errors stay until closed (E3).
    assert.equal(notify.toneOf(t.agent.leads.lostReasonRequired, undefined, tables), 'error', `${code} lost reason`);
    assert.equal(notify.toneOf(t.agent.createRoom.saveError, 'Network down', tables), 'error', `${code} save error`);
    // Done messages close after 4 s.
    assert.equal(notify.toneOf(t.agent.leads.saved, undefined, tables), 'success', `${code} lead saved`);
    assert.equal(notify.toneOf(t.agent.leads.phoneCopied, '+66 80 000 0000', tables), 'success', `${code} phone copied`);
    assert.equal(notify.toneOf(t.common.signOut, t.mobile.auth.signedOut, tables), 'success', `${code} signed out`);
    // Anything else is information (also 4 s).
    assert.equal(notify.toneOf(t.agent.dashboard.comingSoon, t.agent.dashboard.unavailableSection, tables), 'info', `${code} coming soon`);
  }
});

test('the store stacks at most 3 toasts, restarts a repeated one and keeps dialogs apart', () => {
  const store = notify.createNoticeStore();
  const seen = [];
  const stop = store.subscribe((list) => seen.push(list.length));
  store.push('A');
  store.push('B', 'b');
  const again = store.push('B', 'b');
  assert.equal(again.repeat, 1);
  assert.equal(store.list().filter((n) => n.kind === 'toast').length, 2);
  store.push('C');
  store.push('D');
  assert.deepEqual(store.list().map((n) => n.title), ['B', 'C', 'D']);
  const dialog = store.push('Delete?', 'Sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress() {} }]);
  assert.equal(dialog.kind, 'dialog');
  assert.equal(store.list().length, 4);
  store.dismiss(dialog.id);
  assert.equal(store.list().some((n) => n.kind === 'dialog'), false);
  stop();
  store.push('E');
  assert.equal(seen.length, 7, 'no update after unsubscribe');
});

test('dismissing a dialog uses its cancel button; the main choice goes last', () => {
  const cancel = { text: 'Stay', style: 'cancel' };
  const discard = { text: 'Discard', style: 'destructive' };
  assert.equal(notify.cancelButton([discard, cancel]), cancel);
  assert.equal(notify.cancelButton([discard]), undefined);
  assert.deepEqual(notify.dialogButtonOrder([discard, cancel]).map((b) => b.text), ['Stay', 'Discard']);
});

test('web replaces Alert.alert once at start-up; the phone keeps the native Alert', () => {
  const layout = fs.readFileSync(path.resolve(__dirname, '../app/_layout.tsx'), 'utf8');
  assert.match(layout, /import \{ WebNotifier \} from '\.\.\/components\/web-notify\/WebNotifier';/);
  assert.match(layout, /<WebNotifier \/>/);
  const native = fs.readFileSync(path.resolve(__dirname, '../components/web-notify/WebNotifier.tsx'), 'utf8');
  assert.doesNotMatch(native, /import|\.alert\s*=/, 'native file must not import anything or replace Alert');
  assert.match(native, /return null;/);
  const web = fs.readFileSync(path.resolve(__dirname, '../components/web-notify/WebNotifier.web.tsx'), 'utf8');
  assert.match(web, /^replaceAlert\(\);$/m);

  // The web module sends Alert.alert calls to its queue.
  const Alert = { alert() {} };
  const React = require('react');
  const exportsWeb = loadTs(path.resolve(__dirname, '../components/web-notify/WebNotifier.web.tsx'), (id) => {
    if (id === 'react') return React;
    if (id === 'react-native') return { Alert };
    if (id === '@nestyk/i18n') return {};
    if (id === '@nestyk/ui/native') return {};
    if (id === '../agent-web/ui/WebDialog') return { WebDialog: () => null };
    if (id === '../../lib/web-notify') return notify;
    if (id.endsWith('.css')) return {};
    throw new Error(`Unexpected dependency: ${id}`);
  });
  Alert.alert('Lead saved');
  Alert.alert('Sign in', 'Please sign in', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign in', onPress() {} }]);
  const list = exportsWeb.webNotices.list();
  assert.deepEqual(list.map((n) => [n.kind, n.title]), [['toast', 'Lead saved'], ['dialog', 'Sign in']]);
});
