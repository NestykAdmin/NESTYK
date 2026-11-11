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
 * ข้อสงสัยข้อ "จำนวนนัดนับนัดที่ยกเลิก" ปิดด้วยโค้ดแล้ว ไม่ต้องเทส: รายการแสดงนัดที่ยกเลิกแบบจางด้วย (LeadViewingsSection.tsx:22-26, :67, :91)
 */

/** ความยาวสูงสุดของเหตุผล lost ที่ API รับ (parseLostReason: agent-leads.service.ts:369) และเพดานของช่องฝั่งแอป (LOST_REASON_MAX: AgentLeadDetailBody.tsx ที่ fc1a351) */
const LOST_REASON_MAX = 500;

/** วันนี้ตามเวลา Bangkok (YYYY-MM-DD) เบราว์เซอร์ของชุดนี้ตั้ง timezoneId Asia/Bangkok (todayIsoDate ของแอปใช้เวลาเครื่อง: MoveInDateField.tsx:10-16) */
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
