import type { APIResponse } from '@playwright/test';
import type { AgreementDefaultsKind } from '../../src/api/contracts.api';
import type { AgreementTemplate, AgreementType, AuthUser, Lead, NextDocumentNumber, OwnerUserOption, Paginated } from '../../src/api/types';
import { expect, test, type ApiSession } from '../../src/fixtures/api.fixture';
import { expectError, expectJson } from '../../src/support/http';
import { MAX_PAGE_SIZE, isDescending } from '../../src/support/pagination';

/**
 * สัญญาฝั่งนายหน้า: ประเภทและแม่แบบสัญญา รายการ เลขที่เอกสารถัดไป ข้อมูลตั้งต้น สัญญาที่ไม่มีอยู่ และการค้นบัญชีเจ้าของห้อง
 *
 * สิ่งที่ต้องมีก่อน
 *   - ล็อกอินแบบนักพัฒนาได้ (ดู auth.spec.ts) ผู้เรียกคือ qa-agent (fixture agent)
 *     เทสการค้นบัญชีเจ้าของห้องใช้ qa-landlord เป็นบัญชีที่ถูกค้น (ข้ามถ้ายังไม่ได้ตั้ง uuid)
 *     ชื่อบทบาท owner เปลี่ยนเป็น landlord ตั้งแต่ develop 84087e2 (supabase/migrations/20261016100000_rename_owner_role_to_landlord.sql)
 *   - ฐานข้อมูลมีประเภทสัญญาและแม่แบบ (ข้อมูลตั้งต้นของทีมอยู่ที่ supabase/seed/masters.sql: master_agreement_types บรรทัด 33-37
 *     และ agreement_templates บรรทัด 44-55 ที่ develop 9644dd9) และ qa-agent มีลีดที่ยังไม่เป็นผู้เช่าอย่างน้อย 1 ราย
 *     ถ้าฐานข้อมูลยังไม่มีประเภท lease_renewal เทส GET /agent/contracts/types และ templates of lease_renewal จะไม่ผ่าน
 *     ถ้าขาด ให้แจ้งทีม ห้ามรัน db:seed กับฐานข้อมูลของทีม (ดูข้อห้ามใน README)
 *   - API รุ่น DEV/main f7d52ed ขึ้นไป และฐานข้อมูลขึ้น supabase/migrations/20261014120000_contract_closure.sql แล้ว
 *     เพราะ API อ่านคอลัมน์ leads.booking_released_at ที่ไฟล์นี้เพิ่ม (บรรทัด 5 ; lead.entity.ts:35 ที่ 9644dd9)
 *     migration ของระบบเก่าใน apps/api/migrations/ ห้ามรัน (ดู README)
 *   - เทสของเส้นทางใหม่ (GET :id/signatures, POST :id/deposit-invoice, POST :id/witness-sign) ต้องใช้ API ตั้งแต่ develop b228ee3
 *     และฐานข้อมูลขึ้น supabase/migrations/20261021120000 กับ 20261021130000 แล้ว กับ API รุ่นก่อน เทสเหล่านี้ได้ "Cannot ..." ของ NestJS
 *   - เทสของเส้นทางที่เพิ่มใน develop 9644dd9 (early-end, not-renewing, handover/move-out, deposit-settlement) ต้องใช้ API ตั้งแต่ 9644dd9
 *     กับ API รุ่นก่อนจะได้ "Cannot ..." ของ NestJS แทน "ไม่พบสัญญา" ไม่ต้องใช้ migration ของ 9644dd9 (20261027160000, 20261028100000)
 *     เพราะทุกข้อหยุดที่การหาสัญญา ซึ่งไม่อ่านตารางที่ 2 migration นี้แก้ (จากโค้ด)
 *   - ถ้า qa-agent ยังไม่มีสัญญา ลีดที่จองแล้วและพร้อมทำสัญญา (candidates) ใบแจ้งหนี้ หรือหนังสือยืนยันค่าคอมมิชชั่น
 *     เทสของรายการนั้นตรวจได้แค่ว่าตอบเป็นรายการ (มีป้าย "ไม่ได้ตรวจ" ในรายงาน)
 *
 * เทสไฟล์นี้ไม่สร้างและไม่แก้ข้อมูล
 *   เรียกเส้นทางที่อ่านข้อมูล (GET) กับ POST /auth/sync ด้วยบัญชีที่มีอยู่แล้ว ซึ่งไม่เขียนข้อมูล (sync ใน apps/api/src/auth/auth.service.ts)
 *   POST deposit-invoice กับ witness-sign ถูกเรียกกับสัญญาที่ไม่มีอยู่จริงเท่านั้น ทั้ง 2 เส้นทางหาสัญญาก่อนบันทึก
 *   (issueDepositInvoice และ witnessSign ใน agent-contracts.service.ts)
 *   เส้นทาง POST, PUT และ DELETE 12 เส้นทางของ develop 9644dd9 (ตาราง writes) ถูกเรียกกับสัญญาที่ไม่มีอยู่จริงเท่านั้น
 *   ทุกเส้นทางหาสัญญาก่อนบันทึกและก่อนอ่านไฟล์ บางเส้นทางตรวจเนื้อคำขอก่อนหาสัญญา จึงส่งเนื้อคำขอที่ผ่านการตรวจ (EARLY_END_BODY ถึง APPROVE_BODY)
 *   เส้นทาง next-number ล็อกเลขชั่วคราวระหว่างอ่าน (advisory lock) แต่ไม่จองเลขและไม่เขียนข้อมูล
 */

