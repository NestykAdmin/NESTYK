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
 *   - ล็อกอินแบบนักพัฒนาได้ (ดู auth.spec.ts) บัญชีตัวอย่างมีบทบาท agent และ owner (seed-dev-user.sql)
 *   - ฐานข้อมูลมีประเภทสัญญาและแม่แบบจาก migration ของ apps/api และบัญชีตัวอย่างมีลีดอย่างน้อย 1 ราย
 *   - ข้อมูลตัวอย่างยังไม่มีผู้เช่า สัญญา ใบแจ้งหนี้ และหนังสือยืนยันค่าคอมมิชชั่น เทสของรายการเหล่านี้จึงตรวจได้แค่ว่าตอบเป็นรายการ
 *
 * เทสไฟล์นี้ไม่สร้างและไม่แก้ข้อมูล
 *   เรียกเฉพาะเส้นทางที่อ่านข้อมูล (GET) กับ POST /auth/sync ด้วยบัญชีที่มีอยู่แล้ว ซึ่งไม่เขียนข้อมูล (sync ใน apps/api/src/auth/auth.service.ts)
 *   เส้นทาง next-number ล็อกเลขชั่วคราวระหว่างอ่าน (advisory lock) แต่ไม่จองเลขและไม่เขียนข้อมูล
 */

/** เลขจำนวนเต็มที่มากที่สุดที่คอลัมน์ id (ชนิด integer ของ PostgreSQL) เก็บได้ = 2^31 - 1 */
const INT32_MAX = 2_147_483_647;

/** id ที่ไม่มีลีด สัญญา หรือใบแจ้งหนี้รายไหนใช้: ใช้ค่าที่มากที่สุดที่ฐานข้อมูลเก็บได้ */
const NO_SUCH_ID = INT32_MAX;

/**
 * ประเภทสัญญาที่ต้องมี ตามลำดับที่แอปแสดง (sort_order 10, 15, 20)
 * ที่มา: migration ของ apps/api ได้แก่ 20260911-agreement-types.sql, 20260914-reservation-letter-name.sql และ 20260918-broker-appointment-agreement.sql
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
];

/** ข้อความที่ API ตอบ ที่มา: agent-contracts.service.ts, agreement-attachments.service.ts และ financial-document.ts */
const MESSAGE = {
  contractNotFound: 'ไม่พบสัญญา',
  typeNotFound: 'ไม่พบประเภทสัญญา',
  noDefaults: 'ไม่พบผู้เช่าสำหรับดึงข้อมูลตั้งต้น',
  invoiceNotFound: 'ไม่พบใบแจ้งหนี้',
  unknownKind: 'ชนิดเอกสารไม่ถูกต้อง',
} as const;

/** ปี ค.ศ. ตามเวลาประเทศไทย แบบเดียวกับ contractYear ใน agent-contracts.service.ts (ใช้เป็นปีในเลขที่เอกสาร) */
function bangkokYear(date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric' }).format(date));
}

/** บัญชีตัวอย่างที่ล็อกอินอยู่ (จาก POST /auth/sync) พร้อมยืนยันว่ามีบทบาท owner */
async function signedInOwner(agent: ApiSession): Promise<AuthUser> {
  const me = await expectJson<AuthUser>(await agent.auth.sync(), 201);
  expect(me.roles, 'บัญชีตัวอย่างต้องมีบทบาท owner (seed-dev-user.sql)').toContain('owner');
  // API ตัด % _ และ \ ออกจากคำค้น ถ้าอีเมลมีอักขระเหล่านี้ การค้นด้วยอีเมลจะไม่เจอบัญชีนี้ เทสข้อค้นบัญชีจึงใช้ไม่ได้
  expect(me.email, 'อีเมลของบัญชีตัวอย่างต้องไม่มี % _ หรือ \\').not.toMatch(/[%_\\]/);
  return me;
}

