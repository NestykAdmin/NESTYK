'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useLocale } from '@nestyk/i18n';
import { ErrorState } from '../../../components/guest/GuestStates';

/** The public API could not be reached on the first render (as the room page, review R2). */
export default function AreasError() {
  const { t } = useLocale();
  const states = t.guest.states;
  const here = usePathname() || '/';
  return (
    <div className="nk-page" data-testid="areasPage.error">
      <ErrorState title={states.errorTitle} body={states.errorBody} retry={{ label: states.retry, href: here }} />
    </div>
  );
}