/** เลขจำนวนเต็มที่มากที่สุดที่คอลัมน์ id (ชนิด integer ของ PostgreSQL) เก็บได้ = 2^31 - 1 */
const INT32_MAX = 2_147_483_647;

/** ข้อความของตัวตรวจ id (DatabaseIdPipe ใน apps/api/src/common/database-id.pipe.ts ตั้งแต่ DEV/main f7d52ed) เมื่อ id ไม่อยู่ในช่วง 1 ถึง 2147483647 */
const ID_OUT_OF_RANGE = 'ID must be an integer between 1 and 2147483647';

/** id ที่ไม่มีลีด สัญญา หรือใบแจ้งหนี้รายไหนใช้: ใช้ค่าที่มากที่สุดที่ฐานข้อมูลเก็บได้ */
const NO_SUCH_ID = INT32_MAX;

/**
 * ประเภทสัญญาที่ต้องมี ตามลำดับที่แอปแสดง (sort_order 10, 15, 20, 25)
 * ที่มา: supabase/seed/masters.sql บรรทัด 34-37 ที่ develop 9644dd9 (เดิมสร้างโดย migration ของระบบเก่าใน apps/api/migrations/:
 *   20260911-agreement-types.sql, 20260914-reservation-letter-name.sql, 20260918-broker-appointment-agreement.sql
 *   และ 20261012-lease-renewal-agreement.sql ซึ่ง lease_renewal มีใน DEV/main 793465c เพิ่มหลัง f9b9bea)
 */
const AGREEMENT_TYPES: AgreementType[] = [
  { code: 'reservation', nameTh: 'หนังสือจองห้อง', nameEn: 'Room reservation agreement', icon: 'calendar', formKind: 'reservation' },
  {
    code: 'broker_appointment',
    nameTh: 'สัญญาแต่งตั้งนายหน้า',
    nameEn: 'Broker appointment agreement',
    icon: 'handshake',
    formKind: 'broker_appointment',
  },
  { code: 'lease', nameTh: 'สัญญาเช่า', nameEn: 'Lease agreement', icon: 'key', formKind: 'lease' },
  { code: 'lease_renewal', nameTh: 'หนังสือต่อสัญญาเช่า', nameEn: 'Lease renewal addendum', icon: 'key', formKind: 'renewal' },
];

/** ข้อความที่ API ตอบ ที่มา: agent-contracts.service.ts, agreement-attachments.service.ts และ financial-document.ts */
const MESSAGE = {
  contractNotFound: 'ไม่พบสัญญา',
  typeNotFound: 'ไม่พบประเภทสัญญา',
  noDefaults: 'ไม่พบผู้เช่าสำหรับดึงข้อมูลตั้งต้น',
  invoiceNotFound: 'ไม่พบใบแจ้งหนี้',
  unknownKind: 'ชนิดเอกสารไม่ถูกต้อง',
  witnessNameRequired: 'กรุณาระบุชื่อพยาน',
} as const;

/**
 * ภาพลายเซ็น PNG ขนาด 1x1 จุด (สีน้ำเงินโปร่งครึ่งหนึ่ง) แบบ base64 สำหรับเส้นทางที่ตรวจลายเซ็นก่อนหาสัญญา
 * เกณฑ์ของ API: ขึ้นต้นด้วยลายเซ็นไฟล์ PNG ยาวอย่างน้อย 32 ไบต์ และ sharp อ่านได้ (validateSign ใน agent-contracts.service.ts
 * กับ validateSignaturePng ใน signature-image.ts) ภาพนี้ยาว 70 ไบต์
 */
const SIGNATURE_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/**
 * เนื้อคำขอที่ผ่านการตรวจ ของเส้นทางที่ตรวจเนื้อคำขอก่อนหาสัญญา (develop 9644dd9) ใช้กับสัญญาที่ไม่มีอยู่จริงเท่านั้น
 * ถ้าเนื้อคำขอไม่ผ่าน API ตอบ 400 ก่อน เทสจะไม่ได้ตรวจการหาสัญญา (ที่มาของแต่ละเส้นทางอยู่ที่ตัวเรียกใน contracts.api.ts)
 * วันที่ใช้ 2099-12-31 ซึ่งไม่ก่อนวันนี้ และเป็นวันที่มีจริงในปฏิทิน (isIsoDate ใน apps/api/src/agent/contracts/lease-term.ts:4-9)
 */
/** setEarlyEnd: date ไม่ก่อนวันนี้ตามเวลากรุงเทพ และ reason ไม่ว่าง (agent-contracts.service.ts:2183-2186) */
const EARLY_END_BODY = { date: '2099-12-31', reason: 'e2e' };
/** save ของบันทึกย้ายออก: validateHandover กับ handoverRevision (handover.service.ts:309-310) รายการทรัพย์สินว่างได้ (บรรทัด 86-88) */
const MOVE_OUT_BODY = { handoverDate: '2099-12-31', items: [], revision: 0 };
/** addItem: parseDeduction (deposit-settlement.ts:144) ประเภทต้องเป็น rent, utilities, damage หรือ other (บรรทัด 21) */
const DEDUCTION_BODY = { deductionType: 'other', description: 'e2e', amount: 1 };
/**
 * approve: หมายเหตุกับยอดคืน (deposit-settlement.ts:183-185) ใช้ยอดคืน 1 ไม่ใช้ 0
 * เพราะยอดคืน 0 ทำให้รายการเป็นเสร็จสิ้นทันทีถ้าสัญญามีอยู่จริง (deposit-settlement.ts:204)
 */
