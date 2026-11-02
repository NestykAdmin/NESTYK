import { qaAgent2 } from '../../src/config/qa-accounts';
import { expectSameAsNonexistent, findTargets, NONEXISTENT_ID, type CrossAgentTargets } from '../../src/support/cross-agent';
import { expectJson } from '../../src/support/http';
import { MAX_PAGE_SIZE } from '../../src/support/pagination';
import { bangkokDate, DEAL, SIGNATURE } from '../../src/write/lifecycle-data';
import { expect, test, type CrossAgentApis } from '../../src/write/write.fixture';

/**
 * นายหน้าคนที่ 2 (qa-agent2) สั่งแก้ข้อมูลของ qa-agent ไม่ได้
 *
 * ทำไมอยู่ใน tests/write: ถ้าระบบกันข้ามนายหน้าไม่ได้ คำขอเหล่านี้จะเขียนลงข้อมูล E2E- ของ qa-agent จริง
 *   (อยู่ในขอบเขตที่ทีมตกลง ฉบับที่ 8, 2 พ.ย. 2026) ถ้าระบบถูก ทุกคำขอถูกปฏิเสธก่อนเขียน (อ่านจากโค้ดที่ develop bc77a8b)
 * เนื้อคำขอผ่านตัวตรวจรูปแบบทุกช่อง เพราะหลายเส้นทางตรวจเนื้อคำขอก่อนตรวจเจ้าของ (เช่น PATCH /agent/viewings/:id
 *   lead-viewings.service.ts บรรทัด 175-177) ถ้าส่งค่าผิดจะได้ 400 ซึ่งไม่ได้พิสูจน์อะไร
 *   แต่บางคำขอ ถ้าเจ้าของส่งเอง ก็ถูกปฏิเสธด้วยเหตุอื่นหลังผ่านการตรวจเจ้าของ (409 นัดที่ปิดแล้ว, 400 ลงนามสัญญาที่ออกเอกสารแล้ว)
 *   ข้อเหล่านั้นพิสูจน์ได้แค่ว่าการตรวจเจ้าของมาก่อน ไม่ได้พิสูจน์ว่าถ้าไม่มีการตรวจเจ้าของ ระบบจะบันทึก
 * ทุกคำขอเทียบกับคำขอเดียวกันที่ใช้ id ที่ไม่มีจริง (expectSameAsNonexistent): ต้องได้ 404 และข้อความเดียวกัน
 *   จึงแยก 404 ที่มาจากเส้นทางผิด (NestJS ตอบ "Cannot POST ...") ออกจาก 404 ของการตรวจเจ้าของได้
 * ทุกข้อ qa-agent อ่านสถานะก่อนและหลัง ต้องเท่าเดิม ส่วนคำขอที่สร้างแถวใหม่ แถวนั้นจะเป็นของ qa-agent2 ซึ่ง qa-agent มองไม่เห็น
 *   ผู้เช่าและสัญญา: ตรวจรายการของ qa-agent2 ด้วยว่าไม่มีป้าย E2E-XA-<รหัสรอบ> หรือสัญญาของลีด qa-agent
 *   ข้อเสนอและลิงก์แชร์: ไม่มีรายการฝั่ง qa-agent2 ให้ตรวจ จึงจับได้ทางเดียวคือรหัสตอบกลับ (ระบบผิดจะตอบ 2xx)
 * ข้อจำกัด: ถ้าตัวกรองของ PATCH /agent/viewings/:id หายและนัดยังเปิดอยู่ ระบบอาจแก้เวลาแก้ล่าสุดของลีดก่อนตอบ 404
 *   (lead-viewings.service.ts บรรทัด 186-197) การเทียบก่อนกับหลังของเทสดูเฉพาะรายการนัด
 * ข้อไม่พึ่งกัน (ไม่ใช้ serial) ถ้าข้อหนึ่งไม่ผ่าน ข้ออื่นยังรัน ค่าตั้งของชุดเขียนรันทีละข้อด้วย worker เดียวอยู่แล้ว
 */

test.skip(qaAgent2.uuid === null, `ยังไม่ได้ตั้ง ${qaAgent2.uuidVariable} (uuid ของ ${qaAgent2.email})`);

let targets: CrossAgentTargets;

test.beforeAll(async ({ crossAgent }) => {
  targets = await findTargets(crossAgent.owner);
});

