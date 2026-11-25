// Sample contract PDFs for the self owner sign page (Jom 25 Nov 2026, option B, demo data): the API's own form fillers
// (apps/api/src/agent/contracts/*-pdf.ts) fill the four forms from the demo contracts, then every page gets a large
// "ตัวอย่าง" watermark. Run from the repo root: node apps/consumer-app/scripts/build-self-owner-demo-pdfs.cjs
// The demo dates move with the clock, so rerun when the demo month changes. No API, database or network.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PDFDocument, PDFHexString, beginText, endText, popGraphicsState, pushGraphicsState, setFillingRgbColor, setFontAndSize, setGraphicsState, setTextMatrix, showText } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

const root = path.resolve(__dirname, '../../..');
const api = path.join(root, 'apps/api/src/agent/contracts');
const out = path.join(root, 'apps/consumer-app/assets/self-owner-demo');
const cache = new Map();
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const localRequire = (name) => {
    // Only the signature stamping uses sharp; the forms do not.
    if (name === 'sharp') return () => { throw new Error('sharp is not needed for unsigned forms'); };
    if (!name.startsWith('.')) return require(require.resolve(name, { paths: [path.dirname(filename), root] }));
    const base = path.resolve(path.dirname(filename), name);
    return load([base, `${base}.ts`, `${base}.tsx`].find((file) => fs.existsSync(file) && fs.statSync(file).isFile()));
  };
  const source = fs.readFileSync(filename, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', '__dirname', '__filename', code)(localRequire, module, module.exports, path.dirname(filename), filename);
  return module.exports;
}

const lib = load(path.join(root, 'apps/consumer-app/lib/self-owner-contracts.ts'));
const rooms = load(path.join(root, 'apps/consumer-app/lib/self-owner-rooms.ts'));
const now = new Date();
const contracts = lib.createSelfOwnerContractsDemo(now);
const roomOf = (id) => rooms.createSelfOwnerRoomsDemo(now).find((r) => r.id === id);
const byId = (id) => contracts.find((c) => c.id === id);
const today = lib.selfOwnerToday(now);
const amount = (n) => String(Math.round(n));
const split = (name) => { const [f, ...l] = name.split(' '); return [f ?? '', l.join(' ')]; };

// The demo owner and made-up details (no real person, account or ID).
const owner = { name: 'เจ้าของห้อง ตัวอย่าง', id: '1-1111-11111-11-1', address: '99 ถนนตัวอย่าง แขวงตัวอย่าง เขตตัวอย่าง กรุงเทพฯ 10000', phone: '080-000-0000', email: 'owner@example.com' };
const bank = { name: 'ธนาคารตัวอย่าง', account: '000-0-00000-0' };
const docNo = (id) => `DEMO-${id.toUpperCase()}`;
const propertyLine = (c) => `${c.roomTitle} ${c.project}`;

