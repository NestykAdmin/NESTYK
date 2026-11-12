import type { Page } from '@playwright/test';
import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { openLead } from '../../src/web-ui/pages/lead-write.page';
import { Notify } from '../../src/web-ui/pages/notify.page';
import { RoomDetail, RoomWizard } from '../../src/web-ui/pages/room-write.page';
import { RoomsPage } from '../../src/web-ui/pages/rooms.page';
import { FLOW, WRITE } from '../../src/web-ui/labels';
import { waitForApi, okJson } from '../../src/web-ui/support/api';
import { setInputValueHidden } from '../../src/web-ui/support/inputs';
import { StagingApi } from '../../src/web-ui/write/staging-api';
import { E2E_PREFIX, findQaData, onCleanup, QA_LEAD_LABEL, restoreLead, runCleanups, runId } from '../../src/web-ui/write/web-write-env';

/**
 * ปิดข้อสงสัย 3 ข้อจากแผน claude/nestyk-web-write-flows-plan-2026-11-06.md หัวข้อ 4 (Aof สั่ง 9 พ.ย. 2026)
 * โค้ด: apps/consumer-app/components/AgentLeadDetailBody.tsx, AgentRoomDetailModal.web.tsx,
 *   packages/feature-listing/src/components/MobileCreateListingWizardBody.tsx (W), MoveInDateField.tsx และ
 *   apps/api/src/agent/leads/agent-leads.service.ts ที่ qa/e2e 74b46f4 (แอป 648dd28, API a02e532)
 *
 * รันด้วย npm run test:web-ui-write เท่านั้น สิ่งที่ต้องมี: ลีดถาวร E2E-QA-LEAD-1, ห้อง E2E-WIZ จาก RW2 (ไฟล์ agent-rooms รันก่อนไฟล์นี้)
 *   ข้อวันเข้าอยู่ต้องมีห้อง E2E-WIZ ที่สร้างก่อนวันนี้ ข้อปุ่ม Edit ต้องมีห้องที่ไม่ใช่ scout ใน 50 แถวแรกของรายการ ไม่มีก็ข้าม
 * ค่าที่คาดของข้อปุ่ม Edit เป็นข้อสันนิษฐานของ QA ที่รอทีมยืนยัน (โค้ดทำต่างไป แต่ไม่มีเอกสารบอกว่าทีมต้องการแบบไหน)
 *   ถ้าทีมตอบว่าตั้งใจไว้แล้ว ให้แก้หรือลบข้อนั้น ไม่ใช่ติด @known-bug
 * ข้อวันเข้าอยู่: Jom ยืนยัน 10 พ.ย. 2026 ว่าไม่ได้ตั้งใจ แก้ที่ UXUI/develop d3bcf28 (flag availableFromTouched ใน W)
 *   run6 (10 พ.ย. แอป cfd6633) ส่งวันนี้แทนวันเดิม ; รัน 11 พ.ย. 2026 ที่ qa/e2e 645224b ผ่าน (เดิม 2026-11-10 ส่ง 2026-11-10)
 * ทุกข้อไม่เขียนข้อมูลถาวรเพิ่ม (ข้อเหตุผล lost เขียน 2 ครั้งทุกรอบที่ผ่าน: mark-lost แล้วคืนเป็น inprogress)
 *   - เหตุผล lost: ถ้าหน้าเว็บส่ง 501 ตัว API ปฏิเสธก่อนบันทึก (parseLostReason :366-373 ถูกเรียกก่อน save :323-326)
 *     ถ้าหน้าเว็บตัดเหลือ 500 ตัว คำขอสำเร็จ ลีดเป็น lost แล้ว afterEach คืนเป็น inprogress
 *   - ปุ่ม Edit กับวันเข้าอยู่: เปิดดูอย่างเดียว คำขอบันทึกห้องถูกตอบในเบราว์เซอร์ ไม่ถึง staging
 *   - ไฟล์นี้รันหลังข้อ [footprint] ของไฟล์ลีด จึงไม่อยู่ในช่วงที่ข้อนั้นนับ เหตุผล lost ขึ้นต้นด้วยรหัสรอบเพื่อให้รู้ว่าค่าที่ค้างมาจากรอบไหน
 *     ถ้าเก็บกวาดล้ม afterEach จะแดงในรอบนั้น ข้อ footprint ไม่จับกรณีนี้
 *   - ข้อปุ่ม Edit ค้นห้องที่ไม่ใช่ของเทสด้วยชื่อ (ไม่บันทึกคำค้นในชื่อขั้น และ error ของการค้นไม่แสดงคำค้น) ถ้าเปิดห้องนั้นไม่สำเร็จ
 *     error-context.md จะมีหน้ารายการที่กรองด้วยชื่อนั้น (ข้อตกลงเรื่องไฟล์ผลใน README หัวข้อ "รายงาน": อย่าแนบหรือ commit)
 * 2 ข้อท้ายไฟล์ (เพิ่ม 11 พ.ย. 2026 เคสของ d3bcf28 ที่ Jom ฝาก) อ้างเลขบรรทัดของ W ที่ qa/e2e 5dff89e และแก้คำตอบ GET /agent/listings/<id> ในเบราว์เซอร์
 *   (เติม promo หรือทำให้วันเข้าอยู่เป็น null) คำขอบันทึกถูกตอบในเบราว์เซอร์เหมือนข้อวันเข้าอยู่ ไม่ถึง API
 * ข้อสงสัยข้อ "จำนวนนัดนับนัดที่ยกเลิก" ปิดด้วยโค้ดแล้ว ไม่ต้องเทส: รายการแสดงนัดที่ยกเลิกแบบจางด้วย (LeadViewingsSection.tsx:22-26, :67, :91)
 */

