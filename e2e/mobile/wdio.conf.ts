/**
 * ค่าตั้งของ WebdriverIO สำหรับเทสแอป NESTYK บน iPhone จำลอง
 *
 * ลำดับการทำงานเมื่อสั่ง npm test
 *   1) WebdriverIO เปิด Appium ของโฟลเดอร์นี้ (node_modules) ให้เอง รับคำสั่งเฉพาะจากเครื่องนี้
 *   2) เปิด session กับแอป NESTYK ที่ลงอยู่ใน iPhone จำลอง (ชุดเทสไม่ได้ลงแอปให้)
 *   3) รันไฟล์ใน tests/ ทีละไฟล์ ใน session เดียวกัน
 *   4) ปิด session และปิด Appium
 */
import { env, resolveSimulatorUdid } from './src/config/env';
import { lookupReport } from './src/screens/locators';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { startApp } from './src/support/app';
import { saveFailureArtifacts } from './src/support/artifacts';
import { runDeviceCheck } from './src/support/device-check';

type LogLevel = NonNullable<WebdriverIO.Config['logLevel']>;

/**
 * เวลาสูงสุด (วินาที) ที่ให้ตัวขับรอแอป "นิ่ง" ก่อนแตะหรือพิมพ์ (ค่าเริ่มต้นของตัวขับคือ 10)
 * ตั้งให้สั้นกว่าค่าเริ่มต้น เพื่อให้หน้าที่ตัวขับมองว่าไม่นิ่งไม่ถ่วงทุกคำสั่งนานเกินไป
 * และยังยาวพอสำหรับภาพเคลื่อนไหวของระบบ เช่น แป้นพิมพ์ที่กำลังเลื่อนขึ้น
 */
const IDLE_WAIT_SECONDS = 2;

/**
 * ค่าที่บอก Appium ว่าจะเทสอะไร บนเครื่องไหน และให้ทำงานแบบไหน (เรียกว่า capabilities)
 * ประกาศแยกเป็นตัวแปร เพราะ appium:wdaBindingIP ยังไม่อยู่ในชนิดข้อมูลของ WebdriverIO 9.32
 * แต่ตัวขับ xcuitest รองรับ และใช้ได้ผลบนเครื่องที่ใช้เทสแล้ว (ขั้นที่ 17 และ 24)
 *
 * ไม่ใส่ appium:language กับ appium:locale โดยตั้งใจ: 2 ค่านี้ทำให้ตัวขับแก้ค่าภาษาของเครื่องจำลองทั้งเครื่อง
 * และอาจเริ่มบริการของเครื่องจำลองใหม่ ชุดเทสจึงส่งภาษาให้เฉพาะแอปตอนสั่งเปิดแทน (src/support/app.ts)
 */
const iosCapabilities: Record<string, unknown> = {
  platformName: 'iOS',
  'appium:automationName': 'XCUITest',
  'appium:udid': resolveSimulatorUdid(),
  'appium:bundleId': env.bundleId,
  // ไม่ให้ Appium ลงแอปใหม่หรือล้างข้อมูลเอง ชุดเทสเป็นคนสั่งล้างข้อมูลก่อนเปิดแอปในแต่ละเทส (src/support/app.ts)
  'appium:noReset': true,
  'appium:forceAppLaunch': true,
  // ถ้าชุดเทสไม่ส่งคำสั่งนานเกินกี่วินาที ให้ Appium ปิด session เอง (กัน session ค้างเมื่อชุดเทสตายกลางทาง)
  // ต้องยาวกว่าช่วงที่นานที่สุดระหว่าง 2 คำสั่ง ซึ่งไม่เกินเวลารอ 40 วินาทีของชุดเทส (ค่าเดียวกับขั้นที่ 24)
  'appium:newCommandTimeout': 180,
  // เริ่ม WebDriverAgent ใหม่ทุก session และปิดเมื่อจบ จะไม่มีของค้างในเครื่อง
  'appium:useNewWDA': true,
  // WebDriverAgent รับคำสั่งเฉพาะจากเครื่องนี้
  'appium:wdaBindingIP': '127.0.0.1',
  // เวลาที่ให้ Xcode สร้างและเปิด WebDriverAgent ต่อ 1 รอบ (มิลลิวินาที) ครั้งแรกหลังติดตั้งต้องสร้างใหม่ทั้งหมด (ค่าเดียวกับขั้นที่ 24)
  'appium:wdaLaunchTimeout': 300_000,
  // ไม่ให้ Appium แก้ค่าการใช้คลิปบอร์ดร่วมกับ Mac ของเครื่องจำลอง
  'appium:simulatorPasteboardAutomaticSync': 'system',
  'appium:showXcodeLog': true,
  // ให้ตัวขับรอแอปนิ่งก่อนแตะหรือพิมพ์ การรอนี้มองไม่เห็นภาพเคลื่อนไหวที่แอปวาดเอง (ขั้นที่ 24: หน้าต้อนรับมีภาพเคลื่อนไหววนอยู่
  // แต่ตัวขับมองว่านิ่ง) ชุดเทสจึงรอให้ชิ้นส่วนหยุดเคลื่อนที่เองอีกชั้นก่อนสั่งงาน (waitUntilSteady ใน src/screens/locators.ts)
  'appium:waitForIdleTimeout': IDLE_WAIT_SECONDS,
};

