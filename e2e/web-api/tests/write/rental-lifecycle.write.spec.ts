import type { APIResponse } from '@playwright/test';
import { qaE2eLandlord, qaE2eTenant } from '../../src/config/qa-accounts';
import { expectCodedError, expectError, expectJson } from '../../src/support/http';
import {
  bangkokDate,
  DEAL,
  DEDUCTION,
  isValidThaiId,
  lifecycleLabel,
  nearMidnightReason,
  oneMonthBack,
  pdf,
  png,
  SIGNATURE,
  TEST_PHONE,
  TEST_THAI_ID,
} from '../../src/write/lifecycle-data';
import { expect, test, type LifecycleSession } from '../../src/write/write.fixture';

/**
 * เทสวงจรเช่าห้องครบวงจรผ่าน API (end-to-end) ด้วย 3 บัญชี: qa-agent, qa-e2e-tenant และ qa-e2e-landlord
 *   คู่สัญญาเป็นบัญชีที่ทีมสร้างให้เทสนี้โดยเฉพาะ (qaE2eTenant, qaE2eLandlord ใน src/config/qa-accounts.ts) ไม่ใช่ qa-tenant/qa-landlord
 *   ที่ทีมใช้ทดสอบในแอป (รอบแรกบน dev 2 พ.ย. 2026 ใช้ qa-tenant แล้วได้ 409 TENANT_EMAIL_IN_USE เพราะบัญชีผูกกับผู้เช่าคนอื่นอยู่แล้ว)
 *
 * ลำดับ (ยืนยันโดยเดินทีละขั้นในห้องทดลองกับ API ที่ develop bc77a8b และที่เก็บไฟล์จำลอง 2 พ.ย. 2026)
 *   ห้อง > ลีด > นัดดูห้อง > ข้อเสนอ > ผู้เช่า > หนังสือแต่งตั้งนายหน้า > หนังสือจอง > สัญญาเช่า > มัดจำ
 *   > ส่งมอบห้อง > บิลค่าเช่า > แจ้งย้ายออก > ส่งคืนห้อง > คืนมัดจำ
 *
 * สิ่งที่ต้องมีก่อนรัน (README หัวข้อ "เทสที่เขียนข้อมูล")
 *   - E2E_ALLOW_WRITES=yes npm run test:write และตั้ง E2E_QA_AGENT_UUID, E2E_QA_E2E_TENANT_UUID, E2E_QA_E2E_LANDLORD_UUID
 *   - ทีมตกลงเรื่องข้อมูล E2E- ในฐานข้อมูลและ Storage ของ dev แล้ว (TEAM_DB_WRITES_AGREED = true ตั้งแต่ 2 พ.ย. 2026)
 *     ถ้าเปลี่ยนกลับเป็น false ต้องตั้ง E2E_WRITE_TARGET=own-db และ API ต้องต่อฐานข้อมูลของ QA เอง
 *   - API ต้องต่อที่เก็บไฟล์ (Supabase Storage) ได้ เพราะเกือบทุกขั้นอัปโหลดหรือสร้าง PDF
 *   - ถ้าค่าคงที่เป็น false: SUPABASE_URL ใน .env.api ต้องชี้เครื่องนี้ด้วย (assertEnvFileStorageIsLocal ใน write-guard.ts ตรวจใน fixture)
 *   - ไม่เริ่มรันช่วง 23:50 ถึง 00:10 เวลากรุงเทพ (เทสข้ามพร้อมเหตุผล ดู nearMidnightReason ใน lifecycle-data.ts)
 *   - API ตั้งแต่ d2d4554 (ขั้น 10 ใช้ POST /bills/mine/refresh) เทสตรวจก่อนเขียนและข้ามพร้อมเหตุผลถ้าเป็นรุ่นก่อน
 *
 * ข้อมูลที่ 1 รอบสร้างถาวร (ไม่มีเส้นทางลบ ทุกข้อความติดป้าย E2E-LC-<รหัสรอบ>)
 *   นับจากฐานข้อมูลในห้องทดลอง ก่อนกับหลังรัน 1 รอบ (2 พ.ย. 2026) รวม 43 แถวใน 21 ตาราง:
 *     ห้อง: rent_rooms 1, properties 1, contacts 1, rent_room_contacts 1, rent_room_prices 1, room_layout_values 2
 *     ดีล: leads 1, lead_viewings 1, deal_offers 1, tenants 1, room_tenancies 3
 *     สัญญา: lease_contracts 3 (แต่งตั้งนายหน้า จอง เช่า), agreement_documents 3, agreement_signatures 12, agent_invoices 1
 *     หลังทำสัญญา: tenant_bills 2, handover_records 2, handover_items 2, handover_photos 2,
 *       contract_deposit_settlements 1, deposit_deduction_items 1
 *   ไฟล์ใน Storage: 33 ไฟล์ ประมาณ 1.9 MB ต่อรอบ (นับจาก log ของที่เก็บไฟล์จำลอง) เทสอัปโหลดเอง 11 ไฟล์
 *     (annotation "อัปโหลด") ที่เหลือ API สร้างเอง: ลายเซ็น 11, PDF ร่าง 3, PDF ฉบับจริง 3, ใบแจ้งหนี้ ใบเสร็จ และใบยืนยันค่านายหน้า
 *   บิล: เพราะวันเริ่มย้อนหลัง 1 เดือน จึงได้ 2 ใบ เดือนแรกยอด 0 (หักเงินจองแล้ว ระบบตั้งเป็น paid) และเดือนนี้ยอดเต็ม
 *   ตัวนับก่อนกับหลังรัน: สัญญาที่ qa-e2e-tenant และ qa-e2e-landlord เห็นต้องเพิ่มรอบละ 2 (จองกับเช่า) พอดี
 *   รันซ้ำได้: ทุกรอบสร้างชุดใหม่ ผู้เช่าทุกรอบใช้อีเมลของ qa-e2e-tenant กับเลขบัตรเดียวกัน
 *     API ยอมให้อีเมลเดียวผูกกับผู้เช่าของหลายลีดเมื่อเลขบัตรตรงกัน (assertTenantEmailNotShared กับ sameTenantPerson
 *     ใน party-login.ts บรรทัด 98-105 และ 116-139 ที่ develop accb616) ถ้าเปลี่ยน TEST_THAI_ID รอบถัดไปจะได้ 409 TENANT_EMAIL_IN_USE
 *     (ลองในห้องทดลองกับ qa-tenant 3 รอบติดกันที่ bc77a8b และกับ qa-e2e-tenant 3 รอบติดกันที่ accb616 ผ่านทุกรอบ)
 *   เคสระดับ 2 (CGP-046 ถึง 060 เพิ่ม 12 พ.ย. 2026 ยังไม่ได้นับจากฐานข้อมูลจริง อนุมานจากโค้ดที่ 311ab35):
 *     ไม่เพิ่มแถว ลบรูปส่งมอบ 1 แถวแล้วเพิ่ม 1 แถว (handover_photos เท่าเดิม)
 *     ไฟล์: ตัวเลข 33 ไฟล์และ "เทสอัปโหลดเอง 11 ไฟล์" ข้างบนเป็นของก่อนเพิ่มเคสระดับ 2 ตอนนี้เทสอัปโหลดเอง 15 ไฟล์ (annotation "อัปโหลด")
 *     เพิ่ม 4 ไฟล์ คือสลิปจองและสลิปมัดจำรอบที่ 2, สัญญาเช่าที่อัปโหลดเอง และรูปส่งมอบรูปที่ 2 (บวก 1 ถ้า CGP-054 ได้ 200)
 *     API ลบไฟล์ของสลิปจองที่ตีกลับ (2552), สลิปมัดจำที่ตีกลับ (2582) และรูปที่ลบ ; preview ครั้งที่ 2 ของขั้น 7 อาจสร้าง PDF ร่างเพิ่ม 1 ไฟล์
 *     ทั้งหมดอนุมานจากโค้ด ยังไม่ได้นับจาก Storage จริง
 *     แก้แถวของรอบ: ผลตรวจเอกสารสิทธิ์, data.handoverDue ของสัญญาเช่า (ค้างที่วันนี้ +7), data.documentFileNames.lease_agreement
 *
 * ข้อมูลที่ 1 รอบแก้ (ตัวนับแถวไม่เห็น เพราะนับแค่จำนวน)
 *   - แถว users ของ qa-e2e-tenant และ qa-e2e-landlord: ตอนสร้างหนังสือจอง API ผูกคู่สัญญากับบัญชีด้วยอีเมล (ensurePartyLogin
 *     ใน agent-contracts.service.ts บรรทัด 3776 และ 3788 ที่ develop accb616) และเติมชื่อ นามสกุล เลขบัตร สัญชาติ และเบอร์
 *     เฉพาะช่องที่บัญชียังว่าง (party-login.ts บรรทัด 197-206 ที่ accb616 นามสกุลเติมเฉพาะเมื่อเติมชื่อด้วย) เช่น E2E-LC-<รหัสรอบ> Tenant
 *     (ก่อน accb616 เขียนทับทุกรอบ) และเพิ่มบทบาท tenant หรือ landlord ถ้ายังไม่มี (บรรทัด 209-218)
 *   - ลีดของรอบได้ booking_released_at ตอนแจ้งย้ายออก (agent-contracts.service.ts บรรทัด 2261-2264)
 *   - หลังจบรอบ ถ้ามี API ตัวใดตัวหนึ่งที่ต่อฐานข้อมูลเดียวกันเปิดอยู่ตอน 00:05 (บนฐานข้อมูล dev รวม API ของทีม) งานตั้งเวลาปิดสัญญาเช่าของรอบนี้ (persistEndedLeases ใน tenant-billing.scheduler.ts
 *     บรรทัด 12-17 ซึ่งเป็นผู้เรียกเดียว) ถ้าไม่เปิด สัญญาค้างเป็น active ในบัญชีของ qa-e2e-tenant จนกว่าจะเปิด API ข้ามเวลานั้น
 *     งาน 08:00 อาจเขียนการเตือนของสัญญาเพิ่ม (ยังไม่ได้ตรวจว่ากี่แถว)
 *
 * วันเริ่มสัญญาย้อนหลัง 1 เดือน (oneMonthBack) เพื่อให้บิลค่าเช่าเดือนนี้ถึงรอบตอนรัน จะได้เทสการส่งสลิปค่าเช่า
 *   ค่าปรับจ่ายช้า (late fee) เทสไม่ได้ในรอบเดียว เพราะต้องรอให้เลยวันผ่อนผันจริง
 * แจ้งย้ายออกด้วยวันนี้ สัญญาจึงยัง active และมีวันสิ้นสุดใน data.endsOn งานตั้งเวลาปิดสัญญาเมื่อเลยวันนั้น
 *   (tenant-billing.service.ts บรรทัด 313) ถ้าส่งวันในอดีต API ปิดสัญญาทันที (setEarlyEnd ใน agent-contracts.service.ts
 *   บรรทัด 2216-2226; คอมเมนต์ที่ agent-contracts.controller.ts บรรทัด 115 ที่บอกว่าไม่รับวันก่อนวันนี้ ไม่ตรงกับ service)
 */

