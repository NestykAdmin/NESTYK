import { test, expect } from '../../src/web-ui/web-ui.fixture';
import { AgentCalendarPage, mockViewings, type MockViewing } from '../../src/web-ui/pages/agent-calendar.page';
import { AGENT_WEB, fill } from '../../src/web-ui/labels.agent-web';
import { UI_LOCALE_TAG } from '../../src/web-ui/labels';

/**
 * ปฏิทินของนายหน้าบนเว็บจอกว้าง (แผน 9 พ.ย. 2026 ข้อ C1-C8) อ่านอย่างเดียว
 * โค้ด: apps/consumer-app/components/agent-web/AgentCalendarPage.web.tsx (W), lib/agent-calendar-grid.ts (G),
 *   lib/agent-calendar-viewings.ts ที่ pre/dev/review 7a9bf48 (qa/e2e 4633c54) เลข W:, G: ในคอมเมนต์อ้างไฟล์เหล่านี้
 *
 * สิ่งที่ต้องมีก่อนรัน: เหมือนชุด tests/web-ui (เว็บเปิดด้วย npm run web) และตั้ง E2E_QA_AGENT_PASSWORD
 * ข้อ C7 ของแผน (เดือนว่าง) รวมอยู่ในขั้นที่ 4 ของ C1 และมีข้อ C3b เพิ่ม (นัดที่เลยเวลา)
 * ทุกข้อให้เบราว์เซอร์ตอบ GET /agent/viewings เองด้วยนัดจำลอง (mockViewings) คำขอนี้จึงไม่ถึง API
 *   - เหตุผล: ข้อที่ต้องมีหลายนัดในวันเดียวหรือหลายสถานะ ถ้าใช้ข้อมูลจริงต้องสร้างนัด ซึ่งคือการเขียนข้อมูล
 *   - ข้อที่ไม่ต้องมีนัดก็ตอบเป็นรายการว่าง หน้าจึงไม่แสดงชื่อลีดของลูกค้าจริง
 *   - ชื่อลีดและห้องในนัดจำลองขึ้นต้นด้วย "QA Mock" ไม่ใช่ข้อมูลจริง
 * เวลาของนัดจำลองเขียนเป็นเวลาไทย (+07:00) ชุดนี้เปิดเบราว์เซอร์ที่ timezoneId Asia/Bangkok (playwright.web-ui.config.ts:49)
 *   ปฏิทินแสดงเวลาตามนาฬิกาของเบราว์เซอร์ (getHours: agent-calendar-viewings.ts:74) จึงเห็นเวลาเดียวกับที่เขียน
 */