const APPROVE_BODY = { note: 'e2e', refundAmount: 1 };

/**
 * บั๊กที่รู้แล้ว (พบที่ develop 9644dd9 ยังไม่ได้แจ้งทีมตอนเขียน): POST early-end กับ POST not-renewing ตอบ 500 แทน 404
 *   ผลรันจริง 29 ต.ค. 2026 13:11 น.: ทั้ง 2 เส้นทางได้ {"statusCode":500,"message":"Internal server error"}
 *   สาเหตุที่น่าจะเป็น (อนุมานจากโค้ดและผลห้องทดลอง ยังไม่ได้ยืนยันจาก log ของ API): setEarlyEnd กับ setNotRenewing หาสัญญาด้วย
 *   findOne ที่ล็อกแถว (pessimistic_write) พร้อม relations (agent-contracts.service.ts:2188-2191 และ 2323-2326)
 *   TypeORM จึงส่ง FOR UPDATE ที่มี LEFT JOIN ซึ่ง PostgreSQL ปฏิเสธ
 *   ด้วย "FOR UPDATE cannot be applied to the nullable side of an outer join" ทดลองซ้ำได้ในห้องทดลองด้วย TypeORM 0.3.31
 *   กับ PostgreSQL 16 (ไม่มี relations หรือระบุ lock.tables แล้วผ่าน) error เกิดที่คำสั่งแรกของ transaction จึงไม่มีอะไรถูกเขียน
 *   เมื่อทีมแก้แล้ว เทส 404 ของ 2 เส้นทางนี้จะแดงเพื่อเตือนให้ลบ knownBug ออก
 */
const KNOWN_BUG_LOCKED_FIND = 'API ตอบ 500 สาเหตุที่น่าจะเป็น (อนุมาน): findOne ล็อกแถวพร้อม relations ทำให้ PostgreSQL ปฏิเสธ FOR UPDATE กับ LEFT JOIN (agent-contracts.service.ts:2191, 2326)';

/** ปี ค.ศ. ตามเวลาประเทศไทย แบบเดียวกับ contractYear ใน agent-contracts.service.ts (ใช้เป็นปีในเลขที่เอกสาร) */
function bangkokYear(date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric' }).format(date));
}

/**
 * บัญชีเจ้าของห้องที่เทสใช้เป็นเป้าการค้น: qa-landlord จาก POST /auth/sync ของบัญชีนั้นเอง พร้อมยืนยันว่ามีบทบาท landlord
 *   (global-setup ยืนยันแล้วว่าบัญชีมีอยู่ sync จึงไม่สร้างผู้ใช้ใหม่) ผู้ค้นยังเป็น qa-agent เพราะเส้นทางค้นรับเฉพาะบทบาท agent
 */
async function landlordAccount(landlord: ApiSession): Promise<AuthUser> {
  const me = await expectJson<AuthUser>(await landlord.auth.sync(), 201);
  expect(me.roles, 'qa-landlord ต้องมีบทบาท landlord (ฐานข้อมูลต้องขึ้น migration rename_owner_role_to_landlord แล้ว)').toContain('landlord');
  // API ตัด % _ และ \ ออกจากคำค้น ถ้าอีเมลมีอักขระเหล่านี้ การค้นด้วยอีเมลจะไม่เจอบัญชีนี้ เทสข้อค้นบัญชีจึงใช้ไม่ได้
  expect(me.email, 'อีเมลของ qa-landlord ต้องไม่มี % _ หรือ \\').not.toMatch(/[%_\\]/);
  return me;
}

