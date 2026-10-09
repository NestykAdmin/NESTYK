import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import Svg, { Path } from "react-native-svg";
import { Eye, EyeSlash, LockKey, ArrowRight } from "phosphor-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { DEV_AUTH_CONFIG } from "../lib/auth/dev-auth";
import { requestGuestBrowse } from "../lib/auth/role-gate";
import { APP_CONFIG } from "../lib/config";

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
  const { height } = useWindowDimensions();
  const passwordRef = React.useRef<TextInput>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [focused, setFocused] = useState<"email" | "password" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { theme, isDark } = useMobileTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, isAuthenticated } = useAuth();

  const [email, setEmail] = useState(
    DEV_AUTH_CONFIG.enabled ? DEV_AUTH_CONFIG.email : "",
  );
  const [password, setPassword] = useState(
    DEV_AUTH_CONFIG.enabled ? DEV_AUTH_CONFIG.password : "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compact = height < 780;
  const keyboardOpen = focused !== null;

  React.useEffect(() => {
    setError(null);
    setNotice(null);
  }, [locale]);

  React.useEffect(() => {
    if (isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  const onSubmit = async () => {
    if (loading) return;
    setError(null);
    setNotice(null);
    if (!email.trim() || !password) {
      setError(copy.requiredFields);
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace("/");
    } catch (e) {
      setError(localizedError(e, t.mobile.auth.invalidCredentials, locale));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <Image
        source={require("../assets/login-apartment.jpg")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <View pointerEvents="none" style={styles.photoShade} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          style={[
            styles.screen,
            {
              paddingTop: insets.top + (compact ? 8 : 12),
              paddingBottom: Math.max(insets.bottom, compact ? 8 : 12),
            },
          ]}
        >
          <View style={styles.content}>
            <View style={styles.topBar}>
              <MobileNestykLogo variant="wordmarkOnDark" height={compact ? 34 : 40} />
              <TouchableOpacity
                style={[styles.languageButton, compact && styles.languageButtonCompact]}
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
            </View>

            <View
              style={[
                styles.hero,
                keyboardOpen && styles.heroCollapsed,
              ]}
            >
              {!keyboardOpen ? (
                <Text
                  style={[
                    styles.heroTitle,
                    compact && styles.heroTitleCompact,
                    {
                      fontFamily:
                        locale === "en"
                          ? "Baloo2_700Bold"
                          : tokens.typography.native.headingTh,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {copy.heroHeadline}
                </Text>
              ) : null}
            </View>

            <View
              style={[
                styles.card,
                compact && styles.cardCompact,
                { backgroundColor: theme.card },
              ]}
            >
              <Text
                accessibilityRole="header"
                style={[
                  styles.cardTitle,
                  compact && styles.cardTitleCompact,
                  {
                    color: theme.textHeading,
                    fontFamily:
                      locale === "en"
                        ? "Baloo2_700Bold"
                        : tokens.typography.native.headingTh,
                  },
                ]}
              >
                {copy.loginTitle}
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  compact && styles.subtitleCompact,
                  { color: theme.textSecondary },
                ]}
                numberOfLines={1}
              >
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
                    compact && styles.inputCompact,
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
                <View
                  pointerEvents="none"
                  style={[styles.leadingIcon, compact && styles.leadingIconCompact]}
                >
                  <MobileIcon
                    name="envelope"
                    size={18}
                    color={theme.textSecondary}
                  />
                </View>
              </View>

              <Text
                style={[
                  styles.label,
                  styles.passwordLabel,
                  compact && styles.passwordLabelCompact,
                  { color: theme.textHeading },
                ]}
              >
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
                    compact && styles.inputCompact,
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
                <View
                  pointerEvents="none"
                  style={[styles.leadingIcon, compact && styles.leadingIconCompact]}
                >
                  <LockKey size={18} color={theme.textSecondary} />
                </View>
                <TouchableOpacity
                  style={[styles.eyeButton, compact && styles.eyeButtonCompact]}
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
                style={[styles.forgotButton, compact && styles.forgotButtonCompact]}
                onPress={() => setNotice(copy.resetUnavailable)}
                accessibilityRole="button"
                activeOpacity={0.7}
              >
                <Text style={[styles.linkText, { color: theme.textSecondary }]}>
                  {copy.forgotPassword}
                </Text>
              </TouchableOpacity>

              {error ? (
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={styles.errorText}
                  numberOfLines={2}
                >
                  {error}
                </Text>
              ) : null}

              <MobileButton
                onPress={onSubmit}
                isLoading={loading}
                disabled={loading}
                style={[styles.submitButton, compact && styles.submitButtonCompact]}
              >
                <View style={styles.submitContent}>
                  <Text style={styles.submitText}>{copy.loginButton}</Text>
                  <ArrowRight size={20} color={tokens.colors.primary} />
                </View>
              </MobileButton>

              <View style={[styles.dividerRow, compact && styles.dividerRowCompact]}>
                <View
                  style={[styles.divider, { backgroundColor: theme.border }]}
                />
                <Text
                  style={[styles.socialCaption, { color: theme.textSecondary }]}
                >
                  {copy.socialDivider}
                </Text>
                <View
                  style={[styles.divider, { backgroundColor: theme.border }]}
                />
              </View>

              <View style={styles.socialRow}>
                {(["Google", "Facebook", "Apple"] as const).map((provider) => (
                  <TouchableOpacity
                    key={provider}
                    style={[
                      styles.socialButton,
                      compact && styles.socialButtonCompact,
                      {
                        borderColor: theme.border,
                        backgroundColor: isDark ? "#F8FAFC" : theme.card,
                      },
                    ]}
                    onPress={() => setNotice(copy.unavailable)}
                    activeOpacity={0.65}
                    accessibilityRole="button"
                    accessibilityLabel={copy.socialLogin.replace(
                      "{provider}",
                      provider,
                    )}
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
                style={[styles.signUpButton, compact && styles.signUpButtonCompact, { borderTopColor: theme.border }]}
                onPress={() => setNotice(copy.signupUnavailable)}
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
            </View>

            {APP_CONFIG.defaultRole === "guest" ? (
              <TouchableOpacity
                onPress={() => {
                  requestGuestBrowse();
                  router.replace("/");
                }}
                style={[styles.guestLink, compact && styles.guestLinkCompact]}
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
          </View>
        </View>
      </KeyboardAvoidingView>
      <MobileBottomSheet
        visible={languageOpen}
        onClose={() => setLanguageOpen(false)}
      >
        <MobileLanguagePickerBody
          showTitle
          onSelect={() => setLanguageOpen(false)}
        />
      </MobileBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  photoShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(25,18,10,0.12)",
  },
  screen: {
    flex: 1,
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexShrink: 0,
  },
  languageButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    minHeight: 40,
    borderRadius: 24,
    backgroundColor: "rgba(20,20,20,0.45)",
  },
  languageButtonCompact: {
    minHeight: 36,
    paddingHorizontal: 10,
  },
  languageText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: "#FFFFFF",
  },
  hero: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 14,
    paddingTop: 8,
    minHeight: 56,
  },
  heroCollapsed: {
    flex: 0,
    minHeight: 8,
    paddingBottom: 8,
    paddingTop: 0,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 40,
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroTitleCompact: {
    fontSize: 24,
    lineHeight: 34,
  },
  card: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    flexShrink: 0,
  },
  cardCompact: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderRadius: 20,
  },
  cardTitle: { fontSize: 26, lineHeight: 36 },
  cardTitleCompact: { fontSize: 22, lineHeight: 30 },
  subtitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  subtitleCompact: {
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 18,
  },
  label: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  field: { position: "relative" },
  input: { height: 46, borderRadius: 12, paddingLeft: 40, fontSize: 14 },
  inputCompact: { height: 42 },
  passwordInput: { paddingRight: 44 },
  leadingIcon: {
    position: "absolute",
    left: 12,
    top: 0,
    height: 46,
    justifyContent: "center",
  },
  leadingIconCompact: { height: 42 },
  passwordLabel: { marginTop: 10 },
  passwordLabelCompact: { marginTop: 8 },
  eyeButton: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 44,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  eyeButtonCompact: { height: 42 },
  forgotButton: {
    minHeight: 36,
    justifyContent: "center",
    alignSelf: "flex-end",
  },
  forgotButtonCompact: { minHeight: 32 },
  linkText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
  },
  submitButton: { minHeight: 48, borderRadius: 14, marginTop: 2 },
  submitButtonCompact: { minHeight: 44 },
  submitContent: { flexDirection: "row", gap: 8, alignItems: "center" },
  submitText: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 15,
    lineHeight: 22,
    color: tokens.colors.primary,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 12,
  },
  dividerRowCompact: { marginVertical: 8 },
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
  socialButtonCompact: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  signUpButton: {
    marginTop: 12,
    paddingTop: 10,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  signUpButtonCompact: {
    marginTop: 8,
    paddingTop: 8,
    minHeight: 36,
  },
  bold: { fontFamily: tokens.typography.native.bodyBold },
  errorText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.danger,
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
    minHeight: 40,
    marginTop: 10,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.86)",
    flexShrink: 0,
  },
  guestLinkCompact: {
    minHeight: 36,
    marginTop: 8,
  },
  guestLinkText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    color: tokens.colors.primary,
  },
});
