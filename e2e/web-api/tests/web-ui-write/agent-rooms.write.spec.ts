import type { Page } from '@playwright/test';
import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { AgentShell } from '../../src/web-ui/pages/agent-shell.page';
import { Notify } from '../../src/web-ui/pages/notify.page';
import { RoomDetail, RoomWizard } from '../../src/web-ui/pages/room-write.page';
import { RoomsPage } from '../../src/web-ui/pages/rooms.page';
import { WRITE } from '../../src/web-ui/labels';
import { ApiLog, okJson, waitForApi } from '../../src/web-ui/support/api';
import { watchForRequest } from '../../src/web-ui/support/wait';
import { StagingApi } from '../../src/web-ui/write/staging-api';
import { E2E_PREFIX, runId, WIZ_CONTACT_NAME, WIZ_CONTACT_PHONE } from '../../src/web-ui/write/web-write-env';

/**
 * เทสบนเว็บของตัวช่วยสร้างห้องและหน้าแก้ห้อง (แผน claude/nestyk-web-write-flows-plan-2026-11-06.md ข้อ RW1-RW3 และ RW4 ที่เพิ่มจากข้อสงสัยของ code-scout)
 * โค้ด: packages/feature-listing/src/components/MobileCreateListingWizardBody.tsx (W), apps/consumer-app/app/index.tsx (IDX),
 *   components/AgentRoomDetailModal.web.tsx, AgentRoomEditor.tsx และ apps/api/src/agent/rooms/agent-rooms.service.ts (SVC)
 *   ที่ qa/e2e 74b46f4 (แอป 648dd28, API a02e532)
 *
 * RW1 ไม่เขียนข้อมูล ส่วน RW2 สร้างห้องจริงทุกรอบ (Aof อนุมัติ 6 พ.ย. 2026) ห้องและโครงการลบไม่ได้ (ไม่มีเส้นทางลบใน agent-rooms.controller.ts)
 *   - รอยต่อรอบ: ห้อง private 1 ห้อง (ชื่อประกาศและชื่อโครงการ E2E-WIZ-<รหัสรอบ>) โครงการ 1 แถว ราคา 1 แถว layout และแถวผูกผู้ติดต่อ
 *     (POST เขียน properties ใหม่ทุกครั้ง: SVC:732-768) ไม่มีรูป
 *   - ผู้ติดต่อของเว็บ E2E-WIZ-CONTACT (web-write-env.ts WIZ_CONTACT_NAME): รอบแรกสร้าง 1 คน รอบต่อไปเลือกคนเดิม (SVC:597-605 อ่านอย่างเดียว)
 *     ไม่ใช้ผู้ติดต่อของห้องถาวร เพราะคำค้นห้องค้นชื่อผู้ติดต่อด้วย ห้องที่สะสมจะทำให้ tests/write หาห้องถาวรไม่ได้
 *   - RW3 แก้เฉพาะห้องที่ RW2 สร้างในรอบเดียวกัน (ตรวจ id และชื่อก่อนกดแก้) ห้ามแก้ E2E-QA-ROOM-1 ผ่านหน้าเว็บ
 * ไม่พิมพ์ชื่อโครงการในโหมดค้นหา (พิมพ์ตั้งแต่ 2 ตัวจะค้นสถานที่ผ่าน Google: W:957-1008) และตัดคำขอค้นสถานที่กับแผนที่ของ Google
 *   ในเบราว์เซอร์ทุกข้อของไฟล์นี้ (blockGoogle)
 */

/** ค่าเช่าที่ใส่ตอนสร้างและตอนแก้ (บาทต่อเดือน) ค่าที่เลือกเอง: ตัวเลขล้วนมากกว่า 0 (W:879-887, SVC:550) */
const RENT_CREATE = 15000;
const RENT_EDIT = 16500;

/** เวลาที่เฝ้าคำขอค้นสถานที่หลังเปิดหน้าแก้ ค่าที่เลือกเอง: 10 เท่าของเวลารอก่อนค้นของตัวช่วย (300 ms: W:957-1008) */
const PLACES_WINDOW_MS = 3_000;

