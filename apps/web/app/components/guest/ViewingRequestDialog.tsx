'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import type { ViewingRequestSlot } from '@nestyk/types';
import { Link } from '../../../i18n/navigation';
import { bangkokToday } from '../../../lib/guest-home';
import { guestSessionToken } from '../../../lib/guest-supabase';
import {
  VIEWING_MAX_DATES,
  VIEWING_OPEN_LIMIT,
  formProblem,
  pickableDays,
  sendViewingRequest,
  toggleDay,
  type FormProblem,
  type SendResult,
} from '../../../lib/guest-viewing-requests';
import { CalendarIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, PhotoIcon } from './GuestIcons';
import type { SignInPromptRoom } from './SignInPrompt';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled])';
const SLOTS: ViewingRequestSlot[] = ['morning', 'afternoon', 'evening', 'any'];

export type ViewingRequestRoom = SignInPromptRoom & { id: string };

type Problem = FormProblem | Exclude<SendResult['kind'], 'ok'>;

function intlLocale(locale: string): string {
  return locale === 'th' ? 'th-TH-u-ca-gregory' : locale;
}

/** "จ." + "24" (+ "พ.ย." on the first chip and on the 1st of a month) for one 'YYYY-MM-DD' day. */
function dayParts(day: string, locale: string, withMonth: boolean) {
  const date = new Date(`${day}T00:00:00Z`);
  const tag = intlLocale(locale);
  return {
    weekday: new Intl.DateTimeFormat(tag, { weekday: 'short', timeZone: 'UTC' }).format(date),
    day: String(date.getUTCDate()),
    month: withMonth ? new Intl.DateTimeFormat(tag, { month: 'short', timeZone: 'UTC' }).format(date) : null,
    full: new Intl.DateTimeFormat(tag, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date),
  };
}

/**
 * "ขอนัดดูห้อง" form (Mos 23 Nov 2026: a centred dialog on wide screens, a bottom sheet at ≤ 960px, same look as the
 * sign-in prompt). 1–3 days that suit the guest, a time of day, a phone and an optional message go to NESTYK admin.
 * Esc, the close button and the backdrop close it; focus stays inside while open and goes back to the opener.
 */