test.describe('agreement types and templates', () => {
  test('GET /agent/contracts/types lists the four agreement types in display order', { tag: '@smoke' }, async ({ agent }) => {
    // ขั้นที่ 1: เรียกรายการประเภทสัญญา   ขั้นที่ 2: ต้องตรงกับข้อมูลตั้งต้นของทีม (AGREEMENT_TYPES) ทุกช่อง และเรียงตามลำดับที่แอปแสดง
    expect(await expectJson<AgreementType[]>(await agent.contracts.types(), 200)).toEqual(AGREEMENT_TYPES);
  });

  for (const type of AGREEMENT_TYPES) {
    test(`templates of ${type.code} are active templates of that type, newest version first`, async ({ agent }) => {
      // ขั้นที่ 1: เรียกแม่แบบของประเภทนี้
      const templates = await expectJson<AgreementTemplate[]>(await agent.contracts.templates(type.code), 200);
      expect(templates.length, `ประเภท ${type.code} ต้องมีแม่แบบที่ใช้งานอยู่อย่างน้อย 1 แบบ`).toBeGreaterThan(0);

      // ขั้นที่ 2: ทุกแม่แบบต้องเป็นของประเภทนี้ และใช้แบบฟอร์มเดียวกับประเภท
      //   (saveDraft ใน agent-contracts.service.ts ไม่รับแม่แบบที่แบบฟอร์มไม่ตรงกับประเภท)
      //   ไม่ตรวจจำนวนแม่แบบและเลขรุ่น เพราะฐานข้อมูลแต่ละเครื่องอาจได้แม่แบบจากคนละทาง (supabase/seed/masters.sql บรรทัด 44-55
      //   หรือ migration ของระบบเก่าใน apps/api/migrations/ ซึ่งบางไฟล์เพิ่มรุ่นใหม่เฉพาะเมื่อข้อมูลที่มีอยู่เข้าเงื่อนไข
      //   เช่น 20260921-lease-annex-optional.sql) จำนวนในแต่ละเครื่องจึงต่างกันได้
      for (const template of templates) {
        const label = `แม่แบบ id ${template.id}`;
        expect(template.agreementTypeCode, label).toBe(type.code);
        expect(template.formKind, label).toBe(type.formKind);
        expect(Number.isInteger(template.version) && template.version > 0, label).toBe(true);
        expect(template.name.trim().length, label).toBeGreaterThan(0);
        expect(
          template.dataSchema !== null && typeof template.dataSchema === 'object' && !Array.isArray(template.dataSchema),
          `${label}: dataSchema ต้องเป็นวัตถุ`,
        ).toBe(true);
      }

      // ขั้นที่ 3: เรียงจากรุ่นใหม่ไปเก่า
      expect(isDescending(templates.map((template) => template.version))).toBe(true);
    });
  }

  test('answers 404 for an agreement type that does not exist', async ({ agent }) => {
    // ขั้นที่ 1: ขอแม่แบบของประเภทที่ไม่มีจริง   ขั้นที่ 2: ต้องได้ 404 พร้อมข้อความว่าไม่พบประเภทสัญญา
    expect(await expectError(await agent.contracts.templates('e2e-no-such-type'), 404)).toBe(MESSAGE.typeNotFound);
  });
});

test.describe('lists of the agent', () => {
  /** รายการของนายหน้า และช่องที่ใช้เรียง (ทุกรายการเรียงจากมากไปน้อย ตาม orderBy ใน agent-contracts.service.ts) */
  const lists: { name: string; key: 'id' | 'leadId'; call: (agent: ApiSession) => Promise<APIResponse> }[] = [
    { name: 'GET /agent/contracts', key: 'id', call: (agent) => agent.contracts.list() },
    { name: 'GET /agent/contracts/candidates', key: 'leadId', call: (agent) => agent.contracts.candidates() },
    { name: 'GET /agent/contracts/invoices', key: 'id', call: (agent) => agent.contracts.invoices() },
    { name: 'GET /agent/contracts/commission-confirmations', key: 'id', call: (agent) => agent.contracts.commissionConfirmations() },
  ];
  for (const list of lists) {
    test(`${list.name} answers with a list`, async ({ agent }) => {
      // ขั้นที่ 1: เรียกรายการ ต้องตอบ 200 เป็นรายการ
      const items = await expectJson<Record<string, unknown>[]>(await list.call(agent), 200);
      expect(Array.isArray(items)).toBe(true);

      // ขั้นที่ 2: ถ้ามีข้อมูล ทุกรายการต้องมีเลขอ้างอิงเป็นจำนวนเต็มบวก ไม่ซ้ำ และเรียงจากมากไปน้อย
      //   ถ้ายังไม่มีรายการ ขั้นนี้ไม่ได้ตรวจอะไร จึงบันทึกไว้ในรายงาน
      if (items.length === 0) {
        test.info().annotations.push({ type: 'ไม่ได้ตรวจ', description: `${list.name} ยังไม่มีข้อมูล จึงตรวจได้แค่ว่าตอบเป็นรายการ` });
      }
      const keys = items.map((item) => item[list.key] as number);
      expect(keys.every((key) => Number.isInteger(key) && key > 0)).toBe(true);
      expect(new Set(keys).size).toBe(keys.length);
      expect(isDescending(keys)).toBe(true);
    });
  }
});

test.describe('document numbers', () => {
  /** เส้นทางที่บอกเลขที่เอกสารใบถัดไป: รูปแบบเลข = คำนำหน้า + ปี ค.ศ. 4 หลัก + ลำดับ 5 หลัก (formatInvoiceNo และ formatCommissionNo) */
  const series: { name: string; prefix: string; call: (agent: ApiSession) => Promise<APIResponse> }[] = [
    { name: 'invoices/next-number', prefix: 'INV', call: (agent) => agent.contracts.nextInvoiceNumber() },
    { name: 'commission-confirmations/next-number', prefix: 'CCM', call: (agent) => agent.contracts.nextCommissionConfirmationNumber() },
  ];
  for (const number of series) {
    test(`${number.name} gives the next ${number.prefix} number of this year without using it up`, async ({ agent }) => {
      // ขั้นที่ 1: ขอเลขถัดไป 2 ครั้งติดกัน (จดปีตามเวลาไทยก่อนและหลังเรียก เผื่อรันตรงเวลาขึ้นปีใหม่พอดี)
      const yearBefore = bangkokYear();
      const first = await expectJson<NextDocumentNumber>(await number.call(agent), 200);
      const second = await expectJson<NextDocumentNumber>(await number.call(agent), 200);
      const yearAfter = bangkokYear();

      // ขั้นที่ 2: เลขต้องเป็นรูปแบบ คำนำหน้า + ปีปัจจุบัน + ลำดับที่ 1 ขึ้นไป
      const match = new RegExp(`^${number.prefix}(\\d{4})(\\d{5})$`).exec(first.documentNo);
      expect(match, `${first.documentNo} ต้องเป็น ${number.prefix} + ปี 4 หลัก + ลำดับ 5 หลัก`).not.toBeNull();
      expect([yearBefore, yearAfter]).toContain(Number(match![1]));
      expect(Number(match![2])).toBeGreaterThanOrEqual(1);

      // ขั้นที่ 3: การขอดูเลขต้องไม่ใช้เลขนั้นไป ครั้งที่ 2 จึงต้องได้เลขเดิม
      expect(second.documentNo).toBe(first.documentNo);
    });
  }
});