/** วันที่แบบ YYYY-MM-DD ห่างจากเดือนของ today ไป offset เดือน วันที่ day (คิดด้วยตัวเลขล้วน ไม่ขึ้นกับเขตเวลาของ Node) */
function monthDay(today: string, offset: number, day: number): string {
  const [y, m] = today.split('-').map(Number);
  const index = y * 12 + (m - 1) + offset;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** จำนวนวันในเดือน และวันในสัปดาห์ของวันที่ 1 (0 = อาทิตย์) คิดด้วย Date.UTC จึงไม่ขึ้นกับเขตเวลาของ Node */
function monthShape(key: string): { days: number; firstWeekday: number } {
  const [y, m] = key.split('-').map(Number);
  return { days: new Date(Date.UTC(y, m, 0)).getUTCDate(), firstWeekday: new Date(Date.UTC(y, m - 1, 1)).getUTCDay() };
}

let nextId = 9_000_001;
function viewing(date: string, time: string, room: string, status: MockViewing['status'], roomNumber: string | null = null): MockViewing {
  const id = nextId++;
  return {
    id,
    leadId: 9_100_000 + id,
    leadName: `QA Mock Lead ${room.slice(-1)}`,
    rentRoomId: 9_200_000 + id,
    roomTitle: room,
    roomNumber,
    scheduledAt: `${date}T${time}:00+07:00`,
    status,
    note: null,
    createdAt: `${date}T00:00:00+07:00`,
  };
}

/**
 * นัดจำลอง 2 เดือน
 *   เดือนถัดไป (อนาคตเสมอ): วันที่ 12 นัด 5 รายการส่งมาไม่เรียงเวลา + นัดที่ยกเลิก 1 รายการ, วันที่ 20 นัดที่ดูห้องแล้ว 1 รายการ
 *   เดือนก่อน (อดีตเสมอ): วันที่ 15 นัดที่ยังเป็น scheduled (จึงเลยเวลา) 1 รายการ กับนัดที่ดูห้องแล้ว 1 รายการ
 */
function fixture(today: string): { busyDay: string; doneDay: string; pastDay: string; rows: MockViewing[] } {
  const busyDay = monthDay(today, 1, 12);
  const doneDay = monthDay(today, 1, 20);
  const pastDay = monthDay(today, -1, 15);
  const rows = [
    viewing(busyDay, '17:00', 'QA Mock Tower E', 'scheduled'),
    viewing(busyDay, '09:00', 'QA Mock Tower A', 'scheduled', '12A'),
    viewing(busyDay, '13:00', 'QA Mock Tower C', 'scheduled'),
    viewing(busyDay, '10:30', 'QA Mock Tower B', 'scheduled'),
    viewing(busyDay, '15:00', 'QA Mock Tower D', 'scheduled'),
    viewing(busyDay, '08:00', 'QA Mock Cancelled X', 'cancelled'),
    viewing(doneDay, '11:00', 'QA Mock Tower F', 'done'),
    viewing(pastDay, '10:00', 'QA Mock Tower G', 'scheduled'),
    viewing(pastDay, '14:00', 'QA Mock Tower H', 'done'),
  ];
  return { busyDay, doneDay, pastDay, rows };
}

// ข้อ C8 ไปหน้าลีดจริงซึ่งแสดงชื่อลูกค้า ปิดภาพหน้าจอทั้งไฟล์ (แบบ agent-tenants-calendar.spec.ts:19)
//   use({ screenshot }) ใส่ใน describe ไม่ได้ เพราะต้องเปิด worker ใหม่
test.use({ screenshot: 'off' });

/**
 * วันนี้ตามเวลาไทย (YYYY-MM-DD) ใช้ก่อนเปิดหน้า เพื่อสร้างนัดจำลองตามเดือนของวันรัน
 *   เบราว์เซอร์ของชุดนี้ใช้ timezoneId Asia/Bangkok วันนี้ของแอป (calendarDateKey(new Date())) จึงตรงกัน ยกเว้นรันคร่อมเที่ยงคืนพอดี
 */
function bangkokToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

test('C1 the month grid starts on Monday, has whole weeks and marks today; an empty month says so', async ({ page, loginAs }) => {
  const calendar = new AgentCalendarPage(page);
  await mockViewings(page, []);
  await loginAs('agent', { next: '/agent/calendar' });
  const today = await calendar.today();
  await expect(page).toHaveURL((url) => url.pathname === '/agent/calendar' && url.searchParams.get('date') === today);
  await expect(calendar.monthGrid).toBeVisible();

  // ขั้นที่ 1: หัวคอลัมน์ 7 ช่อง ช่องแรกเป็นวันจันทร์ (WEEK_START = 1: W:24, ชื่อแบบ short: W:77)
  const headers = calendar.monthGrid.getByRole('columnheader');
  await expect(headers).toHaveCount(7);
  // ชื่อวันจันทร์สร้างในเบราว์เซอร์ (ICU ชุดเดียวกับแอป) จากวันที่ที่เป็นวันจันทร์แน่นอน 1 ม.ค. 2024
  const monday = await page.evaluate((tag) => new Intl.DateTimeFormat(tag, { weekday: 'short' }).format(new Date(2024, 0, 1, 12)), UI_LOCALE_TAG);
  await expect(headers.first()).toHaveText(monday);

  // ขั้นที่ 2: จำนวนสัปดาห์ = ceil((วันว่างหน้าเดือน + วันในเดือน) / 7) (G:19-21) แถวของตาราง = หัว 1 แถว + สัปดาห์
  const { days, firstWeekday } = monthShape(today);
  const lead = (firstWeekday + 6) % 7;
  const weeks = Math.ceil((lead + days) / 7);
  await expect(calendar.monthGrid.getByRole('row')).toHaveCount(1 + weeks);
  await expect(calendar.monthGrid.getByRole('gridcell')).toHaveCount(weeks * 7);

  // ขั้นที่ 3: วันนี้มี aria-current="date" ทั้งตารางใหญ่และมินิปฏิทิน (W:163, :330) ชื่อช่องเป็น "<วัน>, 0 events" (W:331)
  const label = await calendar.dayLabel(today);
  await expect(calendar.gridDay(today)).toHaveAttribute('aria-current', 'date');
  await expect(calendar.miniDay(today)).toHaveAttribute('aria-current', 'date');
  await expect(calendar.gridDay(today)).toHaveAttribute('aria-label', `${label}, ${fill(AGENT_WEB.calendarEventCount, { count: 0 })}`);

  // ขั้นที่ 4: เดือนนี้ไม่มีนัด (ตอบรายการว่าง) และไม่มีตัวกรอง ต้องขึ้น emptyMonth ไม่ใช่ noMatch (W:296-307)
  await expect(calendar.emptyMonth).toBeVisible();
  await expect(calendar.noMatch).toHaveCount(0);
  await expect(calendar.monthCount).toHaveText(fill(AGENT_WEB.calendarMonthCount, { count: 0 }));
});

test('C2 next, previous and Today change the month on screen but keep the chosen day', async ({ page, loginAs }) => {
  const calendar = new AgentCalendarPage(page);
  const requests = await mockViewings(page, []);
  await loginAs('agent', { next: '/agent/calendar' });
  const today = await calendar.today();
  await expect(calendar.monthGrid).toBeVisible();
  const todayLabel = await calendar.dayLabel(today);
  await expect(calendar.monthHeading).toHaveText(await calendar.monthLabel(today));
  const firstTo = Date.parse(requests[0].to);

  // ขั้นที่ 1: ปุ่มเดือนถัดไปบนแถบเครื่องมือ ชื่อเดือนเปลี่ยน และหน้าขอนัดของเดือนถัดไป (ช่วงเดือนติดกันซ้อนกัน 14 วัน: from ใหม่ต้องอยู่ก่อน to แรก)
  //   วันที่เลือกไม่เปลี่ยน (ปุ่มเดือนเรียกแค่ onMonthChange: W:118-127) หัวการ์ดวันยังเป็นวันนี้ และ ?date= ยังเป็นวันนี้
  const before = requests.length;
  await calendar.toolbar.getByRole('button', { name: AGENT_WEB.calendarNextMonth, exact: true }).click();
  await expect(calendar.monthHeading).toHaveText(await calendar.monthLabel(monthDay(today, 1, 1)));
  await expect.poll(() => requests.length, { message: 'คำขอนัดของเดือนถัดไป' }).toBeGreaterThan(before);
  const next = requests[requests.length - 1];
  expect(Date.parse(next.from), 'from ของเดือนถัดไปต้องอยู่หลัง from แรกแต่ก่อน to แรก').toBeLessThan(firstTo);
  expect(Date.parse(next.from)).toBeGreaterThan(Date.parse(requests[0].from));
  await expect(calendar.dayTitle).toHaveText(AgentCalendarPage.loadedTitle(todayLabel));
  await expect(page).toHaveURL((url) => url.searchParams.get('date') === today);

  // ขั้นที่ 2: ปุ่มเดือนก่อนหน้า 2 ครั้ง ได้เดือนก่อนเดือนนี้
  const previous = calendar.toolbar.getByRole('button', { name: AGENT_WEB.calendarPreviousMonth, exact: true });
  await previous.click();
  await expect(calendar.monthHeading).toHaveText(await calendar.monthLabel(today));
  await previous.click();
  await expect(calendar.monthHeading).toHaveText(await calendar.monthLabel(monthDay(today, -1, 1)));

  // ขั้นที่ 3: ปุ่มชุดในมินิปฏิทินทำงานแบบเดียวกัน (ใช้ monthButtons ตัวเดียวกัน: W:146)
  await calendar.picker.getByRole('button', { name: AGENT_WEB.calendarNextMonth, exact: true }).click();
  await expect(calendar.monthHeading).toHaveText(await calendar.monthLabel(today));
  await calendar.picker.getByRole('button', { name: AGENT_WEB.calendarNextMonth, exact: true }).click();
  await expect(calendar.monthHeading).toHaveText(await calendar.monthLabel(monthDay(today, 1, 1)));

  // ขั้นที่ 4: เลือกวันที่ 15 ของเดือนถัดไปก่อน (ไม่อย่างนั้นวันที่เลือกเป็นวันนี้อยู่แล้ว และการตรวจข้างล่างผ่านเสมอ)
  //   แล้วปุ่ม Today ต้องพากลับเดือนนี้และเลือกวันนี้ (goToday: W:96-99)
  const otherDay = monthDay(today, 1, 15);
  await calendar.miniDay(otherDay).click();
  await expect(calendar.miniDay(otherDay)).toHaveAttribute('aria-pressed', 'true');
  await expect(calendar.dayTitle).toHaveText(AgentCalendarPage.loadedTitle(await calendar.dayLabel(otherDay)));
  await calendar.toolbar.getByRole('button', { name: AGENT_WEB.calendarToday, exact: true }).click();
  await expect(calendar.monthHeading).toHaveText(await calendar.monthLabel(today));
  await expect(calendar.miniDay(today)).toHaveAttribute('aria-pressed', 'true');
  await expect(calendar.dayTitle).toHaveText(AgentCalendarPage.loadedTitle(todayLabel));
});

test('C3 a busy day shows 3 chips and "+2 more", sorted by time, and cancelled viewings stay hidden', async ({ page, loginAs }) => {
  const calendar = new AgentCalendarPage(page);
  const today = bangkokToday();
  const { busyDay, doneDay, rows } = fixture(today);
  await mockViewings(page, rows);
  await loginAs('agent', { next: `/agent/calendar?date=${busyDay}` });
  await expect(calendar.monthGrid).toBeVisible();
  const busyLabel = await calendar.dayLabel(busyDay);

  // ขั้นที่ 1: ช่องวันที่ 12 นับ 5 นัด (นัดที่ยกเลิกถูกตัด: agent-calendar-viewings.ts:46, W:60) ชิปแสดง 3 ใบแรกตามเวลา (CHIPS_PER_DAY: W:25, :336; เรียง: G:59-68)
  await expect(calendar.gridDay(busyDay)).toHaveAttribute('aria-label', `${busyLabel}, ${fill(AGENT_WEB.calendarEventCount, { count: 5 })}`);
  await expect(calendar.chipTimes(busyDay)).toHaveText(['09:00', '10:30', '13:00']);
  await expect(calendar.moreLabel(busyDay)).toHaveText(fill(AGENT_WEB.calendarMoreCount, { count: 2 }));
  await expect(page.getByText('QA Mock Cancelled X')).toHaveCount(0);

  // ขั้นที่ 2: การ์ดวันที่เลือก "<วัน> · 5 events" รายการ 5 แถวเรียงเวลา ทุกแถวสถานะ Scheduled และมีปุ่มจัดการ (W:107-117 เฉพาะ scheduled)
  await expect(calendar.dayTitle).toHaveText(`${busyLabel} · ${fill(AGENT_WEB.calendarEventCount, { count: 5 })}`);
  await expect(calendar.dayItems).toHaveCount(5);
  await expect(calendar.dayItemTimes).toHaveText([/^09:00 · /, /^10:30 · /, /^13:00 · /, /^15:00 · /, /^17:00 · /]);
  // ห้องที่มีเลขห้องแสดงเป็น "<ห้อง> · <เลขห้อง>" (location: agent-calendar-viewings.ts:70, :76)
  await expect(calendar.dayItemRoom(0)).toHaveText('QA Mock Tower A · 12A');
  await expect(calendar.dayList.getByText(AGENT_WEB.calendarStateScheduled, { exact: true })).toHaveCount(5);
  await expect(calendar.manageButtons(calendar.dayList)).toHaveCount(5);

  // ขั้นที่ 3: ตัวนับของเดือน 6 นัด (5 + ดูห้องแล้ว 1) และตัวนับสถานะ (G:76-83)
  await expect(calendar.monthCount).toHaveText(fill(AGENT_WEB.calendarMonthCount, { count: 6 }));
  await expect(calendar.statusCount('scheduled')).toHaveText('5');
  await expect(calendar.statusCount('done')).toHaveText('1');
  await expect(calendar.statusCount('overdue')).toHaveText('0');
  // ชิปของนัดที่ดูห้องแล้วมี class is-done (W:337)
  await expect(calendar.chips(doneDay)).toHaveClass(/\bis-done\b/);
});

test('C3b a scheduled viewing whose time has passed shows as Past due; only it can be managed', async ({ page, loginAs }) => {
  const calendar = new AgentCalendarPage(page);
  const today = bangkokToday();
  const { pastDay, rows } = fixture(today);
  await mockViewings(page, rows);
  await loginAs('agent', { next: `/agent/calendar?date=${pastDay}` });
  await expect(calendar.monthGrid).toBeVisible();

  // viewingStateKey: scheduled ที่เวลาผ่านแล้ว = overdue, done = done (G:37-42) ปุ่มจัดการแสดงตามสถานะในข้อมูล คือ scheduled เท่านั้น (W:107)
  await expect(calendar.statusCount('overdue')).toHaveText('1');
  await expect(calendar.statusCount('done')).toHaveText('1');
  await expect(calendar.statusCount('scheduled')).toHaveText('0');
  await expect(calendar.dayItems).toHaveCount(2);
  await expect(calendar.dayItems.nth(0)).toContainText(AGENT_WEB.calendarStateOverdue);
  await expect(calendar.dayItems.nth(1)).toContainText(AGENT_WEB.calendarStateDone);
  await expect(calendar.manageButtons(calendar.dayItems.nth(0))).toHaveCount(1);
  await expect(calendar.manageButtons(calendar.dayItems.nth(1))).toHaveCount(0);
});

test('C4 the status switches and the search filter the month; Clear filters brings everything back', async ({ page, loginAs }) => {
  const calendar = new AgentCalendarPage(page);
  const today = bangkokToday();
  const { busyDay, rows } = fixture(today);
  await mockViewings(page, rows);
  await loginAs('agent', { next: `/agent/calendar?date=${busyDay}` });
  await expect(calendar.monthCount).toHaveText(fill(AGENT_WEB.calendarMonthCount, { count: 6 }));
  const busyLabel = await calendar.dayLabel(busyDay);

  // ขั้นที่ 1: ปิดสถานะ Scheduled เหลือนัดที่ดูห้องแล้ว 1 นัด ช่องวันที่ 12 เหลือ 0 ตัวนับสถานะไม่ตามสวิตช์ (คอมเมนต์ W:67)
  await calendar.statusBox('scheduled').uncheck();
  await expect(calendar.monthCount).toHaveText(fill(AGENT_WEB.calendarMonthCount, { count: 1 }));
  await expect(calendar.gridDay(busyDay)).toHaveAttribute('aria-label', `${busyLabel}, ${fill(AGENT_WEB.calendarEventCount, { count: 0 })}`);
  await expect(calendar.statusCount('scheduled')).toHaveText('5');
  await calendar.statusBox('scheduled').check();
  await expect(calendar.monthCount).toHaveText(fill(AGENT_WEB.calendarMonthCount, { count: 6 }));

  // ขั้นที่ 2: ค้นชื่อห้องที่มีนัดเดียว (หาในชื่อลีดและห้อง ไม่สนตัวพิมพ์: G:45-56)
  await calendar.search.fill('qa mock tower b');
  await expect(calendar.monthCount).toHaveText(fill(AGENT_WEB.calendarMonthCount, { count: 1 }));
  await expect(calendar.chipTimes(busyDay)).toHaveText(['10:30']);

  // ขั้นที่ 3: คำค้นที่ไม่ตรงอะไร ขึ้น noMatch (ไม่ใช่ emptyMonth: W:296-301) กด Clear filters แล้วกลับครบ
  await calendar.search.fill('zz-no-such-viewing');
  await expect(calendar.noMatch).toBeVisible();
  await expect(calendar.emptyMonth).toHaveCount(0);
  await calendar.noMatch.getByRole('button', { name: AGENT_WEB.calendarClearFilters, exact: true }).click();
  await expect(calendar.noMatch).toHaveCount(0);
  await expect(calendar.search).toHaveValue('');
  await expect(calendar.monthCount).toHaveText(fill(AGENT_WEB.calendarMonthCount, { count: 6 }));
});

test('C5 the List view groups the month by day, and the Week view cannot be chosen yet', async ({ page, loginAs }) => {
  const calendar = new AgentCalendarPage(page);
  const today = bangkokToday();
  const { busyDay, doneDay, rows } = fixture(today);
  await mockViewings(page, rows);
  await loginAs('agent', { next: `/agent/calendar?date=${busyDay}` });
  await expect(calendar.monthGrid).toBeVisible();

  // ขั้นที่ 1: ปุ่ม Week กดไม่ได้ และบอกว่าเร็ว ๆ นี้ผ่าน title (W:268-273)
  await expect(calendar.view('week')).toBeDisabled();
  await expect(calendar.view('week')).toHaveAttribute('title', AGENT_WEB.calendarWeekSoon);

  // ขั้นที่ 2: List แสดงนัดของเดือนเป็นกลุ่มตามวัน 2 วัน เรียงวัน (W:354-381) ตารางเดือนหายไป
  await calendar.view('agenda').click();
  await expect(calendar.view('agenda')).toHaveAttribute('aria-selected', 'true');
  await expect(calendar.monthGrid).toHaveCount(0);
  const sections = calendar.agendaDays;
  await expect(sections).toHaveCount(2);
  await expect(sections.nth(0)).toHaveAttribute('aria-label', await calendar.dayLabel(busyDay));
  await expect(sections.nth(0).locator('li')).toHaveCount(5);
  await expect(sections.nth(1)).toHaveAttribute('aria-label', await calendar.dayLabel(doneDay));
  await expect(sections.nth(1)).toContainText(AGENT_WEB.calendarStateDone);

  // ขั้นที่ 3: กลับเป็นตารางเดือน
  await calendar.view('month').click();
  await expect(calendar.monthGrid).toBeVisible();
  await expect(calendar.agenda).toHaveCount(0);
});

test('C6 when loading fails the calendar shows an error, and Try again loads it', async ({ page, loginAs }) => {
  const calendar = new AgentCalendarPage(page);
  // ตัดทุกคำขอในเบราว์เซอร์ (เหมือนเครือข่ายล้ม) จนกว่าเทสจะสั่งเลิก แล้วคำขอต่อไปตอบรายการว่าง
  //   ตัดทุกคำขอ ไม่ใช่แค่คำขอแรก เผื่อแอปขอซ้ำตอนเปิดหน้า (ผลของคำขอเก่าถูกทิ้ง: agent-calendar-viewings.ts:47-52)
  let failing = true;
  let calls = 0;
  await mockViewings(page, () => {
    calls += 1;
    return failing ? 'abort' : [];
  });
  await loginAs('agent', { next: '/agent/calendar' });

  // ขั้นที่ 1: ตารางเป็น WebState error พร้อมปุ่มลองใหม่ (W:291-292) และไม่มีตาราง
  await expect(calendar.error).toBeVisible();
  await expect(calendar.monthGrid).toHaveCount(0);

  // ขั้นที่ 2: ลองใหม่ (setCalendarReloadToken ใน app/index.tsx) โหลดสำเร็จ ขึ้นตารางและ emptyMonth
  const failedCalls = calls;
  failing = false;
  await calendar.error.getByRole('button', { name: AGENT_WEB.retry, exact: true }).click();
  await expect(calendar.monthGrid).toBeVisible();
  await expect(calendar.error).toHaveCount(0);
  await expect(calendar.emptyMonth).toBeVisible();
  expect(failedCalls, 'มีคำขอที่ถูกตัดก่อนกดลองใหม่').toBeGreaterThanOrEqual(1);
  expect(calls, 'ปุ่มลองใหม่ส่งคำขอใหม่').toBeGreaterThan(failedCalls);
});

test('C8 Schedule from leads opens the leads page', async ({ page, loginAs }) => {
  const calendar = new AgentCalendarPage(page);
  await mockViewings(page, []);
  await loginAs('agent', { next: '/agent/calendar' });
  await expect(calendar.monthGrid).toBeVisible();
  // ปุ่มบนหัวหน้า (W:133-138) เรียก handleTabPress('listingLead') (app/index.tsx:1434)
  await calendar.openLeads.click();
  await expect(page).toHaveURL((url) => url.pathname === '/agent/leads');
});
