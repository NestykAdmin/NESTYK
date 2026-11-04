import React, { useEffect, useRef } from 'react';
import { hcaptchaSiteKey } from '../lib/auth/hcaptcha-site-key';

type HcaptchaApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    hcaptcha?: HcaptchaApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadHcaptcha(): Promise<void> {
  if (window.hcaptcha) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      // Always English, whatever the browser language (Mos, 4 Nov 2026).
      script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit&hl=en';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('hCaptcha failed to load'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/**
 * A real site key on the hostname "localhost" is rejected by hCaptcha before the
 * checkbox works, so the warning covers the box and takes several clicks.
 * 127.0.0.1 is a normal host and the same machine.
 */
function leaveLocalhostHost(): boolean {
  if (window.location.hostname !== 'localhost') return false;
  const next = new URL(window.location.href);
  next.hostname = '127.0.0.1';
  window.location.replace(next.href);
  return true;
}

/** Browser widget. hCaptcha checks the page hostname, so that host must be allowed on the site key. */
export function HcaptchaField({
  resetKey,
  onToken,
}: {
  resetKey: number;
  onToken: (token: string | null) => void;
}) {
  const siteKey = hcaptchaSiteKey();
  const host = useRef<HTMLDivElement | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!siteKey || !host.current || leaveLocalhostHost()) return;
    let cancelled = false;
    let widgetId: string | null = null;
    loadHcaptcha()
      .then(() => {
        if (cancelled || !host.current || !window.hcaptcha) return;
        host.current.replaceChildren();
        widgetId = window.hcaptcha.render(host.current, {
          sitekey: siteKey,
          hl: 'en',
          theme: 'light',
          size: 'normal',
          callback: (token: string) => onTokenRef.current(token || null),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        });
        const frame = host.current.querySelector('iframe');
        if (frame instanceof HTMLIFrameElement) {
          frame.style.display = 'block';
          frame.style.borderRadius = '12px';
        }
      })
      .catch(() => onTokenRef.current(null));
    return () => {
      cancelled = true;
      if (widgetId && window.hcaptcha) window.hcaptcha.remove(widgetId);
    };
  }, [siteKey, resetKey]);

  if (!siteKey) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%', marginTop: 10, marginBottom: 4 }}>
      <div ref={host} style={{ width: 304, height: 78, borderRadius: 12, overflow: 'hidden' }} />
    </div>
  );
}