/** สถานะของลีดที่ต้องไม่เปลี่ยน */
async function leadState(owner: CrossAgentApis, id: number) {
  const lead = await expectJson<Record<string, unknown>>(await owner.leads.getById(id), 200);
  return { notes: lead.notes, status: lead.status, lostReason: lead.lostReason, name: lead.name, phone: lead.phone, tenantId: lead.tenantId };
}

/** ชื่อในรายการของ qa-agent2 ที่ติดป้ายของรอบนี้ (ต้องว่าง: ถ้ามี แปลว่าคำขอสร้างแถวถูกรับไป) */
async function intruderRowsWithLabel(intruder: CrossAgentApis, label: string): Promise<string[]> {
  const tenants = await expectJson<{ name?: string | null }[]>(await intruder.tenants.list(), 200);
  const contracts = await expectJson<{ tenant?: string | null; property?: string | null }[]>(await intruder.contracts.list(), 200);
  return [...tenants.map((t) => t.name ?? ''), ...contracts.map((c) => `${c.tenant ?? ''} ${c.property ?? ''}`)].filter((text) => text.includes(label));
}

test('qa-agent2 cannot edit, close or reconfigure a qa-agent lead', async ({ crossAgent, runId }) => {
  const { owner, intruder } = crossAgent;
  test.skip(targets.openLeadId === undefined, 'qa-agent ยังไม่มีลีด E2E- ที่ยังไม่ถูกจอง (รันเทสลีดก่อน)');
  const id = targets.openLeadId!;
  const label = `E2E-XA-${runId}`;
  const before = await leadState(owner, id);
  const settingsBefore = await expectJson<{ effective: { maxResults: number } }>(await owner.matching.settings(id), 200);
  // ค่าที่ระบบรับ (MATCH_MAX_RESULTS_OPTIONS = 10, 20, 50, 100 ใน lead-matching.ts บรรทัด 13) และต่างจากค่าปัจจุบัน
  //   ถ้าระบบบันทึก ค่าที่อ่านกลับจะต่าง
  const maxResults = settingsBefore.effective.maxResults === 100 ? 50 : 100;

  await expectSameAsNonexistent(
    await intruder.leadsWrite.update(id, { notes: label }),
    await intruder.leadsWrite.update(NONEXISTENT_ID, { notes: label }),
    'PATCH /agent/leads/:id',
  );
  await expectSameAsNonexistent(
    await intruder.leadsWrite.markLost(id, { lostReason: `${label} lost` }),
    await intruder.leadsWrite.markLost(NONEXISTENT_ID, { lostReason: `${label} lost` }),
    'POST /agent/leads/:id/mark-lost',
  );
  await expectSameAsNonexistent(
    await intruder.leadsWrite.markInProgress(id),
    await intruder.leadsWrite.markInProgress(NONEXISTENT_ID),
    'POST /agent/leads/:id/mark-inprogress',
  );
  await expectSameAsNonexistent(
    await intruder.matching.saveSettings(id, { maxResults }),
    await intruder.matching.saveSettings(NONEXISTENT_ID, { maxResults }),
    'PATCH /agent/leads/:id/match-settings',
  );

  expect(await leadState(owner, id)).toEqual(before);
  expect(await expectJson(await owner.matching.settings(id), 200)).toEqual(settingsBefore);
});

test('qa-agent2 cannot change a qa-agent viewing or book a viewing on a qa-agent lead and room', async ({ crossAgent }) => {
  const { owner, intruder } = crossAgent;
  test.skip(targets.viewingId === undefined || targets.roomId === undefined, 'qa-agent ยังไม่มีนัดหรือห้องที่ติดป้าย E2E- (รันเทสวงจรเช่าห้องก่อน)');
  const leadId = targets.viewingLeadId!;
  const before = await expectJson(await owner.viewings.listForLead(leadId), 200);

  await expectSameAsNonexistent(
    await intruder.viewings.update(targets.viewingId!, { status: 'cancelled' }),
    await intruder.viewings.update(NONEXISTENT_ID, { status: 'cancelled' }),
    'PATCH /agent/viewings/:id',
  );
  // นัดล่วงหน้า 3 วัน: เวลาในอนาคตที่ตัวตรวจรับ (เทสวงจรเช่าห้องใช้ 2 วัน ใช้ 3 วันเพื่อไม่ชนนัดเดิม)
  const scheduledAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
  await expectSameAsNonexistent(
    await intruder.viewings.create(leadId, { rentRoomId: targets.roomId, scheduledAt }),
    await intruder.viewings.create(NONEXISTENT_ID, { rentRoomId: targets.roomId, scheduledAt }),
    'POST /agent/leads/:id/viewings',
  );

  expect(await expectJson(await owner.viewings.listForLead(leadId), 200)).toEqual(before);
});

