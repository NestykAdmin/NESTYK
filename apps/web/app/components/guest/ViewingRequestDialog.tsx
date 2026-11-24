'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import { Link } from '../../../i18n/navigation';
import { bangkokToday } from '../../../lib/guest-home';
import { guestSessionToken } from '../../../lib/guest-supabase';
import {
  VIEWING_OPEN_LIMIT,
  VIEWING_PERIODS,
  calendarMonths,
  formProblem,
  isPickableDay,
  lastPickableDay,
  monthGrid,
  periodRange,
  preferredAt,
  sendViewingRequest,
  stripDays,
  timesOf,
  type FormProblem,
  type SendResult,
  type ViewingPeriod,
} from '../../../lib/guest-viewing-requests';
import { CalendarIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, PhotoIcon } from './GuestIcons';
import type { SignInPromptRoom } from './SignInPrompt';

/** Same break as the sheet / dialog switch in guest.css: wider screens show the month calendar all the time (Mos 24 Nov 2026). */
const WIDE_QUERY = '(min-width: 961px)';

/** True on wide screens; follows the window as it is resized. The form only renders in the browser. */
function useWideScreen(): boolean {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(WIDE_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(WIDE_QUERY);
    const update = () => setWide(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return wide;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled])';
/** A Sunday, to name the calendar's weekday columns in the page language. */
const A_SUNDAY = Date.UTC(2026, 10, 22);

export type ViewingRequestRoom = SignInPromptRoom & { id: string };

type Problem = FormProblem | Exclude<SendResult['kind'], 'ok'>;

function intlLocale(locale: string): string {
  return locale === 'th' ? 'th-TH-u-ca-gregory' : locale;
}

function utcDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function formatDay(day: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    ...options,
    timeZone: 'UTC',
  }).format(utcDay(day));
}

