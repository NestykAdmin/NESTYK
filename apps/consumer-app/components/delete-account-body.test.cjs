// QA B4 / B10 (3 Nov 2026): after "delete now" the screen does not load the deletion status again (the user is
// signed out); a 409 because something new blocks deletion shows the reasons, not "HTTP 409".
process.env.TZ = 'UTC'; // the device time zone must not move the date shown
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, filename);
const th = require(path.join(__dirname, '../../../packages/i18n/src/locales/th.ts')).th;

let state = [], cursor = 0;
const hooks = { ...React, useEffect() {}, useState(initial) {
  const i = cursor++;
  if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
  return [state[i], (v) => { state[i] = typeof v === 'function' ? v(state[i]) : v; }];
} };
const deps = {
  react: hooks,
  'react-native': { View: 'view', Text: 'text', ScrollView: 'scroll', Pressable: 'press', BackHandler: { addEventListener: () => ({ remove() {} }) },
    StyleSheet: { create: (s) => s, absoluteFill: {} } },
  '@nestyk/i18n': { useLocale: () => ({ t: th, locale: 'th' }) },
  '../components/MobileButton': { MobileButton: 'button' },
  '../components/MobileInput': { MobileInput: 'input' },
  '../theme/tokens': { tokens: { colors: { danger: '#c00' }, typography: { native: {} } } },
  '../theme/ThemeContext': { useMobileTheme: () => ({ theme: {} }) },
  '../components/AccountDeletionNotice': { formatAccountDeletionDate: (iso, locale) => new Date(iso).toLocaleDateString(locale === 'th' ? 'th-TH-u-ca-gregory' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' }) },
};
const mod = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../../../packages/ui/src/shells/MobileDeleteAccountBody.tsx'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } },
).outputText)((id) => { if (id in deps) return deps[id]; throw new Error(`Unexpected dependency: ${id}`); }, mod, mod.exports);
const { MobileDeleteAccountBody } = mod.exports;

function nodes(el) {
  if (el == null || typeof el === 'boolean') return [];
  if (Array.isArray(el)) return el.flatMap(nodes);
  if (!React.isValidElement(el)) return [el];
  if (el.type === React.Fragment) return nodes(el.props.children);
  return [el, ...nodes(el.props.children)];
}
const account = th.mobile.account;
function screen(props) {
  state = [];
  const render = () => { cursor = 0; return nodes(MobileDeleteAccountBody(props)); };
  const press = (label) => {
    const button = render().find((n) => n?.type === 'button' && n.props.children === label);
    assert.ok(button, `button ${label}`);
    return button.props.onPress();
  };
  const texts = () => render().filter((n) => typeof n === 'string');
  const flush = () => new Promise((r) => setImmediate(r));
  return { render, press, texts, flush,
    async confirmWithPassword(choice) {
      state[0] = { blocked: false, reasons: [], scheduledFor: null, deleteNowAvailable: true }; // the preview the page loaded
      press(choice);
      press(th.common.confirm);
      render().find((n) => n?.type === 'input').props.onChangeText('Secret123');
      press(th.common.confirm);
      await flush(); await flush();
    } };
}
const base = () => {
  const calls = { load: 0, now: [], later: [] };
  return { calls, props: {
    onLoad: async () => { calls.load++; return { blocked: false, reasons: [], scheduledFor: '2026-12-03T00:00:00.000Z' }; },
    onDeleteNow: async (proof) => { calls.now.push(proof); },
    onSchedule: async (proof) => { calls.later.push(proof); },
    onCancelSchedule: async () => {},
  } };
};

test('delete now does not load the deletion status again; scheduling still does', async () => {
  const now = base();
  await screen(now.props).confirmWithPassword(account.deleteAccountNow);
  assert.deepEqual(now.calls.now, [{ password: 'Secret123' }]);
  assert.equal(now.calls.load, 0, 'signed out: nothing to load');

  const later = base();
  const s = screen(later.props);
  await s.confirmWithPassword(account.deleteAccountLater);
  assert.deepEqual(later.calls.later, [{ password: 'Secret123' }]);
  assert.equal(later.calls.load, 1);
});