/** ความยาวสูงสุดของเหตุผล lost ที่ API รับ (parseLostReason: agent-leads.service.ts:369) และเพดานของช่องฝั่งแอป (LOST_REASON_MAX: AgentLeadDetailBody.tsx ที่ fc1a351) */
const LOST_REASON_MAX = 500;

/** วันนี้ตามเวลา Bangkok (YYYY-MM-DD) เบราว์เซอร์ของชุดนี้ตั้ง timezoneId Asia/Bangkok (playwright.web-ui.config.ts:49 ชุด write ใช้ค่าเดียวกัน) (todayIsoDate ของแอปใช้เวลาเครื่อง: MoveInDateField.tsx:10-16) */
function bangkokToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** ตัดคำขอค้นสถานที่และแผนที่ของ Google ในเบราว์เซอร์ (หน้าแก้ห้องค้นเองตอนเปิด: บั๊กที่แจ้งทีม 9 พ.ย. 2026) */
async function blockGoogle(page: Page): Promise<void> {
  await page.route(
    (url) => url.pathname.startsWith('/api/v1/agent/places/') || url.hostname === 'maps.googleapis.com' || url.hostname === 'maps.gstatic.com',
    (route) => route.abort('blockedbyclient'),
  );
}

/**
 * เปิดรายละเอียดห้องจากหน้ารายการ ค้นด้วยชื่อแบบไม่บันทึกคำค้นในรายงาน (ห้องที่ไม่ใช่ของเทสอาจมีชื่อของคนจริง)
 * title ต้องตัดช่องว่างหัวท้ายแล้ว เพราะหน้าเว็บตัดก่อนส่ง (AgentRoomsPage.web.tsx:100) และต้องตรวจมาแล้วว่าคำค้นนี้เจอห้องนี้ (findableBy)
 */
async function openRoom(page: Page, id: number, title: string): Promise<RoomDetail> {
  const rooms = new RoomsPage(page);
  const listed = waitForApi(page, 'GET', '/agent/listings', { query: (query) => query.get('q') === title });
  await page.goto('/agent/rooms');
  await expect(rooms.search).toBeVisible();
  await setInputValueHidden(rooms.search, title);
  await okJson(await listed);
  await rooms.row(id).click();
  const detail = new RoomDetail(page);
  await expect(detail.roomCode(id)).toBeVisible();
  return detail;
}

/** จำนวนแถวต่อหน้าของหน้ารายการห้องบนเว็บ (AgentRoomsPage.web.tsx:41 limit=24) */
const ROOMS_PAGE_SIZE = 24;

/**
 * คำค้น (ชื่อที่ตัดช่องว่างแล้ว) ที่ API คืนห้องนี้ และผลทั้งหมดไม่เกิน 1 หน้าของเว็บ (แถวที่ต้องคลิกจึงอยู่หน้าแรกแน่) หรือ null
 * error ของการค้นไม่แสดงคำค้น เพราะชื่อห้องที่ไม่ใช่ของเทสอาจเป็นข้อมูลของคนจริง
 */
async function findableBy(api: StagingApi, id: number, title: string | null): Promise<string | null> {
  const q = (title ?? '').trim();
  if (q.length < 2) return null;
  const found = await api.listings(q).catch(() => {
    throw new Error(`ค้นห้อง id ${id} ด้วยชื่อไม่สำเร็จ (ไม่แสดงคำค้น)`);
  });
  return found.total <= ROOMS_PAGE_SIZE && found.items.some((row) => row.id === id) ? q : null;
}

test.afterEach(async () => {
  await runCleanups();
});

