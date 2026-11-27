import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { MobileIcon, tokens, useMobileTheme } from '@nestyk/ui/native';
import type { SelfOwnerContract } from '../../lib/self-owner-contracts';
import { contractSigningView, type ContractSigningView } from './contract-detail-rows';

const { subtle } = tokens.colors;

/** Who signs a contract and when, on the phone; the detail and the sign page show it (Jom 25 Nov 2026). */
export function MobileSelfOwnerSignerList({ view }: { view: ContractSigningView }) {
  const { theme } = useMobileTheme();
  const ink = theme.screenTitle;
  const muted = theme.textSecondary;
  return (
    <View style={styles.list}>
      {view.rows.map((row) => (
        <View key={row.signer} testID={`soc-signer-${row.signer}`} style={styles.signer}>
          <View style={styles.flex}>
            <Text style={[styles.body, { color: ink }]}>{row.label}</Text>
            {row.name ? <Text style={[styles.small, { color: muted }]} numberOfLines={1}>{row.name}</Text> : null}
          </View>
          <View style={styles.status}>
            {row.signed ? <MobileIcon name="check" size={14} color={subtle.successFg ?? ink} /> : null}
            <Text style={[styles.small, { color: row.signed ? subtle.successFg ?? ink : muted }]}>{row.status}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * "การลงนาม" at the end of the self owner contract detail on the phone (Jom 25 Nov 2026, demo): who signs and when;
 * while the contract awaits the owner, "ลงนามสัญญา" opens the separate sign page (option B).
 */
export function MobileSelfOwnerContractSigning({ contract, day, onStart }: { contract: SelfOwnerContract; day: (ymd: string) => string; onStart: () => void }) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const so = t.selfOwnerContracts;
  const ink = theme.screenTitle;
  const view = contractSigningView(contract, so, day);
  return (
    <View style={[styles.section, { borderColor: theme.border, backgroundColor: theme.surface }]} accessibilityLabel={so.signing}>
      <Text style={[styles.title, { color: ink }]}>{so.signing}</Text>
      <MobileSelfOwnerSignerList view={view} />
      {view.waiting ? <Text style={[styles.small, { color: theme.textSecondary }]}>{so.waitingOthers}</Text> : null}
      {view.canSign ? (
        <Pressable testID="soc-sign" accessibilityRole="button" onPress={onStart} style={[styles.button, { backgroundColor: ink, borderColor: ink }]}>
          <MobileIcon name="pencil" size={16} color={theme.surface} />
          <Text style={[styles.body, { color: theme.surface }]}>{so.signAction}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  title: { fontFamily: tokens.typography.native.bodyBold, fontSize: 15, lineHeight: 22 },
  body: { fontFamily: tokens.typography.native.body, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 19 },
  flex: { flex: 1, minWidth: 0 },
  list: { gap: 10 },
  signer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  button: { flexDirection: 'row', gap: 8, minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1 },
});
