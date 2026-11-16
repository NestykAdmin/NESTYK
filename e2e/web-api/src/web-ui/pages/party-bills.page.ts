/// <reference lib="dom" />
import type { Locator, Page } from '@playwright/test';
import { FLOW } from '../labels';
import { escapeRegExp } from './leads.page';

/**
 * หน้าบิลของผู้เช่า (/tenant/bills) และหน้า Income ของผู้ให้เช่า (/landlord/income) บนจอกว้าง (เคส BIL-011 ถึง BIL-013)
 *   กฎ BL1-BL27: เอกสารโปรเจกต์ claude/nestyk-topic-bills-web-ui.md ; ตารางเคส: ...-part3.md
 *   โค้ด: apps/consumer-app/components/TenantBillsContent.tsx (TBC), TenantBillsScreen.tsx (TBS), lib/tenant-workspace-copy.ts
 *     ที่ qa/e2e 5142425 (แอปเท่ากับ pre/dev/review d3bcf28)
 * สองหน้านี้ไม่มี testID วิธีหาชิ้นส่วนผูกกับข้อความและโครงของหน้า เขียนจากการอ่านโค้ด ยังไม่ได้พิสูจน์กับหน้าเว็บจริงจนกว่าจะรันรอบแรก
 * ข้อมูลของคนบนสองหน้านี้: ชื่อบัญชีรับโอนในการ์ดของผู้เช่า (TBC:320-377) และชื่อผู้เช่าในการ์ดของผู้ให้เช่า (TBS:218)
 *   คลาสนี้อ่านเฉพาะช่องที่ระบุ (หัว ป้ายสถานะ เลขที่บิล วันที่ ชื่อปุ่ม) ไม่อ่านข้อความทั้งการ์ด
 */

/** การ์ดบิลค้างชำระของผู้เช่า 1 ใบตามที่อ่านได้บนจอ (TBC:468-573) */
export interface TenantBillCard {
  /** ข้อความบนป้ายสถานะ (TBC:298-309) */
  status: string;
  /** หัว "Rent {เดือน}" */
  title: string;
  /** บรรทัด "Bill no. {เลขที่เอกสาร}" */
  billNo: string;
  /** วันที่ใต้ป้าย "Issued", "Due date" และหลังป้าย "Pay by" (TBC:507-527) ค่าว่างถ้าหาป้ายไม่เจอ */
  issued: string;
  due: string;
  payBy: string;
  /** จำนวนปุ่ม "Report payment / attach slip" ในการ์ด (TBC:565-571) */
  payButtons: number;
}

/** การ์ดบิลที่ยังไม่ได้รับชำระของผู้ให้เช่า 1 ใบตามที่อ่านได้บนจอ (TBS:210-250) */
export interface OwnerBillCard {
  title: string;
  status: string;
  due: string;
  payable: string;
  /** บรรทัดสุดท้ายของการ์ด = เลขที่เอกสาร (TBS:249) */
  documentNo: string;
}

export class PartyBillsPage {
  constructor(private readonly page: Page) {}

  // ---- ผู้เช่า /tenant/bills ----

  /** ป้าย "Current bill" บนหัวของการ์ดบิลค้างชำระ มี 1 ป้ายต่อ 1 การ์ด (TBC:470-474) */
  get currentBillLabels(): Locator {
    return this.page.getByText(FLOW.blCurrentBill, { exact: true });
  }

  /**
   * การ์ดบิลค้างชำระตามลำดับที่แสดง: การ์ด = ปู่ของป้าย "Current bill" (TBC:469-475 การ์ด > หัวการ์ด > [ป้าย, ป้ายสถานะ])
   * ลูกของการ์ด: [หัวการ์ด, หัว "Rent {เดือน}", "Bill no. ...", ...] (TBC:476-481)
   * วันที่: หาป้าย "Issued" (ชิ้นส่วนที่ไม่มีลูกและข้อความตรงพอดี) กล่องวันที่ = ทวดของป้ายนั้น (TBC:508-527 กล่อง > แถวบน > ช่อง > ป้าย)
   *   แล้วหาป้าย "Due date" กับ "Pay by" ในกล่องเดียวกัน วันที่คือชิ้นส่วนถัดจากป้าย
   * กล่องบัญชีรับโอน (TBC:320-377 ชื่อธนาคาร เลขบัญชี ชื่อบัญชี) อยู่นอกกล่องวันที่ และฟังก์ชันนี้ไม่อ่าน
   *   ปุ่มนับเฉพาะปุ่มที่ข้อความตรงกับ "Report payment / attach slip" ไม่คืนข้อความของปุ่มอื่น
   */
  tenantOpenCards(): Promise<TenantBillCard[]> {
    return this.currentBillLabels.evaluateAll(
      (labels, copy) =>
        labels.map((label) => {
          const card = label.parentElement?.parentElement;
          const leaf = (root: Element | null | undefined, text: string): Element | undefined =>
            Array.from(root?.querySelectorAll('*') ?? []).find((element) => element.children.length === 0 && element.textContent === text);
          const issued = leaf(card, copy.issued);
          const facts = issued?.parentElement?.parentElement?.parentElement;
          return {
            status: label.nextElementSibling?.textContent ?? '',
            title: card?.children[1]?.textContent ?? '',
            billNo: card?.children[2]?.textContent ?? '',
            issued: issued?.nextElementSibling?.textContent ?? '',
            due: leaf(facts, copy.due)?.nextElementSibling?.textContent ?? '',
            payBy: leaf(facts, copy.payBy)?.nextElementSibling?.textContent ?? '',
            payButtons: Array.from(card?.querySelectorAll('button, [role="button"]') ?? []).filter((button) => (button.textContent ?? '').trim() === copy.pay).length,
          };
        }),
      { issued: FLOW.blIssued, due: FLOW.blDueDate, payBy: FLOW.blPayBy, pay: FLOW.blPay },
    );
  }

