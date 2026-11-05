import React, { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { usePathname } from 'expo-router';
import { useLocale } from '@nestyk/i18n';
import { NARROW_BANNER_DISMISSED_KEY, showNarrowWebBanner } from '../../lib/narrow-web';
import './narrow-banner.css';

function readDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(NARROW_BANNER_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Role pages on a screen narrower than 768 px: "use the NESTYK app" (lib/narrow-web.ts). Closing it hides it for this
 * browser tab until the tab is closed. Mounted once in app/_layout.tsx.
 */
export function NarrowWebBanner() {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { t } = useLocale();
  const [dismissed, setDismissed] = useState(readDismissed);
  const copy = t.webSession;

  if (!showNarrowWebBanner(pathname, width, dismissed)) return null;

  const close = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(NARROW_BANNER_DISMISSED_KEY, '1');
    } catch {
      // Blocked storage: hidden until the page reloads.
    }
  };

  return (
    <div className="nwb-root" role="note" data-testid="narrowWebBanner">
      <div className="nwb-copy">
        <strong>{copy.narrowTitle}</strong>
        <span>{copy.narrowBody}</span>
      </div>
      <button type="button" className="nwb-close" onClick={close} data-testid="narrowWebBanner.close">
        {copy.narrowClose}
      </button>
    </div>
  );
}
