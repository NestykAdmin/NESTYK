'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useLocale } from '@nestyk/i18n';
import { ErrorState } from '../../../../components/guest/GuestStates';

/**
 * The public API could not be reached when this room page was first rendered (review R2). A later failed regeneration
 * keeps the last good page instead, because the page throws rather than rendering this state itself.
 */
export default function RoomError() {
  const { t } = useLocale();
  const states = t.guest.states;
  const here = usePathname() || '/';
  return (
    <div className="nk-page" data-testid="roomPage.error">
      <ErrorState title={states.errorTitle} body={states.errorBody} retry={{ label: states.retry, href: here }} />
    </div>
  );
}
