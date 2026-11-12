'use client';

import React, { useId } from 'react';
import { useLocale } from '@nestyk/i18n';
import type { GuestSearchCriteria } from '@nestyk/feature-search';
import { SearchIcon } from './GuestIcons';
import { SearchFilterSheet } from './SearchFilterSheet';
import { useSearchNavigation } from './SearchNavigation';

type QuickChip = 'nearTransit' | 'moveInReady' | 'petFriendly' | 'shortTerm';
const QUICK_CHIPS: readonly QuickChip[] = ['nearTransit', 'moveInReady', 'petFriendly', 'shortTerm'];

/**
 * Search strip on top of the results (design v2.3 / v2.2): keyword box, the popular chips and, at ≤ 960px, the
 * button that opens the filter sheet. "พร้อมเข้าอยู่" here is the move-in choice "now" (Mos 12 Nov 2026, Q3).
 */
export function SearchKeywordBar({ criteria, total }: { criteria: GuestSearchCriteria; total: number | null }) {
  const { t } = useLocale();
  const copy = t.guest;
  const { update } = useSearchNavigation();
  const id = useId();

  const isOn = (code: QuickChip) => (code === 'moveInReady' ? criteria.moveIn === 'now' : criteria.quick.includes(code));
  // Each chip flips its own value on the latest search, so a change still on its way is kept (review R3).
  const toggle = (code: QuickChip) => {
    if (code === 'moveInReady') {
      update((current) => ({ moveIn: current.moveIn === 'now' ? undefined : 'now' }));
      return;
    }
    update((current) => ({
      quick: current.quick.includes(code) ? current.quick.filter((item) => item !== code) : [...current.quick, code],
    }));
  };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const keyword = String(new FormData(event.currentTarget).get('q') ?? '').trim().slice(0, 100);
    update({ keyword: keyword || undefined });
  };

  return (
    <div className="nk-search-bar" data-testid="searchPage.bar">
      <form className="nk-search-bar__form" role="search" aria-label={copy.search.submit} onSubmit={submit}>
        <label htmlFor={`${id}-q`} className="nk-sr-only">
          {copy.search.keywordLabel}
        </label>
        <div className="nk-field__control nk-search-bar__field">
          <SearchIcon size={18} className="nk-field__icon" />
          <input
            key={criteria.keyword ?? ''}
            id={`${id}-q`}
            name="q"
            type="search"
            defaultValue={criteria.keyword ?? ''}
            maxLength={100}
            placeholder={copy.search.keywordPlaceholder}
            className="nk-input nk-input--icon"
            data-testid="searchPage.keyword"
          />
        </div>
        <button type="submit" className="nk-btn nk-btn--primary nk-search-bar__submit" data-testid="searchPage.submit">
          <SearchIcon size={18} />
          <span className="nk-search-bar__submit-text">{copy.search.submit}</span>
        </button>
      </form>
      <div className="nk-search-bar__chips">
        <SearchFilterSheet criteria={criteria} total={total} />
        <div className="nk-search-bar__quick" role="group" aria-label={copy.search.popularFilters}>
          {QUICK_CHIPS.map((code) => (
            <button
              key={code}
              type="button"
              className="nk-chip"
              aria-pressed={isOn(code)}
              onClick={() => toggle(code)}
              data-testid={`searchPage.quick.${code}`}
            >
              {copy.quick[code]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
