'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import { Link, usePathname } from '../../../i18n/navigation';
import type { GuestLocale } from '../../../i18n/routing';
import { LANGUAGE_OPTIONS } from '../../../lib/guest-site';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, GlobeIcon } from './GuestIcons';

function currentLanguage(locale: string) {
  return LANGUAGE_OPTIONS.find((option) => option.code === locale) ?? LANGUAGE_OPTIONS[0];
}

/** The closed button, also shown while the page reads its search filters (Suspense fallback). */
export function GuestLanguageButtonStatic() {
  const { locale, t } = useLocale();
  const current = currentLanguage(locale);
  return (
    <span className="nk-lang">
      <button
        type="button"
        className="nk-lang__button"
        aria-haspopup="true"
        aria-expanded="false"
        aria-label={fillTemplate(t.guest.nav.languageButton, { name: current.name })}
        data-testid="guest.language"
      >
        <GlobeIcon size={18} />
        {current.short}
        <ChevronDownIcon size={16} />
      </button>
    </span>
  );
}

/**
 * One language button that opens the list (design v2.3). Each language is a link to the same page and the same
 * search filters in that language, so the language stays in the URL (no cookie).
 */
export function GuestLanguageMenu() {
  const { locale, t } = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = Object.fromEntries(searchParams.entries());
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const titleId = useId();
  const current = currentLanguage(locale);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <span className="nk-lang" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="nk-lang__button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={fillTemplate(t.guest.nav.languageButton, { name: current.name })}
        onClick={() => setOpen((value) => !value)}
        data-testid="guest.language"
      >
        <GlobeIcon size={18} />
        {current.short}
        {open ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
      </button>
      {open ? (
        <div id={menuId} className="nk-lang__menu" data-testid="guest.languageMenu">
          <p id={titleId} className="nk-lang__title">
            {t.guest.nav.language}
          </p>
          <ul aria-labelledby={titleId} className="nk-lang__list">
            {LANGUAGE_OPTIONS.map((option) => {
              const selected = option.code === locale;
              return (
                <li key={option.code}>
                  <Link
                    href={{ pathname, query }}
                    locale={option.code as GuestLocale}
                    lang={option.code}
                    hrefLang={option.code}
                    aria-current={selected ? 'true' : undefined}
                    className="nk-lang__option"
                    onClick={() => setOpen(false)}
                    data-testid={`guest.language.${option.code}`}
                  >
                    {option.name}
                    <span className="nk-lang__code">{option.short}</span>
                    {selected ? <CheckIcon size={18} className="nk-lang__check" /> : <span aria-hidden="true" className="nk-lang__check" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </span>
  );
}