export function ViewingRequestDialog({
  room,
  onClose,
  returnFocus,
}: {
  room: ViewingRequestRoom;
  onClose: () => void;
  returnFocus?: React.RefObject<HTMLElement | null>;
}) {
  const { t, locale } = useLocale();
  const copy = t.guest.viewing;
  const titleId = useId();
  const datesId = useId();
  const errorId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const daysRef = useRef<HTMLDivElement>(null);
  const days = useMemo(() => pickableDays(bangkokToday()), []);
  const [picked, setPicked] = useState<string[]>([]);
  const [slot, setSlot] = useState<ViewingRequestSlot>('any');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [sending, setSending] = useState(false);
  const [sentPhone, setSentPhone] = useState<string | null>(null);

  useEffect(() => {
    const opener = returnFocus?.current ?? null;
    panelRef.current?.querySelector<HTMLElement>('.nk-vr__day')?.focus();
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

  // After sending, focus the confirmation's first button.
  useEffect(() => {
    if (sentPhone) panelRef.current?.querySelector<HTMLElement>('.nk-vr__done a, .nk-vr__done button')?.focus();
  }, [sentPhone]);

  const scrollDays = (direction: 1 | -1) => {
    const strip = daysRef.current;
    if (strip) strip.scrollBy({ left: direction * strip.clientWidth * 0.8, behavior: 'smooth' });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;
    const local = formProblem({ dates: picked, phone });
    if (local) {
      setProblem(local);
      return;
    }
    setSending(true);
    setProblem(null);
    const auth = await guestSessionToken();
    const result: SendResult = auth
      ? await sendViewingRequest(auth.token, {
          roomId: room.id,
          preferredDates: picked,
          preferredSlot: slot,
          phone: phone.trim(),
          message: message.trim() || null,
        })
      : { kind: 'signedOut' };
    setSending(false);
    if (result.kind === 'ok') setSentPhone(phone.trim());
    else setProblem(result.kind);
  };

  const problemText: Record<Problem, string> = {
    needDate: copy.errorNeedDate,
    needPhone: copy.errorNeedPhone,
    badPhone: copy.errorBadPhone,
    exists: copy.errorExists,
    limit: fillTemplate(copy.errorLimit, { count: VIEWING_OPEN_LIMIT }),
    ownRoom: copy.errorOwnRoom,
    gone: copy.errorGone,
    signedOut: copy.errorSignedOut,
    invalid: copy.errorInvalid,
    failed: copy.errorFailed,
  };
  const slotText: Record<ViewingRequestSlot, [string, string | null]> = {
    morning: [copy.slotMorning, copy.slotMorningHint],
    afternoon: [copy.slotAfternoon, copy.slotAfternoonHint],
    evening: [copy.slotEvening, copy.slotEveningHint],
    any: [copy.slotAny, null],
  };
  const full = picked.length >= VIEWING_MAX_DATES;

  return createPortal(
    <div className="nk-prompt nk-vr" data-testid="viewingRequest">
      <div className="nk-prompt__backdrop" aria-hidden="true" onClick={onClose} />
      <div ref={panelRef} className="nk-prompt__panel nk-vr__panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <span className="nk-prompt__handle" aria-hidden="true" />
        <div className="nk-vr__head">
          <h2 id={titleId} className="nk-prompt__title">
            {sentPhone ? copy.doneTitle : copy.formTitle}
          </h2>
          <button type="button" className="nk-prompt__close" aria-label={copy.close} onClick={onClose} data-testid="viewingRequest.close">
            <CloseIcon size={20} />
          </button>
        </div>
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

        {sentPhone ? (
          <div className="nk-vr__done" data-testid="viewingRequest.done">
            <span className="nk-vr__done-icon" aria-hidden="true">
              <CheckIcon size={28} />
            </span>
            <p className="nk-prompt__body" role="status">
              {fillTemplate(copy.doneBody, { phone: sentPhone })}
            </p>
            <div className="nk-prompt__actions">
              <Link href="/viewing-requests" className="nk-btn nk-btn--primary" data-testid="viewingRequest.viewMine">
                {copy.viewMine}
              </Link>
              <button type="button" className="nk-btn nk-btn--outline" onClick={onClose}>
                {copy.done}
              </button>
            </div>
          </div>
        ) : (
          <form className="nk-vr__form" onSubmit={submit} noValidate aria-describedby={problem ? errorId : undefined}>
            <fieldset className="nk-vr__field">
              <legend className="nk-vr__label" id={datesId}>
                {copy.datesLabel}
                <span className="nk-vr__hint">
                  {full ? fillTemplate(copy.datesFull, { count: VIEWING_MAX_DATES }) : fillTemplate(copy.datesHint, { count: VIEWING_MAX_DATES })}
                </span>
              </legend>
              <div className="nk-vr__days-row">
                <button type="button" className="nk-vr__scroll" aria-label={copy.prevDays} onClick={() => scrollDays(-1)}>
                  <ChevronLeftIcon size={18} />
                </button>
                <div ref={daysRef} className="nk-vr__days" data-testid="viewingRequest.days">
                  {days.map((day, i) => {
                    const on = picked.includes(day);
                    const parts = dayParts(day, locale, i === 0 || day.endsWith('-01'));
                    return (
                      <button
                        key={day}
                        type="button"
                        className={on ? 'nk-vr__day is-on' : 'nk-vr__day'}
                        aria-pressed={on}
                        aria-label={i === 0 ? `${copy.today} ${parts.full}` : parts.full}
                        disabled={!on && full}
                        onClick={() => {
                          setPicked((current) => toggleDay(current, day));
                          if (problem === 'needDate') setProblem(null);
                        }}
                      >
                        <span className="nk-vr__day-week">{i === 0 ? copy.today : parts.weekday}</span>
                        <span className="nk-vr__day-num">{parts.day}</span>
                        {parts.month ? <span className="nk-vr__day-month">{parts.month}</span> : null}
                      </button>
                    );
                  })}
                </div>
                <button type="button" className="nk-vr__scroll" aria-label={copy.nextDays} onClick={() => scrollDays(1)}>
                  <ChevronRightIcon size={18} />
                </button>
              </div>
            </fieldset>

            <fieldset className="nk-vr__field">
              <legend className="nk-vr__label">{copy.slotLabel}</legend>
              <div className="nk-vr__slots">
                {SLOTS.map((value) => (
                  <label key={value} className={slot === value ? 'nk-vr__slot is-on' : 'nk-vr__slot'}>
                    <input type="radio" name="viewing-slot" value={value} checked={slot === value} onChange={() => setSlot(value)} />
                    <span className="nk-vr__slot-name">{slotText[value][0]}</span>
                    {slotText[value][1] ? <span className="nk-vr__slot-hint">{slotText[value][1]}</span> : null}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="nk-vr__field">
              <span className="nk-vr__label">{copy.phoneLabel}</span>
              <input
                className="nk-input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={50}
                placeholder={copy.phonePlaceholder}
                value={phone}
                aria-invalid={problem === 'needPhone' || problem === 'badPhone' || undefined}
                onChange={(event) => {
                  setPhone(event.target.value);
                  if (problem === 'needPhone' || problem === 'badPhone') setProblem(null);
                }}
                data-testid="viewingRequest.phone"
              />
            </label>

            <label className="nk-vr__field">
              <span className="nk-vr__label">{copy.messageLabel}</span>
              <textarea
                className="nk-input nk-vr__message"
                rows={2}
                maxLength={500}
                placeholder={copy.messagePlaceholder}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </label>

            {problem ? (
              <p id={errorId} className="nk-vr__error" role="alert" data-testid="viewingRequest.error">
                {problemText[problem]}
                {problem === 'exists' ? (
                  <>
                    {' '}
                    <Link href="/viewing-requests">{copy.viewMine}</Link>
                  </>
                ) : null}
              </p>
            ) : null}

            <p className="nk-vr__note">
              <CalendarIcon size={16} />
              {copy.teamNote}
            </p>
            <button type="submit" className="nk-btn nk-btn--primary nk-vr__submit" disabled={sending} aria-busy={sending || undefined} data-testid="viewingRequest.submit">
              {sending ? copy.sending : copy.submit}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