test.describe.configure({ mode: 'serial' });

// ข้อตกลงของชุดเทส: บัญชีที่ไม่ได้ตั้ง uuid ให้ข้ามพร้อมเหตุผล (ตรวจก่อนสร้าง fixture จึงไม่ส่งคำขอใด ๆ)
const missing = [qaE2eTenant, qaE2eLandlord].filter((account) => account.uuid === null).map((account) => account.uuidVariable);
test.skip(missing.length > 0, `ยังไม่ได้ตั้ง ${missing.join(', ')}`);

/** id ที่รอบนี้สร้าง เก็บไว้แสดงใน annotation ทุกครั้ง แม้เทสไม่ผ่านกลางทาง */
interface Created {
  roomId?: number;
  leadId?: number;
  viewingId?: number;
  offerId?: number;
  tenantId?: number;
  brokerAppointmentId?: number;
  reservationId?: number;
  leaseId?: number;
  depositInvoiceId?: number;
  rentBillId?: number;
}

interface IdBody {
  id: number;
}
interface Master {
  id: number;
  code: string;
}
interface ContractView {
  id: number;
  status: string;
  agreementTypeCode: string;
  data: Record<string, unknown> & { endsOn?: { date?: string; reason?: string } };
  reservationPayment: { status?: string; submittedAt?: string | null; slipReturnReason?: string | null } | null;
  tenantDeliveredAt: string | null;
  ownerDeliveredAt: string | null;
  depositPayment: { status?: string; invoiceId?: number; total?: number; submittedAt?: string | null } | null;
  /** มีเฉพาะสัญญาเช่าที่รอเงินประกันหรือรอส่งมอบ (agent-contracts.service.ts 946-952) */
  handoverDue?: { date: string; history: unknown[] } | null;
}
interface HandoverView {
  status: string;
  revision: number;
  photos: { id: number }[];
}
/** คำตอบของ POST/GET attachments (AgreementAttachmentChecklist ใน packages/types/src/agent-contracts.ts 464-477) */
interface AttachmentChecklist {
  documents: { id: number; documentTypeCode: string; reviewStatus: string }[];
}

/**
 * ค่าคงที่ของเคสระดับ 2 (CGP-046 ถึง 060 ใน claude/nestyk-topic-contracts-gaps.md) เลขบรรทัดที่ 311ab35
 *   ทุกเคสใช้สัญญาของรอบนี้ ไม่สร้างดีลหรือสัญญาเพิ่ม เคสปฏิเสธถูกปฏิเสธก่อนคำสั่งเขียน (บรรทัดในคอมเมนต์ของแต่ละเคส)
 *   STALE_SLIP_AT: submittedAt ที่ไม่ใช่ของสลิปจริง ตีกลับต้องได้ 409 SLIP_CHANGED ก่อนเขียน (assertSameSlip ใน agent-contracts.service.ts 211-216)
 *   NO_SUCH_ID: ค่าสูงสุดที่ DatabaseIdPipe รับ (apps/api/src/common/database-id.pipe.ts 3-14) และไม่มีแถวจริง เหมือน tests/api/agent-contracts.spec.ts
 */
