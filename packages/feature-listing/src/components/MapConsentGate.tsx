import React, { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocale } from '@nestyk/i18n';
import { allowCookieCategory, cookieConsentAllows, onCookieConsentChange } from '@nestyk/ui/cookie-consent';

/** True once the user allowed the Google Maps cookie category (web). Starts false so a server render shows the gate. */
export function useMapsConsent(): boolean {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    const sync = () => setAllowed(cookieConsentAllows('maps'));
    sync();
    return onCookieConsentChange(sync);
  }, []);
  return allowed;
}

/**
 * PDPA cookie plan (Mos 9 Nov 2026): Google's map script loads only after the user allows the "Google Maps" category.
 * Until then a box of the map's size says why and offers "Show map", which allows maps only: every other answer stays
 * as it was, and if the cookie bar was not answered yet it still asks (QA 10 Nov 2026). Web only: imported by the
 * .web map components.
 */
export function MapConsentGate({
  children,
  style,
  testID = 'mapConsent',
}: {
  children: ReactNode;
  style?: CSSProperties;
  testID?: string;
}) {
  const { t } = useLocale();
  const copy = t.legal.cookieNotice;
  const allowed = useMapsConsent();
  if (allowed) return <>{children}</>;
  const show = () => allowCookieCategory('maps');
  return (
    <div
      data-testid={testID}
      style={{
        width: '100%',
        minHeight: 160,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: 16,
        borderRadius: 12,
        border: '1px dashed rgba(100, 116, 139, 0.45)',
        background: 'rgba(148, 163, 184, 0.12)',
        textAlign: 'center',
        ...style,
      }}
    >
      <p style={{ margin: 0, maxWidth: 360, color: '#64748B', fontSize: 13, lineHeight: '20px' }}>{copy.mapOff}</p>
      <button
        type="button"
        onClick={show}
        data-testid={`${testID}.show`}
        style={{
          minHeight: 36,
          padding: '0 16px',
          border: 0,
          borderRadius: 999,
          background: '#F8B615',
          color: '#211E1E',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {copy.mapShow}
      </button>
    </div>
  );
}
