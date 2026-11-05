/**
 * เทสส่วนที่ "เร็ว ๆ นี้" ของนายหน้า: แถวในลิ้นชักเมนู ปุ่มลัดในแท็บเพิ่มเติม และแผงแจ้งเตือน (ชุด session รันด้วย npm run test:session)
 *
 * สิ่งที่ต้องมีก่อนรัน: เหมือน tests-session/agent-session.spec.ts (build โหมดนักพัฒนาที่บทบาทตั้งต้นเป็น agent และ API เปิดอยู่)
 *   ไฟล์นี้ตรวจ GET /health ก่อนเริ่ม ถ้าไม่ตอบ จะไม่รันเทสข้อใดเลยและบอกสาเหตุ (src/support/api-health.ts)
 *
 * ที่มาของสิ่งที่คาด (qa/e2e f8be525)
 *   - แท็บที่ยังไม่พร้อมของนายหน้า: contact, contracts, services (packages/ui/src/config/agentComingSoon.ts บรรทัด 9)
 *     ในลิ้นชักมี commission เป็น comingSoon ตรง ๆ อีกแถว (packages/ui/src/config/mobileDrawerMenuMatrix.ts บรรทัด 203 ถึง 210)
 *   - แถวและปุ่มที่เป็น comingSoon ตั้ง disabled และชื่อกำกับเป็น "<ชื่อ>, เร็ว ๆ นี้"
 *     (packages/ui/src/shells/MobileProfileDrawer.tsx บรรทัด 350 ถึง 354 ; apps/consumer-app/components/AgentMoreToolsBody.tsx บรรทัด 51 ถึง 59)
 *   - แผงแจ้งเตือนมีรายการว่างที่เขียนไว้ในแอป และแสดง agent.dashboard.comingSoon (apps/consumer-app/app/index.tsx บรรทัด 118 ถึง 119, 233 ถึง 234 และ 2001)
 *   รายละเอียดของแต่ละชิ้นอยู่ในหัวไฟล์ของ src/screens/ProfileDrawer.ts, AgentMoreTab.ts และ NotificationsPanel.ts
 *
 * ทำไมตรวจทั้งชื่อกำกับและสถานะกดได้
 *   ชื่อกำกับบอกสิ่งที่ผู้ใช้ VoiceOver ได้ยิน ส่วน enabled บอกว่า iOS รายงานว่ากดไม่ได้
 *   ข้อจำกัด: enabled มาจากสถานะเข้าถึง (accessibilityState) ซึ่งแอปตั้งแยกจาก prop disabled ที่กันการแตะจริง
 *     (MobileProfileDrawer.tsx บรรทัด 350 กับ 354 ; AgentMoreToolsBody.tsx บรรทัด 56 กับ 59) เทสไม่ได้ลองแตะ
 *     ถ้าทีมลบ disabled แต่เหลือ accessibilityState ปุ่มจะกดได้ทั้งที่ข้อนี้ยังผ่าน
 *   แต่ละข้อมีแถวหรือปุ่มที่เปิดใช้ได้ 1 ชิ้นเป็นตัวเทียบ ถ้าชุดเทสอ่าน enabled ผิดเป็น false ทุกชิ้น ตัวเทียบจะแดง
 *   ข้อ 1 กับ 2 ตรวจด้วยว่าทั้งหน้ามีปุ่มชื่อนั้นชิ้นเดียว (sameLabelButtons) เพื่อให้แน่ใจว่าอ่านแถวในลิ้นชัก ไม่ใช่ปุ่มชื่อซ้ำบนหน้าข้างใต้ (ดู ProfileDrawer.ts)
 *
 * ข้อมูลในระบบ: ไฟล์นี้ไม่ตั้งใจสร้างหรือแก้ข้อมูล และไม่แตะแถวหรือปุ่มที่พาไปหน้าอื่น
 *   - สิ่งที่แตะ: ปุ่ม Menu, กลุ่ม CRM (กางในที่), แท็บเพิ่มเติม, ปุ่มระฆัง จากโค้ด ทั้งหมดเปลี่ยนแค่สถานะบนหน้าจอและไม่เรียก API (ยังไม่ได้วัดบนเครื่อง)
 *   - API ที่ถูกเรียกมาจากการล็อกอิน (POST /auth/sync) และการโหลดหน้าภาพรวม (GET /agent/dashboard ซึ่งอ่านอย่างเดียว
 *     apps/api/src/agent/dashboard/agent-dashboard.service.ts บรรทัด 101) เหมือนข้ออื่นของชุด session
 *   - เงื่อนไขเดียวกับ agent-session.spec.ts: บัญชีนักพัฒนามีบทบาท admin และ agent อยู่แล้ว ถ้ายังไม่มี แอปจะขอบทบาทให้ผ่าน POST /auth/dev/roles ซึ่งเป็นการเขียน
 *   - ยังไม่ได้นับแถวในฐานข้อมูลก่อนและหลังรันไฟล์นี้ (การนับของขั้นที่ 34 กับ 35 ทำก่อนมีไฟล์นี้)
 *
 * สิ่งที่ไฟล์นี้ไม่ตรวจโดยตั้งใจ
 *   - แถว "ค่าคอม" ในแท็บเพิ่มเติม (เป็น View ไม่ใช่ปุ่ม ต้องดู XML บนเครื่องจริงก่อน)
 *   - หน้าต่าง Alert ของปุ่มลัดบนแดชบอร์ด (ผู้ใช้กดไม่ถึง เป็นข้อสังเกตถึงทีม ไม่ใช่เทส)
 *
 * ยังไม่เคยรันบนเครื่องจริง: ค่า enabled และชื่อกำกับอ่านจากโค้ด ถ้าแดงในรอบแรก ให้ดู XML ใน test-results/ ก่อนสรุปว่าเป็นบั๊ก
 */
