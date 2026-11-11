import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { tokens } from '../theme/tokens';

export function formatAccountDeletionDate(iso: string, locale: string): string {
  const tag = locale === 'th' ? 'th-TH-u-ca-gregory' : locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : 'en-GB';
  return new Date(iso).toLocaleDateString(tag, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  });
}

export const AccountDeletionNotice: React.FC<{ scheduledFor: string }> = ({ scheduledFor }) => {
  const { t, locale } = useLocale();
  const text = t.mobile.account.deleteAccountOverview.replace('{date}', formatAccountDeletionDate(scheduledFor, locale));
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.text}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FEF2F2',
    borderColor: tokens.colors.danger,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  text: {
    color: tokens.colors.danger,
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
  },
});
