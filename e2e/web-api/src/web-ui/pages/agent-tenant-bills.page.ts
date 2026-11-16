/// <reference lib="dom" />
import type { Locator, Page } from '@playwright/test';
import { FLOW } from '../labels';
import { escapeRegExp } from './leads.page';

/**
 * หัวข้อ Bills กับ Payments ในรายละเอียดผู้เช่าของนายหน้าบนจอกว้าง (เคส BIL-001 ถึง BIL-010)
 *   กฎ BL1-BL27: เอกสารโปรเจกต์ claude/nestyk-topic-bills-web-ui.md ; ตารางเคส: ...-part3.md
 *   โค้ด: apps/consumer-app/components/TenantBillsBody.tsx (TBB), TenantPaymentsBody.tsx (TPB), TenantDetailParts.tsx,
 *     agent-web/TenantDetailFrame.web.tsx ที่ qa/e2e 5142425 (แอปเท่ากับ pre/dev/review d3bcf28)
 * สองหัวข้อนี้ไม่มี testID (มีแค่ tenant.detail กับ tenant.section.<key>) วิธีหาชิ้นส่วนจึงผูกกับข้อความและโครงของหน้า
 *   เขียนจากการอ่านโค้ด ยังไม่ได้พิสูจน์กับหน้าเว็บจริงจนกว่าจะรันรอบแรก
 * เนื้อหาของสองหัวข้อไม่มีชื่อคน (ชื่อผู้เช่าอยู่ที่แถบข้างของรายละเอียด ซึ่งคลาสนี้ไม่อ่าน)
 */

/** คีย์ของปุ่มตัวกรองในหัวข้อ Bills (TBB:26 BillFilter) */
export type BillFilterKey = 'all' | 'outstanding' | 'awaiting' | 'paid';
export const BILL_FILTERS: readonly BillFilterKey[] = ['all', 'outstanding', 'awaiting', 'paid'];

/** การ์ดบิล 1 ใบตามที่อ่านได้บนจอ (TBB:206-274) */
export interface BillCard {
  /** หัวของการ์ด เช่น "November 2026 rent" */
  title: string;
  /** บรรทัด "{เลขที่เอกสาร} · Due {วันที่}" */
  line: string;
  /** บรรทัดใต้บรรทัดนั้น: หักเงินจอง วันที่ส่งสลิป หรือวันยืนยัน (TBB:216-232) */
  more: string[];
  amount: string;
  /** ข้อความบนป้ายสถานะ */
  status: string;
  /** บรรทัดแรกของบล็อกค่าปรับ (TBB:244-247) หรือ null ถ้าการ์ดไม่มีบล็อกนี้ */
  late: string | null;
  /** ชื่อของปุ่มในการ์ด */
  buttons: string[];
}

/** ช่องสรุป 1 ช่อง: ป้าย ค่า และบรรทัดรอง (หัวข้อ Bills ไม่มีบรรทัดรอง) */
export interface SummaryTile {
  label: string;
  value: string;
  meta: string;
}

/** แถวประวัติการรับเงิน 1 แถว (TPB:211-243) */
export interface PaymentRow {
  title: string;
  /** บรรทัดรอง "{วันที่} · Slip attached · Receipt issued" */
  meta: string;
  amount: string;
}

export class AgentTenantBillsPage {
  constructor(private readonly page: Page) {}

  /** พื้นที่เนื้อหาของรายละเอียดผู้เช่า ไม่รวมแถบข้างที่มีชื่อผู้เช่า (TenantDetailFrame.web.tsx:29, 65) */
  private get main(): Locator {
    return this.page.getByTestId('tenant.detail').locator('.awt-detail-main');
  }

  // ---- หัวข้อ Bills (TBB) ----

  /** ข้อความเมื่อผู้เช่าไม่มีสัญญาเช่าที่มีผล ไม่มีบิล และไม่มีงวดถัดไป (TBB:76-84) */
  get noLease(): Locator {
    return this.main.getByText(FLOW.blNoLease, { exact: true });
  }

