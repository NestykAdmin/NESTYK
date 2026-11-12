import React from 'react';
import { useLocale } from '@nestyk/i18n';
import { useMobileTheme } from '@nestyk/ui/native';
import { CookieConsentPanel } from '@nestyk/ui/cookie-consent-panel';
import '@nestyk/ui/cookie-consent.css';
import { COOKIES_HREF } from '../../lib/cookie-notice';
import './cookie-notice.css';

/**
 * PDPA cookie consent on the agent / account web: the shared panel (design B, project-docs/
 * nestyk-cookie-consent-b-code-plan-20261112.md) with this web's colours (cookie-notice.css) and theme.
 * Card bottom left on wide screens; at <= 1024px a bar across the bottom that keeps the page clear of itself.
 */
export function CookieNotice() {
  const { t } = useLocale();
  const { isDark } = useMobileTheme();
  return (
    <CookieConsentPanel
      copy={t.legal.cookieNotice}
      learnMoreHref={COOKIES_HREF}
      site="agent"
      theme={isDark ? 'dark' : 'light'}
    />
  );
}
