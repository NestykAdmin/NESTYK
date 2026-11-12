/**
 * ข้อความภาษาอังกฤษของแอปที่ชุดเทสใช้
 * ที่มา: packages/i18n/src/locales/en.ts (อ่านที่ commit 0b7682c และเทียบซ้ำด้วยสคริปต์ที่ develop bc77a8b เมื่อ 2 พ.ย. 2026 แล้วตรงทุก key และทุกข้อความ) คอมเมนต์ท้ายบรรทัดคือชื่อ key ในไฟล์นั้น
 */
import type { Labels } from './index';

export const en: Labels = {
  locale: 'en',
  preload: {
    tapToEnter: 'Tap to enter', // mobile.preload.tapToEnter
  },
  auth: {
    loginTitle: 'Welcome', // mobile.auth.loginTitle
    loginSubtitle: 'Log in to your NESTYK account', // mobile.auth.loginSubtitle
    email: 'Email', // mobile.auth.email
    password: 'Password', // mobile.auth.password
    passwordPlaceholder: 'Enter your password', // mobile.auth.passwordPlaceholder
    showPassword: 'Show password', // mobile.auth.showPassword
    hidePassword: 'Hide password', // mobile.auth.hidePassword
    forgotPassword: 'Forgot password?', // mobile.auth.forgotPassword
    loginButton: 'Log in', // mobile.auth.loginButton
    signUp: 'Sign up', // mobile.auth.signUp
    socialLogin: 'Continue with {provider}', // mobile.auth.socialLogin
    requiredFields: 'Enter your email and password.', // mobile.auth.requiredFields
    invalidCredentials: 'Invalid email or password', // mobile.auth.invalidCredentials
    unavailable: 'This sign-in option is not available yet. Please use email and password.', // mobile.auth.unavailable
    registrationTitle: 'Create your account', // mobile.auth.registrationTitle (อ่านเองที่ pre/dev/review 0f99388 บรรทัด 307 ไม่ได้เทียบด้วยสคริปต์)
    resetTitle: 'Forgot password', // mobile.auth.resetTitle (อ่านเองที่ pre/dev/review 0f99388 บรรทัด 342 ไม่ได้เทียบด้วยสคริปต์)
    resetSend: 'Send link', // mobile.auth.resetSend (อ่านเองที่ qa/e2e 92c19dc บรรทัด 359 ไม่ได้เทียบด้วยสคริปต์ ; ทีมเปลี่ยนจาก 'Send code' ที่ 66b48e8 เมื่อ 4 พ.ย. 2026)
    backToLogin: 'Back to login', // mobile.auth.backToLogin (อ่านเองที่ pre/dev/review 0f99388 บรรทัด 315 ไม่ได้เทียบด้วยสคริปต์)
    invalidEmail: 'Enter a valid email address.', // mobile.auth.invalidEmail (เทียบด้วยสคริปต์ที่ qa/e2e d5f9773 เมื่อ 5 พ.ย. 2026)
    registrationRequiredFields: 'Enter your first name, last name, phone, email, password and password confirmation.', // mobile.auth.registrationRequiredFields (เทียบด้วยสคริปต์ที่ d5f9773)
    registerButton: 'Create account', // mobile.auth.registerButton (เทียบด้วยสคริปต์ที่ d5f9773)
  },
  settings: {
    language: 'Language', // mobile.settings.language
  },
};
