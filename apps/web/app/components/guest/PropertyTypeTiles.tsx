import React from 'react';
import Link from 'next/link';
import type { TranslationSchema } from '@nestyk/i18n';
import type { PropertyType } from '@nestyk/types';
import { findHref, HOME_PROPERTY_TYPES } from '../../../lib/guest-home';
import { localePath } from '../../../lib/guest-site';
import { ApartmentIcon, CondoIcon, HouseIcon, TownhomeIcon } from './GuestIcons';

type GuestCopy = TranslationSchema['guest'];

const ICONS: Record<PropertyType, React.ComponentType<{ size?: number }>> = {
  condo: CondoIcon,
  apartment: ApartmentIcon,
  house: HouseIcon,
  townhome: TownhomeIcon,
};

/** No townhome rooms can exist yet: the database has no such property type (plan K5). */
const SOON: readonly PropertyType[] = ['townhome'];

/**
 * "เลือกตามประเภทที่พัก". `tiles` = 4 boxes with a hint (wide screens); `rail` = a row of chips that scrolls
 * sideways under the hero (mobile, MobileHomeV23). guest.css shows one or the other.
 */
export function PropertyTypeTiles({ copy, locale, variant }: { copy: GuestCopy; locale: string; variant: 'tiles' | 'rail' }) {
  return (
    <nav
      aria-label={copy.home.typesTitle}
      className={variant === 'tiles' ? 'nk-types nk-types--tiles' : 'nk-types nk-types--rail'}
      data-testid={variant === 'tiles' ? 'guestHome.typeTiles' : 'guestHome.types'}
    >
      {HOME_PROPERTY_TYPES.map((type) => {
        const Icon = ICONS[type];
        const body = (
          <>
            <span className="nk-types__icon">
              <Icon size={variant === 'tiles' ? 24 : 20} />
            </span>
            <span className="nk-types__text">
              <span className="nk-types__name">{copy.propertyType[type]}</span>
              {variant === 'tiles' ? <span className="nk-types__hint">{copy.propertyTypeHint[type]}</span> : null}
            </span>
          </>
        );
        // Townhome has no rooms yet. A type is not a place: /find opens with the type chosen (Mos 27 Nov 2026).
        const href = SOON.includes(type) ? null : findHref(type);
        if (!href) {
          return (
            <span key={type} className="nk-types__item nk-types__item--soon">
              {body}
              <span className="nk-soon">{copy.nav.comingSoon}</span>
            </span>
          );
        }
        return (
          <Link key={type} href={localePath(locale, href)} className="nk-types__item">
            {body}
          </Link>
        );
      })}
    </nav>
  );
}