test('the lost reason box stops at the 500 characters the API accepts', async ({ page, loginAs, guard }) => {
  await loginAs('agent');
  const api = await StagingApi.of(page);
  const { lead: before } = await findQaData(api);
  onCleanup(() => restoreLead(api, before.id, before), test.info());
  const lead = before.status === 'inprogress' ? before : await api.markInProgress(before.id);
  const prefix = `${E2E_PREFIX}${runId()} `;
  const tooLong = `${prefix}${'x'.repeat(LOST_REASON_MAX + 1 - prefix.length)}`;

  // ขั้นที่ 1: In care > Not proceeding พิมพ์เหตุผล 501 ตัว (ช่องตั้ง maxLength={LOST_REASON_MAX} ตั้งแต่ fc1a351 ช่องจึงรับไว้ 500 ตัว)
  const detail = await openLead(page, lead.id, QA_LEAD_LABEL);
  await detail.statusButton(FLOW.leadStatus.inprogress).click();
  await detail.statusOption(WRITE.markLost).click();
  await detail.lostReason.fill(tooLong);
  const typed = (await detail.lostReason.inputValue()).length;
  test.info().annotations.push({ type: 'ความยาวในช่องหลังพิมพ์ 501 ตัว', description: String(typed) });
  expect(typed, `ช่องเหตุผลต้องรับได้ ${LOST_REASON_MAX} ตัวพอดี`).toBe(LOST_REASON_MAX);
  // ตัวนับใต้ช่องต้องตรงกับจำนวนในช่อง (เพิ่มที่ fc1a351)
  await expect(detail.lostReasonCounter(typed, LOST_REASON_MAX)).toBeVisible();

  // ขั้นที่ 2: ยืนยัน แล้วจดว่า API ตอบอะไรและผู้ใช้เห็นอะไร (หลักฐานสำหรับแจ้งทีม)
  guard.allowWrites({ method: 'POST', path: new RegExp(`^/agent/leads/${lead.id}/mark-lost$`) });
  const sent = waitForApi(page, 'POST', `/agent/leads/${lead.id}/mark-lost`);
  await detail.confirmLost.click();
  const response = await sent;
  test.info().annotations.push({ type: 'คำตอบของ mark-lost', description: String(response.status()) });
  expect(guard.allowedWrites, 'คำขอเขียนที่ปล่อยผ่าน').toEqual([`POST /agent/leads/${lead.id}/mark-lost`]);
  if (!response.ok()) {
    // ถ้า API ปฏิเสธ (ไม่ควรเกิดหลัง fc1a351) จดสิ่งที่ผู้ใช้เห็นไว้เป็นหลักฐานก่อนข้อ response.ok ด้านล่างแดง
    // หัว toast เป็น saveError ตั้งแต่ fc1a351 (เดิม loadError)
    const toast = new Notify(page).toast('error', WRITE.saveLeadError);
    await expect.soft(toast).toBeVisible();
    if (await toast.count()) test.info().annotations.push({ type: 'toast ที่ผู้ใช้เห็น', description: (await toast.innerText()).replace(/\s+/g, ' ') });
    expect.soft((await api.lead(lead.id)).status, 'API ปฏิเสธ ลีดต้องไม่เปลี่ยน').toBe('inprogress');
  }

  // ขั้นที่ 3: เหตุผลที่ช่องยอมให้พิมพ์ต้องบันทึกได้ (API รับ 500 ตัว) ลีดเปลี่ยนเป็น lost แล้ว afterEach คืนเป็น inprogress
  //   เดิม (run5 9 พ.ย. 2026) ช่องรับ 501 ตัว API ตอบ 400 ทีมแก้ที่ fc1a351 ผลรัน 9 พ.ย. 2026 หลังแก้: ช่องรับ 500 ตัว API ตอบ 201
  expect(response.ok(), 'เหตุผลที่ช่องรับต้องบันทึกได้').toBe(true);
  expect((await api.lead(lead.id)).status, 'ลีดต้องเปลี่ยนเป็น lost').toBe('lost');
});

