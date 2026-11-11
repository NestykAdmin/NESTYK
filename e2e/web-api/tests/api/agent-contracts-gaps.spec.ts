import type { APIResponse } from '@playwright/test';
import { expect, test, type ApiSession } from '../../src/fixtures/api.fixture';
import { expectError, expectErrorQuiet, expectJson, expectJsonQuiet } from '../../src/support/http';
import { PNG_BLUE } from '../../src/support/test-images';

/**
 * สัญญาฝั่งนายหน้า: เส้นทางที่ยังไม่มีเทสก่อน 11 พ.ย. 2026 (เคส CGP-001 ถึง CGP-037 ระดับ 1 และ CGP-038 ถึง CGP-044 ระดับ 1 ข)
 *
 * ที่มาของเคส: ไฟล์เรื่อง Claude outputs/topics/contracts-gaps.md หัวข้อ "ระดับ 1: เคสปฏิเสธที่ไม่เขียนข้อมูล"
 *   กับหัวข้อ "ระดับ 1 ข: เคสปฏิเสธกับสัญญาจริงของ qa-agent ที่ไม่เขียนข้อมูล" (Aof อนุมัติ 11 พ.ย. 2026) เลขกฎ R2 ถึง R27 ในคอมเมนต์อ้างไฟล์นั้น
 * เลขบรรทัดในคอมเมนต์เป็นของ apps/api/src ที่ qa/e2e 311ab35 ย่อ:
 *   C = agent/contracts/agent-contracts.controller.ts, S = agent/contracts/agent-contracts.service.ts,
 *   CC = contract-closure.ts, DC = deal-cancellation.ts, HO = handover.service.ts,
 *   AT = agreement-attachments.service.ts, DO = deal-offers.service.ts (โฟลเดอร์ agent/contracts ทั้งหมด)
 *
 * สิ่งที่ต้องมีก่อน
 *   - ล็อกอินแบบนักพัฒนาได้ ผู้เรียกคือ qa-agent (fixture agent)
 *   - API ตั้งแต่ qa/e2e 311ab35 (รุ่นก่อนอาจยังไม่มีบางเส้นทาง จะได้ "Cannot ..." ของ NestJS แทนข้อความที่คาด)
 *   - CGP-001 ต้องมีเหตุผลปิดสัญญาที่ไม่ใช่ของระบบอย่างน้อย 1 รายการในตาราง master_contract_end_reasons ถ้าไม่มี ข้อนี้ไม่ผ่าน
 *     (ผลรัน 11 พ.ย. 2026 กับฐานข้อมูลของทีม: API ตอบรายการที่ไม่ว่าง ถ้าวันหนึ่งได้รายการว่าง ให้ดูก่อนว่าข้อมูลหายหรือตัวกรอง CC:44-45 ผิด)
 *   - CGP-018 ต้องมีตาราง deal_cancellations ในฐานข้อมูล (cancellationOf DC:290-293 อ่านตารางนี้) ถ้ายังไม่มี API จะตอบ 500 และข้อนี้แดง
 *
 *   - CGP-038 ถึง CGP-044 ต้องมีหนังสือจองของ qa-agent ที่มีแม่แบบอย่างน้อย 1 ฉบับ (สถานะใดก็ได้) ถ้าไม่มี 7 ข้อนี้ข้ามพร้อมเหตุผล
 *
 * เทสไฟล์นี้ไม่สร้างและไม่แก้ข้อมูล
 *   CGP-001 ถึง CGP-037: ทุกคำขอส่งไปที่สัญญาหรือข้อเสนอ id ที่ไม่มีอยู่จริง (NO_SUCH_ID) id ย่อย (รูป เอกสาร) ใช้ NO_SUCH_ID หรือค่าที่ตัวตรวจ id ปฏิเสธ (0)
 *   จึงถูกปฏิเสธที่การตรวจเนื้อคำขอหรือการหาสัญญา
 *   ซึ่งอยู่ก่อนคำสั่งเขียนทุกคำสั่ง (บรรทัดที่มาอยู่ในแต่ละเทส และที่ตัวเรียกใน contracts.api.ts กับ deal-offers.api.ts)
 *   ไฟล์ PNG ที่แนบไปกับ cancel-deal และ cancellation/refund อยู่ในหน่วยความจำของ API (FilesInterceptor และ FileInterceptor
 *   ไม่ตั้ง storage C:451-453, 465) และถูกส่งต่อไปที่เก็บไฟล์หลังหาสัญญาเจอเท่านั้น (DC:219-225 ; refund หาการยกเลิกก่อน DC:304-305)
 *   CGP-038 ถึง CGP-044: คำขอส่งไปที่หนังสือจองที่มีอยู่จริงของ qa-agent ทุกคำขอถูกปฏิเสธก่อนคำสั่งเขียนทุกคำสั่ง (บรรทัดที่มาอยู่ในแต่ละเทส)
 *     - CGP-038 ถึง 041 ถูกปฏิเสธเพราะชนิดของสัญญา (หนังสือจอง ไม่ใช่สัญญาเช่าหรือหนังสือต่อสัญญา) ซึ่งไม่เปลี่ยนตลอดอายุสัญญา
 *     - CGP-042, 043 ถูกปฏิเสธเพราะหนังสือจองไม่มียอดเลิกสัญญาก่อนกำหนด (อนุมานจากโค้ด เส้นทางนี้ไม่ตรวจชนิดสัญญา)
 *       ตัวที่กันการเขียนจริงคือการไม่ส่ง submittedAt (assertSameSlip S:211-216)
 *     - CGP-044 ถูกปฏิเสธเพราะ party ผิด (ไม่ขึ้นกับชนิดหรือสถานะของสัญญา) และคำขอไม่มี revision กับลายเซ็น
 *   เนื้อคำขอทุกข้อถูกเลือกให้ยังถูกปฏิเสธด้วยข้ออื่น ถ้าข้อตรวจแรกเปลี่ยนในอนาคต ("กันชั้นที่ 2" ในคอมเมนต์ของแต่ละเทส)
 *   CGP-041 ถึง 043 ล็อกแถวของสัญญา (041 ล็อกลีดกับห้องด้วย) ใน transaction ที่ถูกยกเลิก (CC:69-77, S:2368, S:2386) ไม่มีแถวไหนถูกแก้
 *   แต่ห้ามรันพร้อมกับชุดเขียนข้อมูล (test:write, test:web-ui-write) เพราะสัญญาเป้าอาจเป็นฉบับที่ชุดนั้นกำลังใช้ ฝั่งนั้นจะต้องรอล็อก
 *   ห้ามเพิ่มเคสที่ส่งคำขอซึ่งผ่านการตรวจค่าทั้งหมดไปที่สัญญาจริงในไฟล์นี้ (เช่น cancel-deal CGP-045 ที่ Aof ให้ "ไม่ทำ")
 */