function lease(c) {
  const room = roomOf(c.roomId);
  const [tf, tl] = split(c.tenantName);
  const [of, ol] = split(owner.name);
  return {
    documentNo: docNo(c.id), issueDate: today,
    landlordName: owner.name, landlordFirstName: of, landlordLastName: ol, landlordNationality: 'ไทย', landlordId: owner.id, landlordAddress: owner.address, landlordPhone: owner.phone, landlordEmail: owner.email,
    tenantName: c.tenantName, tenantFirstName: tf, tenantLastName: tl, tenantNationality: 'ไทย', tenantId: '2-2222-22222-22-2', tenantAddress: 'ที่อยู่ตัวอย่างของผู้เช่า', tenantPhone: c.tenantPhone, tenantEmail: 'tenant@example.com',
    propertyType: 'คอนโดมิเนียม', project: c.project, houseNo: c.roomTitle.replace('ห้อง ', ''), propertyAddress: `${c.project} กรุงเทพฯ`, roomType: room.bedrooms ? `${room.bedrooms} ห้องนอน` : 'สตูดิโอ', floor: c.roomTitle.replace(/\D/g, '').slice(0, -2) || '-', area: String(room.sizeSqm),
    termMonths: '12', termFrom: c.startDate, termTo: c.endDate, monthlyRent: amount(c.monthlyRent), monthlyRentWords: '', rentDueDay: '5', graceDay: '5', latePenalty: '500', latePenaltyWords: '',
    bankName: bank.name, accountName: owner.name, accountNo: bank.account, otherPaymentMethod: '',
    advanceMonths: String(c.advanceRentMonths), advanceAmount: amount(c.monthlyRent * c.advanceRentMonths), depositMonths: String(c.depositMonths), depositAmount: amount(c.monthlyRent * c.depositMonths), otherInitialPayment: '', additionalTerms: '', agentContact: '',
    landlordSignName: owner.name, tenantSignName: c.tenantName, witnessSignName: '', landlordSignaturePng: '', tenantSignaturePng: '',
  };
}
function renewal(c) {
  const before = byId(c.renewsContractId);
  return {
    documentNo: docNo(c.id), issueDate: today, landlordName: owner.name, tenantName: c.tenantName, propertyLine: propertyLine(c),
    firstLeaseNo: docNo(before.id), firstLeaseDate: before.startDate, firstLeaseStart: before.startDate, firstLeaseEnd: before.endDate,
    originalLeaseNo: docNo(before.id), originalLeaseDate: before.startDate, originalExpiryDate: before.endDate,
    renewMonths: '12', startDate: c.startDate, endDate: c.endDate, monthlyRent: amount(c.monthlyRent), dueDay: '5', bankAccount: `${bank.name} ${bank.account}`,
    depositCarried: amount(c.monthlyRent * c.depositMonths), additionalChanges: '', landlordSignName: owner.name, tenantSignName: c.tenantName, landlordSignaturePng: '', tenantSignaturePng: '',
  };
}
function broker(c) {
  const [of, ol] = split(owner.name);
  const months = 'months' in c.broker.commission ? c.broker.commission.months : 0;
  return {
    documentNo: docNo(c.id), issueDate: c.startDate, landlordName: owner.name, landlordFirstName: of, landlordLastName: ol, landlordNationality: 'ไทย', landlordId: owner.id, landlordAddress: owner.address, landlordPhone: owner.phone,
    brokerCompany: c.broker.company, brokerContact: c.broker.contact, brokerNationality: 'ไทย', brokerId: '3-3333-33333-33-3', brokerPhone: c.broker.phone, brokerAddress: 'ที่อยู่ตัวอย่างของนายหน้า',
    propertyLine: propertyLine(c), monthlyRent: amount(c.monthlyRent), leaseMonths: '12',
    commissionFee: amount('months' in c.broker.commission ? c.monthlyRent * months : c.broker.commission.amount), commissionMonths: months ? String(months) : '',
    landlordSignName: owner.name, brokerSignName: c.broker.contact, landlordSignaturePng: '', brokerSignaturePng: '',
  };
}
function reservation(c) {
  const room = roomOf(c.roomId);
  const [tf, tl] = split(c.tenantName);
  const [of, ol] = split(owner.name);
  return {
    documentNo: docNo(c.id), issueDate: c.startDate,
    tenantName: c.tenantName, tenantFirstName: tf, tenantLastName: tl, tenantPhone: c.tenantPhone, tenantEmail: 'tenant@example.com', tenantId: '2-2222-22222-22-2', tenantNationality: 'ไทย',
    landlordName: owner.name, landlordFirstName: of, landlordLastName: ol, landlordPhone: owner.phone, landlordEmail: owner.email, landlordId: owner.id, landlordNationality: 'ไทย',
    agentName: '', companyName: '', agentPhone: '',
    project: c.project, address: `${c.project} กรุงเทพฯ`, unitNo: c.roomTitle.replace('ห้อง ', ''), floor: c.roomTitle.replace(/\D/g, '').slice(0, -2) || '-', area: String(room.sizeSqm), beds: String(room.bedrooms), baths: String(Math.max(1, room.bedrooms)),
    termMonths: '12', termFrom: c.reservation.moveInDate, termTo: byId('c-r5')?.endDate ?? '', monthlyRent: amount(c.monthlyRent),
    advanceMonths: String(c.advanceRentMonths), advanceAmount: amount(c.monthlyRent * c.advanceRentMonths), depositMonths: String(c.depositMonths), depositAmount: amount(c.monthlyRent * c.depositMonths),
    reservationPayment: amount(c.reservation.bookingFee), reservationWords: '', applyToAdvance: true, applyToDeposit: false,
    balanceDue: amount(c.monthlyRent * (c.advanceRentMonths + c.depositMonths) - c.reservation.bookingFee), payee: owner.name, paymentMethod: 'transfer', bankAccount: `${bank.name} ${bank.account}`,
    tenantSignName: c.tenantName, landlordSignName: owner.name, agentSignName: '',
  };
}