test.describe('defaults for a new agreement', () => {
  const kinds: AgreementDefaultsKind[] = ['reservation', 'broker-appointment', 'lease'];
  for (const kind of kinds) {
    test(`${kind}-defaults answers 404 for a lead that does not exist`, async ({ agent }) => {
      // ขั้นที่ 1: ขอข้อมูลตั้งต้นของลีดที่ไม่มีจริง   ขั้นที่ 2: ต้องได้ 404 (ข้อมูลตั้งต้นดึงจากผู้เช่าของลีด)
      expect(await expectError(await agent.contracts.defaults(kind, NO_SUCH_ID), 404)).toBe(MESSAGE.noDefaults);
    });
  }

  test('reservation-defaults answers 404 for a lead that has not become a tenant', async ({ agent }) => {
    // ขั้นที่ 1: หาลีดที่ยังไม่เป็นผู้เช่า (tenantId เป็น null ในรายการ GET /agent/leads)
    const leads = await expectJson<Paginated<Lead>>(await agent.leads.list({ limit: MAX_PAGE_SIZE }), 200);
    const lead = leads.items.find((item) => item.tenantId === null);
    expect(lead, 'qa-agent ต้องมีลีดที่ยังไม่เป็นผู้เช่าอย่างน้อย 1 ราย ในหน้าแรกของ GET /agent/leads').toBeDefined();

    // ขั้นที่ 2: ลีดมีอยู่จริงแต่ยังไม่มีผู้เช่า จึงไม่มีข้อมูลให้ดึง ต้องได้ 404 ข้อความเดียวกับลีดที่ไม่มีจริง
    expect(await expectError(await agent.contracts.defaults('reservation', lead!.id), 404)).toBe(MESSAGE.noDefaults);
  });

  test('answers 400 for a leadId that is not a whole number', async ({ agent }) => {
    // ขั้นที่ 1: ส่ง leadId ที่เป็นตัวอักษร   ขั้นที่ 2: ต้องได้ 400
    await expectError(await agent.contracts.defaults('reservation', 'abc'), 400);
  });
});

