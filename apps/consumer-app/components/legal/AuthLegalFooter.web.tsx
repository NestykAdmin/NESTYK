import React from 'react';
import { useLocale, fillTemplate } from '@nestyk/i18n';
import { legalHref, supportMailto } from '../../lib/legal-footer';
import './legal.css';

/**
 * F3 (footer plan): one line under the sign-in / register / reset forms. The pages sit on a photo, so the line
 * is light text on a dark pill. Document links open in a new tab so a half-filled form is kept.
 */
export function AuthLegalFooter({ testID = 'auth.footer' }: { testID?: string }) {
  const { t } = useLocale();
  const copy = t.legal.footer;
  return (
    <nav className="lg-auth-footer" aria-label={copy.label} data-testid={testID}>
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
        <a href={supportMailto('NESTYK')} data-testid={`${testID}.help`}>{copy.help}</a>
      </span>
    </nav>
  );
}
