import type { Locator, Page, Route } from '@playwright/test';
import { UI_LOCALE_TAG } from '../labels';

/**
 * ปฏิทินของนายหน้าบนเว็บจอกว้างตั้งแต่ 768 (ชุด web-ui และ web-ui-write ใช้ 1280)
 *   โค้ด: apps/consumer-app/components/agent-web/AgentCalendarPage.web.tsx ที่ pre/dev/review fc1a351
 *   จอแคบยังใช้ AgentCalendarScreen.tsx เดิม (app/index.tsx ที่ fc1a351) ไม่ใช้ Page Object นี้
 */
export class AgentCalendarPage {
  constructor(private readonly page: Page) {}

  /** ปุ่มวันในมินิปฏิทินด้านซ้าย (data-testid calendar.mini.<YYYY-MM-DD>, aria-label = dayLabel, aria-pressed ของวันที่เลือก) */
  miniDay(key: string): Locator {
    return this.page.getByTestId(`calendar.mini.${key}`);
  }

  /** การ์ดรายการนัดของวันที่เลือก (data-testid calendar.dayList) */
  get dayList(): Locator {
    return this.page.getByTestId('calendar.dayList');
  }

  /**
   * หัวการ์ดรายการของวัน (h2 ตัวเดียวในการ์ด) โหลดเสร็จแล้วเป็น web.dayTitle "{day} · {count}"
   *   (รูปเดียวกันทั้ง 4 ภาษา: packages/i18n/src/locales/*.ts ที่ fc1a351) ระหว่างโหลดหรือ error เป็นแค่ dayLabel
   */
  get dayTitle(): Locator {
    return this.dayList.getByRole('heading', { level: 2 });
  }

