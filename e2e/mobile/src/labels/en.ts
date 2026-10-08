/**
 * ข้อความภาษาอังกฤษของแอปที่ชุดเทสใช้
 * ที่มา: packages/i18n/src/locales/en.ts (อ่านที่ commit 0b7682c) คอมเมนต์ท้ายบรรทัดคือชื่อ key ในไฟล์นั้น
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
    signupUnavailable: 'Registration is not available in this version yet.', // mobile.auth.signupUnavailable
    resetUnavailable: 'Password recovery is not available in this version yet.', // mobile.auth.resetUnavailable
  },
  settings: {
    language: 'Language', // mobile.settings.language
  },
};
