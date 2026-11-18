'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  COOKIE_SETTINGS_HREF,
  type CookieChoice,
  onCookieConsentChange,
  onCookieSettingsOpen,
  readCookieConsent,
  saveCookieConsent,
} from './cookieConsent';

const NONE: CookieChoice = { preferences: false, maps: false };
const ALL: CookieChoice = { preferences: true, maps: true };
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled])';

type CategoryCopy = { title: string; text: string };

/** The `legal.cookieNotice` copy of @nestyk/i18n (same keys in th / en / ja / zh). */
export interface CookieConsentCopy {
  label: string;
  text: string;
  learnMore: string;
  acceptAll: string;
  necessaryOnly: string;
  settings: string;
  settingsTitle: string;
  settingsIntro: string;
  save: string;
  close: string;
  alwaysOn: string;
  categories: { necessary: CategoryCopy; preferences: CategoryCopy; maps: CategoryCopy };
}

export interface CookieConsentPanelProps {
  copy: CookieConsentCopy;
  learnMoreHref: string;
  /** Which web hosts it: sets the layout breakpoints in cookie-consent.css (guest 960px, agent 1024px). */
  site: 'guest' | 'agent';
  theme?: 'light' | 'dark';
}

const ShieldIcon = () => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
const CloseIcon = () => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/**
 * PDPA cookie consent for both webs (design B, Mos 11 Nov 2026; plan project-docs/nestyk-cookie-consent-b-code-plan-20261112.md).
 * Rules kept from the first bar (project-docs/nestyk-cookie-consent-plan-20261109.md):
 * - the first view asks until the user chooses and never blocks the page;
 * - "Accept all" and "Necessary only" look the same (equal choice); optional categories start unticked;
 * - links to COOKIE_SETTINGS_HREF (footers, /privacy) open the settings again; asks again when the version changes.
 * Settings open as a dialog (bottom sheet on phones) with switches; Esc and the close button work once a choice exists.
 * When the first view is docked to the bottom (cookie-consent.css sets --ck-docked: 1), its height is published as
 * --ck-reserve on <html> so each web can keep the page clear of it. Colours come from --ck-* variables each web sets.
 */