  /** regex ของหัวการ์ดเมื่อโหลดนัดของวันนั้นเสร็จ: ขึ้นต้นด้วย dayLabel ตามด้วย " · " และจำนวนนัด */
  static loadedTitle(dayLabel: string): RegExp {
    const escaped = dayLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped} · \\S`);
  }

  /**
   * dayLabel ของวัน key (Intl <localeTag> weekday long, day numeric, month long: AgentCalendarPage.web.tsx ที่ fc1a351)
   *   สร้างในเบราว์เซอร์ (ICU ชุดเดียวกับแอป) ไม่สร้างใน Node ซึ่งอาจใช้ข้อมูลภาษาคนละรุ่น
   */
  dayLabel(key: string): Promise<string> {
    return this.page.evaluate(
      ({ tag, day }) => {
        const [y, m, d] = day.split('-').map(Number);
        return new Intl.DateTimeFormat(tag, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(y, m - 1, d));
      },
      { tag: UI_LOCALE_TAG, day: key },
    );
  }
  // ---- เพิ่ม 9 พ.ย. 2026 (pre/dev/review 7a9bf48): ตาราง แถบเครื่องมือ ตัวกรอง มุมมอง และสถานะของหน้า ----
  //   เลขบรรทัดด้านล่างเป็นของ AgentCalendarPage.web.tsx ที่ 7a9bf48

  /** แถบเครื่องมือเหนือตาราง (calendar.toolbar :230) ปุ่มเดือนก่อน/ถัดไปมีอีกชุดในมินิปฏิทินชื่อเดียวกัน (:146 กับ :234) จึงหาภายในกล่องเสมอ */
  get toolbar(): Locator {
    return this.page.getByTestId('calendar.toolbar');
  }

  /** มินิปฏิทินด้านซ้าย (calendar.picker :143) */
  get picker(): Locator {
    return this.page.getByTestId('calendar.picker');
  }

  /** ชื่อเดือนบนแถบเครื่องมือ (<h2 class="awc-month"> :235) */
  get monthHeading(): Locator {
    return this.toolbar.getByRole('heading', { level: 2 });
  }

  /** ตัวนับนัดของเดือนที่เห็น (span aria-live ข้างชื่อเดือน :236-238 "{count} viewings" หรือว่างระหว่างโหลด) */
  get monthCount(): Locator {
    return this.toolbar.locator('span[aria-live="polite"]');
  }

  /** ตารางเดือน (role grid, calendar.monthGrid :312) */
  get monthGrid(): Locator {
    return this.page.getByTestId('calendar.monthGrid');
  }

  /** ปุ่มของช่องวันในตารางใหญ่ (calendar.day.<YYYY-MM-DD> :333 aria-label "<dayLabel>, <n events>") */
  gridDay(key: string): Locator {
    return this.page.getByTestId(`calendar.day.${key}`);
  }

  /** checkbox ของสถานะนัด (calendar.status.<scheduled|done|overdue> :185) ติ๊กอยู่ = แสดง */
  statusBox(key: 'scheduled' | 'done' | 'overdue'): Locator {
    return this.page.getByTestId(`calendar.status.${key}`);
  }

  /** ตัวนับท้ายแถวสถานะ (<b> ใน label เดียวกับ checkbox :189) */
  statusCount(key: 'scheduled' | 'done' | 'overdue'): Locator {
    return this.page.locator('label.awc-check').filter({ has: this.statusBox(key) }).locator('b');
  }

  /** ช่องค้นหา (calendar.search :248) */
  get search(): Locator {
    return this.page.getByTestId('calendar.search');
  }

  view(which: 'month' | 'week' | 'agenda'): Locator {
    return this.page.getByTestId(`calendar.view.${which}`);
  }

  /** รายการแบบ agenda (calendar.agenda :354) แต่ละวันเป็น <section aria-label=dayLabel> (:358) */
  get agenda(): Locator {
    return this.page.getByTestId('calendar.agenda');
  }

  get noMatch(): Locator {
    return this.page.getByTestId('calendar.noMatch');
  }

  get emptyMonth(): Locator {
    return this.page.getByTestId('calendar.emptyMonth');
  }

  /** กล่อง error ของ WebState (testID calendar.error :292) มีปุ่มลองใหม่ */
  get error(): Locator {
    return this.page.getByTestId('calendar.error');
  }

  /** โครงโหลดของตาราง (calendar.loading :290) */
  get loading(): Locator {
    return this.page.getByTestId('calendar.loading');
  }

  get openLeads(): Locator {
    return this.page.getByTestId('calendar.openLeads');
  }

  /** เวลาในชิปของช่องวัน (span.awc-chip-time :339) ชิปแสดงไม่เกิน 3 ใบต่อวัน (CHIPS_PER_DAY :25) */
  chipTimes(key: string): Locator {
    return this.gridDay(key).locator('.awc-chip-time');
  }

  /** ชิปของช่องวัน (span.awc-chip is-<สถานะ> :337) */
  chips(key: string): Locator {
    return this.gridDay(key).locator('.awc-chip');
  }

  /** ข้อความ "+N more" ของช่องวันที่มีนัดเกิน 3 นัด (span.awc-more :343-345 ไม่ใช่ปุ่ม: :344) */
  moreLabel(key: string): Locator {
    return this.gridDay(key).locator('.awc-more');
  }

  /** แถวนัดในการ์ดวันที่เลือก (li.awc-day-item :212) */
  get dayItems(): Locator {
    return this.dayList.locator('li.awc-day-item');
  }

  /** "<เวลา> · <ชื่อลีด>" ของแถวนัด (span.awc-muted ใน .awc-day-main :216) */
  get dayItemTimes(): Locator {
    return this.dayItems.locator('.awc-day-main > span.awc-muted');
  }

  /** ชื่อห้องของแถวนัด ("<ห้อง>" หรือ "<ห้อง> · <เลขห้อง>": <strong> :215) */
  dayItemRoom(index: number): Locator {
    return this.dayItems.nth(index).locator('strong');
  }

  /** ปุ่มเลื่อนหรือยกเลิกนัดภายใน scope (calendar.manage.<id> :113 มีเฉพาะนัด scheduled) */
  manageButtons(scope: Locator): Locator {
    return scope.locator('[data-testid^="calendar.manage."]');
  }

  /** กลุ่มวันของมุมมองรายการ (<section aria-label=dayLabel> :358) */
  get agendaDays(): Locator {
    return this.agenda.locator(':scope > section');
  }

  /** ชื่อเดือนของ key แบบเดียวกับแอป (Intl month long, year numeric :76) สร้างในเบราว์เซอร์ */
  monthLabel(key: string): Promise<string> {
    return this.page.evaluate(
      ({ tag, day }) => {
        const [y, m] = day.split('-').map(Number);
        return new Intl.DateTimeFormat(tag, { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1, 12));
      },
      { tag: UI_LOCALE_TAG, day: key },
    );
  }

  /** วันนี้ตามนาฬิกาของเบราว์เซอร์ (YYYY-MM-DD) แบบเดียวกับ calendarDateKey(new Date()) ของแอป */
  today(): Promise<string> {
    return this.page.evaluate(() => {
      const now = new Date();
      const pad = (value: number) => String(value).padStart(2, '0');
      return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    });
  }
}

/** แถวนัดจำลองตามชนิด LeadViewing (packages/types/src/leads.ts:136-148) */
export type MockViewing = {
  id: number;
  leadId: number;
  leadName: string;
  rentRoomId: number;
  roomTitle: string;
  roomNumber: string | null;
  scheduledAt: string;
  status: 'scheduled' | 'done' | 'cancelled';
  note: string | null;
  createdAt: string;
};

/**
 * ให้เบราว์เซอร์ตอบ GET /agent/viewings เองด้วยแถวจำลอง แทนการสร้างนัดจริง (สร้างนัด = เขียนข้อมูล)
 *   ตอบเฉพาะแถวที่ scheduledAt อยู่ในช่วง [from, to) ของคำขอ เหมือน API (ช่วงของหน้า: calendarViewingRange, lib/agent-calendar-viewings.ts:61-66)
 *   page.route ทำงานก่อนตัวกันคำขอของ context (guard.ts) คำขอนี้จึงไม่ถึง API เลย
 *   handler คืนรายการคำขอที่ตอบไป (ค่า from/to) ไว้ตรวจในเทส
 */
export async function mockViewings(
  page: Page,
  rows: MockViewing[] | ((from: number, to: number) => MockViewing[] | 'abort'),
): Promise<{ from: string; to: string }[]> {
  const seen: { from: string; to: string }[] = [];
  await page.route(/\/api\/v1\/agent\/viewings(\?|$)/, async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const query = new URL(route.request().url()).searchParams;
    const from = query.get('from') ?? '';
    const to = query.get('to') ?? '';
    seen.push({ from, to });
    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);
    const answer = typeof rows === 'function' ? rows(fromMs, toMs) : rows;
    if (answer === 'abort') return route.abort('failed');
    const inRange = answer.filter((row) => {
      const at = Date.parse(row.scheduledAt);
      return at >= fromMs && at < toMs;
    });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(inRange) });
  });
  return seen;
}
