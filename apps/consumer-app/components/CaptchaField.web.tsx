import React, { useEffect, useRef, useState } from 'react';
import { captchaSiteKey } from '../lib/auth/captcha-site-key';

// Bot check on sign-in, sign-up and password forms: Cloudflare Turnstile (replaced hCaptcha, Jom 12 Nov 2026).

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string | undefined;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/**
 * Turnstile's widget height. The widget is "flexible": it fills the form's width like the inputs (300px at least).
 * The box is not clipped or rounded: the widget is Cloudflare's iframe with its own square border, so rounding it cut
 * the border off at the corners (Jom, 12 Nov 2026). Its height is a minimum so a test key's notice line is not cut.
 */
export const WIDGET_HEIGHT = 65;

let scriptPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('Turnstile failed to load'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export type CaptchaAppearance = 'always' | 'interaction-only';

/**
 * Browser widget. Turnstile checks the page hostname, so the site key must allow it (nestyk.com covers its
 * subdomains). Local development uses Cloudflare's test site key, which works on any host including localhost.
 *
 * `appearance="interaction-only"` (sign-in redesign, Mos 17 Nov 2026): the box takes no space while Turnstile checks
 * in the background, and only opens when Cloudflare asks the person to click.
 */
export function CaptchaField({
  resetKey,
  onToken,
  appearance = 'always',
  onFailed,
}: {
  resetKey: number;
  onToken: (token: string | null) => void;
  appearance?: CaptchaAppearance;
  /** Called when there is no token any more (expired, error, timeout), so the form can stop waiting. */
  onFailed?: () => void;
}) {
  const siteKey = captchaSiteKey();
  const host = useRef<HTMLDivElement | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const onFailedRef = useRef(onFailed);
  onFailedRef.current = onFailed;
  const hidden = appearance === 'interaction-only';
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    if (!siteKey || !host.current) return;
    let cancelled = false;
    let widgetId: string | undefined;
    setInteractive(false);
    // No token any more (expired, error, timeout): tell the form, so a waiting press stops and the next one restarts.
    const clear = () => {
      onTokenRef.current(null);
      onFailedRef.current?.();
    };
    loadTurnstile()
      .then(() => {
        if (cancelled || !host.current || !window.turnstile) return;
        host.current.replaceChildren();
        widgetId = window.turnstile.render(host.current, {
          sitekey: siteKey,
          // Always English, whatever the browser language (Mos, 4 Nov 2026).
          language: 'en',
          theme: 'light',
          size: 'flexible',
          appearance,
          callback: (token: string) => onTokenRef.current(token || null),
          'before-interactive-callback': () => setInteractive(true),
          'after-interactive-callback': () => setInteractive(false),
          'expired-callback': clear,
          'error-callback': clear,
          'timeout-callback': clear,
        });
      })
      .catch(clear);
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, resetKey, appearance]);

  if (!siteKey) return null;
  // Hidden: Turnstile keeps its iframe at zero size until it needs a click, so the box only drops its own room.
  const open = !hidden || interactive;
  return (
    <div data-testid="captcha-slot" style={open ? { width: '100%', marginTop: 10, marginBottom: 4 } : { width: '100%' }}>
      <div ref={host} style={open ? { width: '100%', minHeight: WIDGET_HEIGHT } : { width: '100%' }} />
    </div>
  );
}