/**
 * ตัดคำขอที่ไปถึง Google ในเบราว์เซอร์ และนับจำนวนครั้งไว้เป็นหลักฐาน
 *   - ค้นสถานที่ GET /agent/places/autocomplete, /agent/places/reverse (lib/places-api.ts) ซึ่ง staging เรียก Google ต่อ
 *   - แผนที่ของ Google (maps.googleapis.com, maps.gstatic.com) ถ้าเว็บตั้งคีย์แผนที่ไว้ (mapsApiKey: W:2653, AgentRoomEditor.tsx:85)
 *     และ iframe www.google.com/maps ที่ใช้แทนเมื่อไม่มีคีย์ (PropertyPlaceMap.web.tsx:148-149)
 */
async function blockGoogle(page: Page): Promise<{ places: number; maps: number }> {
  const counter = { places: 0, maps: 0 };
  await page.route(
    (url) => url.pathname.startsWith('/api/v1/agent/places/'),
    (route) => {
      counter.places += 1;
      return route.abort('blockedbyclient');
    },
  );
  await page.route(
    (url) =>
      url.hostname === 'maps.googleapis.com' ||
      url.hostname === 'maps.gstatic.com' ||
      (url.hostname === 'www.google.com' && url.pathname.startsWith('/maps')),
    (route) => {
      counter.maps += 1;
      return route.abort('blockedbyclient');
    },
  );
  return counter;
}

type ContactLike = { name?: unknown; phone?: unknown };

/**
 * ตรวจเนื้อคำขอบันทึกห้องในเบราว์เซอร์ก่อนส่งถึง staging (route ของ page ทำงานก่อนตัวกันของ context)
 * allowWrites ปล่อยตาม method และ path ไม่ดูเนื้อคำขอ ถ้าแอปส่งผู้ติดต่อที่ไม่ใช่ของเว็บ service จะหาแถวจากเบอร์แล้วเขียนทับชื่อ
 *   (agent-rooms.service.ts:607-621) จึงตัดคำขอทิ้งเมื่อ
 *   - contact หรือ contacts[] มีคนที่ชื่อหรือเบอร์ไม่ใช่ผู้ติดต่อของเว็บ (WIZ_CONTACT_NAME, WIZ_CONTACT_PHONE)
 *   - contactIds มี id อื่นนอกจากผู้ติดต่อของเว็บ (allowedIds)
 * คืนรายการเหตุผลที่ตัด (ต้องว่าง)
 */
async function checkRoomBody(page: Page, method: 'POST' | 'PATCH', path: string, allowedIds: () => number[]): Promise<string[]> {
  const refused: string[] = [];
  await page.route(
    // ตัด / ท้าย path แบบเดียวกับตัวกัน (guard.ts:171)
    (url) => url.pathname.replace(/\/+$/, '') === `/api/v1${path}`,
    async (route) => {
      if (route.request().method() !== method) return route.fallback();
      const body = (route.request().postDataJSON() ?? {}) as {
        contact?: ContactLike | null;
        contacts?: ContactLike[];
        contactIds?: unknown[];
        contactId?: unknown;
      };
      const people = [...(body.contact ? [body.contact] : []), ...(body.contacts ?? [])];
      const foreign = people.filter((person) => person.name !== WIZ_CONTACT_NAME || person.phone !== WIZ_CONTACT_PHONE);
      // contactId ตัวเดียว service ใช้เมื่อ contactIds ว่าง (SVC:637-641)
      const ids = [...(body.contactIds ?? []), ...(body.contactId == null ? [] : [body.contactId])].filter(
        (id) => !allowedIds().includes(Number(id)),
      );
      if (foreign.length || ids.length) {
        const reason = `${method} ${path}: ผู้ติดต่ออื่น ${foreign.length} คน id อื่น ${ids.length} รายการ`;
        refused.push(reason);
        // จดก่อนตัด เพราะคำขอที่ถูกตัดไม่มีคำตอบ ข้อนั้นจะแดงด้วยการรอคำตอบหมดเวลา ไม่ใช่ด้วยเหตุผลนี้
        test.info().annotations.push({ type: 'ตัดคำขอบันทึกห้อง', description: reason });
        return route.abort('blockedbyclient');
      }
      return route.fallback();
    },
  );
  return refused;
}

/** เบอร์เป็นตัวเลขล้วน (ตัวช่วยเทียบเบอร์ผู้ติดต่อด้วยตัวเลขอย่างเดียว: W:1141-1147) */
function digits(phone: string): string {
  return phone.replace(/\D/g, '');
}

