'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { fillTemplate, useLocale } from '@nestyk/i18n';
import { Link, usePathname } from '../../../i18n/navigation';
import {
  SAVED_ROOMS_LIMIT,
  fetchSavedIds,
  setRoomSaved,
  withSaved,
  type SavedToggleResult,
} from '../../../lib/guest-saved';
import { guestSessionToken } from '../../../lib/guest-supabase';
import { CloseIcon, HeartIcon } from './GuestIcons';
import { useGuestSession } from './GuestSession';

/**
 * Which rooms the signed-in account saved (AUTH-3, nestyk-auth3-saved-rooms-plan-20261113.md 2.3).
 * - Signed out (or still checking): "off". Hearts open the sign-in prompt as before (S4).
 * - Signed in: the ids load once per account; signing out clears them. While they load, presses wait ('busy');
 *   when they failed, the next press loads them again first (review R5).
 * - A press changes the heart at once and puts it back when the API says no.
 * - One press per room at a time; a second press while the first is on its way is ignored.
 * - Every call checks that the token still belongs to the account that pressed (review R9).
 * - A short toast after every press (Mos 13 Nov 2026), above the tab bar on small screens.
 */
export type SavedRoomsStatus = 'off' | 'loading' | 'ready' | 'error';

type SavedRoomsValue = {
  status: SavedRoomsStatus;
  isSaved: (roomId: string) => boolean;
  isPending: (roomId: string) => boolean;
  /**
   * Saves an unsaved room or unsaves a saved one. Resolves with what happened; 'busy' when the hearts are still
   * loading or this room is already on its way. `trigger` gets the focus back when the toast is closed.
   */
  toggle: (roomId: string, trigger?: HTMLElement | null) => Promise<SavedToggleResult | 'busy'>;
};

type NoticeKind = 'saved' | 'removed' | 'saveFailed' | 'removeFailed' | 'limit' | 'gone' | 'signedOut';
type Notice = { id: number; kind: NoticeKind; trigger: HTMLElement | null };
type ToastValue = { notice: Notice | null; dismiss: () => void };

const EMPTY: ReadonlySet<string> = new Set();
const TOAST_MS = 4000;
const PROBLEMS: ReadonlySet<NoticeKind> = new Set(['saveFailed', 'removeFailed', 'limit', 'gone', 'signedOut']);

const SavedRoomsContext = createContext<SavedRoomsValue>({
  status: 'off',
  isSaved: () => false,
  isPending: () => false,
  toggle: async () => 'signedOut',
});
const SavedToastContext = createContext<ToastValue>({ notice: null, dismiss: () => {} });

/** Saved ids of `owner`, or null when they could not be read or the sign-in now belongs to someone else. */
async function loadIds(owner: string, signal?: AbortSignal): Promise<ReadonlySet<string> | null> {
  const auth = await guestSessionToken();
  if (!auth || auth.userId !== owner) return null;
  const loaded = await fetchSavedIds(auth.token, undefined, signal);
  return loaded ? new Set(loaded) : null;
}

function noticeKind(result: SavedToggleResult, wanted: boolean): NoticeKind {
  if (result === 'ok') return wanted ? 'saved' : 'removed';
  if (result === 'failed') return wanted ? 'saveFailed' : 'removeFailed';
  return result;
}

