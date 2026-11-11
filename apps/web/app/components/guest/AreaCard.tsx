import React from 'react';
import Link from 'next/link';
import { fillTemplate, type TranslationSchema } from '@nestyk/i18n';
import type { PublicAreaSummary } from '@nestyk/types';
import { formatPublicPrice } from '@nestyk/feature-listing/public';
import { isGuestPageReady, localePath } from '../../../lib/guest-site';
import { PhotoIcon, TrainIcon } from './GuestIcons';

type GuestCopy = TranslationSchema['guest'];

/** Popular area card (S3.2): photo, name in the reader's language, transit lines, rooms and the lowest rent. */
export function AreaCard({ area, copy, locale }: { area: PublicAreaSummary; copy: GuestCopy; locale: string }) {
  const name = (copy.areaNames as Record<string, string>)[area.slug] ?? area.name;
  const lines = area.transitLines
    .map((code) => (copy.transitLines as Record<string, string>)[code])
    .filter((label): label is string => !!label);
  const price = formatPublicPrice(area.priceFrom);
  const href = isGuestPageReady('rent') ? localePath(locale, `/rent/${area.slug}`) : null;

  return (
    <article className="nk-area" data-testid="areaCard">
      <div className="nk-area__media">
        {area.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={area.coverImageUrl} alt={fillTemplate(copy.area.photoAlt, { name })} loading="lazy" decoding="async" />
        ) : (
          <span className="nk-area__placeholder" aria-hidden="true">
            <PhotoIcon size={28} />
          </span>
        )}
      </div>
      <div className="nk-area__body">
        <h3 className="nk-area__name">
          {href ? (
            <Link href={href} className="nk-stretch">
              {name}
            </Link>
          ) : (
            name
          )}
        </h3>
        {lines.length ? (
          <ul className="nk-area__lines">
            {lines.map((label) => (
              <li key={label}>
                <TrainIcon size={16} />
                {label}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="nk-area__facts">
          <span>{fillTemplate(copy.area.roomsReady, { count: area.roomCount })}</span>
          {price ? <span>{fillTemplate(copy.area.priceFrom, { price })}</span> : null}
        </p>
      </div>
    </article>
  );
}
