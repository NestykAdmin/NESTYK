/** Smaller than any phone keyboard, larger than Safari's address bar growing or shrinking. */
export const KEYBOARD_MIN = 120;

export interface ViewportSize {
  /** window.innerHeight: the page height, which iOS keeps when the keyboard opens. */
  innerHeight: number;
  /** visualViewport.height / offsetTop / scale: the part of the page the guest sees. */
  height: number;
  offsetTop: number;
  scale: number;
}

export interface KeyboardOffset {
  /** Height of the on-screen keyboard (0 when there is none). */
  height: number;
  /** How far a bar fixed to the bottom of the page must go up to sit right above the keyboard. */
  lift: number;
}

/**
 * The on-screen keyboard on /find (Mos 25 Nov 2026, canvas "findsummary"): iOS keeps the page height when the keyboard
 * opens and only the visible area shrinks, so a bar fixed to the bottom of the page sits under the keyboard unless it
 * goes up by `lift`. While the keyboard is open the guest can scroll the visible area down inside the page
 * (offsetTop grows): the keyboard is still open, the bar just goes up less. A zoomed-in page also shrinks the visible
 * area, so it counts as no keyboard.
 */
export function keyboardOffset(viewport: ViewportSize): KeyboardOffset {
  const none = { height: 0, lift: 0 };
  if (Math.abs(viewport.scale - 1) > 0.01) return none;
  const height = Math.round(viewport.innerHeight - viewport.height);
  if (height < KEYBOARD_MIN) return none;
  return { height, lift: Math.max(0, Math.round(viewport.innerHeight - viewport.height - viewport.offsetTop)) };
}
