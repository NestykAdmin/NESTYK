import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { MobileButton } from './MobileButton';
import { MobileIcon } from '../icons/MobileIcon';
import { tokens } from '../theme/tokens';
import { useMobileTheme } from '../theme/ThemeContext';

export const AccountCompleteModal: React.FC<{
  visible: boolean;
  title: string;
  body: string;
  onClose: () => void;
}> = ({ visible, title, body, onClose }) => {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  if (!visible) return null;
  return (
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.mobile.account.done} />
        <View style={[styles.card, { backgroundColor: theme.card, zIndex: 1 }]}>
          <View style={styles.badge}>
            <MobileIcon name="check" size={28} color="#211E1E" weight="bold" />
          </View>
          <Text style={[styles.title, { color: theme.textHeading }]}>{title}</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>{body}</Text>
          <MobileButton onPress={onClose}>{t.mobile.account.done}</MobileButton>
        </View>
      </View>
  );
};

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(33,30,30,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F8B615',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 22,
    lineHeight: 33,
    textAlign: 'center',
  },
  body: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 12,
  },
});