/** เลขจำนวนเต็มที่มากที่สุดที่คอลัมน์ id (integer ของ PostgreSQL) เก็บได้ ใช้เป็น id ที่ไม่มีอะไรใช้ แบบเดียวกับ agent-contracts.spec.ts */
const NO_SUCH_ID = 2_147_483_647;

/** ข้อความของตัวตรวจ id (R2: common/database-id.pipe.ts:3-14) */
const ID_OUT_OF_RANGE = 'ID must be an integer between 1 and 2147483647';

/** ข้อความที่ API ตอบเมื่อหาสัญญาของนายหน้าไม่เจอ (เช่น CC:67, S:2489 และ contractForAgent S:627) */
const CONTRACT_NOT_FOUND = 'ไม่พบสัญญา';

/** ข้อความยาวเกินเพดาน: API ตัดช่องว่างหัวท้ายก่อนนับ (trim) จึงใช้ตัวอักษรที่ไม่ใช่ช่องว่าง */
const tooLong = (limit: number) => 'x'.repeat(limit + 1);

/** เหตุผลปิดสัญญา 1 รายการ ตามรูปที่ contractEndReasons คืน (CC:45-48) */
interface EndReason {
  code: string;
  nameTh: string;
  nameEn: string;
  status: string;
  requiresNote: boolean;
}

/** แถวของเคสที่ส่งคำขอผิดหลายแบบ: tag = เลขเคส, what = คำอธิบายสั้นในชื่อเทส */
interface RejectRow {
  tag: string;
  what: string;
  body: unknown;
  message: string;
}

test.describe('GET /agent/contracts/end-reasons', () => {
  test('lists the reasons for closing a lease without the system reasons', { tag: ['@CGP-001'] }, async ({ agent }) => {
    // R6: อ่านอย่างเดียว คืนเหตุผลที่ active ตัดเหตุผลที่ระบบใช้เอง 4 ตัวออก (CC:38-49)
    // ขั้นที่ 1: ขอรายการเหตุผลปิดสัญญา
    const reasons = await expectJson<EndReason[]>(await agent.contracts.endReasons(), 200);

    // ขั้นที่ 2: ต้องเป็นรายการที่ไม่ว่าง ถ้าว่าง ขั้นที่ 3 และ 4 จะไม่ได้ตรวจอะไร จึงให้ไม่ผ่านตรงนี้
    expect(Array.isArray(reasons)).toBe(true);
    expect(reasons.length, 'ต้องมีเหตุผลปิดสัญญาอย่างน้อย 1 รายการ (ดูสิ่งที่ต้องมีก่อนที่หัวไฟล์)').toBeGreaterThan(0);

    // ขั้นที่ 3: ทุกรายการมีครบ 5 ช่อง status เป็น 1 ใน 3 ค่าที่ตารางยอมรับ
    //   (CHECK ของคอลัมน์ applicable_status ใน entities/master-contract-end-reason.entity.ts:8)
    for (const reason of reasons) {
      expect(typeof reason.code).toBe('string');
      expect(typeof reason.nameTh).toBe('string');
      expect(typeof reason.nameEn).toBe('string');
      expect(['expired', 'terminated', 'cancelled']).toContain(reason.status);
      expect(typeof reason.requiresNote).toBe('boolean');
    }

    // ขั้นที่ 4: ไม่มีเหตุผลที่ระบบใช้เอง draft_cancelled (CC:44), reservation_fulfilled (reservation-fulfilment.ts:8)
    //   deal_cancelled กับ landlord_withdrew (DC:27-30) เพราะเส้นทางปิดสัญญาไม่รับเหตุผลเหล่านี้ (R5)
    const codes = reasons.map((reason) => reason.code);
    for (const system of ['draft_cancelled', 'reservation_fulfilled', 'deal_cancelled', 'landlord_withdrew']) {
      expect(codes).not.toContain(system);
    }
  });
});

test.describe('POST /agent/contracts/:id/close', () => {
  /** R4: validateContractClosure ตรวจตามลำดับนี้ก่อนหาสัญญา (CC:22-36) แต่ละแถวผิดแค่ 1 ช่อง ช่องที่เหลือผ่าน */
  const valid = { endReasonCode: 'term_completed', effectiveEndDate: '2026-01-01' };
  const rows: RejectRow[] = [
    { tag: '@CGP-002', what: 'a body that is not an object', body: [], message: 'กรุณาระบุข้อมูลปิดสัญญา' }, // CC:23-24
    { tag: '@CGP-003', what: 'an extra field', body: { ...valid, extra: 'e2e' }, message: 'ข้อมูลปิดสัญญามีฟิลด์ที่ไม่รองรับ' }, // CC:26-27
    { tag: '@CGP-004', what: 'a reason code with capitals', body: { ...valid, endReasonCode: 'Bad-Code' }, message: 'กรุณาเลือกเหตุผลปิดสัญญา' }, // CC:28-29
    // 30 กุมภาพันธ์ไม่มีจริง isIsoDate ปฏิเสธ (lease-term.ts:4-9)
    {
      tag: '@CGP-005',
      what: 'a date that does not exist',
      body: { ...valid, effectiveEndDate: '2026-02-30' },
      message: 'วันที่สิ้นสุดต้องเป็น ค.ศ. ในรูปแบบ YYYY-MM-DD',
    }, // CC:30-31
    { tag: '@CGP-006', what: 'a note over 1,000 characters', body: { ...valid, note: tooLong(1000) }, message: 'หมายเหตุปิดสัญญาต้องไม่เกิน 1,000 ตัวอักษร' }, // CC:32-33
  ];
  for (const row of rows) {
    test(`answers 400 for ${row.what} before looking up the contract`, { tag: [row.tag] }, async ({ agent }) => {
      // ขั้นที่ 1: ส่งเนื้อคำขอที่ผิด 1 ช่อง ไปที่สัญญาที่ไม่มีจริง
      // ขั้นที่ 2: ต้องได้ 400 พร้อมข้อความของช่องนั้น (ไม่ใช่ 404 เพราะตรวจเนื้อคำขอก่อนหาสัญญา CC:65-67)
      expect(await expectError(await agent.contracts.close(NO_SUCH_ID, row.body), 400)).toBe(row.message);
    });
  }

  test('answers 404 for a valid body and a contract that does not exist', { tag: ['@CGP-007'] }, async ({ agent }) => {
    // ขั้นที่ 1: ส่งเนื้อคำขอที่ผ่านการตรวจ (รหัสเหตุผลตรงรูปแบบก็พอ ระบบดูว่ามีเหตุผลนี้จริงหลังหาสัญญา CC:68 เป็นต้นไป)
    // ขั้นที่ 2: ต้องได้ 404 ว่าไม่พบสัญญา (CC:66-67)
    expect(await expectError(await agent.contracts.close(NO_SUCH_ID, valid), 404)).toBe(CONTRACT_NOT_FOUND);
  });
});

