/**
 * ลิ้นชักเมนูของผู้ใช้ที่ล็อกอินแล้ว (Page Object) เปิดจากปุ่ม Menu บนส่วนหัวของหน้าของนายหน้า
 *
 * คลาสนี้ไม่ตรวจผล การตรวจอยู่ในไฟล์เทส
 * ที่มา: packages/ui/src/shells/MobileProfileDrawer.tsx ที่ commit feefcf2
 *   - ลิ้นชักเลื่อนเข้ามาจากข้างจอใน 250 มิลลิวินาที (บรรทัด 203 ถึง 210)
 *   - แถว "ตั้งค่าแอป" เป็นปุ่มที่มีชื่อกำกับ (บรรทัด 515 ถึง 527) แตะแล้วเปิดแผงตั้งค่าแอปภายในลิ้นชัก
 * บนเครื่องจริง (ขั้นที่ 34): แถว "ตั้งค่าแอป" เป็นชนิด Button มองเห็นที่ y=813 โดยไม่ต้องเลื่อน
 *   และมีข้อความชื่อเดียวกันที่มองไม่เห็นอีก 2 ชิ้น (ชนิด StaticText ที่ y=86) จึงหาด้วยชนิด Button
 */
import { sessionInEveryLanguage } from '../labels/session';
import { type ElementSpec, scrollIntoView } from './locators';

export class ProfileDrawer {
  private readonly appSettingsRow: ElementSpec = {
    description: 'แถว "ตั้งค่าแอป" ในลิ้นชักเมนู',
    testId: 'drawer.appSettings',
    labels: sessionInEveryLanguage((labels) => labels.appSettings),
    types: ['XCUIElementTypeButton'],
  };

  /**
   * แตะแถว "ตั้งค่าแอป" เพื่อเปิดแผงตั้งค่าแอป (ดู AppSettingsPane)
   * รอให้ลิ้นชักหยุดเลื่อนก่อน และถ้าแถวอยู่นอกจอ (เช่น จอเล็กกว่าเครื่องที่ใช้เทส) จะเลื่อนจอให้เห็นก่อนแตะ
   */
  async openAppSettings(): Promise<void> {
    await (await scrollIntoView(this.appSettingsRow)).click();
  }
}
