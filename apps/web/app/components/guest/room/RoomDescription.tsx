'use client';

import React, { useId, useState } from 'react';
import { useLocale } from '@nestyk/i18n';

/** Long descriptions show their first lines with "read more" (design A). The agent's text is shown as plain text. */
const LONG_DESCRIPTION = 280;

export function RoomDescription({ text }: { text: string }) {
  const { t } = useLocale();
  const copy = t.guest.room;
  const [open, setOpen] = useState(false);
  const id = useId();
  const long = text.length > LONG_DESCRIPTION;
  return (
    <>
      <p id={id} className={long && !open ? 'nk-rp-desc is-clamped' : 'nk-rp-desc'}>
        {text}
      </p>
      {long ? (
        <button type="button" className="nk-rp-more" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
          {open ? copy.readLess : copy.readMore}
        </button>
      ) : null}
    </>
  );
}