export function SavedRoomsProvider({ children }: { children: React.ReactNode }) {
  const session = useGuestSession();
  const userId = session.status === 'signedIn' ? session.profile.userId : null;
  const [status, setStatusState] = useState<SavedRoomsStatus>('off');
  const [ids, setIdsState] = useState<ReadonlySet<string>>(EMPTY);
  const [pending, setPending] = useState<ReadonlySet<string>>(EMPTY);
  const [notice, setNotice] = useState<Notice | null>(null);
  const statusRef = useRef(status);
  const idsRef = useRef(ids);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const userRef = useRef(userId);
  userRef.current = userId;
  const noticeId = useRef(0);

  // State and refs move together, so a press reads what the screen shows.
  const setStatus = useCallback((next: SavedRoomsStatus) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);
  const setIds = useCallback((next: ReadonlySet<string>) => {
    idsRef.current = next;
    setIdsState(next);
  }, []);
  const notify = useCallback((kind: NoticeKind, trigger: HTMLElement | null) => {
    noticeId.current += 1;
    setNotice({ id: noticeId.current, kind, trigger });
  }, []);

  // Load once per account; clear on sign-out.
  useEffect(() => {
    setIds(EMPTY);
    setPending(EMPTY);
    setNotice(null);
    if (!userId) {
      setStatus('off');
      return;
    }
    setStatus('loading');
    const controller = new AbortController();
    void loadIds(userId, controller.signal).then((loaded) => {
      if (controller.signal.aborted) return;
      if (loaded) setIds(loaded);
      setStatus(loaded ? 'ready' : 'error');
    });
    return () => controller.abort();
  }, [userId, setIds, setStatus]);

  const toggle = useCallback(
    async (roomId: string, trigger: HTMLElement | null = null): Promise<SavedToggleResult | 'busy'> => {
      const owner = userRef.current;
      if (!owner) return 'signedOut';
      if (statusRef.current === 'loading') return 'busy';
      if (pendingRef.current.has(roomId)) return 'busy';
      setPending((current) => withSaved(current, roomId, true));
      const done = () => setPending((current) => withSaved(current, roomId, false));

      // The first load failed: try it again, so the heart knows whether this press saves or unsaves.
      if (statusRef.current === 'error') {
        const loaded = await loadIds(owner);
        if (userRef.current !== owner) return 'failed';
        if (!loaded) {
          done();
          notify('saveFailed', trigger);
          return 'failed';
        }
        setIds(loaded);
        setStatus('ready');
      }

      const want = !idsRef.current.has(roomId);
      setIds(withSaved(idsRef.current, roomId, want));
      const auth = await guestSessionToken();
      const result: SavedToggleResult = !auth
        ? 'signedOut'
        : auth.userId !== owner
          ? 'failed'
          : await setRoomSaved(auth.token, roomId, want);
      // The account changed while this was on its way: its list was cleared and reloaded, leave it alone.
      if (userRef.current !== owner) return result;
      if (result !== 'ok') setIds(withSaved(idsRef.current, roomId, !want));
      done();
      notify(noticeKind(result, want), trigger);
      return result;
    },
    [notify, setIds, setStatus],
  );

  const value = useMemo<SavedRoomsValue>(
    () => ({
      status,
      isSaved: (roomId) => ids.has(roomId),
      isPending: (roomId) => pending.has(roomId),
      toggle,
    }),
    [status, ids, pending, toggle],
  );
  const dismiss = useCallback(() => setNotice(null), []);
  const toast = useMemo<ToastValue>(() => ({ notice, dismiss }), [notice, dismiss]);
  return (
    <SavedRoomsContext.Provider value={value}>
      <SavedToastContext.Provider value={toast}>{children}</SavedToastContext.Provider>
    </SavedRoomsContext.Provider>
  );
}

export function useSavedRooms(): SavedRoomsValue {
  return useContext(SavedRoomsContext);
}

/**
 * The note after a heart press, placed once by GuestShell. Both live regions stay in the page so screen readers
 * hear each new note: done → polite status, a problem → alert (review R6). It hides after 4 seconds, but waits while
 * the pointer or the keyboard is on it (WCAG 2.2.1). Closing it puts the focus back on the heart that was pressed.
 */
export function SavedRoomsToast() {
  const { notice, dismiss } = useContext(SavedToastContext);
  const { t } = useLocale();
  const copy = t.guest.saved;
  const pathname = usePathname();
  const [held, setHeld] = useState(false);

  // A note that went away cannot be held any more.
  useEffect(() => {
    if (!notice) setHeld(false);
  }, [notice]);

  useEffect(() => {
    if (!notice || held) return;
    const timer = window.setTimeout(dismiss, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [notice, held, dismiss]);

  const returnFocus = useCallback(() => {
    const trigger = notice?.trigger;
    dismiss();
    if (trigger?.isConnected) trigger.focus();
  }, [notice, dismiss]);

  const text: Record<NoticeKind, string> = {
    saved: copy.toastSaved,
    removed: copy.toastRemoved,
    saveFailed: copy.toastFailed,
    removeFailed: copy.toastRemoveFailed,
    limit: fillTemplate(copy.toastLimit, { count: SAVED_ROOMS_LIMIT }),
    gone: copy.toastGone,
    signedOut: copy.toastSignIn,
  };
  const problem = notice != null && PROBLEMS.has(notice.kind);
  const savedHref = '/saved';
  const showLink = notice?.kind === 'saved' && pathname !== savedHref;

  const body = notice ? (
    <div
      key={notice.id}
      className={problem ? 'nk-toast nk-toast--problem' : 'nk-toast'}
      data-testid="savedToast"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      {problem ? null : (
        <span className="nk-toast__icon" aria-hidden="true">
          <HeartIcon size={18} />
        </span>
      )}
      <span className="nk-toast__text">{text[notice.kind]}</span>
      {showLink ? (
        <Link href={savedHref} className="nk-toast__action" onClick={dismiss} data-testid="savedToast.view">
          {copy.viewSaved}
        </Link>
      ) : null}
      <button type="button" className="nk-toast__close" aria-label={t.guest.signInPrompt.close} onClick={returnFocus}>
        <CloseIcon size={16} />
      </button>
    </div>
  ) : null;

  return (
    <>
      <div className="nk-toast-region" role="status" aria-live="polite" data-testid="savedToast.region">
        {problem ? null : body}
      </div>
      <div className="nk-toast-region" role="alert" data-testid="savedToast.alerts">
        {problem ? body : null}
      </div>
    </>
  );
}