test('a room the agent cannot edit has no Edit button', async ({ page, loginAs }) => {
  await blockGoogle(page);
  await loginAs('agent');
  const api = await StagingApi.of(page);
  // ห้องที่ไม่ใช่ scout แก้ผ่าน API ไม่ได้ (PATCH ตอบ 404: agent-rooms.service.ts:204-208) แต่ปุ่ม Edit ขึ้นเมื่อโหลดห้องเสร็จทุกห้อง
  //   (AgentRoomDetailModal.web.tsx:185-197 ไม่ดู isScoutRoom)
  const list = await api.listings('');
  expect(
    list.items.every((row) => typeof row.isScoutRoom === 'boolean'),
    'รายการห้องต้องมีช่อง isScoutRoom ทุกแถว (ไม่อย่างนั้นข้อนี้แยกห้องไม่ได้)',
  ).toBe(true);

  // ขั้นที่ 1 (ตัวยืนยันว่าตัวหาปุ่ม Edit ยังใช้ได้): ห้อง scout ของเทส (E2E-WIZ) ต้องเห็นปุ่ม Edit เปิดดูอย่างเดียว ไม่กด
  const scout = (await api.listings(`${E2E_PREFIX}WIZ-`)).items.find(
    (row) => row.isScoutRoom === true && (row.listingTitle ?? '').startsWith(`${E2E_PREFIX}WIZ-`),
  );
  test.skip(!scout, 'ไม่มีห้อง E2E-WIZ ใช้ยืนยันตัวหาปุ่ม Edit ไม่ได้ (RW2 ต้องเคยผ่าน)');
  const scoutQ = await findableBy(api, scout!.id, scout!.listingTitle);
  test.skip(!scoutQ, 'ค้นห้อง E2E-WIZ ด้วยชื่อไม่เจอ');
  const scoutDetail = await openRoom(page, scout!.id, scoutQ as string);
  await expect(scoutDetail.edit, 'ห้อง scout ต้องมีปุ่ม Edit').toBeVisible();

  // ขั้นที่ 2: เลือกห้องที่ไม่ใช่ scout ที่ค้นด้วยชื่อแล้วเจอ
  let target: { id: number; q: string } | null = null;
  for (const row of list.items.filter((item) => item.isScoutRoom === false)) {
    const q = await findableBy(api, row.id, row.listingTitle);
    if (q) {
      target = { id: row.id, q };
      break;
    }
  }
  test.skip(!target, `หน้าแรกของรายการห้อง qa-agent (${list.items.length} ห้อง) ไม่มีห้องที่ไม่ใช่ scout ที่ค้นด้วยชื่อได้ ข้อนี้ตรวจไม่ได้`);
  const room = target as { id: number; q: string };
  test.info().annotations.push({ type: 'ห้องที่เปิด', description: `id ${room.id}` });

  // ขั้นที่ 3: เปิดรายละเอียดห้อง (ไม่กด Edit) นับปุ่ม Edit ทันทีหลังเห็น NK-<id> (ขึ้นด้วยเงื่อนไขเดียวกัน: AgentRoomDetailModal.web.tsx:181, :186)
  //   แล้วออกจากหน้าก่อนตรวจ เพื่อไม่ให้รายละเอียดของห้องที่ไม่ใช่ของเทสไปอยู่ในโครงหน้าจอของรายงาน (error-context.md)
  const detail = await openRoom(page, room.id, room.q);
  const editCount = await detail.edit.count();
  await page.goto('about:blank');
  expect(editCount, 'ปุ่ม Edit ของห้องที่ไม่ใช่ scout').toBe(0);
});

test('opening and saving a room whose move-in date has passed keeps that date', async ({ page, loginAs }) => {
  await blockGoogle(page);
  await loginAs('agent');
  const api = await StagingApi.of(page);
  const today = bangkokToday();
  // ห้องของเทสหน้าเว็บจากรอบก่อน (RW2) ที่วันเข้าอยู่ผ่านมาแล้ว ห้องใหม่วันเข้าอยู่เป็นวันที่สร้าง จึงมีให้ตรวจตั้งแต่วันถัดไป
  const wizRooms = (await api.listings(`${E2E_PREFIX}WIZ-`)).items.filter((row) => (row.listingTitle ?? '').startsWith(`${E2E_PREFIX}WIZ-`));
  let target: { id: number; title: string; date: string } | null = null;
  for (const row of wizRooms) {
    const detail = await api.listing(row.id);
    if (detail.availableFromDate && detail.availableFromDate < today) {
      target = { id: row.id, title: row.listingTitle as string, date: detail.availableFromDate };
      break;
    }
  }
  test.skip(!target, `ยังไม่มีห้อง E2E-WIZ ที่วันเข้าอยู่ก่อนวันนี้ (${today}) ห้องที่ RW2 สร้างจะผ่านเกณฑ์ตั้งแต่วันถัดไป`);
  const room = target as { id: number; title: string; date: string };

  // ตอบคำขอบันทึกห้องในเบราว์เซอร์ จดเนื้อคำขอไว้ คำขอไม่ถึง staging (route ของ page ทำงานก่อนตัวกันของ context)
  let saved: { availableFromDate?: string } | null = null;
  await page.route(
    (url) => url.pathname === `/api/v1/agent/rooms/${room.id}`,
    (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      saved = route.request().postDataJSON() as { availableFromDate?: string };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: room.id }) });
    },
  );

  // ขั้นที่ 1: เปิดหน้าแก้ของห้องนี้แล้วกด Save changes ทันทีโดยไม่แก้อะไร
  const q = await findableBy(api, room.id, room.title);
  test.skip(!q, 'ค้นห้อง E2E-WIZ ด้วยชื่อไม่เจอ');
  const detail = await openRoom(page, room.id, q as string);
  await detail.edit.click();
  const wizard = new RoomWizard(page);
  await expect(wizard.saveChanges).toBeVisible();
  await wizard.saveChanges.click();
  await expect.poll(() => saved, { message: 'คำขอ PATCH ไม่ถูกส่ง' }).not.toBeNull();

  // ขั้นที่ 2: วันเข้าอยู่ที่จะบันทึกต้องเป็นค่าเดิม ไม่ใช่วันนี้
  //   ก่อน d3bcf28 โค้ดตั้งค่าเริ่มต้นด้วย clampMoveInDate ซึ่งเปลี่ยนวันที่ผ่านมาแล้วเป็นวันนี้ (W:552, :2110, MoveInDateField.tsx:18-22 ที่ cfd6633)
  const sent = (saved as { availableFromDate?: string } | null)?.availableFromDate;
  test.info().annotations.push({ type: 'วันเข้าอยู่', description: `เดิม ${room.date} ส่ง ${sent} วันนี้ ${today}` });
  expect(sent, 'วันเข้าอยู่ที่จะบันทึก').toBe(room.date);
});

