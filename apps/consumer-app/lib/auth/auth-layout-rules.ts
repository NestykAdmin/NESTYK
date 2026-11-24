/**
 * Sign-in page layout rules (mixed design, Mos 17 Nov 2026). Pure functions, tested in auth-layout.test.cjs.
 * - Wider than 768 px: the form is a card on the full photo (design B).
 * - 768 px and below: a photo band on top and the form as a sheet (design A).
 */
export type AuthLayoutMode = 'card' | 'sheet';

/** Narrowest window that gets the card. */
export const AUTH_CARD_MIN_WIDTH = 769;

export function authLayoutMode(width: number): AuthLayoutMode {
  return width >= AUTH_CARD_MIN_WIDTH ? 'card' : 'sheet';
}

/** Less than this hidden by the visual viewport is a toolbar or zoom, not a keyboard. */
export const KEYBOARD_MIN_HEIGHT = 120;

export type KeyboardFrame = {
  open: boolean;
  /** Height of the part of the page the person can see. */
  height: number;
  /** How far the browser scrolled the visible part down (iOS moves it to show the field). */
  top: number;
};

/**
 * Web: the visible part of the page from the layout height and the visual viewport. A pinch zoom (scale above 1)
 * also shrinks the visual viewport, so it never counts as a keyboard (review R6).
 */
export function keyboardFrame(layoutHeight: number, visualHeight: number, offsetTop: number, scale = 1): KeyboardFrame {
  const open = scale <= 1.01 && layoutHeight - visualHeight >= KEYBOARD_MIN_HEIGHT;
  return open ? { open, height: visualHeight, top: offsetTop } : { open, height: layoutHeight, top: 0 };
}

/**
 * Turnstile in "interaction-only" mode gets its token in the background. A press before the token is there waits
 * for it (the button says "checking") instead of telling the person to prove they are human.
 */
/** How long a press waits for Turnstile before it gives up and says so (review R1: a blocked script never answers). */
export const CAPTCHA_WAIT_MS = 20000;

export function captchaSubmitStep(required: boolean, token: string | null): 'submit' | 'wait' {
  return required && !token ? 'wait' : 'submit';
}

/**
 * "Use as a guest" on the sign-in page (Mos 24 Nov 2026). In the phone app anyone can browse the guest pages without
 * signing in, whatever role the build starts with (EXPO_PUBLIC_DEFAULT_ROLE). On the web the link stays tied to a
 * guest-first build, since the guest site there is its own Next.js app.
 */
export function showGuestBrowse(platform: string, defaultRole: string): boolean {
  return platform !== 'web' || defaultRole === 'guest';
}
