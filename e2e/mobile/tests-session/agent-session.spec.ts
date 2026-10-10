/**
 * เทสล็อกอินสำเร็จ การสลับแท็บ การจำการล็อกอิน และการออกจากระบบของนายหน้า (ชุด session รันด้วย npm run test:session)
 *
 * สิ่งที่ต้องมีก่อนรัน
 *   - iPhone จำลองเปิดอยู่ และมีแอป NESTYK ที่เป็น build โหมดนักพัฒนา (แอปเติมบัญชีนักพัฒนาในหน้า login ให้เอง) และบทบาทตั้งต้นเป็น agent
 *   - API ของ NESTYK เปิดอยู่ที่ E2E_API_URL และใช้ฐานข้อมูลที่มีบัญชีนักพัฒนาพร้อมบทบาท agent กับ admin อยู่แล้ว
 *     ไฟล์นี้ตรวจ GET /health ก่อนเริ่ม ถ้าไม่ตอบ จะไม่รันเทสข้อใดเลยและบอกสาเหตุ (src/support/api-health.ts)
 *     การตรวจนี้อยู่ใน before() ต่างจากข้อตกลงของชุดหลักโดยตั้งใจ: เมื่อ API ไม่พร้อม ทุกข้อในไฟล์นี้รันไม่ได้อยู่แล้ว การข้ามทั้งไฟล์จึงถูกต้อง
 *
 * ข้อมูลในระบบ: ไฟล์นี้ไม่ตั้งใจสร้างหรือแก้ข้อมูล
 *   - ขั้นที่ 34 (9 ต.ค. 2026) นับแถวทุกตารางและตัวเลขสะสมของการเพิ่ม แก้ ลบ ก่อนและหลังการล็อกอิน การสลับแท็บ การเปิดแอปใหม่
 *     และการออกจากระบบ ไม่มีอะไรเปลี่ยน แต่ขั้นนั้นเปิดแท็บห้อง ลีด ผู้เช่า โดยไม่ได้รอให้รายการโหลดจบ
 *     ส่วนข้อ 3 ของไฟล์นี้รอจนโหลดจบ (รวมการโหลดสลิปรอตรวจของแท็บผู้เช่า) จึงต้องวัดซ้ำ สคริปต์ขั้นที่ 35 นับแถวก่อนและหลังรันไฟล์นี้
 *   - เงื่อนไขของข้อนั้น: บัญชีนักพัฒนามีบทบาท admin และ agent อยู่แล้ว ถ้ายังไม่มี แอปจะขอบทบาทให้ผ่าน POST /auth/dev/roles ซึ่งเป็นการเขียน
 *     (apps/consumer-app/lib/auth/AuthContext.tsx บรรทัด 50 ถึง 58 และ lib/agent-session.ts บรรทัด 11 ถึง 28)
 *
 * สิ่งที่ไฟล์นี้ไม่ตรวจโดยตั้งใจ (บันทึกเป็นข้อสังเกตให้ทีมแล้ว ยังไม่รู้ว่าตั้งใจหรือไม่):
 *   ปุ่ม "OK" ภาษาอังกฤษในหน้าต่างแจ้งหลังออกจากระบบ ข้อความภาษาอังกฤษที่เขียนตายตัวบนหน้าของผู้เยี่ยมชม
 *   และหัวของหน้าห้องกับหน้าลีด ("Listing Room" กับ "Lead") ซึ่งเป็นค่าในไฟล์ภาษาไทยเอง
 *
 * การตรวจอีเมลใช้ assert.ok แทน expect เพื่อให้ข้อความเมื่อไม่ผ่านบอกแค่ชื่อตัวแปร ไม่มีค่าอีเมลในผลรัน
 */
import assert from 'node:assert/strict';
import { env } from '../src/config/env';
import { LOGIN_WAIT_MS, loginAsDevAgent } from '../src/flows/login-as-dev-agent';
import { openLoginScreen } from '../src/flows/open-login';
import { AGENT_TABS, DATA_TABS, sessionLabelsFor } from '../src/labels/session';
import { AgentHomeScreen } from '../src/screens/AgentHomeScreen';
import { AppSettingsPane } from '../src/screens/AppSettingsPane';
import { GuestHomeScreen } from '../src/screens/GuestHomeScreen';
import { LoginScreen } from '../src/screens/LoginScreen';
import { ProfileDrawer } from '../src/screens/ProfileDrawer';
import { WelcomeScreen } from '../src/screens/WelcomeScreen';
import { acceptAlert, waitForAlert } from '../src/support/alert';
import { requireApi } from '../src/support/api-health';
import { startApp } from '../src/support/app';
import { readUntil } from '../src/support/wait';

