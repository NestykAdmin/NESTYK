'use client';

import React, { useCallback, useRef, useState } from 'react';
import { HeartIcon } from './GuestIcons';
import { useSavedRooms } from './SavedRooms';
import { SignInPrompt, type SignInPromptRoom } from './SignInPrompt';

/**
 * Heart on a room card.
 * - Signed out (or still checking): opens the sign-in prompt in place (Mos 11 Nov 2026; S4 of AUTH-3 keeps it).
 * - Signed in: saves or unsaves the room (AUTH-3). Filled red when saved (Mos 13 Nov 2026); the toast says what
 *   happened. aria-pressed tells screen readers the state; the label says what a press will do.
 */
export function FavoriteButton({
  label,
  unsaveLabel,
  roomId,
  room,
}: {
  label: string;
  unsaveLabel: string;
  roomId: string;
  room?: SignInPromptRoom;
}) {
  const saved = useSavedRooms();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  if (saved.status === 'off') {
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

  const isSaved = saved.isSaved(roomId);
  // While the saved hearts load, a press would guess wrong (review R5): show busy and let toggle wait it out.
  const busy = saved.isPending(roomId) || saved.status === 'loading';
  const text = isSaved ? unsaveLabel : label;
  return (
    <button
      type="button"
      className="nk-fav"
      aria-label={text}
      title={text}
      aria-pressed={isSaved}
      aria-busy={busy || undefined}
      onClick={(event) => void saved.toggle(roomId, event.currentTarget)}
      data-testid="roomCard.save"
    >
      <HeartIcon size={20} />
    </button>
  );
}
