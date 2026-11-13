'use client';

import React, { forwardRef, useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { accountUrlWithNext, guestAccountOrigin } from '../../../lib/guest-site';

type Props = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { page: 'signIn' | 'register' };

/**
 * Sign-in / sign-up link that brings the guest back to the page they are on (AUTH-1.4,
 * nestyk-guest-session-plan-20261112.md). The server renders the plain link (it cannot see the query);
 * the browser adds ?next= after hydration, after client-side page changes, and again right before the
 * click, because the search page changes its query in place (history.replaceState).
 */
export const AccountLink = forwardRef<HTMLAnchorElement, Props>(function AccountLink(
  { page, onClick, onFocus, onPointerDown, ...rest },
  ref,
) {
  const pathname = usePathname();
  const origin = guestAccountOrigin();
  const [href, setHref] = useState(() => accountUrlWithNext(page, origin, null));
  const current = useCallback(
    () => accountUrlWithNext(page, origin, window.location.pathname + window.location.search),
    [page, origin],
  );

  useEffect(() => {
    setHref(current());
  }, [current, pathname]);

  return (
    <a
      ref={ref}
      {...rest}
      href={href}
      onPointerDown={(event) => {
        setHref(current());
        onPointerDown?.(event);
      }}
      onFocus={(event) => {
        setHref(current());
        onFocus?.(event);
      }}
      onClick={(event) => {
        event.currentTarget.href = current();
        onClick?.(event);
      }}
    />
  );
});
