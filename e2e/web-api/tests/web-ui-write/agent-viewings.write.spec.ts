import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { ViewingWrite } from '../../src/web-ui/pages/viewing-write.page';
import { AgentCalendarPage } from '../../src/web-ui/pages/agent-calendar.page';
import { WRITE } from '../../src/web-ui/labels';
import { apiPathOf, okJson, waitForApi } from '../../src/web-ui/support/api';
import { StagingApi } from '../../src/web-ui/write/staging-api';
import { cancelTestViewings, E2E_PREFIX, findQaData, onCleanup, runCleanups, runId } from '../../src/web-ui/write/web-write-env';

/**
 * เทสเขียนข้อมูลบนเว็บ: เลื่อนและยกเลิกนัดดูห้องจากปฏิทินของนายหน้า (แผน claude/nestyk-web-write-flows-plan-2026-11-06.md ข้อ VW1-VW2 รวมในข้อเดียว)
 * โค้ด: apps/consumer-app/components/agent-web/AgentCalendarPage.web.tsx (ปฏิทินบนจอ 1280 ที่ pre/dev/review fc1a351),
 *   LeadViewingSheet.tsx, app/index.tsx และ apps/api/src/agent/leads/lead-viewings.service.ts ที่ qa/e2e 74b46f4 (API a02e532)
 *
 * รันด้วย npm run test:web-ui-write เท่านั้น ใช้ลีดถาวร E2E-QA-LEAD-1 กับห้องถาวร E2E-QA-ROOM-1 ของ qa-agent บน staging
 *   - เทสสร้างนัดผ่าน API (ขั้นเตรียม) เพราะหน้าเว็บสร้างนัดได้ทางเดียวคือหน้าห้องที่จับคู่ ซึ่งลีดถาวรเข้าไม่ได้ (ไม่มีงบและหมุด)
 *   - นัดลบไม่ได้ ยกเลิกได้อย่างเดียว (มีแค่ POST และ PATCH: lead-viewings.controller.ts:15-18) ทุกรอบจึงเหลือนัด cancelled 1 แถว
 *     ทีมตกลงเรื่องข้อมูล E2E- แล้ว (tests/write/rental-lifecycle.write.spec.ts ก็ทิ้งนัด 1 แถวต่อรอบ)
 *   - afterEach ยกเลิกนัดของเทสที่ยัง scheduled ผ่าน API เสมอ (ลีดที่มีนัดค้าง ทำให้ findQaData ของรอบหน้าหยุด ถ้า note ไม่ใช่ของเทส)
 */

/**
 * นัดล่วงหน้ากี่วัน ค่าที่เลือกเอง: ต้องเป็นอนาคต (หน้าเว็บไม่ให้บันทึกเวลาที่ผ่านแล้ว: LeadViewingSheet.tsx:137-138, :160)
 * และไม่ใช่วันนี้ เพื่อให้ ?date= เปลี่ยนวันที่เลือกจริง ส่วน 3 วันอยู่ในช่วงที่ปฏิทินโหลด (เดือนที่เห็น ±7 วัน: agent-calendar-viewings.ts calendarViewingRange)
 */
const DAYS_AHEAD = 3;

/** เวลาเปิดปฏิทินครั้งแรก ค่าที่เลือกเอง: เว็บในโหมดนักพัฒนาโหลดหน้านายหน้าครั้งแรกช้ากว่า expect เริ่มต้น (10 วินาที) */
const CALENDAR_LOAD_TIMEOUT_MS = 20_000;

/** วันที่ตามเวลา Bangkok (YYYY-MM-DD) ของวันนี้บวก days วัน */
function bangkokDay(days: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(Date.now() + days * 86_400_000),
  );
}

/** เวลา ISO ของวันและเวลาตามเวลา Bangkok (เบราว์เซอร์ของชุดนี้ตั้ง timezoneId Asia/Bangkok: playwright.web-ui.config.ts) */
function bangkokTime(day: string, time: string): string {
  return new Date(`${day}T${time}:00+07:00`).toISOString();
}

