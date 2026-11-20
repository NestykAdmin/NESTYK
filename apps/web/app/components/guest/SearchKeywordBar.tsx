'use client';

import React, { useEffect, useId, useMemo, useState } from 'react';
import { useLocale } from '@nestyk/i18n';
import type { GuestSearchCriteria } from '@nestyk/feature-search';
import { locationLabel, locationPatch, type LocationChoice, type LocationLabelKind } from '../../../lib/guest-location';
import { CloseIcon, LocateIcon, MapIcon, PinIcon, SearchIcon, TrainIcon } from './GuestIcons';
import { LocationCombobox } from './LocationCombobox';
import { SearchFilterSheet } from './SearchFilterSheet';
import { useSearchNavigation } from './SearchNavigation';

type QuickChip = 'nearTransit' | 'moveInReady' | 'petFriendly' | 'shortTerm';
const QUICK_CHIPS: readonly QuickChip[] = ['nearTransit', 'moveInReady', 'petFriendly', 'shortTerm'];
/** New text in the box replaces the place the box showed (Mos 20 Nov 2026). */
const NO_PLACE = { area: undefined, nearGps: undefined, placeName: undefined } as const;
/** Icon at the left of the box for what the search is about (station, place, near me, area, keyword). */
const LABEL_ICON: Record<LocationLabelKind, typeof SearchIcon> = {
  station: TrainIcon,
  place: PinIcon,
  nearMe: LocateIcon,
  area: MapIcon,
  keyword: SearchIcon,
  none: SearchIcon,
};

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
  // The box keeps what the search is about: the keyword, a picked station or place, "near me" or an area (Mos 20 Nov 2026).
  const label = useMemo(
    () => locationLabel(criteria, { nearMe: copy.location.nearMe, areaNames: copy.areaNames as Record<string, string> }),
    [criteria, copy],
  );
  const [text, setText] = useState(label.text);
  // A new search from elsewhere (a chip, Back) shows its own label.
  useEffect(() => setText(label.text), [label.text]);
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // The label unchanged keeps the current search; a station must not turn into the keyword "MRT ไฟฉาย".
    if (text === label.text) return;
    update({ ...locationPatch({ kind: 'keyword', text }), ...NO_PLACE });
  };
  const clear = () => {
    setText('');
    if (label.kind !== 'none') update({ keyword: undefined, ...NO_PLACE });
  };
  const LeadIcon = text === label.text ? LABEL_ICON[label.kind] : SearchIcon;
  // A station, place, area or "near me" replaces the search's place; a keyword from the box replaces it too.
  const pickLocation = (choice: LocationChoice) =>
    update(choice.kind === 'keyword' ? { ...locationPatch(choice), ...NO_PLACE } : locationPatch(choice));

  return (
    <div className="nk-search-bar" data-testid="searchPage.bar">
      <form className="nk-search-bar__form" role="search" aria-label={copy.search.submit} onSubmit={submit}>
        <label htmlFor={`${id}-q`} className="nk-sr-only">
          {copy.search.keywordLabel}
        </label>
        <div className="nk-field__control nk-search-bar__field">
          <LeadIcon size={18} className="nk-field__icon" />
          <LocationCombobox
            inputId={`${id}-q`}
            name="q"
            value={text}
            onValueChange={setText}
            onPick={pickLocation}
            placeholder={copy.search.keywordPlaceholder}
            inputClassName="nk-input nk-input--icon nk-input--clearable"
            testId="searchPage.keyword"
          />
          {text ? (
            <button type="button" className="nk-search-bar__clear" aria-label={copy.location.clear} onClick={clear} data-testid="searchPage.clear">
              <CloseIcon size={16} />
            </button>
          ) : null}
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
