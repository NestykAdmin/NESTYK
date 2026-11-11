'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLocale } from '@nestyk/i18n';
import {
  COOKIE_SETTINGS_HREF,
  type CookieChoice,
  onCookieConsentChange,
  onCookieSettingsOpen,
  readCookieConsent,
  saveCookieConsent,
} from '@nestyk/ui/cookie-consent';
import { guestAccountUrl } from '../../../lib/guest-site';

const NONE: CookieChoice = { preferences: false, maps: false };
const ALL: CookieChoice = { preferences: true, maps: true };

/**
 * PDPA cookie bar of the guest web (S2.10). Same rules and storage as the consumer-app bar
 * (apps/consumer-app/components/legal/CookieNotice.web.tsx, project-docs/nestyk-cookie-consent-plan-20261109.md):
 * - shows until the user chooses and does not block the page;
 * - "Accept all" and "Necessary only" look the same (equal choice);
 * - links to COOKIE_SETTINGS_HREF ("ตั้งค่าคุกกี้" in the footer and the profile page) open the settings again;
 * - asks again when COOKIE_CONSENT_VERSION changes.
 * The choice is kept in this browser only, per site (nestyk.com and agent.nestyk.com ask separately).
 */
export function GuestCookieBar() {
  const { t } = useLocale();
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
      setChosen(readCookieConsent()?.complete === true);
      setView('settings');
      setOpen(true);
    };
    // Asks until the bar is answered; the map's "Show map" alone (complete: false) does not count as the answer.
    if (!readCookieConsent()?.complete) setOpen(true);
    if (window.location.hash === COOKIE_SETTINGS_HREF) openSettings();
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest?.(`a[href="${COOKIE_SETTINGS_HREF}"]`)) return;
      event.preventDefault();
      openSettings();
    };
    document.addEventListener('click', onClick);
    const offOpen = onCookieSettingsOpen(openSettings);
    const offChange = onCookieConsentChange(() => {
      if (readCookieConsent()?.complete && viewRef.current === 'choice') setOpen(false);
    });
    return () => {
      document.removeEventListener('click', onClick);
      offOpen();
      offChange();
    };
  }, []);

  if (!open) return null;

  const learnMoreHref = guestAccountUrl('cookies');
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
    <section className="nk-cookie" role="region" aria-label={copy.label} data-view={view} data-testid="cookieNotice">
      {view === 'choice' ? (
        <p>
          {copy.text}{' '}
          <a href={learnMoreHref} target="_blank" rel="noopener" data-testid="cookieNotice.learnMore">
            {copy.learnMore}
          </a>
        </p>
      ) : (
        <>
          <div className="nk-cookie__head">
            <h2 className="nk-cookie__title">{copy.settingsTitle}</h2>
            {chosen ? (
              <button
                type="button"
                className="nk-cookie__close"
                aria-label={copy.close}
                onClick={() => setOpen(false)}
                data-testid="cookieNotice.close"
              >
                ×
              </button>
            ) : null}
          </div>
          <ul className="nk-cookie__list">
            {categories.map((category) => {
              const text = copy.categories[category.id];
              return (
                <li key={category.id}>
                  <label className="nk-cookie__row">
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
                    <span className="nk-cookie__row-text">
                      <span className="nk-cookie__row-title">
                        {text.title}
                        {category.locked ? <span className="nk-soon">{copy.alwaysOn}</span> : null}
                      </span>
                      <span className="nk-cookie__hint">{text.text}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <a href={learnMoreHref} target="_blank" rel="noopener" data-testid="cookieNotice.learnMore">
            {copy.learnMore}
          </a>
        </>
      )}
      <div className="nk-cookie__actions">
        {view === 'choice' ? (
          <>
            <button type="button" className="nk-cookie__btn" onClick={() => choose(ALL)} data-testid="cookieNotice.acceptAll">
              {copy.acceptAll}
            </button>
            <button type="button" className="nk-cookie__btn" onClick={() => choose(NONE)} data-testid="cookieNotice.necessaryOnly">
              {copy.necessaryOnly}
            </button>
            <button
              type="button"
              className="nk-cookie__link"
              onClick={() => {
                const saved = readCookieConsent();
                setDraft(saved ? { preferences: saved.preferences, maps: saved.maps } : NONE);
                setView('settings');
              }}
              data-testid="cookieNotice.settings"
            >
              {copy.settings}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="nk-cookie__btn" onClick={() => choose(draft)} data-testid="cookieNotice.save">
              {copy.save}
            </button>
            <button type="button" className="nk-cookie__btn" onClick={() => choose(ALL)} data-testid="cookieNotice.acceptAll">
              {copy.acceptAll}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
