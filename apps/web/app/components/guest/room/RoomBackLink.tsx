'use client';

import React from 'react';

/**
 * "กลับไปผลค้นหา" on the room page. When the person came from a search page of this site, go back in history so the
 * filters and scroll stay as they were; otherwise open the search page. A plain link either way (review R1): leaving
 * the room page loads the next page with its own CSP.
 */
export function RoomBackLink({
  href,
  className,
  label,
  children,
}: {
  href: string;
  className: string;
  /** Accessible name when the link shows only an icon. */
  label?: string;
  children: React.ReactNode;
}) {
  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    try {
      const from = document.referrer ? new URL(document.referrer) : null;
      const cameFromSearch =
        from !== null && from.origin === window.location.origin && /^\/(?:(?:en|ja|zh)\/)?search(?:\/|$)/.test(from.pathname);
      if (cameFromSearch && window.history.length > 1) {
        event.preventDefault();
        window.history.back();
      }
    } catch {
      // A referrer we cannot read: follow the link.
    }
  };
  return (
    <a href={href} className={className} aria-label={label} onClick={onClick}>
      {children}
    </a>
  );
}
