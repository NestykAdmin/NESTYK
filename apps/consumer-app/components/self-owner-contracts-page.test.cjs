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
// Every state setter call of the components under test (the stubbed useState keeps no state): lets a test see what a handler set.
const stateLog = [];
const cache = new Map();
// The signature pad draws on a canvas / web view; the tests only need its props (Jom 25 Nov 2026, contract signing).
cache.set(path.join(__dirname, 'ContractSignaturePad.tsx'), { exports: { ContractSignaturePad: 'ContractSignaturePad' } });
// Sample contract PDFs (Jom 25 Nov 2026): the bundler turns them into assets; the tests only need a stand-in.
for (const file of ['lease-2101', 'renewal-805', 'broker-1204', 'reservation-2101']) cache.set(path.join(__dirname, '../assets/self-owner-demo', `${file}.pdf`), { exports: `asset:${file}` });
const interpolate = (text, values) => text.replace(/\{(\w+)\}/g, (all, key) => (key in values ? String(values[key]) : all));
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const localRequire = (name) => {
    if (name === 'expo-constants') return { __esModule: true, default: { expoConfig: { extra: {} } } };
    if (name.endsWith('.css')) return {};
    if (name === 'react') return { ...React, useMemo: fn => fn(), useCallback: fn => fn, useSyncExternalStore: (_s, get) => get(), useEffect() {}, useRef: () => ({ current: null }), useId: () => `test-${sequence++}`, useState: initial => { const value = typeof initial === 'function' ? initial() : initial; return [value, (next) => { stateLog.push(typeof next === 'function' ? next(value) : next); }]; } };
    if (name === '@nestyk/i18n') return { useLocale: () => ({ locale, t: load(`${root}/packages/i18n/src/locales/${locale}.ts`)[locale] }) };
    if (name === '@nestyk/ui/native') return { useMobileTheme: () => ({ theme }), MobileIcon: () => null, MobileStatusPill: 'MobileStatusPill', MobileSectionHeader: 'MobileSectionHeader', MobileFilterChip: 'MobileFilterChip', MobileButton: 'MobileButton', MobileInput: 'MobileInput', MobileBottomSheet: 'MobileBottomSheet', SelectionCheck: 'SelectionCheck', tokens: load(`${root}/packages/ui/src/theme/tokens.ts`).tokens };
    if (name === '@nestyk/ui/cookie-consent') return { cookieConsentAllows: () => false };
    if (name === 'react-native') return { Animated: { View: 'AnimatedView', Value: class { constructor(v) { this.v = v; } setValue() {} interpolate() { return this; } }, timing: () => ({ start() {}, stop() {} }), loop: () => ({ start() {}, stop() {} }), sequence: () => ({ start() {}, stop() {} }), delay: () => ({ start() {}, stop() {} }) }, Easing: { inOut: (f) => f, out: (f) => f, ease: (x) => x, cubic: (x) => x }, AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(false) }, useWindowDimensions: () => ({ width: 390, height: 844 }), Modal: ({ visible, children }) => (visible ? children : null), ScrollView: 'ScrollView', TextInput: 'TextInput', View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: v => v, hairlineWidth: 1 }, Platform: { OS: 'ios' } };
    if (name === 'react-native-safe-area-context') return { SafeAreaView: ({ children }) => children };
    if (name === 'expo-asset') return { Asset: { fromModule: (m) => ({ uri: String(m) }) } };
    if (name === 'react-native-webview') return { WebView: 'WebView' };
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

// ---- Contract kinds (Jom 24 Nov 2026), plan self-owner-contract-kinds Task 3: shared detail rows + copy ----
const fmt = { money: (n) => `฿${n.toLocaleString('en-US')}`, day: (ymd) => ymd };
const viewOf = (id) => {
  const all = contracts();
  return web('contract-detail-rows.ts').contractDetailView(all.find(c => c.id === id), all, copyOf().selfOwnerContracts, fmt, '2026-11-24');
};
const tile = (view, label) => view.tiles.find(t => t.label === label);

// Layout A (Jom 24 Nov 2026): period + progress, the party, money tiles, a link to the renewed contract.
test('detail view by kind: lease and renewal', () => {
  locale = 'th';
  const so = copyOf().selfOwnerContracts;
  const renewal = viewOf('c-r1');
  assert.equal(renewal.period, '2026-04-01 – 2027-03-31');
  assert.equal(renewal.room, 'ห้อง 1204 · Ideo Q สยาม-ราชเทวี');
  assert.deepEqual([renewal.progress.month, renewal.progress.months, renewal.progress.daysLeft], [8, 12, 127]);
  assert.ok(renewal.progress.ratio > 0.6 && renewal.progress.ratio < 0.7);
  assert.equal(renewal.progressLabel, interpolate(so.progressMonth, { n: 8, total: 12 }));
  assert.deepEqual(renewal.party, { name: 'ณัฐวุฒิ ใจดี', role: so.tenant, phone: '081-234-5601', initial: 'ณ' });
  assert.deepEqual(renewal.tiles.map(t => [t.label, t.value, t.note]), [
    [so.monthlyRent, '฿18,000', undefined],
    [so.advanceRent, '฿18,000', interpolate(so.monthsCount, { n: 1 })],
    [so.deposit, '฿36,000', interpolate(so.monthsCount, { n: 2 })],
  ]);
  assert.equal(renewal.renewsFrom.id, 'c-r1-lease');
  assert.equal(renewal.renewsFrom.label, `${so.renewsFrom} ${so.kind.lease} · 2025-04-01 – 2026-03-31`);
  const ended = viewOf('c-r1-lease');
  assert.equal(ended.progress, undefined, 'no progress bar once ended');
  assert.equal(ended.renewsFrom, undefined);
  assert.deepEqual(ended.extra, []);
});

test('detail view by kind: broker appointment and reservation', () => {
  locale = 'th';
  const so = copyOf().selfOwnerContracts;
  const broker = viewOf('c-r1-broker');
  assert.deepEqual(broker.party, { name: 'Bangkok Home Agent', role: `${so.brokerContact} สมชาย ใจดี`, phone: '02-118-4400', initial: 'B' });
  assert.deepEqual(broker.tiles.map(t => [t.label, t.value, t.note]), [
    [so.askingRent, '฿18,000', undefined],
    [so.commission, '฿18,000', interpolate(so.commissionMonths, { months: 1 })],
  ]);
  assert.deepEqual(broker.extra, [[so.signedDate, '2025-02-15']]);
  const r5broker = viewOf('c-r5-broker');
  assert.deepEqual([tile(r5broker, so.commission).value, tile(r5broker, so.commission).note], ['฿30,000', undefined]);
  assert.deepEqual([r5broker.progress.month, r5broker.progress.months], [2, 12], 'an appointment in force shows its progress');
  const reservation = viewOf('c-r5-reservation');
  assert.deepEqual(reservation.party, { name: 'คุณกานต์', role: so.booker, phone: '082-908-1105', initial: 'ค' });
  assert.deepEqual(reservation.tiles.map(t => [t.label, t.value]), [[so.bookingFee, '฿42,000'], [so.moveInDate, '2026-12-01']]);
  assert.deepEqual(reservation.extra, [[so.signedDate, '2026-11-20']]);
  assert.equal(reservation.progress, undefined, 'a reservation has no progress bar');
  assert.equal(web('contract-detail-rows.ts').contractParty(contracts().find(c => c.id === 'c-r1-broker')), 'Bangkok Home Agent');
  assert.equal(web('contract-detail-rows.ts').initialOf('เมษา ดีงาม'), 'ม', 'skips a leading Thai vowel');
});

test('contract kinds copy in every locale', () => {
  const keys = ['progressMonth', 'monthsCount', 'colCurrent', 'colContracts', 'contractCount', 'roomContractsTitle', 'back', 'renewsFrom', 'brokerCompany', 'brokerContact', 'signedDate', 'appointmentPeriod', 'askingRent', 'commission', 'commissionMonths', 'booker', 'moveInDate', 'bookingFee'];
  for (const l of ['th', 'en', 'ja', 'zh']) {
    const so = copyOf(l).selfOwnerContracts;
    for (const k of keys) assert.ok(so[k], `${l}.${k}`);
    for (const k of ['reservation', 'lease', 'renewal', 'broker_appointment']) assert.ok(so.kind?.[k], `${l}.kind.${k}`);
    assert.ok(so.count.includes('{n}') && so.contractCount.includes('{n}') && so.roomContractsTitle.includes('{room}'), l);
  }
  const th = copyOf('th').selfOwnerContracts;
  assert.deepEqual(th.kind, { reservation: 'หนังสือจอง', lease: 'สัญญาเช่า', renewal: 'ต่อสัญญา', broker_appointment: 'สัญญาแต่งตั้งนายหน้า' });
  assert.equal(th.count, '{n} ห้อง');
  assert.equal(th.contractCount, '{n} ฉบับ');
  assert.equal(th.roomContractsTitle, 'สัญญาทั้งหมดของ {room}');
});

// Plan self-owner-contract-kinds Task 4: the web page lists rooms; a room opens all its contracts.
const roomRows = (tree) => tree.filter(n => n?.type === 'tr' && typeof n.props.onClick === 'function');
const rowOfRoom = (tree, roomId) => tree.find(n => n?.type === 'tr' && n.props['data-testid'] === `self-owner-contracts-table.row.${roomId}`);
const groups = () => lib().groupSelfOwnerContracts(contracts());
const phoneRoomList = (roomId) =>
  nodes(load(path.join(__dirname, 'self-owner', 'MobileSelfOwnerContractsScreen.tsx')).MobileSelfOwnerRoomContracts({ room: groups().find(g => g.roomId === roomId), all: contracts(), onClose() {} }));
const roomDialog = (roomId, props = {}) =>
  nodes(web('SelfOwnerContractsPage.web.tsx').SelfOwnerRoomContractsDialog({ room: groups().find(g => g.roomId === roomId), all: contracts(), onClose() {}, ...props }));

