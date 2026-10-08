/**
 * การเปิดและปิดแอปของชุดเทส
 *
 * ทำไมต้องเริ่มทุกเทสจากแอปที่ "เปิดใหม่และไม่มีข้อมูลค้าง":
 *   แอปเก็บ 2 อย่างไว้ในเครื่อง คือภาษาที่ผู้ใช้เลือก (AsyncStorage ชื่อ @nestyk/preferred_locale)
 *   และการล็อกอิน (AsyncStorage ชื่อ nestyk.auth.session.v1) ถ้าไม่ล้าง ผลของเทสข้อหนึ่งจะไปเปลี่ยนจุดเริ่มต้นของข้อถัดไป
 *   ที่มา: apps/consumer-app/lib/locale-storage.ts บรรทัด 4 และ lib/auth/session-storage.ts บรรทัด 17
 *
 * ทำไมชุดเทสสั่งภาษาเอง:
 *   ถ้าผู้ใช้ไม่เคยเลือกภาษา แอปใช้ภาษาของเครื่อง (app/_layout.tsx บรรทัด 73 ถึง 81) เครื่องจำลองแต่ละเครื่องตั้งภาษาไม่เหมือนกัน
 *   ชุดเทสจึงส่งค่าภาษาให้แอปตอนเปิด ด้วยตัวเลือกมาตรฐานของ iOS (-AppleLanguages) ซึ่งมีผลเฉพาะการเปิดครั้งนั้น ไม่แก้ค่าของเครื่องจำลอง
 */
import { env, IOS_LOCALE, type AppLanguage } from '../config/env';

/** สถานะของแอปที่ XCTest รายงาน: 4 = กำลังทำงานและอยู่หน้าสุด (XCUIApplicationStateRunningForeground) */
const APP_RUNNING_IN_FOREGROUND = 4;

/** ช่วงเวลาระหว่างการถามสถานะของแอปซ้ำ (มิลลิวินาที) ค่าเดียวกับการถามหน้าจอซ้ำใน src/screens/locators.ts */
const POLL_INTERVAL_MS = 250;

/**
 * ตัวเลือกตอนเปิดแอปที่บอก iOS ว่าให้แอปเห็นภาษาของเครื่องเป็นภาษาไหน
 * เป็นชุดเดียวกับที่ตัวขับ iOS ของ Appium ส่งให้แอปเมื่อตั้ง appium:language กับ appium:locale
 * (ที่มา: appium-xcuitest-driver 12.15.0 ไฟล์ build/lib/commands/wda/startup.js บรรทัด 280 ถึง 286)
 */
function languageArguments(language: AppLanguage): string[] {
  return ['-AppleLanguages', `(${language})`, '-NSLanguages', `(${language})`, '-AppleLocale', IOS_LOCALE[language]];
}

export interface StartAppOptions {
  /** true = ล้างข้อมูลที่แอปเก็บไว้ในเครื่องก่อนเปิด (ภาษาที่เลือก และการล็อกอิน) */
  clearData: boolean;
  /** ภาษาของเครื่องที่แอปจะเห็นตอนเปิด ถ้าไม่ระบุใช้ค่า E2E_APP_LANGUAGE */
  deviceLanguage?: AppLanguage;
}

/**
 * ปิดแอป (ล้างข้อมูลถ้าสั่ง) แล้วเปิดใหม่ จบเมื่อแอปอยู่หน้าสุด
 * หลังเรียกฟังก์ชันนี้ แอปจะอยู่ที่หน้าต้อนรับเสมอ เพราะแอปแสดงหน้าต้อนรับทุกครั้งที่เปิดใหม่
 */
export async function startApp(options: StartAppOptions): Promise<void> {
  const bundleId = env.bundleId;
  const language = options.deviceLanguage ?? env.appLanguage;

  // mobile: terminateApp = ปิดแอป (ถ้าแอปไม่ได้เปิดอยู่ คำสั่งนี้ไม่ทำอะไร)
  await browser.execute('mobile: terminateApp', { bundleId });
  if (options.clearData) {
    // mobile: clearApp = ลบไฟล์ข้อมูลของแอปในเครื่องจำลอง (ใช้ได้เฉพาะเครื่องจำลอง) ตัวแอปยังลงอยู่
    //   คำสั่งนี้คืน true เมื่อมีไฟล์ถูกลบ และ false เมื่อไม่มีอะไรให้ลบ ทั้ง 2 แบบแปลว่าไม่มีข้อมูลค้าง จึงไม่ใช้ค่าที่คืนมา
    //   ถ้าลบไม่สำเร็จ ตัวขับแจ้งเป็นข้อผิดพลาด ซึ่งทำให้เทสแดงตรงนี้
    //   (ที่มา: appium-xcuitest-driver 12.15.0 ไฟล์ build/lib/commands/app-management.js ฟังก์ชัน mobileClearApp)
    await browser.execute('mobile: clearApp', { bundleId });
  }
  // mobile: launchApp = เปิดแอปพร้อมตัวเลือกตอนเปิด
  await browser.execute('mobile: launchApp', { bundleId, arguments: languageArguments(language) });

  // mobile: queryAppState = ถามสถานะของแอป รอจนแอปอยู่หน้าสุดจึงเริ่มสั่งงานหน้าจอ
  await browser.waitUntil(
    async () => {
      // ชนิดข้อมูลของ execute ใน WebdriverIO ออกแบบไว้สำหรับสคริปต์ของหน้าเว็บ จึงรับผลเป็น unknown แล้วแปลงเป็นตัวเลขเอง
      const state: unknown = await browser.execute('mobile: queryAppState', { bundleId });
      return Number(state) === APP_RUNNING_IN_FOREGROUND;
    },
    {
      timeout: env.appReadyWaitMs,
      interval: POLL_INTERVAL_MS,
      timeoutMsg: `แอป ${bundleId} ไม่ขึ้นมาอยู่หน้าสุดภายใน ${env.appReadyWaitMs / 1000} วินาทีหลังสั่งเปิด`,
    },
  );
}
