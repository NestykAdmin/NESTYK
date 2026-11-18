import React from 'react';
import { useLocale, fillTemplate } from '@nestyk/i18n';
import { useMobileTheme } from '@nestyk/ui/native';
import { legalHref, supportMailto } from '../../lib/legal-footer';
import { COOKIE_SETTINGS_HREF } from '../../lib/cookie-notice';
import './legal.css';

/**
 * F3 (footer plan): one line under the sign-in / register / reset forms. Document links open in a new tab so a
 * half-filled form is kept. `tone="photo"` (default): light text on a dark pill over the photo. `tone="plain"`: grey
 * text with no pill, for the white sheet on phones (sign-in redesign, Mos 17 Nov 2026).
 */
export function AuthLegalFooter({
  testID = 'auth.footer',
  tone = 'photo',
}: {
  testID?: string;
  tone?: 'photo' | 'plain';
}) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.legal.footer;
  return (
    <nav className={tone === 'plain' ? 'lg-auth-footer lg-auth-footer--plain' : 'lg-auth-footer'} aria-label={copy.label} data-testid={testID}
      // Plain: the theme's secondary text, so it reads on a light or dark sheet (review R7).
      style={tone === 'plain' ? { color: theme.textSecondary } : undefined}>
      <span className="lg-item">{fillTemplate(copy.copyright, { year: new Date().getFullYear() })}</span>
      <span className="lg-item">
        <span aria-hidden className="lg-dot">·</span>
        <a href={legalHref('privacy')} target="_blank" rel="noopener" data-testid={`${testID}.privacy`}>{copy.privacy}</a>
      </span>
      <span className="lg-item">
        <span aria-hidden className="lg-dot">·</span>
        <a href={legalHref('terms')} target="_blank" rel="noopener" data-testid={`${testID}.terms`}>{copy.terms}</a>
      </span>
      <span className="lg-item">
        <span aria-hidden className="lg-dot">·</span>
        <a href={COOKIE_SETTINGS_HREF} data-testid={`${testID}.cookies`}>{copy.cookies}</a>
      </span>
      <span className="lg-item">
        <span aria-hidden className="lg-dot">·</span>
        <a href={supportMailto('NESTYK')} data-testid={`${testID}.help`}>{copy.help}</a>
      </span>
    </nav>
  );
}