  /**
   * จำนวนลูกของเนื้อหาหัวข้อ Bills เมื่อหน้าแสดงข้อความ noLease: เนื้อหา = ปู่ของข้อความ (TBB:77-83 เนื้อหา > การ์ด > ข้อความ)
   * หน้าที่ถูกต้องมีลูกตัวเดียวคือการ์ดข้อความ ไม่มีช่องสรุป ปุ่มตัวกรอง หรือการ์ดบิล คืน null ถ้าไม่พบข้อความ หรือพบมากกว่า 1
   */
  noLeaseBodyChildren(): Promise<number | null> {
    return this.noLease.evaluateAll((texts) => (texts.length === 1 ? (texts[0].parentElement?.parentElement?.children.length ?? null) : null));
  }

  /** ปุ่มตัวกรอง ชื่อบนจอคือ "<ป้าย> <จำนวน>" (TBB:177-187 ; packages/ui/src/components/MobileFilterChip.tsx:59) */
  filter(key: BillFilterKey): Locator {
    return this.main.getByRole('button', { name: new RegExp(`^${escapeRegExp(FLOW.blFilter[key])} \\d+$`) });
  }

  /** ปุ่มตัวกรองทั้งหมดของหัวข้อ Bills */
  get filters(): Locator {
    const labels = BILL_FILTERS.map((key) => escapeRegExp(FLOW.blFilter[key])).join('|');
    return this.main.getByRole('button', { name: new RegExp(`^(${labels}) \\d+$`) });
  }

  /** ชื่อ (aria-label) ของปุ่มตัวกรอง เรียงตามที่แสดง */
  filterNames(): Promise<string[]> {
    return this.filters.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label') ?? ''));
  }

  /** เนื้อหาทั้งหัวข้อ Bills = ปู่ของปุ่มตัวกรอง All (TBB:163 View root > :177 View filters > ปุ่ม) */
  private get billsBody(): Locator {
    return this.filter('all').locator('xpath=../..');
  }

  /** ช่องสรุป 3 ช่องบนสุด (TBB:164-175: View แรกของเนื้อหา แต่ละช่องมีป้ายกับค่า) คืน null ถ้าไม่พบเนื้อหา หรือพบมากกว่า 1 */
  billsSummary(): Promise<SummaryTile[] | null> {
    return this.billsBody.evaluateAll((bodies) => {
      if (bodies.length !== 1) return null;
      const summary = bodies[0].firstElementChild;
      return Array.from(summary?.children ?? []).map((tile) => ({
        label: tile.children[0]?.textContent ?? '',
        value: tile.children[1]?.textContent ?? '',
        meta: '',
      }));
    });
  }

  /**
   * การ์ดบิลตามลำดับที่แสดง (TBB:206-274) คืน null ถ้าไม่พบเนื้อหาของหัวข้อ หรือพบมากกว่า 1
   * โครงของการ์ด: การ์ด > หัวการ์ด > [ข้อความ > [หัว, บรรทัดเลขที่เอกสาร, บรรทัดอื่น...], ด้านขวา > [ยอด, ป้ายสถานะ]]
   *   ถัดจากหัวการ์ดเป็นปุ่ม Review slip (TBB:239-241) และบล็อกค่าปรับ (TBB:242-273)
   * ลูกอื่นของเนื้อหา (ช่องสรุป ปุ่มตัวกรอง การ์ดงวดถัดไป การ์ดข้อความว่าง) ไม่มีบรรทัดที่ 2 ที่มี " · " ในตำแหน่งนี้ จึงไม่ถูกนับเป็นการ์ดบิล
   */
  billCards(): Promise<BillCard[] | null> {
    return this.billsBody.evaluateAll((bodies) => {
      if (bodies.length !== 1) return null;
      const isButton = (element: Element) => element.tagName === 'BUTTON' || element.getAttribute('role') === 'button';
      const cards: { title: string; line: string; more: string[]; amount: string; status: string; late: string | null; buttons: string[] }[] = [];
      for (const card of Array.from(bodies[0].children)) {
        const head = card.firstElementChild;
        const copy = head?.children[0];
        const side = head?.children[1];
        if (!head || !copy || !side || head.children.length !== 2) continue;
        const lines = Array.from(copy.children).map((line) => line.textContent ?? '');
        if (lines.length < 2 || !lines[1].includes(' · ')) continue;
        const lateBlock = Array.from(card.children)
          .slice(1)
          .find((child) => !isButton(child));
        cards.push({
          title: lines[0],
          line: lines[1],
          more: lines.slice(2),
          amount: side.children[0]?.textContent ?? '',
          status: side.children[1]?.textContent ?? '',
          late: lateBlock ? (lateBlock.firstElementChild?.textContent ?? '') : null,
          buttons: Array.from(card.querySelectorAll('button, [role="button"]')).map((button) => (button.textContent ?? '').trim()),
        });
      }
      return cards;
    });
  }

