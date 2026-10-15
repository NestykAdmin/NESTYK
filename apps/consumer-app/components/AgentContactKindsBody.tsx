import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { getCardElevation, MobileIcon, tokens, useMobileTheme, type AppIconName } from '@nestyk/ui/native';

export type AgentContactKind = 'owner' | 'lead' | 'landlord' | 'tenant' | 'coAgent';

type KindCard = {
  kind: AgentContactKind;
  icon: AppIconName;
  label: string;
  desc: string;
  iconBg: string;
  iconBgDark: string;
  iconColor: string;
};

const { boxShadow: _webShadow, ...cardShadow } = getCardElevation(1);

/** Contact-type chooser opened from the agent More tab. */
export function AgentContactKindsBody({ onSelect }: { onSelect?: (kind: AgentContactKind) => void }) {
  const { t } = useLocale();
  const { theme, isDark } = useMobileTheme();
  const d = t.agent.dashboard;

  const kinds: KindCard[] = [
    {
      kind: 'owner',
      icon: 'key',
      label: d.contactKindOwner,
      desc: d.contactKindOwnerDesc,
      iconBg: '#E8F0FE',
      iconBgDark: 'rgba(0,85,218,0.18)',
      iconColor: tokens.colors.roles.owner,
    },
    {
      kind: 'lead',
      icon: 'user-plus',
      label: d.contactKindLead,
      desc: d.contactKindLeadDesc,
      iconBg: tokens.colors.brand[100],
      iconBgDark: 'rgba(248,182,21,0.18)',
      iconColor: tokens.colors.brand[700],
    },
    {
      kind: 'landlord',
      icon: 'buildings',
      label: d.contactKindLandlord,
      desc: d.contactKindLandlordDesc,
      iconBg: tokens.colors.subtle.infoBg,
      iconBgDark: 'rgba(37,99,235,0.18)',
      iconColor: tokens.colors.subtle.infoFg,
    },
    {
      kind: 'tenant',
      icon: 'user',
      label: d.contactKindTenant,
      desc: d.contactKindTenantDesc,
      iconBg: '#D9FBF1',
      iconBgDark: 'rgba(0,198,141,0.18)',
      iconColor: '#00966C',
    },
    {
      kind: 'coAgent',
      icon: 'handshake',
      label: d.contactKindCoAgent,
      desc: d.contactKindCoAgentDesc,
      iconBg: '#FFE5EE',
      iconBgDark: 'rgba(255,0,82,0.18)',
      iconColor: tokens.colors.roles.agent,
    },
  ];
  const card = { backgroundColor: theme.surface, borderColor: theme.border };

  return (
    <View>
      <Text style={[styles.hint, { color: theme.textSecondary }]}>{d.contactKindsHint}</Text>
      <View style={styles.grid}>
        {kinds.map((item) => (
          <Pressable
            key={item.kind}
            onPress={() => onSelect?.(item.kind)}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}, ${item.desc}`}
            android_ripple={{ color: 'rgba(33,30,30,0.08)' }}
            style={({ pressed }) => [
              styles.tile,
              card,
              cardShadow,
              pressed && Platform.OS === 'ios' ? styles.pressed : null,
            ]}
          >
            <View style={[styles.iconBox, { backgroundColor: isDark ? item.iconBgDark : item.iconBg }]}>
              <MobileIcon name={item.icon} size={22} color={item.iconColor} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={[styles.desc, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.desc}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 21, marginBottom: 12 },
  grid: { gap: 12 },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 76,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  copy: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7 },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: tokens.typography.native.bodyBold, fontSize: 15, lineHeight: 22 },
  desc: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18, marginTop: 2 },
});