test.describe('POST /agent/contracts/:id/cancel-draft', () => {
  /** R7: reason ต้องเป็นข้อความที่ไม่ว่างหลังตัดช่องว่าง และยาวไม่เกิน 1,000 ตัว (S:3604-3606) */
  const message = 'กรุณาระบุเหตุผลยกเลิกไม่เกิน 1,000 ตัวอักษร';
  const rows: RejectRow[] = [
    { tag: '@CGP-008', what: 'no reason', body: {}, message },
    { tag: '@CGP-008', what: 'a blank reason', body: { reason: '   ' }, message },
    { tag: '@CGP-008', what: 'a reason that is not text', body: { reason: 123 }, message },
    { tag: '@CGP-008', what: 'a reason over 1,000 characters', body: { reason: tooLong(1000) }, message },
  ];
  for (const row of rows) {
    test(`answers 400 for ${row.what} before looking up the contract`, { tag: [row.tag] }, async ({ agent }) => {
      // ขั้นที่ 1: ส่งเหตุผลที่ผิดไปที่สัญญาที่ไม่มีจริง   ขั้นที่ 2: ต้องได้ 400 (หาสัญญาหลังตรวจเหตุผล S:3607-3608)
      expect(await expectError(await agent.contracts.cancelDraft(NO_SUCH_ID, row.body), 400)).toBe(row.message);
    });
  }

  test('answers 404 for a valid reason and a contract that does not exist', { tag: ['@CGP-009'] }, async ({ agent }) => {
    // ขั้นที่ 1: ส่งเหตุผลที่ผ่าน   ขั้นที่ 2: ต้องได้ 404 ว่าไม่พบสัญญา (S:3607-3608) ก่อน transaction ที่ยกเลิกร่าง
    expect(await expectError(await agent.contracts.cancelDraft(NO_SUCH_ID, { reason: 'e2e' }), 404)).toBe(CONTRACT_NOT_FOUND);
  });
});

test.describe('POST /agent/contracts/:id/draft', () => {
  test('answers 400 for a body that is not an object', { tag: ['@CGP-010'] }, async ({ agent }) => {
    // R9: saveDraft ตรวจว่าเนื้อคำขอเป็น object ก่อนหาสัญญา (S:3671-3672)
    // ขั้นที่ 1: ส่งอาร์เรย์ว่างไปที่สัญญาที่ไม่มีจริง   ขั้นที่ 2: ต้องได้ 400
    expect(await expectError(await agent.contracts.updateDraft(NO_SUCH_ID, []), 400)).toBe('กรุณาระบุข้อมูลสัญญา');
  });

  test('answers 404 for an object body and a contract that does not exist', { tag: ['@CGP-011'] }, async ({ agent }) => {
    // R9: object ว่างผ่านขั้นแรก แล้วระบบหาสัญญาที่จะแก้ (S:3673-3675) ก่อนตรวจช่องอื่นและก่อนสร้างบัญชีคู่สัญญา
    // ขั้นที่ 1: ส่ง {} ไปที่สัญญาที่ไม่มีจริง   ขั้นที่ 2: ต้องได้ 404 ว่าไม่พบสัญญา
    expect(await expectError(await agent.contracts.updateDraft(NO_SUCH_ID, {}), 404)).toBe(CONTRACT_NOT_FOUND);
  });
});

test.describe('POST /agent/contracts/:id/cancel-deal', () => {
  test('answers 400 when the payload is not JSON', { tag: ['@CGP-012'] }, async ({ agent }) => {
    // R10: controller แปลงช่อง payload เป็น JSON ก่อนส่งให้ service ถ้าแปลงไม่ได้ตอบ 400 (receiptPayload C:36-50)
    // ขั้นที่ 1: ส่ง multipart ที่ช่อง payload ไม่ใช่ JSON ไม่แนบไฟล์   ขั้นที่ 2: ต้องได้ 400
    expect(await expectError(await agent.contracts.cancelDeal(NO_SUCH_ID, 'not-json'), 400)).toBe('ข้อมูลไม่ถูกต้อง');
  });

  /**
   * R10: ช่องที่ขาดตอบเป็น object { code: CANCELLATION_INCOMPLETE, missing, message } (DC:60-65)
   * NestJS ส่ง object นี้เป็นเนื้อคำตอบตรง ๆ ไม่มีช่อง statusCode จึงใช้ expectError ไม่ได้ (ดู expectCodedError ใน src/support/http.ts)
   * เทสนี้ต้องตรวจช่อง missing ด้วย จึงอ่านเนื้อคำตอบเอง
   */
  async function expectIncomplete(response: APIResponse, missing: string[]) {
    const body = await expectJson<{ code?: unknown; missing?: unknown; message?: unknown }>(response, 400);
    expect(body.code).toBe('CANCELLATION_INCOMPLETE');
    expect(body.missing).toEqual(missing);
    expect(typeof body.message).toBe('string');
  }

  test('names the missing evidence when no file is attached', { tag: ['@CGP-013'] }, async ({ agent }) => {
    // ขั้นที่ 1: ส่งเหตุผลกับฝ่ายที่เป็นเหตุ (ผู้เช่า) โดยไม่แนบไฟล์หลักฐาน
    const response = await agent.contracts.cancelDeal(NO_SUCH_ID, JSON.stringify({ reason: 'e2e', atFault: 'tenant' }));

    // ขั้นที่ 2: ต้องได้ 400 ที่บอกว่าขาดแค่หลักฐาน (DC:57 นับไฟล์ ; ผู้เช่าเป็นเหตุจึงไม่ต้องมีวันที่ได้รับแจ้ง DC:59)
    await expectIncomplete(response, ['evidence']);
  });

  test('names the missing notice date when the landlord is at fault', { tag: ['@CGP-014'] }, async ({ agent }) => {
    // ขั้นที่ 1: แนบไฟล์ PNG 1 ไฟล์ บอกว่าผู้ให้เช่าเป็นเหตุ แต่ไม่ส่งวันที่ได้รับแจ้ง
    const response = await agent.contracts.cancelDeal(NO_SUCH_ID, JSON.stringify({ reason: 'e2e', atFault: 'landlord' }), PNG_BLUE());

    // ขั้นที่ 2: ต้องได้ 400 ที่บอกว่าขาดแค่วันที่ได้รับแจ้ง (DC:59)
    await expectIncomplete(response, ['notifiedOn']);
  });

  /** R10: แถวที่ช่องครบแต่ค่าผิด แนบไฟล์ทุกแถว เพื่อให้ผ่านการตรวจช่องที่ขาด (DC:56-65) แล้วไปติดที่ข้อถัดไป */
  const tenant = { reason: 'e2e', atFault: 'tenant' };
  const landlord = { reason: 'e2e', atFault: 'landlord', notifiedOn: '2026-01-01' };
  const rows: RejectRow[] = [
    // ช่องนอกรายการถูกตรวจก่อนทุกข้อ (DC:50-51)
    { tag: '@CGP-015', what: 'an extra field', body: { ...tenant, extra: 'e2e' }, message: 'ข้อมูลยกเลิกดีลมีฟิลด์ที่ไม่รองรับ' },
    { tag: '@CGP-015', what: 'a reason over 1,000 characters', body: { ...tenant, reason: tooLong(1000) }, message: 'เหตุผลต้องไม่เกิน 1,000 ตัวอักษร' }, // DC:66
    {
      tag: '@CGP-015',
      what: 'a notice date that does not exist',
      body: { ...landlord, notifiedOn: '2026-02-30' },
      message: 'วันที่ได้รับแจ้งต้องเป็น ค.ศ. ในรูปแบบ YYYY-MM-DD',
    }, // DC:68-69
    // วันในอนาคตเทียบกับวันนี้ตามเวลากรุงเทพ (DC:70 ; today จาก bangkokToday DC:218) ปี 2099 อยู่ในอนาคตเสมอจนถึงปีนั้น
    { tag: '@CGP-015', what: 'a notice date in the future', body: { ...landlord, notifiedOn: '2099-01-01' }, message: 'วันที่ได้รับแจ้งต้องไม่เกินวันนี้' },
    { tag: '@CGP-015', what: 'endAppointment that is not a boolean', body: { ...landlord, endAppointment: 'yes' }, message: 'ตัวเลือกเลิกสัญญาแต่งตั้งนายหน้าไม่ถูกต้อง' }, // DC:71-72
    {
      tag: '@CGP-015',
      what: 'ending the broker appointment when the tenant is at fault',
      body: { ...tenant, endAppointment: true },
      message: 'เลิกสัญญาแต่งตั้งนายหน้าพร้อมการยกเลิกได้เฉพาะเมื่อผู้ให้เช่าเป็นเหตุ',
    }, // DC:74-75
  ];
  for (const row of rows) {
    test(`answers 400 for ${row.what} before looking up the contract`, { tag: [row.tag] }, async ({ agent }) => {
      // ขั้นที่ 1: แนบ PNG 1 ไฟล์ พร้อมข้อมูลที่ผิด 1 ช่อง ไปที่สัญญาที่ไม่มีจริง
      const response = await agent.contracts.cancelDeal(NO_SUCH_ID, JSON.stringify(row.body), PNG_BLUE());
      // ขั้นที่ 2: ต้องได้ 400 พร้อมข้อความของช่องนั้น (validateDealCancellation อยู่ก่อน findOwn DC:219-220)
      expect(await expectError(response, 400)).toBe(row.message);
    });
  }

  test('answers 404 for a valid form and a contract that does not exist', { tag: ['@CGP-016'] }, async ({ agent }) => {
    // ขั้นที่ 1: ส่งข้อมูลครบและถูกต้อง พร้อม PNG 1 ไฟล์ ไปที่สัญญาที่ไม่มีจริง
    const response = await agent.contracts.cancelDeal(NO_SUCH_ID, JSON.stringify(tenant), PNG_BLUE());
    // ขั้นที่ 2: ต้องได้ 404 ว่าไม่พบสัญญา (findOwn DC:179-182) ซึ่งอยู่ก่อนอัปโหลดไฟล์หลักฐาน (DC:225) จึงไม่มีไฟล์ถูกเก็บ
    expect(await expectError(response, 404)).toBe(CONTRACT_NOT_FOUND);
  });
});

