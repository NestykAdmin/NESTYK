// Self owner contracts and income pages (UI round, 24 Nov 2026, ClickUp z8rcteng6e / z8rcteng6f): read only, demo data.
// Plan: Project plans/2026-11-24-self-owner-contracts-income.md Tasks 2 (web) and 3 (phone).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

const root = path.resolve(__dirname, '../../..');
const theme = { mode: 'light', background: '#F8FAFC', surface: '#fff', screenTitle: '#211E1E', textSecondary: '#64748B', border: '#E5E7EB' };
let locale = 'th';
let sequence = 0;
const cache = new Map();
const interpolate = (text, values) => text.replace(/\{(\w+)\}/g, (all, key) => (key in values ? String(values[key]) : all));
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const localRequire = (name) => {
    if (name === 'expo-constants') return { __esModule: true, default: { expoConfig: { extra: {} } } };
    if (name.endsWith('.css')) return {};
    if (name === 'react') return { ...React, useMemo: fn => fn(), useCallback: fn => fn, useSyncExternalStore: (_s, get) => get(), useEffect() {}, useRef: () => ({ current: null }), useId: () => `test-${sequence++}`, useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}] };
    if (name === '@nestyk/i18n') return { useLocale: () => ({ locale, t: load(`${root}/packages/i18n/src/locales/${locale}.ts`)[locale] }) };
    if (name === '@nestyk/ui/native') return { useMobileTheme: () => ({ theme }), MobileIcon: () => null, MobileStatusPill: 'MobileStatusPill', MobileSectionHeader: 'MobileSectionHeader', MobileFilterChip: 'MobileFilterChip', MobileButton: 'MobileButton', MobileInput: 'MobileInput', tokens: load(`${root}/packages/ui/src/theme/tokens.ts`).tokens };
    if (name === '@nestyk/ui/cookie-consent') return { cookieConsentAllows: () => false };
    if (name === 'react-native') return { Modal: ({ visible, children }) => (visible ? children : null), ScrollView: 'ScrollView', TextInput: 'TextInput', View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: v => v, hairlineWidth: 1 }, Platform: { OS: 'ios' } };
    if (name === 'react-native-safe-area-context') return { SafeAreaView: ({ children }) => children };
    if (name === '@nestyk/feature-listing') return { ...load(`${root}/packages/feature-listing/src/dashboard/types.ts`), interpolate };
    if (!name.startsWith('.')) return require(name);
    const base = path.resolve(path.dirname(filename), name);
    return load([base, `${base}.ts`, `${base}.tsx`].find(file => fs.existsSync(file) && fs.statSync(file).isFile()));
  };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText)(localRequire, module, module.exports);
  return module.exports;
}

const now = new Date('2026-11-24T03:00:00Z');
const lib = () => load(path.join(__dirname, '../lib/self-owner-contracts.ts'));
const contracts = () => lib().createSelfOwnerContractsDemo(now);
const months = () => lib().selfOwnerIncomeMonths(contracts(), now);
const copyOf = (l = locale) => load(`${root}/packages/i18n/src/locales/${l}.ts`)[l];
function nodes(element) {
  if (element == null || typeof element === 'boolean') return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!React.isValidElement(element)) return [element];
  if (typeof element.type === 'function') return nodes(element.type(element.props));
  return [element, ...nodes(element.props.children)];
}
const texts = (tree) => tree.filter(node => typeof node === 'string' || typeof node === 'number').map(String);
const byClass = (tree, name) => tree.filter(node => node?.props?.className?.split?.(' ').includes(name));
const label = (node) => texts(nodes(node.props.children)).join('');
const web = (file) => load(path.join(__dirname, 'self-owner', file));
const contractsWeb = (props = {}) => nodes(web('SelfOwnerContractsPage.web.tsx').SelfOwnerContractsPage({ contracts: contracts(), isDemoPreview: true, ...props }));
const incomeWeb = (props = {}) => nodes(web('SelfOwnerIncomePage.web.tsx').SelfOwnerIncomePage({ contracts: contracts(), months: months(), isDemoPreview: true, now, ...props }));

test('web contracts table: one row per contract, work first, status pills', () => {
  locale = 'th';
  const tree = contractsWeb();
  const rows = tree.filter(n => n?.type === 'tr' && typeof n.props.onClick === 'function');
  assert.equal(rows.length, 11);
  assert.ok(label(rows[0]).includes('ห้อง 2101'));
  const so = copyOf().selfOwnerContracts;
  const pills = tree.filter(n => n?.type === 'MobileStatusPill').map(p => p.props.label);
  assert.ok(pills.includes(so.status.awaiting_signature));
  assert.ok(pills.includes(so.status.ending_soon));
  assert.ok(texts(tree).join('').includes(interpolate(so.daysLeft, { n: 37 })));
});

