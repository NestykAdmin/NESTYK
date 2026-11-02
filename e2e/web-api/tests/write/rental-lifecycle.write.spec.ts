import type { APIResponse } from '@playwright/test';
import { qaAccounts } from '../../src/config/qa-accounts';
import { expectCodedError, expectJson } from '../../src/support/http';
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
 * เทสวงจรเช่าห้องครบวงจรผ่าน API (end-to-end) ด้วย 3 บัญชี: qa-agent, qa-tenant และ qa-landlord
 *
 * ลำดับ (ยืนยันโดยเดินทีละขั้นในห้องทดลองกับ API ที่ develop bc77a8b และที่เก็บไฟล์จำลอง 2 พ.ย. 2026)
 *   ห้อง > ลีด > นัดดูห้อง > ข้อเสนอ > ผู้เช่า > หนังสือแต่งตั้งนายหน้า > หนังสือจอง > สัญญาเช่า > มัดจำ
 *   > ส่งมอบห้อง > บิลค่าเช่า > แจ้งย้ายออก > ส่งคืนห้อง > คืนมัดจำ
 *
 * สิ่งที่ต้องมีก่อนรัน (README หัวข้อ "เทสที่เขียนข้อมูล")
 *   - E2E_ALLOW_WRITES=yes npm run test:write และตั้ง E2E_QA_AGENT_UUID, E2E_QA_TENANT_UUID, E2E_QA_LANDLORD_UUID
 *   - ทีมตกลงเรื่องข้อมูล E2E- ในฐานข้อมูลและ Storage ของ dev แล้ว (TEAM_DB_WRITES_AGREED = true ตั้งแต่ 2 พ.ย. 2026)
 *     ถ้าเปลี่ยนกลับเป็น false ต้องตั้ง E2E_WRITE_TARGET=own-db และ API ต้องต่อฐานข้อมูลของ QA เอง
 *   - API ต้องต่อที่เก็บไฟล์ (Supabase Storage) ได้ เพราะเกือบทุกขั้นอัปโหลดหรือสร้าง PDF
 *   - ถ้าค่าคงที่เป็น false: SUPABASE_URL ใน .env.api ต้องชี้เครื่องนี้ด้วย (assertEnvFileStorageIsLocal ใน write-guard.ts ตรวจใน fixture)
 *   - ไม่เริ่มรันช่วง 23:50 ถึง 00:10 เวลากรุงเทพ (เทสข้ามพร้อมเหตุผล ดู nearMidnightReason ใน lifecycle-data.ts)
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
 *   ตัวนับก่อนกับหลังรัน: สัญญาที่ qa-tenant และ qa-landlord เห็นต้องเพิ่มรอบละ 2 (จองกับเช่า) พอดี
 *   รันซ้ำได้: ทุกรอบสร้างชุดใหม่ ผู้เช่าทุกรอบใช้อีเมลของ qa-tenant กับเลขบัตรเดียวกัน (ลองในห้องทดลอง 3 รอบติดกัน ผ่านทุกรอบ)
 *
 * ข้อมูลที่ 1 รอบแก้ (ตัวนับแถวไม่เห็น เพราะนับแค่จำนวน)
 *   - แถว users ของ qa-tenant และ qa-landlord: ตอนสร้างหนังสือจอง API ผูกคู่สัญญากับบัญชีด้วยอีเมล (ensurePartyLogin
 *     ใน agent-contracts.service.ts บรรทัด 3755-3777) และเขียนทับชื่อ นามสกุล เลขบัตร สัญชาติ และเบอร์ถ้าว่าง
 *     (party-login.ts บรรทัด 196-205) ชื่อที่แสดงของ 2 บัญชีนี้จึงเป็นชื่อของรอบล่าสุด เช่น E2E-LC-<รหัสรอบ> Tenant
 *   - ลีดของรอบได้ booking_released_at ตอนแจ้งย้ายออก (agent-contracts.service.ts บรรทัด 2261-2264)
 *   - หลังจบรอบ ถ้ามี API ตัวใดตัวหนึ่งที่ต่อฐานข้อมูลเดียวกันเปิดอยู่ตอน 00:05 (บนฐานข้อมูล dev รวม API ของทีม) งานตั้งเวลาปิดสัญญาเช่าของรอบนี้ (persistEndedLeases ใน tenant-billing.scheduler.ts
 *     บรรทัด 12-17 ซึ่งเป็นผู้เรียกเดียว) ถ้าไม่เปิด สัญญาค้างเป็น active ในบัญชีของ qa-tenant จนกว่าจะเปิด API ข้ามเวลานั้น
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
const missing = [qaAccounts.tenant, qaAccounts.landlord].filter((account) => account.uuid === null).map((account) => account.uuidVariable);
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
  reservationPayment: { status?: string } | null;
  tenantDeliveredAt: string | null;
  ownerDeliveredAt: string | null;
  depositPayment: { status?: string; invoiceId?: number; total?: number } | null;
}
interface HandoverView {
  status: string;
  revision: number;
  photos: unknown[];
}
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
 * ทำไมต้องตรวจ: ขั้น 10 เรียก GET /bills/mine และ /bills/received ซึ่งออกบิลให้ทุกสัญญาของบัญชีนั้น ไม่ใช่แค่ของรอบนี้
 *   ข้อตกลงกับทีม (ฉบับที่ 8, 2 พ.ย. 2026) ครอบเฉพาะข้อมูล E2E- จึงหยุดก่อนเขียนถ้าบัญชี qa-tenant หรือ qa-landlord มีสัญญาอื่น
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
    'qa-tenant หรือ qa-landlord มีสัญญาที่ไม่ใช่ของเทส (id ตามนี้) ให้ถามทีมก่อนรัน เพราะขั้น 10 จะออกบิลให้สัญญาเหล่านี้ด้วย',
  ).toEqual([]);
  const tenantBefore = tenantExisting.map((contract) => contract.id);
  const landlordBefore = landlordExisting.map((contract) => contract.id);

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

    await test.step('4. ผู้เช่า: ผูกกับอีเมลของ qa-tenant แล้วลีดเป็น booked', async () => {
      created.tenantId = (
        await expectJson<IdBody>(
          await agent.createTenant({
            leadId: created.leadId,
            rentRoomId: created.roomId,
            firstName: `${label} Tenant`,
            phone: TEST_PHONE,
            email: qaAccounts.tenant.email,
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
      const letter = { ...defaults, landlordEmail: qaAccounts.landlord.email, landlordPhone: TEST_PHONE, paymentMethod: 'transfer' };
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
      expect(await myContractIds(tenant.contracts()), 'qa-tenant เห็นหนังสือจองในบัญชีของตัวเอง').toContain(id);
      await expectJson(await tenant.reservationSlip(id, upload(png(label, 'reservation-slip'))), 200);
      await expectJson(
        await agent.financialDocument(id, 'receipt', { receivedBy: 'landlord', paymentMethod: 'transfer', paymentDetails: `${label} bank transfer` }),
        200,
      );
      expect((await contract(id)).reservationPayment?.status, 'ออกใบเสร็จเงินจองแล้ว').toBe('paid');
      await expectJson(await agent.attach(id, upload(pdf(label, 'ownership')), 'ownership_proof', 'property'), 201);
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
      for (const subject of ['owner', 'tenant']) {
        await expectJson(await agent.attach(id, upload(pdf(label, `${subject}-id`)), 'national_id', subject), 201);
      }
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
      await expectJson(await tenant.depositSlip(id, upload(png(label, 'deposit-slip'))), 200);
      await expectJson(
        await agent.invoiceReceipt(created.depositInvoiceId!, { paymentMethod: 'transfer', paymentDetails: `${label} deposit transfer`, receivedBy: 'landlord' }),
        200,
      );
      const after = await contract(id);
      expect(after.depositPayment?.status).toBe('paid');
      expect(after.status, 'รับมัดจำแล้วรอส่งมอบห้อง').toBe('awaiting_handover');
    });

    await test.step('9. ส่งมอบห้อง: นายหน้าบันทึกรายการกับรูป ผู้เช่าและเจ้าของลงนาม สัญญาเริ่ม', async () => {
      const id = created.leaseId!;
      // อัปโหลดรูปเพิ่ม revision จึงอ่าน revision ล่าสุดก่อนบันทึกและก่อนลงนามทุกครั้ง
      await expectJson(
        await agent.saveHandover(id, { revision: (await handover(id, false)).revision, handoverDate: today, items: [{ name: `${label} key`, quantity: 2, condition: 'good' }] }),
        200,
      );
      await expectJson(await agent.handoverPhoto(id, upload(png(label, 'move-in')), false), 201);
      const revision = (await handover(id, false)).revision;
      await expectJson(await tenant.signHandover(id, 'tenant', SIGNATURE, revision), 200);
      await expectJson(await landlord.signHandover(id, 'owner', SIGNATURE, revision), 200);
      expect((await handover(id, false)).status).toBe('completed');
      expect((await contract(id)).status).toBe('active');
    });

    await test.step('10. บิลค่าเช่าเดือนนี้: ผู้เช่าส่งสลิป นายหน้ายืนยัน เจ้าของเห็นว่าชำระแล้ว', async () => {
      const id = created.leaseId!;
      // GET /bills/mine สร้างบิลที่ถึงรอบก่อนตอบ (ข้อ ง.14 ใน README)
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
      expect(received?.status, 'qa-landlord เห็นบิลเดียวกันว่าชำระแล้ว').toBe('paid');
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

    await test.step('14. ตัวนับหลังรัน: qa-tenant และ qa-landlord เห็นสัญญาเพิ่ม 2 ฉบับพอดี', async () => {
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
