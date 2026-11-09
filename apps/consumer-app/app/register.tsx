import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedError, useLocale } from '@nestyk/i18n';
import { MobileButton, MobileIcon, MobileInput, MobileNestykLogo, SelectionCheck, tokens, useMobileTheme } from '@nestyk/ui/native';
import { useAuth } from '../lib/auth/AuthContext';
import { socialLoginProvider } from '../lib/auth/google-oauth';
import { passwordIsStrong } from '../lib/auth/password-rules';
import { hcaptchaSiteKey } from '../lib/auth/hcaptcha-site-key';
import { HcaptchaField } from '../components/HcaptchaField';
import { AuthLegalFooter } from '../components/legal/AuthLegalFooter';
import { ConsentLabel } from '../components/legal/ConsentLabel';
import { PhoneField } from '../components/PhoneField';
import { phoneDraftToE164, type PhoneDraft } from '../lib/phone';

function GoogleMark() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" accessible={false}>
      <Path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" />
      <Path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.97-3.38.97-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z" />
      <Path fill="#FBBC05" d="M6.41 13.93a6 6 0 0 1 0-3.86V7.48H3.07a10 10 0 0 0 0 9.04l3.34-2.59Z" />
      <Path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.48l3.34 2.59C7.2 7.71 9.4 5.95 12 5.95Z" />
    </Svg>
  );
}

