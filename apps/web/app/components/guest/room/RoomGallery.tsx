'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import { ChevronRightIcon, CloseIcon, GridIcon, PhotoIcon } from '../GuestIcons';

/**
 * Room photos (design RoomMixWeb / RoomMixPhone). Wide screens: one large photo and four small ones, plus "show all".
 * Phones: the first photo across the top (guest.css hides the rest), with a counter. Any photo opens a full-screen
 * viewer (native <dialog>: Esc closes it, focus goes back to the button that opened it, arrow keys move).
 */
export function RoomGallery({ images, title, overlay }: { images: string[]; title: string; overlay?: React.ReactNode }) {
  const { t } = useLocale();
  const copy = t.guest.room;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [index, setIndex] = useState(0);
  const count = images.length;

  const open = (at: number, opener: HTMLElement) => {
    openerRef.current = opener;
    setIndex(at);
    dialogRef.current?.showModal();
  };
  const close = useCallback(() => dialogRef.current?.close(), []);
  const move = useCallback((step: number) => setIndex((current) => (current + step + count) % count), [count]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => openerRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') move(1);
      if (event.key === 'ArrowLeft') move(-1);
    };
    dialog.addEventListener('close', onClose);
    dialog.addEventListener('keydown', onKey);
    return () => {
      dialog.removeEventListener('close', onClose);
      dialog.removeEventListener('keydown', onKey);
    };
  }, [move]);

  if (!count) {
    return (
      <section className="nk-rp-gallery nk-rp-gallery--empty" aria-label={copy.noPhotos} data-testid="roomPage.gallery">
        <span className="nk-rp-gallery__placeholder">
          <PhotoIcon size={40} />
          {copy.noPhotos}
        </span>
        {overlay}
      </section>
    );
  }

  const alt = (n: number) => `${title} ${fillTemplate(copy.photoCounter, { index: n, count })}`;
  return (
    <section
      className={count >= 5 ? 'nk-rp-gallery' : `nk-rp-gallery nk-rp-gallery--few nk-rp-gallery--${count}`}
      aria-label={fillTemplate(copy.photosLabel, { count })}
      data-testid="roomPage.gallery"
    >
      {images.slice(0, 5).map((src, i) => (
        <button
          key={src}
          type="button"
          className={i === 0 ? 'nk-rp-gallery__tile nk-rp-gallery__tile--main' : 'nk-rp-gallery__tile'}
          aria-label={fillTemplate(copy.openPhoto, { index: i + 1, count })}
          onClick={(event) => open(i, event.currentTarget)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
        </button>
      ))}
      {count > 1 ? (
        <button type="button" className="nk-btn nk-btn--outline nk-rp-gallery__all" onClick={(event) => open(0, event.currentTarget)}>
          <GridIcon size={18} />
          {fillTemplate(copy.showAllPhotos, { count })}
        </button>
      ) : null}
      <span className="nk-rp-gallery__count" aria-hidden="true">
        {fillTemplate(copy.photoCounter, { index: 1, count })}
      </span>
      {overlay}

      <dialog ref={dialogRef} className="nk-rp-viewer" aria-label={copy.galleryTitle} data-testid="roomPage.viewer">
        <div className="nk-rp-viewer__bar">
          <span aria-live="polite">{fillTemplate(copy.photoCounter, { index: index + 1, count })}</span>
          <button type="button" className="nk-rp-viewer__icon" aria-label={copy.closeGallery} onClick={close}>
            <CloseIcon size={22} />
          </button>
        </div>
        <figure className="nk-rp-viewer__stage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[index]} alt={alt(index + 1)} />
        </figure>
        {count > 1 ? (
          <>
            <button type="button" className="nk-rp-viewer__icon nk-rp-viewer__prev" aria-label={copy.previousPhoto} onClick={() => move(-1)}>
              <ChevronRightIcon size={24} />
            </button>
            <button type="button" className="nk-rp-viewer__icon nk-rp-viewer__next" aria-label={copy.nextPhoto} onClick={() => move(1)}>
              <ChevronRightIcon size={24} />
            </button>
          </>
        ) : null}
      </dialog>
    </section>
  );
}
