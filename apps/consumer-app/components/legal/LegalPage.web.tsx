import React, { useEffect } from 'react';
import { fillTemplate, useLocale, type SupportedLocale } from '@nestyk/i18n';
import { PublicFooter } from '@nestyk/ui/public-footer';
import { MobileNestykLogo } from '@nestyk/ui/native';
import { loginPathFor } from '../../lib/app-routes';
import { SUPPORT_EMAIL, SUPPORT_LINE_OA, legalHref, lineOaUrl } from '../../lib/legal-footer';
import { BROWSER_STORAGE_ITEMS, COOKIE_SETTINGS_HREF, THIRD_PARTY_SERVICES } from '../../lib/cookie-notice';
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
  // PDPA plan FE2: the privacy page ends with "Cookies and browser storage" (#cookies), also in the contents lists.
  const cookies = page === 'privacy' ? copy.cookies : null;
  const toc = cookies ? [...doc.sections, { id: 'cookies', title: cookies.title }] : doc.sections;

  useEffect(() => {
    if (typeof document !== 'undefined') document.title = `${doc.title} · NESTYK`;
  }, [doc.title]);

  // A link such as "/privacy#cookies" (cookie notice, footers): the page renders after the browser looked for the
  // anchor, so scroll to it once the sections exist.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

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
            {toc.map((section) => (
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
              {toc.map((section) => (
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
          {cookies ? (
            <section id="cookies" className="lg-section lg-cookies" data-testid="legal.cookies">
              <h2>
                {doc.sections.length + 1}. {cookies.title}
              </h2>
              <p>{cookies.intro}</p>
              <h3>{cookies.storageTitle}</h3>
              <div className="lg-table-wrap">
                <table className="lg-table" data-testid="legal.cookies.storage">
                  <thead>
                    <tr>
                      <th scope="col">{cookies.columns.name}</th>
                      <th scope="col">{cookies.columns.purpose}</th>
                      <th scope="col">{cookies.columns.type}</th>
                      <th scope="col">{cookies.columns.kept}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {BROWSER_STORAGE_ITEMS.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <code>{item.name}</code>
                        </td>
                        <td>{cookies.storage[item.id].purpose}</td>
                        <td>{cookies.types[item.type]}</td>
                        <td>{cookies.storage[item.id].kept}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3>{cookies.servicesTitle}</h3>
              <div className="lg-table-wrap">
                <table className="lg-table" data-testid="legal.cookies.services">
                  <thead>
                    <tr>
                      <th scope="col">{cookies.serviceColumns.name}</th>
                      <th scope="col">{cookies.serviceColumns.purpose}</th>
                      <th scope="col">{cookies.serviceColumns.data}</th>
                      <th scope="col">{cookies.serviceColumns.policy}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {THIRD_PARTY_SERVICES.map((service) => (
                      <tr key={service.id}>
                        <td>{service.name}</td>
                        <td>{cookies.services[service.id].purpose}</td>
                        <td>{cookies.services[service.id].data}</td>
                        <td>
                          <a href={service.policyUrl} target="_blank" rel="noopener noreferrer">
                            {cookies.policyLink}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>{cookies.manage}</p>
              <a href={COOKIE_SETTINGS_HREF} className="lg-cookie-settings" data-testid="legal.cookies.settings">
                {cookies.settingsButton}
              </a>
            </section>
          ) : null}
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
          cookies: COOKIE_SETTINGS_HREF,
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
