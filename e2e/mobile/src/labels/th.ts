/**
 * ข้อความภาษาไทยของแอปที่ชุดเทสใช้
 * ที่มา: packages/i18n/src/locales/th.ts (อ่านที่ commit 0b7682c และเทียบซ้ำด้วยสคริปต์ที่ develop bc77a8b เมื่อ 2 พ.ย. 2026 แล้วตรงทุก key และทุกข้อความ) คอมเมนต์ท้ายบรรทัดคือชื่อ key ในไฟล์นั้น
 */
import type { Labels } from './index';

export const th: Labels = {
  locale: 'th',
  preload: {
    tapToEnter: 'แตะเพื่อเข้าใช้งาน', // mobile.preload.tapToEnter
  },
  auth: {
    loginTitle: 'ยินดีต้อนรับ', // mobile.auth.loginTitle
    loginSubtitle: 'เข้าสู่ระบบบัญชี NESTYK ของคุณ', // mobile.auth.loginSubtitle
    email: 'อีเมล', // mobile.auth.email
    password: 'รหัสผ่าน', // mobile.auth.password
    passwordPlaceholder: 'กรอกรหัสผ่าน', // mobile.auth.passwordPlaceholder
    showPassword: 'แสดงรหัสผ่าน', // mobile.auth.showPassword
    hidePassword: 'ซ่อนรหัสผ่าน', // mobile.auth.hidePassword
    forgotPassword: 'ลืมรหัสผ่าน?', // mobile.auth.forgotPassword
    loginButton: 'เข้าสู่ระบบ', // mobile.auth.loginButton
    signUp: 'สมัครสมาชิก', // mobile.auth.signUp
    socialLogin: 'เข้าสู่ระบบด้วย {provider}', // mobile.auth.socialLogin
    requiredFields: 'กรุณากรอกอีเมลและรหัสผ่าน', // mobile.auth.requiredFields
    invalidCredentials: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', // mobile.auth.invalidCredentials
    unavailable: 'ยังไม่เปิดให้เข้าสู่ระบบด้วยช่องทางนี้ กรุณาใช้อีเมลและรหัสผ่าน', // mobile.auth.unavailable
    registrationTitle: 'สร้างบัญชีของคุณ', // mobile.auth.registrationTitle (อ่านเองที่ pre/dev/review 0f99388 บรรทัด 307 ไม่ได้เทียบด้วยสคริปต์)
    resetTitle: 'ลืมรหัสผ่าน', // mobile.auth.resetTitle (อ่านเองที่ pre/dev/review 0f99388 บรรทัด 342 ไม่ได้เทียบด้วยสคริปต์)
    resetSend: 'ส่งรหัส', // mobile.auth.resetSend (อ่านเองที่ pre/dev/review 0f99388 บรรทัด 343 ไม่ได้เทียบด้วยสคริปต์)
    backToLogin: 'กลับไปเข้าสู่ระบบ', // mobile.auth.backToLogin (อ่านเองที่ pre/dev/review 0f99388 บรรทัด 315 ไม่ได้เทียบด้วยสคริปต์)
    invalidEmail: 'กรอกอีเมลให้ถูกต้อง', // mobile.auth.invalidEmail (เทียบด้วยสคริปต์ที่ qa/e2e d5f9773 เมื่อ 5 พ.ย. 2026)
    registrationRequiredFields: 'กรอกชื่อ นามสกุล เบอร์โทร อีเมล รหัสผ่าน และยืนยันรหัสผ่านให้ครบ', // mobile.auth.registrationRequiredFields (เทียบด้วยสคริปต์ที่ d5f9773)
    registerButton: 'สร้างบัญชี', // mobile.auth.registerButton (เทียบด้วยสคริปต์ที่ d5f9773)
  },
  settings: {
    language: 'ภาษา', // mobile.settings.language
  },
};