test('qa-agent2 cannot edit a qa-agent room or create a share link for it', async ({ crossAgent, runId }) => {
  const { owner, intruder } = crossAgent;
  test.skip(targets.roomId === undefined, 'qa-agent ยังไม่มีห้องที่ติดป้าย E2E- (รันเทสวงจรเช่าห้องก่อน)');
  const id = targets.roomId!;
  const label = `E2E-XA-${runId}`;
  const pickRoom = (room: Record<string, unknown>) => ({ title: room.listingTitle, prices: room.prices, contacts: room.contacts, visibility: room.visibility });
  const roomBefore = pickRoom(await expectJson<Record<string, unknown>>(await owner.listings.getById(id), 200));
  expect(roomBefore.contacts, 'รายละเอียดห้องต้องมีช่อง contacts (ไม่อย่างนั้นการเทียบช่องนี้ไม่มีความหมาย)').toBeDefined();
  const linksBefore = (await expectJson<{ items: { id: number }[] }>(await owner.shareLinks.list(id), 200)).items;

  // เนื้อคำขอเดียวกับที่เทสวงจรเช่าห้องใช้สร้างห้องได้สำเร็จ (PATCH ใช้ตัวตรวจเดียวกับ POST: agent-rooms.service.ts บรรทัด 200)
  const contractType = (await expectJson<{ id: number; code: string }[]>(await intruder.rooms.contractTypes(), 200)).find((t) => t.code === 'monthly_12');
  const roomType = (await expectJson<{ id: number; code: string }[]>(await intruder.rooms.roomTypes(), 200)).find((t) => t.code === 'studio');
  const propertyType = (await expectJson<{ id: number; code: string }[]>(await intruder.rooms.propertyTypes(), 200)).find((t) => t.code === 'condo');
  expect(contractType && roomType && propertyType, 'ต้องมีข้อมูลอ้างอิง monthly_12, studio และ condo').toBeTruthy();
  const body = {
    visibility: 'private',
    // เบอร์ไม่ใช่ของคนจริง และต่างจากเบอร์ของข้อมูลเทสวงจรเช่าห้อง (0000000001) ถ้าระบบบันทึก ผู้ติดต่อของห้องจะเปลี่ยน
    contacts: [{ name: `${label} Owner`, phone: '0000000002' }],
    property: { name: `${label} Tower`, address: `${label} Rd`, district: 'Khlong Toei', province: 'Bangkok', propertyTypeId: propertyType!.id, latitude: 13.72, longitude: 100.56 },
    latitude: 13.72,
    longitude: 100.56,
    listingTitle: `${label} room`,
    roomTypeId: roomType!.id,
    listingSourceCode: 'owner',
    layout: [
      { code: 'bedroom', value: '1' },
      { code: 'bathroom', value: '1' },
    ],
    prices: [{ contractTypeId: contractType!.id, price: DEAL.monthlyRent + 1, advanceRentMonths: 1, depositMonths: 2 }],
  };
  await expectSameAsNonexistent(await intruder.rooms.update(id, body), await intruder.rooms.update(NONEXISTENT_ID, body), 'PATCH /agent/rooms/:id');
  // 7 วัน: อยู่ในช่วงที่ระบบรับ (MIN_EXPIRES_DAYS ถึง MAX_EXPIRES_DAYS = 1 ถึง 30 ใน room-share-links.service.ts บรรทัด 25-26 และ 48-57)
  await expectSameAsNonexistent(
    await intruder.shareLinks.create(id, { expiresInDays: 7 }),
    await intruder.shareLinks.create(NONEXISTENT_ID, { expiresInDays: 7 }),
    'POST /agent/listings/:id/share-links',
  );

  expect(pickRoom(await expectJson<Record<string, unknown>>(await owner.listings.getById(id), 200))).toEqual(roomBefore);
  expect((await expectJson<{ items: { id: number }[] }>(await owner.shareLinks.list(id), 200)).items.map((l) => l.id)).toEqual(linksBefore.map((l) => l.id));
});