/**
 * "ขอนัดดูห้อง" form (Mos 23 Nov 2026: a centred dialog on wide screens, a bottom sheet at ≤ 960px, same look as the
 * sign-in prompt; then form E). One day from a 7-day strip that starts tomorrow, or from a month calendar up to 60 days
 * ahead; one time every 30 minutes 08:00–20:00 under morning / afternoon / evening tabs; a phone and an optional
 * message. It goes to NESTYK admin. Esc, the close button and the backdrop close it; focus stays inside while open
 * and goes back to the opener.
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
  const timeId = useId();
  const errorId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const daysRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => bangkokToday(), []);
  const strip = useMemo(() => stripDays(today), [today]);
  const months = useMemo(() => calendarMonths(today), [today]);
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [period, setPeriod] = useState<ViewingPeriod>('morning');
  const [calendar, setCalendar] = useState<{ open: boolean; month: number }>({
    open: false,
    month: 0,
  });
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [sending, setSending] = useState(false);
  const [sentPhone, setSentPhone] = useState<string | null>(null);
  const wide = useWideScreen();
  // Wide screens: the calendar is always there. Phones: the 7-day strip, with the calendar one tap away.
  const showCalendar = wide || calendar.open;
  const calendarMoved = useRef(false);
  const closeCalendarRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const opener = returnFocus?.current ?? null;
    panelRef.current?.querySelector<HTMLElement>('.nk-vr__day, .nk-vr-cal__day:not(:disabled)')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        // Esc first closes an open calendar, then the form.
        if (closeCalendarRef.current) closeCalendarRef.current();
        else onClose();
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

  // Opening the calendar moves focus into it; closing it brings focus back to the picked day (or the calendar chip).
  useEffect(() => {
    if (!calendarMoved.current) return;
    const panel = panelRef.current;
    if (!panel) return;
    const pick = (selected: string, fallback: string) =>
      panel.querySelector<HTMLElement>(selected) ?? panel.querySelector<HTMLElement>(fallback);
    const target = calendar.open
      ? pick('.nk-vr-cal__day.is-on', '.nk-vr-cal__day:not(:disabled)')
      : pick('.nk-vr__day.is-on', '.nk-vr__day--cal');
    target?.focus();
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [calendar.open]);

  // After sending, focus the confirmation's first button.
  useEffect(() => {
    if (sentPhone) panelRef.current?.querySelector<HTMLElement>('.nk-vr__done a, .nk-vr__done button')?.focus();
  }, [sentPhone]);

  const scrollDays = (direction: 1 | -1) => {
    const row = daysRef.current;
    if (row)
      row.scrollBy({
        left: direction * row.clientWidth * 0.8,
        behavior: 'smooth',
      });
  };

  const openCalendar = () => {
    calendarMoved.current = true;
    const at = day ? months.indexOf(day.slice(0, 7)) : 0;
    setCalendar({ open: true, month: Math.max(0, at) });
  };

  const closeCalendar = () => {
    calendarMoved.current = true;
    setCalendar((current) => ({ ...current, open: false }));
  };

  closeCalendarRef.current = calendar.open && !wide ? closeCalendar : null;

  const pickDay = (value: string) => {
    setDay(value);
    if (problem === 'needDate') setProblem(null);
    if (calendar.open && !wide) closeCalendar();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;
    const local = formProblem({ day, time, phone });
    if (local || !day || !time) {
      setProblem(local ?? 'needDate');
      return;
    }
    // Left open past midnight: tomorrow may have become today, which the API refuses.
    if (!isPickableDay(bangkokToday(), day)) {
      setDay(null);
      setProblem('needDate');
      return;
    }
    setSending(true);
    setProblem(null);
    const auth = await guestSessionToken();
    const result: SendResult = auth
      ? await sendViewingRequest(auth.token, {
          roomId: room.id,
          preferredAt: preferredAt(day, time),
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
    needTime: copy.errorNeedTime,
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
  const periodName: Record<ViewingPeriod, string> = {
    morning: copy.periodMorning,
    afternoon: copy.periodAfternoon,
    evening: copy.periodEvening,
  };
  // A day picked from the calendar beyond the first 7 joins the strip as its last chip.
  const chips = day && !strip.includes(day) ? [...strip, day] : strip;
  const month = months[calendar.month] ?? months[0];
  const fullDay = (value: string) =>
    formatDay(value, locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(intlLocale(locale), {
      weekday: 'short',
      timeZone: 'UTC',
    }).format(new Date(A_SUNDAY + i * 86400000)),
  );

  const roomCard = (
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
  );

  return createPortal(
    <div className="nk-prompt nk-vr" data-testid="viewingRequest">
      <div className="nk-prompt__backdrop" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        className={sentPhone ? 'nk-prompt__panel nk-vr__panel' : 'nk-prompt__panel nk-vr__panel nk-vr__panel--form'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <span className="nk-prompt__handle" aria-hidden="true" />
        <div className="nk-vr__head">
          <h2 id={titleId} className="nk-prompt__title">
            {sentPhone ? copy.doneTitle : copy.formTitle}
          </h2>
          <button type="button" className="nk-prompt__close" aria-label={copy.close} onClick={onClose} data-testid="viewingRequest.close">
            <CloseIcon size={20} />
          </button>
        </div>
        {sentPhone ? (
          <div className="nk-vr__done" data-testid="viewingRequest.done">
            {roomCard}
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
          <form className="nk-vr__form" onSubmit={submit} noValidate>
            {/* Wide screens: day and time on the left, the room and the contact on the right, no scrolling. */}
            <div className="nk-vr__pick">
              <fieldset className="nk-vr__field nk-vr__field--dates">
                <legend className="nk-vr__label" id={datesId}>
                  <span>
                    {copy.datesLabel} <span className="nk-vr__hint">{copy.datesHint}</span>
                  </span>
                </legend>
                {calendar.open && !wide ? (
                  <button type="button" className="nk-vr__back" onClick={closeCalendar} data-testid="viewingRequest.calendarBack">
                    {copy.calendarBack}
                  </button>
                ) : null}

                {showCalendar ? (
                  <div className="nk-vr-cal" data-testid="viewingRequest.calendar">
                    <div className="nk-vr-cal__head">
                      <button
                        type="button"
                        className="nk-vr-cal__nav"
                        aria-label={copy.prevMonth}
                        disabled={calendar.month <= 0}
                        onClick={() =>
                          setCalendar((current) => ({
                            ...current,
                            month: current.month - 1,
                          }))
                        }
                      >
                        <ChevronLeftIcon size={18} />
                      </button>
                      <span className="nk-vr-cal__month" aria-live="polite">
                        {formatDay(`${month}-01`, locale, {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                      <button
                        type="button"
                        className="nk-vr-cal__nav"
                        aria-label={copy.nextMonth}
                        disabled={calendar.month >= months.length - 1}
                        onClick={() =>
                          setCalendar((current) => ({
                            ...current,
                            month: current.month + 1,
                          }))
                        }
                      >
                        <ChevronRightIcon size={18} />
                      </button>
                    </div>
                    <div className="nk-vr-cal__week" aria-hidden="true">
                      {weekdays.map((name) => (
                        <span key={name}>{name}</span>
                      ))}
                    </div>
                    <div className="nk-vr-cal__grid">
                      {monthGrid(month).map((cell, i) =>
                        cell ? (
                          <button
                            key={cell}
                            type="button"
                            className={cell === day ? 'nk-vr-cal__day is-on' : 'nk-vr-cal__day'}
                            aria-pressed={cell === day}
                            aria-label={fullDay(cell)}
                            disabled={!isPickableDay(today, cell)}
                            onClick={() => pickDay(cell)}
                          >
                            {Number(cell.slice(8))}
                          </button>
                        ) : (
                          <span key={`blank-${i}`} aria-hidden="true" />
                        ),
                      )}
                    </div>
                    <p className="nk-vr-cal__limit">
                      {fillTemplate(copy.calendarLimit, {
                        date: formatDay(lastPickableDay(today), locale, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        }),
                      })}
                    </p>
                  </div>
                ) : (
                  <div className="nk-vr__days-row">
                    <button type="button" className="nk-vr__scroll" aria-label={copy.prevDays} onClick={() => scrollDays(-1)}>
                      <ChevronLeftIcon size={18} />
                    </button>
                    <div ref={daysRef} className="nk-vr__days" data-testid="viewingRequest.days">
                      {chips.map((value, i) => {
                        const on = value === day;
                        const first = i === 0;
                        const showMonth = first || value.endsWith('-01') || i >= strip.length;
                        return (
                          <button
                            key={value}
                            type="button"
                            className={on ? 'nk-vr__day is-on' : 'nk-vr__day'}
                            aria-pressed={on}
                            title={fullDay(value)}
                            onClick={() => pickDay(value)}
                          >
                            <span className="nk-vr__day-week">
                              {first
                                ? copy.tomorrow
                                : formatDay(value, locale, {
                                    weekday: 'short',
                                  })}
                            </span>
                            <span className="nk-vr__day-num">{Number(value.slice(8))}</span>
                            {showMonth ? <span className="nk-vr__day-month">{formatDay(value, locale, { month: 'short' })}</span> : null}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        className="nk-vr__day nk-vr__day--cal"
                        aria-label={copy.calendarOpen}
                        aria-expanded={false}
                        onClick={openCalendar}
                        data-testid="viewingRequest.calendarOpen"
                      >
                        <CalendarIcon size={20} />
                        <span className="nk-vr__day-week">{copy.calendar}</span>
                      </button>
                    </div>
                    <button type="button" className="nk-vr__scroll" aria-label={copy.nextDays} onClick={() => scrollDays(1)}>
                      <ChevronRightIcon size={18} />
                    </button>
                  </div>
                )}
              </fieldset>

              <fieldset className="nk-vr__field">
                <legend className="nk-vr__label" id={timeId}>
                  {copy.timeLabel}
                </legend>
                <div className="nk-vr__tabs" role="group" aria-labelledby={timeId}>
                  {VIEWING_PERIODS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={period === value ? 'nk-vr__tab is-on' : 'nk-vr__tab'}
                      aria-pressed={period === value}
                      onClick={() => setPeriod(value)}
                    >
                      <span className="nk-vr__tab-name">{periodName[value]}</span>
                      <span className="nk-vr__tab-range">{periodRange(value)}</span>
                    </button>
                  ))}
                </div>
                <div className="nk-vr__times" data-testid="viewingRequest.times">
                  {timesOf(period).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={value === time ? 'nk-vr__time is-on' : 'nk-vr__time'}
                      aria-pressed={value === time}
                      aria-label={`${periodName[period]} ${fillTemplate(copy.timeValue, { time: value })}`}
                      onClick={() => {
                        setTime(value);
                        if (problem === 'needTime') setProblem(null);
                      }}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="nk-vr__side">
              {roomCard}
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
                  aria-describedby={problem === 'needPhone' || problem === 'badPhone' ? errorId : undefined}
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

              <p className="nk-vr__note">
                <CalendarIcon size={16} />
                {copy.teamNote}
              </p>
              {/* Phones: stays at the bottom of the sheet while the form scrolls (Mos 24 Nov 2026). */}
              <div className="nk-vr__foot">
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

                <p
                  className={day && time ? 'nk-vr__summary' : 'nk-vr__summary is-empty'}
                  aria-live="polite"
                  data-testid="viewingRequest.summary"
                >
                  <CalendarIcon size={18} />
                  <span>
                    {day && time
                      ? fillTemplate(copy.summary, { date: fullDay(day), time: fillTemplate(copy.timeValue, { time }) })
                      : copy.summaryEmpty}
                  </span>
                </p>
                <button
                  type="submit"
                  className="nk-btn nk-btn--primary nk-vr__submit"
                  disabled={sending}
                  aria-busy={sending || undefined}
                  data-testid="viewingRequest.submit"
                >
                  {sending ? copy.sending : copy.submit}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
