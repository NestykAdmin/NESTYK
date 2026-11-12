'use client';

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '@nestyk/i18n';
import { guestAccountUrl } from '../../../lib/guest-site';
import { CloseIcon, HeartIcon, PhotoIcon } from './GuestIcons';

/** The room the guest tried to save, shown in the prompt so it is clear what will be kept. */
export interface SignInPromptRoom {
  title: string;
  priceText: string | null;
  coverImageUrl: string | null;
}

const FOCUSABLE = 'a[href], button:not([disabled])';

/**
 * Prompt for features that need an account (Mos 11 Nov 2026, replaces H3: the heart no longer jumps to sign-in).
 * A centred dialog on wide screens and a bottom sheet at ≤ 960px (guest.css). Esc, the close button, "Not now" and
 * the backdrop close it; focus moves in, stays inside while open, and goes back to the button that opened it.
 * The guest web cannot see the account session yet (single sign-on comes later), so it always asks.
 */
export function SignInPrompt({
  room,
  onClose,
  returnFocus,
}: {
  room?: SignInPromptRoom;
  onClose: () => void;
  returnFocus?: React.RefObject<HTMLElement | null>;
}) {
  const { t } = useLocale();
  const copy = t.guest.signInPrompt;
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const opener = returnFocus?.current ?? null;
    firstRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
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
  }, [onClose, returnFocus]);

  return createPortal(
    <div className="nk-prompt" data-testid="signInPrompt">
      <div className="nk-prompt__backdrop" aria-hidden="true" onClick={onClose} />
      <div ref={panelRef} className="nk-prompt__panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <span className="nk-prompt__handle" aria-hidden="true" />
        <div className="nk-prompt__top">
          <span className="nk-prompt__icon" aria-hidden="true">
            <HeartIcon size={28} />
          </span>
          <button type="button" className="nk-prompt__close" aria-label={copy.close} onClick={onClose} data-testid="signInPrompt.close">
            <CloseIcon size={20} />
          </button>
        </div>
        <h2 id={titleId} className="nk-prompt__title">
          {copy.saveTitle}
        </h2>
        <p className="nk-prompt__body">{copy.saveBody}</p>
        {room ? (
          <div className="nk-prompt__room">
            {room.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={room.coverImageUrl} alt="" className="nk-prompt__room-photo" />
            ) : (
              <span className="nk-prompt__room-photo nk-prompt__room-photo--empty" aria-hidden="true">
                <PhotoIcon size={20} />
              </span>
            )}
            <span className="nk-prompt__room-text">
              <span className="nk-prompt__room-title">{room.title}</span>
              {room.priceText ? <span className="nk-prompt__room-price">{room.priceText}</span> : null}
            </span>
          </div>
        ) : null}
        <div className="nk-prompt__actions">
          <a ref={firstRef} href={guestAccountUrl('signIn')} className="nk-btn nk-btn--primary" data-testid="signInPrompt.signIn">
            {copy.signIn}
          </a>
          <a href={guestAccountUrl('register')} className="nk-btn nk-btn--outline" data-testid="signInPrompt.register">
            {copy.register}
          </a>
        </div>
        <button type="button" className="nk-prompt__later" onClick={onClose} data-testid="signInPrompt.later">
          {copy.later}
        </button>
      </div>
    </div>,
    document.body,
  );
}
