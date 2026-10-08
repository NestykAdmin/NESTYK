/**
 * ข้อความของแอปที่ชุดเทสใช้ มี 2 หน้าที่
 * 1) ใช้เป็นข้อความที่คาดว่าผู้ใช้ต้องเห็น (เทสเลือกภาษาด้วย labelsFor)
 * 2) ใช้หาชิ้นส่วนบนหน้าจอ ระหว่างที่แอปยังไม่มี testID (ไฟล์หน้าจอใช้ inEveryLanguage ดู src/screens/locators.ts)
 *
 * ทำไมไม่ดึงข้อความจาก packages/i18n ของแอปตรง ๆ:
 *   ถ้าเทสอ่านค่าที่คาดจากโค้ดที่กำลังถูกเทส เมื่อมีคนแก้ข้อความผิด เทสจะผ่านตามไปด้วย
 *   ชุดเทสจึงเก็บข้อความของตัวเอง และจดไว้ว่าแต่ละค่ามาจาก key ไหน เมื่อทีมตั้งใจแก้ข้อความ ต้องแก้ที่นี่ด้วย
 */
import type { AppLanguage } from '../config/env';
import { th } from './th';
import { en } from './en';

/** ผู้ให้บริการบัญชีภายนอกที่มีปุ่มบนหน้า login ที่มา: apps/consumer-app/app/login.tsx บรรทัด 372 */
export const SOCIAL_PROVIDERS = ['Google', 'Facebook', 'Apple'] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

/** ภาษาที่เลือกได้ในแผ่นเลือกภาษา ที่มา: packages/ui/src/components/MobileLanguagePickerBody.tsx บรรทัด 9 */
export const LANGUAGE_OPTIONS = ['th', 'en', 'zh', 'ja'] as const;
export type LanguageOption = (typeof LANGUAGE_OPTIONS)[number];

export interface Labels {
  /** ภาษาของชุดข้อความนี้ */
  locale: AppLanguage;
  preload: {
    /** ชื่อกำกับของปุ่มหน้าต้อนรับเมื่อพร้อมให้แตะ */
    tapToEnter: string;
  };
  auth: {
    loginTitle: string;
    loginSubtitle: string;
    email: string;
    password: string;
    passwordPlaceholder: string;
    showPassword: string;
    hidePassword: string;
    forgotPassword: string;
    loginButton: string;
    signUp: string;
    /** ชื่อกำกับของปุ่มบัญชีภายนอก มี {provider} เป็นที่แทนชื่อผู้ให้บริการ */
    socialLogin: string;
    requiredFields: string;
    invalidCredentials: string;
    unavailable: string;
    signupUnavailable: string;
    resetUnavailable: string;
  };
  settings: {
    language: string;
  };
}

/**
 * ชื่อภาษาในแผ่นเลือกภาษา เหมือนกันทุกภาษาของแอป จึงเก็บไว้ชุดเดียว
 * ที่มา: mobile.settings.languageNames ใน packages/i18n/src/locales/th.ts และ en.ts บรรทัด 144 ถึง 149
 */
export const LANGUAGE_NAMES: Record<LanguageOption, string> = {
  th: 'ไทย',
  en: 'English',
  zh: '中文',
  ja: '日本語',
};

const ALL: Record<AppLanguage, Labels> = { th, en };

/** ข้อความของแอปในภาษาที่ระบุ ใช้เป็นค่าที่คาดในเทส */
export function labelsFor(language: AppLanguage): Labels {
  return ALL[language];
}

/**
 * ข้อความเดียวกันในทุกภาษาที่ชุดเทสรู้จัก ใช้เป็นข้อความกำกับสำหรับหาชิ้นส่วน
 * เหตุผล: การ "หาชิ้นส่วน" ต้องไม่ขึ้นกับภาษาที่แอปกำลังแสดง (เหมือนการหาด้วย testID)
 *   ส่วนการตรวจว่า "แอปแสดงภาษาถูกไหม" เป็นหน้าที่ของ expect ในไฟล์เทส ซึ่งอ่านข้อความจริงบนจอมาเทียบ
 * ตัวอย่าง: inEveryLanguage((labels) => labels.auth.loginButton) ได้ ['เข้าสู่ระบบ', 'Log in']
 */
export function inEveryLanguage(pick: (labels: Labels) => string): string[] {
  return [...new Set(Object.values(ALL).map(pick))];
}

/** ชื่อกำกับของปุ่มบัญชีภายนอกของผู้ให้บริการที่ระบุ เช่น "เข้าสู่ระบบด้วย Google" */
export function socialLoginLabel(labels: Labels, provider: SocialProvider): string {
  return labels.auth.socialLogin.replace('{provider}', provider);
}
