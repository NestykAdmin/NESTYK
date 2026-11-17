import type { WebSessionCopy } from './th';

export const webSessionEn: WebSessionCopy = {
  signOutAll: 'Sign out of all devices',
  signOutAllTitle: 'Sign out of all devices?',
  signOutAllBody: 'This account will be signed out on every phone and browser, including this one. You will need to sign in again on each.',
  signOutAllConfirm: 'Sign out of all devices',
  signOutAllFailed: 'Could not sign out of all devices. Check your connection and try again.',
  idleTitle: 'Are you still there?',
  idleBody: 'No activity for almost 8 hours. You will be signed out on this device in {time}.',
  idleStay: 'Stay signed in',
  idleSignOut: 'Sign out',
  noAccessTitle: 'This account cannot use this site yet',
  noAccessBody: '{email} does not have access to this part of NESTYK.',
  noAccessHint: 'Sign in with another account, or contact us if you think this is a mistake.',
  noAccessSignOut: 'Sign in with another account',
  noAccessSupport: 'Contact support',
  noAccessHome: 'Go to home',
  otherSite: 'Other site',
  noAccessOpenRole: 'Go to {role}',
  /** Sign-in redesign (Mos 17 Nov 2026): the note under the sign-in button and its label while Turnstile checks. */
  captchaNote: 'Protected from bots by Cloudflare Turnstile',
  captchaChecking: 'Checking…',
  /** The hidden check gave no token (blocked, error or too slow). */
  captchaFailed: "Couldn't check that you're not a bot. Please try again.",
};