test.describe('POST /agent/contracts/:id/cancellation/refund', () => {
  test('answers 400 when the payload is not JSON', { tag: ['@CGP-017'] }, async ({ agent }) => {
    // R12: controller แปลงช่อง payload ก่อนเรียก service (receiptPayload C:36-50)
    // ขั้นที่ 1: ส่ง multipart ที่ช่อง payload ไม่ใช่ JSON   ขั้นที่ 2: ต้องได้ 400
    expect(await expectError(await agent.contracts.recordDealRefund(NO_SUCH_ID, 'not-json'), 400)).toBe('ข้อมูลไม่ถูกต้อง');
  });

  test('answers 404 when the contract has no cancellation', { tag: ['@CGP-018'] }, async ({ agent }) => {
    // ขั้นที่ 1: ส่งวันที่คืนเงินที่ถูกรูปแบบ พร้อมไฟล์หลักฐาน PNG ไปที่สัญญาที่ไม่มีจริง
    const response = await agent.contracts.recordDealRefund(NO_SUCH_ID, JSON.stringify({ refundedOn: '2026-01-01' }), PNG_BLUE());
    // ขั้นที่ 2: R12 ระบบหาการยกเลิกของสัญญาก่อนตรวจอย่างอื่น จึงต้องได้ 404 ข้อความนี้ (DC:304-305)
    expect(await expectError(response, 404)).toBe('ไม่พบการยกเลิกของสัญญานี้');
  });
});

test.describe('returning a slip', () => {
  /** R13: 3 เส้นทางใช้ slipReturnReason ตัวเดียวกันก่อนหาสัญญา (S:218-223 ; เรียกที่ S:2516, 2558, 2383) */
  const routes: { name: string; call: (agent: ApiSession, body: unknown) => Promise<APIResponse> }[] = [
    { name: 'reservation-payment/return', call: (agent, body) => agent.contracts.returnReservationSlip(NO_SUCH_ID, body) },
    { name: 'deposit-payment/return', call: (agent, body) => agent.contracts.returnDepositSlip(NO_SUCH_ID, body) },
    { name: 'early-end/slip/return', call: (agent, body) => agent.contracts.returnEarlyEndSlip(NO_SUCH_ID, body) },
  ];
  const message = 'กรุณาระบุเหตุผลในการตีกลับ (ไม่เกิน 500 ตัวอักษร)';
  const bad: { what: string; body: unknown }[] = [
    { what: 'no reason', body: {} },
    { what: 'a blank reason', body: { reason: '  ' } },
    { what: 'a reason over 500 characters', body: { reason: tooLong(500) } },
  ];
  for (const route of routes) {
    for (const row of bad) {
      test(`${route.name} answers 400 for ${row.what} before looking up the contract`, { tag: ['@CGP-019'] }, async ({ agent }) => {
        // ขั้นที่ 1: ส่งเหตุผลที่ผิดไปที่สัญญาที่ไม่มีจริง   ขั้นที่ 2: ต้องได้ 400 (S:220-222)
        expect(await expectError(await route.call(agent, row.body), 400)).toBe(message);
      });
    }

    test(`${route.name} answers 404 for a valid reason and a contract that does not exist`, { tag: ['@CGP-020'] }, async ({ agent }) => {
      // ขั้นที่ 1: ส่งเหตุผลที่ผ่าน (ไม่ส่ง submittedAt เพราะระบบตรวจสลิปด้วย assertSameSlip S:211-216 หลังหาสัญญาเจอ)
      // ขั้นที่ 2: ต้องได้ 404 ว่าไม่พบสัญญา (S:2517-2518, 2562-2565 อ่านใน transaction, 2386-2387)
      expect(await expectError(await route.call(agent, { reason: 'e2e' }), 404)).toBe(CONTRACT_NOT_FOUND);
    });
  }
});

