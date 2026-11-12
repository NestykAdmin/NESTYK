import React, { useEffect, useRef } from 'react';
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

/** Turnstile's "normal" widget size. */
const WIDGET = { width: 300, height: 65 };

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

/**
 * Browser widget. Turnstile checks the page hostname, so the site key must allow it (nestyk.com covers its
 * subdomains). Local development uses Cloudflare's test site key, which works on any host including localhost.
 */
export function CaptchaField({
  resetKey,
  onToken,
}: {
  resetKey: number;
  onToken: (token: string | null) => void;
}) {
  const siteKey = captchaSiteKey();
  const host = useRef<HTMLDivElement | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!siteKey || !host.current) return;
    let cancelled = false;
    let widgetId: string | undefined;
    const clear = () => onTokenRef.current(null);
    loadTurnstile()
      .then(() => {
        if (cancelled || !host.current || !window.turnstile) return;
        host.current.replaceChildren();
        widgetId = window.turnstile.render(host.current, {
          sitekey: siteKey,
          // Always English, whatever the browser language (Mos, 4 Nov 2026).
          language: 'en',
          theme: 'light',
          size: 'normal',
          callback: (token: string) => onTokenRef.current(token || null),
          'expired-callback': clear,
          'error-callback': clear,
          'timeout-callback': clear,
        });
        const frame = host.current.querySelector('iframe');
        if (frame instanceof HTMLIFrameElement) {
          frame.style.display = 'block';
          frame.style.borderRadius = '12px';
        }
      })
      .catch(clear);
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, resetKey]);

  if (!siteKey) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%', marginTop: 10, marginBottom: 4 }}>
      <div ref={host} style={{ ...WIDGET, borderRadius: 12, overflow: 'hidden' }} />
    </div>
  );
}
