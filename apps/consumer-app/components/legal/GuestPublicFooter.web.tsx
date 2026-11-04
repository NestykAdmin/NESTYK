import React from 'react';
import { useLocale } from '@nestyk/i18n';
import { PublicFooter } from '@nestyk/ui/public-footer';
import { MobileNestykLogo } from '@nestyk/ui/native';
import { loginPathFor } from '../../lib/app-routes';
import { SUPPORT_EMAIL, SUPPORT_LINE_OA, legalHref, lineOaUrl } from '../../lib/legal-footer';

/**
 * F2 public footer on the guest web pages (`/`, `/search`, `/services`; footer plan F-Q3). Same footer and links
 * as the document pages (`LegalPage.web.tsx`); privacy and terms open in a new tab so nothing in progress is lost.
 */
export function GuestPublicFooter() {
  const { t } = useLocale();
  return (
    <div data-testid="guest.footer" style={{ marginTop: 32 }}>
      <PublicFooter
        copy={t.legal.footer}
        brand={<MobileNestykLogo variant="wordmark" height={28} />}
        links={{
          search: '/search',
          services: '/services',
          register: '/register',
          login: loginPathFor('/agent'),
          privacy: legalHref('privacy'),
          terms: legalHref('terms'),
        }}
        supportEmail={SUPPORT_EMAIL}
        lineOaId={SUPPORT_LINE_OA}
        lineOaUrl={lineOaUrl()}
      />
    </div>
  );
}