test.describe('other routes that look up the contract first', () => {
  test('early-end/slip/confirm answers 404 for a contract that does not exist', { tag: ['@CGP-021'] }, async ({ agent }) => {
    // R16: confirmEarlyEndSlip หาสัญญาก่อนตรวจสลิป (S:2368-2369) ค่า submittedAt ปลอมจึงไม่ถูกตรวจ
    // ขั้นที่ 1: ยืนยันสลิปของสัญญาที่ไม่มีจริง   ขั้นที่ 2: ต้องได้ 404 ว่าไม่พบสัญญา (ไม่มีอะไรถูกบันทึก)
    expect(await expectError(await agent.contracts.confirmEarlyEndSlip(NO_SUCH_ID, { submittedAt: 'e2e' }), 404)).toBe(CONTRACT_NOT_FOUND);
  });

  for (const generate of [false, true]) {
    const name = generate ? 'generate-lease-renewal' : 'lease-renewal-preview';
    test(`${name} answers 404 for a contract that does not exist`, { tag: ['@CGP-022'] }, async ({ agent }) => {
      // R17: leaseRenewalPdf หาสัญญาก่อนตรวจชนิดสัญญาและก่อนสร้าง PDF (S:1356-1357)
      // ขั้นที่ 1: ขอ PDF ของสัญญาที่ไม่มีจริง   ขั้นที่ 2: ต้องได้ 404 ว่าไม่พบสัญญา
      expect(await expectError(await agent.contracts.leaseRenewalPdf(NO_SUCH_ID, generate), 404)).toBe(CONTRACT_NOT_FOUND);
    });
  }

  test('handover/sign looks up the contract before checking the body', { tag: ['@CGP-023'] }, async ({ agent }) => {
    // R22: signOnSite หาสัญญาก่อน (HO:394-395 เรียก contractForAgent S:625-627) แล้วจึงตรวจ party (HO:396)
    // ขั้นที่ 1: ส่ง party ที่ผิดไปที่สัญญาที่ไม่มีจริง
    // ขั้นที่ 2: ต้องได้ 404 ไม่ใช่ 400 เคสนี้ยืนยันลำดับการตรวจ ไม่ได้ทดสอบการตรวจ party
    expect(await expectError(await agent.contracts.signHandoverOnSite(NO_SUCH_ID, { party: 'x' }), 404)).toBe(CONTRACT_NOT_FOUND);
  });
});

test.describe('POST /agent/contracts/:id/handover-due', () => {
  /**
   * R21: moveHandoverDue ตรวจวันที่ เหตุผล แล้ววันที่ไม่ก่อนวันนี้ ตามลำดับ ก่อนหาสัญญา (S:2482-2489)
   * วันฐาน 2099-01-01 อยู่หลังวันนี้เสมอจนถึงปีนั้น ; 2020-01-01 อยู่ก่อนวันนี้เสมอ (เทียบกับ bangkokToday S:2487)
   */
  const valid = { date: '2099-01-01', reason: 'e2e' };
  const dateMessage = 'วันส่งมอบไม่ถูกต้อง';
  const reasonMessage = 'กรุณาระบุเหตุผลที่เลื่อนวันส่งมอบ (ไม่เกิน 500 ตัวอักษร)';
  const rows: RejectRow[] = [
    { tag: '@CGP-024', what: 'a date that does not exist', body: { ...valid, date: '2026-02-30' }, message: dateMessage }, // S:2484
    { tag: '@CGP-024', what: 'no date', body: { reason: 'e2e' }, message: dateMessage }, // S:2484
    { tag: '@CGP-024', what: 'a blank reason', body: { ...valid, reason: '  ' }, message: reasonMessage }, // S:2485
    { tag: '@CGP-024', what: 'a reason over 500 characters', body: { ...valid, reason: tooLong(500) }, message: reasonMessage }, // S:2485
    { tag: '@CGP-024', what: 'a date in the past', body: { ...valid, date: '2020-01-01' }, message: 'วันส่งมอบใหม่ต้องไม่ก่อนวันนี้' }, // S:2487
  ];
  for (const row of rows) {
    test(`answers 400 for ${row.what} before looking up the contract`, { tag: [row.tag] }, async ({ agent }) => {
      // ขั้นที่ 1: ส่งเนื้อคำขอที่ผิด 1 ช่อง ไปที่สัญญาที่ไม่มีจริง   ขั้นที่ 2: ต้องได้ 400 พร้อมข้อความของช่องนั้น
      expect(await expectError(await agent.contracts.moveHandoverDue(NO_SUCH_ID, row.body), 400)).toBe(row.message);
    });
  }

  test('answers 404 for a valid body and a contract that does not exist', { tag: ['@CGP-025'] }, async ({ agent }) => {
    // ขั้นที่ 1: ส่งวันที่และเหตุผลที่ผ่าน   ขั้นที่ 2: ต้องได้ 404 ว่าไม่พบสัญญา (S:2488-2489)
    expect(await expectError(await agent.contracts.moveHandoverDue(NO_SUCH_ID, valid), 404)).toBe(CONTRACT_NOT_FOUND);
  });
});

test.describe('DELETE /agent/contracts/:id/handover/photos/:photoId', () => {
  test('answers 404 for a contract that does not exist', { tag: ['@CGP-026'] }, async ({ agent }) => {
    // R23: removePhoto หาสัญญาก่อนหารูป (HO:377-378 เรียก contractForAgent S:625-627)
    // ขั้นที่ 1: ลบรูปที่ไม่มีจริงของสัญญาที่ไม่มีจริง   ขั้นที่ 2: ต้องได้ 404 ว่าไม่พบสัญญา (ไม่ใช่ "ไม่พบรูป")
    expect(await expectError(await agent.contracts.removeHandoverPhoto(NO_SUCH_ID, NO_SUCH_ID), 404)).toBe(CONTRACT_NOT_FOUND);
  });

  test('answers 400 for photo id 0', { tag: ['@CGP-027'] }, async ({ agent }) => {
    // R2: photoId ผ่าน DatabaseIdPipe (C:233) ค่า 0 อยู่นอกช่วง 1 ถึง 2147483647
    // ขั้นที่ 1: ลบรูป id 0   ขั้นที่ 2: ต้องได้ 400 พร้อมข้อความของตัวตรวจ id ก่อนถึง service
    expect(await expectError(await agent.contracts.removeHandoverPhoto(NO_SUCH_ID, 0), 400)).toBe(ID_OUT_OF_RANGE);
  });
});

