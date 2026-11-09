import type { Locator, Page } from '@playwright/test';
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
}