/** ห้องของเทสหน้าเว็บ (E2E-WIZ จาก RW2) ที่วันเข้าอยู่ก่อนวันนี้ และค้นด้วยชื่อเจอ หรือ null */
async function pastMoveInWizRoom(api: StagingApi, today: string): Promise<{ id: number; q: string; date: string } | null> {
  const wizRooms = (await api.listings(`${E2E_PREFIX}WIZ-`)).items.filter((row) => (row.listingTitle ?? '').startsWith(`${E2E_PREFIX}WIZ-`));
  for (const row of wizRooms) {
    const detail = await api.listing(row.id);
    if (!detail.availableFromDate || detail.availableFromDate >= today) continue;
    const q = await findableBy(api, row.id, row.listingTitle as string);
    if (q) return { id: row.id, q, date: detail.availableFromDate };
  }
  return null;
}

/**
 * ตอบคำขอบันทึกห้องในเบราว์เซอร์ และจดเนื้อคำขอทุกครั้ง คำขอไม่ถึง API (route ของ page ทำงานก่อนตัวกันของ context)
 * ต้องเรียกก่อนกด Edit path ต้องเท่ากันทั้งเส้น (lib/agent-listings-api.ts:188-192 ส่ง PATCH /agent/rooms/<id>)
 */
async function answerRoomSave(page: Page, roomId: number): Promise<Record<string, unknown>[]> {
  const saved: Record<string, unknown>[] = [];
  await page.route(
    (url) => url.pathname === `/api/v1/agent/rooms/${roomId}`,
    (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      saved.push(route.request().postDataJSON() as Record<string, unknown>);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: roomId }) });
    },
  );
  return saved;
}

/**
 * แก้คำตอบของ GET /agent/listings/<id> ก่อนถึงหน้าเว็บ (หน้ารายละเอียดเรียกเส้นนี้ตอนเปิดและหลังบันทึก: AgentRoomDetailModal.web.tsx:80-101, :249)
 * คำขอจริงยังไปถึง API (อ่านอย่างเดียว) path ต้องเท่ากันทั้งเส้น เพราะ /agent/listings/<id>/share-links เป็นอีกเส้น
 */
async function editRoomDetailAnswer(page: Page, roomId: number, edit: (detail: Record<string, unknown>) => void): Promise<void> {
  await page.route(
    (url) => url.pathname === `/api/v1/agent/listings/${roomId}`,
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const response = await route.fetch();
      if (!response.ok()) return route.fulfill({ response });
      const detail = (await response.json()) as Record<string, unknown>;
      edit(detail);
      return route.fulfill({ response, json: detail });
    },
  );
}

/** promo ที่เทสเติมให้เมื่อห้องไม่มี (ห้องที่ RW2 สร้างไม่มี promo: หัวข้อ promo มีในหน้าแก้เท่านั้น W:72-75 CREATE_STEPS ไม่มีหัวข้อ 7) */
const QA_PROMO_TITLE = `${E2E_PREFIX}promo copy`;

