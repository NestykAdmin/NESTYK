import React, { useRef, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { localizedError, useLocale } from '@nestyk/i18n';
import { MobileButton, MobileInput, MobileNestykLogo, SelectionCheck, tokens, useMobileTheme } from '@nestyk/ui/native';
import { useAuth } from '../lib/auth/AuthContext';

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
  const { signUp, signInWithGoogle, isAuthenticated } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [forTesting, setForTesting] = useState(false);
  const showTestRegistration = typeof __DEV__ !== 'undefined' && __DEV__;
  const submitting = useRef(false);
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmationRef = useRef<TextInput>(null);

  React.useEffect(() => {
    if (isAuthenticated) router.replace('/');
  }, [isAuthenticated, router]);

  const onSubmit = async () => {
    if (submitting.current) return;
    setError(null);
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !confirmation) {
      setError(copy.registrationRequiredFields);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(copy.invalidEmail);
      return;
    }
    if (password.length < 8) {
      setError(copy.passwordTooShort);
      return;
    }
    if (password !== confirmation) {
      setError(copy.passwordMismatch);
      return;
    }
    submitting.current = true;
    setLoading(true);
    try {
      const result = await signUp(email, password, firstName, lastName, showTestRegistration && forTesting);
      if (result.needsEmailConfirmation) {
        setPassword('');
        setConfirmation('');
        setNeedsEmailConfirmation(true);
      } else {
        router.replace('/');
      }
    } catch (e) {
      const code = e && typeof e === 'object' ? (e as { code?: string }).code : undefined;
      setError(code === 'SUPABASE_NOT_CONFIGURED'
        ? copy.registrationUnavailable
        : code === 'TEST_REGISTRATION_UNAVAILABLE'
          ? copy.testRegistrationUnavailable
          : code === 'REGISTRATION_FAILED' || code === 'REGISTRATION_INVALID_INPUT'
            ? copy.registrationFailed
            : code === 'user_already_exists' || code === 'email_exists'
              ? copy.emailAlreadyRegistered
              : localizedError(e, copy.registrationFailed, locale));
    } finally {
      submitting.current = false;
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
                    textContentType="newPassword" returnKeyType="next" helperText={copy.passwordTooShort}
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
                  {showTestRegistration ? (
                    <TouchableOpacity accessibilityRole="checkbox" accessibilityLabel={copy.testRegistration}
                      aria-checked={forTesting}
                      accessibilityState={{ checked: forTesting, disabled: loading }} disabled={loading}
                      activeOpacity={0.7} onPress={() => setForTesting(!forTesting)} style={styles.testRegistration}>
                      <SelectionCheck selected={forTesting} variant="row" />
                      <Text style={[styles.body, styles.testRegistrationLabel, { color: theme.textHeading }]}>{copy.testRegistration}</Text>
                    </TouchableOpacity>
                  ) : null}
                  {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
                  <MobileButton onPress={onSubmit} isLoading={loading} disabled={loading}>{copy.registerButton}</MobileButton>
                  <View style={styles.dividerRow}>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    <Text style={[styles.dividerLabel, { color: theme.textSecondary }]}>{copy.registerOr}</Text>
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  </View>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={copy.registerWithGoogle}
                    disabled={loading}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (loading) return;
                      setError(null);
                      setLoading(true);
                      void signInWithGoogle()
                        .catch((e) => setError(localizedError(e, copy.registrationFailed, locale)))
                        .finally(() => setLoading(false));
                    }}
                    style={[styles.googleButton, { borderColor: theme.border, backgroundColor: theme.background }]}
                  >
                    <GoogleMark />
                    <Text style={[styles.googleLabel, { color: theme.textHeading }]}>{copy.registerWithGoogle}</Text>
                  </TouchableOpacity>
                </>
              ) : null}
              <TouchableOpacity onPress={() => router.replace('/login')} disabled={loading} accessibilityRole="button" style={styles.back}>
                <Text style={[styles.body, { color: theme.textHeading }]}>{copy.backToLogin}</Text>
              </TouchableOpacity>
            </View>
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
  back: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
});