export const config: WebdriverIO.Config = {
  runner: 'local',
  tsConfigPath: './tsconfig.json',

  // วงเล็บเหลี่ยมซ้อน 2 ชั้น = รันทุกไฟล์ใน session เดียว
  // เหตุผล: เปิด session ใหม่แต่ละครั้ง Xcode ต้องเตรียม WebDriverAgent (แอปผู้ช่วยในเครื่องจำลอง) ซึ่งใช้ราว 15 ถึง 60 วินาที (วัดในขั้นที่ 17 กับ 24)
  specs: [['./tests/**/*.spec.ts']],
  // มีเครื่องจำลองเครื่องเดียว จึงรันทีละ 1 ชุด
  maxInstances: 1,

  capabilities: [iosCapabilities as WebdriverIO.Capabilities],

  // ข้อความละเอียดของ WebdriverIO และของ Appium เก็บลงไฟล์ใน logs/ หน้าจอจึงเหลือแต่ผลเทส
  outputDir: './logs',
  logLevel: (process.env.E2E_WDIO_LOG_LEVEL?.trim() || 'warn') as LogLevel,
  bail: 0,

  // เวลารอมาตรฐานของคำสั่ง waitFor... และ expect ของ WebdriverIO
  waitforTimeout: env.waitMs,
  // เวลารอคำตอบของ Appium ต่อ 1 คำสั่ง ตั้งไว้นานเพราะคำสั่งเปิด session ต้องรอ Xcode เตรียม WebDriverAgent
  connectionRetryTimeout: 600_000,
  // ไม่ส่งคำสั่งซ้ำเอง ถ้าคำสั่งเปิด session ถูกส่งซ้ำ จะได้ session ซ้อนกัน
  connectionRetryCount: 0,

  services: [
    [
      'appium',
      {
        args: {
          // รับคำสั่งเฉพาะจากเครื่องนี้ ไม่เปิดให้เครื่องอื่นในเครือข่ายต่อเข้ามา
          address: '127.0.0.1',
          port: env.appiumPort,
          logNoColors: true,
          logTimestamp: true,
          localTimezone: true,
        },
        // เวลาที่รอให้ Appium พร้อมรับคำสั่ง (มิลลิวินาที) ค่าเริ่มต้นของตัวเปิดคือ 30 วินาที เผื่อไว้สำหรับครั้งแรกที่ Appium ต้องสำรวจตัวขับที่ติดตั้ง
        appiumStartTimeout: 120_000,
      },
    ],
  ],

  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    // เวลาสูงสุดต่อ 1 เทส (มิลลิวินาที รวมการเปิดแอปใหม่ในขั้นเตรียม) เทสปกติจบในไม่กี่วินาที
    // ค่านี้ต้องยาวกว่าเวลารอเปิดแอป 40 วินาที บวกเวลารอหน้าจอ 15 วินาทีอีกหลายจุดในเทสเดียว
    timeout: 120_000,
    // ไม่รันซ้ำเมื่อไม่ผ่าน เทสที่ผ่านบ้างไม่ผ่านบ้างต้องหาสาเหตุ ไม่ใช่กลบด้วยการรันซ้ำ
    retries: 0,
  },

  /** ทำ 1 ครั้งหลังเปิด session: ตรวจเครื่องมือบนเครื่องนี้ ถ้าเปิดใช้ (ไม่ทำให้ชุดเทสผ่านหรือไม่ผ่าน) */
  before: async () => {
    if (!env.deviceCheck) return;
    try {
      await startApp({ clearData: true });
      await new WelcomeScreen().waitUntilReady();
      await runDeviceCheck();
    } catch (error) {
      console.log(`[ตรวจเครื่อง] ทำไม่จบ: ${(error as Error).message.split('\n')[0]}`);
    }
  },

  /** ทำหลังเทสแต่ละข้อ: ถ้าไม่ผ่าน เก็บภาพหน้าจอกับโครงสร้างหน้าจอไว้ดูสาเหตุ */
  afterTest: async (test, _context, result) => {
    if (result.passed) return;
    const saved = await saveFailureArtifacts(test.title);
    for (const file of saved) console.log(`  หลักฐานของเทสที่ไม่ผ่าน: ${file}`);
  },

  /** ทำ 1 ครั้งหลังเทสทั้งหมด: รายงานว่าชิ้นส่วนที่รอบนี้ใช้ หาเจอด้วย testID กี่ชิ้น และยังต้องหาด้วยข้อความกี่ชิ้น */
  after: () => {
    const { byTestId, byLabel } = lookupReport();
    console.log(`[วิธีหาชิ้นส่วน] หาเจอด้วย testID ${byTestId.length} ชิ้น ยังต้องหาด้วยข้อความ ${byLabel.length} ชิ้น`);
    if (byLabel.length > 0) console.log(`[วิธีหาชิ้นส่วน] ชิ้นส่วนที่แอปยังไม่มี testID: ${byLabel.join(', ')}`);
  },
};
