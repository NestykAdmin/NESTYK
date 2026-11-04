import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { AccountCompleteModal } from '../components/AccountCompleteModal';
import { MobileInput } from '../components/MobileInput';
import { MobileButton } from '../components/MobileButton';
import { tokens } from '../theme/tokens';
import { getCardElevation } from '../theme/elevation';
import { useMobileTheme } from '../theme/ThemeContext';

function passwordIsStrong(password: string): boolean {
  return password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

function nativeElevation(level: 1 | 2 | 3) {
  const { boxShadow: _webOnly, ...rest } = getCardElevation(level);
  return rest;
}

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
  captchaToken?: string;
};

function errorCode(cause: unknown): string | undefined {
  if (!cause || typeof cause !== 'object' || !('code' in cause)) return undefined;
  const code = (cause as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

export const MobileChangePasswordBody: React.FC<{
  onChangePassword?: (input: ChangePasswordInput) => Promise<void>;
  onFinished?: () => void;
  captcha?: React.ReactNode;
  captchaRequired?: boolean;
  captchaToken?: string | null;
}> = ({ onChangePassword, onFinished, captcha, captchaRequired = false, captchaToken }) => {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentError, setCurrentError] = useState<string | undefined>();
  const [newError, setNewError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);

  const cardStyle = {
    backgroundColor: theme.card,
    borderColor: theme.border,
  };

  const handleSubmit = () => {
    let valid = true;
    setCurrentError(undefined);
    setNewError(undefined);
    setConfirmError(undefined);

    if (!currentPassword.trim()) {
      setCurrentError(t.mobile.account.password.required);
      valid = false;
    }
    if (!passwordIsStrong(newPassword)) {
      setNewError(t.mobile.auth.passwordRules);
      valid = false;
    }
    if (newPassword !== confirmPassword) {
      setConfirmError(t.mobile.account.password.mismatch);
      valid = false;
    }
    if (captchaRequired && !captchaToken) {
      setCurrentError(t.mobile.auth.captchaRequired);
      valid = false;
    }
    if (!valid || saving) return;
    const showComplete = () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setComplete(true);
    };
    if (!onChangePassword) {
      showComplete();
      return;
    }
    setSaving(true);
    void onChangePassword({
      currentPassword,
      newPassword,
      ...(captchaToken ? { captchaToken } : {}),
    })
      .then(showComplete)
      .catch((cause: unknown) => {
        if (errorCode(cause) === 'WRONG_PASSWORD') setCurrentError(t.mobile.account.password.incorrect);
        else if (errorCode(cause) === 'WEAK_PASSWORD') setNewError(t.mobile.auth.passwordRules);
        else setCurrentError(cause instanceof Error && cause.message ? cause.message : t.common.errorGeneric);
      })
      .finally(() => setSaving(false));
  };

  return (
    <View style={styles.screen}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.hint, { color: theme.textSecondary }]}>
        {t.mobile.account.password.subtitle}
      </Text>

      <View style={[styles.card, nativeElevation(1), cardStyle]}>
        <MobileInput
          label={t.mobile.account.password.current}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t.mobile.account.password.current}
          error={currentError}
        />
        <View style={styles.fieldGap} />
        <MobileInput
          label={t.mobile.account.password.new}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t.mobile.account.password.new}
          error={newError}
          helperText={!newError ? t.mobile.account.password.requirements : undefined}
        />
        <View style={styles.fieldGap} />
        <MobileInput
          label={t.mobile.account.password.confirm}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t.mobile.account.password.confirm}
          error={confirmError}
        />
        {captcha}
        <View style={styles.submitWrap}>
          <MobileButton onPress={handleSubmit} isLoading={saving} disabled={saving}>{t.mobile.account.password.submit}</MobileButton>
        </View>
      </View>
    </ScrollView>
    <AccountCompleteModal
      visible={complete}
      title={t.mobile.account.changePassword}
      body={t.mobile.account.password.updated}
      onClose={() => {
        setComplete(false);
        onFinished?.();
      }}
    />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  hint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  fieldGap: {
    height: 12,
  },
  submitWrap: {
    marginTop: 16,
  },
});