test('qa-agent2 cannot make a deal offer or a tenant from a qa-agent lead and room, or edit a qa-agent tenant or its billing', async ({ crossAgent, runId }) => {
  const { owner, intruder } = crossAgent;
  test.skip(
    targets.openLeadId === undefined || targets.roomId === undefined || targets.tenantId === undefined,
    'qa-agent ยังไม่มีลีด ห้อง หรือผู้เช่าที่ติดป้าย E2E- (รันเทสลีดและเทสวงจรเช่าห้องก่อน)',
  );
  const label = `E2E-XA-${runId}`;
  const leadId = targets.openLeadId!;
  const offersBefore = await expectJson(await owner.leads.dealOffers(leadId), 200);
  const leadBefore = await leadState(owner, leadId);
  const tenantsBefore = await expectJson<{ id: number }[]>(await owner.tenants.list(), 200);
  const tenant = await expectJson<Record<string, unknown>>(await owner.tenants.getById(targets.tenantId!), 200);
  const today = bangkokDate();

  const offer = (lead: number) => ({
    leadId: lead,
    rentRoomId: targets.roomId,
    monthlyRent: DEAL.monthlyRent,
    termMonths: DEAL.termMonths,
    startDate: today,
    depositAmount: DEAL.depositAmount,
    contractDate: today,
    // วันครบกำหนดค่าเช่าที่ระบบรับคือ 1 ถึง 31 (deal-offers.service.ts บรรทัด 101) ใช้ 5 เหมือนที่เดินวงจรในห้องทดลอง
    rentDueDay: 5,
    coBroke: false,
  });
  await expectSameAsNonexistent(await intruder.lifecycle.createOffer(offer(leadId)), await intruder.lifecycle.createOffer(offer(NONEXISTENT_ID)), 'POST /agent/deal-offers');
  const newTenant = (lead: number) => ({ leadId: lead, rentRoomId: targets.roomId, firstName: `${label} Tenant`, phone: '0000000002' });
  await expectSameAsNonexistent(await intruder.tenants.create(newTenant(leadId)), await intruder.tenants.create(newTenant(NONEXISTENT_ID)), 'POST /agent/tenants');
  // PATCH เขียนทับทุกช่องของโปรไฟล์ (agent-tenants.service.ts บรรทัด 416-430) จึงส่งค่าเดิมทุกช่อง ต่างแค่ชื่อกับเบอร์
  //   ถ้าระบบผิด ความเสียหายจึงจำกัดที่ 2 ช่องนี้ และอีเมลเดิมกัน 409 TENANT_EMAIL_LOCKED (บรรทัด 414-415)
  const profile = (t: Record<string, unknown>) => ({
    firstName: t.firstName,
    lastName: t.lastName,
    phone: t.phone,
    email: t.email,
    note: t.note,
    identityNumber: t.identityNumber,
    nationality: t.nationality,
  });
  const edit = { ...profile(tenant), firstName: `${label} Tenant`, phone: '0000000002' };
  await expectSameAsNonexistent(
    await intruder.tenants.update(targets.tenantId!, edit),
    await intruder.tenants.update(NONEXISTENT_ID, edit),
    'PATCH /agent/tenants/:id',
  );
  // GET ที่เขียนข้อมูล (กฎ ง.14): ค้นผู้เช่าด้วยเจ้าของแล้วตอบ 404 ก่อน insertBills (billing/tenant-billing.service.ts บรรทัด 587-592)
  //   อยู่ในไฟล์นี้ ไม่อยู่ใน tests/api เพราะถ้าระบบผิด จะออกบิล เปลี่ยนสัญญาต่ออายุเป็น active และเปลี่ยนการเข้าพักเป็น active
  await expectSameAsNonexistent(
    await intruder.bills.agentTenantBilling(targets.tenantId!),
    await intruder.bills.agentTenantBilling(NONEXISTENT_ID),
    'GET /bills/agent/tenants/:tenantId',
  );

  expect(await expectJson(await owner.leads.dealOffers(leadId), 200)).toEqual(offersBefore);
  expect(await leadState(owner, leadId), 'ลีดต้องไม่ถูกจองให้ผู้เช่าของ qa-agent2').toEqual(leadBefore);
  expect((await expectJson<{ id: number }[]>(await owner.tenants.list(), 200)).map((t) => t.id)).toEqual(tenantsBefore.map((t) => t.id));
  const tenantAfter = await expectJson<Record<string, unknown>>(await owner.tenants.getById(targets.tenantId!), 200);
  expect(profile(tenantAfter), 'โปรไฟล์ผู้เช่าของ qa-agent ต้องเท่าเดิมทุกช่อง').toEqual(profile(tenant));
  expect(await intruderRowsWithLabel(intruder, label), 'qa-agent2 ต้องไม่มีผู้เช่าหรือสัญญาที่ติดป้ายของรอบนี้').toEqual([]);
});