test.describe('a contract that does not exist', () => {
  /** เส้นทางที่ต้องหาสัญญาของนายหน้าก่อนทำอย่างอื่น */
  const lookups: { name: string; call: (agent: ApiSession, id: number) => Promise<APIResponse> }[] = [
    { name: 'GET /agent/contracts/:id', call: (agent, id) => agent.contracts.getById(id) },
    { name: 'GET /agent/contracts/:id/history', call: (agent, id) => agent.contracts.history(id) },
    { name: 'GET /agent/contracts/:id/draft-template', call: (agent, id) => agent.contracts.draftTemplate(id) },
    { name: 'GET /agent/contracts/:id/attachments', call: (agent, id) => agent.contracts.attachments(id) },
    { name: 'GET /agent/contracts/:id/attachments/:documentId/url', call: (agent, id) => agent.contracts.attachmentUrl(id, 1) },
    // เส้นทางใหม่ใน develop b228ee3: หาสัญญาของนายหน้าก่อนอ่านตาราง agreement_signatures (signatureLog ใน agent-contracts.service.ts)
    { name: 'GET /agent/contracts/:id/signatures', call: (agent, id) => agent.contracts.signatures(id) },
    { name: 'GET /agent/contracts/:id/financial-documents/invoice', call: (agent, id) => agent.contracts.financialDocumentDefaults(id, 'invoice') },
    // เส้นทางใหม่ใน develop 9644dd9 อ่านอย่างเดียว หาสัญญาก่อน (ที่มาอยู่ที่ตัวเรียกใน contracts.api.ts)
    { name: 'GET /agent/contracts/:id/early-end/invoice', call: (agent, id) => agent.contracts.earlyEndFile(id, 'invoice') },
    { name: 'GET /agent/contracts/:id/handover/move-out', call: (agent, id) => agent.contracts.moveOutHandover(id) },
    { name: 'GET /agent/contracts/:id/deposit-settlement', call: (agent, id) => agent.contracts.depositSettlement(id) },
  ];
  for (const lookup of lookups) {
    test(`${lookup.name} answers 404 for a contract that does not exist`, async ({ agent }) => {
      // ขั้นที่ 1: ใช้ id ที่ไม่มีสัญญาไหนใช้   ขั้นที่ 2: ต้องได้ 404 พร้อมข้อความว่าไม่พบสัญญา
      expect(await expectError(await lookup.call(agent, NO_SUCH_ID), 404)).toBe(MESSAGE.contractNotFound);
    });
  }

  /**
   * เส้นทางที่บันทึกข้อมูลของ develop 9644dd9: ทุกเส้นทางหาสัญญาของนายหน้าก่อนบันทึก จึงตอบ 404 กับสัญญาที่ไม่มีจริงโดยไม่บันทึกอะไร
   * early-end, PUT handover/move-out, deposit-settlement/items และ deposit-settlement/approve ตรวจเนื้อคำขอก่อนหาสัญญา จึงส่งเนื้อคำขอที่ผ่าน
   * handover/move-out/photos ตรวจแค่ความยาวคำอธิบายรูปก่อนหาสัญญา (handover.service.ts:345-347) เทสไม่ส่งคำอธิบาย
   * เส้นทางที่รับไฟล์ส่งแบบไม่แนบไฟล์ เพราะทุกเส้นทางหาสัญญาก่อนอ่านไฟล์
   */
  const writes: { name: string; call: (agent: ApiSession, id: number) => Promise<APIResponse>; knownBug?: string }[] = [
    {
      name: 'POST /agent/contracts/:id/early-end',
      call: (agent, id) => agent.contracts.earlyEnd(id, EARLY_END_BODY),
      knownBug: KNOWN_BUG_LOCKED_FIND,
    },
    { name: 'POST /agent/contracts/:id/early-end/money', call: (agent, id) => agent.contracts.earlyEndMoney(id, {}) },
    {
      name: 'POST /agent/contracts/:id/early-end/refund-proof without a file',
      call: (agent, id) => agent.contracts.uploadEarlyEndRefundProofWithoutFile(id),
    },
    // { notRenewing: false } = ยกเลิกการบันทึกไม่ต่อ ถ้าสัญญามีอยู่จริงและยังไม่ได้บันทึกไม่ต่อ ระบบไม่เปลี่ยนอะไร (agent-contracts.service.ts:2333)
    {
      name: 'POST /agent/contracts/:id/not-renewing',
      call: (agent, id) => agent.contracts.notRenewing(id, { notRenewing: false }),
      knownBug: KNOWN_BUG_LOCKED_FIND,
    },
    { name: 'PUT /agent/contracts/:id/handover/move-out', call: (agent, id) => agent.contracts.saveMoveOutHandover(id, MOVE_OUT_BODY) },
    {
      name: 'POST /agent/contracts/:id/handover/move-out/photos without a file',
      call: (agent, id) => agent.contracts.uploadMoveOutPhotoWithoutFile(id),
    },
    {
      name: 'DELETE /agent/contracts/:id/handover/move-out/photos/:photoId',
      call: (agent, id) => agent.contracts.removeMoveOutPhoto(id, NO_SUCH_ID),
    },
    { name: 'POST /agent/contracts/:id/deposit-settlement', call: (agent, id) => agent.contracts.openDepositSettlement(id) },
    {
      name: 'POST /agent/contracts/:id/deposit-settlement/items without a file',
      call: (agent, id) => agent.contracts.addDepositDeductionWithoutFile(id, DEDUCTION_BODY),
    },
    {
      name: 'DELETE /agent/contracts/:id/deposit-settlement/items/:itemId',
      call: (agent, id) => agent.contracts.removeDepositDeduction(id, NO_SUCH_ID),
    },
    { name: 'POST /agent/contracts/:id/deposit-settlement/approve', call: (agent, id) => agent.contracts.approveDepositSettlement(id, APPROVE_BODY) },
    {
      name: 'POST /agent/contracts/:id/deposit-settlement/refund without files',
      call: (agent, id) => agent.contracts.completeDepositRefundWithoutFiles(id),
    },
  ];
  for (const write of writes) {
    const tag = write.knownBug ? ['@known-bug'] : [];
    test(`${write.name} answers 404 for a contract that does not exist`, { tag }, async ({ agent }) => {
      // แถวที่มี knownBug: เทสข้อนี้เขียนตามพฤติกรรมที่ถูกต้อง และคาดว่าล้มจนกว่าทีมจะแก้ (ข้อตกลงใน README)
      test.fail(write.knownBug !== undefined, write.knownBug);
      // ขั้นที่ 1: ส่งคำขอไปที่สัญญาที่ไม่มีจริง (เส้นทางที่ตรวจเนื้อคำขอก่อนหาสัญญา ส่งเนื้อคำขอที่ผ่านการตรวจ)
      // ขั้นที่ 2: ต้องได้ 404 ว่าไม่พบสัญญา ระบบหาสัญญาไม่เจอก่อนบันทึก จึงไม่มีอะไรถูกบันทึก
      expect(await expectError(await write.call(agent, NO_SUCH_ID), 404)).toBe(MESSAGE.contractNotFound);
    });
    if (write.knownBug) {
      test(`${write.name} is refused for a contract that does not exist`, async ({ agent }) => {
        // เทสคู่กับข้อ known-bug ด้านบน: test.fail นับความล้มทุกแบบว่าเป็นบั๊กที่รู้แล้ว ถ้า API เปลี่ยนไปตอบ 2xx
        //   ข้อนั้นจะยังผ่าน ข้อนี้จึงตรวจขั้นต่ำที่ต้องจริงเสมอ: คำขอไปที่สัญญาที่ไม่มีจริงต้องถูกปฏิเสธ (ไม่ใช่ 2xx)
        // ขั้นที่ 1: ส่งคำขอเดียวกันไปที่สัญญาที่ไม่มีจริง   ขั้นที่ 2: รหัสตอบกลับต้องตั้งแต่ 400 ขึ้นไป
        const response = await write.call(agent, NO_SUCH_ID);
        expect(response.status(), `${response.url()} ตอบว่า: ${(await response.text()).slice(0, 300)}`).toBeGreaterThanOrEqual(400);
      });
    }
  }

  test('POST /agent/contracts/:id/deposit-invoice answers 404 for a contract that does not exist', async ({ agent }) => {
    // เส้นทางใหม่ใน develop b228ee3 ไม่มีเนื้อคำขอ บรรทัดแรกของ issueDepositInvoice หาสัญญาของนายหน้า จึงตอบ 404 ก่อนสร้างใบแจ้งหนี้
    // ขั้นที่ 1: ขอออกใบแจ้งหนี้เงินประกันของสัญญาที่ไม่มีจริง   ขั้นที่ 2: ต้องได้ 404 ว่าไม่พบสัญญา (ไม่มีอะไรถูกบันทึก)
    expect(await expectError(await agent.contracts.depositInvoice(NO_SUCH_ID), 404)).toBe(MESSAGE.contractNotFound);
  });

  test('POST /agent/contracts/:id/witness-sign checks the witness name before looking up the contract', async ({ agent }) => {
    // witnessSign ตรวจชื่อพยานและลายเซ็นก่อนหาสัญญา (agent-contracts.service.ts) คำขอที่ไม่บอกชื่อจึงได้ 400 แม้สัญญาไม่มีอยู่
    // ขั้นที่ 1: ส่งลายเซ็นที่ถูกต้อง แต่ไม่บอกชื่อพยานและไม่ได้บอกว่านายหน้าเป็นพยานเอง
    const response = await agent.contracts.witnessSign(NO_SUCH_ID, { signaturePng: SIGNATURE_PNG });

    // ขั้นที่ 2: ต้องได้ 400 ขอชื่อพยาน (ไม่ใช่ 404)
    expect(await expectError(response, 400)).toBe(MESSAGE.witnessNameRequired);
  });

  test('POST /agent/contracts/:id/witness-sign answers 404 for a contract that does not exist', async ({ agent }) => {
    // ขั้นที่ 1: ส่งคำขอที่ผ่านการตรวจค่าทั้งหมด (นายหน้าเป็นพยานเอง + ลายเซ็น PNG ที่อ่านได้) ไปที่สัญญาที่ไม่มีจริง
    //   ต้องส่งลายเซ็นที่อ่านได้ เพราะลายเซ็นถูกตรวจก่อนหาสัญญา ถ้าลายเซ็นผิดจะได้ 400 และเทสนี้จะไม่ได้ตรวจการหาสัญญา
    const response = await agent.contracts.witnessSign(NO_SUCH_ID, { asAgent: true, signaturePng: SIGNATURE_PNG });

    // ขั้นที่ 2: ต้องได้ 404 ว่าไม่พบสัญญา ระบบเก็บไฟล์ลายเซ็นหลังหาสัญญาเจอเท่านั้น จึงไม่มีอะไรถูกบันทึก
    expect(await expectError(response, 404)).toBe(MESSAGE.contractNotFound);
  });

  test('financial-documents answers 400 for an unknown kind before looking up the contract', async ({ agent }) => {
    // ขั้นที่ 1: ขอเอกสารชนิดที่ไม่มีจริง ของสัญญาที่ไม่มีจริง
    const response = await agent.contracts.financialDocumentDefaults(NO_SUCH_ID, 'e2e-no-such-kind');

    // ขั้นที่ 2: API ตรวจชนิดก่อนหาสัญญา จึงต้องได้ 400 (ไม่ใช่ 404)
    expect(await expectError(response, 400)).toBe(MESSAGE.unknownKind);
  });

  test('receipt-defaults answers 404 for an invoice that does not exist', async ({ agent }) => {
    // ขั้นที่ 1: ขอข้อมูลตั้งต้นของใบเสร็จ ของใบแจ้งหนี้ที่ไม่มีจริง   ขั้นที่ 2: ต้องได้ 404
    expect(await expectError(await agent.contracts.receiptDefaults(NO_SUCH_ID), 404)).toBe(MESSAGE.invoiceNotFound);
  });

  test('answers 400 for an id that is not a whole number', async ({ agent }) => {
    // ขั้นที่ 1: ส่ง id ที่เป็นตัวอักษร และ id ที่เป็นทศนิยม   ขั้นที่ 2: ต้องได้ 400 ทั้งคู่
    await expectError(await agent.contracts.getById('abc'), 400);
    await expectError(await agent.contracts.getById('1.5'), 400);
  });

  test('answers 400 for an id above the 32-bit integer range', async ({ agent }) => {
    // เดิมเป็นบั๊กที่รู้แล้ว (API ตอบ 500) ทีมแก้แล้วที่ DEV/main f7d52ed: ตัวตรวจ id (DatabaseIdPipe) ปฏิเสธก่อนถึงฐานข้อมูล
    // ขั้นที่ 1: ส่ง id ที่มากกว่าค่าสูงสุดของ integer อยู่ 1   ขั้นที่ 2: ต้องได้ 400 พร้อมข้อความของตัวตรวจ id
    expect(await expectError(await agent.contracts.getById(INT32_MAX + 1), 400)).toBe(ID_OUT_OF_RANGE);
  });
});