const STALE_SLIP_AT = '2000-01-01T00:00:00.000Z';
const NO_SUCH_ID = 2147483647;
interface BillView {
  id: number;
  leaseContractId: number;
  period: string;
  amount: number;
  status: string;
}
interface SettlementView {
  status: string;
  depositReceived: string;
  deductionTotal: string;
  refundAmount: string;
}

/** สัญญาที่บัญชีนั้นเห็นใน /contracts/mine */
async function myContractIds(response: Promise<APIResponse>): Promise<number[]> {
  return (await myContracts(response)).map((contract) => contract.id);
}

/** สัญญาที่บัญชีนั้นเห็นใน /contracts/mine พร้อมชื่อโครงการ (ใช้ตรวจว่าเป็นข้อมูลของเทสหรือไม่) */
async function myContracts(response: Promise<APIResponse>): Promise<{ id: number; property: string | null }[]> {
  return expectJson<{ id: number; property: string | null }[]>(await response, 200);
}

/**
 * ป้ายที่ขึ้นต้นชื่อโครงการของทุกรอบ (lifecycleLabel + " Tower") ใช้แยกสัญญาของเทสออกจากสัญญาที่ทีมผูกกับบัญชี qa-*
 * ทำไมต้องตรวจ: ขั้น 10 เรียก POST /bills/mine/refresh ซึ่งออกบิลให้ทุกสัญญาของผู้เช่า ไม่ใช่แค่ของรอบนี้
 *   (API รุ่นก่อน d2d4554 ออกบิลตอน GET /bills/mine และ /bills/received แทน)
 *   ข้อตกลงกับทีม (ฉบับที่ 8, 2 พ.ย. 2026) ครอบเฉพาะข้อมูล E2E- จึงหยุดก่อนเขียนถ้าบัญชี qa-e2e-tenant หรือ qa-e2e-landlord มีสัญญาอื่น
 */
const RUN_PROPERTY_PREFIX = 'E2E-LC-';