/**
 * เคสของ d3bcf28 ข้อ 2 (Jom 10 พ.ย. 2026): ห้องที่วันเข้าอยู่ผ่านมาแล้วและมี promo เปิดหัวข้ออื่นแล้วกด Done โดยไม่แก้อะไร ต้องไม่ถูกเตือนว่า promo ไม่ตรง
 *   เดิม: ตอนกด Done ลายนิ้วมือของ promo ใช้วันที่ถูกเปลี่ยนเป็นวันนี้ เทียบกับวันดิบตอนเปิดหน้า จึงต่างกันเอง (W:1680-1688) แล้วตอน Save ขึ้นหน้าต่างเตือน (W:2167-2183)
 *   แก้: ถ้ายังไม่แตะช่องวันที่ ใช้วันเดิมทั้ง 2 ฝั่ง (W:1498-1503 กับ :668)
 * หัวข้อที่เปิดคือ Room details (ช่องวันเข้าอยู่อยู่ในหัวข้อนี้ W:2913-2926 เทสไม่แตะช่องนั้น)
 * ขั้นที่ 3 เป็นกรณีควบคุม: แก้ค่าเช่า (อยู่ในลายนิ้วมือ W:1520-1525) แล้วต้องเห็นหน้าต่างเตือน เพื่อยืนยันว่าตัวหาหน้าต่างใช้ได้ และห้องนี้มี promo จริง
 * คำขอบันทึกทุกครั้งถูกตอบในเบราว์เซอร์ ไม่ถึง API ข้อมูลห้องไม่ถูกเปลี่ยน
 * ถ้าห้องไม่มี promo เทสเติม promoTitle ในคำตอบ GET ให้ (annotation บอกว่าเติมหรือไม่)
 *   ข้อจำกัด: เมื่อเทสเติมเอง ข้อนี้จับไม่ได้ว่า API ยังคืน promoTitle หรือ description ให้ห้องที่มี promo จริงหรือไม่
 *   และยังไม่ได้ลองทางที่ห้องมีแค่ description (W:645 ใช้ promoTitle || description) (test-reviewer 12 พ.ย. 2026)
 * ถ้าแดงที่ขั้นที่ 2 ทั้งที่ไม่ได้แตะวันที่ ให้ดูช่องอื่นของลายนิ้วมือที่ค่าตอนเปิดกับตอนกด Done อาจต่างกันเอง เช่น advance/deposit ของแถวราคา (W:665-666 กับ :580-583)
 */
