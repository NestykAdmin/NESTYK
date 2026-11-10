import React from 'react';
import type { LegalCopy } from '@nestyk/i18n';
import { NestykLogo } from '../components/NestykLogo';
import { tokens } from '../theme/tokens';

/**
 * F2 public footer (nestyk-web-footer-plan.md, F-Q3 Mos 4 Nov 2026): one footer for the public web pages of
 * apps/web (WebPageLayout `footer` prop) and the guest pages of consumer-app (web only). DOM only, no hooks:
 * copy and links come in as props so each app passes its own i18n and its own URLs.
 */
export interface PublicFooterLinks {
  search: string;
  services: string;
  register: string;
  login: string;
  privacy: string;
  terms: string;
  /** PDPA cookie settings link (e.g. "#cookie-settings", which the consumer web cookie bar opens). Optional. */
  cookies?: string;
}

export interface PublicFooterProps {
  copy: LegalCopy['footer'];
  links: PublicFooterLinks;
  supportEmail: string;
  lineOaId: string;
  lineOaUrl: string;
  /** Logo of the host app. Default: the DOM logo (Next.js). Expo web passes MobileNestykLogo (its images are asset ids). */
  brand?: React.ReactNode;
  /** Language picker of the host app (public pages have no workspace header). */
  languageSlot?: React.ReactNode;
  year?: number;
  /** Open the document pages in a new tab (default true) so a form in progress is not lost. */
  legalInNewTab?: boolean;
}

// Next.js sets --font-noto-sans-thai; Expo web registers the font as "NotoSansThai_400Regular".
const FONT = 'var(--font-noto-sans-thai, "NotoSansThai_400Regular"), "Noto Sans Thai", sans-serif';

/** Layout that needs a media query (inline styles cannot): 4 columns, 2 on narrow screens with the brand on top. */
const LAYOUT_CSS = `
.nk-pf-columns { display: grid; grid-template-columns: minmax(200px, 1.4fr) repeat(3, minmax(140px, 1fr)); gap: 24px; padding-bottom: 24px; }
.nk-pf-item { white-space: nowrap; }
.nk-pf a:hover, .nk-pf a:focus-visible { text-decoration: underline; }
@media (max-width: 760px) {
  .nk-pf-columns { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px 16px; }
  .nk-pf-brand { grid-column: 1 / -1; }
}
`;

const styles: Record<string, React.CSSProperties> = {
  footer: {
    borderTop: `1px solid ${tokens.colors.border}`,
    backgroundColor: '#FFFFFF',
    color: tokens.colors.textSecondary,
    fontFamily: FONT,
    fontSize: 13,
    lineHeight: 1.6,
  },
  inner: { maxWidth: 1200, margin: '0 auto', padding: '32px 24px 20px' },
  heading: { margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: tokens.colors.primary },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 },
  link: { color: tokens.colors.textSecondary, textDecoration: 'none' },
  muted: { color: tokens.colors.textSecondary, opacity: 0.7 },
  tagline: { margin: '10px 0 0', maxWidth: 240 },
  bottom: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 16,
    borderTop: `1px solid ${tokens.colors.border}`,
  },
  bottomLinks: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 8px' },
  dot: { opacity: 0.5, marginRight: 8 },
};

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in values ? String(values[key]) : m));
}

export const PublicFooter: React.FC<PublicFooterProps> = ({
  copy,
  links,
  supportEmail,
  lineOaId,
  lineOaUrl,
  brand,
  languageSlot,
  year = new Date().getFullYear(),
  legalInNewTab = true,
}) => {
  const legalTarget = legalInNewTab ? { target: '_blank', rel: 'noopener' } : {};
  return (
    <footer className="nk-pf" style={styles.footer} aria-label={copy.label} data-testid="public.footer">
      <style>{LAYOUT_CSS}</style>
      <div style={styles.inner}>
        <div className="nk-pf-columns">
          <div className="nk-pf-brand">
            <a href="/" aria-label="NESTYK" style={styles.link}>
              {brand ?? <NestykLogo variant="wordmark" height={28} />}
            </a>
            <p style={styles.tagline}>{copy.tagline}</p>
          </div>
          <nav aria-label={copy.findRoom}>
            <p style={styles.heading}>{copy.findRoom}</p>
            <ul style={styles.list}>
              <li><a href={links.search} style={styles.link}>{copy.searchRooms}</a></li>
              <li><a href={links.services} style={styles.link}>{copy.services}</a></li>
            </ul>
          </nav>
          <nav aria-label={copy.forAgents}>
            <p style={styles.heading}>{copy.forAgents}</p>
            <ul style={styles.list}>
              <li><a href={links.register} style={styles.link} data-testid="public.footer.register">{copy.agentSignUp}</a></li>
              <li><a href={links.login} style={styles.link}>{copy.signIn}</a></li>
            </ul>
          </nav>
          <nav aria-label={copy.help}>
            <p style={styles.heading}>{copy.help}</p>
            <ul style={styles.list}>
              <li><a href={`mailto:${supportEmail}`} style={styles.link}>{fill(copy.helpEmail, { email: supportEmail })}</a></li>
              <li><a href={lineOaUrl} target="_blank" rel="noopener" style={styles.link}>{fill(copy.helpLine, { id: lineOaId })}</a></li>
              <li style={styles.muted}>{copy.faq} · {copy.comingSoon}</li>
            </ul>
          </nav>
        </div>
        <div style={styles.bottom}>
          <div style={styles.bottomLinks}>
            <span className="nk-pf-item">{fill(copy.copyright, { year })}</span>
            {/* Each "· link" stays together so a wrapped line never ends with a lone dot. */}
            <span className="nk-pf-item">
              <span style={styles.dot} aria-hidden>·</span>
              <a href={links.privacy} {...legalTarget} style={styles.link} data-testid="public.footer.privacy">{copy.privacy}</a>
            </span>
            <span className="nk-pf-item">
              <span style={styles.dot} aria-hidden>·</span>
              <a href={links.terms} {...legalTarget} style={styles.link} data-testid="public.footer.terms">{copy.terms}</a>
            </span>
            {links.cookies ? (
              <span className="nk-pf-item">
                <span style={styles.dot} aria-hidden>·</span>
                <a href={links.cookies} {...legalTarget} style={styles.link} data-testid="public.footer.cookies">{copy.cookies}</a>
              </span>
            ) : null}
          </div>
          {languageSlot ? <div aria-label={copy.language}>{languageSlot}</div> : null}
        </div>
      </div>
    </footer>
  );
};
