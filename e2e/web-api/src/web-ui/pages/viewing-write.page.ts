import type { Locator, Page } from '@playwright/test';
import { FLOW, WRITE } from '../labels';

/**
 * ปุ่มจัดการนัดในปฏิทินของนายหน้าและหน้าต่างแก้นัด สำหรับเทสเขียนข้อมูล (tests/web-ui-write)
 *   ปฏิทินบนเว็บจอกว้างตั้งแต่ 768 (ชุดนี้ใช้ 1280): components/agent-web/AgentCalendarPage.web.tsx (pre/dev/review fc1a351)
 *   หน้าต่างแก้นัด: components/LeadViewingSheet.tsx ตัวเดิม
 * ปฏิทินเว็บมี data-testid จึงหาด้วย testid ส่วนหน้าต่างแก้นัดยังไม่มี หาด้วยข้อความและ role
 */
export class ViewingWrite {
  constructor(private readonly page: Page) {}

  /**
   * ปุ่มจัดการนัด (data-testid calendar.manage.<viewing.id>: manageButton ใน AgentCalendarPage.web.tsx ที่ fc1a351)
   *   แสดงเฉพาะนัด scheduled และมีทั้งในรายการของวันที่เลือก และในมุมมอง List จึงเลือกตัวที่อยู่ในรายการของวัน (calendar.dayList)
   *   เดิมหาด้วยข้อความ "<ชื่อลีด> · <ชื่อห้อง>" ซึ่งหน้าเว็บใหม่ไม่แสดงแล้ว
   */
  manage(viewingId: number): Locator {
    return this.page.getByTestId('calendar.dayList').getByTestId(`calendar.manage.${viewingId}`);
  }

  /** หัวเรื่องของหน้าต่างแก้นัด (SheetHeader title editTitle :206) */
  get editTitle(): Locator {
    return this.page.getByText(WRITE.viewingEditTitle, { exact: true });
  }

  /** แถวเวลา (FormRow :242-255 role button ข้อความ "Time" ตามด้วยเวลา) กดแล้วเปิดช่องเวลา */
  get timeRow(): Locator {
    return this.page.getByRole('button').filter({ hasText: new RegExp(`^${WRITE.viewingTime}`) });
  }

  /** ช่องเวลา <input type="time" step=900> (ViewingTimeField.web.tsx:20-23 ไม่มีป้าย) */
  get timeInput(): Locator {
    return this.page.locator('input[type="time"]');
  }

  get save(): Locator {
    return this.page.getByRole('button', { name: WRITE.saveChanges, exact: true });
  }

  /** ลิงก์ยกเลิกในฟอร์ม และปุ่มยืนยันในโหมดยกเลิก ใช้ข้อความเดียวกัน (:191-203, :297-308) แต่ไม่อยู่พร้อมกัน */
  get cancel(): Locator {
    return this.page.getByRole('button', { name: WRITE.viewingCancel, exact: true });
  }

  /**
   * โครงระหว่างโหลดนัด (WebSkeleton testID calendar.loading ในตารางเดือน และ calendar.dayLoading ในรายการของวัน ที่ fc1a351
   *   WebSkeleton เขียน data-testid ตาม testID: components/agent-web/ui/WebState.tsx:95-98)
   *   หน้าเว็บใหม่ไม่มีข้อความ "Loading…" แล้ว ตอนโหลดรายการนัดว่าง จึงต้องรอให้หายก่อนตรวจว่าไม่มีปุ่มจัดการ
   */
  get loading(): Locator {
    return this.page.getByTestId('calendar.loading').or(this.page.getByTestId('calendar.dayLoading'));
  }

  /** ข้อความโหลดนัดไม่สำเร็จ (agent.calendar.loadError: รายการของวันใน AgentCalendarPage.web.tsx ที่ fc1a351) */
  get loadError(): Locator {
    return this.page.getByText(FLOW.calendarLoadError, { exact: true });
  }

  get cancelConfirmTitle(): Locator {
    return this.page.getByText(WRITE.viewingCancelConfirm, { exact: true });
  }
}
