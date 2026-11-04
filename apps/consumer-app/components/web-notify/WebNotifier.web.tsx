import React, { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { MobileIcon, useMobileTheme, type AppIconName } from '@nestyk/ui/native';
import { WebDialog } from '../agent-web/ui/WebDialog';
import {
  TOAST_MS,
  buildToneTables,
  cancelButton,
  createNoticeStore,
  dialogButtonOrder,
  toneOf,
  type DialogNotice,
  type Notice,
  type NotifyButton,
  type NotifyOptions,
  type NotifyTone,
  type ToastNotice,
} from '../../lib/web-notify';
import './web-notifier.css';

/** One queue for the whole web app (the root layout renders a single WebNotifier). */
export const webNotices = createNoticeStore();

/**
 * react-native-web's Alert.alert does nothing. Replace it once, when this module loads (the root layout imports it
 * before any screen), so every existing call shows a toast or a confirm dialog. Phones keep the native Alert:
 * this file is web only (WebNotifier.tsx is the native one).
 */
let alertReplaced = false;
export function replaceAlert(target: { alert: unknown } = Alert): void {
  if (alertReplaced && target === Alert) return;
  if (target === Alert) alertReplaced = true;
  target.alert = (title: unknown, message?: unknown, buttons?: NotifyButton[] | null, options?: NotifyOptions | null) => {
    webNotices.push(title, message, buttons, options);
  };
}
replaceAlert();

const TONE_ICON: Record<NotifyTone, AppIconName> = { success: 'check', error: 'warning', info: 'info' };

function Toast({
  notice,
  tone,
  closeLabel,
  iconColor,
  mutedColor,
  onClose,
}: {
  notice: ToastNotice;
  tone: NotifyTone;
  closeLabel: string;
  iconColor: string;
  mutedColor: string;
  onClose: () => void;
}) {
  const [paused, setPaused] = useState(false);
  // Success and info close by themselves; a pointer over the toast holds it. The same toast again restarts it.
  useEffect(() => {
    if (tone === 'error' || paused) return;
    const timer = setTimeout(onClose, TOAST_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tone, paused, notice.repeat]);
  return (
    <div
      className={`wn-toast wn-${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
      data-testid={`notify.toast.${tone}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className="wn-toast-icon" aria-hidden="true">
        <MobileIcon name={TONE_ICON[tone]} size={16} color={iconColor} weight="bold" />
      </span>
      <div className="wn-toast-text">
        {notice.title ? <strong>{notice.title}</strong> : null}
        {notice.message ? <span>{notice.message}</span> : null}
      </div>
      <button type="button" className="wn-toast-close" aria-label={closeLabel} onClick={onClose}>
        <MobileIcon name="close" size={14} color={mutedColor} />
      </button>
    </div>
  );
}

function buttonClass(button: NotifyButton, isMain: boolean): string {
  if (button.style === 'destructive') return 'wn-btn wn-btn-danger';
  if (button.style === 'cancel' || !isMain) return 'wn-btn wn-btn-secondary';
  return 'wn-btn wn-btn-primary';
}

function ConfirmDialog({ notice, okLabel }: { notice: DialogNotice; okLabel: string }) {
  const buttons = dialogButtonOrder(notice.buttons);
  const main = [...buttons].reverse().find((button) => button.style !== 'cancel' && button.style !== 'destructive');
  const choose = (button?: NotifyButton) => {
    webNotices.dismiss(notice.id);
    button?.onPress?.();
  };
  const dismiss = () => {
    const cancel = cancelButton(notice.buttons);
    webNotices.dismiss(notice.id);
    if (cancel) cancel.onPress?.();
    else notice.options?.onDismiss?.();
  };
  return (
    <WebDialog
      open
      size="sm"
      title={notice.title || okLabel}
      description={notice.message}
      testID="notify.dialog"
      onClose={dismiss}
      footer={buttons.map((button, index) => (
        <button
          key={`${index}-${button.text ?? ''}`}
          type="button"
          className={buttonClass(button, button === main)}
          data-testid={`notify.dialog.${button.style ?? 'default'}`}
          onClick={() => choose(button)}
        >
          {button.text || okLabel}
        </button>
      ))}
    />
  );
}

/** Web: toasts (bottom right) and the confirm dialog for every Alert.alert call. */
export function WebNotifier() {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const [notices, setNotices] = useState<readonly Notice[]>(() => webNotices.list());
  useEffect(() => {
    setNotices(webNotices.list());
    return webNotices.subscribe(setNotices);
  }, []);
  // Rebuilt when the language changes: the tone comes from which i18n key the title or message is.
  const tables = useMemo(() => buildToneTables(t), [t, locale]);
  const toasts = notices.filter((n): n is ToastNotice => n.kind === 'toast');
  const dialog = notices.find((n): n is DialogNotice => n.kind === 'dialog');
  const closeLabel = t.agent.dashboard.webWorkspace.close;
  const iconColor = (tone: NotifyTone) => (tone === 'error' ? '#B42318' : tone === 'success' ? '#1F6B43' : '#211E1E');
  return (
    <div
      className="wn-root"
      data-theme={theme.mode}
      style={
        {
          '--aw-surface': theme.surface,
          '--aw-ink': theme.screenTitle,
          '--aw-muted': theme.textSecondary,
          '--aw-border': theme.border,
        } as React.CSSProperties
      }
    >
      <div className="wn-toasts">
        {toasts.map((notice) => {
          const tone = toneOf(notice.title, notice.message, tables);
          return (
            <Toast
              key={notice.id}
              notice={notice}
              tone={tone}
              closeLabel={closeLabel}
              iconColor={iconColor(tone)}
              mutedColor={theme.textSecondary}
              onClose={() => webNotices.dismiss(notice.id)}
            />
          );
        })}
      </div>
      {dialog ? <ConfirmDialog key={dialog.id} notice={dialog} okLabel={t.mobile.account.done} /> : null}
    </div>
  );
}
