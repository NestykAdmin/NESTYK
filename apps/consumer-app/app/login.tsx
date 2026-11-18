import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  TextInput,
  Keyboard,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { Eye } from "phosphor-react-native/src/icons/Eye";
import { EyeSlash } from "phosphor-react-native/src/icons/EyeSlash";
import { LockKey } from "phosphor-react-native/src/icons/LockKey";
import { ArrowRight } from "phosphor-react-native/src/icons/ArrowRight";
import { useLocalSearchParams, useRouter } from "expo-router";
import { localizedError, useLocale } from "@nestyk/i18n";
import {
  MobileIcon,
  MobileBottomSheet,
  MobileButton,
  MobileInput,
  MobileLanguagePickerBody,
  MobileNestykLogo,
  useMobileTheme,
  tokens,
} from "@nestyk/ui/native";
import { useAuth } from "../lib/auth/AuthContext";
import { captchaSiteKey } from "../lib/auth/captcha-site-key";
import { CAPTCHA_WAIT_MS, captchaSubmitStep } from "../lib/auth/auth-layout-rules";
import { signInErrorKind, type SignInErrorKind } from "../lib/auth/auth-error";
import { CaptchaField } from "../components/CaptchaField";
import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthLegalFooter } from "../components/legal/AuthLegalFooter";
import { DEV_AUTH_CONFIG } from "../lib/auth/dev-auth";
import { socialLoginProvider } from "../lib/auth/google-oauth";
import { requestGuestBrowse } from "../lib/auth/role-gate";
import { APP_CONFIG } from "../lib/config";
import { withNextParam } from "../lib/app-routes";
import { goAfterSignIn, goToGuestHome } from "../lib/web-routes";

function GoogleMark() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" accessible={false}>
      <Path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
      />
      <Path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.97-3.38.97-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"
      />
      <Path
        fill="#FBBC05"
        d="M6.41 13.93a6 6 0 0 1 0-3.86V7.48H3.07a10 10 0 0 0 0 9.04l3.34-2.59Z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.48l3.34 2.59C7.2 7.71 9.4 5.95 12 5.95Z"
      />
    </Svg>
  );
}