  /** ข้อความเมื่อไม่มีบิลตรงกับตัวกรอง (TBB:277-281) */
  get emptyFilter(): Locator {
    return this.main.getByText(FLOW.blEmptyFilter, { exact: true });
  }

  /** ปุ่ม "Issue a late fee invoice" (TBB:269-271) ห้ามกดแล้วส่งฟอร์ม: POST /bills/agent/:id/late-fee */
  get lateFeeCreate(): Locator {
    return this.main.getByRole('button', { name: FLOW.blLateCreate, exact: true });
  }

  // ---- หัวข้อ Payments (TPB) ----

  /** หัวข้อ "Payment history" (TPB:207 SectionLabel มี role เป็นหัวเรื่อง: TenantDetailParts.tsx:28-34) */
  get historyTitle(): Locator {
    return this.main.getByRole('heading', { name: FLOW.blHistory, exact: true });
  }

  /**
   * สรุป 2 ช่องบนสุดของหัวข้อ Payments (TPB:157-173: View แรกของเนื้อหา มี ช่อง, เส้นคั่น, ช่อง แต่ละช่องมี ป้าย ค่า บรรทัดรอง)
   * เนื้อหาของหัวข้อ = พ่อของหัวข้อ "Payment history" คืน null ถ้าไม่พบ หรือพบมากกว่า 1
   */
  paymentsSummary(): Promise<SummaryTile[] | null> {
    return this.historyTitle.evaluateAll((titles) => {
      if (titles.length !== 1) return null;
      const summary = titles[0].parentElement?.firstElementChild;
      return Array.from(summary?.children ?? [])
        .filter((column) => column.children.length === 3)
        .map((column) => ({
          label: column.children[0].textContent ?? '',
          value: column.children[1].textContent ?? '',
          meta: column.children[2].textContent ?? '',
        }));
    });
  }

  /**
   * แถวประวัติการรับเงินตามลำดับที่แสดง (TPB:209-243: การ์ดถัดจากหัวข้อ แต่ละแถวมี ไอคอน, ข้อความ > [ชื่อ, บรรทัดรอง], ยอด)
   * คืนรายการว่างเมื่อการ์ดมีแต่ข้อความ "No payment history yet" (TPB:245-248) คืน null ถ้าไม่พบหัวข้อ หรือพบมากกว่า 1
   */
  paymentRows(): Promise<PaymentRow[] | null> {
    return this.historyTitle.evaluateAll((titles) => {
      if (titles.length !== 1) return null;
      const card = titles[0].nextElementSibling;
      return Array.from(card?.children ?? [])
        .filter((row) => row.children.length === 3)
        .map((row) => ({
          title: row.children[1].children[0]?.textContent ?? '',
          meta: row.children[1].children[1]?.textContent ?? '',
          amount: row.children[2].textContent ?? '',
        }));
    });
  }

  /** ปุ่ม "Confirm payment" ของการ์ดสลิปรอตรวจ (TPB:202-203) ห้ามกด: เปิดกล่องยืนยันที่ส่ง POST /bills/agent/:id/confirm */
  get confirmPayment(): Locator {
    return this.main.getByRole('button', { name: FLOW.blConfirmPayment, exact: true });
  }
}