// เก็บกวาดหลังทุกข้อ แม้ข้อนั้นหมดเวลา (เหตุผลที่ไม่ใช้ finally: web-write-env.ts onCleanup)
test.afterEach(async () => {
  await runCleanups();
});

test('a viewing can be moved to another time and then cancelled from the calendar', async ({ page, loginAs, guard }) => {
  await loginAs('agent');
  const api = await StagingApi.of(page);
  // findQaData ย้ายลีดที่ค้างเป็น lost กลับเป็น inprogress ก่อน (สร้างนัดให้ลีดที่ปิดแล้วไม่ได้: lead-viewings.service.ts:122-124)
  const { lead, roomId } = await findQaData(api);
  const rowsBefore = (await api.viewings(lead.id)).length;
  const day = bangkokDay(DAYS_AHEAD);
  const note = `${E2E_PREFIX}${runId()} web viewing`;

  // ขั้นเตรียม: สร้างนัด 10:00 ผ่าน API แล้วอ่านชื่อลีดจากข้อมูลชุดเดียวกับปฏิทิน
  let created = false;
  onCleanup(async () => {
    const rows = await api.viewings(lead.id);
    await cancelTestViewings(api, rows);
    // รอยของรอบนี้: นัดเพิ่ม 1 แถวเท่านั้น (เมื่อสร้างได้) และไม่เหลือนัดของเทสที่ยัง scheduled
    const after = await api.viewings(lead.id);
    test.info().annotations.push({ type: 'นัดของลีดถาวร', description: `${rowsBefore} -> ${after.length}` });
    expect.soft(after.length, 'นัดที่เพิ่มในรอบนี้').toBe(rowsBefore + (created ? 1 : 0));
    expect.soft(after.filter((row) => row.status === 'scheduled' && (row.note ?? '').startsWith(E2E_PREFIX)).length, 'นัดของเทสที่ยังค้าง').toBe(0);
   }, test.info());
  const viewing = await api.createViewing(lead.id, { rentRoomId: roomId, scheduledAt: bangkokTime(day, '10:00'), note });
  created = true;
  const listed = await api.agentViewings(bangkokTime(day, '00:00'), bangkokTime(day, '23:59'));
  const row = listed.find((item) => item.id === viewing.id);
  expect(row, 'นัดที่สร้างต้องอยู่ในนัดของวันนั้น').toBeTruthy();

  // ขั้นที่ 1: เปิดปฏิทินที่วันนั้น รายการของวันมีปุ่ม Reschedule / cancel ของนัดนี้
  //   (calendar.manage.<id> ใน AgentCalendarPage.web.tsx ที่ fc1a351 แสดงเฉพาะนัด scheduled)
  const calendar = new ViewingWrite(page);
  const calendarPage = new AgentCalendarPage(page);
  await page.goto(`/agent/calendar?date=${day}`);
  const dayLabel = await calendarPage.dayLabel(day);
  // รายการของวันแสดง "<เวลา> · <ชื่อลีด>" (AgentCalendarPage.web.tsx ที่ fc1a351, เวลา HH:mm: lib/agent-calendar-viewings.ts:74)
  const timeLine = (time: string) => calendarPage.dayList.getByText(`${time} · ${row?.leadName}`, { exact: true });
  await expect(calendar.manage(viewing.id)).toBeVisible({ timeout: CALENDAR_LOAD_TIMEOUT_MS });
  await expect(calendar.manage(viewing.id)).toHaveText(WRITE.calendarManage);
  await expect(timeLine('10:00')).toBeVisible();

  // ขั้นที่ 2: เลื่อนเป็น 14:00 แล้วบันทึก หน้าเว็บส่ง PATCH พร้อม scheduledAt ใหม่และ note เดิม (LeadViewingSheet.tsx:164-167)
  guard.allowWrites({ method: 'PATCH', path: new RegExp(`^/agent/viewings/${viewing.id}$`) });
  await calendar.manage(viewing.id).click();
  await expect(calendar.editTitle).toBeVisible();
  await calendar.timeRow.click();
  await calendar.timeInput.fill('14:00');
  const moved = waitForApi(page, 'PATCH', `/agent/viewings/${viewing.id}`);
  await calendar.save.click();
  const movedResponse = await moved;
  await okJson(movedResponse);
  const movedBody = movedResponse.request().postDataJSON() as { scheduledAt?: string; note?: string | null };
  expect(movedBody.scheduledAt).toBe(bangkokTime(day, '14:00'));
  expect(movedBody.note, 'note เดิมต้องถูกส่งกลับ').toBe(note);
  const afterMove = (await api.viewings(lead.id)).find((item) => item.id === viewing.id);
  expect(afterMove?.status).toBe('scheduled');
  expect(afterMove && new Date(afterMove.scheduledAt).toISOString()).toBe(bangkokTime(day, '14:00'));
  await expect(calendar.manage(viewing.id)).toBeVisible();
  await expect(timeLine('14:00'), 'หน้าแสดงเวลาใหม่หลังเลื่อน').toBeVisible();

  // ขั้นที่ 3: ยกเลิก ลิงก์ Cancel viewing พาไปหน้ายืนยัน แล้วปุ่มชื่อเดียวกันส่ง PATCH status cancelled (:176-187, :191-203)
  await calendar.manage(viewing.id).click();
  await calendar.cancel.click();
  await expect(calendar.cancelConfirmTitle).toBeVisible();
  const cancelled = waitForApi(page, 'PATCH', `/agent/viewings/${viewing.id}`);
  // หลังบันทึก แอปโหลดนัดใหม่ (app/index.tsx) ระหว่างโหลดรายการว่าง จึงต้องรอคำตอบรอบใหม่ก่อนตรวจว่าปุ่มหาย
  //   รอคำตอบที่ไม่มีนัดนี้ในสถานะ scheduled แล้ว (คำตอบที่ค้างจากการโหลดหลังเลื่อนเวลายังมีนัดนี้อยู่ จึงไม่นับ)
  const reloaded = page.waitForResponse(
    async (response) => {
      if (response.request().method() !== 'GET' || apiPathOf(response.url()) !== '/agent/viewings' || !response.ok()) return false;
      const rows = (await response.json().catch(() => null)) as { id: number; status: string }[] | null;
      return Array.isArray(rows) && !rows.some((item) => item.id === viewing.id && item.status !== 'cancelled');
    },
    { timeout: CALENDAR_LOAD_TIMEOUT_MS },
  );
  reloaded.catch(() => undefined);
  await calendar.cancel.click();
  const cancelResponse = await cancelled;
  await okJson(cancelResponse);
  expect(cancelResponse.request().postDataJSON()).toEqual({ status: 'cancelled' });
  expect(guard.allowedWrites, 'คำขอเขียนที่ปล่อยผ่าน').toEqual([`PATCH /agent/viewings/${viewing.id}`, `PATCH /agent/viewings/${viewing.id}`]);

  // ขั้นที่ 4: นัดหายจากปฏิทิน (รอโครงระหว่างโหลดหายก่อน: calendar.loading / calendar.dayLoading) (แอปกรอง cancelled ออก: agent-calendar-viewings.ts:46 และ API ไม่ส่ง cancelled: lead-viewings.service.ts:167)
  //   และลีดไม่มีนัดถัดไป
  await reloaded;
  await expect(calendar.loading).toHaveCount(0);
  await expect(calendar.loadError, 'ปฏิทินต้องโหลดสำเร็จ (สถานะ error ก็ไม่มีการ์ด)').toHaveCount(0);
  //   หัวการ์ดต้องเป็นของวันนั้นและโหลดเสร็จแล้ว ก่อนนับว่าไม่มีปุ่มและไม่มีแถวของนัดนี้
  await expect(calendarPage.dayTitle).toHaveText(AgentCalendarPage.loadedTitle(dayLabel));
  await expect(calendar.manage(viewing.id)).toHaveCount(0);
  await expect(timeLine('14:00'), 'นัดที่ยกเลิกต้องไม่อยู่ในรายการของวัน').toHaveCount(0);
  expect((await api.viewings(lead.id)).find((item) => item.id === viewing.id)?.status).toBe('cancelled');
  expect((await api.lead(lead.id)).nextViewingAt ?? null).toBeNull();
});
