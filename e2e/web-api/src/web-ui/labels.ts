/**
 * ข้อความบนหน้าเว็บ consumer-app ที่ชุดเทส UI ใช้หาชิ้นส่วนและเป็นค่าที่คาด
 *
 * ที่มา: packages/i18n/src/locales/ ที่ qa/e2e 648dd28 (merge pre/dev/review 9821d87) คอมเมนต์ท้ายบรรทัดคือ key กับเลขบรรทัด
 *   ค่าทั้งหมดตรวจด้วยการโหลดไฟล์ locale จริงแล้วเทียบค่าตาม key (ห้องทดลอง 4 พ.ย. 2026 และตรวจซ้ำที่ 648dd28 เมื่อ 6 พ.ย. 2026)
 * ชุดเทสเก็บข้อความเอง ไม่ import จากโค้ดของแอป แบบเดียวกับชุด e2e/mobile (src/labels/)
 *   เหตุผลของชุดนี้: ถ้าทีมแก้ข้อความ เทสต้องแดงให้เห็น ไม่ใช่เปลี่ยนตามเงียบ ๆ และ tsconfig ของชุดนี้ไม่รวมโค้ดนอก e2e/web-api
 *
 * ชุดเทสเปิดเว็บเป็นภาษาอังกฤษ: fixture ตั้ง localStorage '@nestyk/preferred_locale' = 'en' ก่อนโหลดหน้า
 *   (apps/consumer-app/lib/locale-storage.ts:4 และ AsyncStorage บนเว็บเก็บใน localStorage ด้วยชื่อเดียวกัน)
 */

export const EN = {
  // packages/i18n/src/locales/en.ts (mobile.auth.*)
  email: 'Email', // mobile.auth.email :365 (aria-label ของช่องอีเมลในหน้า login, register และ reset-password)
  password: 'Password', // mobile.auth.password :366
  confirmPassword: 'Confirm password', // mobile.auth.confirmPassword :322
  loginButton: 'Log in', // mobile.auth.loginButton :313
  registerButton: 'Create account', // mobile.auth.registerButton :323
  invalidEmail: 'Enter a valid email address.', // mobile.auth.invalidEmail :331
  passwordRules: 'Use at least 8 characters with a number, a lowercase letter and an uppercase letter.', // mobile.auth.passwordRules :333
  acceptTerms: 'I accept the terms of use and the privacy policy.', // mobile.auth.acceptTerms :335 (aria-label ของช่องติ๊กยินยอม)
  acceptTermsRequired: 'Accept the terms of use and the privacy policy.', // mobile.auth.acceptTermsRequired :336
  passwordMismatch: 'The passwords do not match.', // mobile.auth.passwordMismatch :342
  resetSend: 'Send link', // mobile.auth.resetSend :355 (บั๊กข้อ 6 แก้แล้ว เดิม "Send code")
  /** ลิงก์ที่ตรวจกับ Supabase ไม่ผ่าน ตอนกดบันทึกรหัสใหม่ (reset-password.tsx:124, :135) */
  resetLinkInvalid: 'This link has expired or was already used, so your password was not changed. Tap "Back to login", then "Forgot password?" to get a new link.', // mobile.auth.resetLinkInvalid :357
  /** ลิงก์ที่ถูกตัดหรือแก้ (ไม่มี token) หรือ ?code= ที่ล็อกอินไม่ได้ ตอนเปิดหน้า (reset-password.tsx:31, :65) */
  resetLinkBroken: 'This link does not work. Enter your email and tap "Send link" to get a new one.', // mobile.auth.resetLinkBroken :358
  resetNewTitle: 'Set a new password', // mobile.auth.resetNewTitle :359 (เป็นทั้งหัวเรื่องและข้อความบนปุ่มบันทึก)
  sessionExpired: 'Your session has expired. Please sign in again.', // mobile.auth.sessionExpired :371
  firstName: 'First Name', // mobile.account.firstName :235
  lastName: 'Last Name', // mobile.account.lastName :236
  phone: 'Phone Number', // mobile.account.phone :238 (aria-label ของช่องเบอร์ใน PhoneField.tsx:74)

  // บทบาทและ workspace
  signOut: 'Sign Out', // common.signOut :21 (ปุ่มในเมนูบัญชี AgentWorkspace.web.tsx:866-873)
  roleTenant: 'Tenant', // roles.tenant :29
  roleLandlord: 'Landlord', // roles.landlord :30
  roleAgent: 'Agent', // roles.agent :31
  account: 'Your account', // agent.dashboard.webWorkspace.account :2060 (aria-label ของ summary เมนูบัญชี)
  close: 'Close', // agent.dashboard.webWorkspace.close :2064 (ปุ่มปิดของ WebDialog.tsx:55)
  create: 'Create', // agent.dashboard.webWorkspace.create :2067 (aria-label ของปุ่มเปิดเมนู Create)
  comingSoon: 'Coming soon', // agent.dashboard.comingSoon :2215
  navDashboard: 'Dashboard', // mobile.tabs.dashboard :57 (เมนูข้างของนายหน้า menuLabel ใน AgentWorkspace.web.tsx:243-244)
  navLeads: 'Leads', // mobile.tabs.listingLead :61
  navCalendar: 'Calendar', // agent.dashboard.openCalendar :2203
  // การ์ดหน้าแรกของบทบาท (app/index.tsx:1135-1166 ใช้ร่วมกันทุกบทบาท) บั๊กข้อ 8 แก้แล้วที่ 648dd28: หัวข้อมาจาก i18n และไม่มีตัวเลขสมมติ
  adminHomeTitle: 'Admin home', // mobile.roleHome.adminTitle :49
  roleHomeComingSoon: 'Coming soon', // mobile.roleHome.comingSoon :50 (ข้อความในการ์ดของ admin: index.tsx:1141)

  // packages/i18n/src/locales/web-session/en.ts
  idleTitle: 'Are you still there?', // idleTitle :9
  idleSignOut: 'Sign out', // idleSignOut :12
  idleStay: 'Stay signed in', // idleStay :11
  signOutAll: 'Sign out of all devices', // signOutAll :4
  signOutAllTitle: 'Sign out of all devices?', // signOutAllTitle :5
} as const;

