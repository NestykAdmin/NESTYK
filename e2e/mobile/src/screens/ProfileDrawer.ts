/**
 * ลิ้นชักเมนูของผู้ใช้ที่ล็อกอินแล้ว (Page Object) เปิดจากปุ่ม Menu บนส่วนหัวของหน้าของนายหน้า
 *
 * คลาสนี้ไม่ตรวจผล การตรวจอยู่ในไฟล์เทส
 * ที่มา: packages/ui/src/shells/MobileProfileDrawer.tsx ที่ develop bc77a8b (เลขบรรทัดเท่ากับที่ feefcf2)
 *   - ลิ้นชักเลื่อนเข้ามาจากข้างจอใน 250 มิลลิวินาที (บรรทัด 203 ถึง 210)
 *   - แถว "ตั้งค่าแอป" เป็นปุ่มที่มีชื่อกำกับ (บรรทัด 515 ถึง 527) แตะแล้วเปิดแผงตั้งค่าแอปภายในลิ้นชัก
 * บนเครื่องจริง (ขั้นที่ 34): แถว "ตั้งค่าแอป" เป็นชนิด Button มองเห็นที่ y=813 โดยไม่ต้องเลื่อน
 *   และมีข้อความชื่อเดียวกันที่มองไม่เห็นอีก 2 ชิ้น (ชนิด StaticText ที่ y=86) จึงหาด้วยชนิด Button
 * แถวเมนูของบทบาท (ที่มา qa/e2e f8be525: MobileProfileDrawer.tsx บรรทัด 335 ถึง 375 และ mobileDrawerMenuMatrix.ts บรรทัด 150 ถึง 219)
 *   - ทุกแถวเป็น TouchableOpacity ที่มี accessibilityRole="button" (บรรทัด 343 และ 352) จึงหาด้วยชนิด Button
 *   - แถวที่ยังไม่เปิดใช้ (comingSoon) ตั้ง disabled และ accessibilityState disabled (บรรทัด 350 และ 354)
 *     ชื่อกำกับเป็น "<ชื่อแถว>, <เร็ว ๆ นี้>" ส่วนแถวอื่นเป็นชื่อแถวล้วน (บรรทัด 353)
 *   - กลุ่ม CRM กางในที่ (presentation 'expand' ที่ mobileDrawerMenuMatrix.ts บรรทัด 190) และเริ่มแบบหุบ
 *     (expandedIds เริ่มเป็น {} ที่ MobileProfileDrawer.tsx บรรทัด 163) ต้องแตะกลุ่มก่อนจึงมีแถว contact กับ calendar
 *   - ยังไม่เคยรันบนเครื่องจริง: คาดจากโค้ดว่า iOS รายงานแถวที่ disabled เป็น enabled="false" ถ้าเทสแดงที่ตรงนี้ ให้ดู XML ใน test-results/
 */
import { type DrawerRow, sessionInEveryLanguage } from '../labels/session';
import { readScreen } from '../support/page-source';
import { type ElementSpec, nodesInSource, scrollIntoView, waitUntilPlaced } from './locators';

/** ชื่อกำกับและสถานะกดได้ของแถว ตามที่ iOS รายงาน (enabled มาจากสถานะเข้าถึง ไม่ได้ลองแตะจริง) */
export interface RowState {
  label: string;
  enabled: boolean;
}

/**
 * สถานะของแถวในลิ้นชัก บวกจำนวนปุ่มทั้งหน้าที่มีชื่อกำกับเดียวกับแถวที่อ่านได้
 * ลิ้นชักเป็น Modal แบบโปร่ง (MobileProfileDrawer.tsx บรรทัด 391) หน้าของนายหน้ายังอยู่ข้างใต้ ถ้ามีปุ่มชื่อซ้ำ
 * การหาด้วยข้อความอาจได้ปุ่มบนหน้าข้างใต้แทนแถวในลิ้นชัก เทสจึงตรวจว่าจำนวนนี้เป็น 1
 * ที่ f8be525 ปุ่ม "เครื่องมือเพิ่มเติม" บนแดชบอร์ดไม่มีชื่อกำกับของตัวเอง
 *   (packages/feature-listing/src/components/MobileAgentDashboardBody.tsx บรรทัด 579 ถึง 584) ยังไม่รู้ว่า iOS ตั้งชื่อให้เป็นอะไร
 * เมื่อแอปมี testID drawer.<row> แล้ว ค่านี้คือจำนวนชิ้นที่มี testID นั้น (nodesInSource หาด้วย testID ก่อน locators.ts บรรทัด 118 ถึง 122) ไม่ใช่จำนวนปุ่มที่ชื่อกำกับซ้ำ
 * ข้อจำกัด: ถ้าแถวในลิ้นชักหายไป แต่หน้าข้างใต้มีปุ่มชื่อเดียวกัน 1 ชิ้น ค่านี้ยังเป็น 1 (ที่ f8be525 ไม่มีปุ่มแบบนั้น)
 */
export interface DrawerRowState extends RowState {
  sameLabelButtons: number;
}

/**
 * แถวเมนูของบทบาท หาได้ทั้งแบบเปิดใช้ (ชื่อล้วน) และแบบเร็ว ๆ นี้ ("ชื่อ, เร็ว ๆ นี้") ในทุกภาษา
 * เทสจึงอ่านได้ว่าแถวเป็นแบบไหน ถ้าทีมเปิดใช้แถวนั้นแล้ว เทสจะแดงที่การเทียบชื่อกำกับ ไม่ใช่หมดเวลาเพราะหาไม่เจอ
 */
function drawerRowSpec(row: DrawerRow): ElementSpec {
  const names = sessionInEveryLanguage((labels) => labels.drawerRows[row]);
  const soon = sessionInEveryLanguage((labels) => `${labels.drawerRows[row]}, ${labels.comingSoon}`);
  return {
    description: `แถว "${names[0]}" ในลิ้นชักเมนู`,
    testId: `drawer.${row}`,
    labels: [...soon, ...names],
    types: ['XCUIElementTypeButton'],
  };
}

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

  /**
   * ชื่อกำกับและสถานะกดได้ของแถวเมนู อ่านโดยไม่แตะ
   * รอแค่ให้แถวอยู่นิ่งในโครงสร้างหน้าจอ (ลิ้นชักเลื่อนเข้ามาจากข้างจอ) ไม่ต้องมองเห็น เพราะแถวอาจอยู่ใต้ขอบจอ
   * ใช้กับแถวระดับบนสุด หรือแถวในกลุ่ม CRM หลัง expandCrm
   * sameLabelButtons นับจากโครงสร้างหน้าจอทั้งหน้า ทั้งที่มองเห็นและมองไม่เห็น (ดู DrawerRowState)
   */
  async rowState(row: DrawerRow): Promise<DrawerRowState> {
    const spec = drawerRowSpec(row);
    const element = await waitUntilPlaced(spec);
    const label = (await element.getAttribute('label')) ?? '';
    const enabled = await element.isEnabled();
    const sameLabelButtons = nodesInSource(await readScreen(), spec, (node) => node.label === label).length;
    return { label, enabled, sameLabelButtons };
  }

  /** แตะกลุ่ม CRM เพื่อกางแถวข้างใน กลุ่มนี้กางในที่ ไม่พาไปหน้าอื่น */
  async expandCrm(): Promise<void> {
    await (await scrollIntoView(drawerRowSpec('crm'))).click();
  }
}