export default function RegisterScreen() {
  const { t, locale } = useLocale();
  const copy = t.mobile.auth;
  const { theme } = useMobileTheme();
  const { signUp, verifySignupCode, resendSignupCode, signInWithGoogle, signInWithFacebook, isAuthenticated } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState<PhoneDraft>({ region: 'TH', digits: '' });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [code, setCode] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [forTesting, setForTesting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [resendCaptcha, setResendCaptcha] = useState(false);
  const captchaRequired = hcaptchaSiteKey().length > 0;
  const resetCaptcha = () => {
    setCaptchaToken(null);
    setCaptchaKey(captchaKey + 1);
  };
  const showTestRegistration = typeof __DEV__ !== 'undefined' && __DEV__;
  const submitting = useRef(false);
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmationRef = useRef<TextInput>(null);

  React.useEffect(() => {
    if (isAuthenticated) router.replace('/');
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!needsEmailConfirmation || resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [needsEmailConfirmation, resendIn]);

  const onSubmit = async () => {
    if (submitting.current) return;
    setError(null);
    const phoneNumber = phoneDraftToE164(phone);
    if (!firstName.trim() || !lastName.trim() || !phoneNumber || !email.trim() || !password || !confirmation) {
      setError(copy.registrationRequiredFields);
      return;
    }
    if (!acceptedTerms) {
      setError(copy.acceptTermsRequired);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(copy.invalidEmail);
      return;
    }
    if (!passwordIsStrong(password)) {
      setError(copy.passwordRules);
      return;
    }
    if (password !== confirmation) {
      setError(copy.passwordMismatch);
      return;
    }
    if (captchaRequired && !forTesting && !captchaToken) {
      setError(copy.captchaRequired);
      return;
    }
    submitting.current = true;
    setLoading(true);
    try {
      const result = await signUp(email, password, firstName, lastName, phoneNumber, showTestRegistration && forTesting, captchaToken ?? undefined);
      resetCaptcha();
      if (result.needsEmailConfirmation) {
        setPassword('');
        setConfirmation('');
        setCode('');
        setResendIn(60);
        setNeedsEmailConfirmation(true);
      } else {
        router.replace('/');
      }
    } catch (e) {
      resetCaptcha();
      const code = e && typeof e === 'object' ? (e as { code?: string }).code : undefined;
      setError(code === 'SUPABASE_NOT_CONFIGURED'
        ? copy.registrationUnavailable
        : code === 'TEST_REGISTRATION_UNAVAILABLE'
          ? copy.testRegistrationUnavailable
          : code === 'REGISTRATION_FAILED' || code === 'REGISTRATION_INVALID_INPUT'
            ? copy.registrationFailed
            : localizedError(e, copy.registrationFailed, locale));
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (submitting.current) return;
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError(copy.otpInvalid);
      return;
    }
    const phoneNumber = phoneDraftToE164(phone) ?? '';
    submitting.current = true;
    setLoading(true);
    try {
      await verifySignupCode(email, code.trim(), { firstName, lastName, phone: phoneNumber });
      router.replace('/');
    } catch (e) {
      setError(localizedError(e, copy.otpInvalid, locale));
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  const sendCodeAgain = async () => {
    if (loading || resendIn > 0) return;
    setError(null);
    if (captchaRequired && !captchaToken) {
      setResendCaptcha(true);
      setError(copy.captchaRequired);
      return;
    }
    setLoading(true);
    try {
      await resendSignupCode(email, captchaToken ?? undefined);
      resetCaptcha();
      setResendCaptcha(false);
      setResendIn(60);
    } catch (e) {
      resetCaptcha();
      setError(localizedError(e, copy.registrationFailed, locale));
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = { backgroundColor: theme.card, borderColor: theme.border, color: theme.textHeading };
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
              }]}>{needsEmailConfirmation ? copy.emailConfirmationTitle : copy.registrationTitle}</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {needsEmailConfirmation ? copy.emailConfirmationBody : copy.registrationSubtitle}
              </Text>
              {!needsEmailConfirmation ? (
                <>
                  <View style={styles.field}>
                  <Text style={[styles.label, { color: theme.textHeading }]}>{t.mobile.account.firstName}</Text>
                  <MobileInput accessibilityLabel={t.mobile.account.firstName} value={firstName} onChangeText={setFirstName}
                    autoComplete="given-name" textContentType="givenName" maxLength={255} returnKeyType="next"
                    onSubmitEditing={() => lastNameRef.current?.focus()} editable={!loading} style={fieldStyle} />
                  </View>
                  <View style={styles.field}>
                  <Text style={[styles.label, { color: theme.textHeading }]}>{t.mobile.account.lastName}</Text>
                  <MobileInput ref={lastNameRef} accessibilityLabel={t.mobile.account.lastName} value={lastName} onChangeText={setLastName}
                    autoComplete="family-name" textContentType="familyName" maxLength={255} returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()} editable={!loading} style={fieldStyle} />
                  </View>
                  <PhoneField label={t.mobile.account.phone} value={phone} onChange={setPhone} required disabled={loading} />
                  <View style={styles.field}>
                  <Text style={[styles.label, { color: theme.textHeading }]}>{copy.email}</Text>
                  <MobileInput ref={emailRef} accessibilityLabel={copy.email} value={email} onChangeText={setEmail}
                    keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="username"
                    maxLength={255} returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} editable={!loading} style={fieldStyle} />
                  </View>
                  <View style={styles.field}>
                  <Text style={[styles.label, { color: theme.textHeading }]}>{copy.password}</Text>
                  <MobileInput ref={passwordRef} accessibilityLabel={copy.password} value={password} onChangeText={setPassword}
                    secureTextEntry={!passwordVisible} autoCapitalize="none" autoCorrect={false} autoComplete="new-password"
                    textContentType="newPassword" returnKeyType="next" helperText={copy.passwordRules}
                    onSubmitEditing={() => confirmationRef.current?.focus()} editable={!loading} style={fieldStyle} />
                  </View>
                  <View style={styles.field}>
                  <Text style={[styles.label, { color: theme.textHeading }]}>{copy.confirmPassword}</Text>
                  <MobileInput ref={confirmationRef} accessibilityLabel={copy.confirmPassword} value={confirmation} onChangeText={setConfirmation}
                    secureTextEntry={!passwordVisible} autoCapitalize="none" autoCorrect={false} autoComplete="new-password"
                    textContentType="newPassword" returnKeyType="go" onSubmitEditing={onSubmit} editable={!loading} style={fieldStyle} />
                  </View>
                  <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)} accessibilityRole="button"
                    accessibilityLabel={passwordVisible ? copy.hidePassword : copy.showPassword} accessibilityState={{ selected: passwordVisible }}
                    style={styles.visibility}>
                    <Text style={[styles.body, { color: theme.textSecondary }]}>{passwordVisible ? copy.hidePassword : copy.showPassword}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="checkbox" accessibilityLabel={copy.acceptTerms}
                    aria-checked={acceptedTerms}
                    accessibilityState={{ checked: acceptedTerms, disabled: loading }} disabled={loading}
                    activeOpacity={0.7} onPress={() => setAcceptedTerms(!acceptedTerms)} style={styles.testRegistration}>
                    <SelectionCheck selected={acceptedTerms} variant="row" />
                    <ConsentLabel fallback={copy.acceptTerms} linkColor={theme.textHeading} style={[styles.body, styles.testRegistrationLabel, { color: theme.textHeading }]} />
                  </TouchableOpacity>
                  {showTestRegistration ? (
                    <TouchableOpacity accessibilityRole="checkbox" accessibilityLabel={copy.testRegistration}
                      aria-checked={forTesting}
                      accessibilityState={{ checked: forTesting, disabled: loading }} disabled={loading}
                      activeOpacity={0.7} onPress={() => setForTesting(!forTesting)} style={styles.testRegistration}>
                      <SelectionCheck selected={forTesting} variant="row" />
                      <Text style={[styles.body, styles.testRegistrationLabel, { color: theme.textHeading }]}>{copy.testRegistration}</Text>
                    </TouchableOpacity>
                  ) : null}
                  {captchaRequired && !forTesting ? <HcaptchaField resetKey={captchaKey} onToken={setCaptchaToken} /> : null}
                  {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
                  <MobileButton onPress={onSubmit} isLoading={loading} disabled={loading}>{copy.registerButton}</MobileButton>
                  <View style={styles.dividerRow}>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    <Text style={[styles.dividerLabel, { color: theme.textSecondary }]}>{copy.registerOr}</Text>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  </View>
                  {([
                    { provider: 'Google', label: copy.registerWithGoogle, start: signInWithGoogle },
                    { provider: 'Facebook', label: copy.registerWithFacebook, start: signInWithFacebook },
                    { provider: 'Apple', label: copy.registerWithApple, start: null },
                  ] as const).map(({ provider, label, start }) => {
                    // Mos 9 Nov 2026: off until EXPO_PUBLIC_ENABLE_SOCIAL_LOGIN=true (Apple always): faded + "coming soon",
                    // a tap explains it instead of calling a provider that is not set up.
                    const ready = start !== null && socialLoginProvider(provider, process.env.EXPO_PUBLIC_ENABLE_SOCIAL_LOGIN) !== null;
                    return (
                      <TouchableOpacity
                        key={provider}
                        accessibilityRole="button"
                        accessibilityLabel={label}
                        accessibilityHint={ready ? undefined : copy.socialComingSoon}
                        disabled={loading}
                        activeOpacity={0.7}
                        onPress={() => {
                          if (loading) return;
                          setError(null);
                          if (!ready || !start) {
                            setNotice(copy.unavailable);
                            return;
                          }
                          setNotice(null);
                          setLoading(true);
                          void start()
                            .catch((e) => setError(localizedError(e, copy.registrationFailed, locale)))
                            .finally(() => setLoading(false));
                        }}
                        style={[styles.googleButton, { borderColor: theme.border, backgroundColor: theme.background }]}
                      >
                        <View style={[styles.socialInner, !ready && styles.socialSoon]}>
                          {provider === 'Google' ? (
                            <GoogleMark />
                          ) : (
                            <MobileIcon name={provider === 'Facebook' ? 'facebook' : 'apple'} size={22} color={provider === 'Facebook' ? '#1877F2' : theme.textHeading} weight="fill" />
                          )}
                          <Text style={[styles.googleLabel, { color: theme.textHeading }]}>{label}</Text>
                        </View>
                        {!ready ? <Text style={[styles.socialSoonText, { color: theme.textSecondary }]}>{copy.socialComingSoon}</Text> : null}
                      </TouchableOpacity>
                    );
                  })}
                  {notice ? (
                    <Text accessibilityLiveRegion="polite" style={[styles.socialNotice, { color: theme.textSecondary }]}>{notice}</Text>
                  ) : null}
                </>
              ) : (
                <>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: theme.textHeading }]}>{copy.otpCode}</Text>
                    <MobileInput accessibilityLabel={copy.otpCode} value={code} onChangeText={setCode}
                      keyboardType="number-pad" maxLength={6} editable={!loading} style={fieldStyle} />
                  </View>
                  {captchaRequired && resendCaptcha ? <HcaptchaField resetKey={captchaKey} onToken={setCaptchaToken} /> : null}
                  {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
                  <MobileButton onPress={() => { void verifyCode(); }} isLoading={loading} disabled={loading}>{copy.otpCode}</MobileButton>
                  <MobileButton variant="outline" disabled={loading || resendIn > 0} onPress={() => { void sendCodeAgain(); }}>
                    {resendIn > 0 ? copy.resendWait.replace('{seconds}', String(resendIn)) : copy.resendCode}
                  </MobileButton>
                  <TouchableOpacity accessibilityRole="button" disabled={loading} onPress={() => { setNeedsEmailConfirmation(false); setResendCaptcha(false); setError(null); }} style={styles.back}>
                    <Text style={[styles.body, { color: theme.textHeading }]}>{copy.changeEmail}</Text>
                  </TouchableOpacity>
                </>
              )}
              <MobileButton variant="outline" disabled={loading} onPress={() => router.replace('/login')}>
                {copy.backToLogin}
              </MobileButton>
            </View>
            <AuthLegalFooter testID="register.footer" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  subtitle: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 21, marginBottom: 4 },
  field: { gap: 6 },
  label: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20 },
  body: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20 },
  visibility: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  testRegistration: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  testRegistrationLabel: { flex: 1 },
  error: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20, color: tokens.colors.error },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { height: StyleSheet.hairlineWidth, flex: 1 },
  dividerLabel: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20 },
  googleButton: {
    minHeight: 48, borderRadius: 14, borderWidth: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  googleLabel: { fontFamily: tokens.typography.native.bodyBold, fontSize: 15, lineHeight: 22 },
  socialInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  socialSoon: { opacity: 0.45 },
  socialSoonText: { fontSize: 12, lineHeight: 18 },
  socialNotice: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  back: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
});
