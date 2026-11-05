/**
 * Web toast + confirm (plan step 2, A6 · decisions N-Q2 and E3, Mos 4 Nov 2026).
 * On the web react-native's `Alert.alert` shows nothing. `WebNotifier.web.tsx` replaces it once at start-up and
 * sends every call here: messages without choices become a toast (bottom right; success and info close after 4 s,
 * errors stay until closed), messages with choices become a confirm dialog. Call sites do not change, and the phone
 * app keeps the native Alert. Pure module: no React, no platform code.
 */

export type AlertButtonStyle = 'default' | 'cancel' | 'destructive';
export interface NotifyButton {
  text?: string;
  onPress?: (value?: string) => void;
  style?: AlertButtonStyle;
}
export interface NotifyOptions {
  cancelable?: boolean;
  onDismiss?: () => void;
}
export type NotifyTone = 'success' | 'error' | 'info';

export interface ToastNotice {
  id: number;
  kind: 'toast';
  title: string;
  message?: string;
  /** Times this same toast was asked for while it was showing (restarts its timer). */
  repeat: number;
}
export interface DialogNotice {
  id: number;
  kind: 'dialog';
  title: string;
  message?: string;
  buttons: NotifyButton[];
  options?: NotifyOptions;
}
export type Notice = ToastNotice | DialogNotice;

/** Success and info toasts close after this; errors stay until closed (E3). */
export const TOAST_MS = 4000;
/** At most this many toasts at once; the oldest goes first. */
export const MAX_TOASTS = 3;

/** A choice the user must make (2+ buttons, or a button that does something) is a dialog; anything else a toast. */
export function isDialog(buttons?: NotifyButton[] | null): boolean {
  const list = buttons ?? [];
  return list.length >= 2 || list.some((button) => typeof button.onPress === 'function');
}

/* ---------------------------------------------------------------------------- tone (from the i18n key names) */

/** i18n keys whose text is an error or a missing input: shown as an error toast that stays. */
const ERROR_KEY = /(error|fail|failed|required|exhausted|denied|invalid|incorrect|mismatch|blocked)/i;
/** i18n keys whose text reports something done. */
const SUCCESS_KEY = /(saved|success|copied|updated|signedout|done$)/i;

export interface ToneTables {
  error: Set<string>;
  success: Set<string>;
}

/** Collects the texts of the current language by key name, so a call site's title tells the tone. */
export function buildToneTables(copy: unknown): ToneTables {
  const tables: ToneTables = { error: new Set(), success: new Set() };
  const walk = (value: unknown, key: string, depth: number) => {
    if (depth > 12 || value == null) return;
    if (typeof value === 'string') {
      const text = value.trim();
      if (!text) return;
      if (ERROR_KEY.test(key)) tables.error.add(text);
      else if (SUCCESS_KEY.test(key)) tables.success.add(text);
      return;
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      for (const [child, inner] of Object.entries(value as Record<string, unknown>)) walk(inner, child, depth + 1);
    }
  };
  walk(copy, '', 0);
  return tables;
}

/** Error when the title or message is an error text; success when one is a "done" text; else info. */
export function toneOf(title: string, message: string | undefined, tables: ToneTables): NotifyTone {
  const texts = [title, message].map((text) => (text ?? '').trim()).filter(Boolean);
  if (texts.some((text) => tables.error.has(text))) return 'error';
  if (texts.some((text) => tables.success.has(text))) return 'success';
  return 'info';
}

/* ---------------------------------------------------------------------------- store */

type Listener = (notices: readonly Notice[]) => void;

export interface NoticeStore {
  push(title: unknown, message?: unknown, buttons?: NotifyButton[] | null, options?: NotifyOptions | null): Notice;
  dismiss(id: number): void;
  list(): readonly Notice[];
  subscribe(listener: Listener): () => void;
}

const text = (value: unknown) => (typeof value === 'string' ? value : value == null ? '' : String(value));

export function createNoticeStore(): NoticeStore {
  let notices: Notice[] = [];
  let nextId = 1;
  const listeners = new Set<Listener>();
  const emit = () => {
    for (const listener of listeners) listener(notices);
  };
  return {
    push(rawTitle, rawMessage, buttons, options) {
      const title = text(rawTitle);
      const message = text(rawMessage) || undefined;
      if (isDialog(buttons)) {
        const dialog: DialogNotice = {
          id: nextId++,
          kind: 'dialog',
          title,
          message,
          buttons: [...(buttons ?? [])],
          options: options ?? undefined,
        };
        notices = [...notices, dialog];
        emit();
        return dialog;
      }
      // The same toast again while it shows (double click, retry): restart it instead of stacking a copy.
      const same = notices.find((n): n is ToastNotice => n.kind === 'toast' && n.title === title && n.message === message);
      if (same) {
        const again: ToastNotice = { ...same, repeat: same.repeat + 1 };
        notices = notices.map((n) => (n.id === same.id ? again : n));
        emit();
        return again;
      }
      const toast: ToastNotice = { id: nextId++, kind: 'toast', title, message, repeat: 0 };
      const toasts = notices.filter((n) => n.kind === 'toast');
      const drop = toasts.length >= MAX_TOASTS ? new Set(toasts.slice(0, toasts.length - MAX_TOASTS + 1).map((n) => n.id)) : null;
      notices = [...notices.filter((n) => !drop?.has(n.id)), toast];
      emit();
      return toast;
    },
    dismiss(id) {
      const before = notices.length;
      notices = notices.filter((n) => n.id !== id);
      if (notices.length !== before) emit();
    },
    list() {
      return notices;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The button a dismiss (Esc, backdrop, ×) stands for: the "cancel" one, if the call site gave one. */
export function cancelButton(buttons: NotifyButton[]): NotifyButton | undefined {
  return buttons.find((button) => button.style === 'cancel');
}

/** Cancel first, the main choice last (web dialog order); the rest keep the call site's order. */
export function dialogButtonOrder(buttons: NotifyButton[]): NotifyButton[] {
  return [...buttons.filter((b) => b.style === 'cancel'), ...buttons.filter((b) => b.style !== 'cancel')];
}
