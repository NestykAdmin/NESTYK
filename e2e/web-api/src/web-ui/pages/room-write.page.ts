import type { Locator, Page } from '@playwright/test';
import { WRITE } from '../labels';
import { escapeRegExp } from './leads.page';

/**
 * ตัวช่วยสร้างและแก้ห้อง สำหรับเทสเขียนข้อมูล (tests/web-ui-write)
 *   packages/feature-listing/src/components/MobileCreateListingWizardBody.tsx (W) และ RoomEditSectionList.tsx ที่ qa/e2e 74b46f4 (แอป 648dd28)
 * ไม่มี testid ช่องกรอก (MobileInput) มีป้ายเป็น Text พี่น้องของ input ที่ไม่ผูกกัน (packages/ui/src/components/MobileInput.tsx:59-118)
 *   จึงหาด้วย placeholder หรือหากล่องที่มีทั้งป้ายและ input
 * sheet (MobileBottomSheet) แสดงนอกโครงหน้า จึงหาจาก page
 */
export class RoomWizard {
  constructor(private readonly page: Page) {}

  /** การ์ดเลือกที่มาของประกาศ (role radio W:2392-2431) */
  source(label: string): Locator {
    return this.page.getByRole('radio').filter({ hasText: label });
  }

  /** ปุ่มถัดไปของขั้นเลือกที่มา (W:2436-2450 ปิดจนกว่าจะเลือก) */
  get next(): Locator {
    return this.page.getByRole('button', { name: WRITE.wizardNext, exact: true });
  }

  /** ปุ่มบันทึกห้องบน hub (W:2381-2389 ไม่ถูกปิดเมื่อข้อมูลไม่ครบ) */
  get saveRoom(): Locator {
    return this.page.getByRole('button', { name: WRITE.saveRoom, exact: true });
  }

  /**
   * ข้อความเมื่อกดบันทึกตอนข้อมูลไม่ครบ (handleSubmit W:2125-2145 ตั้ง hubSaveHighlight)
   * ข้อความเดียวกันขึ้น 2 ที่: บรรทัดให้กำลังใจบนหัว hub (W:1901-1903) และแบนเนอร์ท้ายหน้า (W:2355-2369) จึงนับให้ได้ 2 ชิ้น
   * (ผลรัน 6 พ.ย. 2026 รอบแรกพบ 2 ชิ้นตรงกับโค้ด)
   */
  get missingBanner(): Locator {
    return this.page.getByText(WRITE.saveMissingBanner, { exact: true });
  }

  /**
   * แถวหัวข้อบน hub: role button ชื่อ "<หัวข้อ>. <สถานะ>" (RoomEditSectionList.tsx:208-212)
   * ยึดหัวคำ เพราะการ์ด "Next: Add <หัวข้อ>. ..." ก็เป็นปุ่มที่มีชื่อหัวข้ออยู่ข้างใน (:180-183)
   */
  section(label: string): Locator {
    return this.page.getByRole('button', { name: new RegExp(`^${escapeRegExp(label)}\\. `) });
  }

  /** ปุ่มปิดหัวข้อกลับ hub (W:2234-2241) */
  get done(): Locator {
    return this.page.getByRole('button', { name: WRITE.sectionDone, exact: true });
  }

  // ---- หัวข้อ 1 Property & location (W:2468-2701) ----

  /** ปุ่มเลือกชนิดอสังหา aria-label "Property type: <ค่า>" (W:2485-2511) */
  get propertyTypeButton(): Locator {
    return this.page.getByRole('button', { name: new RegExp(`^${escapeRegExp(WRITE.propertyType)}: `) });
  }

  /** ตัวเลือกใน sheet ที่เป็น role radio (ชนิดอสังหา W:3587-3618) */
  sheetRadio(label: string): Locator {
    return this.page.getByRole('radio').filter({ hasText: new RegExp(`^${escapeRegExp(label)}$`) });
  }

  /** ลิงก์กรอกที่ตั้งเอง ต้องกดก่อนพิมพ์ชื่อโครงการ ไม่อย่างนั้นพิมพ์ตั้งแต่ 2 ตัวจะค้นสถานที่ (W:957-1008, :2616-2631) */
  get enterManually(): Locator {
    return this.page.getByRole('button', { name: WRITE.enterManually, exact: true });
  }

  get projectName(): Locator {
    return this.page.getByPlaceholder(WRITE.projectPlaceholder, { exact: true });
  }

  get address(): Locator {
    return this.page.getByPlaceholder(WRITE.addressPlaceholder, { exact: true });
  }

  /** ช่องที่ไม่มี placeholder (District, Province W:2673-2698): กล่องชั้นในสุดที่มีป้ายนี้ (ต่อท้าย " *" ได้) และ input */
  labelledInput(label: string): Locator {
    return this.page
      .locator('div')
      .filter({ has: this.page.getByText(new RegExp(`^${escapeRegExp(label)}( \\*)?$`)) })
      .filter({ has: this.page.locator('input, textarea') })
      .last()
      .locator('input, textarea');
  }

  // ---- หัวข้อ 2 Room details (W:2703-2906) ----

  get listingName(): Locator {
    return this.page.getByPlaceholder(WRITE.listingTitlePlaceholder, { exact: true });
  }

