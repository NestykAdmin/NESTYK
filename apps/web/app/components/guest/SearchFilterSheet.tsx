'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import type { GuestSearchCriteria } from '@nestyk/feature-search';
import {
  activeFilterCount,
  clearedFilters,
  publicSearchUrl,
  searchHref,
  toPublicQuery,
  withFilters,
} from '../../../lib/guest-search';
import { CloseIcon, SlidersIcon } from './GuestIcons';
import { SearchFilterFields } from './SearchFilterFields';
import { useSearchNavigation } from './SearchNavigation';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled])';
/** Wait this long after the last change before asking how many rooms the sheet's filters find. */
const COUNT_DEBOUNCE_MS = 300;

/**
 * Filters on phones and tablets (≤ 960px, design v2.2 SearchSheetV22): a bottom sheet with the same fields as the
 * desktop panel. Changes stay in the sheet until "ดูผลลัพธ์ N ห้อง"; the number is asked from the API as the
 * guest changes filters. Esc, the close button and the backdrop close it without applying; focus stays inside.
 */
export function SearchFilterSheet({ criteria, total }: { criteria: GuestSearchCriteria; total: number | null }) {
  const { t } = useLocale();
  const copy = t.guest;
  const { replace, latest } = useSearchNavigation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(criteria);
  const [count, setCount] = useState<number | null>(total);
  const openerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const applied = activeFilterCount(criteria);
  const draftKey = searchHref(draft);

  const show = () => {
    setDraft(latest());
    setCount(total);
    setOpen(true);
  };
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const opener = openerRef.current;
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!panelRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, [open]);

  // How many rooms the sheet's filters find (one room asked, only the total is read).
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(publicSearchUrl(toPublicQuery(draft, 1, 1)), { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
        .then((body: { total?: unknown }) => setCount(typeof body.total === 'number' ? body.total : null))
        .catch((error: unknown) => {
          if ((error as { name?: string })?.name !== 'AbortError') setCount(null);
        });
    }, COUNT_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draftKey]);

  const apply = () => {
    setOpen(false);
    replace(withFilters(draft, {}));
  };

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        className="nk-btn nk-btn--outline nk-search-sheet-btn"
        aria-haspopup="dialog"
        onClick={show}
        data-testid="searchPage.openFilters"
      >
        <SlidersIcon size={18} />
        {applied ? fillTemplate(copy.results.filtersCount, { count: applied }) : copy.results.filtersTitle}
      </button>
      {open
        ? createPortal(
            <div className="nk-prompt nk-sheet" data-testid="searchFilterSheet">
              <div className="nk-prompt__backdrop" aria-hidden="true" onClick={close} />
              <div ref={panelRef} className="nk-prompt__panel nk-sheet__panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
                <span className="nk-prompt__handle" aria-hidden="true" />
                <div className="nk-sheet__head">
                  <h2 id={titleId} className="nk-sheet__title">
                    {copy.results.allFilters}
                  </h2>
                  <button type="button" className="nk-prompt__close" aria-label={copy.signInPrompt.close} onClick={close} data-testid="searchFilterSheet.close">
                    <CloseIcon size={20} />
                  </button>
                </div>
                <div className="nk-sheet__body">
                  <SearchFilterFields value={draft} onChange={(patch) => setDraft((current) => withFilters(current, patch))} idPrefix="sheet" />
                </div>
                <div className="nk-sheet__foot">
                  <button
                    type="button"
                    className="nk-btn nk-btn--outline"
                    disabled={activeFilterCount(draft) === 0}
                    onClick={() => setDraft((current) => clearedFilters(current))}
                    data-testid="searchFilterSheet.clear"
                  >
                    {copy.results.clearAll}
                  </button>
                  <button type="button" className="nk-btn nk-btn--primary" onClick={apply} data-testid="searchFilterSheet.apply">
                    {count === null ? copy.search.submit : fillTemplate(copy.results.showResults, { count: count.toLocaleString('en-US') })}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