import { env } from '../src/config/env';
import { loginAsDevAgent } from '../src/flows/login-as-dev-agent';
import { sessionLabelsFor } from '../src/labels/session';
import { AgentMoreTab } from '../src/screens/AgentMoreTab';
import { NotificationsPanel } from '../src/screens/NotificationsPanel';
import { ProfileDrawer } from '../src/screens/ProfileDrawer';
import { requireApi } from '../src/support/api-health';
import { readUntil } from '../src/support/wait';

/** เวลาสูงสุดต่อ 1 เทส: ค่าเดียวกับ agent-session.spec.ts (ทุกข้อล็อกอินจริงก่อน) */
const SESSION_TEST_TIMEOUT_MS = 240_000;

describe('Agent coming-soon items (needs the API)', function () {
  this.timeout(SESSION_TEST_TIMEOUT_MS);

  /** ข้อความที่คาด ในภาษาที่ชุดเทสสั่งให้แอปใช้ (E2E_APP_LANGUAGE) */
  const labels = sessionLabelsFor(env.appLanguage);

  /** ชื่อกำกับของสิ่งที่ยังไม่เปิดใช้: "<ชื่อ>, <เร็ว ๆ นี้>" */
  const soon = (name: string): string => `${name}, ${labels.comingSoon}`;

  const drawer = new ProfileDrawer();
  const moreTab = new AgentMoreTab();
  const panel = new NotificationsPanel();

  before(async () => {
    if (!env.expectDevAuth) {
      throw new Error('ชุด session ล็อกอินด้วยบัญชีนักพัฒนาที่แอปเติมไว้ จึงใช้ได้กับ build โหมดนักพัฒนาเท่านั้น (E2E_EXPECT_DEV_AUTH ต้องเป็น true)');
    }
    await requireApi();
  });

  it('shows Commission and Contracts as coming soon and disabled in the menu drawer', async () => {
    // ขั้นที่ 1: ล็อกอิน (ขั้นเตรียม) หน้าแรกคือแท็บภาพรวม
    const home = await loginAsDevAgent();

    // ขั้นที่ 2: เปิดลิ้นชักเมนู
    await home.openMenu();

    // ขั้นที่ 3: แถวค่าคอมกับสัญญาเป็นแบบเร็ว ๆ นี้ และกดไม่ได้ (mobileDrawerMenuMatrix.ts บรรทัด 197 ถึง 210)
    //   sameLabelButtons 1 = ทั้งหน้ามีปุ่มชื่อนี้ชิ้นเดียว จึงเป็นแถวในลิ้นชัก (ดูหัวไฟล์)
    expect(await drawer.rowState('commission')).toEqual({ label: soon(labels.drawerRows.commission), enabled: false, sameLabelButtons: 1 });
    expect(await drawer.rowState('agentContracts')).toEqual({ label: soon(labels.drawerRows.agentContracts), enabled: false, sameLabelButtons: 1 });

    // ขั้นที่ 4: ตัวเทียบ แถวเครื่องมือเพิ่มเติมเปิดใช้ได้ ชื่อกำกับเป็นชื่อแถวล้วน (บรรทัด 211 ถึง 216)
    //   แดชบอร์ดข้างใต้มีปุ่มเครื่องมือเพิ่มเติมที่ไม่มีชื่อกำกับของตัวเอง ถ้า iOS ตั้งชื่อให้ตรงกัน ข้อนี้จะแดงที่ sameLabelButtons ให้ดู XML
    expect(await drawer.rowState('moreTools')).toEqual({ label: labels.drawerRows.moreTools, enabled: true, sameLabelButtons: 1 });
  });

  it('shows Contact as coming soon inside the CRM group, and Calendar as available', async () => {
    // ขั้นที่ 1: ล็อกอิน (ขั้นเตรียม)
    const home = await loginAsDevAgent();

    // ขั้นที่ 2: เปิดลิ้นชักเมนู แล้วแตะกลุ่ม CRM เพื่อกางแถวข้างใน (กลุ่มเริ่มแบบหุบ MobileProfileDrawer.tsx บรรทัด 163)
    await home.openMenu();
    await drawer.expandCrm();

    // ขั้นที่ 3: แถวติดต่อเป็นแบบเร็ว ๆ นี้ และกดไม่ได้ ; แถวปฏิทินเปิดใช้ได้ (mobileDrawerMenuMatrix.ts บรรทัด 192 ถึง 193)
    expect(await drawer.rowState('contact')).toEqual({ label: soon(labels.drawerRows.contact), enabled: false, sameLabelButtons: 1 });
    expect(await drawer.rowState('calendar')).toEqual({ label: labels.drawerRows.calendar, enabled: true, sameLabelButtons: 1 });
  });

  it('shows Contacts, Services and Contracts archive as coming soon and disabled on the More tab', async () => {
    // ขั้นที่ 1: ล็อกอิน (ขั้นเตรียม)
    const home = await loginAsDevAgent();

    // ขั้นที่ 2: แตะแท็บเพิ่มเติม แล้วรอให้แท็บนี้ถูกเลือก เพื่อให้แน่ใจว่าหน้าของแท็บนี้ขึ้นแล้ว
    await home.tapTab('more');
    expect(await readUntil(() => home.selectedTabs(), ['more'])).toEqual(['more']);

    // ขั้นที่ 3: ปุ่มลัด 3 ปุ่มที่อยู่ในรายการ comingSoon เป็นแบบเร็ว ๆ นี้ และกดไม่ได้ (AgentMoreToolsBody.tsx บรรทัด 51 ถึง 59)
    expect(await moreTab.shortcutState('contacts')).toEqual({ label: soon(labels.moreShortcuts.contacts), enabled: false });
    expect(await moreTab.shortcutState('services')).toEqual({ label: soon(labels.moreShortcuts.services), enabled: false });
    expect(await moreTab.shortcutState('contracts')).toEqual({ label: soon(labels.moreShortcuts.contracts), enabled: false });

    // ขั้นที่ 4: ตัวเทียบ ปุ่มลัดปฏิทินเปิดใช้ได้ ชื่อกำกับเป็น "<ชื่อ>, <คำอธิบาย>" (บรรทัด 58)
    expect(await moreTab.shortcutState('calendar')).toEqual({ label: `${labels.moreShortcuts.calendar}, ${labels.calendarDesc}`, enabled: true });
  });

  it('opens the notifications panel from the bell and shows the coming-soon empty message', async () => {
    // ขั้นที่ 1: ล็อกอิน (ขั้นเตรียม) ปุ่มระฆังอยู่บนส่วนหัวของแท็บภาพรวม ซึ่งเป็นหน้าแรกหลังล็อกอิน
    const home = await loginAsDevAgent();

    // ขั้นที่ 2: แตะปุ่มระฆัง แผงแจ้งเตือนต้องเปิด และหัวข้อเป็นภาษาที่สั่ง (mobile.notifications.title)
    await home.openNotifications();
    expect(await panel.waitUntilOpen()).toBe(labels.notificationsTitle);

    // ขั้นที่ 3: ยังไม่มีรายการแจ้งเตือน (แอปยังไม่เชื่อม API) แผงแสดงข้อความ "เร็ว ๆ นี้" 1 ชิ้น (index.tsx บรรทัด 2001)
    //   ใช้ readUntil เพราะแผงเลื่อนเข้ามา ข้อความอาจยังไม่นับว่ามองเห็นในการอ่านครั้งแรก
    //   ข้อจำกัด: ถ้า iOS รายงานเนื้อหาของหน้าข้างใต้แผงว่ามองเห็น และหน้านั้นมีคำเดียวกัน ข้อนี้อาจแดง (ได้มากกว่า 1 ชิ้น)
    //   หรือผ่านทั้งที่แผงไม่แสดงข้อความ ที่ f8be525 แดชบอร์ดไม่มีคำนี้ (ดู NotificationsPanel.ts)
    expect(await readUntil(() => panel.emptyLabelsShown(), [labels.comingSoon])).toEqual([labels.comingSoon]);
  });
});