/** เวลารอหน้าต่างแจ้งหลังแตะออกจากระบบ (ขั้นที่ 34: ขึ้นหลังแตะ 1.5 วินาที) */
const ALERT_WAIT_MS = 10_000;

/**
 * เวลารอให้ตัวโหลดของแท็บหายไป: แอปรอ 250 มิลลิวินาทีก่อนเรียก API (AgentRoomsScreen.tsx บรรทัด 356)
 * แล้วเมื่อได้คำตอบ ตัวโหลดเติมภาพจนเต็มก่อนเปิดรายการ (packages/ui/src/components/MobileBrandLoader.tsx บรรทัด 149 ถึง 163)
 * ยังไม่เคยวัดบนเครื่องจริง (ขั้นที่ 34 เก็บภาพไว้ตอนยังโหลด) ค่านี้จึงเผื่อไว้มาก
 */
const LOAD_WAIT_MS = 20_000;

/**
 * เวลาสูงสุดต่อ 1 เทส (แทน 120 วินาทีของ wdio.conf.ts) เพราะเทสในไฟล์นี้ล็อกอินจริง และบางข้อเปิดแอปใหม่ 2 ครั้ง
 * ค่านี้มีไว้ให้การรอแต่ละจุดหมดเวลาเองพร้อมข้อความบอกสาเหตุ ก่อนที่ Mocha จะตัดเทสด้วยข้อความหมดเวลาแบบรวม
 */
const SESSION_TEST_TIMEOUT_MS = 240_000;