test('web contracts: the status filter narrows the rows; no match shows clear filters', () => {
  locale = 'th';
  const ended = contractsWeb({ initialFilter: 'ended' }).filter(n => n?.type === 'tr' && typeof n.props.onClick === 'function');
  assert.equal(ended.length, 1);
  assert.ok(label(ended[0]).includes('ห้อง 309'));
  const none = contractsWeb({ initialQuery: 'zzz' });
  assert.equal(none.filter(n => n?.type === 'tr' && typeof n.props.onClick === 'function').length, 0);
  const states = copyOf().agent.dashboard.webStates;
  assert.ok(texts(none).includes(states.filteredTitle));
  assert.ok(none.some(n => n?.props?.['data-testid'] === 'state.filtered'));
  assert.ok(none.some(n => n?.type === 'button' && typeof n.props.onClick === 'function' && n.props.className?.includes('awu-btn')));
});

test('web contract detail is read only', () => {
  locale = 'th';
  const so = copyOf().selfOwnerContracts;
  const c805 = contracts().find(c => c.roomTitle === 'ห้อง 805');
  const tree = nodes(web('SelfOwnerContractsPage.web.tsx').SelfOwnerContractDetail({ contract: c805, onClose() {} }));
  const all = texts(tree).join('|');
  for (const value of [c805.tenantName, c805.tenantPhone, '25,000', so.advanceRent, so.deposit, so.readOnlyNote]) assert.ok(all.includes(value), value);
  const buttons = tree.filter(n => n?.type === 'button');
  const doc = buttons.find(b => label(b).includes(so.viewDocument));
  assert.equal(doc.props.disabled, true);
  const closeLabel = copyOf().agent.dashboard.webWorkspace.close;
  assert.ok(buttons.filter(b => !b.props.disabled).every(b => b.props['aria-label'] === closeLabel || label(b) === closeLabel));
});

test('web income: this month, summary adds up, next month disabled, first month has no previous', () => {
  locale = 'th';
  const inc = copyOf().selfOwnerIncome;
  const tree = incomeWeb();
  const all = texts(tree).join('|');
  assert.ok(all.includes('พฤศจิกายน 2026'));
  const rows = lib().selfOwnerRentForMonth(contracts(), 2026, 11, now);
  const sum = (state) => rows.filter(r => !state || r.state === state).reduce((n, r) => n + r.amount, 0);
  for (const amount of [sum(), sum('paid'), sum('overdue')]) assert.ok(all.includes(`฿${amount.toLocaleString('en-US')}`), String(amount));
  assert.equal(sum(), sum('paid') + sum('overdue') + sum('due'));
  const nav = (tree, name) => tree.find(n => n?.type === 'button' && n.props['aria-label'] === name);
  assert.equal(nav(tree, inc.nextMonth).props.disabled, true);
  assert.equal(nav(tree, inc.prevMonth).props.disabled, false);
  const first = months()[0];
  const firstTree = incomeWeb({ initialMonth: first });
  assert.equal(nav(firstTree, inc.prevMonth).props.disabled, true);
  const rowsOf = (t) => t.filter(n => n?.type === 'tr' && String(n.props['data-testid'] ?? '').startsWith('self-owner-income-table.row.'));
  assert.equal(rowsOf(tree).length, rows.length);
  assert.equal(rowsOf(firstTree).length, lib().selfOwnerRentForMonth(contracts(), first.year, first.month, now).length);
  assert.ok(tree.filter(n => n?.type === 'MobileStatusPill').some(p => p.props.label === interpolate(inc.overdue, { n: 23 })));
});

test('web pages show the demo note once', () => {
  locale = 'th';
  for (const tree of [contractsWeb(), incomeWeb()]) assert.equal(tree.filter(n => n?.props?.role === 'note').length, 1);
});

