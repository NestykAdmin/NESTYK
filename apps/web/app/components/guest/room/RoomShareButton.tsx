'use client';

import React, { useEffect, useState } from 'react';
import { useLocale } from '@nestyk/i18n';

const ShareIcon = ({ size = 18 }: { size?: number }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13" />
  </svg>
);

/** Share the page: the phone's share sheet where there is one, otherwise copy the link and say so. */
export function RoomShareButton({ title, variant }: { title: string; variant: 'text' | 'icon' }) {
  const { t } = useLocale();
  const copy = t.guest.room;
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), 3000);
    return () => window.clearTimeout(timer);
  }, [status]);
  const share = async () => {
    const url = window.location.href;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setStatus(copy.linkCopied);
    } catch (error) {
      // The person closed the share sheet: nothing to say.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setStatus(copy.copyFailed);
    }
  };
  return (
    <>
      <button
        type="button"
        className={variant === 'icon' ? 'nk-rp-round' : 'nk-rp-action'}
        aria-label={variant === 'icon' ? copy.shareLabel : undefined}
        onClick={share}
        data-testid={variant === 'icon' ? 'roomPage.shareIcon' : 'roomPage.share'}
      >
        <ShareIcon />
        {variant === 'text' ? copy.share : null}
      </button>
      <span role="status" className={status ? 'nk-rp-share-status' : 'nk-sr-only'}>
        {status}
      </span>
    </>
  );
}
