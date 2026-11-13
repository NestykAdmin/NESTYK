import React from 'react';
import Link from 'next/link';
import { fillTemplate, type TranslationSchema } from '@nestyk/i18n';
import type { PublicRoomCard } from '@nestyk/types';
import {
  buildPublicRoomSpecs,
  formatPublicAvailability,
  getPublicAvailability,
} from '@nestyk/feature-listing/public';
import { roomDisplayTitle, roomLocationLine } from '../../../lib/guest-home';
import { isGuestPageReady, localePath } from '../../../lib/guest-site';
import { FavoriteButton } from './FavoriteButton';
import { AreaIcon, BathIcon, BedIcon, CalendarIcon, PhotoIcon, PinIcon } from './GuestIcons';

type GuestCopy = TranslationSchema['guest'];

export interface RoomCardProps {
  card: PublicRoomCard;
  copy: GuestCopy;
  locale: string;
  /** Today as YYYY-MM-DD, for "พร้อมเข้าอยู่". */
  today: string;
}

/**
 * Room card, grid variant (S3.1, design v2.3 "roomCard"). No hooks: renders on the server and inside client pieces.
 * The card opens the room page once that page exists (S7); until then the title is plain text.
 */
export function RoomCard({ card, copy, locale, today }: RoomCardProps) {
  const [bedrooms] = buildPublicRoomSpecs({ bedrooms: card.bedrooms, bathrooms: null, areaSqm: null }, copy.spec);
  const [bathrooms] = buildPublicRoomSpecs({ bedrooms: null, bathrooms: card.bathrooms, areaSqm: null }, copy.spec);
  const [area] = buildPublicRoomSpecs({ bedrooms: null, bathrooms: null, areaSqm: card.areaSqm }, copy.spec);
  const title = roomDisplayTitle(
    card,
    { titleFallback: copy.card.titleFallback, roomFallback: copy.card.roomFallback, propertyType: copy.propertyType },
    bedrooms ?? null,
  );
  const location = roomLocationLine(card);
  const availability = formatPublicAvailability(getPublicAvailability(card.availableFrom, today), copy.availability, locale);
  const href = isGuestPageReady('rooms') ? localePath(locale, `/rooms/${encodeURIComponent(card.id)}`) : null;
  const price = card.priceFrom != null ? Math.round(card.priceFrom).toLocaleString('en-US') : null;

  return (
    <article className="nk-room" data-testid="roomCard">
      <div className="nk-room__media">
        {card.coverImageUrl ? (
          // Photos come from the API's storage host; next/image needs that host in next.config (SEO-1).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.coverImageUrl} alt="" loading="lazy" decoding="async" className="nk-room__photo" />
        ) : (
          <span className="nk-room__placeholder">
            <PhotoIcon size={28} />
            {copy.card.photoPlaceholder}
          </span>
        )}
        <span className="nk-room__badges">
          <span className="nk-badge nk-badge--dark">{copy.card.rentBadge}</span>
          {card.isNew ? <span className="nk-badge nk-badge--brand">{copy.card.newBadge}</span> : null}
        </span>
        <FavoriteButton
          roomId={card.id}
          label={fillTemplate(copy.card.saveNamed, { name: title })}
          unsaveLabel={fillTemplate(copy.card.unsaveNamed, { name: title })}
          room={{ title, priceText: price ? `฿${price} ${copy.card.perMonthLong}` : null, coverImageUrl: card.coverImageUrl }}
        />
      </div>
      <div className="nk-room__body">
        {price ? (
          <p className="nk-price">
            {card.shortTermAvailable ? <span className="nk-price__from">{copy.card.priceFrom}</span> : null}
            <span className="nk-price__currency">฿</span>
            <span className="nk-price__value">{price}</span>
            <span className="nk-price__unit">{copy.card.perMonthLong}</span>
          </p>
        ) : null}
        <h3 className="nk-room__title">
          {href ? (
            <Link href={href} className="nk-stretch">
              {title}
            </Link>
          ) : (
            title
          )}
        </h3>
        {location ? (
          <p className="nk-room__meta">
            <PinIcon size={16} />
            {location}
          </p>
        ) : null}
        <ul className="nk-room__specs" aria-label={copy.card.details}>
          {bedrooms ? (
            <li>
              <BedIcon size={16} />
              {bedrooms}
            </li>
          ) : null}
          {bathrooms ? (
            <li>
              <BathIcon size={16} />
              {bathrooms}
            </li>
          ) : null}
          {area ? (
            <li>
              <AreaIcon size={16} />
              {area}
            </li>
          ) : null}
        </ul>
        {availability ? (
          <p className="nk-room__availability">
            <CalendarIcon size={16} />
            {availability}
          </p>
        ) : null}
      </div>
    </article>
  );
}
