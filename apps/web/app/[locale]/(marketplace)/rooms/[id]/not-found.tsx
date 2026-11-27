'use client';

import React from 'react';
import { useLocale } from '@nestyk/i18n';
import { EmptyState } from '../../../../components/guest/GuestStates';
import { localePath } from '../../../../../lib/guest-site';

/** A room that is not public (rented, taken down or never existed): the API answers 404 (S7.3). */
export default function RoomNotFound() {
  const { t, locale } = useLocale();
  const copy = t.guest.room;
  return (
    <div className="nk-page" data-testid="roomPage.notFound">
      <EmptyState title={copy.notFoundTitle} body={copy.notFoundText} action={{ label: copy.notFoundCta, href: localePath(locale, '/') }} />
    </div>
  );
}
