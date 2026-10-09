/**
 * ข้อความภาษาไทยของแอปที่ชุดเทสใช้
 * ที่มา: packages/i18n/src/locales/th.ts (อ่านที่ commit 0b7682c และเทียบซ้ำที่ a6b3b1e แล้วตรงทุก key) คอมเมนต์ท้ายบรรทัดคือชื่อ key ในไฟล์นั้น
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
    signupUnavailable: 'ยังไม่เปิดให้สมัครสมาชิกในเวอร์ชันนี้', // mobile.auth.signupUnavailable
    resetUnavailable: 'ยังไม่เปิดให้กู้คืนรหัสผ่านในเวอร์ชันนี้', // mobile.auth.resetUnavailable
  },
  settings: {
    language: 'ภาษา', // mobile.settings.language
  },
};
