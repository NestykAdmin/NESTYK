import React from 'react';
import { GUEST_SOCIAL, visibleSocialLinks } from '../../../lib/guest-site';
import { SocialIcon } from './GuestIcons';

/** NESTYK social channels (footer and profile). Channels without a real link are not shown. */
export function GuestSocialLinks({ label, className }: { label: string; className?: string }) {
  const links = visibleSocialLinks(GUEST_SOCIAL);
  if (links.length === 0) return null;
  return (
    <nav aria-label={label} className={className ? `nk-social ${className}` : 'nk-social'} data-testid="guest.social">
      {links.map((link) => (
        <a key={link.id} href={link.url} target="_blank" rel="noopener" aria-label={link.label}>
          <SocialIcon id={link.id} />
        </a>
      ))}
    </nav>
  );
}