export function CookieConsentPanel({ copy, learnMoreHref, site, theme = 'light' }: CookieConsentPanelProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'choice' | 'settings'>('choice');
  const [draft, setDraft] = useState<CookieChoice>(NONE);
  const [chosen, setChosen] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const barRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const current = () => {
      const saved = readCookieConsent();
      return saved ? { preferences: saved.preferences, maps: saved.maps } : NONE;
    };
    const openSettings = () => {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
    // An answer given in another tab closes the first-visit bar; the map's "Show map" alone does not.
    const offChange = onCookieConsentChange(() => {
      const answered = readCookieConsent()?.complete === true;
      if (answered) setChosen(true);
      if (answered && viewRef.current === 'choice') setOpen(false);
    });
    return () => {
      document.removeEventListener('click', onClick);
      offOpen();
      offChange();
    };
  }, []);

  // Docked first view: publish its height so the page can keep its last buttons and links visible.
  useEffect(() => {
    const root = document.documentElement;
    const bar = barRef.current;
    const clear = () => {
      root.style.removeProperty('--ck-reserve');
      root.classList.remove('ck-reserving');
    };
    if (!open || view !== 'choice' || !bar) {
      clear();
      return undefined;
    }
    const measure = () => {
      const docked = getComputedStyle(bar).getPropertyValue('--ck-docked').trim() === '1';
      const reserve = docked ? Math.max(0, Math.ceil(window.innerHeight - bar.getBoundingClientRect().top)) : 0;
      root.style.setProperty('--ck-reserve', `${reserve}px`);
      root.classList.toggle('ck-reserving', reserve > 0);
    };
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(bar);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      clear();
    };
  }, [open, view]);

  const close = useCallback(() => {
    setOpen(false);
    setView('choice');
    openerRef.current?.focus?.();
  }, []);

  // Settings dialog: focus moves in and stays inside; Esc closes it once a choice exists.
  useEffect(() => {
    if (!open || view !== 'settings') return undefined;
    const dialog = dialogRef.current;
    const items = () => Array.from(dialog?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    (items()[0] ?? dialog)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!chosen) return;
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      const list = items();
      if (!list.length) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      // Focus left the dialog (a click on plain text or the backdrop): bring it back in, never to the page behind.
      if (!dialog?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, view, chosen, close]);

  if (!open) return null;

  const choose = (choice: CookieChoice) => {
    saveCookieConsent(choice);
    setOpen(false);
    setView('choice');
    openerRef.current?.focus?.();
  };
  const openFromBar = () => {
    // Starts from what is already allowed (e.g. maps after "Show map"); nothing ticked otherwise.
    openerRef.current = null;
    const saved = readCookieConsent();
    setDraft(saved ? { preferences: saved.preferences, maps: saved.maps } : NONE);
    setChosen(saved?.complete === true);
    setView('settings');
  };
  const categories = [
    { id: 'necessary' as const, on: true, locked: true },
    { id: 'preferences' as const, on: draft.preferences, locked: false },
    { id: 'maps' as const, on: draft.maps, locked: false },
  ];

  if (view === 'choice') {
    return (
      <section
        ref={barRef}
        className="ck-bar"
        role="region"
        aria-label={copy.label}
        data-site={site}
        data-theme={theme}
        data-view="choice"
        data-testid="cookieNotice"
      >
        <span className="ck-icon">
          <ShieldIcon />
        </span>
        <p className="ck-text">{copy.text}</p>
        <div className="ck-actions">
          <button type="button" className="ck-btn" onClick={() => choose(ALL)} data-testid="cookieNotice.acceptAll">
            {copy.acceptAll}
          </button>
          <button type="button" className="ck-btn" onClick={() => choose(NONE)} data-testid="cookieNotice.necessaryOnly">
            {copy.necessaryOnly}
          </button>
        </div>
        <div className="ck-links">
          <button type="button" className="ck-link" onClick={openFromBar} data-testid="cookieNotice.settings">
            {copy.settingsTitle}
          </button>
          <a className="ck-more" href={learnMoreHref} target="_blank" rel="noopener" data-testid="cookieNotice.learnMore">
            {copy.learnMore}
          </a>
        </div>
      </section>
    );
  }

  /* settings dialog */
  return (
    <div className="ck-modal" data-site={site} data-theme={theme}>
      <div className="ck-backdrop" aria-hidden="true" onClick={chosen ? close : undefined} />
      <section
        ref={dialogRef}
        className="ck-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-view="settings"
        data-testid="cookieNotice"
      >
        <span className="ck-handle" aria-hidden="true" />
        <div className="ck-head">
          <h2 id={titleId} className="ck-title">
            {copy.settingsTitle}
          </h2>
          {chosen ? (
            <button type="button" className="ck-close" aria-label={copy.close} onClick={close} data-testid="cookieNotice.close">
              <CloseIcon />
            </button>
          ) : null}
        </div>
        <p className="ck-intro">{copy.settingsIntro}</p>
        <ul className="ck-list">
          {categories.map((category) => {
            const text = copy.categories[category.id];
            const inputId = `${titleId}-${category.id}`;
            return (
              <li key={category.id} className="ck-row">
                <span className="ck-row-text">
                  <label htmlFor={inputId} className="ck-row-title">
                    {text.title}
                    {category.locked ? <span className="ck-badge">{copy.alwaysOn}</span> : null}
                  </label>
                  <span className="ck-hint">{text.text}</span>
                </span>
                <span className="ck-switch">
                  <input
                    id={inputId}
                    type="checkbox"
                    role="switch"
                    checked={category.on}
                    disabled={category.locked}
                    onChange={(event) => {
                      if (category.id === 'necessary') return;
                      const checked = event.currentTarget.checked;
                      setDraft((d) => ({ ...d, [category.id]: checked }));
                    }}
                    data-testid={`cookieNotice.${category.id}`}
                  />
                  <span className="ck-switch-track" aria-hidden="true">
                    <span className="ck-switch-thumb" />
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <div className="ck-actions">
          <button type="button" className="ck-btn" onClick={() => choose(draft)} data-testid="cookieNotice.save">
            {copy.save}
          </button>
          <button type="button" className="ck-btn" onClick={() => choose(ALL)} data-testid="cookieNotice.acceptAll">
            {copy.acceptAll}
          </button>
        </div>
        <a className="ck-more ck-more--center" href={learnMoreHref} target="_blank" rel="noopener" data-testid="cookieNotice.learnMore">
          {copy.learnMore}
        </a>
      </section>
    </div>
  );
}