test('rental lifecycle from a scout room to the deposit refund across agent, tenant and landlord', async ({ lifecycle, runId }, testInfo) => {
  // ตรวจก่อนส่งคำขอแรก (fixture สร้างแค่ผู้เรียก ยังไม่ส่งคำขอ)
  const midnight = nearMidnightReason();
  test.skip(midnight !== null, midnight ?? '');
  test.setTimeout(300_000);
  const { agent, tenant, landlord }: LifecycleSession = lifecycle;
  const label = lifecycleLabel(runId);
  const today = bangkokDate();
  const { startDate, rentDueDay } = oneMonthBack();
  const created: Created = {};
  let uploads = 0;
  const upload = <T>(value: T): T => {
    uploads += 1;
    return value;
  };
  const contract = async (id: number) => expectJson<ContractView>(await agent.contract(id), 200);
  const handover = async (id: number, moveOut: boolean) => expectJson<HandoverView>(await agent.handover(id, moveOut), 200);

  // ค่าคงที่ต้องถูกก่อนเขียนอะไร
  expect(isValidThaiId(TEST_THAI_ID)).toBe(true);

  // ตัวนับก่อนรัน และตรวจแบบอ่านอย่างเดียวว่าสัญญาเดิมของ 2 บัญชีเป็นของเทสทั้งหมด (ถ้าไม่ใช่ หยุดก่อนเขียน บอกแค่ id)
  const tenantExisting = await myContracts(tenant.contracts());
  const landlordExisting = await myContracts(landlord.contracts());
  const foreign = [...tenantExisting, ...landlordExisting].filter((contract) => !(contract.property ?? '').startsWith(RUN_PROPERTY_PREFIX));
  expect(
    [...new Set(foreign.map((contract) => contract.id))],
    'qa-e2e-tenant หรือ qa-e2e-landlord มีสัญญาที่ไม่ใช่ของเทส (id ตามนี้) ให้ถามทีมก่อนรัน เพราะขั้น 10 จะออกบิลให้สัญญาเหล่านี้ด้วย',
  ).toEqual([]);
  const tenantBefore = tenantExisting.map((contract) => contract.id);
  const landlordBefore = landlordExisting.map((contract) => contract.id);

  // รุ่นของ API ก่อนเขียน: ขั้น 10 ต้องใช้ POST /bills/mine/refresh (ตั้งแต่ d2d4554) ถ้าไม่มี ขั้น 10 จะแดงหลังขั้น 1-9 เขียนไปแล้ว
  //   และสัญญาเช่าของรอบจะค้างเป็น active (ขั้น 11-13 ไม่ได้รัน) จึงข้ามทั้งข้อตั้งแต่ตรงนี้ (ข้อเสนอของ test-reviewer)
  //   ตรวจด้วย qa-agent ซึ่งไม่มีบทบาท tenant: API ใหม่ตอบ 403 ก่อนถึง handler API เก่าตอบ 404 ไม่มีอะไรถูกบันทึก
  const probe = await agent.probeTenantBillRefresh();
  //   ข้ามเฉพาะ 404 ของ NestJS ("Cannot POST ...") ส่วน 404 จากที่อื่นไปแดงที่ expect ถัดไป
  const routeMissing = probe.status() === 404 && (await probe.text()).includes('Cannot POST');
  test.skip(routeMissing, 'ต้องใช้ API ตั้งแต่ d2d4554 (POST /bills/mine/refresh) API นี้เป็นรุ่นก่อน ข้ามก่อนเขียนข้อมูล');
  expect(await expectError(probe, 403), 'qa-agent ต้องถูกปฏิเสธจาก POST /bills/mine/refresh').toBe('Required role: tenant');

  try {
    await test.step('1. ข้อมูลอ้างอิงและห้อง scout ใหม่', async () => {
      const contractType = (await expectJson<Master[]>(await agent.contractTypes(), 200)).find((type) => type.code === 'monthly_12');
      const roomType = (await expectJson<Master[]>(await agent.roomTypes(), 200)).find((type) => type.code === 'studio');
      const propertyType = (await expectJson<Master[]>(await agent.propertyTypes(), 200)).find((type) => type.code === 'condo');
      expect(contractType, 'ต้องมีประเภทสัญญา monthly_12').toBeDefined();
      expect(roomType, 'ต้องมีประเภทห้อง studio').toBeDefined();
      expect(propertyType, 'ต้องมีประเภทโครงการ condo').toBeDefined();
      const room = await expectJson<IdBody>(
        await agent.createRoom({
          visibility: 'private',
          contacts: [{ name: `${label} Owner`, phone: TEST_PHONE }],
          property: {
            name: `${label} Tower`,
            address: `${label} Rd`,
            district: 'Khlong Toei',
            province: 'Bangkok',
            propertyTypeId: propertyType!.id,
            latitude: 13.72,
            longitude: 100.56,
          },
          latitude: 13.72,
          longitude: 100.56,
          listingTitle: `${label} room`,
          roomTypeId: roomType!.id,
          listingSourceCode: 'owner',
          layout: [
            { code: 'bedroom', value: '1' },
            { code: 'bathroom', value: '1' },
          ],
          // advanceRentMonths 1 = ค่าเช่าล่วงหน้า 1 เดือน: บิลแรกแยกออก (หักเงินจอง) แล้วบิลถัดไปคือเดือนนี้
          // (rentPeriodsUntil ใน billing/rent-schedule.ts บรรทัด 146-147) ถ้าเพิ่มเป็น 2 บิลเดือนนี้จะไม่ออก และขั้น 10 จะไม่ผ่าน
          prices: [{ contractTypeId: contractType!.id, price: DEAL.monthlyRent, advanceRentMonths: 1, depositMonths: 2 }],
        }),
        201,
      );
      created.roomId = room.id;
    });

    await test.step('2. ลีด นัดดูห้อง และดูห้องเสร็จ', async () => {
      created.leadId = (await expectJson<IdBody>(await agent.createLead({ firstName: `${label} Lead`, phone: TEST_PHONE }), 201)).id;
      const viewing = await expectJson<IdBody>(
        await agent.createViewing(created.leadId, { rentRoomId: created.roomId, scheduledAt: new Date(Date.now() + 2 * 86_400_000).toISOString() }),
        201,
      );
      created.viewingId = viewing.id;
      await expectJson(await agent.updateViewing(viewing.id, { status: 'done' }), 200);
      const saved = (await expectJson<{ id: number; status: string }[]>(await agent.viewings(created.leadId), 200)).find((row) => row.id === viewing.id);
      expect(saved?.status).toBe('done');
    });

    await test.step('3. ข้อเสนอ: ห้อง scout ส่งให้เจ้าของในแอปไม่ได้ นายหน้าบันทึกว่าเจ้าของยืนยันทางโทรศัพท์', async () => {
      const offer = await expectJson<IdBody & { revision: number }>(
        await agent.createOffer({
          leadId: created.leadId,
          rentRoomId: created.roomId,
          monthlyRent: DEAL.monthlyRent,
          termMonths: DEAL.termMonths,
          startDate,
          depositAmount: DEAL.depositAmount,
          contractDate: startDate,
          rentDueDay,
          coBroke: false,
        }),
        201,
      );
      created.offerId = offer.id;
      // ห้อง scout ไม่มีเจ้าของในแอป (deal-offers.service.ts บรรทัด 483)
      await expectCodedError(await agent.sendOffer(offer.id, { revision: offer.revision }), 400, 'OFFER_NO_LANDLORD_APP');
      await expectJson(await agent.confirmOffer(offer.id, { revision: offer.revision, method: 'phone', note: `${label} confirmed by phone` }), 200);
      const saved = (await expectJson<{ id: number; status: string }[]>(await agent.offers(created.leadId!), 200)).find((row) => row.id === offer.id);
      expect(saved?.status).toBe('confirmed');
    });

    await test.step('4. ผู้เช่า: ผูกกับอีเมลของ qa-e2e-tenant แล้วลีดเป็น booked', async () => {
      created.tenantId = (
        await expectJson<IdBody>(
          await agent.createTenant({
            leadId: created.leadId,
            rentRoomId: created.roomId,
            firstName: `${label} Tenant`,
            phone: TEST_PHONE,
            email: qaE2eTenant.email,
            identityNumber: TEST_THAI_ID,
            nationality: 'Thai',
          }),
          201,
        )
      ).id;
      expect((await expectJson<{ status: string }>(await agent.lead(created.leadId!), 200)).status).toBe('booked');
    });

    await test.step('5. หนังสือแต่งตั้งนายหน้า: นายหน้าลงนามแทนเจ้าของที่หน้างาน แล้วออกเอกสาร', async () => {
      const defaults = await expectJson<Record<string, unknown>>(await agent.defaults('broker-appointment', created.leadId!), 200);
      const ba = await expectJson<IdBody>(
        await agent.createContract({ leadId: created.leadId, agreementTypeCode: 'broker_appointment', startDate: today, data: { brokerAppointment: defaults } }),
        201,
      );
      created.brokerAppointmentId = ba.id;
      await expectJson(await agent.preview(ba.id, 'broker-appointment'), 200);
      await expectJson(await agent.sign(ba.id, { parties: ['owner', 'agent'], signaturePng: SIGNATURE }), 200);
      await expectJson(await agent.generate(ba.id, 'broker-appointment'), 200);
      expect((await contract(ba.id)).status).toBe('active');
    });

    await test.step('6. หนังสือจอง: สลิป ใบเสร็จ เอกสารแนบ ส่งให้คู่สัญญา ลงนาม 3 ฝ่าย แล้วออกเอกสาร', async () => {
      const defaults = await expectJson<Record<string, unknown> & { termFrom: string; reservationPayment: string | number }>(
        await agent.defaults('reservation', created.leadId!),
        200,
      );
      expect(defaults.termFrom, 'วันเริ่มเช่าในหนังสือจองมาจากข้อเสนอ').toBe(startDate);
      const letter = { ...defaults, landlordEmail: qaE2eLandlord.email, landlordPhone: TEST_PHONE, paymentMethod: 'transfer' };
      const reservation = await expectJson<IdBody>(
        await agent.createContract({
          leadId: created.leadId,
          agreementTypeCode: 'reservation',
          // วันจองต้องไม่หลังวันเข้าอยู่ ("วันที่เข้าอยู่ต้องไม่ก่อนวันที่จอง") จึงจองย้อนหลังวันเดียวกับวันเริ่มเช่า
          startDate,
          moveInDate: defaults.termFrom,
          reservationFee: Number(defaults.reservationPayment),
          data: { reservationLetter: letter },
        }),
        201,
      );
      const id = reservation.id;
      created.reservationId = id;
      await expectJson(await agent.preview(id, 'reservation'), 200);
      expect(await myContractIds(tenant.contracts()), 'qa-e2e-tenant เห็นหนังสือจองในบัญชีของตัวเอง').toContain(id);
      await expectJson(await tenant.reservationSlip(id, upload(png(label, 'reservation-slip'))), 200);

      // ระดับ 2: ตีกลับสลิปจองก่อนออกใบเสร็จ (คำตอบสัญญามี submittedAt เมื่อมีใบแจ้งหนี้ค่าจอง 928-935 ซึ่งต้องมีก่อนส่งสลิป 2790)
      const firstSlipAt = (await contract(id)).reservationPayment?.submittedAt;
      expect(firstSlipAt, 'ผู้เช่าส่งสลิปจองแล้ว คำตอบสัญญาต้องมี submittedAt').toEqual(expect.any(String));
      // CGP-046 (R14): submittedAt ไม่ตรงสลิปล่าสุด → 409 ก่อนเขียน (2532, 211-216)
      await expectCodedError(await agent.returnReservationSlip(id, { reason: `${label} cgp-046`, submittedAt: STALE_SLIP_AT }), 409, 'SLIP_CHANGED');
      // CGP-047 (R14, Q4): ไม่ส่ง submittedAt ค่าที่ถูกคือ 400 ตอนนี้ได้ 409 (บั๊กที่ทีมรับแล้ว 12 พ.ย. 2026 แก้หลังพ้น freeze ของ API)
      //   เทสนี้เป็นข้อเดียวทั้งวงจร ใส่ test.fail ไม่ได้ จึงรับทั้ง 2 รหัส (Aof ตัดสิน 12 พ.ย. 2026) และบอกรหัสที่ได้ใน annotation
      //   ไม่เขียนทั้ง 2 กรณี: 409 มาจาก assertSameSlip ก่อนเขียน ส่วน 400 หลังทีมแก้คือการตรวจเนื้อคำขอ
      const noStamp = await agent.returnReservationSlip(id, { reason: `${label} cgp-047` });
      expect([400, 409], 'ไม่ส่ง submittedAt ต้องถูกปฏิเสธ').toContain(noStamp.status());
      //   409 ต้องเป็น SLIP_CHANGED ของ assertSameSlip เท่านั้น ; 400 บอกข้อความใน annotation เพื่อแยกว่าทีมแก้แล้วหรือถูกปฏิเสธด้วยเหตุอื่น
      //   (เช่น "ยังไม่มีสลิปที่ส่งมาให้ตีกลับ" 2531 ถ้าสลิปหาย ซึ่งการตรวจ submittedAt ข้างล่างจับได้)
      //   400 อ่าน message แบบรับได้ทั้ง { statusCode, message } และ { code, message } (ทีมอาจแก้ด้วย object แบบ SLIP_CHANGED 215)
      //   ไม่ใช้ expectError ที่บังคับ statusCode เพราะจะล้มแบบหยุดเทสกลางขั้น 6 ทั้งที่ทีมแก้ถูก
      const noStampDetail = noStamp.status() === 409
        ? await expectCodedError(noStamp, 409, 'SLIP_CHANGED')
        : String(((await noStamp.json().catch(() => null)) as { message?: unknown } | null)?.message ?? '');
      testInfo.annotations.push({ type: 'CGP-047 known-bug Q4', description: `ตีกลับสลิปจองโดยไม่ส่ง submittedAt ได้ ${noStamp.status()} "${noStampDetail}" (ค่าที่ถูก 400 ถ้าได้ 400 ด้วยข้อความเรื่อง submittedAt แปลว่าทีมแก้แล้ว ให้เปลี่ยนเทสเป็นรับ 400 อย่างเดียว)` });
      expect((await contract(id)).reservationPayment?.submittedAt, 'คำขอที่ถูกปฏิเสธต้องไม่เปลี่ยนสลิป').toBe(firstSlipAt);
      // CGP-048 (R13, R15): ตีกลับด้วย submittedAt จริง (2527-2537) แล้วผู้เช่าส่งสลิปใหม่
      await expectJson(await agent.returnReservationSlip(id, { reason: `${label} cgp-048`, submittedAt: firstSlipAt }), 200);
      const returned = (await contract(id)).reservationPayment;
      expect(returned?.status, 'ตีกลับแล้วเงินจองกลับเป็นยังไม่ชำระ').toBe('unpaid');
      expect(returned?.slipReturnReason, 'ผู้เช่าเห็นเหตุผลที่ตีกลับ').toBe(`${label} cgp-048`);
      await expectJson(await tenant.reservationSlip(id, upload(png(label, 'reservation-slip-2'))), 200);
      const resent = (await contract(id)).reservationPayment;
      expect(resent?.status, 'ผู้เช่าส่งสลิปใหม่แล้ว').toBe('submitted');
      expect(resent?.submittedAt, 'สลิปใหม่ต้องเป็นคนละรอบกับสลิปแรก').not.toBe(firstSlipAt);
      await expectJson(
        await agent.financialDocument(id, 'receipt', { receivedBy: 'landlord', paymentMethod: 'transfer', paymentDetails: `${label} bank transfer` }),
        200,
      );
      expect((await contract(id)).reservationPayment?.status, 'ออกใบเสร็จเงินจองแล้ว').toBe('paid');
      // CGP-049 (R15): ออกใบเสร็จแล้วตีกลับไม่ได้ (2529) กันชั้นที่ 2: submittedAt ปลอมได้ 409 ก่อนเขียน (2532 อยู่หลัง 2529)
      expect(
        await expectError(await agent.returnReservationSlip(id, { reason: `${label} cgp-049`, submittedAt: STALE_SLIP_AT }), 400),
      ).toBe('ออกใบเสร็จแล้ว ตีกลับสลิปไม่ได้');
      const attached = await expectJson<AttachmentChecklist>(
        await agent.attach(id, upload(pdf(label, 'ownership')), 'ownership_proof', 'property'),
        201,
      );
      // CGP-050 (R25): ตรวจเอกสารแนบได้ครั้งเดียว (agreement-attachments.service.ts 389-422) ใช้ accepted เพราะ rejected อาจบล็อกขั้นถัดไปถ้าทีมเปลี่ยนกติกา B3
      const proof = attached.documents.find((doc) => doc.documentTypeCode === 'ownership_proof' && doc.reviewStatus === 'pending');
      expect(proof, 'เอกสารสิทธิ์ที่เพิ่งแนบต้องรอตรวจ').toBeDefined();
      await expectJson(await agent.reviewAttachment(id, proof!.id, { status: 'accepted' }), 201);
      expect(await expectError(await agent.reviewAttachment(id, proof!.id, { status: 'accepted' }), 409)).toBe('เอกสารนี้ตรวจแล้วหรือมีฉบับใหม่แล้ว');
      await expectJson(await agent.deliver(id, 'tenant'), 200);
      await expectJson(await agent.deliver(id, 'owner'), 200);
      const delivered = await contract(id);
      expect(delivered.tenantDeliveredAt).toEqual(expect.any(String));
      expect(delivered.ownerDeliveredAt).toEqual(expect.any(String));
      await expectJson(await agent.sign(id, { parties: ['agent'], signaturePng: SIGNATURE }), 200);
      await expectJson(await tenant.sign(id, 'tenant', SIGNATURE), 200);
      await expectJson(await landlord.sign(id, 'owner', SIGNATURE), 200);
      expect((await contract(id)).status, 'ลงนามครบ 3 ฝ่ายแล้วรอนายหน้าตรวจ').toBe('awaiting_agent_review');
      await expectJson(await agent.generate(id, 'reservation'), 200);
      expect((await contract(id)).status).toBe('active');
    });

    await test.step('7. สัญญาเช่า: บัตรประชาชน 2 ฝ่าย ส่งให้คู่สัญญา ลงนาม พยานลงนาม แล้วออกเอกสาร', async () => {
      const defaults = await expectJson<Record<string, unknown> & { termFrom: string; termTo: string; monthlyRent: string | number; depositAmount: string | number }>(
        await agent.defaults('lease', created.leadId!),
        200,
      );
      expect(defaults.termFrom).toBe(startDate);
      expect(Number(defaults.monthlyRent)).toBe(DEAL.monthlyRent);
      expect(Number(defaults.depositAmount)).toBe(DEAL.depositAmount);
      const lease = await expectJson<IdBody>(
        await agent.createContract({
          leadId: created.leadId,
          agreementTypeCode: 'lease',
          startDate: defaults.termFrom,
          endDate: defaults.termTo,
          monthlyRent: Number(defaults.monthlyRent),
          deposit: Number(defaults.depositAmount),
          data: { leaseAgreement: defaults },
        }),
        201,
      );
      const id = lease.id;
      created.leaseId = id;
      // CGP-051 (R9): แก้ร่างด้วยรุ่นที่ไม่ตรง → 409 ก่อนเขียน (agent-contracts.service.ts 3680-3681 หลัง assertDraft 3677)
      //   กันชั้นที่ 2: body ไม่มี leadId จึงได้ 400 ที่ 3681-3684 ก่อนเขียน ถ้าการตรวจรุ่นหาย
      expect(await expectError(await agent.updateDraft(id, { expectedDraftRevision: `${label} cgp-051` }), 409)).toBe('ฉบับร่างถูกแก้ไขแล้ว กรุณาเปิดใหม่ก่อนบันทึก');
      // CGP-052 (R20): สัญญาเช่าใหม่ไม่มีฉบับก่อนหน้า (agreement-attachments.service.ts 436-443 ตรวจก่อนอ่านเอกสารเดิม 450)
      //   กันชั้นที่ 2: sourceDocumentId ไม่มีจริง จึงได้ 404 ที่ 457-458 ก่อนดาวน์โหลดและอัปโหลด
      expect(
        await expectError(await agent.reuseAttachment(id, { confirmedCurrent: true, sourceDocumentId: NO_SUCH_ID }), 400),
      ).toBe('สัญญานี้ไม่มีฉบับก่อนหน้า');
      for (const subject of ['owner', 'tenant']) {
        await expectJson(await agent.attach(id, upload(pdf(label, `${subject}-id`)), 'national_id', subject), 201);
      }
      await expectJson(await agent.preview(id, 'lease'), 200);
      // CGP-053 (R24, Q2): ชื่อไฟล์ที่มีอักขระของ SQL อัปโหลดได้และเก็บชื่อตรงตามที่ส่ง (2131-2181 ต่อชื่อเข้า SQL ที่ 2173)
      //   ทีมยืนยัน 12 พ.ย. 2026 ว่าตอนนี้ escape ' เป็น '' และ Postgres เปิด standard_conforming_strings จะเปลี่ยนเป็นพารามิเตอร์หลังพ้น freeze
      //   ชื่อมีแค่ ' กับ );-- ไม่มี " และ \ เพราะส่งผ่าน multipart ไม่ได้: Playwright 1.63 ใส่ชื่อใน filename="..." โดยไม่ escape
      //   (node_modules/playwright-core/lib/coreBundle.js 14280) และ busboy ถือ " เป็นจุดจบของชื่อ และ \ เป็นตัว escape
      //   (node_modules/busboy/lib/utils.js 317-333) ชื่อที่ถึง API จะไม่ตรงกับที่ส่ง ซึ่งไม่ใช่สิ่งที่เคสนี้ตั้งใจเทส (test-reviewer 12 พ.ย. 2026)
      //   053 และ 054 ใช้ expect.soft: ขั้นถัดไปไม่ขึ้นกับผลของ 2 เคสนี้ (preview ข้างล่างสร้างไฟล์ร่างใหม่) วงจรจึงเดินต่อจนจบและเทสยังแดงถ้าผิด
      const sqlName = `${label}-cgp-053 ' );--.pdf`;
      const sqlUpload = await agent.uploadDocument(id, 'lease_agreement', { ...pdf(label, 'cgp-053'), name: sqlName });
      //   ถ้าไม่ได้ 200 ใส่ message ในข้อความ (คำตอบ error ไม่มี URL ของ Storage ; คำตอบ 200 มี จึงไม่พิมพ์)
      const sqlError = sqlUpload.ok() ? '' : String(((await sqlUpload.json().catch(() => null)) as { message?: unknown } | null)?.message ?? '');
      expect.soft(sqlUpload.status(), `อัปโหลดชื่อไฟล์ที่มีอักขระของ SQL ต้องได้ 200 ${sqlError}`).toBe(200);
      if (sqlUpload.ok()) upload(null);
      const fileNames = () => contract(id).then((view) => (view.data.documentFileNames ?? {}) as Record<string, unknown>);
      expect.soft((await fileNames()).lease_agreement, 'ชื่อไฟล์ที่เก็บต้องตรงตามที่ส่ง').toBe(sqlName);
      // CGP-054 (R24, Q2): ชื่อไฟล์ที่มีตัว NUL ทีมคาดว่าได้ 500 (jsonb ไม่รับ \u0000) ถ้าได้ 500 ให้จดเป็นบั๊ก
      //   รอบแรกยังไม่ตรวจรหัส (Aof ตัดสิน 12 พ.ย. 2026) ; Postgres เก็บตัว NUL ไม่ได้อยู่แล้ว จึงตรวจแทนว่า:
      //   ถูกปฏิเสธ = ชื่อที่เก็บต้องเท่าเดิม (ไม่มีการเขียน) ; ได้ 200 = บอกชื่อที่เก็บใน annotation (แทน NUL ด้วย <NUL>)
      //   ถ้า busboy ทิ้งส่วนของไฟล์ API ตอบ 400 "กรุณาเลือกไฟล์เอกสาร" ก่อนอัปโหลด (contract-document-storage.service.ts upload)
      //   ถ้า UPDATE ล้ม API ลบไฟล์ที่เพิ่งอัปโหลด (2178-2180)
      //   annotation แยกได้ว่าถูกปฏิเสธที่ตัวแยก multipart หรือที่ฐานข้อมูล เฉพาะเมื่อข้อความต่างกัน (อนุมาน: ถ้า busboy โยน error ที่ส่วนหัว
      //   NestJS อาจตอบ 500 "Internal server error" เหมือน 500 ของ jsonb) ถ้าได้ 500 ให้ดู log ของ API ประกอบก่อนสรุปว่าเป็นบั๊ก
      const beforeNul = (await fileNames()).lease_agreement;
      const nulResponse = await agent.uploadDocument(id, 'lease_agreement', { ...pdf(label, 'cgp-054'), name: `${label}-cgp-054 \u0000.pdf` });
      const afterNul = (await fileNames()).lease_agreement;
      if (nulResponse.ok()) {
        upload(null);
        testInfo.annotations.push({ type: 'CGP-054 ชื่อไฟล์มีตัว NUL', description: `ได้ ${nulResponse.status()} ชื่อที่เก็บ "${String(afterNul).replace(/\u0000/g, '<NUL>')}" (ทีมคาด 500)` });
      } else {
        const body = (await nulResponse.json().catch(() => null)) as { message?: unknown } | null;
        testInfo.annotations.push({ type: 'CGP-054 ชื่อไฟล์มีตัว NUL', description: `ได้ ${nulResponse.status()} "${String(body?.message ?? '')}" (ทีมคาด 500 ถ้าได้ 500 จดเป็นบั๊ก)` });
        expect.soft(afterNul, 'คำขอที่ถูกปฏิเสธต้องไม่แก้ชื่อที่เก็บ').toBe(beforeNul);
      }
      // สร้างไฟล์ร่างใหม่หลังอัปโหลด: deliver ไม่ใช้ไฟล์ของเอกสาร (2692-2738) แต่ลิงก์เอกสารที่คู่สัญญาเห็นถอยไปใช้ document_url
      //   ที่อัปโหลด (917-923) จึงคืนเป็นไฟล์ร่างก่อนส่งให้คู่สัญญา
      await expectJson(await agent.preview(id, 'lease'), 200);
      await expectJson(await agent.deliver(id, 'tenant'), 200);
      await expectJson(await agent.deliver(id, 'owner'), 200);
      const delivered = await contract(id);
      expect(delivered.tenantDeliveredAt).toEqual(expect.any(String));
      expect(delivered.ownerDeliveredAt).toEqual(expect.any(String));
      await expectJson(await tenant.sign(id, 'tenant', SIGNATURE), 200);
      await expectJson(await landlord.sign(id, 'owner', SIGNATURE), 200);
      await expectJson(await agent.witnessSign(id, { asAgent: true, signaturePng: SIGNATURE }), 201);
      await expectJson(await agent.generate(id, 'lease'), 200);
      expect((await contract(id)).status, 'ออกสัญญาเช่าแล้วรอรับมัดจำ').toBe('awaiting_deposit');
    });

    await test.step('8. มัดจำ: ผู้เช่าส่งสลิป นายหน้าออกใบเสร็จ', async () => {
      const id = created.leaseId!;
      const deposit = (await contract(id)).depositPayment;
      expect(deposit?.invoiceId, 'ออกสัญญาเช่าแล้วต้องมีใบแจ้งหนี้มัดจำ').toEqual(expect.any(Number));
      expect(deposit?.total).toBe(DEAL.depositAmount);
      created.depositInvoiceId = deposit!.invoiceId;
      // ระดับ 2: เลื่อนวันส่งมอบระหว่างรอเงินประกัน (agent-contracts.service.ts 2481-2513)
      //   วันส่งมอบเดิมคือวันเริ่มสัญญาซึ่งย้อนหลัง 1 เดือน (handoverDueDate ใน reminders/contract-reminders.ts 68-69)
      //   จึงเลื่อนกลับวันเดิมไม่ได้ ("ต้องไม่ก่อนวันนี้" 2487) หลังขั้นนี้วันส่งมอบค้างที่วันนี้ +7 ซึ่งใช้แค่ในการเตือน (contract-reminders.ts 92)
      const movedDue = bangkokDate(7);
      const historyBefore = (await contract(id)).handoverDue?.history.length ?? 0;
      // CGP-056 (R21): เลื่อนไปวันนี้ +7
      await expectJson(await agent.moveHandoverDue(id, { date: movedDue, reason: `${label} cgp-056` }), 200);
      const due = (await contract(id)).handoverDue;
      expect(due?.date, 'วันส่งมอบใหม่').toBe(movedDue);
      expect(due?.history.length, 'ประวัติการเลื่อนเพิ่ม 1 รายการ').toBe(historyBefore + 1);
      // CGP-055 (R21): วันเดียวกับวันส่งมอบปัจจุบัน → 400 ก่อนเขียน (2499-2500)
      expect(await expectError(await agent.moveHandoverDue(id, { date: movedDue, reason: `${label} cgp-055` }), 400)).toBe('วันส่งมอบใหม่ต้องต่างจากวันเดิม');
      await expectJson(await tenant.depositSlip(id, upload(png(label, 'deposit-slip'))), 200);
      // ระดับ 2: ตีกลับสลิปมัดจำก่อนออกใบเสร็จ (2562-2580) คำตอบสัญญามี depositPayment.submittedAt (1005)
      const firstDepositSlipAt = (await contract(id)).depositPayment?.submittedAt;
      expect(firstDepositSlipAt, 'ผู้เช่าส่งสลิปมัดจำแล้ว คำตอบสัญญาต้องมี submittedAt').toEqual(expect.any(String));
      // CGP-057 (R13-R15): submittedAt ปลอม → 409 ก่อนเขียน แล้วตีกลับด้วยค่าจริง แล้วผู้เช่าส่งสลิปใหม่
      await expectCodedError(await agent.returnDepositSlip(id, { reason: `${label} cgp-057`, submittedAt: STALE_SLIP_AT }), 409, 'SLIP_CHANGED');
      await expectJson(await agent.returnDepositSlip(id, { reason: `${label} cgp-057`, submittedAt: firstDepositSlipAt }), 200);
      expect((await contract(id)).depositPayment?.submittedAt, 'ตีกลับแล้วไม่มีสลิปค้าง').toBeNull();
      await expectJson(await tenant.depositSlip(id, upload(png(label, 'deposit-slip-2'))), 200);
      const resentDeposit = (await contract(id)).depositPayment;
      expect(resentDeposit?.status, 'ผู้เช่าส่งสลิปมัดจำใหม่แล้ว').toBe('submitted');
      expect(resentDeposit?.submittedAt, 'สลิปมัดจำใหม่ต้องมี submittedAt').toEqual(expect.any(String));
      expect(resentDeposit?.submittedAt, 'สลิปใหม่ต้องเป็นคนละรอบกับสลิปแรก').not.toBe(firstDepositSlipAt);
      await expectJson(
        await agent.invoiceReceipt(created.depositInvoiceId!, { paymentMethod: 'transfer', paymentDetails: `${label} deposit transfer`, receivedBy: 'landlord' }),
        200,
      );
      const after = await contract(id);
      expect(after.depositPayment?.status).toBe('paid');
      expect(after.status, 'รับมัดจำแล้วรอส่งมอบห้อง').toBe('awaiting_handover');
      // CGP-058 (R15): ออกใบเสร็จมัดจำแล้วตีกลับไม่ได้ (2573) กันชั้นที่ 2: submittedAt ปลอม
      expect(
        await expectError(await agent.returnDepositSlip(id, { reason: `${label} cgp-058`, submittedAt: STALE_SLIP_AT }), 400),
      ).toBe('ออกใบเสร็จแล้ว ตีกลับสลิปไม่ได้');
    });

    await test.step('9. ส่งมอบห้อง: นายหน้าบันทึกรายการกับรูป ผู้เช่าและเจ้าของลงนาม สัญญาเริ่ม', async () => {
      const id = created.leaseId!;
      // อัปโหลดรูปเพิ่ม revision จึงอ่าน revision ล่าสุดก่อนบันทึกและก่อนลงนามทุกครั้ง
      await expectJson(
        await agent.saveHandover(id, { revision: (await handover(id, false)).revision, handoverDate: today, items: [{ name: `${label} key`, quantity: 2, condition: 'good' }] }),
        200,
      );
      await expectJson(await agent.handoverPhoto(id, upload(png(label, 'move-in')), false), 201);
      // CGP-059 (R23): ลบรูปก่อนลงนาม แล้วอัปใหม่ (handover.service.ts 290-297, 377-391)
      const photos = (await handover(id, false)).photos;
      expect(photos.length, 'มีรูปที่เพิ่งอัป 1 รูป').toBe(1);
      await expectJson(await agent.removeHandoverPhoto(id, photos[0].id), 200);
      expect((await handover(id, false)).photos.length, 'ลบแล้วไม่เหลือรูป').toBe(0);
      await expectJson(await agent.handoverPhoto(id, upload(png(label, 'move-in-2')), false), 201);
      const revision = (await handover(id, false)).revision;
      await expectJson(await tenant.signHandover(id, 'tenant', SIGNATURE, revision), 200);
      await expectJson(await landlord.signHandover(id, 'owner', SIGNATURE, revision), 200);
      expect((await handover(id, false)).status).toBe('completed');
      expect((await contract(id)).status).toBe('active');
      // CGP-060 (R21): ส่งมอบแล้วเลื่อนวันส่งมอบไม่ได้ (2496-2498 อ่านสถานะใน transaction ก่อนเขียน)
      expect(
        await expectError(await agent.moveHandoverDue(id, { date: '2099-01-01', reason: `${label} cgp-060` }), 400),
      ).toBe('เลื่อนวันส่งมอบได้เฉพาะสัญญาเช่าที่รอเงินประกันหรือรอส่งมอบห้อง');
    });

    await test.step('10. บิลค่าเช่าเดือนนี้: ผู้เช่าส่งสลิป นายหน้ายืนยัน เจ้าของเห็นว่าชำระแล้ว', async () => {
      const id = created.leaseId!;
      // ตั้งแต่ d2d4554 GET /bills/mine อ่านอย่างเดียว ต้องสั่งออกบิลที่ถึงกำหนดก่อน (แบบเดียวกับที่แอปเรียกก่อนเปิดหน้าบิล)
      await expectJson(await tenant.refreshMyBills(), 200);
      // เรียกซ้ำต้องไม่ออกบิลเพิ่ม: issued คือจำนวนแถวที่ INSERT ... orIgnore() คืนจริง (result.raw.length)
      //   ใน insertBills ของ apps/api/src/billing/tenant-billing.service.ts บรรทัด 289-291 ที่ qa/e2e 648dd28 แถวที่ชนกันไม่ถูกนับ
      expect(await expectJson<{ issued: number }>(await tenant.refreshMyBills(), 200), 'เรียก refresh ซ้ำ').toEqual({ issued: 0 });
      const bills = (await expectJson<BillView[]>(await tenant.myBills(), 200)).filter((bill) => bill.leaseContractId === id);
      const seen = JSON.stringify(bills.map((bill) => [bill.period, bill.status, bill.amount]));
      // วันเริ่มย้อนหลัง 1 เดือน: บิลเดือนแรก (หักเงินจองเต็มจำนวน จึงยอด 0 และ paid) กับบิลเดือนนี้ (ยอดเต็ม ยังไม่ชำระ)
      // oneMonthBack ตัดวันที่ที่ 28 บิลเดือนนี้จึงครบกำหนดในเดือนของวันนี้เสมอ
      expect(bills, `บิลของสัญญานี้: ${seen}`).toHaveLength(2);
      expect(bills.find((bill) => bill.period === startDate.slice(0, 7)), `บิลเดือนแรก: ${seen}`).toMatchObject({ amount: 0, status: 'paid' });
      const due = bills.find((bill) => bill.period === today.slice(0, 7));
      expect(due, `บิลเดือนนี้: ${seen}`).toMatchObject({ amount: DEAL.monthlyRent, status: 'pending' });
      created.rentBillId = due!.id;
      await expectJson(await tenant.billSlip(due!.id, upload(png(label, 'rent-slip'))), 200);
      await expectJson(await tenant.confirmBillSlip(due!.id), 200);
      await expectJson(await agent.confirmBill(due!.id), 200);
      const paid = (await expectJson<BillView[]>(await tenant.myBills(), 200)).find((bill) => bill.id === due!.id);
      expect(paid?.status).toBe('paid');
      const received = (await expectJson<BillView[]>(await landlord.receivedBills(), 200)).find((bill) => bill.id === due!.id);
      expect(received?.status, 'qa-e2e-landlord เห็นบิลเดียวกันว่าชำระแล้ว').toBe('paid');
    });

    await test.step('11. แจ้งย้ายออกวันนี้: สัญญายัง active และมีวันสิ้นสุด', async () => {
      const id = created.leaseId!;
      await expectJson(await agent.earlyEnd(id, { date: today, reason: `${label} tenant moves out early` }), 200);
      const after = await contract(id);
      expect(after.status).toBe('active');
      expect(after.data.endsOn?.date).toBe(today);
    });

    await test.step('12. ส่งคืนห้อง: นายหน้าบันทึกรายการกับรูป ผู้เช่าและเจ้าของลงนาม', async () => {
      const id = created.leaseId!;
      await expectJson(
        await agent.saveHandover(id, { revision: (await handover(id, true)).revision, handoverDate: today, items: [{ name: `${label} key`, quantity: 2, condition: 'good' }] }, true),
        200,
      );
      await expectJson(await agent.handoverPhoto(id, upload(png(label, 'move-out')), true), 201);
      const revision = (await handover(id, true)).revision;
      await expectJson(await tenant.signHandover(id, 'tenant', SIGNATURE, revision, true), 200);
      await expectJson(await landlord.signHandover(id, 'owner', SIGNATURE, revision, true), 200);
      expect((await handover(id, true)).status).toBe('completed');
    });

    await test.step('13. คืนมัดจำ: หัก 1,000 บาท อนุมัติ แนบหลักฐาน ผู้เช่าเห็นยอดคืน', async () => {
      const id = created.leaseId!;
      const opened = await expectJson<SettlementView>(await agent.openSettlement(id), 200);
      expect(opened.status).toBe('draft');
      expect(Number(opened.depositReceived)).toBe(DEAL.depositAmount);
      await expectJson(await agent.addDeduction(id, upload(png(label, 'damage')), 'damage', `${label} wall repair`, String(DEDUCTION)), 201);
      const refund = DEAL.depositAmount - DEDUCTION;
      await expectJson(await agent.approveSettlement(id, { note: `${label} approved`, refundAmount: refund }), 200);
      await expectJson(await agent.refundSettlement(id, upload(png(label, 'refund-received')), upload(png(label, 'refund-transfer'))), 200);
      const seen = await expectJson<SettlementView>(await tenant.settlement(id), 200);
      expect(seen.status).toBe('completed');
      expect(Number(seen.deductionTotal)).toBe(DEDUCTION);
      expect(Number(seen.refundAmount)).toBe(refund);
    });

    await test.step('14. ตัวนับหลังรัน: qa-e2e-tenant และ qa-e2e-landlord เห็นสัญญาเพิ่ม 2 ฉบับพอดี', async () => {
      const expected = [created.reservationId!, created.leaseId!];
      const tenantAfter = await myContractIds(tenant.contracts());
      const landlordAfter = await myContractIds(landlord.contracts());
      expect(tenantAfter.filter((id) => !tenantBefore.includes(id)).sort()).toEqual([...expected].sort());
      expect(landlordAfter.filter((id) => !landlordBefore.includes(id)).sort()).toEqual([...expected].sort());
      // หนังสือแต่งตั้งนายหน้าเป็นเอกสารระหว่างเจ้าของห้อง scout กับนายหน้า ไม่อยู่ในบัญชีของผู้เช่า
      expect(tenantAfter).not.toContain(created.brokerAppointmentId);
    });
  } finally {
    testInfo.annotations.push(
      { type: 'ป้ายของรอบ', description: label },
      { type: 'วันเริ่มสัญญา', description: `${startDate} (ครบกำหนดชำระทุกวันที่ ${rentDueDay})` },
      { type: 'id ที่สร้าง', description: JSON.stringify(created) },
      { type: 'อัปโหลด', description: `${uploads} ไฟล์` },
    );
  }
});
