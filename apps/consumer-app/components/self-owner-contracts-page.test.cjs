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
    if (name === '@nestyk/ui/native') return { useMobileTheme: () => ({ theme }), MobileIcon: () => null, MobileStatusPill: 'MobileStatusPill', MobileSectionHeader: 'MobileSectionHeader', MobileFilterChip: 'MobileFilterChip', MobileButton: 'MobileButton', MobileInput: 'MobileInput', MobileBottomSheet: 'MobileBottomSheet', SelectionCheck: 'SelectionCheck', tokens: load(`${root}/packages/ui/src/theme/tokens.ts`).tokens };
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
  assert.ok(texts(tree).includes(interpolate(so.count, { n: 11 })));
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
  const doc = tree.filter(n => n?.type === 'button').find(b => label(b).includes(so.viewDocument));
  assert.equal(doc.props.disabled, true);
  const closeLabel = copyOf().agent.dashboard.webWorkspace.close;
  assert.ok(tree.filter(n => n?.type === 'button' && !n.props.disabled).every(b => b === back || b.props['aria-label'] === closeLabel || label(b) === closeLabel));
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
  assert.equal(chips.length, 5);
  assert.ok(texts(nodes(chips[0].props.children)).includes('11'));
  const cards = byTestId(tree, 'soc-card-');
  assert.equal(cards.length, 11);
  assert.equal(cards[0].props.testID, 'soc-card-r5');
  const c1204 = cards.find(c => c.props.testID === 'soc-card-r1');
  assert.equal(c1204.props.accessibilityLabel, `${so.viewDetail} ห้อง 1204`);
  assert.equal(typeof c1204.props.onPress, 'function');
  assert.equal(typeof c1204.props.style, 'function', 'card dims while pressed');
  const text = texts(nodes(c1204.props.children)).join('|');
  for (const value of ['ห้อง 1204', so.kind.renewal, interpolate(so.contractCount, { n: 4 }), 'ณัฐวุฒิ ใจดี · Ideo Q สยาม-ราชเทวี']) assert.ok(text.includes(value), value);
  assert.ok(texts(tree).includes(interpolate(so.count, { n: 11 })));
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
