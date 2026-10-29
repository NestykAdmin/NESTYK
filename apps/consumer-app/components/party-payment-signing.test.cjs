const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { contractsTh, fillTemplate, leadFormat } = require('./test-i18n.cjs');

const i18nMock = {
  useLocale: () => ({
    locale: 'th',
    t: {
      common: { fileTooLarge: 'ไฟล์ต้องไม่เกิน {size} MB' },
      contracts: contractsTh,
      mobile: { partyContracts: { bookingPaymentBeforeSigning: 'ทุกฝ่ายลงนามหนังสือจองได้หลังผู้เช่าชำระค่าจอง และเอเจนต์ออกใบเสร็จแล้ว' } },
    },
  }),
  fillTemplate,
  localizedError: (error, fallback) => (error instanceof Error && error.message) || fallback,
};

function harness(contract, checklist = { requirements: [], documents: [], documentTypes: [] }) {
  const states = [], effects = [], buttons = [], cards = {}, calls = [], notices = [];
  let index = 0, first = true;
  const mockedReact = { ...React,
    useState: initial => {
      const i = index++;
      if (!(i in states)) states[i] = initial;
      return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }];
    },
    // Refs keep their value between renders, like React's.
    useRef: initial => { const i = index++; if (!(i in states)) states[i] = { current: initial }; return states[i]; },
    useEffect: fn => { if (first) effects.push(fn); },
  };
  const requireMock = name => {
    if (name === 'react') return mockedReact;
    if (name === 'react-native') return { View: 'section', Text: 'span', ActivityIndicator: () => null, StyleSheet: { create: styles => styles } };
    if (name === 'expo-document-picker') return {};
    if (name === 'expo-image-picker') return {
      requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
      launchImageLibraryAsync: async () => ({ canceled: false, assets: [{ uri: 'file:///slip.jpg', fileName: 'slip.jpg', mimeType: 'image/jpeg', fileSize: 10 }] }),
      UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
    };
    if (name === '@nestyk/ui/native') return {
      useMobileTheme: () => ({ theme: {} }), tokens: { typography: { native: {} }, colors: { brand: { 500: '#f8b615' }, roles: { owner: '#f8b615' } } },
      MobileBottomSheet: ({ visible, children }) => (visible ? React.createElement('section', null, children) : null), MobileIcon: () => null,
      MobileButton: ({ children, disabled, onPress }) => { buttons.push({ label: React.Children.toArray(children).join(''), disabled, onPress }); return React.createElement('button', { disabled }, children); },
    };
    if (name === '../lib/party-contracts-api') return {
      listMyAttachments: async () => checklist,
      uploadMyReservationPaymentSlip: async (id, file) => { calls.push(['reservation', id, file.name]); return contract; },
      uploadMyDepositPaymentSlip: async (id, file) => { calls.push(['deposit', id, file.name]); return contract; },
      openMyFinancialDocument: async (id, kind) => { calls.push(['open', id, kind]); return { url: `https://signed.example/${kind}` }; },
    };
    if (name === '../lib/contract-signing') return load('../lib/contract-signing.ts');
    if (name === '../lib/attachment-review') return load('../lib/attachment-review.ts');
    if (name === '../lib/early-end-slip') return load('../lib/early-end-slip.ts');
    if (name === './RejectedAttachmentsNotice') return { RejectedAttachmentsNotice: ({ items }) => { notices.push(items); return null; } };
    if (name === '@nestyk/i18n') return i18nMock;
    if (name === '../lib/lead-format') return leadFormat;
    // D13: the commission confirmation on a letter (tested in reservation-terms.test.cjs); today is fixed.
    if (name === './ReservationTerms') return { ReservationTerms: (props) => { cards.terms = props; return null; } };
    if (name === '../lib/tenant-detail') return { dateKey: () => '2026-10-14' };
    if (name === './ReservationPaymentCard') return { ReservationPaymentCard: (props) => { cards.reservation = props; return null; } };
    if (name === './DepositPaymentCard') return { DepositPaymentCard: (props) => { cards.deposit = props; return null; } };
    if (name === './HandoverCard') return { HandoverCard: (props) => { if (props.kind !== 'move_out') cards.handover = props; return null; } };
    if (name === './DepositSettlementCard') return { DepositSettlementCard: () => null };
    // D5: a cancelled deal's summary (tested in deal-cancellation-card.test.cjs).
    if (name === './DealCancellationCard') return { DealCancellationSummary: () => null };
    if (name === './TenantContractList') return { TenantContractAttachments: () => null };
    if (name === './ContractDocumentPreview') return { ContractDocumentPreview: () => null };
    if (name === './ContractSignaturePad') return { ContractSignaturePad: () => null };
    throw new Error(`Unexpected dependency: ${name}`);
  };
  function load(filename) {
    const loaded = { exports: {} };
    new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, filename), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText)(requireMock, loaded, loaded.exports);
    return loaded.exports;
  }
  const { PartyContractDetail } = load('PartyContractDetail.tsx');
  const render = () => {
    index = 0; buttons.length = 0;
    const markup = renderToStaticMarkup(React.createElement(PartyContractDetail, { contract, onUpdated() {} }));
    first = false;
    return markup;
  };
  return { render, buttons, cards, calls, notices, ready: async () => { render(); effects.forEach(effect => effect()); await new Promise(resolve => setImmediate(resolve)); } };
}
const booking = { id: 11, formKind: 'reservation', status: 'draft', myParties: ['tenant'], receiptUrl: null, reservationFee: 5000, contractNo: 'RS202600011' };

test('tenant sees why signing is disabled even when their documents are ready', async () => {
  const h = harness({ ...booking, reservationPayment: { status: 'submitted' } });
  await h.ready();
  assert.match(h.render(), /ออกใบเสร็จแล้ว/);
  assert.equal(h.buttons.find(button => button.label === 'ลงนามผู้เช่า').disabled, true);
});