test('thai pages have no english copy; every locale fills both namespaces', () => {
  locale = 'th';
  for (const tree of [contractsWeb(), incomeWeb()]) {
    const words = texts(tree).join(' ').replace(/[A-Za-z][a-z]+ [A-Z][a-z]+|Emily|Carter|Kenji|Watanabe|Li Wei|Sarah|Kim|Ideo|Life|One|Wireless|Four|Seasons|Private|Residences|The|Base|Rhythm|Lumpini|Suite|Noble|Revo|Ashton|Mobi|Supalai|Premier|Line|Park|Origin|Aspire|Ploenchit|Q/g, '');
    assert.doesNotMatch(words, /\b(Contract|Status|Rent|Tenant|Income|Paid|Overdue|Due)\b/);
  }
  const keys = (obj) => Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v).map(x => `${k}.${x}`) : [k])).sort();
  for (const ns of ['selfOwnerContracts', 'selfOwnerIncome']) {
    const th = keys(copyOf('th')[ns]);
    for (const l of ['en', 'ja', 'zh']) {
      assert.deepEqual(keys(copyOf(l)[ns]), th, `${l}.${ns}`);
      for (const key of th) assert.ok(key.split('.').reduce((o, k) => o[k], copyOf(l)[ns]), `${l}.${ns}.${key}`);
    }
  }
});

// ---- Task 3: phone ----
const phone = (file) => load(path.join(__dirname, 'self-owner', file));
const contractsPhone = (props = {}) => nodes(phone('MobileSelfOwnerContractsScreen.tsx').MobileSelfOwnerContractsScreen({ contracts: contracts(), isDemoPreview: true, ...props }));
const incomePhone = (props = {}) => nodes(phone('MobileSelfOwnerIncomeScreen.tsx').MobileSelfOwnerIncomeScreen({ contracts: contracts(), months: months(), isDemoPreview: true, now, ...props }));
const byTestId = (tree, prefix) => tree.filter(n => typeof n?.props?.testID === 'string' && n.props.testID.startsWith(prefix));

test('phone contracts: chips with counts, cards that open a read-only detail', () => {
  locale = 'th';
  const so = copyOf().selfOwnerContracts;
  const tree = contractsPhone();
  const chips = byTestId(tree, 'soc-filter-');
  assert.equal(chips.length, 5);
  const counts = lib().countSelfOwnerContracts(contracts());
  assert.ok(texts(nodes(chips[0].props.children)).includes(String(counts.all)));
  const cards = byTestId(tree, 'soc-card-');
  assert.equal(cards.length, 11);
  const c805 = cards.find(c => c.props.testID === 'soc-card-c-r2');
  assert.equal(c805.props.accessibilityLabel, `${so.viewDetail} ห้อง 805`);
  assert.equal(typeof c805.props.onPress, 'function');
  assert.equal(typeof c805.props.style, 'function', 'card dims while pressed');
  const detail = nodes(phone('MobileSelfOwnerContractsScreen.tsx').MobileSelfOwnerContractDetail({ contract: contracts().find(c => c.roomId === 'r2'), onClose() {} }));
  const doc = detail.find(n => n?.props?.testID === 'soc-document');
  assert.equal(doc.props.disabled, true);
  const all = texts(detail).join('|');
  for (const value of ['Emily Carter', '089-112-3402', so.readOnlyNote]) assert.ok(all.includes(value), value);
});

test('phone contracts: no match shows clear filters', () => {
  locale = 'th';
  const tree = contractsPhone({ initialQuery: 'zzz' });
  assert.equal(byTestId(tree, 'soc-card-').length, 0);
  assert.ok(texts(tree).includes(copyOf().selfOwnerRooms.noMatch));
  assert.equal(byTestId(tree, 'soc-clear').length, 1);
});

test('phone income: month switch, summary, rows', () => {
  locale = 'th';
  const inc = copyOf().selfOwnerIncome;
  const tree = incomePhone();
  const rows = lib().selfOwnerRentForMonth(contracts(), 2026, 11, now);
  assert.equal(byTestId(tree, 'soi-row-').length, rows.length);
  assert.ok(texts(tree).includes('พฤศจิกายน 2026'));
  const nav = (name) => tree.find(n => n?.props?.accessibilityLabel === name && n?.props?.accessibilityRole === 'button');
  assert.equal(nav(inc.nextMonth).props.disabled, true);
  assert.equal(nav(inc.prevMonth).props.disabled, false);
  const sum = rows.reduce((n, r) => n + r.amount, 0);
  assert.ok(texts(tree).includes(`฿${sum.toLocaleString('en-US')}`));
  assert.equal(tree.filter(n => n?.props?.accessibilityRole === 'text' && n?.props?.testID === 'soi-demo').length + tree.filter(n => n?.props?.testID === 'soi-demo').length > 0, true);
});

// Jom 24 Nov 2026: rooms from several projects, so the income page names the project like the contracts page.
test('web income: room cell shows the project under the room name', () => {
  locale = 'th';
  const tree = incomeWeb();
  const rows = lib().selfOwnerRentForMonth(contracts(), 2026, 11, now);
  for (const r of rows) {
    const row = tree.find(n => n?.type === 'tr' && n.props['data-testid'] === `self-owner-income-table.row.${r.id}`);
    const roomTd = nodes(row.props.children).find(n => n?.type === 'td');
    const small = nodes(roomTd.props.children).find(n => n?.type === 'small');
    assert.ok(small, r.roomTitle);
    assert.equal(texts(nodes(small.props.children)).join(''), r.project, r.roomTitle);
  }
});