test('saving a new room before the required sections are done shows the banner and sends nothing', async ({ page, loginAs, guard }) => {
  // ขั้นที่ 1: เมนู Create > Add listing (AgentWorkspace.web.tsx:532) เปิดตัวช่วยสร้างห้องที่ขั้นเลือกที่มาของประกาศ
  const log = new ApiLog(page);
  await blockGoogle(page);
  await loginAs('agent');
  const shell = new AgentShell(page);
  await shell.createButton.click();
  await shell.createItem(WRITE.menuAddListing).click();
  const wizard = new RoomWizard(page);
  await expect(wizard.next).toBeVisible();

  // ขั้นที่ 2: เลือก Room owner แล้วกดถัดไป ไปหน้ารวมหัวข้อ (hub) ที่มีปุ่มบันทึก (W:2381-2389)
  await wizard.source(WRITE.sourceOwner).click();
  await wizard.next.click();
  await expect(wizard.saveRoom).toBeVisible();

  // ขั้นที่ 3: บันทึกทั้งที่ยังไม่กรอก หน้าเว็บขึ้นข้อความ 2 ที่และไม่ส่งคำขอสร้างห้อง (W:2127-2145)
  await wizard.saveRoom.click();
  await expect(wizard.missingBanner).toHaveCount(2);
  await expect(wizard.missingBanner.last()).toBeVisible();
  expect(log.count('POST', '/agent/rooms'), 'คำขอ POST /agent/rooms').toBe(0);
  expect(log.count('POST', /^\/agent\/rooms\/media\//), 'คำขออัปโหลดรูป').toBe(0);
  expect(guard.allowedWrites, 'ข้อนี้ไม่เปิด allowWrites จึงต้องไม่มีคำขอเขียนที่ปล่อยผ่าน').toEqual([]);
});

test.describe.serial('a room made through the wizard', () => {
  /** ห้องที่ RW2 สร้างในรอบนี้ (RW3 แก้เฉพาะห้องนี้) */
  let created: { id: number; title: string; contactId: number } | null = null;

  test('the wizard creates a private room with the entered details', async ({ page, loginAs, guard }) => {
    const google = await blockGoogle(page);
    await loginAs('agent');
    const api = await StagingApi.of(page);
    const listingsBefore = (await api.listings(E2E_PREFIX)).total;
    const title = `${E2E_PREFIX}WIZ-${runId()}`;
    const address = `${E2E_PREFIX}address`;
    const district = `${E2E_PREFIX}district`;
    const province = `${E2E_PREFIX}province`;

    // ขั้นเตรียม: ผู้ติดต่อของเว็บ มีแล้วใช้คนเดิม ยังไม่มีให้สร้างผ่านฟอร์มของตัวช่วย (ครั้งแรกครั้งเดียว)
    //   หยุดถ้ามีมากกว่า 1 คน หรือเบอร์นี้เป็นของผู้ติดต่อชื่ออื่น (สร้างต่อจะเขียนทับชื่อของคนนั้น)
    const contacts = await api.contacts();
    const mine = contacts.filter((row) => row.name === WIZ_CONTACT_NAME);
    const clash = contacts.filter((row) => digits(row.phone) === WIZ_CONTACT_PHONE && row.name !== WIZ_CONTACT_NAME);
    if (mine.length > 1) throw new Error(`หยุดก่อนเขียน: มีผู้ติดต่อชื่อ ${WIZ_CONTACT_NAME} ${mine.length} คน (id ${mine.map((row) => row.id).join(', ')}) ต้องมีไม่เกิน 1`);
    if (clash.length) throw new Error(`หยุดก่อนเขียน: เบอร์ ${WIZ_CONTACT_PHONE} เป็นของผู้ติดต่ออื่น ${clash.length} คน (id ${clash.map((row) => row.id).join(', ')})`);
    const existing = mine[0] ?? null;
    if (existing && existing.phone !== WIZ_CONTACT_PHONE) {
      throw new Error(`หยุดก่อนเขียน: ผู้ติดต่อ ${WIZ_CONTACT_NAME} (id ${existing.id}) มีเบอร์ไม่ใช่ ${WIZ_CONTACT_PHONE} ให้ตรวจก่อน`);
    }
    test.info().annotations.push({
      type: 'ผู้ติดต่อของเว็บ',
      description: existing ? `ใช้คนเดิม id ${existing.id}` : `ยังไม่มี รอบนี้สร้าง ${WIZ_CONTACT_NAME} เบอร์ ${WIZ_CONTACT_PHONE}`,
    });
    const refused = await checkRoomBody(page, 'POST', '/agent/rooms', () => (existing ? [existing.id] : []));

    // ขั้นที่ 1: Create > Add listing > Room owner > Next (W:2392-2450) เข้า hub
    const shell = new AgentShell(page);
    await shell.createButton.click();
    await shell.createItem(WRITE.menuAddListing).click();
    const wizard = new RoomWizard(page);
    await wizard.source(WRITE.sourceOwner).click();
    await wizard.next.click();
    await expect(wizard.saveRoom).toBeVisible();

    // ขั้นที่ 2: Property & location ชนิด Condo กรอกที่ตั้งเอง (กดก่อนพิมพ์ชื่อ) ชื่อ ที่อยู่ เขต จังหวัด (บังคับ: W:1320-1328)
    await wizard.section(WRITE.stepProperty).click();
    await wizard.propertyTypeButton.click();
    await wizard.sheetRadio(WRITE.propertyCondo).click();
    await wizard.enterManually.click();
    await wizard.projectName.fill(title);
    await wizard.address.fill(address);
    await wizard.labelledInput(WRITE.district).fill(district);
    await wizard.labelledInput(WRITE.province).fill(province);
    await wizard.done.click();

    // ขั้นที่ 3: Room details ชื่อประกาศ และประเภท Studio (ตั้งห้องนอน 0 ให้เอง: W:3626-3637) ห้องน้ำตั้งต้น 1 วันเข้าอยู่ตั้งต้นวันนี้ (W:1330-1347)
    await wizard.section(WRITE.stepLayout).click();
    await wizard.listingName.fill(title);
    await wizard.roomTypeButton.click();
    await wizard.sheetButton(WRITE.roomTypeStudio).click();
    await wizard.done.click();

    // ขั้นที่ 4: Rent & terms เพิ่มสัญญาแรกที่มีให้เลือก และค่าเช่า (W:1349-1358, :3699-3812)
    await wizard.section(WRITE.stepPricing).click();
    await wizard.addLease.click();
    const chip = wizard.leaseChips.first();
    const months = Number(((await chip.textContent()) ?? '').match(/^(\d+)/)?.[1]);
    expect(months, 'ความยาวสัญญาของ chip แรก').toBeGreaterThan(0);
    await chip.click();
    await wizard.monthlyRent.fill(String(RENT_CREATE));
    await wizard.addTerms.click();
    await expect(wizard.leaseCard(months)).toBeVisible();
    await wizard.done.click();

    // ขั้นที่ 5: Room source ผู้ติดต่อของเว็บ (W:1364-1373) คนเดิม: ค้นแล้วเลือก (:3905-3985) ; ยังไม่มี: ฟอร์มผู้ติดต่อใหม่ (:3819-3902)
    await wizard.section(WRITE.stepSource).click();
    await wizard.chooseContact.click();
    if (existing) {
      await wizard.contactSearch.fill(WIZ_CONTACT_NAME);
      await wizard.contactRow(WIZ_CONTACT_NAME).click();
      await wizard.useSelectedContact.click();
    } else {
      await wizard.addNewContact.click();
      await wizard.newContactName.fill(WIZ_CONTACT_NAME);
      await wizard.newContactPhone.fill(WIZ_CONTACT_PHONE);
      await wizard.useThisContact.click();
    }
    await wizard.done.click();

    // ขั้นที่ 6: Save room ส่ง POST /agent/rooms คำขอเดียว (W:2021-2123, lib/agent-listings-api.ts:127-133) ได้ 201 พร้อม id
    //   จดชื่อไว้ก่อนกด เผื่อการรอคำตอบหมดเวลาทั้งที่ห้องถูกสร้าง
    test.info().annotations.push({ type: 'ห้องที่จะสร้าง', description: title });
    guard.allowWrites({ method: 'POST', path: /^\/agent\/rooms$/ });
    const saved = waitForApi(page, 'POST', '/agent/rooms');
    await wizard.saveRoom.click();
    const response = await saved;
    const room = await okJson<{ id: number; visibility: string; contactIds: number[] }>(response);
    test.info().annotations.push({ type: 'ห้องที่สร้าง', description: `id ${room.id}` });
    expect(refused, 'คำขอที่ถูกตัดเพราะมีผู้ติดต่ออื่น').toEqual([]);
    expect(response.status()).toBe(201);
    expect(room.contactIds, 'ห้องผูกผู้ติดต่อ 1 คน').toHaveLength(1);
    const contactId = room.contactIds[0];
    if (existing) expect(contactId, 'ต้องเป็นผู้ติดต่อของเว็บคนเดิม').toBe(existing.id);
    else test.info().annotations.push({ type: 'ผู้ติดต่อของเว็บที่สร้าง', description: `id ${contactId}` });
    created = { id: room.id, title, contactId };
    const body = response.request().postDataJSON() as Record<string, unknown>;
    expect(body).toMatchObject({
      visibility: 'private',
      listingTitle: title,
      listingSourceCode: 'owner',
      property: { name: title, address, district, province },
      medias: [],
      documents: [],
    });
    expect(body.roomTypeId, 'ประเภทห้อง').toBeTruthy();
    // layout เป็นรายการ { code, value } (W:2029-2032)
    expect(body.layout, 'Studio ตั้งห้องนอน 0').toEqual(expect.arrayContaining([expect.objectContaining({ code: 'bedroom', value: '0' })]));
    expect((body.prices as { price: unknown }[]).map((row) => Number(row.price))).toEqual([RENT_CREATE]);
    expect(guard.allowedWrites, 'คำขอเขียนที่ปล่อยผ่าน').toEqual(['POST /agent/rooms']);

    // ขั้นที่ 7: toast "Room created" (IDX:1534-1542 key successTitle จึงเป็น success) แล้วพาไปหน้ารายการห้อง
    await expect(new Notify(page).toast('success', WRITE.roomCreated)).toBeVisible();
    await expect(page).toHaveURL(/\/agent\/rooms$/);

    // ขั้นที่ 8: อ่านห้องกลับ ค่าที่กรอกถูกบันทึก ผู้ติดต่อเป็นของเว็บ ห้อง E2E- เพิ่ม 1 ห้องพอดี และไม่มีคำขอไป Google
    //   สัญญาที่คาดหาจากชนิดสัญญาที่มีความยาวตรงกับ chip ที่กด (ไม่ใช้ id จากเนื้อคำขอของแอปเอง)
    const contractType = (await api.contractTypes()).find((row) => row.termMonths === months);
    expect(contractType, `ชนิดสัญญา ${months} เดือน`).toBeTruthy();
    const detail = await api.listing(room.id);
    expect(detail.listingTitle).toBe(title);
    expect(detail.visibility).toBe('private');
    expect(detail.property).toMatchObject({ name: title, address, district, province });
    expect(detail.roomTypeId, 'ประเภทห้องตรงกับที่ส่ง').toBe(body.roomTypeId);
    expect(Number((detail.layout ?? []).find((row) => row.code === 'bedroom')?.value), 'ห้องนอนที่อ่านกลับ').toBe(0);
    expect((detail.prices ?? []).map((row) => ({ contractTypeId: row.contractTypeId, price: Number(row.price) }))).toEqual([
      { contractTypeId: contractType?.id, price: RENT_CREATE },
    ]);
    expect((detail.contacts ?? []).map((row) => ({ id: row.id, name: row.name }))).toEqual([{ id: contactId, name: WIZ_CONTACT_NAME }]);
    expect((await api.listings(E2E_PREFIX)).total, 'ห้องที่มี E2E- หลังสร้าง').toBe(listingsBefore + 1);
    test.info().annotations.push({ type: 'คำขอแผนที่ Google ที่ถูกตัด', description: String(google.maps) });
    // fixture ตั้ง maps:false (web-ui.fixture.ts:51) ที่ cfd6633 แผนที่ทั้งแบบมีคีย์และ iframe อยู่หลังกล่อง MapConsentGate
    //   (เพิ่มที่ cba5045, PropertyPlaceMap.web.tsx:148-171) จึงต้องไม่มีคำขอไป Google Maps เลย
    //   ข้อนี้อยู่ใน describe.serial ถ้าแดงตรงนี้ ห้องถูกสร้างไปแล้ว และ RW3, RW4 จะถูกข้ามในรอบนั้น
    expect(google, 'คำขอไป Google (โหมดกรอกเองต้องไม่ค้นสถานที่ และยังไม่ยินยอมแผนที่ต้องไม่โหลดแผนที่)').toEqual({ places: 0, maps: 0 });
  });

  test('editing the new room saves the new name and rent', async ({ page, loginAs, guard }) => {
    test.skip(created === null, 'ข้อสร้างห้องไม่ผ่าน จึงไม่มีห้องของรอบนี้ให้แก้');
    const room = created as { id: number; title: string; contactId: number };
    const google = await blockGoogle(page);
    const refused = await checkRoomBody(page, 'PATCH', `/agent/rooms/${room.id}`, () => [room.contactId]);
    await loginAs('agent');
    const api = await StagingApi.of(page);
    const before = await api.listing(room.id);
    // ต้องเป็นห้องของรอบนี้เท่านั้น (กันพลาดไปแก้ห้องอื่น) และ GET ต้องคืน id ของแถวโครงการ (ใช้เทียบหลังแก้)
    expect(before.listingTitle, 'ห้องที่จะแก้ต้องเป็นห้องที่ข้อก่อนสร้าง').toBe(room.title);
    expect(before.property?.id, 'id ของแถวโครงการ').toEqual(expect.any(Number));
    const newTitle = `${room.title} edited`;

    // ขั้นที่ 1: หน้ารายการห้อง ค้นชื่อ แล้วเปิดรายละเอียดของห้องนี้ (AgentRoomsPage.web.tsx:384-390, :479)
    const rooms = new RoomsPage(page);
    const listed = waitForApi(page, 'GET', '/agent/listings', { query: (query) => query.get('q') === room.title });
    await page.goto('/agent/rooms');
    await rooms.search.fill(room.title);
    await okJson(await listed);
    await rooms.row(room.id).click();
    const detail = new RoomDetail(page);
    await expect(detail.roomCode(room.id)).toBeVisible();

    // ขั้นที่ 2: Edit > Room details แก้ชื่อประกาศ (W:2706-2717)
    await detail.edit.click();
    const wizard = new RoomWizard(page);
    await expect(wizard.saveChanges).toBeVisible();
    await wizard.section(WRITE.stepLayout).click();
    await expect(wizard.listingName).toHaveValue(room.title);
    await wizard.listingName.fill(newTitle);
    await wizard.done.click();

    // ขั้นที่ 3: Rent & terms กดการ์ดสัญญาเดิม แก้ค่าเช่า แล้ว Apply changes (W:3708-3717, :3760-3808)
    //   ความยาวสัญญาของการ์ดอ่านจากหน้าแก้เอง (การ์ดเดียวของห้องนี้) ค่าเช่าเดิมเทียบเป็นตัวเลข เผื่อ API คืนทศนิยม
    await wizard.section(WRITE.stepPricing).click();
    const card = wizard.leaseCards.first();
    await expect(wizard.leaseCards).toHaveCount(1);
    await card.click();
    await expect.poll(async () => Number(await wizard.monthlyRent.inputValue()), { message: 'ค่าเช่าเดิมในฟอร์ม' }).toBe(RENT_CREATE);
    await wizard.monthlyRent.fill(String(RENT_EDIT));
    await wizard.applyLeaseChanges.click();
    await wizard.done.click();

    // ขั้นที่ 4: Save changes ส่ง PATCH /agent/rooms/<id> แบบแทนที่ทั้งก้อน (lib/agent-listings-api.ts:188-192, SVC:204-208, :283-288)
    guard.allowWrites({ method: 'PATCH', path: new RegExp(`^/agent/rooms/${room.id}$`) });
    const patched = waitForApi(page, 'PATCH', `/agent/rooms/${room.id}`);
    await wizard.saveChanges.click();
    const response = await patched;
    await okJson(response);
    expect(refused, 'คำขอที่ถูกตัดเพราะมีผู้ติดต่ออื่น').toEqual([]);
    const body = response.request().postDataJSON() as Record<string, unknown>;
    expect(body).toMatchObject({ visibility: 'private', listingTitle: newTitle, documents: [] });
    expect(body.contacts ?? [], 'ต้องไม่ส่งผู้ติดต่อใหม่').toEqual([]);
    expect((body.prices as { price: number | string }[]).map((row) => Number(row.price))).toEqual([RENT_EDIT]);
    expect(guard.allowedWrites, 'คำขอเขียนที่ปล่อยผ่าน').toEqual([`PATCH /agent/rooms/${room.id}`]);

    // ขั้นที่ 5: กลับหน้ารายละเอียด (ไม่มี toast เมื่อแก้สำเร็จ: AgentRoomDetailModal.web.tsx:241-251) และค่าที่อ่านกลับเป็นค่าใหม่
    //   แถวโครงการและผู้ติดต่อต้องเป็นแถวเดิม (ถ้าที่อยู่ต่างไป PATCH สร้างแถว properties ใหม่: SVC:717-729)
    await expect(detail.edit).toBeVisible();
    const after = await api.listing(room.id);
    expect(after.listingTitle).toBe(newTitle);
    expect(after.visibility).toBe('private');
    expect((after.prices ?? []).map((row) => Number(row.price))).toEqual([RENT_EDIT]);
    expect(after.property?.id, 'แถวโครงการเดิม').toBe(before.property?.id);
    expect(after.property?.name, 'ชื่อโครงการไม่ได้แก้').toBe(room.title);
    expect((after.contacts ?? []).map((row) => row.id), 'ผู้ติดต่อเดิม').toEqual((before.contacts ?? []).map((row) => row.id));
    // คำขอค้นสถานที่ตอนเปิดหน้าแก้ ตรวจแยกในข้อถัดไป ข้อนี้จดจำนวนไว้อย่างเดียว
    test.info().annotations.push({ type: 'คำขอ /agent/places/* ตอนแก้ห้อง', description: String(google.places) });
  });

  test('opening the room editor does not search places by itself', async ({ page, loginAs }) => {
    // เดิมหน้าแก้ค้นสถานที่เองตอนเปิด (บั๊กที่แจ้งทีม 9 พ.ย. 2026) ทีมแก้ที่ fc1a351: จำชื่อที่แอปใส่ให้เอง (appliedPlaceName)
    //   แล้วไม่ค้นชื่อนั้น (packages/feature-listing/src/components/places-search-gate.ts) ยืนยันด้วยผลรัน 9 พ.ย. 2026 จึงเอา test.fail ออก
    //   ข้อนี้ไม่บันทึกอะไร
    //   คำขอถูกตัดในเบราว์เซอร์ (blockGoogle) จึงไม่ถึง staging และ Google
    test.skip(created === null, 'ข้อสร้างห้องไม่ผ่าน จึงไม่มีห้องของรอบนี้ให้เปิด');
    const room = created as { id: number; title: string; contactId: number };
    await blockGoogle(page);
    const paths: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      // จดแค่ path ไม่จด query (query มีชื่อโครงการ)
      if (url.pathname.startsWith('/api/v1/agent/places/')) paths.push(`${request.method()} ${url.pathname}`);
    });
    await loginAs('agent');

    // ขั้นที่ 1: เปิดรายละเอียดห้องของรอบนี้แล้วกด Edit
    const rooms = new RoomsPage(page);
    const listed = waitForApi(page, 'GET', '/agent/listings', { query: (query) => query.get('q') === room.title });
    await page.goto('/agent/rooms');
    await rooms.search.fill(room.title);
    await okJson(await listed);
    await rooms.row(room.id).click();
    const detail = new RoomDetail(page);
    await expect(detail.roomCode(room.id)).toBeVisible();
    expect(paths, 'ก่อนกด Edit ต้องยังไม่มีคำขอค้นสถานที่').toEqual([]);
    await detail.edit.click();
    const wizard = new RoomWizard(page);
    await expect(wizard.saveChanges).toBeVisible();

    // ขั้นที่ 2: เฝ้าคำขอค้นสถานที่หลังเปิดหน้าแก้ (ตัวช่วยรอ 300 ms ก่อนค้น) ต้องไม่มี
    await watchForRequest(page, (request) => request.url().includes('/api/v1/agent/places/'), PLACES_WINDOW_MS);
    test.info().annotations.push({ type: 'คำขอค้นสถานที่หลังกด Edit', description: paths.join(', ') || 'ไม่มี' });
    expect(paths, 'หน้าแก้ค้นสถานที่เองตอนเปิด (คำขอถูกตัดในเบราว์เซอร์ ไม่ถึง staging)').toEqual([]);
  });
});
