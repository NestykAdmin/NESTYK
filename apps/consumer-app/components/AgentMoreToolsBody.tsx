import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import {
  getCardElevation,
  MobileIcon,
  MobileStatusPill,
  tokens,
  useMobileTheme,
  type AppIconName,
} from '@nestyk/ui/native';

export type AgentMoreTool = 'calendar' | 'contact' | 'services' | 'contracts';

type Shortcut = { tool: AgentMoreTool; icon: AppIconName; label: string; desc: string; highlight?: boolean };

const { boxShadow: _webShadow, ...cardShadow } = getCardElevation(1);

/** Agent "More" tab body: shortcut cards to secondary tools plus finance items. */
export function AgentMoreToolsBody({ onOpen }: { onOpen: (tool: AgentMoreTool) => void }) {
  const { t } = useLocale();
  const { theme, isDark } = useMobileTheme();
  const d = t.agent.dashboard;

  const shortcuts: Shortcut[] = [
    { tool: 'calendar', icon: 'calendar', label: d.openCalendar, desc: d.calendarDesc, highlight: true },
    { tool: 'contact', icon: 'users', label: d.openContacts, desc: d.contactsDesc },
    { tool: 'services', icon: 'buildings', label: d.openServices, desc: d.servicesDesc },
    { tool: 'contracts', icon: 'files', label: d.openContracts, desc: d.contractsDesc },
  ];
  const rows = [shortcuts.slice(0, 2), shortcuts.slice(2, 4)];

  const card = { backgroundColor: theme.surface, borderColor: theme.border };
  const neutralIconBg = isDark ? 'rgba(148,163,184,0.16)' : '#F1F5F9';
  const iconBg = (highlight?: boolean) =>
    highlight ? (isDark ? 'rgba(248,182,21,0.18)' : tokens.colors.brand[100]) : neutralIconBg;
  const iconColor = (highlight?: boolean) => (highlight ? tokens.colors.brand[700] : theme.textHeading);

  return (
    <View>
      <Text style={[styles.hint, { color: theme.textSecondary }]}>{d.moreHint}</Text>

      <Text style={[styles.section, { color: theme.textHeading }]} accessibilityRole="header">
        {d.shortcutsSection}
      </Text>
      <View style={styles.grid}>
        {rows.map((row, index) => (
          <View key={index} style={styles.gridRow}>
            {row.map((item) => (
              <Pressable
                key={item.tool}
                onPress={() => onOpen(item.tool)}
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
                <View style={[styles.iconBox, { backgroundColor: iconBg(item.highlight) }]}>
                  <MobileIcon name={item.icon} size={22} color={iconColor(item.highlight)} />
                </View>
                <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={[styles.desc, { color: theme.textSecondary }]} numberOfLines={2}>
                  {item.desc}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      <Text style={[styles.section, { color: theme.textHeading }]} accessibilityRole="header">
        {d.financeSection}
      </Text>
      <View
        style={[styles.row, card, cardShadow]}
        accessibilityState={{ disabled: true }}
        accessibilityLabel={`${d.openCommission}, ${d.commissionDesc}`}
      >
        <View style={[styles.iconBox, styles.dimmed, { backgroundColor: neutralIconBg }]}>
          <MobileIcon name="wallet" size={22} color={theme.textSecondary} />
        </View>
        <View style={[styles.rowCopy, styles.dimmed]}>
          <Text style={[styles.title, styles.rowTitle, { color: theme.textHeading }]} numberOfLines={1}>
            {d.openCommission}
          </Text>
          <Text style={[styles.desc, { color: theme.textSecondary }]} numberOfLines={1}>
            {d.commissionDesc}
          </Text>
        </View>
        <MobileStatusPill label={d.comingSoon} tone="slate" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 21 },
  section: {
    fontFamily: tokens.typography.native.bodyBold,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 20,
    marginBottom: 10,
  },
  grid: { gap: 12 },
  gridRow: { flexDirection: 'row', gap: 12 },
  tile: {
    flex: 1,
    minHeight: 132,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.7 },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: tokens.typography.native.bodyBold, fontSize: 15, lineHeight: 22, marginTop: 14 },
  desc: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { marginTop: 0 },
  dimmed: { opacity: 0.6 },
});
