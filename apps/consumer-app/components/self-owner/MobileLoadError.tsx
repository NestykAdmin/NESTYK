import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { tokens, useMobileTheme } from '@nestyk/ui/native';

/**
 * A self owner list that could not load, on the phone (Jom 25 Nov 2026): the web states' words ("โหลดข้อมูลไม่สำเร็จ"),
 * and a retry button when the page can retry.
 */
export function MobileLoadError({ onRetry, retryTestID }: { onRetry?: () => void; retryTestID: string }) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.agent.dashboard.webStates;
  return (
    <View style={styles.box} accessibilityRole="alert">
      <Text style={[styles.title, { color: tokens.colors.subtle.dangerFg }]}>{copy.errorTitle}</Text>
      <Text style={[styles.small, { color: theme.textSecondary }]}>{copy.errorBody}</Text>
      {onRetry ? (
        <Pressable testID={retryTestID} accessibilityRole="button" onPress={onRetry} style={[styles.outline, { borderColor: theme.border }]}>
          <Text style={[styles.small, { color: theme.screenTitle }]}>{copy.retry}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'flex-start', gap: 6 },
  title: { fontFamily: tokens.typography.native.bodyBold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 19 },
  outline: { minHeight: 40, marginTop: 4, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10, borderWidth: 1 },
});