  /** ปุ่มตัวกรอง "Unpaid" กับ "Paid" ของหน้าผู้เช่า ชื่อปุ่มคือป้ายอย่างเดียว ไม่มีจำนวน (TBC:455-465) */
  tenantFilter(key: 'unpaid' | 'paid'): Locator {
    return this.page.getByRole('button', { name: key === 'unpaid' ? FLOW.blChipUnpaid : FLOW.blChipPaid, exact: true });
  }

  /** แถวของบิลที่ชำระแล้ว ชื่อปุ่มคือ "{เดือน} · {ยอด} · Paid" โดยคำท้ายมาจาก tenant.bills.status.paid (TBC:606-611 ; en.ts:423) */
  get tenantPaidRows(): Locator {
    return this.page.getByRole('button', { name: new RegExp(` · ${escapeRegExp(FLOW.blPaidRow)}$`) });
  }

  /** ข้อความเมื่อไม่มีบิลที่ชำระแล้ว (TBC:603-605) */
  get noPaid(): Locator {
    return this.page.getByText(FLOW.blNoPaid, { exact: true });
  }

  /** ข้อความเมื่อไม่มีบิลค้างชำระและไม่มีงวดถัดไป (TBC:600-602) */
  get noUnpaid(): Locator {
    return this.page.getByText(FLOW.blNoUnpaid, { exact: true });
  }

  /** การ์ดงวดถัดไปในหน้าบิลของผู้เช่า ขึ้นต้นด้วย "Next rent bill · " (TBC:577-583) */
  get nextRentBill(): Locator {
    return this.page.getByText(new RegExp(`^${escapeRegExp(FLOW.blNextRentBill)} · `));
  }

  // ---- ผู้ให้เช่า /landlord/income ----

  /** หัวข้อ "Awaiting payment" ขึ้นเมื่อมีบิลที่ยังไม่ได้รับชำระ (TBS:209) */
  get ownerCurrentTitle(): Locator {
    return this.page.getByText(FLOW.blOwnerCurrent, { exact: true });
  }

  /** ป้าย "Payable until" มี 1 ป้ายต่อ 1 การ์ดของบิลที่ยังไม่ได้รับชำระ (TBS:245-248) แถวของบิลที่รับแล้วไม่มีป้ายนี้ */
  get ownerPayableLabels(): Locator {
    return this.page.getByText(FLOW.blOwnerPayable, { exact: true });
  }

  /**
   * การ์ดของบิลที่ยังไม่ได้รับชำระตามลำดับที่แสดง: การ์ด = ปู่ของป้าย "Payable until" (TBS:211 การ์ด > :244 แถว > ป้าย)
   * ลูกของการ์ด: [หัวการ์ด > [ข้อความ > [หัว, ชื่อผู้เช่า, ห้อง], ป้ายสถานะ], ยอด, ..., แถว Due date, แถว Payable until, เลขที่เอกสาร] (TBS:212-248)
   * ไม่อ่านลูกตัวที่ 2 ของข้อความ ซึ่งเป็นชื่อผู้เช่า (TBS:218)
   */
  ownerOpenCards(): Promise<OwnerBillCard[]> {
    return this.ownerPayableLabels.evaluateAll(
      (labels, copy) =>
        labels.map((label) => {
          const card = label.parentElement?.parentElement;
          const head = card?.firstElementChild;
          const dueLabel = Array.from(card?.querySelectorAll('*') ?? []).find((element) => element.children.length === 0 && element.textContent === copy.due);
          return {
            title: head?.children[0]?.children[0]?.textContent ?? '',
            status: head?.children[1]?.textContent ?? '',
            due: dueLabel?.nextElementSibling?.textContent ?? '',
            payable: label.nextElementSibling?.textContent ?? '',
            documentNo: card?.lastElementChild?.textContent ?? '',
          };
        }),
      { due: FLOW.blDueDate },
    );
  }

  /** ปุ่มตามชื่อ ใช้ตรวจว่าหน้านี้ไม่มีปุ่มชำระหรือปุ่มยืนยัน */
  button(name: string): Locator {
    return this.page.getByRole('button', { name, exact: true });
  }
}
