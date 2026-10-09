import React from "react";
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLocale } from "@nestyk/i18n";
import {
  getCardElevation,
  MobileIcon,
  MobileStatusPill,
  tokens,
  useMobileTheme,
  type AppIconName,
  type MobileStatusPillToneKey,
} from "@nestyk/ui/native";
import { formatPhoneDisplay, phoneDialString } from "../lib/phone";

const { boxShadow: _webShadow, ...cardShadow } = getCardElevation(1);
export const RIPPLE = { color: "rgba(33,30,30,0.08)" };

export function DetailCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { theme } = useMobileTheme();
  return (
    <View style={[ps.card, cardShadow, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>
      {children}
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  const { theme } = useMobileTheme();
  return (
    <Text style={[ps.sectionLabel, { color: theme.textHeading }]} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function useIconBox() {
  const { theme, isDark } = useMobileTheme();
  return {
    neutral: { backgroundColor: isDark ? "rgba(148,163,184,0.16)" : "#F1F5F9" },
    brand: { backgroundColor: isDark ? "rgba(248,182,21,0.18)" : tokens.colors.brand[100] },
    neutralColor: theme.textHeading,
    brandColor: tokens.colors.brand[700],
  };
}

/** Hub menu row: icon, title, one-line summary, optional status pill, chevron. */
export function DetailMenuRow({
  icon,
  title,
  summary,
  pill,
  onPress,
  last,
}: {
  icon: AppIconName;
  title: string;
  summary: string;
  pill?: { label: string; tone: MobileStatusPillToneKey } | null;
  onPress: () => void;
  last?: boolean;
}) {
  const { theme } = useMobileTheme();
  const box = useIconBox();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, summary, pill?.label].filter(Boolean).join(", ")}
      android_ripple={RIPPLE}
      style={({ pressed }) => [
        ps.menuRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
        pressed && Platform.OS === "ios" ? ps.pressed : null,
      ]}
    >
      <View style={[ps.iconBox, box.neutral]}>
        <MobileIcon name={icon} size={20} color={box.neutralColor} />
      </View>
      <View style={ps.grow}>
        <Text style={[ps.rowTitle, { color: theme.textHeading }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[ps.small, { color: theme.textSecondary }]} numberOfLines={2}>
          {summary}
        </Text>
      </View>
      {pill ? <MobileStatusPill label={pill.label} tone={pill.tone} /> : null}
      <MobileIcon name="chevron-right" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

/** Label above value, used in the profile list and the room facts grid. */
export function DetailField({ label, value, style }: { label: string; value: string; style?: StyleProp<ViewStyle> }) {
  const { theme } = useMobileTheme();
  return (
    <View style={[ps.field, style]}>
      <Text style={[ps.small, { color: theme.textSecondary }]}>{label}</Text>
      <Text selectable style={[ps.value, { color: theme.textHeading }]}>
        {value}
      </Text>
    </View>
  );
}

export function DemoNotice({ text }: { text: string }) {
  const { theme, isDark } = useMobileTheme();
  return (
    <View
      style={[
        ps.notice,
        { borderColor: theme.border, backgroundColor: isDark ? "rgba(148,163,184,0.10)" : "#F8FAFC" },
      ]}
    >
      <MobileIcon name="info" size={16} color={theme.textSecondary} />
      <Text style={[ps.small, ps.grow, { color: theme.textSecondary }]}>{text}</Text>
    </View>
  );
}

export function useCallPhone() {
  const { t } = useLocale();
  return (raw: string) => {
    const dial = phoneDialString(raw);
    if (!dial) return;
    const shown = formatPhoneDisplay(raw);
    Linking.openURL(`tel:${dial}`).catch(async () => {
      await Clipboard.setStringAsync(shown);
      Alert.alert(t.agent.leads.phoneCopied, shown);
    });
  };
}

/** Round yellow phone button. */
export function CallButton({ phone, label }: { phone: string; label: string }) {
  const call = useCallPhone();
  if (!phoneDialString(phone)) return null;
  return (
    <Pressable
      onPress={() => call(phone)}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: "rgba(33,30,30,0.16)", borderless: true }}
      hitSlop={4}
      style={({ pressed }) => [ps.callButton, pressed && Platform.OS === "ios" ? ps.pressed : null]}
    >
      <MobileIcon name="phone" size={20} color={tokens.colors.onBrand} />
    </Pressable>
  );
}

export const ps = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12, overflow: "hidden" },
  sectionLabel: {
    fontFamily: tokens.typography.native.bodyBold,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 4,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    minHeight: 68,
  },
  pressed: { opacity: 0.7 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  grow: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: tokens.typography.native.bodyBold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
  body: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 21 },
  value: { fontFamily: tokens.typography.native.bodyBold, fontSize: 14, lineHeight: 21 },
  amount: { fontFamily: tokens.typography.native.bodyBold, fontSize: 16, lineHeight: 24 },
  field: { gap: 2 },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.colors.brand[500],
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
});
