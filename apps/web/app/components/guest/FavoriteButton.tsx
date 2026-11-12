'use client';

import React, { useCallback, useRef, useState } from 'react';
import { HeartIcon } from './GuestIcons';
import { SignInPrompt, type SignInPromptRoom } from './SignInPrompt';

/**
 * Heart on a room card. Saving needs an account (S4.5), so for now it opens the sign-in prompt in place instead of
 * leaving the page (Mos 11 Nov 2026; replaces H3, which went straight to the central sign-in).
 */
export function FavoriteButton({ label, room }: { label: string; room?: SignInPromptRoom }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="nk-fav"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        data-testid="roomCard.save"
      >
        <HeartIcon size={20} />
      </button>
      {open ? <SignInPrompt room={room} onClose={close} returnFocus={buttonRef} /> : null}
    </>
  );
}