test('qa-agent2 cannot draft a contract on a qa-agent lead, or sign or deliver a qa-agent contract', async ({ crossAgent, runId }) => {
  const { owner, intruder } = crossAgent;
  test.skip(
    targets.bookedLeadId === undefined || targets.contractId === undefined,
    'qa-agent ยังไม่มีลีดที่จองแล้วหรือสัญญาที่ติดป้าย E2E- (รันเทสวงจรเช่าห้องก่อน)',
  );
  const label = `E2E-XA-${runId}`;
  const contractId = targets.contractId!;
  const contractsBefore = await expectJson<{ id: number }[]>(await owner.contracts.list(), 200);
  const pick = (c: Record<string, unknown>) => ({ status: c.status, agentSignedAt: c.agentSignedAt, tenantDeliveredAt: c.tenantDeliveredAt, ownerDeliveredAt: c.ownerDeliveredAt });
  const contractBefore = pick(await expectJson<Record<string, unknown>>(await owner.contracts.getById(contractId), 200));

  // หนังสือแต่งตั้งนายหน้าใช้ค่าตั้งต้นที่ qa-agent อ่านได้ (อ่านอย่างเดียว) ระบบหาผู้เช่าของลีดด้วยเจ้าของในธุรกรรม
  //   ก่อนเขียนแถวแรก (agent-contracts.service.ts บรรทัด 3869-3873)
  const defaults = await expectJson<Record<string, unknown>>(await owner.lifecycle.defaults('broker-appointment', targets.bookedLeadId!), 200);
  const draft = (lead: number) => ({ leadId: lead, agreementTypeCode: 'broker_appointment', startDate: bangkokDate(), data: { brokerAppointment: { ...defaults, note: label } } });
  await expectSameAsNonexistent(
    await intruder.lifecycle.createContract(draft(targets.bookedLeadId!)),
    await intruder.lifecycle.createContract(draft(NONEXISTENT_ID)),
    'POST /agent/contracts',
  );
  const signBody = { parties: ['agent'], signaturePng: SIGNATURE };
  await expectSameAsNonexistent(await intruder.lifecycle.sign(contractId, signBody), await intruder.lifecycle.sign(NONEXISTENT_ID, signBody), 'POST /agent/contracts/:id/sign');
  await expectSameAsNonexistent(await intruder.lifecycle.deliver(contractId, 'tenant'), await intruder.lifecycle.deliver(NONEXISTENT_ID, 'tenant'), 'POST /agent/contracts/:id/deliveries');

  expect((await expectJson<{ id: number }[]>(await owner.contracts.list(), 200)).map((c) => c.id)).toEqual(contractsBefore.map((c) => c.id));
  expect(pick(await expectJson<Record<string, unknown>>(await owner.contracts.getById(contractId), 200))).toEqual(contractBefore);
  const intruderContracts = await expectJson<{ id: number; leadId?: number | null }[]>(await intruder.contracts.list(), 200);
  expect(intruderContracts.filter((c) => c.leadId === targets.bookedLeadId), 'qa-agent2 ต้องไม่มีสัญญาของลีด qa-agent').toEqual([]);
});

test('qa-agent2 lists still contain no qa-agent E2E lead or room after the attempts', async ({ crossAgent }) => {
  // ตาข่ายสุดท้าย: ถ้าคำขอใดของ qa-agent2 ถูกรับไป ลีดหรือห้องอาจโผล่ในรายการของ qa-agent2
  const { intruder } = crossAgent;
  test.skip(targets.leadIds.length === 0 && targets.roomIds.length === 0, 'qa-agent ยังไม่มีลีดหรือห้องที่ติดป้าย E2E-');
  const kinds = [
    { name: 'ลีด', ids: targets.leadIds, read: () => intruder.leads.list({ q: 'E2E-', limit: MAX_PAGE_SIZE }) },
    { name: 'ห้อง', ids: targets.roomIds, read: () => intruder.listings.list({ q: 'E2E-', limit: MAX_PAGE_SIZE }) },
  ];
  for (const kind of kinds) {
    if (kind.ids.length === 0) {
      test.info().annotations.push({ type: 'ไม่ได้ตรวจ', description: `qa-agent ยังไม่มี${kind.name}ที่ติดป้าย E2E-` });
      continue;
    }
    const rows = (await expectJson<{ items: { id: number }[] }>(await kind.read(), 200)).items;
    expect(rows.map((row) => row.id).filter((id) => kind.ids.includes(id)), `${kind.name}ของ qa-agent ในรายการของ qa-agent2`).toEqual([]);
  }
});