export default function LoginScreen() {
  const { t, locale } = useLocale();
  const copy = t.mobile.auth;
  const passwordRef = React.useRef<TextInput>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [focused, setFocused] = useState<"email" | "password" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { theme, isDark } = useMobileTheme();
  const router = useRouter();
  const { signIn, signInWithGoogle, signInWithFacebook, isAuthenticated, session, sessionExpired, dismissSessionExpired } = useAuth();
  const { next } = useLocalSearchParams<{ next?: string }>();

  const [email, setEmail] = useState(
    DEV_AUTH_CONFIG.enabled ? DEV_AUTH_CONFIG.email : "",
  );
  const [password, setPassword] = useState(
    DEV_AUTH_CONFIG.enabled ? DEV_AUTH_CONFIG.password : "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  // Turnstile runs hidden ("interaction-only"): a press before its token arrives waits, then signs in by itself.
  const [waitingForCaptcha, setWaitingForCaptcha] = useState(false);
  const [captchaFailed, setCaptchaFailed] = useState(false);
  const captchaRequired = captchaSiteKey().length > 0;

  // A typed or sign-in error replaces the "session expired" notice.
  const shownError = error ?? (sessionExpired ? t.mobile.auth.sessionExpired : null);
  const headingFont = locale === "en" ? "Baloo2_700Bold" : tokens.typography.native.headingTh;

  React.useEffect(() => {
    setError(null);
    setNotice(null);
  }, [locale]);

  React.useEffect(() => {
    if (isAuthenticated) {
      // Web: back to `next` (a role page here, or the guest web page sign-in started from) or the landing role's
      // page (route plan R1, Q5; guest session plan A6). Mobile: "/" as before.
      goAfterSignIn(router, next, session?.roles);
    }
  }, [isAuthenticated, router, next, session?.roles]);

  const onSubmit = async () => {
    if (loading) return;
    // Every press (or the token ending a wait) starts here; the "wait" step below sets it again (review R2).
    setWaitingForCaptcha(false);
    setError(null);
    setNotice(null);
    // Close the keyboard so the result (error line, or Cloudflare's box) is on screen, not under it (review R3).
    Keyboard.dismiss();
    if (!email.trim() || !password) {
      setError(copy.requiredFields);
      return;
    }
    if (captchaSubmitStep(captchaRequired, captchaToken) === "wait") {
      if (captchaFailed) {
        // The last check failed: start a new one for this press.
        setCaptchaFailed(false);
        setCaptchaKey((key) => key + 1);
      }
      setWaitingForCaptcha(true);
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password, captchaToken ?? undefined);
      // Web leaves through the effect above once the session (and its roles) is in; mobile goes home now.
      if (Platform.OS !== "web") router.replace("/");
    } catch (e) {
      // One of our texts per cause, never Supabase's or the API's own message (QA 9 Nov 2026).
      const messages: Record<SignInErrorKind, string> = {
        invalidCredentials: t.mobile.auth.invalidCredentials,
        network: t.mobile.auth.networkError,
        emailNotConfirmed: t.mobile.auth.emailNotConfirmed,
        rateLimited: t.mobile.auth.tooManyAttempts,
        generic: t.common.errorGeneric,
      };
      setError(messages[signInErrorKind(e)]);
    } finally {
      setCaptchaToken(null);
      setCaptchaKey(captchaKey + 1);
      setLoading(false);
    }
  };

  // The token arrived while a press was waiting: go on with that press. onSubmit reads this render's token.
  React.useEffect(() => {
    if (waitingForCaptcha && captchaToken) void onSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingForCaptcha, captchaToken]);

  const onCaptchaFailed = () => {
    setCaptchaFailed(true);
    if (waitingForCaptcha) {
      setWaitingForCaptcha(false);
      setError(t.webSession.captchaFailed);
    }
  };

  const onCaptchaToken = (token: string | null) => {
    setCaptchaToken(token);
    // Turnstile refreshed by itself after an expiry or error: the next press needs no restart (review R5).
    if (token) setCaptchaFailed(false);
  };

  // A blocked script never answers at all: stop waiting after a while (review R1).
  React.useEffect(() => {
    if (!waitingForCaptcha) return;
    const timer = setTimeout(onCaptchaFailed, CAPTCHA_WAIT_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingForCaptcha]);

  const socialProviders = (["Google", "Facebook", "Apple"] as const).map((provider) => ({
    provider,
    // Mos 9 Nov 2026: not ready = faded; a tap still explains it (e2e login-form.spec.ts).
    ready: socialLoginProvider(provider, process.env.EXPO_PUBLIC_ENABLE_SOCIAL_LOGIN) !== null,
  }));
  const anySocialSoon = socialProviders.some(({ ready }) => !ready);

  return (
    <>
      <AuthLayout
        photo={require("../assets/login-apartment.jpg")}
        topBar={
          <>
            <MobileNestykLogo variant="wordmarkOnDark" height={34} />
            <TouchableOpacity
              style={styles.languageButton}
              onPress={() => setLanguageOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t.mobile.settings.language}
              activeOpacity={0.7}
            >
              <MobileIcon name="globe" size={16} color="#FFFFFF" />
              <Text style={styles.languageText}>
                {t.mobile.settings.languageNames[locale]}
              </Text>
              <MobileIcon name="chevron-down" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </>
        }
        hero={
          <Text style={[styles.heroTitle, { fontFamily: headingFont }]} numberOfLines={2}>
            {copy.heroHeadline}
          </Text>
        }
        action={
          <View style={styles.action}>
            <MobileButton
              onPress={onSubmit}
              isLoading={loading}
              disabled={loading || waitingForCaptcha}
              style={styles.submitButton}
            >
              <View style={styles.submitContent}>
                <Text style={styles.submitText} accessibilityLiveRegion="polite">
                  {waitingForCaptcha ? t.webSession.captchaChecking : copy.loginButton}
                </Text>
                {waitingForCaptcha ? null : <ArrowRight size={20} color={tokens.colors.primary} />}
              </View>
            </MobileButton>
            {captchaRequired ? (
              <View style={styles.captchaNote}>
                <MobileIcon name="shield" size={14} color={theme.textSecondary} />
                <Text style={[styles.captchaNoteText, { color: theme.textSecondary }]}>
                  {t.webSession.captchaNote}
                </Text>
              </View>
            ) : null}
          </View>
        }
        after={
          <>
            <View style={styles.dividerRow}>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <Text style={[styles.socialCaption, { color: theme.textSecondary }]}>
                {copy.socialDivider}
              </Text>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
            </View>

            <View style={styles.socialRow}>
              {socialProviders.map(({ provider, ready }) => (
                <TouchableOpacity
                  key={provider}
                  style={[
                    styles.socialButton,
                    {
                      borderColor: theme.border,
                      backgroundColor: isDark ? "#F8FAFC" : theme.card,
                    },
                    !ready && styles.socialSoon,
                  ]}
                  disabled={loading}
                  onPress={() => {
                    // R2: off until EXPO_PUBLIC_ENABLE_SOCIAL_LOGIN=true (providers set up in Supabase).
                    const oauth = socialLoginProvider(provider, process.env.EXPO_PUBLIC_ENABLE_SOCIAL_LOGIN);
                    const start = oauth === "google" ? signInWithGoogle : oauth === "facebook" ? signInWithFacebook : null;
                    if (!start) {
                      setNotice(copy.unavailable);
                      return;
                    }
                    if (loading) return;
                    setError(null);
                    setNotice(null);
                    setLoading(true);
                    void start()
                      .catch((e) => setError(localizedError(e, t.common.errorGeneric, locale)))
                      .finally(() => setLoading(false));
                  }}
                  activeOpacity={0.65}
                  accessibilityRole="button"
                  accessibilityLabel={copy.socialLogin.replace(
                    "{provider}",
                    provider,
                  )}
                  accessibilityHint={ready ? undefined : copy.socialComingSoon}
                >
                  {provider === "Google" ? (
                    <GoogleMark />
                  ) : (
                    <MobileIcon
                      name={provider === "Facebook" ? "facebook" : "apple"}
                      size={22}
                      color={provider === "Facebook" ? "#1877F2" : "#211E1E"}
                      weight="fill"
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            {/* Sign-in redesign (Mos 17 Nov 2026): one "coming soon" line under the row instead of one per button. */}
            {anySocialSoon ? (
              <Text style={[styles.socialSoonText, { color: theme.textSecondary }]}>
                {copy.socialComingSoon}
              </Text>
            ) : null}

            {notice ? (
              <Text
                accessibilityLiveRegion="polite"
                style={[
                  styles.notice,
                  {
                    color: theme.textSecondary,
                    backgroundColor: theme.background,
                  },
                ]}
                numberOfLines={2}
              >
                {notice}
              </Text>
            ) : null}

            <TouchableOpacity
              style={[styles.signUpButton, { borderTopColor: theme.border }]}
              onPress={() => router.push(withNextParam('/register', next) as never)}
              accessibilityRole="button"
              accessibilityLabel={copy.signUp}
              activeOpacity={0.7}
            >
              <Text style={[styles.linkText, { color: theme.textSecondary }]}>
                {copy.newHere}{" "}
                <Text style={[styles.bold, { color: theme.textHeading }]}>
                  {copy.signUp}
                </Text>
              </Text>
            </TouchableOpacity>

            {APP_CONFIG.defaultRole === "guest" ? (
              <TouchableOpacity
                onPress={() => {
                  dismissSessionExpired();
                  requestGuestBrowse();
                  goToGuestHome(router);
                }}
                style={styles.guestLink}
                accessibilityRole="button"
                activeOpacity={0.7}
              >
                <Text style={styles.guestLinkText}>{copy.continueAsGuest}</Text>
                <MobileIcon
                  name="chevron-right"
                  size={16}
                  color={tokens.colors.primary}
                />
              </TouchableOpacity>
            ) : null}
          </>
        }
        footer={<AuthLegalFooter testID="login.footer" />}
      >
        <Text
          accessibilityRole="header"
          style={[styles.cardTitle, { color: theme.textHeading, fontFamily: headingFont }]}
        >
          {copy.loginTitle}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={2}>
          {copy.loginSubtitle}
        </Text>

        <Text style={[styles.label, { color: theme.textHeading }]}>
          {copy.email}
        </Text>
        <View style={styles.field}>
          <MobileInput
            accessibilityLabel={copy.email}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            placeholder="you@example.com"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            onFocus={() => setFocused("email")}
            onBlur={() => setFocused(null)}
            style={[
              styles.input,
              {
                backgroundColor: theme.card,
                color: theme.textHeading,
                borderColor:
                  focused === "email"
                    ? tokens.colors.brand[500]
                    : theme.border,
              },
            ]}
            editable={!loading}
          />
          <View pointerEvents="none" style={styles.leadingIcon}>
            <MobileIcon
              name="envelope"
              size={18}
              color={theme.textSecondary}
            />
          </View>
        </View>

        <Text style={[styles.label, styles.passwordLabel, { color: theme.textHeading }]}>
          {copy.password}
        </Text>
        <View style={styles.field}>
          <MobileInput
            ref={passwordRef}
            accessibilityLabel={copy.password}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!passwordVisible}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            placeholder={copy.passwordPlaceholder}
            returnKeyType="go"
            onSubmitEditing={onSubmit}
            onFocus={() => setFocused("password")}
            onBlur={() => setFocused(null)}
            style={[
              styles.input,
              styles.passwordInput,
              {
                backgroundColor: theme.card,
                color: theme.textHeading,
                borderColor:
                  focused === "password"
                    ? tokens.colors.brand[500]
                    : theme.border,
              },
            ]}
            editable={!loading}
          />
          <View pointerEvents="none" style={styles.leadingIcon}>
            <LockKey size={18} color={theme.textSecondary} />
          </View>
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setPasswordVisible(!passwordVisible)}
            accessibilityRole="button"
            accessibilityLabel={
              passwordVisible ? copy.hidePassword : copy.showPassword
            }
            accessibilityState={{ selected: passwordVisible }}
            activeOpacity={0.7}
          >
            {passwordVisible ? (
              <EyeSlash size={20} color={theme.textHeading} />
            ) : (
              <Eye size={20} color={theme.textHeading} />
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.forgotButton}
          onPress={() => router.push("/reset-password")}
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <Text style={[styles.linkText, { color: theme.textSecondary }]}>
            {copy.forgotPassword}
          </Text>
        </TouchableOpacity>

        {captchaRequired ? (
          <CaptchaField
            resetKey={captchaKey}
            onToken={onCaptchaToken}
            appearance="interaction-only"
            onFailed={onCaptchaFailed}
          />
        ) : null}

        {shownError ? (
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={styles.errorText}
            numberOfLines={2}
          >
            {shownError}
          </Text>
        ) : null}
      </AuthLayout>
      <MobileBottomSheet
        visible={languageOpen}
        onClose={() => setLanguageOpen(false)}
      >
        <MobileLanguagePickerBody
          showTitle
          onSelect={() => setLanguageOpen(false)}
        />
      </MobileBottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  languageButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: 24,
    backgroundColor: "rgba(20,20,20,0.45)",
  },
  languageText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: "#FFFFFF",
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 34,
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  cardTitle: { fontSize: 26, lineHeight: 36 },
  subtitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  label: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  field: { position: "relative" },
  input: { height: 48, borderRadius: 12, paddingLeft: 40, fontSize: 16 },
  passwordInput: { paddingRight: 44 },
  leadingIcon: {
    position: "absolute",
    left: 12,
    top: 0,
    height: 48,
    justifyContent: "center",
  },
  passwordLabel: { marginTop: 12 },
  eyeButton: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 44,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  forgotButton: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-end",
  },
  linkText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
  },
  action: { marginTop: 8 },
  submitButton: { minHeight: 48, borderRadius: 14 },
  submitContent: { flexDirection: "row", gap: 8, alignItems: "center" },
  submitText: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 15,
    lineHeight: 22,
    color: tokens.colors.primary,
  },
  captchaNote: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
  },
  captchaNoteText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 11,
    lineHeight: 16,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    marginBottom: 12,
  },
  divider: { height: StyleSheet.hairlineWidth, flex: 1 },
  socialCaption: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
  },
  socialRow: { flexDirection: "row", justifyContent: "center", gap: 16 },
  socialButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  socialSoon: { opacity: 0.45 },
  socialSoonText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 6,
  },
  signUpButton: {
    marginTop: 14,
    paddingTop: 10,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bold: { fontFamily: tokens.typography.native.bodyBold },
  errorText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.danger,
    marginTop: 4,
    marginBottom: 6,
  },
  notice: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
  },
  guestLink: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    paddingHorizontal: 14,
    minHeight: 44,
  },
  guestLinkText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    color: tokens.colors.primary,
  },
});
