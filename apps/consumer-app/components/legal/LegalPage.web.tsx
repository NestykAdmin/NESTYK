import React, { useEffect } from 'react';
import { fillTemplate, useLocale, type SupportedLocale } from '@nestyk/i18n';
import { PublicFooter } from '@nestyk/ui/public-footer';
import { MobileNestykLogo } from '@nestyk/ui/native';
import { loginPathFor } from '../../lib/app-routes';
import { SUPPORT_EMAIL, SUPPORT_LINE_OA, legalHref, lineOaUrl } from '../../lib/legal-footer';
import type { LegalPageProps } from './LegalPage.types';
import './legal.css';

const LOCALES: SupportedLocale[] = ['th', 'en', 'zh', 'ja'];

/**
 * /privacy and /terms (footer plan section 3, board W21 in design-drafts/v5). Public, no login.
 * F-Q1 (Mos 4 Nov 2026): there is no real text yet, so the page shows the draft outline from i18n (`legal.*`)
 * under a "Draft · under review" banner. Replace the section bodies once the team has checked the real text.
 */
export function LegalPage({ page }: LegalPageProps) {
  const { t, locale, setLocale } = useLocale();
  const copy = t.legal;
  const doc = copy[page];
  const other = page === 'privacy' ? 'terms' : 'privacy';
  const values = { email: SUPPORT_EMAIL };

  useEffect(() => {
    if (typeof document !== 'undefined') document.title = `${doc.title} · NESTYK`;
  }, [doc.title]);

  return (
    <div className="lg-root" data-testid={`legal.${page}`}>
      <header className="lg-top">
        <a href="/" className="lg-brand" aria-label="NESTYK">
          <MobileNestykLogo variant="wordmark" height={28} />
        </a>
        <label className="lg-lang">
          <span className="lg-sr">{t.mobile.settings.language}</span>
          <select
            value={locale}
            onChange={(event) => setLocale(event.target.value as SupportedLocale)}
            data-testid="legal.language"
          >
            {LOCALES.map((code) => (
              <option key={code} value={code}>
                {t.mobile.settings.languageNames[code]}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="lg-layout">
        <nav className="lg-toc" aria-label={copy.page.contents}>
          <p className="lg-toc-title">{copy.page.contents}</p>
          <ol>
            {doc.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <main className="lg-main">
          <p className="lg-draft" role="note" data-testid="legal.draft">
            <strong>{copy.page.draftBadge}</strong> {fillTemplate(copy.page.draftNotice, values)}
          </p>
          <h1>{doc.title}</h1>
          <div className="lg-meta">
            <span>{fillTemplate(copy.page.lastUpdated, { date: copy.page.updatedOn })}</span>
            <button type="button" className="lg-print" onClick={() => window.print()} data-testid="legal.print">
              {copy.page.print}
            </button>
          </div>
          <p className="lg-intro">{doc.intro}</p>
          {/* Narrow screens: the side contents list is hidden, this one is folded so the text comes first. */}
          <details className="lg-toc-mobile" data-testid="legal.contentsMobile">
            <summary>{copy.page.contents}</summary>
            <ol>
              {doc.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.title}</a>
                </li>
              ))}
            </ol>
          </details>
          {doc.sections.map((section, index) => (
            <section key={section.id} id={section.id} className="lg-section">
              <h2>
                {index + 1}. {section.title}
              </h2>
              <p>{fillTemplate(section.body, values)}</p>
            </section>
          ))}
          <p className="lg-other">
            <a href={legalHref(other)} data-testid={`legal.other.${other}`}>
              {fillTemplate(copy.page.otherDoc, { doc: copy.footer[other] })}
            </a>
            <span aria-hidden> · </span>
            <a href="/">{copy.page.home}</a>
          </p>
        </main>
      </div>

      <PublicFooter
        copy={copy.footer}
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
        legalInNewTab={false}
      />
    </div>
  );
}
