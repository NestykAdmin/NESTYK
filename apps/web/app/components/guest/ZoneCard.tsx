import React from 'react';
import Link from 'next/link';
import { fillTemplate, type TranslationSchema } from '@nestyk/i18n';
import type { PublicAreaSummary } from '@nestyk/types';
import { formatPublicPrice } from '@nestyk/feature-listing/public';
import { areaPagePath } from '../../../lib/guest-areas';
import { localePath } from '../../../lib/guest-site';
import { PhotoIcon } from './GuestIcons';

type GuestCopy = TranslationSchema['guest'];

/**
 * Province zone card: a small photo, the name, its places and the facts. Used on /areas and the home page
 * (canvas AreasListWeb and HomeZonesWeb, Mos 20 Nov 2026).
 */
export function ZoneCard({ area, copy, locale }: { area: PublicAreaSummary; copy: GuestCopy; locale: string }) {
  const name = (copy.areaNames as Record<string, string>)[area.slug] ?? area.name;
  const places = copy.areaInfo[area.slug as keyof typeof copy.areaInfo]?.places;
  const price = formatPublicPrice(area.priceFrom);
  return (
    <article className="nk-zone" data-testid="zoneCard">
      <div className="nk-zone__media">
        {area.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={area.coverImageUrl} alt={fillTemplate(copy.area.photoAlt, { name })} loading="lazy" decoding="async" />
        ) : (
          <span className="nk-area__placeholder" aria-hidden="true">
            <PhotoIcon size={22} />
          </span>
        )}
      </div>
      <div className="nk-zone__body">
        <h3 className="nk-zone__name">
          <Link href={localePath(locale, areaPagePath(area.slug))} className="nk-stretch">
            {name}
          </Link>
        </h3>
        {places ? <p className="nk-zone__places">{places}</p> : null}
        <p className="nk-zone__facts">
          <span>{fillTemplate(copy.area.roomsReady, { count: area.roomCount })}</span>
          {price ? <span>{fillTemplate(copy.area.priceFrom, { price })}</span> : null}
        </p>
      </div>
    </article>
  );
}
