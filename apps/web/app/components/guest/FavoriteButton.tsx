import React from 'react';
import { guestAccountUrl } from '../../../lib/guest-site';
import { HeartIcon } from './GuestIcons';

/**
 * Heart on a room card (S3.1). Saving rooms is not built yet (S4.5), so for now it takes the guest to the central
 * sign-in (Mos 11 Nov 2026, H3), which is where saved rooms will live.
 */
export function FavoriteButton({ label }: { label: string }) {
  return (
    <a href={guestAccountUrl('signIn')} className="nk-fav" aria-label={label} title={label} data-testid="roomCard.save">
      <HeartIcon size={20} />
    </a>
  );
}