test('a 409 ACCOUNT_DELETE_BLOCKED closes the dialog and shows the reasons from a fresh status, not "HTTP 409"', async () => {
  const { props, calls } = base();
  props.onDeleteNow = async () => { throw Object.assign(new Error('HTTP 409'), { status: 409, code: 'ACCOUNT_DELETE_BLOCKED' }); };
  props.onLoad = async () => { calls.load++; return { blocked: true, reasons: ['bill_awaiting_review'], scheduledFor: null }; };
  const s = screen(props);
  await s.confirmWithPassword(account.deleteAccountNow);
  const shown = s.texts();
  assert.equal(calls.load, 1, 'the status is loaded again');
  assert.ok(shown.includes(account.deleteAccountReasons.bill_awaiting_review));
  assert.ok(shown.includes(account.deleteAccountBlocked));
  assert.ok(!shown.some((t) => /HTTP 409/.test(t)));
  assert.ok(!s.render().some((n) => n?.type === 'input'), 'the password dialog is closed');
  assert.ok(!s.render().some((n) => n?.type === 'button' && n.props.children === account.deleteAccountNow), 'no delete button while blocked');
});

test('other failures keep the dialog open with their message', async () => {
  const { props } = base();
  props.onDeleteNow = async () => { throw Object.assign(new Error(), { code: 'WRONG_PASSWORD' }); };
  const s = screen(props);
  await s.confirmWithPassword(account.deleteAccountNow);
  assert.ok(s.texts().includes(account.password.incorrect));
  assert.ok(s.render().some((n) => n?.type === 'input'));
});

test('the confirmation after deleting now has its own message in every language', () => {
  for (const lang of ['th', 'en', 'zh', 'ja']) {
    const copy = require(path.join(__dirname, `../../../packages/i18n/src/locales/${lang}.ts`))[lang].mobile.account;
    assert.ok(copy.deleteAccountDone && copy.deleteAccountDone.trim(), lang);
  }
});

test('A10: the delete page shows the scheduled day in Bangkok time, the same day as the banner, whatever the device zone', () => {
  const { props } = base();
  const s = screen(props);
  state[0] = { blocked: false, reasons: [], scheduledFor: '2026-12-02T17:00:00.000Z' }; // 00:00 BKK 3 Dec
  const shown = s.texts().join(' ');
  assert.match(shown, /3 ธันวาคม 2026/);
  assert.doesNotMatch(shown, /2 ธันวาคม 2026/);
  const web = fs.readFileSync(path.join(__dirname, 'agent-web/AgentWorkspace.web.tsx'), 'utf8');
  assert.match(web, /deleteAccountScheduled\.replace\("\{date\}", new Date\(deleteScheduled\)\.toLocaleDateString\([^,]+, \{[^}]*timeZone: "Asia\/Bangkok"/);
});

test('"delete now" shows only when the API allows it (QA builds); scheduling is always offered', () => {
  const { props } = base();
  const buttons = (preview) => {
    const s = screen(props);
    state[0] = preview;
    return s.render().filter((n) => n?.type === 'button').map((n) => n.props.children);
  };
  const off = buttons({ blocked: false, reasons: [], scheduledFor: null, deleteNowAvailable: false });
  assert.ok(!off.includes(account.deleteAccountNow));
  assert.ok(off.includes(account.deleteAccountLater));
  assert.ok(!buttons({ blocked: false, reasons: [], scheduledFor: null }).includes(account.deleteAccountNow), 'an API without the field: hidden');
  assert.ok(buttons({ blocked: false, reasons: [], scheduledFor: null, deleteNowAvailable: true }).includes(account.deleteAccountNow));
  const web = fs.readFileSync(path.join(__dirname, 'agent-web/AgentWorkspace.web.tsx'), 'utf8');
  assert.match(web, /deleteNowAvailable \? \(?\s*<button[^>]*onClick=\{\(\) => setDeletePending\('now'\)\}/);
});

test('REAUTH_REQUIRED (more than 5 minutes since signing in) asks for the password again, without loading the status', async () => {
  const { props, calls } = base();
  let attempts = 0;
  props.onSchedule = async () => { attempts++; throw Object.assign(new Error('HTTP 401'), { status: 401, code: 'REAUTH_REQUIRED' }); };
  const s = screen(props);
  await s.confirmWithPassword(account.deleteAccountLater);
  assert.equal(attempts, 1);
  assert.equal(calls.load, 0);
  const shown = s.texts();
  assert.ok(shown.includes(account.deleteAccountReauth), 'tells the user to confirm again');
  assert.ok(!shown.some((t) => /HTTP 401/.test(t)));
  const input = s.render().find((n) => n?.type === 'input');
  assert.ok(input, 'the password step is open again');
  assert.equal(input.props.value, '', 'with an empty password');
  const web = fs.readFileSync(path.join(__dirname, 'agent-web/AgentWorkspace.web.tsx'), 'utf8');
  assert.match(web, /code === "REAUTH_REQUIRED"[\s\S]{0,300}setDeletePasswordStep\(true\)[\s\S]{0,200}deleteAccountReauth/);
});