test('web contracts: one row per room, work first, current contract and how many', () => {
  locale = 'th';
  const so = copyOf().selfOwnerContracts;
  const tree = contractsWeb();
  const rows = roomRows(tree);
  assert.equal(rows.length, 11);
  assert.ok(label(rows[0]).includes('ห้อง 2101'));
  const r1204 = label(rowOfRoom(tree, 'r1'));
  for (const text of ['ห้อง 1204', 'Ideo Q สยาม-ราชเทวี', 'ณัฐวุฒิ ใจดี', so.kind.renewal, '฿18,000', interpolate(so.contractCount, { n: 4 })]) assert.ok(r1204.includes(text), text);
  const r2101 = label(rowOfRoom(tree, 'r5'));
  for (const text of [so.kind.lease, 'คุณกานต์', interpolate(so.contractCount, { n: 3 })]) assert.ok(r2101.includes(text), text);
  const pills = tree.filter(n => n?.type === 'MobileStatusPill').map(p => p.props.label);
  assert.ok(pills.includes(so.status.awaiting_signature));
  assert.ok(pills.includes(so.status.ending_soon));
  assert.ok(texts(tree).join('').includes(interpolate(so.daysLeft, { n: 37 })));
  // Jom 25 Nov 2026: no room count in the toolbar, and the status dropdown sits at the right, like the income page.
  assert.ok(!texts(tree).includes(interpolate(so.count, { n: 11 })), 'no room count');
  assert.equal(tree.filter(n => n?.props?.className === 'awr-count').length, 0);
  const statusBox = tree.find(n => n?.props?.className?.split?.(' ').includes('awr-status-select'));
  assert.ok(statusBox.props.className.split(' ').includes('so-filter-end'), 'dropdown pushed to the right');
  const css = fs.readFileSync(path.join(__dirname, 'self-owner', 'self-owner-rooms.css'), 'utf8');
  assert.match(css, /\.so-filter-end \{[^}]*margin-left: auto/);
  const headers = tree.filter(n => n?.type === 'th').map(h => label(h));
  assert.deepEqual(headers, [so.colRoom, so.colTenant, so.colCurrent, so.colRent, so.colStatus, so.colContracts]);
});

test('web contracts: a room with only a broker appointment and a reservation shows "-" for tenant and rent', () => {
  locale = 'th';
  const only = contracts().filter(c => c.roomId === 'r5' && c.kind !== 'lease');
  const tree = nodes(web('SelfOwnerContractsPage.web.tsx').SelfOwnerContractsPage({ contracts: only, isDemoPreview: true }));
  const cells = nodes(rowOfRoom(tree, 'r5').props.children).filter(n => n?.type === 'td').map(td => label(td));
  assert.equal(cells[1], '-');
  assert.equal(cells[3], '-');
  assert.ok(cells[2].includes(copyOf().selfOwnerContracts.kind.reservation));
});

test('web contracts: the status filter and the search narrow the rooms; no match shows clear filters', () => {
  locale = 'th';
  const ended = roomRows(contractsWeb({ initialFilter: 'ended' }));
  assert.equal(ended.length, 1);
  assert.ok(label(ended[0]).includes('ห้อง 309'));
  const broker = roomRows(contractsWeb({ initialQuery: 'สมชาย' }));
  assert.deepEqual(broker.map(r => r.props['data-testid']), ['self-owner-contracts-table.row.r1']);
  const none = contractsWeb({ initialQuery: 'zzz' });
  assert.equal(roomRows(none).length, 0);
  const states = copyOf().agent.dashboard.webStates;
  assert.ok(texts(none).includes(states.filteredTitle));
  assert.ok(none.some(n => n?.props?.['data-testid'] === 'state.filtered'));
});

test('web room dialog: every contract of the room, newest first', () => {
  locale = 'th';
  const so = copyOf().selfOwnerContracts;
  const tree = roomDialog('r1');
  assert.ok(texts(tree).includes(interpolate(so.roomContractsTitle, { room: 'ห้อง 1204' })));
  const items = tree.filter(n => n?.type === 'button' && String(n.props['data-testid'] ?? '').startsWith('soc-contract-'));
  assert.deepEqual(items.map(b => b.props['data-testid']), ['soc-contract-c-r1', 'soc-contract-c-r1-lease', 'soc-contract-c-r1-reservation', 'soc-contract-c-r1-broker']);
  assert.ok(items.every(b => typeof b.props.onClick === 'function'));
  assert.ok(label(items[0]).includes(so.kind.renewal) && label(items[0]).includes('ณัฐวุฒิ ใจดี'));
  assert.ok(label(items[3]).includes(so.kind.broker_appointment) && label(items[3]).includes('Bangkok Home Agent'));
  assert.equal(tree.filter(n => n?.props?.['data-testid'] === 'soc-back').length, 0, 'no back on the list');
});

test('a used reservation reads "ใช้แล้ว" on web and phone, and the copy exists in every locale', () => {
  locale = 'th';
  const so = copyOf().selfOwnerContracts;
  assert.equal(so.fulfilled, 'ใช้แล้ว');
  for (const l of ['en', 'ja', 'zh']) assert.ok(copyOf(l).selfOwnerContracts.fulfilled, l);
  const pillOf = (tree, testId, key) => nodes(tree.find(n => n?.props?.[key] === testId).props.children).filter(n => n?.type === 'MobileStatusPill').map(p => p.props.label);
  const web = roomDialog('r1');
  assert.deepEqual(pillOf(web, 'soc-contract-c-r1-reservation', 'data-testid'), [so.fulfilled]);
  assert.deepEqual(pillOf(web, 'soc-contract-c-r1-lease', 'data-testid'), [so.status.ended]);
  assert.ok(roomDialog('r1', { initialContractId: 'c-r1-reservation' }).some(n => n?.type === 'MobileStatusPill' && n.props.label === so.fulfilled), 'detail pill');
  const phoneList = phoneRoomList('r1');
  assert.deepEqual(pillOf(phoneList, 'soc-contract-c-r1-reservation', 'testID'), [so.fulfilled]);
});

test('web room dialog: a contract opens its read-only detail with a back button', () => {
  locale = 'th';
  const so = copyOf().selfOwnerContracts;
  const tree = roomDialog('r1', { initialContractId: 'c-r1-broker' });
  const all = texts(tree).join('|');
  for (const value of ['Bangkok Home Agent', 'สมชาย ใจดี', so.commission, so.readOnlyNote, so.kind.broker_appointment]) assert.ok(all.includes(value), value);
  assert.equal(tree.filter(n => String(n?.props?.['data-testid'] ?? '').startsWith('soc-contract-')).length, 0, 'the list is replaced by the detail');
  const back = tree.find(n => n?.type === 'button' && n.props['data-testid'] === 'soc-back');
  assert.equal(typeof back.props.onClick, 'function');
  assert.equal(label(back).includes(so.back), true);
  // The broker appointment has a sample file (Jom 25 Nov 2026), so "view the contract file" opens it.
  const doc = tree.filter(n => n?.type === 'button').find(b => label(b).includes(so.viewDocument));
  assert.equal(doc.props.disabled, false);
  const closeLabel = copyOf().agent.dashboard.webWorkspace.close;
  assert.ok(tree.filter(n => n?.type === 'button' && !n.props.disabled).every(b => b === back || b === doc || b.props['aria-label'] === closeLabel || label(b) === closeLabel));
  const lease = texts(roomDialog('r1', { initialContractId: 'c-r1-lease' })).join('|');
  for (const value of [so.advanceRent, so.deposit, '18,000']) assert.ok(lease.includes(value), value);
  // Layout A: progress bar and money tiles; the renewed contract opens from its row.
  const renewal = roomDialog('r1', { initialContractId: 'c-r1', now });
  assert.equal(renewal.filter(n => n?.props?.className === 'soc-tile').length, 3);
  const bar = renewal.find(n => n?.props?.role === 'progressbar');
  assert.equal(bar.props['aria-valuenow'], 8);
  assert.equal(bar.props['aria-valuemax'], 12);
  assert.ok(texts(renewal).includes(interpolate(so.daysLeft, { n: 127 })));
  const link = renewal.find(n => n?.type === 'button' && n.props['data-testid'] === 'soc-renews-from');
  assert.equal(typeof link.props.onClick, 'function');
  assert.equal(roomDialog('r1', { initialContractId: 'c-r1-lease', now }).filter(n => n?.props?.role === 'progressbar').length, 0);
});