test.describe('GET /agent/contracts/owner-users', () => {
  // ข้อควรระวัง: เส้นทางนี้คืนข้อมูลส่วนตัวของเจ้าของห้อง (อีเมล เบอร์โทร เลขบัตร)
  //   เทสจึงตรวจแค่จำนวนกับ id และไม่เทียบทั้งรายการ เพราะถ้าไม่ผ่าน Playwright จะพิมพ์ค่าที่เทียบออกมาในผลรัน
  //   ผู้ค้นคือ qa-agent (fixture agent) บัญชีที่ถูกค้นคือ qa-landlord ซึ่งมีบทบาท landlord ที่เส้นทางนี้ค้น
  //   (agent-contracts.service.ts:2299 ที่ develop 84087e2) ถ้าการตรวจคำค้นของ API หลุด คำตอบจะมีบัญชีนี้ เทสจึงจับได้
  //   การกรองเฉพาะบทบาท landlord ตรวจใน roles.spec.ts (บัญชี QA ที่ไม่มี landlord ต้องค้นไม่เจอ)

  test('answers an empty list when the search is empty or longer than 80 characters', async ({ agent, qa }) => {
    // ทั้งข้อต้องใช้ qa-landlord ไม่ใช่แค่กรณี q ยาว 81 ตัว: กรณีไม่ส่ง q และ q ว่างจับบั๊กได้เฉพาะเมื่อมีบัญชี landlord ในฐานข้อมูล
    //   (ถ้าการตรวจคำค้นว่างหาย คำค้นจะเป็น %% ซึ่งเจอทุกบัญชี landlord) qa-landlord คือบัญชีที่ยืนยันได้ว่ามีบทบาทนี้
    // ขั้นที่ 1: หาอีเมลของ qa-landlord (ข้ามถ้ายังไม่ได้ตั้ง uuid)
    const me = await landlordAccount(await qa('landlord'));

    // ขั้นที่ 2: สร้างคำค้นยาว 81 ตัว จากอีเมลต่อท้ายด้วย _
    //   searchOwnerUsers ใน agent-contracts.service.ts ตรวจความยาวก่อนตัด % _ และ \ ออก
    //   ถ้าการตรวจความยาวหาย คำค้นจะเหลือแค่อีเมลแล้วเจอบัญชีนี้ คำค้นแบบนี้จึงจับได้ (คำค้นธรรมดายาว 81 ตัวไม่เจอใครอยู่แล้ว จึงจับไม่ได้)
    expect(me.email.length, 'อีเมลของ qa-landlord ต้องสั้นกว่า 81 ตัว').toBeLessThan(81);
    const tooLong = me.email + '_'.repeat(81 - me.email.length);

    // ขั้นที่ 3: ไม่ส่ง q, q ว่าง และ q ยาว 81 ตัว ต้องได้รายการว่างทุกแบบ
    const searches: [string, string | undefined][] = [['ไม่ส่ง q', undefined], ['q ว่าง', ''], ['q ยาว 81 ตัว', tooLong]];
    for (const [label, q] of searches) {
      const owners = await expectJson<OwnerUserOption[]>(await agent.contracts.ownerUsers(q), 200);
      expect(owners.length, label).toBe(0);
    }
  });

  test('answers an empty list when nothing matches', async ({ agent }) => {
    // ขั้นที่ 1: ค้นด้วยคำที่ไม่มีบัญชีไหนใช้   ขั้นที่ 2: ต้องได้รายการว่าง
    const owners = await expectJson<OwnerUserOption[]>(await agent.contracts.ownerUsers('e2e-no-such-owner-zz'), 200);
    expect(owners.length).toBe(0);
  });

  test('finds a landlord account by its email', async ({ agent, qa }) => {
    // ขั้นที่ 1: หา id และอีเมลของ qa-landlord (ข้ามถ้ายังไม่ได้ตั้ง uuid)
    const me = await landlordAccount(await qa('landlord'));

    // ขั้นที่ 2: qa-agent ค้นด้วยอีเมลที่ API ตอบมา   ขั้นที่ 3: ต้องเจอบัญชีนี้ ตรวจแค่ id
    const owners = await expectJson<OwnerUserOption[]>(await agent.contracts.ownerUsers(me.email), 200);
    expect(owners.map((owner) => owner.id)).toContain(me.id);
  });

  test('answers 400 when q is sent twice', async ({ agent }) => {
    // เดิมเป็นบั๊กที่รู้แล้ว (API ตอบ 500) ทีมแก้แล้วที่ DEV/main f7d52ed: ตัวตรวจ query (SingleQueryPipe) ปฏิเสธค่าที่ไม่ใช่ข้อความเดี่ยว
    // ขั้นที่ 1: ส่ง q ซ้ำ 2 ครั้งในที่อยู่เดียว (เฟรมเวิร์กจะแปลงค่าเป็นรายการ)
    //   ใช้ตัวส่งคำขอพื้นฐาน (client) แบบเดียวกับเทสเรื่องค่าซ้ำใน agent-listings.spec.ts
    const response = await agent.client.get('agent/contracts/owner-users?q=a&q=b');

    // ขั้นที่ 2: ตรวจรหัสก่อนโดยไม่พิมพ์เนื้อคำตอบ เพราะถ้า API ตอบ 200 เนื้อคำตอบคือข้อมูลส่วนตัวของเจ้าของห้อง
    expect(response.status()).toBe(400);
    // ขั้นที่ 3: เมื่อเป็น 400 แล้ว เนื้อคำตอบเป็นข้อความ error จึงตรวจข้อความได้
    //   (ข้อความจาก apps/api/src/common/single-query.pipe.ts: `${ชื่อพารามิเตอร์} must be a single string`)
    expect(await expectError(response, 400)).toBe('q must be a single string');
  });
});