describe('Agent session (needs the API)', function () {
  this.timeout(SESSION_TEST_TIMEOUT_MS);

  /** ข้อความที่คาด ในภาษาที่ชุดเทสสั่งให้แอปใช้ (E2E_APP_LANGUAGE) */
  const labels = sessionLabelsFor(env.appLanguage);
  const welcome = new WelcomeScreen();
  const login = new LoginScreen();
  const home = new AgentHomeScreen();
  const drawer = new ProfileDrawer();
  const settings = new AppSettingsPane();
  const guest = new GuestHomeScreen();

  before(async () => {
    if (!env.expectDevAuth) {
      throw new Error('ชุด session ล็อกอินด้วยบัญชีนักพัฒนาที่แอปเติมไว้ จึงใช้ได้กับ build โหมดนักพัฒนาเท่านั้น (E2E_EXPECT_DEV_AUTH ต้องเป็น true)');
    }
    await requireApi();
  });

  /** จากหน้าของนายหน้า: เปิดเมนู แล้วเปิดแผงตั้งค่าแอป และรอจนแผงหยุดเลื่อน */
  async function openAppSettings(): Promise<void> {
    await home.openMenu();
    await drawer.openAppSettings();
    await settings.waitUntilOpen();
  }

  it('logs in with the prefilled developer account and lands on the agent home', async () => {
    // ขั้นที่ 1: เปิดแอปใหม่ไปที่หน้า login
    await openLoginScreen();

    // ขั้นที่ 2: แอปเติมบัญชีนักพัฒนาไว้ให้ (login.tsx บรรทัด 71 ถึง 76) รหัสผ่านนับได้แค่ว่ามีตัวอักษร ไม่อ่านตัวรหัส
    assert.ok((await login.emailText()) === env.devLoginEmail, 'ช่องอีเมลของหน้า login ไม่ตรงกับ E2E_DEV_LOGIN_EMAIL');
    expect(await login.passwordDisplay()).toBe('hidden');
    expect(await login.passwordLength()).toBeGreaterThan(0);

    // ขั้นที่ 3: แตะเข้าสู่ระบบ แอปเรียก POST /auth/sync แล้วไปหน้าของนายหน้า (ขั้นที่ 34: 2.1 วินาที)
    await login.tapLogin();
    await home.waitUntilShown(LOGIN_WAIT_MS);

    // ขั้นที่ 4: หน้าแรกคือแท็บภาพรวม มีป้ายพื้นที่ทำงาน แท็บครบ 5 แท็บ และแท็บที่ถูกเลือกคือภาพรวมแท็บเดียว
    //   (index.tsx บรรทัด 140 กับ 146 ถึง 148: บทบาทเริ่มต้นมาจากค่าตั้งของ build และแท็บแรกของ agent คือ dashboard)
    expect(await home.workspaceLabelShown()).toBe(true);
    expect(await home.visibleTabs()).toEqual([...AGENT_TABS]);
    expect(await readUntil(() => home.selectedTabs(), ['dashboard'])).toEqual(['dashboard']);
    expect(await login.isShown()).toBe(false);
  });

  it('switches between the five agent tabs', async () => {
    // ขั้นที่ 1: ล็อกอิน (ขั้นเตรียม) หน้าแรกคือแท็บภาพรวม
    await loginAsDevAgent();

    // ขั้นที่ 2: แตะทีละแท็บ จบที่ภาพรวม หลังแตะแต่ละครั้ง แท็บที่ถูกเลือกต้องเป็นแท็บที่เพิ่งแตะแท็บเดียว
    //   (MobileBottomTabBar.tsx บรรทัด 162 ถึง 164 ส่งสถานะ selected ของแท็บ ขั้นที่ 34: traits ขึ้น Selected หลังแตะ 0.5 ถึง 1.0 วินาที)
    for (const tab of ['listingRoom', 'listingLead', 'clients', 'more', 'dashboard'] as const) {
      await home.tapTab(tab);
      expect(await readUntil(() => home.selectedTabs(), [tab])).toEqual([tab]);
    }
  });

  it('loads the rooms, leads and tenants lists without an error', async () => {
    // ขั้นที่ 1: ล็อกอิน (ขั้นเตรียม)
    await loginAsDevAgent();

    for (const tab of DATA_TABS) {
      // ขั้นที่ 2: แตะแท็บ แล้วรอให้แท็บนั้นถูกเลือกก่อน เพื่อให้แน่ใจว่าหน้าของแท็บนี้ขึ้นแล้ว (ไม่ได้ดูตัวโหลดของหน้าก่อนหน้า)
      await home.tapTab(tab);
      expect(await readUntil(() => home.selectedTabs(), [tab])).toEqual([tab]);

      // ขั้นที่ 3: แท็บนี้โหลดรายการจาก API (เช่น GET /agent/listings ของแท็บห้อง) ระหว่างนั้นแสดง "กำลังโหลด…"
      //   ตัวโหลดหายทั้งเมื่อโหลดเสร็จและเมื่อโหลดไม่สำเร็จ จึงตรวจต่อว่าไม่มีสิ่งที่บอกว่าโหลดไม่สำเร็จแสดงอยู่:
      //   ข้อความโหลดไม่สำเร็จของหน้าห้อง ลีด ผู้เช่า (รวมข้อความเมื่อโหลดสลิปรอตรวจไม่สำเร็จ และข้อความ error ของ API ที่หน้าผู้เช่าแสดงตรง ๆ
      //   ซึ่งชุดเทสรู้จัก) และปุ่มลองใหม่ของหน้าห้องกับหน้าลีด ถ้าไม่ผ่าน ผลรันจะบอกชื่อหน้ากับข้อความที่เห็น เช่น "ผู้เช่า: โหลดผู้เช่าไม่สำเร็จ"
      //   ข้อจำกัด: หน้าผู้เช่าไม่มีปุ่มลองใหม่ ถ้าแอปแสดงข้อความ error ของ API ที่ไม่อยู่ในรายการของชุดเทส ข้อนี้จับไม่ได้ (README หัวข้อ "ชุด session")
      await home.waitUntilLoaded(LOAD_WAIT_MS);
      expect(await home.loadFailuresShown(tab)).toEqual([]);
    }
  });

  it('keeps the user logged in after the app restarts', async () => {
    // ขั้นที่ 1: ล็อกอิน (ขั้นเตรียม)
    await loginAsDevAgent();

    // ขั้นที่ 2: ปิดแอปแล้วเปิดใหม่โดยไม่ล้างข้อมูล
    //   การล็อกอินเก็บไว้ใน AsyncStorage ชื่อ nestyk.auth.session.v1 (lib/auth/session-storage.ts บรรทัด 17)
    //   ตอนเปิด แอปเรียก /auth/sync ด้วยการล็อกอินที่เก็บไว้ ถ้าสำเร็จจึงคงการล็อกอิน (AuthContext.tsx บรรทัด 95 ถึง 119)
    await startApp({ clearData: false });
    await welcome.enter();

    // ขั้นที่ 3: เห็นหน้าของนายหน้า ไม่ใช่หน้า login (ขั้นที่ 34: 0.6 วินาทีหลังแตะหน้าต้อนรับ)
    await home.waitUntilShown();
    expect(await login.isShown()).toBe(false);
  });

  it('signs out from App Settings and lands on the guest home', async () => {
    // ขั้นที่ 1: ล็อกอิน (ขั้นเตรียม)
    await loginAsDevAgent();

    // ขั้นที่ 2: เปิดเมนู แล้วเปิดแผงตั้งค่าแอป แผงต้องแสดงอีเมลของบัญชีที่ล็อกอินอยู่ (MobileAccountSettingsBody.tsx บรรทัด 235)
    await openAppSettings();
    assert.ok(await readUntil(() => settings.showsEmail(env.devLoginEmail), true), 'แผงตั้งค่าแอปไม่แสดงอีเมลที่ตรงกับ E2E_DEV_LOGIN_EMAIL');

    // ขั้นที่ 3: แตะออกจากระบบ (ปุ่มอยู่นอกจอ ไฟล์หน้าจอเลื่อนจอให้ก่อน)
    //   แอปเปิดหน้าต่างแจ้ง หัวเรื่อง "ออกจากระบบ" ข้อความ "ออกจากระบบแล้ว" (index.tsx บรรทัด 1281)
    //   ข้อจำกัด: ถ้าการออกจากระบบล้มเหลว แอปก็แสดงหน้าต่างเดียวกันและพาไปหน้าของผู้เยี่ยมชมเหมือนกัน (index.tsx บรรทัด 1282 ถึง 1288)
    //   ข้อนี้จึงยืนยันได้แค่สิ่งที่ผู้ใช้เห็น ส่วนการลบการล็อกอินที่เก็บไว้ ยืนยันในข้อถัดไป
    await settings.signOut();
    expect((await waitForAlert(ALERT_WAIT_MS)).texts).toEqual([labels.signOut, labels.signedOut]);

    // ขั้นที่ 4: ปิดหน้าต่างแจ้ง แล้วเห็นหน้าของผู้เยี่ยมชมที่แท็บหน้าแรก และไม่เห็นส่วนใดของหน้าของนายหน้าแล้ว
    //   (index.tsx บรรทัด 1279 ถึง 1280: ตั้งบทบาทเป็น guest และเปิดแท็บแรกของ guest ขั้นที่ 34: 0.2 วินาทีหลังปิดหน้าต่าง)
    //   แอปเปลี่ยนบทบาทก่อนเปิดหน้าต่างแจ้ง เมื่อหน้าของผู้เยี่ยมชมขึ้นแล้ว หน้าของนายหน้าต้องหายไปแล้ว จึงอ่านครั้งเดียวโดยไม่รอ
    await acceptAlert();
    await guest.waitUntilShown();
    expect(await readUntil(() => guest.isHomeTabSelected(), true)).toBe(true);
    expect(await home.isShown()).toBe(false);
  });

  it('asks for login again after a restart that follows the sign-out', async () => {
    // ขั้นที่ 1: ล็อกอิน (ขั้นเตรียม)
    await loginAsDevAgent();

    // ขั้นที่ 2: ออกจากระบบแบบเดียวกับข้อก่อน (ข้อความของหน้าต่างแจ้งตรวจในข้อก่อนแล้ว ข้อนี้แค่ปิด)
    await openAppSettings();
    await settings.signOut();
    await waitForAlert(ALERT_WAIT_MS);
    await acceptAlert();
    await guest.waitUntilShown();

    // ขั้นที่ 3: ปิดแล้วเปิดแอปใหม่โดยไม่ล้างข้อมูล การออกจากระบบลบการล็อกอินที่เก็บไว้แล้ว (AuthContext.tsx บรรทัด 180 ถึง 191)
    //   แอปที่บทบาทตั้งต้นต้องล็อกอินและไม่มีการล็อกอินเก็บไว้ จะพาไปหน้า login (index.tsx บรรทัด 507 ถึง 528)
    //   ระวัง: ถ้าตอนเปิดแอปใหม่ /auth/sync ไม่สำเร็จด้วยเหตุใดก็ตาม แอปก็ล้างการล็อกอินแล้วไปหน้า login เหมือนกัน (AuthContext.tsx บรรทัด 107 ถึง 111)
    //   จึงตรวจว่า API ตอบ /health ทั้งก่อนเปิดแอปใหม่และหลังเห็นหน้า login เพื่อลดโอกาสที่หน้า login จะมาจาก API ไม่ตอบ
    //   (ยังพิสูจน์ไม่ได้ทั้งหมดว่าแอปไม่ได้เรียก /auth/sync แล้วล้มเหลว ดูข้อจำกัดใน README หัวข้อ "ชุด session")
    await requireApi();
    await startApp({ clearData: false });
    await welcome.enter();
    await login.waitUntilShown();
    expect(await home.isShown()).toBe(false);
    await requireApi();
  });
});