  /** ปุ่มเลือกประเภทห้อง ไม่มี aria-label ข้อความ "Select room type" ก่อนเลือก (W:2733-2752) */
  get roomTypeButton(): Locator {
    return this.page.getByRole('button', { name: WRITE.selectRoomType, exact: true });
  }

  /** ตัวเลือกใน sheet ที่เป็น role button (ประเภทห้อง W:3619-3657) */
  sheetButton(label: string): Locator {
    return this.page.getByRole('button', { name: label, exact: true });
  }

  // ---- หัวข้อ 5 Rent & terms (W:2908-3014, :3699-3812) ----

  get addLease(): Locator {
    return this.page.getByRole('button', { name: WRITE.addLease, exact: true });
  }

  /**
   * chip ความยาวสัญญา "<n> months" (WRITE.contractMonths, SelectionChip W:3739-3753 รายการจาก GET /agent/rooms/contract-types)
   * รูปแบบเดียวกันตรงกับ chip ค่าเช่าล่วงหน้าและเงินประกันใน sheet เดียวกันด้วย (W:3780-3798) แต่ส่วนความยาวสัญญาอยู่ก่อน (W:3725 ก่อน :3774)
   * จึงใช้ตัวแรกได้ (.first() ในเทส)
   */
  get leaseChips(): Locator {
    return this.page.getByText(new RegExp(`^${WRITE.contractMonths.replace('{months}', '\\d+')}$`));
  }

  /** ช่องค่าเช่า (placeholder "16000" เขียนตรงในโค้ด W:3760-3772 ไม่ใช่ข้อความ i18n) */
  get monthlyRent(): Locator {
    return this.page.getByPlaceholder('16000', { exact: true });
  }

  get addTerms(): Locator {
    return this.page.getByRole('button', { name: WRITE.addTerms, exact: true });
  }

  /** การ์ดสัญญาที่เพิ่มแล้ว aria-label "<n>-month lease" (W:2954-2957) */
  leaseCard(months: number): Locator {
    return this.page.getByRole('button', { name: WRITE.leaseCardTitle.replace('{months}', String(months)), exact: true });
  }

  /** การ์ดสัญญาทุกใบในหัวข้อ Rent & terms */
  get leaseCards(): Locator {
    return this.page.getByRole('button', { name: new RegExp(`^${WRITE.leaseCardTitle.replace('{months}', '\\d+')}$`) });
  }

  get applyLeaseChanges(): Locator {
    return this.page.getByRole('button', { name: WRITE.applyLeaseChanges, exact: true });
  }

  // ---- หัวข้อ 8 Room source (W:3455-3559, :3905-3985) ----

  get chooseContact(): Locator {
    return this.page.getByRole('button', { name: WRITE.chooseContact, exact: true });
  }

  get contactSearch(): Locator {
    return this.page.getByPlaceholder(WRITE.contactSearchPlaceholder, { exact: true });
  }

  /** แถวผู้ติดต่อ role radio ข้อความ = ชื่อ เบอร์ จำนวนห้อง (ContactListRow.tsx:32-69) */
  contactRow(name: string): Locator {
    return this.page.getByRole('radio').filter({ hasText: name });
  }

  get useSelectedContact(): Locator {
    return this.page.getByRole('button', { name: WRITE.useSelectedContact, exact: true });
  }

  /** ลิงก์ไปฟอร์มผู้ติดต่อใหม่ใน sheet เลือกผู้ติดต่อ (role button aria-label เดียวกับข้อความ W:3924-3946) */
  get addNewContact(): Locator {
    return this.page.getByRole('button', { name: WRITE.addNewContact, exact: true });
  }

  /** ช่องในฟอร์มผู้ติดต่อใหม่ (W:3819-3902) */
  get newContactName(): Locator {
    return this.page.getByPlaceholder(WRITE.contactNamePlaceholder, { exact: true });
  }

  get newContactPhone(): Locator {
    return this.page.getByPlaceholder(WRITE.contactPhonePlaceholder, { exact: true });
  }

  get useThisContact(): Locator {
    return this.page.getByRole('button', { name: WRITE.useThisContact, exact: true });
  }

  /** ปุ่มบันทึกของหน้าแก้ห้อง (AgentRoomEditor.tsx:72) */
  get saveChanges(): Locator {
    return this.page.getByRole('button', { name: WRITE.roomSaveChanges, exact: true });
  }
}

/** หน้ารายละเอียดห้อง (components/AgentRoomDetailModal.web.tsx ที่ 648dd28) */
export class RoomDetail {
  constructor(private readonly page: Page) {}

  /** ปุ่ม Edit ในแถบหัว (:185-198 แสดงเมื่อโหลดห้องเสร็จ ไม่มี testid) */
  get edit(): Locator {
    return this.page.locator('.ard-header-actions').getByRole('button', { name: WRITE.roomEdit, exact: true });
  }

  /** เลขห้อง "NK-<id>" ข้างหัว (:181-183) ใช้ยืนยันว่าเปิดห้องที่ถูกต้อง */
  roomCode(id: number): Locator {
    return this.page.locator('.ard-header-title').getByText(`NK-${id}`, { exact: true });
  }
}