test('a room with a past move-in date and promo copy saves without the stale-copy prompt when nothing was edited', async ({ page, loginAs }) => {
  await blockGoogle(page);
  await loginAs('agent');
  const api = await StagingApi.of(page);
  const today = bangkokToday();
  const room = await pastMoveInWizRoom(api, today);
  test.skip(!room, `ยังไม่มีห้อง E2E-WIZ ที่วันเข้าอยู่ก่อนวันนี้ (${today}) และค้นด้วยชื่อเจอ`);
  const target = room as { id: number; q: string; date: string };

  // แอปถือว่าห้องมี promo เมื่อมี promoTitle หรือ description อย่างใดอย่างหนึ่ง (AgentRoomEditor.tsx:27-28, W:645)
  //   จดจำนวน (ไม่จดเนื้อหา) ของช่องอื่นในลายนิ้วมือที่ค่าตอนเปิดกับตอนกด Done อาจต่างกันเอง ไว้ดูถ้าขั้นที่ 2 แดง
  let promoAdded = false;
  let detailEdited = false;
  let fingerprintRisks = '';
  await editRoomDetailAnswer(page, target.id, (detail) => {
    const title = typeof detail.promoTitle === 'string' ? detail.promoTitle.trim() : '';
    const description = typeof detail.description === 'string' ? detail.description.trim() : '';
    if (!title && !description) {
      detail.promoTitle = QA_PROMO_TITLE;
      promoAdded = true;
    }
    detailEdited = true;
    const prices = Array.isArray(detail.prices) ? (detail.prices as Record<string, unknown>[]) : [];
    const noTerms = prices.filter((price) => price.advanceRentMonths == null || price.depositMonths == null).length;
    const nearby = Array.isArray(detail.nearbyPlaces) ? detail.nearbyPlaces.length : 0;
    const custom = Array.isArray(detail.customFacilities) ? detail.customFacilities.length : 0;
    fingerprintRisks = `แถวราคา ${prices.length} (ไม่มี advance/deposit ${noTerms}) nearby ${nearby} customFacilities ${custom}`;
  });
  const saved = await answerRoomSave(page, target.id);
  const notify = new Notify(page);

  // ขั้นที่ 1: Edit > Room details แล้วกด Done โดยไม่แก้อะไร (รอให้ชื่อประกาศขึ้นในช่องก่อน = ข้อมูลห้องถูกใส่ในฟอร์มแล้ว)
  const detail = await openRoom(page, target.id, target.q);
  expect(detailEdited, 'คำตอบ GET ของห้องต้องผ่านตัวแก้ของเทสก่อนเปิดหน้าแก้ (ห้องจึงมี promo แน่ ไม่อย่างนั้นแอปไม่ตรวจว่า promo ไม่ตรง W:645, :1681-1685)').toBe(true);
  test.info().annotations.push({ type: 'promo', description: `${promoAdded ? 'เทสเติม promoTitle ในคำตอบ GET' : 'ห้องมี promo อยู่แล้ว'} | ${fingerprintRisks}` });
  await detail.edit.click();
  const wizard = new RoomWizard(page);
  await expect(wizard.saveChanges).toBeVisible();
  await wizard.section(WRITE.stepLayout).click();
  await expect(wizard.listingName).toHaveValue(target.q);
  await wizard.done.click();

  // ขั้นที่ 2: Save changes ต้องส่ง PATCH ทันที ถ้ามีหน้าต่างเตือน แอปจะยังไม่ส่งจนกว่าจะกดปุ่มในหน้าต่าง (W:2167-2183)
  await expect(wizard.saveChanges).toBeVisible();
  await wizard.saveChanges.click();
  await expect
    .poll(() => saved.length, {
      message: `คำขอ PATCH ไม่ถูกส่งหลังกด Save changes (ถ้ามีหน้าต่างเตือน promo ค้างอยู่ แปลว่าแอปถือว่า promo ไม่ตรงทั้งที่ไม่ได้แก้อะไร สาเหตุอาจเป็นวันเข้าอยู่ หรือช่องอื่นของลายนิ้วมือ: ${fingerprintRisks})`,
    })
    .toBe(1);
  // ตัวตัดสินของขั้นนี้คือ poll ข้างบน: ถ้าแอปถือว่า promo ล้าสมัย จะเปิดหน้าต่างแล้วไม่ส่ง PATCH (W:2167-2183) และหน้าต่างไม่ปิดเอง
  //   บรรทัดถัดไปยืนยันซ้ำเท่านั้น (toHaveCount รอจนนับได้ 0 จึงไม่ได้พิสูจน์ว่าหน้าต่าง "ไม่เคยขึ้น")
  await expect(notify.dialog, 'ต้องไม่มีหน้าต่างเตือน').toHaveCount(0);
  test.info().annotations.push({ type: 'วันเข้าอยู่', description: `เดิม ${target.date} ส่ง ${String(saved[0].availableFromDate)} วันนี้ ${today}` });
  expect(saved[0].availableFromDate, 'วันเข้าอยู่ที่จะบันทึกต้องเป็นค่าเดิม (ไม่ได้แตะช่องวันที่)').toBe(target.date);
  // lib/agent-listings-api.ts:190 ตัด promoCopyStale ออกก่อนส่ง ช่องนี้จึงต้องไม่อยู่ในคำขอ
  expect(Object.keys(saved[0]), 'ช่องในคำขอ').not.toContain('promoCopyStale');

  // ขั้นที่ 3 (กรณีควบคุม ไม่ใช่สิ่งที่ชื่อเทสสัญญา: ถ้าแดงตั้งแต่ขั้นนี้ไป แปลว่าการเตือน promo พังหรือหน้าจอเปลี่ยน ไม่ใช่เรื่องวันเข้าอยู่): หลังบันทึก หน้ากลับไปที่รายละเอียด (AgentRoomDetailModal.web.tsx:241-249) เปิดแก้อีกครั้ง แก้ค่าเช่า แล้ว Save ต้องเห็นหน้าต่างเตือน
  //   และต้องยังไม่ส่ง PATCH ครั้งที่ 2 กดปุ่ม "Edit listing copy" (ไม่บันทึก: W:2176-2180) แล้วจบ ค่าเช่าที่แก้ไม่ถูกบันทึก
  await expect(detail.edit).toBeVisible();
  await detail.edit.click();
  await expect(wizard.saveChanges).toBeVisible();
  await wizard.section(WRITE.stepPricing).click();
  await wizard.leaseCards.first().click();
  await expect(wizard.monthlyRent).not.toHaveValue('');
  const rent = Number(await wizard.monthlyRent.inputValue());
  expect(Number.isFinite(rent) && rent > 0, 'ค่าเช่าเดิมในฟอร์มต้องเป็นตัวเลข').toBe(true);
  await wizard.monthlyRent.fill(String(rent + 1));
  await wizard.applyLeaseChanges.click();
  await wizard.done.click();
  await expect(wizard.saveChanges).toBeVisible();
  await wizard.saveChanges.click();
  await expect(notify.dialog, 'แก้ค่าเช่าแล้วต้องเห็นหน้าต่างเตือน promo').toBeVisible();
  await expect(notify.dialog).toContainText(WRITE.promoStaleAlertTitle);
  expect(saved.length, 'ระหว่างที่หน้าต่างเตือนเปิดอยู่ต้องยังไม่ส่ง PATCH ครั้งที่ 2').toBe(1);
  await notify.dialogButton('default').click();
  await expect(notify.dialog).toHaveCount(0);
  // ปุ่มนี้เปิดหัวข้อ 7 ซึ่งมีปุ่ม Done (W:2176-2180) ถ้าแอปบันทึกแทน หน้าแก้จะปิด (AgentRoomDetailModal.web.tsx:241-243) รอให้เห็นปุ่ม Done ก่อนนับ
  await expect(wizard.done).toBeVisible();
  expect(saved.length, 'ปุ่ม Edit listing copy ต้องไม่บันทึก').toBe(1);
});