/** A large diagonal "ตัวอย่าง" on every page, shaped with fontkit like the API's own text. */
async function watermark(bytes) {
  const pdf = await PDFDocument.load(bytes);
  pdf.registerFontkit(fontkit);
  const fontBytes = fs.readFileSync(path.join(api, 'assets/NotoSansThai_400Regular.ttf'));
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const shaping = fontkit.create(fontBytes);
  const text = 'ตัวอย่าง';
  const run = shaping.layout(text);
  const encoded = font.encodeText(text).asString();
  const gs = pdf.context.register(pdf.context.obj({ Type: 'ExtGState', ca: 0.13, CA: 0.13 }));
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    const size = Math.min(width, height) * 0.24;
    const scale = size / shaping.unitsPerEm;
    const textWidth = run.positions.reduce((sum, p) => sum + p.xAdvance, 0) * scale;
    const angle = Math.atan2(height, width);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x0 = width / 2 - (textWidth / 2) * cos + (size * 0.3) * sin;
    const y0 = height / 2 - (textWidth / 2) * sin - (size * 0.3) * cos;
    const fontKey = page.node.newFontDictionary(font.name, font.ref);
    const gsKey = page.node.newExtGState('SoDemoGs', gs);
    page.pushOperators(pushGraphicsState(), setGraphicsState(gsKey), beginText(), setFontAndSize(fontKey, size), setFillingRgbColor(0.75, 0.1, 0.1));
    let dx = 0;
    run.positions.forEach((pos, i) => {
      const gx = (dx + pos.xOffset) * scale;
      const gy = pos.yOffset * scale;
      page.pushOperators(setTextMatrix(cos, sin, -sin, cos, x0 + gx * cos - gy * sin, y0 + gx * sin + gy * cos), showText(PDFHexString.of(encoded.slice(i * 4, i * 4 + 4))));
      dx += pos.xAdvance;
    });
    page.pushOperators(endText(), popGraphicsState());
  }
  return Buffer.from(await pdf.save({ useObjectStreams: true }));
}

(async () => {
  const jobs = [
    ['lease-2101.pdf', () => load(path.join(api, 'lease-agreement-pdf.ts')).createLeaseAgreementPdf(lease(byId('c-r5')))],
    ['renewal-805.pdf', () => load(path.join(api, 'lease-renewal-pdf.ts')).createLeaseRenewalPdf(renewal(byId('c-r2-renewal')))],
    ['broker-1204.pdf', () => load(path.join(api, 'broker-appointment-pdf.ts')).createBrokerAppointmentPdf(broker(byId('c-r1-broker')))],
    ['reservation-2101.pdf', () => load(path.join(api, 'reservation-pdf.ts')).createReservationLetterPdf(reservation(byId('c-r5-reservation')))],
  ];
  for (const [file, make] of jobs) {
    const pdf = await watermark(await make());
    fs.writeFileSync(path.join(out, file), pdf);
    console.log(`${file} ${pdf.length} bytes`);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