test.describe('POST /agent/contracts/:id/documents/:kind', () => {
  /** R24: รับเฉพาะ lease_agreement, invoice, receipt ตรงตัวพิมพ์ (contract-document-storage.service.ts:15-19 ; ตรวจที่ S:2136-2137) */
  for (const kind of ['e2e-no-such-kind', 'reservation_letter', 'LEASE_AGREEMENT']) {
    test(`answers 400 for kind ${kind} before looking up the contract`, { tag: ['@CGP-028'] }, async ({ agent }) => {
      // ขั้นที่ 1: ส่งชนิดเอกสารที่ไม่รับ ไม่แนบไฟล์   ขั้นที่ 2: ต้องได้ 400
      expect(await expectError(await agent.contracts.uploadDocumentWithoutFile(NO_SUCH_ID, kind), 400)).toBe('ชนิดเอกสารไม่ถูกต้อง');
    });
  }

  test('answers 404 for kind receipt and a contract that does not exist', { tag: ['@CGP-029'] }, async ({ agent }) => {
    // ขั้นที่ 1: ส่งชนิดที่รับ ไม่แนบไฟล์   ขั้นที่ 2: ต้องได้ 404 (หาสัญญา S:2139-2140 ก่อนอ่านไฟล์)
    expect(await expectError(await agent.contracts.uploadDocumentWithoutFile(NO_SUCH_ID, 'receipt'), 404)).toBe(CONTRACT_NOT_FOUND);
  });
});

test.describe('POST /agent/contracts/:id/attachments/:documentId/review', () => {
  /** R25: status ต้องเป็น accepted หรือ rejected และ note (ถ้ามี) เป็นข้อความไม่เกิน 1,000 ตัว (AT:396-403) */
  const message = 'ผลตรวจเอกสารไม่ถูกต้อง';
  const rows: RejectRow[] = [
    { tag: '@CGP-030', what: 'a body that is not an object', body: [], message },
    { tag: '@CGP-030', what: 'no status', body: {}, message },
    { tag: '@CGP-030', what: 'status pending', body: { status: 'pending' }, message },
    { tag: '@CGP-030', what: 'a note that is not text', body: { status: 'accepted', note: 123 }, message },
    { tag: '@CGP-030', what: 'a note over 1,000 characters', body: { status: 'rejected', note: tooLong(1000) }, message },
  ];
  for (const row of rows) {
    test(`answers 400 for ${row.what} before looking up the contract`, { tag: [row.tag] }, async ({ agent }) => {
      // ขั้นที่ 1: ส่งผลตรวจที่ผิด   ขั้นที่ 2: ต้องได้ 400 (หาสัญญาหลังตรวจ AT:404-405)
      expect(await expectError(await agent.contracts.reviewAttachment(NO_SUCH_ID, NO_SUCH_ID, row.body), 400)).toBe(row.message);
    });
  }

  test('answers 404 for a valid review and a contract that does not exist', { tag: ['@CGP-031'] }, async ({ agent }) => {
    // ขั้นที่ 1: ส่งผลตรวจที่ผ่าน   ขั้นที่ 2: ต้องได้ 404 ว่าไม่พบสัญญา (AT:405 เรียก contract AT:107)
    expect(await expectError(await agent.contracts.reviewAttachment(NO_SUCH_ID, NO_SUCH_ID, { status: 'accepted' }), 404)).toBe(CONTRACT_NOT_FOUND);
  });
});

test.describe('POST /agent/contracts/:id/attachments/reuse', () => {
  /** R20: confirmedCurrent ต้องเป็น true (boolean) แล้วจึงตรวจ sourceDocumentId (AT:436-439 ; optionalId AT:66-73) */
  const confirm = 'กรุณายืนยันว่าเอกสารเดิมยังเป็นปัจจุบัน';
  const rows: RejectRow[] = [
    { tag: '@CGP-032', what: 'no confirmation', body: { sourceDocumentId: NO_SUCH_ID }, message: confirm },
    { tag: '@CGP-032', what: 'a confirmation that is text', body: { confirmedCurrent: 'true', sourceDocumentId: NO_SUCH_ID }, message: confirm },
    { tag: '@CGP-032', what: 'no source document', body: { confirmedCurrent: true }, message: 'กรุณาเลือกเอกสารเดิม' }, // AT:439
    { tag: '@CGP-032', what: 'source document id 0', body: { confirmedCurrent: true, sourceDocumentId: 0 }, message: 'รหัสเอกสารไม่ถูกต้อง' }, // AT:70-71
  ];
  for (const row of rows) {
    test(`answers 400 for ${row.what} before looking up the contract`, { tag: [row.tag] }, async ({ agent }) => {
      // ขั้นที่ 1: ส่งเนื้อคำขอที่ผิด   ขั้นที่ 2: ต้องได้ 400 (หาสัญญาหลังตรวจ AT:440)
      expect(await expectError(await agent.contracts.reuseAttachment(NO_SUCH_ID, row.body), 400)).toBe(row.message);
    });
  }

  test('answers 404 for a valid body and a contract that does not exist', { tag: ['@CGP-033'] }, async ({ agent }) => {
    // ขั้นที่ 1: ส่งเนื้อคำขอที่ผ่าน   ขั้นที่ 2: ต้องได้ 404 ว่าไม่พบสัญญา (AT:440 เรียก contract AT:107)
    expect(await expectError(await agent.contracts.reuseAttachment(NO_SUCH_ID, { confirmedCurrent: true, sourceDocumentId: NO_SUCH_ID }), 404)).toBe(
      CONTRACT_NOT_FOUND,
    );
  });
});

test.describe('POST /agent/deal-offers/:id/cancel', () => {
  /** R26: revisionOf ต้องได้จำนวนเต็มชนิด number ตั้งแต่ 1 ก่อนหาข้อเสนอ (DO:113-118 ; locked DO:405-406) */
  const message = 'กรุณาระบุรุ่นของข้อเสนอที่เปิดอยู่';
  const rows: RejectRow[] = [
    { tag: '@CGP-034', what: 'no revision', body: {}, message },
    { tag: '@CGP-034', what: 'a revision that is text', body: { revision: '1' }, message },
    { tag: '@CGP-034', what: 'a revision with decimals', body: { revision: 1.5 }, message },
    { tag: '@CGP-034', what: 'revision 0', body: { revision: 0 }, message },
  ];
  for (const row of rows) {
    test(`answers 400 for ${row.what} before looking up the offer`, { tag: [row.tag] }, async ({ agent }) => {
      // ขั้นที่ 1: ยกเลิกข้อเสนอที่ไม่มีจริงด้วยรุ่นที่ผิด   ขั้นที่ 2: ต้องได้ 400
      expect(await expectError(await agent.dealOffers.cancel(NO_SUCH_ID, row.body), 400)).toBe(row.message);
    });
  }

  test('answers 404 for an offer that does not exist', { tag: ['@CGP-035'] }, async ({ agent }) => {
    // ขั้นที่ 1: ส่งรุ่นที่ถูกรูปแบบ   ขั้นที่ 2: ต้องได้ 404 (DO:407-410) ก่อนคำสั่งเปลี่ยนสถานะ
    expect(await expectError(await agent.dealOffers.cancel(NO_SUCH_ID, { revision: 1 }), 404)).toBe('ไม่พบข้อเสนอ');
  });
});