test.describe('agreement types and templates', () => {
  test('GET /agent/contracts/types lists the three agreement types in display order', { tag: '@smoke' }, async ({ agent }) => {
    // ขั้นที่ 1: เรียกรายการประเภทสัญญา   ขั้นที่ 2: ต้องตรงกับประเภทที่ migration สร้างไว้ทุกช่อง และเรียงตามลำดับที่แอปแสดง
    expect(await expectJson<AgreementType[]>(await agent.contracts.types(), 200)).toEqual(AGREEMENT_TYPES);
  });

  for (const type of AGREEMENT_TYPES) {
    test(`templates of ${type.code} are active templates of that type, newest version first`, async ({ agent }) => {
      // ขั้นที่ 1: เรียกแม่แบบของประเภทนี้
      const templates = await expectJson<AgreementTemplate[]>(await agent.contracts.templates(type.code), 200);
      expect(templates.length, `ประเภท ${type.code} ต้องมีแม่แบบที่ใช้งานอยู่อย่างน้อย 1 แบบ`).toBeGreaterThan(0);

      // ขั้นที่ 2: ทุกแม่แบบต้องเป็นของประเภทนี้ และใช้แบบฟอร์มเดียวกับประเภท
      //   (saveDraft ใน agent-contracts.service.ts ไม่รับแม่แบบที่แบบฟอร์มไม่ตรงกับประเภท)
      //   ไม่ตรวจจำนวนแม่แบบและเลขรุ่น เพราะ migration บางไฟล์เพิ่มรุ่นใหม่เฉพาะเมื่อข้อมูลที่มีอยู่เข้าเงื่อนไข
      //   (เช่น 20260921-lease-annex-optional.sql) จำนวนในแต่ละเครื่องจึงต่างกันได้
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
      //   ข้อมูลตัวอย่างตอนนี้ไม่มีรายการเหล่านี้ ขั้นนี้จึงยังไม่ได้ตรวจอะไร และบันทึกไว้ในรายงาน
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
    expect(lead, 'บัญชีตัวอย่างต้องมีลีดที่ยังไม่เป็นผู้เช่าอย่างน้อย 1 ราย').toBeDefined();

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
    {
      name: 'GET /agent/contracts/:id/attachments/broker-appointment/defaults',
      call: (agent, id) => agent.contracts.brokerAppointmentAttachmentDefaults(id),
    },
    { name: 'GET /agent/contracts/:id/financial-documents/invoice', call: (agent, id) => agent.contracts.financialDocumentDefaults(id, 'invoice') },
  ];
  for (const lookup of lookups) {
    test(`${lookup.name} answers 404 for a contract that does not exist`, async ({ agent }) => {
      // ขั้นที่ 1: ใช้ id ที่ไม่มีสัญญาไหนใช้   ขั้นที่ 2: ต้องได้ 404 พร้อมข้อความว่าไม่พบสัญญา
      expect(await expectError(await lookup.call(agent, NO_SUCH_ID), 404)).toBe(MESSAGE.contractNotFound);
    });
  }

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

  test(
    'answers with a client error for an id above the 32-bit integer range',
    {
      tag: '@known-bug',
      annotation: {
        type: 'issue',
        description: 'id ที่เกิน 2147483647 ทำให้ API ตอบ 500 (ฐานข้อมูลแจ้ง out of range for type integer) ควรตอบ 404 หรือ 400',
      },
    },
    async ({ agent }) => {
      // test.fail = บอก Playwright ว่าเทสข้อนี้ "ต้องไม่ผ่าน" ในตอนนี้ เพราะเป็นบั๊กที่รู้แล้วและรอแก้ (คำอธิบายเต็มอยู่ใน agent-listings.spec.ts)
      test.fail(true, 'API ตอบ 500 เมื่อ id เกินช่วงของ integer');

      // ขั้นที่ 1: ส่ง id ที่มากกว่าค่าสูงสุดของ integer อยู่ 1
      const response = await agent.contracts.getById(INT32_MAX + 1);
      // บันทึกรหัสที่ได้จริงลงรายงาน: test.fail นับทุกความล้มเหลวเป็นบั๊กนี้ รหัสนี้ช่วยยืนยันว่ายังล้มเพราะได้ 500
      test.info().annotations.push({ type: 'รหัสที่ได้', description: String(response.status()) });

      // ขั้นที่ 2: ที่ถูกต้องคือปฏิเสธแบบความผิดของผู้เรียก (404 หรือ 400) ไม่ใช่ความผิดของเซิร์ฟเวอร์ (500)
      expect([400, 404]).toContain(response.status());
    },
  );
});

test.describe('GET /agent/contracts/owner-users', () => {
  // ข้อควรระวัง: เส้นทางนี้คืนข้อมูลส่วนตัวของเจ้าของห้อง (อีเมล เบอร์โทร เลขบัตร)
  //   เทสจึงตรวจแค่จำนวนกับ id และไม่เทียบทั้งรายการ เพราะถ้าไม่ผ่าน Playwright จะพิมพ์ค่าที่เทียบออกมาในผลรัน
  //   บัญชีตัวอย่างมีบทบาท owner ถ้าการตรวจคำค้นของ API หลุด คำตอบจะมีบัญชีนี้ เทสจึงจับได้

  test('answers an empty list when the search is empty or longer than 80 characters', async ({ agent }) => {
    // ขั้นที่ 1: หาอีเมลของบัญชีตัวอย่าง (บัญชีนี้มีบทบาท owner)
    const me = await signedInOwner(agent);

    // ขั้นที่ 2: สร้างคำค้นยาว 81 ตัว จากอีเมลต่อท้ายด้วย _
    //   searchOwnerUsers ใน agent-contracts.service.ts ตรวจความยาวก่อนตัด % _ และ \ ออก
    //   ถ้าการตรวจความยาวหาย คำค้นจะเหลือแค่อีเมลแล้วเจอบัญชีนี้ คำค้นแบบนี้จึงจับได้ (คำค้นธรรมดายาว 81 ตัวไม่เจอใครอยู่แล้ว จึงจับไม่ได้)
    expect(me.email.length, 'อีเมลของบัญชีตัวอย่างต้องสั้นกว่า 81 ตัว').toBeLessThan(81);
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

  test('finds the signed-in account by its email', async ({ agent }) => {
    // ขั้นที่ 1: หา id และอีเมลของบัญชีตัวอย่าง (บัญชีนี้มีบทบาท owner)
    const me = await signedInOwner(agent);

    // ขั้นที่ 2: ค้นด้วยอีเมลที่ API ตอบมา   ขั้นที่ 3: ต้องเจอบัญชีนี้ ตรวจแค่ id
    const owners = await expectJson<OwnerUserOption[]>(await agent.contracts.ownerUsers(me.email), 200);
    expect(owners.map((owner) => owner.id)).toContain(me.id);
  });

  test(
    'answers 400 when q is sent twice',
    {
      tag: '@known-bug',
      annotation: {
        type: 'issue',
        description: 'ส่ง q ซ้ำ 2 ครั้ง ทำให้ API ตอบ 500 (searchOwnerUsers เรียก .trim() กับค่าที่กลายเป็นรายการ) ควรตอบ 400 แบบเดียวกับ GET /agent/leads',
      },
    },
    async ({ agent }) => {
      // test.fail: บั๊กที่รู้แล้ว ชุดเดียวกับเรื่องค่าซ้ำของ GET /agent/listings
      test.fail(true, 'API ตอบ 500 เมื่อส่ง q ซ้ำ 2 ครั้ง');

      // ขั้นที่ 1: ส่ง q ซ้ำ 2 ครั้งในที่อยู่เดียว (เฟรมเวิร์กจะแปลงค่าเป็นรายการ)
      //   ใช้ตัวส่งคำขอพื้นฐาน (client) เพราะเป็นคำขอที่ตั้งใจส่งผิดรูปแบบ แบบเดียวกับเทสเรื่องค่าซ้ำใน agent-listings.spec.ts
      const response = await agent.client.get('agent/contracts/owner-users?q=a&q=b');
      test.info().annotations.push({ type: 'รหัสที่ได้', description: String(response.status()) });

      // ขั้นที่ 2: ที่ถูกต้องคือปฏิเสธด้วย 400 ไม่ใช่ 500 (ตรวจแค่รหัส ไม่พิมพ์เนื้อคำตอบ)
      expect(response.status()).toBe(400);
    },
  );
});
