'use client';

import React, { useRef, useState } from 'react';
import { AMENITIES_FACILITY_GROUP_LABELS, AMENITIES_FACILITY_LABELS, useLocale } from '@nestyk/i18n';
import { groupAmenityCodes } from '@nestyk/feature-listing/public';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from '../GuestIcons';

/** Items shown per group before "show all" (design A). */
const PER_GROUP = 4;

type LabelLocale = keyof typeof AMENITIES_FACILITY_LABELS;

/** Amenities by group in picker order (plan D2: the code → group table lives in feature-listing). */
export function RoomAmenities({ codes }: { codes: string[] }) {
  const { t, locale } = useLocale();
  const copy = t.guest.room;
  const [all, setAll] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const lang = (locale in AMENITIES_FACILITY_LABELS ? locale : 'th') as LabelLocale;
  const groups = groupAmenityCodes(codes, AMENITIES_FACILITY_LABELS[lang] as Record<string, string>);
  const groupNames = AMENITIES_FACILITY_GROUP_LABELS[lang] as Record<string, string>;
  const total = groups.reduce((sum, group) => sum + group.labels.length, 0);
  if (!total) return <p className="nk-rp-note">{copy.noAmenities}</p>;
  const hidden = groups.some((group) => group.labels.length > PER_GROUP);

  // Mos 19 Nov 2026: after "show fewer" the list shrinks under the reader; bring the section heading back into view.
  const toggle = () => {
    if (all) {
      const section = buttonRef.current?.closest('section');
      if (section) {
        const margin = parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
        if (section.getBoundingClientRect().top < margin) {
          const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
          section.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        }
      }
    }
    setAll(!all);
  };
  return (
    <>
      <div className="nk-rp-amenities">
        {groups.map((group) => (
          // A cut group fades its last row to show it has more (Mos 19 Nov 2026: no count, keep it clean).
          <div
            key={group.group}
            className={
              !all && group.labels.length > PER_GROUP ? 'nk-rp-amenities__group nk-rp-amenities__group--more' : 'nk-rp-amenities__group'
            }
          >
            <h3 className="nk-rp-amenities__title">{groupNames[group.group]}</h3>
            <ul className="nk-rp-amenities__list">
              {(all ? group.labels : group.labels.slice(0, PER_GROUP)).map((label) => (
                <li key={label}>
                  <CheckIcon size={18} />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {hidden ? (
        <button ref={buttonRef} type="button" className="nk-btn nk-btn--outline nk-rp-inline-btn" aria-expanded={all} onClick={toggle}>
          {all ? copy.showFewerAmenities : copy.seeAllAmenities}
          {all ? <ChevronUpIcon size={18} /> : <ChevronDownIcon size={18} />}
        </button>
      ) : null}
    </>
  );
}
