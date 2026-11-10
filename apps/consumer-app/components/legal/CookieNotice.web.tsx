import React, { useEffect, useRef, useState } from 'react';
import { useLocale } from '@nestyk/i18n';
import { useMobileTheme } from '@nestyk/ui/native';
import {
  COOKIE_SETTINGS_HREF,
  type CookieChoice,
  onCookieConsentChange,
  onCookieSettingsOpen,
  readCookieConsent,
  saveCookieConsent,
} from '@nestyk/ui/cookie-consent';
import { COOKIES_HREF } from '../../lib/cookie-notice';
import './cookie-notice.css';

const NONE: CookieChoice = { preferences: false, maps: false };
const ALL: CookieChoice = { preferences: true, maps: true };

/**
 * PDPA cookie bar (project-docs/nestyk-cookie-consent-plan-20261109.md; Mos 9 Nov 2026 17:08). Shows until the user
 * chooses; it does not block the page. "Accept all" and "Necessary only" look the same (equal choice). "Settings"
 * lists the categories: necessary (always on), preferences, Google Maps. Links to COOKIE_SETTINGS_HREF (footers, the
 * privacy page) open the settings again, so a choice can be changed at any time. Asks again when
 * COOKIE_CONSENT_VERSION changes. Bottom left, clear of the bottom-centre form buttons and bottom-right toasts.
 */
export function CookieNotice() {
  const { t } = useLocale();
  const { isDark } = useMobileTheme();
  const copy = t.legal.cookieNotice;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'choice' | 'settings'>('choice');
  const [draft, setDraft] = useState<CookieChoice>(NONE);
  const [chosen, setChosen] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    const current = () => {
      const saved = readCookieConsent();
      return saved ? { preferences: saved.preferences, maps: saved.maps } : NONE;
    };
    const openSettings = () => {
      setDraft(current());
      setChosen(readCookieConsent() !== null);
      setView('settings');
      setOpen(true);
    };
    if (!readCookieConsent()) setOpen(true);
    if (window.location.hash === COOKIE_SETTINGS_HREF) openSettings();
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest?.(`a[href="${COOKIE_SETTINGS_HREF}"]`)) return;
      event.preventDefault();
      openSettings();
    };
    document.addEventListener('click', onClick);
    const offOpen = onCookieSettingsOpen(openSettings);
    // A choice made elsewhere (the map's "Show map" button, another tab) closes the first-visit bar.
    const offChange = onCookieConsentChange(() => {
      if (readCookieConsent() && viewRef.current === 'choice') setOpen(false);
    });
    return () => {
      document.removeEventListener('click', onClick);
      offOpen();
      offChange();
    };
  }, []);

  if (!open) return null;

  const choose = (choice: CookieChoice) => {
    saveCookieConsent(choice);
    setOpen(false);
  };
  const categories = [
    { id: 'necessary' as const, on: true, locked: true },
    { id: 'preferences' as const, on: draft.preferences, locked: false },
    { id: 'maps' as const, on: draft.maps, locked: false },
  ];

  return (
    <section
      className="ck-notice"
      role="region"
      aria-label={copy.label}
      data-theme={isDark ? 'dark' : 'light'}
      data-view={view}
      data-testid="cookieNotice"
    >
      {view === 'choice' ? (
        <p className="ck-text">
          {copy.text}{' '}
          <a href={COOKIES_HREF} target="_blank" rel="noopener" data-testid="cookieNotice.learnMore">
            {copy.learnMore}
          </a>
        </p>
      ) : (
        <>
          <div className="ck-head">
            <h2 className="ck-title">{copy.settingsTitle}</h2>
            {chosen ? (
              <button
                type="button"
                className="ck-close"
                aria-label={copy.close}
                onClick={() => setOpen(false)}
                data-testid="cookieNotice.close"
              >
                ×
              </button>
            ) : null}
          </div>
          <ul className="ck-list">
            {categories.map((category) => {
              const text = copy.categories[category.id];
              return (
                <li key={category.id}>
                  <label className="ck-row">
                    <input
                      type="checkbox"
                      checked={category.on}
                      disabled={category.locked}
                      onChange={(event) => {
                        if (category.id === 'necessary') return;
                        const checked = event.currentTarget.checked;
                        setDraft((d) => ({ ...d, [category.id]: checked }));
                      }}
                      data-testid={`cookieNotice.${category.id}`}
                    />
                    <span className="ck-row-text">
                      <span className="ck-row-title">
                        {text.title}
                        {category.locked ? <span className="ck-badge">{copy.alwaysOn}</span> : null}
                      </span>
                      <span className="ck-hint">{text.text}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <a className="ck-more" href={COOKIES_HREF} target="_blank" rel="noopener" data-testid="cookieNotice.learnMore">
            {copy.learnMore}
          </a>
        </>
      )}
      <div className="ck-actions">
        {view === 'choice' ? (
          <>
            <button type="button" className="ck-btn" onClick={() => choose(ALL)} data-testid="cookieNotice.acceptAll">
              {copy.acceptAll}
            </button>
            <button type="button" className="ck-btn" onClick={() => choose(NONE)} data-testid="cookieNotice.necessaryOnly">
              {copy.necessaryOnly}
            </button>
            <button
              type="button"
              className="ck-link"
              onClick={() => {
                setDraft(NONE);
                setView('settings');
              }}
              data-testid="cookieNotice.settings"
            >
              {copy.settings}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="ck-btn" onClick={() => choose(draft)} data-testid="cookieNotice.save">
              {copy.save}
            </button>
            <button type="button" className="ck-btn" onClick={() => choose(ALL)} data-testid="cookieNotice.acceptAll">
              {copy.acceptAll}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