test('D3 (AC-3.6): the tenant and the landlord sign the letter only after the booking receipt', async () => {
  for (const [party, label] of [['tenant', 'ลงนามผู้เช่า'], ['owner', 'ลงนามผู้ให้เช่า']]) {
    const waiting = harness({ ...booking, myParties: [party] });
    await waiting.ready();
    assert.match(waiting.render(), /ออกใบเสร็จแล้ว/, party);
    assert.equal(waiting.buttons.find(button => button.label === label).disabled, true, `${party}: no receipt yet`);
    const paid = harness({ ...booking, myParties: [party], receiptUrl: 'receipt.pdf' });
    await paid.ready();
    assert.doesNotMatch(paid.render(), /ออกใบเสร็จแล้ว/, party);
    assert.equal(paid.buttons.find(button => button.label === label).disabled, false, `${party}: receipt issued`);
  }
});

test('D13: the letter shows its commission confirmation (no due day for the parties); the landlord opens the PDF', async () => {
  const h = harness({ ...booking, myParties: ['owner'], receiptUrl: 'receipt.pdf' });
  await h.ready();
  h.render();
  assert.deepEqual([h.cards.terms.contract.id, h.cards.terms.showDue, h.cards.terms.today], [11, false, '2026-10-14']);
  await h.cards.terms.onOpenCommission('ignored, a fresh link is asked for');
  assert.deepEqual(h.calls.at(-1), ['open', 11, 'commission-confirmation']);
});

const lease = { id: 12, formKind: 'lease', status: 'active', myParties: ['tenant'], contractNo: 'LS202600012', startDate: '2026-11-01', endDate: '2027-10-31',
  depositPayment: { status: 'unpaid', total: 40000, invoiceId: 100, invoiceDocumentNo: 'DEP-LS202600012', dueDate: '2026-11-01', invoiceUrl: 'i.pdf', receiptDocumentNo: null, receiptUrl: null, paymentSlipUrl: null, submittedAt: null } };
/** Press "from photos" in the slip sheet and wait for the picker and the upload (the sheet closes first, 400 ms). */
async function sendSlipFromPhotos(h) {
  h.render();
  const photos = h.buttons.find((button) => button.label === contractsTh.party.fromPhotos);
  assert.ok(photos, 'the slip sheet is open');
  const before = h.calls.length;
  photos.onPress();
  // The sheet closes first and the picker opens 400 ms later: wait for the upload call, up to 5 s.
  for (const started = Date.now(); h.calls.length === before && Date.now() - started < 5000;)
    await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(h.calls.length > before, 'the upload was not called within 5 s');
}

test('D10: on a lease the tenant gets the deposit card, and the slip they pick goes to the deposit', async () => {
  const h = harness(lease);
  await h.ready();
  h.render();
  assert.equal(h.cards.reservation, undefined, 'a lease has no reservation payment card');
  assert.equal(h.cards.deposit.contract, lease);
  // D6: the party side of the handover for this lease.
  assert.deepEqual([h.cards.handover.contractId, h.cards.handover.mode], [12, 'party']);
  h.cards.deposit.onUpload();
  await sendSlipFromPhotos(h);
  assert.deepEqual(h.calls, [['deposit', 12, 'slip.jpg']]);
  await h.cards.deposit.onOpen('deposit-invoice');
  assert.deepEqual(h.calls.at(-1), ['open', 12, 'deposit-invoice']);
});

test('D10: the landlord only views the deposit; the reservation slip still goes to the reservation', async () => {
  const owner = harness({ ...lease, myParties: ['owner'] });
  await owner.ready();
  owner.render();
  assert.equal(owner.cards.deposit.onUpload, undefined);
  const h = harness({ ...booking, reservationPayment: { status: 'unpaid' } });
  await h.ready();
  h.render();
  assert.equal(h.cards.deposit, undefined, 'a reservation has no deposit card');
  assert.equal(h.cards.handover, undefined, 'a reservation has no handover card');
  h.cards.reservation.onUpload();
  await sendSlipFromPhotos(h);
  assert.deepEqual(h.calls, [['reservation', 11, 'slip.jpg']]);
});

test('B3: the party who is about to sign is told which attached documents were rejected', async () => {
  // The tenant's own requirement counts as complete even though its file was rejected (the API decides that).
  const checklist = { requirements: [{ groupKey: 'tenant_id', label: 'บัตรผู้เช่า', subject: 'tenant', documentTypeCodes: ['national_id'], complete: true }],
    documentTypes: [{ code: 'national_id', nameTh: 'สำเนาบัตรประชาชน' }], documents: [
    { id: 1, documentTypeCode: 'national_id', fileName: 'id.jpg', subject: 'tenant', isCurrent: true, reviewStatus: 'rejected', reviewNote: 'ภาพไม่ชัด' },
  ] };
  const h = harness({ ...booking, receiptUrl: 'receipt.pdf' }, checklist);
  await h.ready();
  h.notices.length = 0;
  h.render();
  assert.deepEqual(h.notices.at(-1), [{ name: 'สำเนาบัตรประชาชน', note: 'ภาพไม่ชัด' }]);
  assert.equal(h.buttons.find(button => button.label === 'ลงนามผู้เช่า').disabled, false, 'signing is not blocked');
  // Nothing to sign (already signed): no notice.
  const signed = harness({ ...booking, receiptUrl: 'receipt.pdf', tenantSignedAt: '2026-10-21T03:00:00Z', tenantSignatureUrl: 'x.png' }, checklist);
  await signed.ready();
  signed.notices.length = 0;
  signed.render();
  assert.deepEqual(signed.notices, []);
});