test.describe('POST /agent/deal-offers/:id/revise', () => {
  /**
   * R27: ข้อเสนอที่ผ่านการตรวจทุกช่อง (ช่องบังคับ DO:83-111 กับ reason, agreedVia DO:441-445) + revision
   * แต่ละแถวเปลี่ยนแค่ 1 ช่อง ข้อความตามลำดับการตรวจใน validateDealOfferTerms (DO:83-111) และ revise (DO:440-445)
   */
  const valid = {
    monthlyRent: '15000',
    termMonths: 12,
    startDate: '2027-01-01',
    depositAmount: '30000',
    contractDate: '2026-12-01',
    rentDueDay: 1,
    coBroke: false,
    reason: 'e2e',
    agreedVia: 'phone',
    revision: 1,
  };
  const rows: RejectRow[] = [
    // status ไม่อยู่ใน TERM_KEYS (DO:43-46) หรือช่องเพิ่มของ revise (DO:440) ตรวจที่ DO:67-68
    { tag: '@CGP-036', what: 'an extra field', body: { ...valid, status: 'confirmed' }, message: 'ข้อมูลข้อเสนอมีฟิลด์ที่ไม่รองรับ' },
    { tag: '@CGP-036', what: 'rent 0', body: { ...valid, monthlyRent: '0' }, message: 'ค่าเช่าไม่อยู่ในช่วงที่รองรับ' }, // contract-money.ts:7
    { tag: '@CGP-036', what: 'a malformed rent', body: { ...valid, monthlyRent: '15,00' }, message: 'ค่าเช่าต้องเป็นจำนวนเงินที่ถูกต้อง' }, // contract-money.ts:5
    { tag: '@CGP-036', what: 'a term of 121 months', body: { ...valid, termMonths: 121 }, message: 'ระยะเวลาเช่าต้องเป็น 1–120 เดือน' },
    {
      tag: '@CGP-036',
      what: 'a contract date after the start date',
      body: { ...valid, contractDate: '2027-02-01' },
      message: 'วันทำสัญญาต้องไม่หลังวันเริ่มสัญญา',
    },
    { tag: '@CGP-036', what: 'coBroke that is text', body: { ...valid, coBroke: 'true' }, message: 'กรุณาระบุว่ามีนายหน้าอีกฝ่ายหรือไม่' },
    { tag: '@CGP-036', what: 'a blank reason', body: { ...valid, reason: '  ' }, message: 'กรุณาระบุเหตุผลที่แก้ข้อเสนอ (ไม่เกิน 500 ตัวอักษร)' }, // DO:443
    { tag: '@CGP-036', what: 'an unknown way of agreeing', body: { ...valid, agreedVia: 'email' }, message: 'กรุณาเลือกช่องทางที่ผู้ให้เช่าตกลง' }, // DO:42, 444-445
  ];
  for (const row of rows) {
    test(`answers 400 for ${row.what} before looking up the offer`, { tag: [row.tag] }, async ({ agent }) => {
      // ขั้นที่ 1: แก้ข้อเสนอที่ไม่มีจริงด้วยข้อมูลที่ผิด 1 ช่อง   ขั้นที่ 2: ต้องได้ 400 พร้อมข้อความของช่องนั้น
      expect(await expectError(await agent.dealOffers.revise(NO_SUCH_ID, row.body), 400)).toBe(row.message);
    });
  }

  test('answers 404 for a valid revision of an offer that does not exist', { tag: ['@CGP-037'] }, async ({ agent }) => {
    // ขั้นที่ 1: ส่งข้อเสนอที่ผ่านการตรวจทุกช่อง   ขั้นที่ 2: ต้องได้ 404 (DO:451-453 ; locked DO:407-410) ก่อนแก้เอกสารของดีล
    expect(await expectError(await agent.dealOffers.revise(NO_SUCH_ID, valid), 404)).toBe('ไม่พบข้อเสนอ');
  });
});