/**
 * เคสของ d3bcf28 ข้อ 1 ส่วนที่ 2 (Jom 10 พ.ย. 2026): ห้องที่ไม่มีวันเข้าอยู่ กด Save โดยไม่แตะช่องวันที่ ยังต้องส่งวันนี้เหมือนเดิม
 *   ฐานข้อมูลไม่มีห้องแบบนี้ (available_from_date เป็น NOT NULL: Jom แจ้ง 11 พ.ย. 2026) เทสจึงแก้คำตอบ GET ให้ availableFromDate เป็น null
 *   โค้ด: W:561 ตั้งช่องเป็นวันนี้ และ W:2126-2129 ส่งวันนี้เมื่อไม่มีวันเดิม (storedMoveInDate(null) ได้ค่าว่าง W:65-68)
 * วันนี้ตามเวลาเครื่องของเบราว์เซอร์ (MoveInDateField.tsx:10-16 ชุดนี้ตั้ง timezoneId Asia/Bangkok: playwright.web-ui.config.ts:49) อ่านก่อนและหลังกด Save
 *   ครอบแค่ช่วงตั้งแต่กดจนแอปสร้างเนื้อคำขอ ถ้าเที่ยงคืนผ่านไประหว่างกด Edit กับกด Save แอปจะตรวจว่าวันในช่องผ่านมาแล้ว (W:1346-1354)
 *   และไม่ส่งคำขอ ข้อนี้จะแดงด้วย "คำขอ PATCH ไม่ถูกส่ง" ทั้งที่แอปทำถูก ให้รันซ้ำหลังเที่ยงคืน (test-reviewer 12 พ.ย. 2026)
 * คำขอบันทึกถูกตอบในเบราว์เซอร์ ไม่ถึง API
 */
test('a room without a move-in date is saved with today when the date was not touched', async ({ page, loginAs }) => {
  await blockGoogle(page);
  await loginAs('agent');
  const api = await StagingApi.of(page);
  const wizRooms = (await api.listings(`${E2E_PREFIX}WIZ-`)).items.filter((row) => (row.listingTitle ?? '').startsWith(`${E2E_PREFIX}WIZ-`));
  let target: { id: number; q: string } | null = null;
  for (const row of wizRooms) {
    const q = await findableBy(api, row.id, row.listingTitle as string);
    if (q) {
      target = { id: row.id, q };
      break;
    }
  }
  test.skip(!target, 'ไม่มีห้อง E2E-WIZ ที่ค้นด้วยชื่อเจอ');
  const room = target as { id: number; q: string };

  let nulled = 0;
  await editRoomDetailAnswer(page, room.id, (detail) => {
    detail.availableFromDate = null;
    nulled += 1;
  });
  const saved = await answerRoomSave(page, room.id);

  // ขั้นที่ 1: เปิดรายละเอียดห้อง (คำตอบ GET ถูกแก้ให้ไม่มีวันเข้าอยู่) แล้วกด Edit
  const detail = await openRoom(page, room.id, room.q);
  expect(nulled, 'คำตอบ GET ของห้องต้องถูกแก้ก่อนเปิดหน้าแก้').toBeGreaterThan(0);
  await detail.edit.click();
  const wizard = new RoomWizard(page);
  await expect(wizard.saveChanges).toBeVisible();
  // ขั้นที่ 2: Save changes ทันทีโดยไม่แตะช่องวันที่ วันเข้าอยู่ที่ส่งต้องเป็นวันนี้
  const before = bangkokToday();
  await wizard.saveChanges.click();
  await expect.poll(() => saved.length, { message: 'คำขอ PATCH ไม่ถูกส่ง' }).toBe(1);
  const after = bangkokToday();
  const sent = saved[0].availableFromDate;
  test.info().annotations.push({ type: 'วันเข้าอยู่', description: `เดิม ไม่มี (แก้คำตอบ GET) ส่ง ${String(sent)} วันนี้ ${after}` });
  expect([before, after], 'วันเข้าอยู่ที่จะบันทึกต้องเป็นวันนี้').toContain(sent);
});
