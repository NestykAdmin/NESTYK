import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, BackHandler, Pressable } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { MobileButton } from '../components/MobileButton';
import { MobileInput } from '../components/MobileInput';
import { tokens } from '../theme/tokens';
import { useMobileTheme } from '../theme/ThemeContext';
import { formatAccountDeletionDate } from '../components/AccountDeletionNotice';

export type AccountDeletionPreview = {
  blocked: boolean;
  reasons: Array<'open_contract' | 'open_agent_contract' | 'unpaid_bill' | 'bill_awaiting_review' | 'unrefunded_deposit'>;
  scheduledFor: string | null;
  /** The API offers "delete now" (QA only). Missing means no. */
  deleteNowAvailable?: boolean;
};

export type AccountDeletionProof = { password: string; captchaToken?: string };

export const MobileDeleteAccountBody: React.FC<{
  onLoad: () => Promise<AccountDeletionPreview>;
  onDeleteNow: (proof: AccountDeletionProof) => Promise<void>;
  onSchedule: (proof: AccountDeletionProof) => Promise<void>;
  onCancelSchedule: () => Promise<void>;
  captcha?: React.ReactNode;
  captchaRequired?: boolean;
  captchaToken?: string | null;
  onCaptchaReset?: () => void;
}> = ({ onLoad, onDeleteNow, onSchedule, onCancelSchedule, captcha, captchaRequired, captchaToken, onCaptchaReset }) => {
  const { t, locale } = useLocale();
  const copy = t.mobile.account;
  const { theme } = useMobileTheme();
  const [preview, setPreview] = useState<AccountDeletionPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<'now' | 'later' | 'cancel' | null>(null);
  const [passwordStep, setPasswordStep] = useState(false);
  const [password, setPassword] = useState('');

  const reload = () => onLoad().then(setPreview);

  useEffect(() => {
    let cancelled = false;
    onLoad()
      .then((next) => { if (!cancelled) setPreview(next); })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error && cause.message ? cause.message : t.common.errorGeneric);
      });
    return () => { cancelled = true; };
  }, [onLoad, t.common.errorGeneric]);

  useEffect(() => {
    if (!pending) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (busy) return true;
      if (passwordStep) {
        setPasswordStep(false);
        setPassword('');
        return true;
      }
      setPending(null);
      return true;
    });
    return () => sub.remove();
  }, [pending, busy, passwordStep]);

  const closeDialog = () => {
    if (busy) return;
    setPending(null);
    setPasswordStep(false);
    setPassword('');
    setError(null);
  };

  const messageFor = (cause: unknown) => {
    const code = cause && typeof cause === 'object' && 'code' in cause ? String((cause as { code: unknown }).code) : '';
    if (code === 'WRONG_PASSWORD') return copy.password.incorrect;
    return cause instanceof Error && cause.message ? cause.message : t.common.errorGeneric;
  };

  const closeAfterRequest = () => {
    setPending(null);
    setPasswordStep(false);
    setPassword('');
  };

  /** `signedOut`: the account was deleted now, so there is no status to load (the host confirms and signs out). */
  const run = async (action: () => Promise<void>, signedOut = false) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      closeAfterRequest();
      if (!signedOut) await reload();
    } catch (cause) {
      const code = cause && typeof cause === 'object' && 'code' in cause ? String((cause as { code: unknown }).code) : '';
      if (code === 'REAUTH_REQUIRED') {
        // More than 5 minutes since the password was confirmed: ask for it again (the API checks it, QA A).
        setPassword('');
        setPasswordStep(true);
        setError(copy.deleteAccountReauth);
      } else if (code === 'ACCOUNT_DELETE_BLOCKED') {
        // QA B10: something new blocks deletion since the page opened: show the fresh reasons, not "HTTP 409".
        closeAfterRequest();
        await reload().catch(() => setError(t.common.errorGeneric));
      } else {
        setError(messageFor(cause));
      }
      onCaptchaReset?.();
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = () => {
    if (!password) {
      setError(copy.password.required);
      return;
    }
    if (captchaRequired && !captchaToken) {
      setError(t.mobile.auth.captchaRequired);
      return;
    }
    const proof = { password, ...(captchaToken ? { captchaToken } : {}) };
    void run(() => (pending === 'now' ? onDeleteNow(proof) : onSchedule(proof)), pending === 'now');
  };

  const scheduledLabel = preview?.scheduledFor
    // QA A10: Bangkok time, the same day as the banner (the device time zone must not move it).
    ? copy.deleteAccountScheduled.replace('{date}', formatAccountDeletionDate(preview.scheduledFor, locale))
    : '';

  return (
    <View style={styles.frame}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.body, { color: theme.textSecondary }]}>{copy.deleteAccountBody}</Text>
      {preview?.blocked ? (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.body, { color: theme.textHeading }]}>{copy.deleteAccountBlocked}</Text>
          {preview.reasons.map((reason) => (
            <Text key={reason} style={[styles.reason, { color: tokens.colors.danger }]}>{copy.deleteAccountReasons[reason]}</Text>
          ))}
        </View>
      ) : null}
      {preview?.scheduledFor ? (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.body, { color: theme.textHeading }]}>{scheduledLabel}</Text>
          <View style={styles.gap} />
          <MobileButton variant="outline" onPress={() => { setError(null); setPasswordStep(false); setPending('cancel'); }} disabled={busy}>
            {copy.deleteAccountCancel}
          </MobileButton>
        </View>
      ) : null}
      {error ? <Text style={[styles.reason, { color: tokens.colors.danger }]}>{error}</Text> : null}
      {!preview?.blocked && !preview?.scheduledFor ? (
        <>
          {preview?.deleteNowAvailable ? (
            <MobileButton onPress={() => setPending('now')} disabled={busy}>{copy.deleteAccountNow}</MobileButton>
          ) : null}
          <MobileButton variant="outline" onPress={() => setPending('later')} disabled={!preview || busy}>{copy.deleteAccountLater}</MobileButton>
        </>
      ) : null}
    </ScrollView>
    {pending ? (
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeDialog} accessibilityRole="button" accessibilityLabel={t.common.cancel} />
        <View style={[styles.dialog, { backgroundColor: theme.card }]}>
          <Text style={[styles.dialogTitle, { color: theme.textHeading }]}>
            {pending === 'cancel' ? copy.deleteAccountCancel : copy.deleteAccountConfirm}
          </Text>
          <Text style={[styles.body, styles.dialogBody, { color: theme.textSecondary }]}>
            {passwordStep
              ? copy.deleteAccountPasswordPrompt
              : pending === 'cancel'
                ? copy.deleteAccountCancelConfirm
                : pending === 'now'
                  ? copy.deleteAccountConfirmNow
                  : copy.deleteAccountConfirmLater}
          </Text>
          {passwordStep ? (
            <>
              <MobileInput
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholder={copy.password.current}
                autoComplete="current-password"
              />
              {captcha}
            </>
          ) : null}
          {error ? <Text style={[styles.reason, { color: tokens.colors.danger, textAlign: 'center' }]}>{error}</Text> : null}
          <MobileButton
            onPress={() => {
              if (passwordStep) {
                submitPassword();
                return;
              }
              if (pending === 'cancel') {
                void run(onCancelSchedule);
                return;
              }
              setError(null);
              setPassword('');
              setPasswordStep(true);
              onCaptchaReset?.();
            }}
            isLoading={busy}
            disabled={busy}
            style={pending === 'cancel' ? undefined : styles.dangerButton}
            textStyle={pending === 'cancel' ? undefined : styles.dangerButtonText}
          >
            {t.common.confirm}
          </MobileButton>
          <MobileButton variant="outline" onPress={closeDialog} disabled={busy}>{t.common.cancel}</MobileButton>
        </View>
      </View>
    ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  frame: { flex: 1 },
  content: { paddingBottom: 24, gap: 14 },
  body: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 21 },
  reason: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20, marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  gap: { height: 12 },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(33,30,30,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 20,
  },
  dialog: { width: '100%', maxWidth: 360, borderRadius: 24, padding: 24, gap: 12, zIndex: 1 },
  dialogTitle: { fontFamily: tokens.typography.native.headingTh, fontSize: 22, lineHeight: 33, textAlign: 'center' },
  dialogBody: { textAlign: 'center' },
  dangerButton: { backgroundColor: tokens.colors.danger },
  dangerButtonText: { color: '#FFFFFF' },
});