test.describe("requests that must be refused, on the agent's own reservation letter", () => {
  /**
   * ระดับ 1 ข: สัญญาเป้าคือหนังสือจองฉบับล่าสุดของ qa-agent ที่มีแม่แบบ (formKind = reservation และ templateId เป็นจำนวนเต็ม
   *   รายการเรียง id จากมากไปน้อย S:1123 ; templateId มาจาก S:859)
   * ทำไมต้องมีแม่แบบ: รายการถอยไปดูประเภทสัญญาเมื่อไม่มีแม่แบบ (S:878-879) แต่ close ดูแม่แบบอย่างเดียว (CC:81-83)
   *   สัญญาที่ไม่มีแม่แบบจึงอาจให้ผลของ CGP-041 ต่างจากที่คาด (ยังไม่เขียนข้อมูล เพราะรหัสเหตุผลไม่มีจริง CC:84-85)
   * GET /agent/contracts อ่านอย่างเดียว (list S:1122-1126) ช่อง formKind มาจากแม่แบบหรือประเภทสัญญา (S:878-879)
   * รายการสัญญามีชื่อผู้เช่าและข้อมูลของคู่สัญญา จึงอ่านด้วย expectJsonQuiet (ไม่พิมพ์เนื้อคำตอบถ้าไม่ผ่าน) และใช้แค่ id กับ formKind
   * ถ้า qa-agent ไม่มีหนังสือจองแบบนี้ เทสข้อนั้นข้ามพร้อมเหตุผล ไม่สร้างสัญญาเอง
   */
  async function latestReservationId(agent: ApiSession): Promise<number> {
    const rows = await expectJsonQuiet<{ id?: unknown; formKind?: unknown; templateId?: unknown }[]>(await agent.contracts.list(), 200, 'GET /agent/contracts');
    expect(Array.isArray(rows)).toBe(true);
    const target = rows.find((row) => row.formKind === 'reservation' && Number.isInteger(row.templateId));
    test.skip(target === undefined, 'qa-agent ยังไม่มีหนังสือจองที่มีแม่แบบ จึงไม่มีสัญญาเป้าของเคสระดับ 1 ข');
    const id = target?.id;
    expect(Number.isInteger(id) && (id as number) > 0, 'id ของหนังสือจองต้องเป็นจำนวนเต็มบวก').toBe(true);
    return id as number;
  }

  /**
   * ตรวจคำตอบด้วย expectErrorQuiet: ถ้าวันหนึ่ง API รับคำขอ (2xx) เนื้อคำตอบจะเป็นข้อมูลสัญญาจริงที่มีชื่อคู่สัญญา
   * ข้อความเมื่อไม่ผ่านจึงต้องไม่มีเนื้อคำตอบ (expectError พิมพ์เนื้อคำตอบ 500 ตัวอักษรแรก)
   */
  for (const generate of [false, true]) {
    const name = generate ? 'generate-lease-renewal' : 'lease-renewal-preview';
    test(`${name} answers 400 for a reservation letter`, { tag: [generate ? '@CGP-039' : '@CGP-038'] }, async ({ agent }) => {
      // ขั้นที่ 1: หาหนังสือจองฉบับล่าสุดของ qa-agent
      const id = await latestReservationId(agent);
      // ขั้นที่ 2: ขอ PDF หนังสือต่อสัญญาของหนังสือจองฉบับนั้น
      const response = await agent.contracts.leaseRenewalPdf(id, generate);
      // ขั้นที่ 3: R17 ต้องได้ 400 เพราะไม่ใช่หนังสือต่อสัญญา (S:1358-1359) ข้อตรวจนี้อยู่ก่อนสร้างและอัปโหลด PDF (S:1372 เป็นต้นไป)
      //   กันชั้นที่ 2: เส้นทางนี้ไม่มีเนื้อคำขอให้เลือก แต่โค้ดยังปฏิเสธแม่แบบที่ไม่ใช่ lease_renewal/v1 (S:1360-1361) ก่อนสร้าง PDF
      expect(await expectErrorQuiet(response, 400, name)).toBe('รองรับเฉพาะหนังสือต่อสัญญาเช่า');
    });
  }

  test('handover-due answers 400 for a reservation letter', { tag: ['@CGP-040'] }, async ({ agent }) => {
    // ขั้นที่ 1: หาหนังสือจองฉบับล่าสุดของ qa-agent
    const id = await latestReservationId(agent);
    // ขั้นที่ 2: ขอเลื่อนวันส่งมอบด้วยเนื้อคำขอที่ผ่านการตรวจค่า (S:2482-2487)
    const response = await agent.contracts.moveHandoverDue(id, { date: '2099-01-01', reason: 'e2e' });
    // ขั้นที่ 3: R21 ต้องได้ 400 เพราะไม่ใช่สัญญาเช่า (S:2490-2491) ก่อนเปิด transaction ที่เขียน (S:2492)
    //   กันชั้นที่ 2: สถานะต้องเป็น awaiting_deposit หรือ awaiting_handover (S:2497) ซึ่งเป็นสถานะของสัญญาเช่า (อนุมาน)
    expect(await expectErrorQuiet(response, 400, 'handover-due')).toBe('เลื่อนวันส่งมอบได้เฉพาะสัญญาเช่า');
  });

  test('close answers 400 for a reservation letter', { tag: ['@CGP-041'] }, async ({ agent }) => {
    // ขั้นที่ 1: หาหนังสือจองฉบับล่าสุดของ qa-agent
    const id = await latestReservationId(agent);
    // ขั้นที่ 2: ขอปิดสัญญาด้วยรหัสเหตุผลที่ถูกรูปแบบ (CC:28) แต่ไม่มีในตาราง
    const response = await agent.contracts.close(id, { endReasonCode: 'e2e_no_such_reason', effectiveEndDate: '2026-01-01' });
    // ขั้นที่ 3: R5 ต้องได้ 400 เพราะแม่แบบไม่ใช่สัญญาเช่าหรือหนังสือต่อสัญญา (CC:81-83)
    //   ระบบล็อกแถวของลีด ห้อง และสัญญาใน transaction ก่อนถึงข้อนี้ (CC:69-77) แล้วยกเลิก transaction ไม่มีแถวไหนถูกแก้
    //   กันชั้นที่ 2: รหัสเหตุผลไม่มีจริง ข้อถัดไปจะตอบ 400 "ไม่พบเหตุผลปิดสัญญา" (CC:84-85) ก่อนคำสั่งเขียน
    expect(await expectErrorQuiet(response, 400, 'close')).toBe('ปิดได้เฉพาะสัญญาเช่าหรือหนังสือต่อสัญญา');
  });

  /**
   * R13, R14, R16: เส้นทาง early-end/slip ไม่ตรวจชนิดสัญญา หนังสือจองถูกปฏิเสธเพราะไม่มียอดเลิกสัญญาก่อนกำหนด (data.endsOn.money) เพราะจุดเดียวที่เขียน endsOn คือการเลิกสัญญาเช่าก่อนกำหนด
   *   (S:2250-2256 ; อ่านด้วย earlyEndMoneyOf S:2314-2317) ข้อนี้เป็นอนุมานจากโค้ด ถ้าผิด เทสจะแดงด้วยข้อความอื่น
   * กันชั้นที่ 2: ไม่ส่ง submittedAt ถ้าผ่านข้อตรวจก่อนหน้าทั้งหมด assertSameSlip ตอบ 409 ก่อนคำสั่งเขียน (S:211-216 ; เรียกที่ S:2392 และ 2374)
   */
  test('early-end/slip/return answers 400 when a reservation letter has no amount to collect', { tag: ['@CGP-042'] }, async ({ agent }) => {
    // ขั้นที่ 1: หาหนังสือจองฉบับล่าสุดของ qa-agent
    const id = await latestReservationId(agent);
    // ขั้นที่ 2: ตีกลับสลิปด้วยเหตุผลที่ผ่านการตรวจ (S:218-222) โดยไม่ส่ง submittedAt
    const response = await agent.contracts.returnEarlyEndSlip(id, { reason: 'e2e' });
    // ขั้นที่ 3: ต้องได้ 400 ว่าไม่มียอดที่ต้องเก็บ (S:2388-2389)
    expect(await expectErrorQuiet(response, 400, 'early-end/slip/return')).toBe('ไม่มียอดที่ต้องเก็บ');
  });

  test('early-end/slip/confirm answers 400 when a reservation letter has no amount to collect', { tag: ['@CGP-043'] }, async ({ agent }) => {
    // ขั้นที่ 1: หาหนังสือจองฉบับล่าสุดของ qa-agent
    const id = await latestReservationId(agent);
    // ขั้นที่ 2: ยืนยันรับเงินตามสลิปโดยไม่ส่ง submittedAt
    const response = await agent.contracts.confirmEarlyEndSlip(id, {});
    // ขั้นที่ 3: ต้องได้ 400 ว่าไม่มียอดที่ต้องเก็บ (S:2370-2371)
    expect(await expectErrorQuiet(response, 400, 'early-end/slip/confirm')).toBe('ไม่มียอดที่ต้องเก็บ');
  });

  test('handover/sign answers 400 for a party that cannot sign', { tag: ['@CGP-044'] }, async ({ agent }) => {
    // ขั้นที่ 1: หาหนังสือจองฉบับล่าสุดของ qa-agent
    const id = await latestReservationId(agent);
    // ขั้นที่ 2: ส่ง party ที่ไม่ใช่ owner หรือ tenant ไม่ส่ง revision และลายเซ็น
    const response = await agent.contracts.signHandoverOnSite(id, { party: 'x' });
    // ขั้นที่ 3: R22 ต้องได้ 400 จาก signParty (HO:129-133) ซึ่งถูกเรียกก่อน sign (HO:396) คู่กับ CGP-023 ที่ได้ 404 เมื่อสัญญาไม่มีจริง
    //   กันชั้นที่ 2: คำขอไม่มี revision และไม่มีลายเซ็น sign ตรวจ 2 อย่างนี้ (HO:424-425 ; handoverRevision HO:73-77) ก่อนอัปโหลดลายเซ็น (HO:430)
    expect(await expectErrorQuiet(response, 400, 'handover/sign')).toBe('บันทึกส่งมอบลงนามได้เฉพาะผู้ให้เช่าและผู้เช่า');
  });
});
