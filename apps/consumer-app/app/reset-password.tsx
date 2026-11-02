import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedError, useLocale } from '@nestyk/i18n';
import { AccountCompleteModal, MobileButton, MobileInput, MobileNestykLogo, tokens, useMobileTheme } from '@nestyk/ui/native';
import { useAuth } from '../lib/auth/AuthContext';
import { openedPasswordResetLink } from '../lib/auth/supabase';
import { passwordIsStrong } from '../lib/auth/password-rules';
import { hcaptchaSiteKey } from '../lib/auth/hcaptcha-site-key';
import { HcaptchaField } from '../components/HcaptchaField';

type Step = 'email' | 'sent' | 'code' | 'password' | 'done';

export default function ResetPasswordScreen() {
  const { t, locale } = useLocale();
  const copy = t.mobile.auth;
  const { theme } = useMobileTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { requestPasswordReset, verifyRecoveryCode, saveResetPassword, enterAfterPasswordReset, isAuthenticated } = useAuth();
  const [step, setStep] = useState<Step>(openedPasswordResetLink ? 'password' : 'email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const captchaRequired = hcaptchaSiteKey().length > 0;
  const resetCaptcha = () => {
    setCaptchaToken(null);
    setCaptchaKey(captchaKey + 1);
  };

  useEffect(() => {
    if (isAuthenticated && step === 'email') router.replace('/');
  }, [isAuthenticated, router, step]);

  useEffect(() => {
    if (step !== 'code' || resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, resendIn]);

  const fieldStyle = { backgroundColor: theme.card, borderColor: theme.border, color: theme.textHeading };
  const title = step === 'password' || step === 'done' ? copy.resetNewTitle : copy.resetTitle;

  const sendEmail = async () => {
    if (loading) return;
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(copy.invalidEmail);
      return;
    }
    if (captchaRequired && !captchaToken) {
      setError(copy.captchaRequired);
      return;
    }
    setLoading(true);
    try {
      const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined'
        ? `${window.location.origin}/reset-password`
        : undefined;
      await requestPasswordReset(email, captchaToken ?? undefined, redirectTo);
      resetCaptcha();
      setStep('sent');
    } catch (e) {
      resetCaptcha();
      setError(localizedError(e, copy.registrationFailed, locale));
    } finally {
      setLoading(false);
    }
  };

  const checkCode = async () => {
    if (loading) return;
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError(copy.otpInvalid);
      return;
    }
    setLoading(true);
    try {
      await verifyRecoveryCode(email, code.trim());
      setStep('password');
    } catch (e) {
      setError(localizedError(e, copy.otpInvalid, locale));
    } finally {
      setLoading(false);
    }
  };

  const savePassword = async () => {
    if (loading) return;
    setError(null);
    if (!passwordIsStrong(password)) {
      setError(copy.passwordRules);
      return;
    }
    if (password !== confirmation) {
      setError(copy.passwordMismatch);
      return;
    }
    setLoading(true);
    try {
      await saveResetPassword(password);
      setStep('done');
    } catch (e) {
      setError(localizedError(e, copy.registrationFailed, locale));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Image source={require('../assets/login-apartment.jpg')} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View pointerEvents="none" style={styles.shade} />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.column}>
            <MobileNestykLogo variant="wordmarkOnDark" height={34} />
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text accessibilityRole="header" style={[styles.title, {
                color: theme.textHeading,
                fontFamily: locale === 'en' ? tokens.typography.native.headingEn : tokens.typography.native.headingTh,
              }]}>{title}</Text>
              {step === 'sent' ? <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{copy.resetLinkSent}</Text> : null}
              {step === 'code' ? <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{copy.emailConfirmationBody}</Text> : null}
              {step === 'password' ? <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{copy.resetNewSubtitle}</Text> : null}
              {step === 'email' ? (
                <View style={styles.field}>
                  <Text style={[styles.label, { color: theme.textHeading }]}>{copy.email}</Text>
                  <MobileInput accessibilityLabel={copy.email} value={email} onChangeText={setEmail}
                    keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email"
                    editable={!loading} style={fieldStyle} />
                </View>
              ) : null}
              {step === 'code' ? (
                <View style={styles.field}>
                  <Text style={[styles.label, { color: theme.textHeading }]}>{copy.otpCode}</Text>
                  <MobileInput accessibilityLabel={copy.otpCode} value={code} onChangeText={setCode}
                    keyboardType="number-pad" maxLength={6} editable={!loading} style={fieldStyle} />
                </View>
              ) : null}
              {step === 'password' ? (
                <>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: theme.textHeading }]}>{copy.password}</Text>
                    <MobileInput accessibilityLabel={copy.password} value={password} onChangeText={setPassword}
                      secureTextEntry autoCapitalize="none" autoCorrect={false} helperText={copy.passwordRules}
                      editable={!loading} style={fieldStyle} />
                  </View>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: theme.textHeading }]}>{copy.confirmPassword}</Text>
                    <MobileInput accessibilityLabel={copy.confirmPassword} value={confirmation} onChangeText={setConfirmation}
                      secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!loading} style={fieldStyle} />
                  </View>
                </>
              ) : null}
              {captchaRequired && (step === 'email' || step === 'code') ? <HcaptchaField resetKey={captchaKey} onToken={setCaptchaToken} /> : null}
              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              {step === 'email' ? <MobileButton onPress={() => { void sendEmail(); }} isLoading={loading} disabled={loading}>{copy.resetSend}</MobileButton> : null}
              {step === 'code' ? <MobileButton onPress={() => { void checkCode(); }} isLoading={loading} disabled={loading}>{copy.otpCode}</MobileButton> : null}
              {step === 'password' ? <MobileButton onPress={() => { void savePassword(); }} isLoading={loading} disabled={loading}>{copy.resetNewTitle}</MobileButton> : null}
              {step === 'code' ? (
                <MobileButton variant="outline" disabled={loading || resendIn > 0} onPress={() => { void sendEmail(); }}>
                  {resendIn > 0 ? copy.resendWait.replace('{seconds}', String(resendIn)) : copy.resendCode}
                </MobileButton>
              ) : null}
              {step !== 'done' ? (
                <MobileButton variant="outline" disabled={loading} onPress={() => router.replace('/login')}>
                  {copy.backToLogin}
                </MobileButton>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <AccountCompleteModal
        visible={step === 'done'}
        title={copy.resetNewTitle}
        body={copy.resetDone}
        onClose={() => {
          void enterAfterPasswordReset().finally(() => router.replace('/'));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(25,18,10,0.22)' },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 },
  column: { width: '100%', maxWidth: 460, alignSelf: 'center', gap: 24 },
  card: { borderRadius: 24, padding: 24, gap: 14 },
  title: { fontSize: 26, lineHeight: 39 },
  subtitle: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 21 },
  field: { gap: 6 },
  label: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20 },
  body: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20 },
  link: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  error: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20, color: tokens.colors.error },
});