/**
 * ข้อความของการ์ดแอดมินก่อนแก้บั๊กข้อ 8 (เขียนไว้ในโค้ด app/index.tsx:1092 ที่ efab8d0 ไม่ผ่าน i18n) ใช้ตรวจว่าไม่กลับมา
 * ที่ 648dd28 ตัวเลข "Pending tickets: 3" เหลือแค่ในคอมเมนต์ index.tsx:1134 ส่วน "Operations Dashboard" ไม่อยู่ใน index.tsx แล้ว
 */
export const RETIRED_ADMIN = {
  title: 'Operations Dashboard',
  summary: 'Pending tickets: 3 · Inspections today: 2',
} as const;

/** ข้อความดิบจาก API และ Supabase ที่ไม่ควรถึงผู้ใช้ (บั๊กข้อ 7) ข้อความมาจาก API/ไลบรารี ไม่อยู่ใน locales */
export const RAW_ERRORS = {
  /** API: RolesGuard ตอบ 403 (ผลเทสด้วยมือ 4 พ.ย. 2026 หน้า /landlord/income ด้วย qa-tenant) */
  requiredRoleLandlord: 'Required role: landlord',
  /** supabase-js เมื่อ updateUser โดยไม่มี session (ผลเทสด้วยมือ 4 พ.ย. 2026 หน้า reset-password ข้อ 4) */
  authSessionMissing: 'Auth session missing!',
} as const;

/** ข้อความที่ต่างกันตามภาษา สำหรับเทสสลับภาษาบนหน้า privacy (LegalPage.web.tsx) */
export type Locale = 'th' | 'en' | 'ja' | 'zh';
export const LOCALES: readonly Locale[] = ['th', 'en', 'ja', 'zh'];

export const LEGAL: Record<Locale, { draftBadge: string; privacyTitle: string; footerPrivacy: string }> = {
  // packages/i18n/src/locales/legal/<ภาษา>.ts : page.draftBadge / privacy.title / footer.privacy
  en: { draftBadge: 'Draft · under review', privacyTitle: 'Privacy Policy', footerPrivacy: 'Privacy Policy' }, // en.ts :29 / :40 / :7
  th: { draftBadge: 'ร่าง · รอตรวจ', privacyTitle: 'นโยบายความเป็นส่วนตัว', footerPrivacy: 'นโยบายความเป็นส่วนตัว' }, // th.ts :33 / :44 / :10
  ja: { draftBadge: '草案・確認中', privacyTitle: 'プライバシーポリシー', footerPrivacy: 'プライバシーポリシー' }, // ja.ts :29 / :40 / :7
  zh: { draftBadge: '草稿 · 待审核', privacyTitle: '隐私政策', footerPrivacy: '隐私政策' }, // zh.ts :29 / :39 / :7
};

/** จำนวนหัวข้อของเอกสาร (ทั้ง 4 ภาษาเท่ากัน นับ { id: ... } ใน packages/i18n/src/locales/legal/*.ts) */
export const LEGAL_SECTION_COUNT = { privacy: 8, terms: 10 } as const;

/** ปุ่มขั้นอีเมลของหน้าลืมรหัสผ่านภาษาไทย: packages/i18n/src/locales/th.ts:355 mobile.auth.resetSend ที่ qa/e2e 648dd28 */
export const TH_RESET_SEND = 'ส่งลิงก์';
/** ข้อความเดิมของปุ่มขั้นอีเมลก่อนแก้บั๊กข้อ 6 (ระบบส่งลิงก์ ไม่ได้ส่งรหัส) ใช้ตรวจว่าไม่กลับมา */
export const RETIRED_RESET_SEND = { en: 'Send code', th: 'ส่งรหัส' } as const;
/** aria-label ของช่องอีเมลภาษาไทย: packages/i18n/src/locales/th.ts:365 mobile.auth.email */
export const TH_EMAIL = 'อีเมล';

/** ข้อความของหน้าไม่พบของ expo-router 6.0.24 (node_modules/expo-router/build/views/Unmatched.js:55) */
export const UNMATCHED_ROUTE = 'Unmatched Route';