test('phone income: each card names the project', () => {
  locale = 'th';
  const tree = incomePhone();
  const rows = lib().selfOwnerRentForMonth(contracts(), 2026, 11, now);
  for (const r of rows) {
    const card = tree.find(n => n?.props?.testID === `soi-row-${r.id}`);
    assert.ok(texts(nodes(card.props.children)).includes(`${r.tenantName} · ${r.project}`), r.roomTitle);
  }
});

test('native fallbacks render the phone screens', () => {
  locale = 'th';
  const c = phone('SelfOwnerContractsPage.tsx').SelfOwnerContractsPage({ contracts: contracts(), isDemoPreview: true });
  assert.equal(c.type.name, 'MobileSelfOwnerContractsScreen');
  const i = phone('SelfOwnerIncomePage.tsx').SelfOwnerIncomePage({ contracts: contracts(), months: months(), isDemoPreview: true });
  assert.equal(i.type.name, 'MobileSelfOwnerIncomeScreen');
});

// Jom 24 Nov 2026: "จ่ายแล้ว" is easier to read than "รับแล้ว"; the income page uses the Dashboard's word in every locale.
test('income uses the Dashboard word for paid rent in every locale', () => {
  for (const l of ['th', 'en', 'ja', 'zh']) {
    const all = copyOf(l);
    const paid = all.selfOwnerDashboard.rentState.paid;
    assert.equal(all.selfOwnerIncome.paid, paid, l);
    assert.equal(all.selfOwnerIncome.summaryReceived, paid, l);
    assert.ok(all.selfOwnerIncome.paidOn.includes('{date}'), l);
  }
  assert.equal(copyOf('th').selfOwnerIncome.paidOn, 'จ่ายเมื่อ {date}');
});

// Jom 24 Nov 2026: the paid date is its own column on the web income table; "-" when not paid.
test('web income: paid date has its own column, "-" when not paid', () => {
  locale = 'th';
  const inc = copyOf().selfOwnerIncome;
  const tree = incomeWeb();
  const headers = tree.filter(n => n?.type === 'th').map(h => texts(nodes(h.props.children)).join(''));
  assert.equal(inc.colPaidAt, 'วันที่จ่าย', 'Thai header wording (Jom 24 Nov 2026)');
  assert.ok(headers.includes(inc.colPaidAt), 'header');
  assert.equal(headers.indexOf(inc.colPaidAt), headers.indexOf(inc.colDue) + 1, 'right after the due date');
  const rowOf = (title) => tree.find(n => n?.type === 'tr' && String(n.props['data-testid'] ?? '').startsWith('self-owner-income-table.row.') && texts(nodes(n.props.children)).includes(title));
  const cells = (row) => nodes(row.props.children).filter(n => n?.type === 'td').map(td => texts(nodes(td.props.children)).join(''));
  const paidIndex = headers.indexOf(inc.colPaidAt);
  const paid = cells(rowOf('ห้อง 1204'));
  assert.equal(paid[paidIndex], '3 พ.ย.');
  assert.equal(cells(rowOf('ห้อง 805'))[paidIndex], '-');
  assert.equal(cells(rowOf('ห้อง 417'))[paidIndex], '-');
  assert.ok(!paid.some(c => c.includes('จ่ายเมื่อ')), 'no paid-on text left in the status cell');
  for (const l of ['en', 'ja', 'zh']) assert.ok(copyOf(l).selfOwnerIncome.colPaidAt, l);
});

// Browser check 24 Nov 2026: with the paid-date column, a long room name kept on one line pushed the status pills
// out of the card. The room cell wraps like the contracts page (awr-room) instead of awr-nowrap.
test('web income: room name wraps like the contracts table', () => {
  locale = 'th';
  const tree = incomeWeb();
  const row = tree.find(n => n?.type === 'tr' && String(n.props['data-testid'] ?? '').startsWith('self-owner-income-table.row.'));
  const roomTd = nodes(row.props.children).find(n => n?.type === 'td');
  const inner = nodes(roomTd.props.children);
  assert.ok(inner.some(n => n?.props?.className === 'awr-room'), 'room cell uses awr-room');
  assert.ok(!inner.some(n => String(n?.props?.className ?? '').includes('awr-nowrap')), 'room cell is not nowrap');
});