test('web income: this month, summary adds up, arrows plus a month dropdown', () => {
  locale = 'th';
  const inc = copyOf().selfOwnerIncome;
  const tree = incomeWeb();
  const all = texts(tree).join('|');
  assert.ok(all.includes('พฤศจิกายน 2026'));
  const rows = lib().selfOwnerRentForMonth(contracts(), 2026, 11, now);
  const sum = (state) => rows.filter(r => !state || r.state === state).reduce((n, r) => n + r.amount, 0);
  for (const amount of [sum(), sum('paid'), sum('overdue')]) assert.ok(all.includes(`฿${amount.toLocaleString('en-US')}`), String(amount));
  assert.equal(sum(), sum('paid') + sum('overdue') + sum('due'));
  // Jom 24 Nov 2026: previous / next arrows, and the month itself is a dropdown (newest first).
  const select = (t) => t.find(n => n?.type === 'select' && n.props['aria-label'] === inc.month);
  const options = nodes(select(tree).props.children).filter(n => n?.type === 'option');
  assert.equal(options.length, months().length);
  assert.equal(label(options[0]), 'พฤศจิกายน 2026');
  assert.equal(label(options[options.length - 1]), 'เมษายน 2025', 'oldest lease: ห้อง 1204 from Apr 2025');
  assert.equal(select(tree).props.value, options[0].props.value, 'this month selected');
  const nav = (t, name) => t.find(n => n?.type === 'button' && n.props['aria-label'] === name);
  assert.equal(nav(tree, inc.nextMonth).props.disabled, true, 'no month after this one');
  assert.equal(nav(tree, inc.prevMonth).props.disabled, false);
  const first = months()[0];
  const firstTree = incomeWeb({ initialMonth: first });
  assert.equal(select(firstTree).props.value, options[options.length - 1].props.value, 'initial month selected');
  assert.equal(nav(firstTree, inc.prevMonth).props.disabled, true, 'no month before the first');
  assert.equal(nav(firstTree, inc.nextMonth).props.disabled, false);
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

// Plan self-owner-contract-kinds Task 5: room cards; a card opens all the room's contracts, a contract its detail.
const phoneRoom = (roomId, props = {}) =>
  nodes(phone('MobileSelfOwnerContractsScreen.tsx').MobileSelfOwnerRoomContracts({ room: groups().find(g => g.roomId === roomId), all: contracts(), onClose() {}, ...props }));

test('phone contracts: chips count rooms, one card per room with its current contract', () => {
  locale = 'th';
  const so = copyOf().selfOwnerContracts;
  const tree = contractsPhone();
  const chips = byTestId(tree, 'soc-filter-');
  assert.equal(chips.length, 6, 'all, awaiting, processing, ending soon, active, ended');
  assert.ok(texts(nodes(chips[0].props.children)).includes('11'));
  const cards = byTestId(tree, 'soc-card-');
  assert.equal(cards.length, 10, 'ten rooms a page on the phone (11 demo rooms)');
  assert.equal(cards[0].props.testID, 'soc-card-r5');
  const c1204 = cards.find(c => c.props.testID === 'soc-card-r1');
  assert.equal(c1204.props.accessibilityLabel, `${so.viewDetail} ห้อง 1204`);
  assert.equal(typeof c1204.props.onPress, 'function');
  assert.equal(typeof c1204.props.style, 'function', 'card dims while pressed');
  const text = texts(nodes(c1204.props.children)).join('|');
  for (const value of ['ห้อง 1204', so.kind.renewal, interpolate(so.contractCount, { n: 4 }), 'ณัฐวุฒิ ใจดี · Ideo Q สยาม-ราชเทวี']) assert.ok(text.includes(value), value);
  assert.ok(!texts(tree).includes(interpolate(so.count, { n: 11 })), 'no room count under the chips, like the income page');
  assert.deepEqual(byTestId(contractsPhone({ initialQuery: 'สมชาย' }), 'soc-card-').map(c => c.props.testID), ['soc-card-r1']);
});

test('phone room contracts: list newest first, a contract opens its detail with back and close', () => {
  locale = 'th';
  const so = copyOf().selfOwnerContracts;
  const list = phoneRoom('r1');
  assert.ok(texts(list).includes(interpolate(so.roomContractsTitle, { room: 'ห้อง 1204' })));
  const items = byTestId(list, 'soc-contract-');
  assert.deepEqual(items.map(i => i.props.testID), ['soc-contract-c-r1', 'soc-contract-c-r1-lease', 'soc-contract-c-r1-reservation', 'soc-contract-c-r1-broker']);
  assert.ok(items.every(i => typeof i.props.onPress === 'function' && i.props.accessibilityRole === 'button'));
  assert.equal(byTestId(list, 'soc-back').length, 0);
  assert.equal(typeof byTestId(list, 'soc-close')[0].props.onPress, 'function');
  const detail = phoneRoom('r2', { initialContractId: 'c-r2' });
  const all = texts(detail).join('|');
  for (const value of ['Emily Carter', '089-112-3402', so.readOnlyNote, so.advanceRent]) assert.ok(all.includes(value), value);
  assert.equal(byTestId(detail, 'soc-contract-').length, 0);
  assert.equal(typeof byTestId(detail, 'soc-back')[0].props.onPress, 'function');
  assert.equal(byTestId(detail, 'soc-document')[0].props.disabled, true);
  const renewalPhone = phoneRoom('r1', { initialContractId: 'c-r1', now });
  assert.equal(byTestId(renewalPhone, 'soc-tile-').length, 3);
  assert.equal(byTestId(renewalPhone, 'soc-progress').length, 1);
  assert.equal(typeof byTestId(renewalPhone, 'soc-renews-from')[0].props.onPress, 'function');
  const broker = texts(phoneRoom('r5', { initialContractId: 'c-r5-broker' })).join('|');
  for (const value of ['Urban Nest Realty', 'Jenny Lim', '฿30,000']) assert.ok(broker.includes(value), value);
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
  // Jom 24 Nov 2026: previous / next arrows, and the month itself is a select field (bottom sheet), newest first.
  const shallow = (el) => (el == null || typeof el !== 'object' ? [] : Array.isArray(el) ? el.flatMap(shallow) : [el, ...shallow(el.props?.children)]);
  const screen = phone('MobileSelfOwnerIncomeScreen.tsx').MobileSelfOwnerIncomeScreen({ contracts: contracts(), months: months(), isDemoPreview: true, now });
  const field = shallow(screen).find(n => n?.type?.name === 'LeadSelectField');
  assert.ok(field, 'month select field');
  assert.equal(field.props.label, inc.month);
  assert.equal(field.props.options.length, months().length);
  assert.equal(field.props.options[0].label, 'พฤศจิกายน 2026');
  assert.equal(field.props.value, field.props.options[0].value, 'this month selected');
  const nav = (name) => tree.find(n => n?.props?.accessibilityLabel === name && n?.props?.accessibilityRole === 'button');
  assert.equal(nav(inc.nextMonth).props.disabled, true, 'no month after this one');
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

// Jom 25 Nov 2026: the web uses the phone menu's words for these two pages (sidebar and page titles).
test('web page names match the phone menu in every locale', () => {
  for (const l of ['th', 'en', 'ja', 'zh']) {
    const all = load(`${root}/packages/i18n/src/locales/${l}.ts`)[l];
    assert.equal(all.selfOwnerWeb.contracts, all.mobile.drawerMenu.documents, `${l} contracts`);
    assert.equal(all.selfOwnerWeb.billsIncome, all.mobile.drawerMenu.incomeReport, `${l} income`);
  }
  assert.equal(copyOf('th').selfOwnerWeb.contracts, 'เอกสาร');
  assert.equal(copyOf('th').selfOwnerWeb.billsIncome, 'รายงานรายได้');
});

// ---- Pagination (Jom 25 Nov 2026): like "my rooms" — 24 a page on desktop, 10 on the phone ----
const many = (n) => {
  const base = contracts().find(c => c.id === 'c-r3');
  return Array.from({ length: n }, (_, i) => ({ ...base, id: `c-x${i + 1}`, roomId: `x${i + 1}`, roomTitle: `ห้อง X${String(i + 1).padStart(2, '0')}` }));
};
const web_ = (file) => load(path.join(__dirname, 'self-owner', file));
const webCopy = () => copyOf().agent.listings.web;
const pagerButtons = (tree) => byClass(tree, 'awr-page-btn').map(b => b.props['aria-label'] ?? label(b));
const range = (from, to, total) => webCopy().pageRange.replace('{from}', from).replace('{to}', to).replace('{total}', total);

test('web documents: 24 rooms a page with the rooms pager; page 2 holds the rest', () => {
  locale = 'th';
  const web = webCopy();
  const first = nodes(web_('SelfOwnerContractsPage.web.tsx').SelfOwnerContractsPage({ contracts: many(30), isDemoPreview: true }));
  assert.equal(roomRows(first).length, 24);
  assert.ok(texts(first).includes(range('1', '24', '30')));
  assert.deepEqual(pagerButtons(first), [web.prevPage, '1', '2', web.nextPage]);
  assert.equal(byClass(first, 'awr-page-btn')[0].props.disabled, true);
  assert.equal(byClass(first, 'awr-page-btn')[1].props['aria-current'], 'page');
  assert.ok(byClass(first, 'awr-page-btn').every(b => b.props.disabled || typeof b.props.onClick === 'function'));
  const second = nodes(web_('SelfOwnerContractsPage.web.tsx').SelfOwnerContractsPage({ contracts: many(30), isDemoPreview: true, initialPage: 2 }));
  assert.equal(roomRows(second).length, 6);
  assert.ok(texts(second).includes(range('25', '30', '30')));
  assert.equal(byClass(second, 'awr-page-btn').at(-1).props.disabled, true);
  // A filter that leaves fewer pages shows page 1; one page shows the range but no buttons.
  const narrowed = nodes(web_('SelfOwnerContractsPage.web.tsx').SelfOwnerContractsPage({ contracts: [...many(30), ...contracts()], isDemoPreview: true, initialPage: 2, initialFilter: 'ended' }));
  assert.equal(roomRows(narrowed).length, 1);
  assert.equal(pagerButtons(narrowed).length, 0);
  assert.ok(texts(contractsWeb()).includes(range('1', '11', '11')));
});

test('web income: 24 rows a page; the summary still adds up the whole month', () => {
  locale = 'th';
  const list = many(30);
  const page = (props = {}) => nodes(web_('SelfOwnerIncomePage.web.tsx').SelfOwnerIncomePage({ contracts: list, months: lib().selfOwnerIncomeMonths(list, now), isDemoPreview: true, now, ...props }));
  const rowsOfIncome = (t) => t.filter(n => n?.type === 'tr' && String(n.props['data-testid'] ?? '').startsWith('self-owner-income-table.row.'));
  const first = page();
  assert.equal(rowsOfIncome(first).length, 24);
  assert.ok(texts(first).includes(range('1', '24', '30')));
  const all = lib().selfOwnerRentForMonth(list, 2026, 11, now);
  assert.equal(all.length, 30);
  assert.ok(texts(first).includes(`฿${all.reduce((n, r) => n + r.amount, 0).toLocaleString('en-US')}`), 'total of all 30 rows');
  assert.equal(rowsOfIncome(page({ initialPage: 2 })).length, 6);
  assert.equal(pagerButtons(incomeWeb()).length, 0, 'the demo month fits one page');
});

test('phone documents and income: ten a page with previous / next', () => {
  locale = 'th';
  const rooms = copyOf().selfOwnerRooms;
  const docs = contractsPhone({ contracts: many(30) });
  assert.equal(byTestId(docs, 'soc-card-').length, 10);
  assert.equal(byTestId(docs, 'soc-page-prev')[0].props.disabled, true);
  assert.equal(byTestId(docs, 'soc-page-next')[0].props.disabled, false);
  assert.ok(texts(docs).includes(interpolate(rooms.pageOf, { page: 1, pages: 3 })));
  const last = contractsPhone({ contracts: many(30), initialPage: 3 });
  assert.equal(byTestId(last, 'soc-card-').length, 10);
  assert.equal(byTestId(last, 'soc-page-next')[0].props.disabled, true);
  assert.equal(byTestId(contractsPhone({ initialPage: 2 }), 'soc-card-').length, 1, 'demo: 11th room on page 2');
  const list = many(30);
  const income = incomePhone({ contracts: list, months: lib().selfOwnerIncomeMonths(list, now) });
  assert.equal(byTestId(income, 'soi-row-').length, 10);
  assert.ok(texts(income).includes(interpolate(rooms.pageOf, { page: 1, pages: 3 })));
  assert.equal(byTestId(incomePhone(), 'soi-page-').length, 0, 'the demo month fits one page');
});

// ---- Loading and error (Jom 25 Nov 2026): skeletons while loading (shown after a short wait), error + retry ----
const statesOf = (t, id) => t.filter(n => n?.props?.['data-testid'] === id);
const webStates = () => copyOf().agent.dashboard.webStates;

test('web documents: loading shows the table skeleton and no counts; error shows retry', () => {
  locale = 'th';
  const loading = contractsWeb({ contracts: [], status: 'loading' });
  assert.equal(statesOf(loading, 'state.loading').length, 1);
  assert.equal(roomRows(loading).length, 0);
  assert.ok(!texts(loading).some(t => /\d+ ห้อง/.test(t)), 'no room count while loading');
  assert.ok(!texts(loading).includes(copyOf().selfOwnerContracts.empty));
  assert.ok(loading.find(n => n?.props?.['data-testid'] === 'self-owner-contracts-page').props.className.includes('so-skeleton-delay'));
  let retried = 0;
  const failed = contractsWeb({ contracts: [], status: 'error', onRetry: () => { retried += 1; } });
  assert.equal(statesOf(failed, 'state.error').length, 1);
  failed.find(n => n?.type === 'button' && label(n) === webStates().retry).props.onClick();
  assert.equal(retried, 1);
});

test('web income: loading shows skeleton tiles and table, arrows off; error hides the tiles', () => {
  locale = 'th';
  const page = (props) => nodes(web('SelfOwnerIncomePage.web.tsx').SelfOwnerIncomePage({ contracts: [], months: months(), isDemoPreview: true, now, ...props }));
  const loading = page({ status: 'loading' });
  assert.equal(statesOf(loading, 'state.loading').length, 1);
  assert.equal(byClass(loading, 'soi-tile').length, 3);
  assert.ok(byClass(loading, 'soi-tile').every(tile => nodes(tile.props.children).some(n => n?.props?.className === 'awu-skeleton-bar')));
  assert.ok(!texts(loading).some(t => t.startsWith('฿')), 'no amounts while loading');
  assert.ok(byClass(loading, 'soi-month-btn').every(b => b.props.disabled === true));
  const failed = page({ status: 'error', onRetry() {} });
  assert.equal(statesOf(failed, 'state.error').length, 1);
  assert.equal(byClass(failed, 'soi-tile').length, 0);
});

test('phone documents and income: skeleton cards while loading; error text with retry', () => {
  locale = 'th';
  const ws = webStates();
  const docs = contractsPhone({ contracts: [], status: 'loading' });
  assert.equal(docs.filter(n => n?.props?.testID === 'so-skeleton').length, 1);
  assert.equal(byTestId(docs, 'soc-card-').length, 0);
  assert.ok(!texts(docs).includes('0'), 'chips without counts');
  assert.ok(!texts(docs).includes(copyOf().selfOwnerContracts.empty));
  let retried = 0;
  const docsFailed = contractsPhone({ contracts: [], status: 'error', onRetry: () => { retried += 1; } });
  assert.ok(texts(docsFailed).includes(ws.errorTitle));
  byTestId(docsFailed, 'soc-retry')[0].props.onPress();
  assert.equal(retried, 1);
  const income = incomePhone({ contracts: [], status: 'loading' });
  assert.equal(income.filter(n => n?.props?.testID === 'so-skeleton').length, 2, 'summary and list');
  assert.equal(byTestId(income, 'soi-row-').length, 0);
  assert.ok(!texts(income).some(t => t.startsWith('฿')));
  const incomeFailed = incomePhone({ contracts: [], status: 'error', onRetry() {} });
  assert.ok(texts(incomeFailed).includes(ws.errorTitle));
  assert.equal(byTestId(incomeFailed, 'soi-retry').length, 1);
  assert.equal(byTestId(contractsPhone({ contracts: [], status: 'error' }), 'soc-retry').length, 0, 'no retry button without onRetry');
});

test('phone skeleton cards: one labelled block, the asked number of cards', () => {
  locale = 'th';
  const tree = nodes(phone('MobileSkeletonCards.tsx').MobileSkeletonCards({ count: 3 }));
  const root = tree.find(n => n?.props?.testID === 'so-skeleton');
  assert.equal(root.props.accessibilityLabel, copyOf().common.loading);
  assert.equal(byTestId(tree, 'so-skeleton-card').length, 3);
  const css = fs.readFileSync(path.join(__dirname, 'self-owner', 'self-owner-rooms.css'), 'utf8');
  assert.match(css, /\.so-skeleton-delay \.awu-skeleton \{[^}]*animation: so-skeleton-in [^}]*300ms/);
});

// ---- Income status filter (Jom 25 Nov 2026): find the rooms to chase. All / overdue / not due yet / paid, with counts. ----
const incomeRowsOf = (t) => t.filter(n => n?.type === 'tr' && String(n.props['data-testid'] ?? '').startsWith('self-owner-income-table.row.'));

test('income status filter: counts every state; a filter keeps only that state', () => {
  const rows = lib().selfOwnerRentForMonth(contracts(), 2026, 11, now);
  const counts = lib().countSelfOwnerRent(rows);
  assert.deepEqual(lib().SELF_OWNER_RENT_FILTERS, ['all', 'overdue', 'due', 'paid']);
  assert.equal(counts.all, rows.length);
  for (const state of ['paid', 'due', 'overdue']) {
    assert.equal(counts[state], rows.filter(r => r.state === state).length, state);
    assert.deepEqual(lib().filterSelfOwnerRent(rows, state), rows.filter(r => r.state === state), state);
  }
  assert.ok(counts.overdue > 0 && counts.paid > 0, 'demo month has paid and overdue rooms');
  assert.deepEqual(lib().filterSelfOwnerRent(rows, 'all'), rows);
});

test('web income: status dropdown with counts narrows the rows; the summary still adds up the whole month', () => {
  locale = 'th';
  const inc = copyOf().selfOwnerIncome;
  const rooms = copyOf().selfOwnerRooms;
  const rows = lib().selfOwnerRentForMonth(contracts(), 2026, 11, now);
  const counts = lib().countSelfOwnerRent(rows);
  const select = (t) => t.find(n => n?.type === 'select' && n.props['aria-label'] === rooms.filterLabel);
  const optionsOf = (t) => nodes(select(t).props.children).filter(n => n?.type === 'option');
  const tree = incomeWeb();
  assert.equal(select(tree).props.value, 'all');
  assert.deepEqual(optionsOf(tree).map(o => o.props.value), ['all', 'overdue', 'due', 'paid']);
  assert.deepEqual(optionsOf(tree).map(label), [
    `${rooms.filterLabel}: ${rooms.filterAll} (${counts.all})`,
    `${inc.filterOverdue} (${counts.overdue})`,
    `${inc.due} (${counts.due})`,
    `${inc.paid} (${counts.paid})`,
  ]);
  const overdue = incomeWeb({ initialFilter: 'overdue' });
  assert.equal(incomeRowsOf(overdue).length, counts.overdue);
  const total = rows.reduce((n, r) => n + r.amount, 0);
  assert.ok(texts(overdue).includes(`฿${total.toLocaleString('en-US')}`), 'the total tile is the whole month');
  // A month with no row in that state: the filtered empty state with "clear filters", not "no rent this month".
  const none = incomeWeb({ initialMonth: months()[0], initialFilter: 'overdue' });
  assert.equal(incomeRowsOf(none).length, 0);
  assert.ok(none.some(n => n?.props?.['data-testid'] === 'state.filtered'));
  // While loading: no counts, and the dropdown is off.
  const loading = incomeWeb({ status: 'loading' });
  assert.equal(select(loading).props.disabled, true);
  assert.equal(label(optionsOf(loading)[0]), `${rooms.filterLabel}: ${rooms.filterAll}`);
});

test('phone income: status chips with counts narrow the cards; no match shows clear filters', () => {
  locale = 'th';
  const inc = copyOf().selfOwnerIncome;
  const rooms = copyOf().selfOwnerRooms;
  const rows = lib().selfOwnerRentForMonth(contracts(), 2026, 11, now);
  const counts = lib().countSelfOwnerRent(rows);
  const tree = incomePhone();
  const chips = byTestId(tree, 'soi-filter-');
  assert.deepEqual(chips.map(c => c.props.testID), ['soi-filter-all', 'soi-filter-overdue', 'soi-filter-due', 'soi-filter-paid']);
  assert.deepEqual(chips.map(c => c.props.accessibilityState.selected), [true, false, false, false]);
  assert.deepEqual(chips.map(c => texts(nodes(c.props.children))), [
    [rooms.filterAll, String(counts.all)],
    [inc.filterOverdue, String(counts.overdue)],
    [inc.due, String(counts.due)],
    [inc.paid, String(counts.paid)],
  ]);
  const overdue = incomePhone({ initialFilter: 'overdue' });
  assert.equal(byTestId(overdue, 'soi-row-').length, counts.overdue);
  assert.equal(byTestId(overdue, 'soi-filter-overdue')[0].props.accessibilityState.selected, true);
  const none = incomePhone({ initialMonth: months()[0], initialFilter: 'overdue' });
  assert.equal(byTestId(none, 'soi-row-').length, 0);
  assert.ok(texts(none).includes(rooms.noMatch));
  assert.ok(!texts(none).includes(inc.empty));
  assert.equal(byTestId(none, 'soi-clear').length, 1);
  // While loading the chips show no counts.
  assert.deepEqual(byTestId(incomePhone({ status: 'loading' }), 'soi-filter-').map(c => texts(nodes(c.props.children)).length), [1, 1, 1, 1]);
});

test('income filter copy: "overdue" without a day count, in every locale', () => {
  const want = { th: 'เลยกำหนด', en: 'Overdue', ja: '遅延', zh: '逾期' };
  for (const [l, word] of Object.entries(want)) assert.equal(copyOf(l).selfOwnerIncome.filterOverdue, word, l);
});

// ---- Contract signing, demo UI (Jom 25 Nov 2026, option A): plan Project plans/2026-11-25-self-owner-contract-signing.md ----
const today = '2026-11-24';
const byId = (list, id) => list.find(c => c.id === id);

test('signing: who signs each kind; demo awaiting contracts wait only for the owner', () => {
  const l = lib();
  const list = contracts();
  const want = { lease: ['owner', 'tenant'], renewal: ['owner', 'tenant'], broker_appointment: ['owner', 'broker'], reservation: ['owner', 'tenant'] };
  for (const c of list) assert.deepEqual(l.selfOwnerSigners(c), want[c.kind], c.id);
  for (const id of ['c-r5', 'c-r2-renewal']) {
    const c = byId(list, id);
    assert.equal(c.status, 'awaiting_signature', id);
    assert.equal(c.signatures.tenant, '2026-11-23', id);
    assert.equal(c.signatures.owner, undefined, id);
    assert.equal(l.ownerCanSign(c), true, id);
  }
  for (const c of list.filter(c => !['c-r5', 'c-r2-renewal'].includes(c.id))) {
    for (const signer of l.selfOwnerSigners(c)) assert.ok(c.signatures?.[signer], `${c.id} ${signer}`);
    assert.equal(l.ownerCanSign(c), false, c.id);
  }
  assert.match(byId(list, 'c-r1-lease').signatures.owner, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(byId(list, 'c-r1-lease').signatures.owner < byId(list, 'c-r1-lease').startDate, 'signed before the lease starts');
  assert.equal(byId(list, 'c-r1-broker').signatures.broker, byId(list, 'c-r1-broker').startDate);
});

test('signing: the owner signature makes the contract active; apply changes only the signed ones', () => {
  const l = lib();
  const list = contracts();
  const signed = l.signSelfOwnerContract(byId(list, 'c-r2-renewal'), today);
  assert.equal(signed.signatures.owner, today);
  assert.equal(signed.signatures.tenant, '2026-11-23');
  assert.equal(signed.status, 'active');
  assert.equal(l.ownerCanSign(signed), false);
  const applied = l.applySelfOwnerSignatures(list, { 'c-r5': today }, today);
  assert.equal(byId(applied, 'c-r5').status, 'active');
  assert.equal(byId(applied, 'c-r2-renewal').status, 'awaiting_signature');
  assert.equal(applied.filter((c, i) => c !== list[i]).length, 1, 'only c-r5 is a new object');
  const tenantMissing = { ...byId(list, 'c-r5'), signatures: {} };
  const half = l.signSelfOwnerContract(tenantMissing, today);
  assert.equal(half.status, 'awaiting_signature', 'still waits for the tenant');
  assert.equal(l.ownerCanSign(half), false);
});

const SIGN_KEYS = ['signing', 'signerOwner', 'signerBroker', 'signedOn', 'notSigned', 'signAction', 'signHint', 'clearSignature', 'confirmSignature', 'cancelSigning', 'signEmpty', 'waitingOthers', 'demoSignNote'];

test('signing copy in every locale; "view only" note no longer says read only', () => {
  for (const l of ['th', 'en', 'ja', 'zh']) {
    const so = copyOf(l).selfOwnerContracts;
    for (const key of SIGN_KEYS) assert.ok(typeof so[key] === 'string' && so[key].trim(), `${l}.${key}`);
    assert.ok(so.signedOn.includes('{date}'), l);
  }
  const th = copyOf('th').selfOwnerContracts;
  assert.equal(th.signing, 'การลงนาม');
  assert.equal(th.signAction, 'ลงนามสัญญา');
  assert.equal(th.readOnlyNote, 'สัญญาจัดทำโดยทีม NESTYK แก้ไขไม่ได้');
  for (const key of SIGN_KEYS) assert.ok(!/[A-Za-z]{3,}/.test(th[key].replace('NESTYK', '').replace(/\{\w+\}/g, '')), `th.${key} has no English`);
});

test('signing view: one row per signer, signed day or not yet; sign and waiting', () => {
  locale = 'th';
  const so = copyOf().selfOwnerContracts;
  const day = (ymd) => `d:${ymd}`;
  const { contractSigningView } = load(path.join(__dirname, 'self-owner', 'contract-detail-rows.ts'));
  const list = contracts();
  const renewal = contractSigningView(byId(list, 'c-r2-renewal'), so, day);
  assert.deepEqual(renewal.rows.map(r => [r.signer, r.label, r.signed, r.status]), [
    ['owner', so.signerOwner, false, so.notSigned],
    ['tenant', so.tenant, true, interpolate(so.signedOn, { date: 'd:2026-11-23' })],
  ]);
  assert.equal(renewal.rows[1].name, byId(list, 'c-r2-renewal').tenantName);
  assert.equal(renewal.canSign, true);
  assert.equal(renewal.waiting, false);
  const broker = contractSigningView(byId(list, 'c-r1-broker'), so, day);
  assert.deepEqual(broker.rows.map(r => [r.signer, r.label, r.name]), [['owner', so.signerOwner, ''], ['broker', so.signerBroker, 'Bangkok Home Agent']]);
  assert.equal(broker.canSign, false);
  const booking = contractSigningView(byId(list, 'c-r5-reservation'), so, day);
  assert.equal(booking.rows[1].label, so.booker);
  const half = lib().signSelfOwnerContract({ ...byId(list, 'c-r5'), signatures: {} }, today);
  const waiting = contractSigningView(half, so, day);
  assert.equal(waiting.canSign, false);
  assert.equal(waiting.waiting, true);
});

const signingWeb = (props) => nodes(web('SelfOwnerContractSigning.web.tsx').SelfOwnerContractSigning({ day: (d) => d, onStart() {}, ...props }));
const signingPhone = (props) => nodes(phone('MobileSelfOwnerContractSigning.tsx').MobileSelfOwnerContractSigning({ day: (d) => d, onStart() {}, ...props }));
const fmtStub = { money: (n) => `฿${n.toLocaleString('en-US')}`, day: (d) => d };
const flowWeb = (props) => nodes(web('SelfOwnerContractSignFlow.web.tsx').SelfOwnerContractSignFlow({ all: contracts(), fmt: fmtStub, today, onSign() {}, onDone() {}, ...props }));
const flowPhone = (props) => nodes(phone('MobileSelfOwnerContractSignFlow.tsx').MobileSelfOwnerContractSignFlow({ all: contracts(), fmt: fmtStub, today, onSign() {}, onDone() {}, ...props }));
const dataId = (tree, id) => tree.filter(n => n?.props?.['data-testid'] === id);
const tid = (tree, id) => tree.filter(n => n?.props?.testID === id);
const pillLabels = (tree) => tree.filter(n => n?.type === 'MobileStatusPill').map(p => p.props.label);
const signedRoom = (roomId, signedOn) => {
  const list = lib().applySelfOwnerSignatures(contracts(), signedOn, today);
  return { room: lib().groupSelfOwnerContracts(list).find(g => g.roomId === roomId), all: list };
};
const SIGN_FLOW_KEYS = ['signStepReview', 'signStepSign', 'signStep', 'noFileSummary', 'acceptTerms', 'nextStep', 'previousStep', 'signedTitle', 'signedAll', 'backToContract'];

test('sign flow copy (option B) in every locale', () => {
  for (const l of ['th', 'en', 'ja', 'zh']) {
    const so = copyOf(l).selfOwnerContracts;
    for (const key of SIGN_FLOW_KEYS) assert.ok(typeof so[key] === 'string' && so[key].trim(), `${l}.${key}`);
    for (const p of ['{n}', '{total}', '{name}']) assert.ok(so.signStep.includes(p), `${l} signStep ${p}`);
  }
  const th = copyOf('th').selfOwnerContracts;
  assert.equal(th.acceptTerms, 'ฉันอ่านและตรวจสอบรายละเอียดสัญญานี้แล้ว');
  for (const key of SIGN_FLOW_KEYS) assert.ok(!/[A-Za-z]{3,}/.test(th[key].replace(/\{\w+\}/g, '')), `th.${key} has no English`);
});

test('web signing section: one row per signer; the sign button starts the sign page', () => {
  locale = 'th';
  const so = copyOf().selfOwnerContracts;
  const list = contracts();
  let started = 0;
  const tree = signingWeb({ contract: byId(list, 'c-r2-renewal'), onStart: () => { started += 1; } });
  assert.ok(texts(tree).includes(so.signing));
  assert.ok(texts(nodes(dataId(tree, 'soc-signer-tenant')[0].props.children)).includes(interpolate(so.signedOn, { date: '2026-11-23' })));
  dataId(tree, 'soc-sign')[0].props.onClick();
  assert.equal(started, 1);
  assert.equal(tree.filter(n => n?.type === 'ContractSignaturePad').length, 0, 'no pad in the detail any more');
  assert.equal(dataId(signingWeb({ contract: byId(list, 'c-r2') }), 'soc-sign').length, 0);
});

test('web sign page, step 1: the contract summary, then "next" only once the owner ticks that they read it', () => {
  locale = 'th';
  const so = copyOf().selfOwnerContracts;
  // A contract with no file keeps the summary (the demo's two awaiting contracts have sample files).
  const contract = { ...byId(contracts(), 'c-r2-renewal'), id: 'c-r2-nofile' };
  const tree = flowWeb({ contract });
  assert.equal(dataId(tree, 'soc-sign-flow').length, 1);
  for (const text of [interpolate(so.signStep, { n: 1, total: 2, name: so.signStepReview }), so.noFileSummary, so.acceptTerms, '฿25,000', contract.tenantName]) assert.ok(texts(tree).includes(text), text);
  assert.equal(dataId(tree, 'soc-signer-owner').length, 1, 'who signs');
  const box = dataId(tree, 'soc-sign-accept')[0];
  assert.equal(box.props.type, 'checkbox');
  assert.equal(box.props.checked, false);
  assert.equal(dataId(tree, 'soc-sign-next')[0].props.disabled, true);
  assert.equal(tree.filter(n => n?.type === 'ContractSignaturePad').length, 0);
  assert.equal(dataId(flowWeb({ contract, initialAccepted: true }), 'soc-sign-next')[0].props.disabled, false);
  let done = 0;
  dataId(flowWeb({ contract, onDone: () => { done += 1; } }), 'soc-sign-cancel')[0].props.onClick();
  assert.equal(done, 1, 'cancel goes back to the detail');
});

test('web sign page, step 2: the pad signs; an empty pad does not; step 3 says what happened', () => {
  locale = 'th';
  const so = copyOf().selfOwnerContracts;
  const contract = byId(contracts(), 'c-r2-renewal');
  const signed = [];
  const tree = flowWeb({ contract, initialStep: 'sign', initialAccepted: true, onSign: (id) => signed.push(id) });
  for (const text of [interpolate(so.signStep, { n: 2, total: 2, name: so.signStepSign }), so.signHint, so.demoSignNote]) assert.ok(texts(tree).includes(text), text);
  for (const id of ['soc-sign-previous', 'soc-sign-clear', 'soc-sign-confirm']) assert.equal(dataId(tree, id).length, 1, id);
  const pad = tree.find(n => n?.type === 'ContractSignaturePad');
  pad.props.onEmpty();
  assert.deepEqual(signed, []);
  pad.props.onOK('data:image/png;base64,AAAA');
  assert.deepEqual(signed, ['c-r2-renewal']);
  // Step 3 reads the signed contract the page passes back.
  let back = 0;
  const done = flowWeb({ contract: lib().signSelfOwnerContract(contract, today), initialStep: 'done', onDone: () => { back += 1; } });
  for (const text of [so.signedTitle, so.signedAll]) assert.ok(texts(done).includes(text), text);
  dataId(done, 'soc-sign-done')[0].props.onClick();
  assert.equal(back, 1);
  const half = flowWeb({ contract: lib().signSelfOwnerContract({ ...contract, signatures: {} }, today), initialStep: 'done' });
  assert.ok(texts(half).includes(so.waitingOthers));
  // A contract the owner cannot sign never shows the pad, whatever step is asked.
  assert.equal(flowWeb({ contract: byId(contracts(), 'c-r2'), initialStep: 'sign' }).filter(n => n?.type === 'ContractSignaturePad').length, 0);
});

test('web room dialog: the sign page replaces the detail; the page applies a signature of this session', () => {
  locale = 'th';
  const so = copyOf().selfOwnerContracts;
  const flow = roomDialog('r5', { initialContractId: 'c-r5', initialSigning: true, onSign() {} });
  assert.equal(dataId(flow, 'soc-sign-flow').length, 1);
  assert.equal(dataId(flow, 'soc-sign').length, 0, 'not the detail');
  assert.equal(dataId(flow, 'soc-back').length, 1, 'back to the detail');
  const pill = (tree) => nodes(rowOfRoom(tree, 'r5').props.children).filter(n => n?.type === 'MobileStatusPill').map(p => p.props.label);
  assert.ok(pill(contractsWeb()).includes(so.status.awaiting_signature));
  assert.ok(pill(contractsWeb({ initialSignedOn: { 'c-r5': today } })).includes(so.status.active));
  const detail = nodes(web('SelfOwnerContractsPage.web.tsx').SelfOwnerRoomContractsDialog({ ...signedRoom('r5', { 'c-r5': today }), onClose() {}, onSign() {}, initialContractId: 'c-r5' }));
  assert.equal(dataId(detail, 'soc-sign').length, 0);
  assert.ok(texts(nodes(dataId(detail, 'soc-signer-owner')[0].props.children)).some(t => t.startsWith('ลงนามแล้ว')));
  assert.ok(texts(detail).includes(so.readOnlyNote));
});

test('phone: sign button starts the sign page; review, sign and done steps; the page applies it', () => {
  locale = 'th';
  const so = copyOf().selfOwnerContracts;
  const list = contracts();
  const contract = byId(list, 'c-r2-renewal');
  let started = 0;
  const section = signingPhone({ contract, onStart: () => { started += 1; } });
  assert.equal(byTestId(section, 'soc-signer-').length, 2);
  tid(section, 'soc-sign')[0].props.onPress();
  assert.equal(started, 1);
  assert.equal(tid(signingPhone({ contract: byId(list, 'c-r2') }), 'soc-sign').length, 0);
  // The summary step of a contract with no file (the demo's awaiting contracts have sample files).
  const review = flowPhone({ contract: { ...contract, id: 'c-r2-nofile' } });
  for (const text of [interpolate(so.signStep, { n: 1, total: 2, name: so.signStepReview }), so.noFileSummary, so.acceptTerms]) assert.ok(texts(review).includes(text), text);
  const box = tid(review, 'soc-sign-accept')[0];
  assert.equal(box.props.accessibilityRole, 'checkbox');
  assert.equal(box.props.accessibilityState.checked, false);
  assert.equal(tid(review, 'soc-sign-next')[0].props.disabled, true);
  assert.equal(tid(flowPhone({ contract: { ...contract, id: 'c-r2-nofile' }, initialAccepted: true }), 'soc-sign-next')[0].props.disabled, false);
  const signed = [];
  const sign = flowPhone({ contract, initialStep: 'sign', initialAccepted: true, onSign: (id) => signed.push(id) });
  const pad = sign.find(n => n?.type === 'ContractSignaturePad');
  pad.props.onEmpty();
  pad.props.onOK('data:image/png;base64,AAAA');
  assert.deepEqual(signed, ['c-r2-renewal']);
  const done = flowPhone({ contract: lib().signSelfOwnerContract(contract, today), initialStep: 'done' });
  assert.ok(texts(done).includes(so.signedAll));
  assert.equal(tid(done, 'soc-sign-done').length, 1);
  const modal = nodes(phone('MobileSelfOwnerContractsScreen.tsx').MobileSelfOwnerRoomContracts({ room: groups().find(g => g.roomId === 'r5'), all: list, onClose() {}, onSign() {}, initialContractId: 'c-r5', initialSigning: true }));
  assert.equal(tid(modal, 'soc-sign-flow').length, 1);
  assert.ok(texts(modal).includes(so.signAction), 'the header names the step');
  const card = (t) => byTestId(t, 'soc-card-r5')[0];
  assert.ok(pillLabels(nodes(card(contractsPhone()).props.children)).includes(so.status.awaiting_signature));
  assert.ok(pillLabels(nodes(card(contractsPhone({ initialSignedOn: { 'c-r5': today } })).props.children)).includes(so.status.active));
});

// ---- Option B with the contract file (Jom 25 Nov 2026): read the PDF to its last page, then tick, then sign. ----
const pdfLib = () => load(path.join(__dirname, '../lib/self-owner-pdf.ts'));
const docs = () => web('demo-documents.ts');

test('sample contract files: one per demo contract kind, none for the rest', () => {
  const { selfOwnerDocumentOf } = docs();
  assert.deepEqual(['c-r5', 'c-r2-renewal', 'c-r1-broker', 'c-r5-reservation'].map(selfOwnerDocumentOf), ['asset:lease-2101', 'asset:renewal-805', 'asset:broker-1204', 'asset:reservation-2101']);
  assert.equal(selfOwnerDocumentOf('c-r2'), undefined);
  for (const file of ['lease-2101', 'renewal-805', 'broker-1204', 'reservation-2101']) {
    const bytes = fs.readFileSync(path.join(__dirname, '../assets/self-owner-demo', `${file}.pdf`));
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-', file);
  }
});

test('pdf viewer messages (continuous mode): page in view and the end of the document; anything else is ignored', () => {
  const { parsePdfMessage, selfOwnerPdfHtml } = pdfLib();
  assert.deepEqual(parsePdfMessage('pdf-page:3/7'), { type: 'page', page: 3, total: 7 });
  assert.deepEqual(parsePdfMessage('pdf-end'), { type: 'end' });
  assert.deepEqual(parsePdfMessage('pdf-ready'), { type: 'ready' });
  assert.deepEqual(parsePdfMessage('pdf-error'), { type: 'error' });
  for (const junk of ['pdf-page:x/7', 'pdf-page:0/7', 'pdf-page:8/7', 'so-pdf-page:1/1', 3, null, { page: 1 }]) assert.equal(parsePdfMessage(junk), null, String(junk));
  const html = selfOwnerPdfHtml('data:application/pdf;base64,JVBERi0=');
  assert.ok(html.includes('"url":"data:application/pdf;base64,JVBERi0="'), 'the file goes in');
  assert.ok(html.includes('"continuous":true'), 'continuous mode');
  assert.equal(pdfLib().pdfBase64(new Uint8Array([37, 80, 68, 70]).buffer), 'JVBERg==');
});

test('shared pdf viewer: one-page mode unchanged, continuous mode opt-in, both modes in the script', () => {
  const { pdfViewerHtml } = load(path.join(__dirname, '../lib/pdf-viewer/html.ts'));
  const paged = pdfViewerHtml('https://x.test/a.pdf');
  assert.ok(paged.includes('window.__PDF_CONFIG__={"url":"https://x.test/a.pdf"};'), 'agent pages keep the same config');
  assert.ok(pdfViewerHtml('https://x.test/a.pdf', { continuous: true }).includes('{"url":"https://x.test/a.pdf","continuous":true}'));
  const viewer = fs.readFileSync(path.join(__dirname, '../lib/pdf-viewer/viewer.js'), 'utf8');
  assert.match(viewer, /if \(config\.continuous\) \{\s+startContinuous\(/);
  const continuous = fs.readFileSync(path.join(__dirname, '../lib/pdf-viewer/continuous.js'), 'utf8');
  for (const message of ['"pdf-ready"', '"pdf-error"', '"pdf-end"', '`pdf-page:${current}/${total()}`']) assert.ok(continuous.includes(message), message);
});

test('read-to-end copy in every locale', () => {
  for (const l of ['th', 'en', 'ja', 'zh']) {
    const so = copyOf(l).selfOwnerContracts;
    for (const key of ['readToEnd', 'readDone', 'documentLoading', 'documentFailed', 'sampleDocument']) assert.ok(typeof so[key] === 'string' && so[key].trim(), `${l}.${key}`);
  }
  assert.equal(copyOf('th').selfOwnerContracts.readToEnd, 'เลื่อนอ่านจนจบเอกสารก่อน จึงจะติ๊กยอมรับได้');
});

test('web sign page with a file: the PDF instead of the summary; the tick waits for the last page', () => {
  locale = 'th';
  const so = copyOf().selfOwnerContracts;
  const contract = byId(contracts(), 'c-r5');
  const tree = flowWeb({ contract });
  assert.equal(dataId(tree, 'soc-pdf').length, 1, 'the contract file');
  assert.ok(!texts(tree).includes(so.noFileSummary), 'no summary');
  assert.ok(texts(tree).includes(so.readToEnd));
  assert.equal(dataId(tree, 'soc-sign-accept')[0].props.disabled, true);
  assert.equal(dataId(tree, 'soc-sign-next')[0].props.disabled, true);
  const read = flowWeb({ contract, initialReachedEnd: true });
  assert.equal(dataId(read, 'soc-sign-accept')[0].props.disabled, false);
  assert.ok(texts(read).includes(so.readDone));
  // A contract with no file keeps the summary, and the tick works straight away.
  const noFile = flowWeb({ contract: { ...byId(contracts(), 'c-r2-renewal'), id: 'c-x' } });
  assert.equal(dataId(noFile, 'soc-pdf').length, 0);
  assert.ok(texts(noFile).includes(so.noFileSummary));
  assert.equal(dataId(noFile, 'soc-sign-accept')[0].props.disabled, false);
});

test('web detail: "view the contract file" opens the sample file when there is one', () => {
  locale = 'th';
  const so = copyOf().selfOwnerContracts;
  const viewButton = (t) => t.find(n => n?.type === 'button' && n.props['data-testid'] === 'soc-document');
  assert.equal(viewButton(roomDialog('r5', { initialContractId: 'c-r5', onSign() {} })).props.disabled, false);
  assert.equal(viewButton(roomDialog('r2', { initialContractId: 'c-r2', onSign() {} })).props.disabled, true);
  const doc = roomDialog('r5', { initialContractId: 'c-r5', initialView: 'document', onSign() {} });
  assert.equal(dataId(doc, 'soc-pdf').length, 1);
  assert.equal(dataId(doc, 'soc-back').length, 1);
  assert.ok(texts(doc).includes(so.sampleDocument));
});

test('phone sign page with a file, and the detail opens the file', () => {
  locale = 'th';
  const so = copyOf().selfOwnerContracts;
  const contract = byId(contracts(), 'c-r5');
  const tree = flowPhone({ contract });
  assert.equal(tid(tree, 'soc-pdf').length, 1);
  assert.ok(texts(tree).includes(so.readToEnd));
  assert.equal(tid(tree, 'soc-sign-accept')[0].props.disabled, true);
  assert.equal(tid(flowPhone({ contract, initialReachedEnd: true }), 'soc-sign-accept')[0].props.disabled, false);
  const modal = (props) => nodes(phone('MobileSelfOwnerContractsScreen.tsx').MobileSelfOwnerRoomContracts({ room: groups().find(g => g.roomId === 'r5'), all: contracts(), onClose() {}, onSign() {}, initialContractId: 'c-r5', ...props }));
  assert.equal(tid(modal(), 'soc-document')[0].props.disabled, false);
  assert.equal(tid(modal({ initialView: 'document' }), 'soc-pdf').length, 1);
});

// ---- Motion and loading on the sign page (Jom 25 Nov 2026): PDF skeleton, step slides, the "signed" mark. ----
test('step slides: forward from the right, back from the left, nothing on the first show or the same step', () => {
  const { stepSlideDirection } = load(path.join(__dirname, '../lib/tab-transition.ts'));
  assert.equal(stepSlideDirection(null, 1), null);
  assert.equal(stepSlideDirection(1, 1), null);
  assert.equal(stepSlideDirection(0, 1), 'right');
  assert.equal(stepSlideDirection(1, 2), 'right');
  assert.equal(stepSlideDirection(2, 1), 'left');
});

test('pdf skeleton: a page-shaped placeholder until the viewer is ready, web and phone', () => {
  locale = 'th';
  const so = copyOf().selfOwnerContracts;
  const webDoc = nodes(web('SelfOwnerContractDocument.web.tsx').SelfOwnerContractDocument({ load: () => Promise.resolve('asset:lease-2101') }));
  const box = dataId(webDoc, 'soc-pdf')[0];
  assert.equal(box.props['aria-busy'], true);
  const skeleton = dataId(webDoc, 'soc-pdf-skeleton')[0];
  assert.equal(skeleton.props['aria-label'], so.documentLoading);
  assert.ok(webDoc.filter(n => n?.props?.className === 'awu-skeleton-bar').length >= 6, 'text lines');
  assert.ok(!texts(webDoc).includes(so.documentLoading), 'no loading text over the skeleton');
  const phoneDoc = nodes(phone('SelfOwnerContractDocument.tsx').SelfOwnerContractDocument({ load: () => Promise.resolve('asset:lease-2101') }));
  assert.equal(tid(phoneDoc, 'soc-pdf-skeleton').length, 1);
  const css = fs.readFileSync(path.join(__dirname, 'self-owner', 'self-owner-rooms.css'), 'utf8');
  assert.match(css, /\.soc-pdf-skeleton \{[^}]*animation: so-skeleton-in [^}]*300ms/);
  assert.match(css, /\.soc-pdf iframe \{[^}]*opacity: 0/);
  assert.match(css, /\.soc-pdf iframe\.is-ready \{[^}]*opacity: 1/);
});

test('the "signed" mark pops in once (web CSS), and nothing moves with reduced motion', () => {
  const css = fs.readFileSync(path.join(__dirname, 'self-owner', 'self-owner-rooms.css'), 'utf8');
  assert.match(css, /\.soc-sign-done-mark \{[^}]*animation: soc-pop 200ms/);
  assert.match(css, /@keyframes soc-pop/);
  assert.match(css, /prefers-reduced-motion: reduce\)[^@]*\.soc-sign-done-mark[^}]*animation: none/);
  const done = flowWeb({ contract: lib().signSelfOwnerContract(byId(contracts(), 'c-r2-renewal'), today), initialStep: 'done' });
  assert.equal(done.filter(n => n?.props?.className === 'soc-sign-done-mark').length, 1);
});

// ---- Task 6 (plan self-owner-contracts-api): the pages sign and open files for real (web + phone). ----
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const padOf = (tree) => tree.find(n => n?.type === 'ContractSignaturePad');
const signable = () => byId(contracts(), 'c-r2-renewal');
const flows = [
  ['web', (props) => flowWeb(props), (tree, id) => dataId(tree, id), (n) => n.props.onClick, 'disabled'],
  ['phone', (props) => flowPhone(props), (tree, id) => tid(tree, id), (n) => n.props.onPress, 'disabled'],
];

for (const [name, flow, find] of flows) {
  test(`${name} sign success shows done`, async () => {
    locale = 'th';
    const calls = [];
    const tree = flow({ contract: signable(), initialStep: 'sign', initialAccepted: true, isDemoPreview: false, onSign: async (id, png) => { calls.push([id, png]); return { ok: true }; } });
    stateLog.length = 0;
    padOf(tree).props.onOK('data:image/png;base64,AAAA');
    await settle();
    assert.deepEqual(calls, [['c-r2-renewal', 'data:image/png;base64,AAAA']]);
    assert.ok(stateLog.includes('done'), 'goes to the done step');
  });

  test(`${name} sign failure keeps the sign step`, async () => {
    locale = 'th';
    const tree = flow({ contract: signable(), initialStep: 'sign', initialAccepted: true, isDemoPreview: false, onSign: async () => ({ ok: false, message: 'ฝ่ายนี้ลงนามแล้ว' }) });
    stateLog.length = 0;
    padOf(tree).props.onOK('data:image/png;base64,AAAA');
    await settle();
    assert.ok(!stateLog.includes('done'), 'does not say signed');
    assert.ok(stateLog.includes('ฝ่ายนี้ลงนามแล้ว'), 'the error is the API message');
    // A rejected promise is a failure too, with the localized text.
    const thrown = flow({ contract: signable(), initialStep: 'sign', initialAccepted: true, isDemoPreview: false, onSign: async () => { throw new Error('boom'); } });
    stateLog.length = 0;
    padOf(thrown).props.onOK('data:image/png;base64,AAAA');
    await settle();
    assert.ok(!stateLog.includes('done'));
    assert.ok(stateLog.includes(copyOf().selfOwnerContracts.signFailed));
  });

  test(`${name} the error stays on the sign step even when the contract reads signed after a reload`, () => {
    locale = 'th';
    const signed = lib().signSelfOwnerContract(signable(), today);
    const tree = flow({ contract: signed, initialStep: 'sign', initialError: 'ฝ่ายนี้ลงนามแล้ว', isDemoPreview: false });
    assert.ok(padOf(tree), 'the pad is still there');
    assert.ok(texts(tree).includes('ฝ่ายนี้ลงนามแล้ว'));
  });

  test(`${name} confirm is disabled while signing`, async () => {
    locale = 'th';
    const so = copyOf().selfOwnerContracts;
    const calls = [];
    const idle = flow({ contract: signable(), initialStep: 'sign', initialAccepted: true, isDemoPreview: false });
    assert.equal(find(idle, 'soc-sign-confirm')[0].props.disabled ?? false, false);
    const busy = flow({ contract: signable(), initialStep: 'sign', initialAccepted: true, isDemoPreview: false, initialSending: true });
    for (const id of ['soc-sign-confirm', 'soc-sign-previous', 'soc-sign-clear']) assert.equal(find(busy, id)[0].props.disabled, true, id);
    assert.ok(texts(busy).includes(so.signSending), 'shows the sending state');
    // A second tap while the request is out sends nothing more.
    const tree = flow({ contract: signable(), initialStep: 'sign', initialAccepted: true, isDemoPreview: false, onSign: async (id) => { calls.push(id); return { ok: true }; } });
    padOf(tree).props.onOK('data:image/png;base64,AAAA');
    padOf(tree).props.onOK('data:image/png;base64,AAAA');
    await settle();
    assert.equal(calls.length, 1);
  });

  test(`${name} document failure blocks accept`, () => {
    locale = 'th';
    const contract = signable();
    const tree = flow({ contract, isDemoPreview: false, loadDocument: () => Promise.reject(new Error('expired')) });
    assert.equal(find(tree, 'soc-pdf').length, 1, 'the API contract has a file to open');
    assert.equal(find(tree, 'soc-sign-accept')[0].props.disabled ?? find(tree, 'soc-sign-accept')[0].props.accessibilityState?.disabled, true);
    assert.equal(find(tree, 'soc-sign-next')[0].props.disabled, true);
  });

  test(`${name} demo note hidden with the API`, () => {
    locale = 'th';
    const so = copyOf().selfOwnerContracts;
    const api = flow({ contract: signable(), initialStep: 'sign', initialAccepted: true, isDemoPreview: false });
    assert.ok(!texts(api).includes(so.demoSignNote));
    const demo = flow({ contract: signable(), initialStep: 'sign', initialAccepted: true, isDemoPreview: true });
    assert.ok(texts(demo).includes(so.demoSignNote));
    const review = flow({ contract: signable(), isDemoPreview: false, initialReachedEnd: true });
    assert.ok(!texts(review).includes(so.sampleDocument), 'the sample-file note is demo only');
    assert.ok(texts(flow({ contract: byId(contracts(), 'c-r5'), isDemoPreview: true })).includes(so.sampleDocument));
  });
}

test('web and phone: demo note bar hidden with the API', () => {
  locale = 'th';
  assert.equal(contractsWeb({ isDemoPreview: false }).filter(n => n?.props?.role === 'note').length, 0);
  assert.equal(contractsWeb({ isDemoPreview: true }).filter(n => n?.props?.role === 'note').length, 1);
  assert.equal(byTestId(contractsPhone({ isDemoPreview: false }), 'soc-demo').length, 0);
  assert.equal(byTestId(contractsPhone({ isDemoPreview: true }), 'soc-demo').length, 1);
});

test('processing contract has no sign button, shows its badge and the signer list', () => {
  locale = 'th';
  const so = copyOf().selfOwnerContracts;
  const processing = { ...signable(), id: 'c-proc', status: 'processing', signatures: { owner: today, tenant: today } };
  const room = { ...groups().find(g => g.roomId === 'r2'), contracts: [processing], current: processing, status: 'processing' };
  const webTree = nodes(web('SelfOwnerContractsPage.web.tsx').SelfOwnerRoomContractsDialog({ room, all: [processing], onClose() {}, onSign() {}, initialContractId: 'c-proc' }));
  assert.equal(dataId(webTree, 'soc-sign').length, 0);
  assert.equal(dataId(webTree, 'soc-signer-owner').length + dataId(webTree, 'soc-signer-tenant').length, 2);
  assert.ok(webTree.some(n => n?.type === 'MobileStatusPill' && n.props.label === so.status.processing));
  assert.ok(!texts(webTree).includes(so.waitingOthers));
  const phoneTree = nodes(phone('MobileSelfOwnerContractsScreen.tsx').MobileSelfOwnerRoomContracts({ room, all: [processing], onClose() {}, onSign() {}, initialContractId: 'c-proc' }));
  assert.equal(tid(phoneTree, 'soc-sign').length, 0);
  assert.equal(byTestId(phoneTree, 'soc-signer-').length, 2);
  assert.ok(pillLabels(phoneTree).includes(so.status.processing));
});

test('processing filter: a chip on the phone and an option on the web, counted', () => {
  locale = 'th';
  const so = copyOf().selfOwnerContracts;
  const base = contracts();
  const list = base.map(c => (c.id === 'c-r2-renewal' ? { ...c, status: 'processing', signatures: { owner: today, tenant: today } } : c));
  const chips = byTestId(contractsPhone({ contracts: list }), 'soc-filter-');
  assert.deepEqual(chips.map(c => c.props.testID), ['soc-filter-all', 'soc-filter-awaiting_signature', 'soc-filter-processing', 'soc-filter-ending_soon', 'soc-filter-active', 'soc-filter-ended']);
  const select = contractsWeb({ contracts: list }).find(n => n?.props?.['aria-label'] === so.filterLabel && Array.isArray(n.props.children));
  const options = nodes(select.props.children).filter(n => n?.type === 'option').map(o => o.props.value);
  assert.deepEqual(options, ['all', 'awaiting_signature', 'processing', 'ending_soon', 'active', 'ended']);
  const rooms = lib().groupSelfOwnerContracts(list);
  assert.equal(lib().filterSelfOwnerRooms(rooms, '', 'processing').length, rooms.filter(r => r.status === 'processing').length);
});

test('document loading: a rejected load or a failed fetch fails; a retry asks for a fresh URL', async () => {
  const { loadDocumentDataUrl } = pdfLib();
  const realFetch = global.fetch;
  try {
    const urls = [];
    global.fetch = async (url) => { urls.push(url); return url.includes('expired') ? { ok: false, status: 403 } : { ok: true, arrayBuffer: async () => new Uint8Array([37, 80, 68, 70]).buffer }; };
    await assert.rejects(loadDocumentDataUrl(() => Promise.reject(new Error('no url'))));
    await assert.rejects(loadDocumentDataUrl(() => Promise.resolve('https://files.test/expired.pdf')), /403/);
    let asked = 0;
    const load = async () => { asked += 1; return asked === 1 ? 'https://files.test/expired.pdf' : 'https://files.test/fresh.pdf'; };
    await assert.rejects(loadDocumentDataUrl(load));
    assert.equal(await loadDocumentDataUrl(load), 'data:application/pdf;base64,JVBERg==');
    assert.equal(asked, 2, 'the retry called load again');
    assert.equal(urls.at(-1), 'https://files.test/fresh.pdf');
    const before = urls.length;
    assert.equal(await loadDocumentDataUrl(async () => 'data:application/pdf;base64,AAAA'), 'data:application/pdf;base64,AAAA');
    assert.equal(urls.length, before, 'a data URL is not fetched');
  } finally {
    global.fetch = realFetch;
  }
});

test('document viewer: the failed state shows the message and a retry, web and phone', () => {
  locale = 'th';
  const so = copyOf().selfOwnerContracts;
  const retry = copyOf().agent.dashboard.webStates.retry;
  const webDoc = nodes(web('SelfOwnerContractDocument.web.tsx').SelfOwnerContractDocument({ load: () => Promise.reject(new Error('x')), initialFailed: true }));
  assert.ok(texts(webDoc).includes(so.documentFailed));
  assert.ok(webDoc.some(n => n?.type === 'button' && label(n) === retry));
  assert.equal(dataId(webDoc, 'soc-pdf-skeleton').length, 0);
  const phoneDoc = nodes(phone('SelfOwnerContractDocument.tsx').SelfOwnerContractDocument({ load: () => Promise.reject(new Error('x')), initialFailed: true }));
  assert.ok(texts(phoneDoc).includes(so.documentFailed));
  assert.ok(phoneDoc.some(n => n?.props?.accessibilityRole === 'button' && texts(nodes(n.props.children)).includes(retry)));
});

test('signing copy: the sending text exists in every locale', () => {
  for (const l of ['th', 'en', 'ja', 'zh']) assert.ok(copyOf(l).selfOwnerContracts.signSending, l);
});
