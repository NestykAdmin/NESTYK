import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  MobileButton,
  MobileIcon,
  tokens,
  useMobileTheme,
  type AppIconName,
} from "@nestyk/ui/native";
import { fillTemplate, useLocale, type ContractCopy } from "@nestyk/i18n";

/** Create-menu options shown under the contract type picker. */
export type CreateDocumentKind =
  | "reservation"
  | "lease"
  | "renewal"
  | "invoice"
  | "broker_appointment"
  | "agent_commission";

const CREATE_OPTIONS: Array<{
  kind: CreateDocumentKind;
  label?: keyof ContractCopy["picker"];
  icon: AppIconName;
}> = [
  { kind: "reservation", label: "reservation", icon: "calendar" },
  { kind: "lease", label: "lease", icon: "key" },
  { kind: "renewal", label: "renewal", icon: "file-text" },
  { kind: "invoice", label: "invoice", icon: "note" },
  { kind: "broker_appointment", label: "brokerAppointment", icon: "handshake" },
  { kind: "agent_commission", icon: "users" },
];

export function ContractTypePicker({
  onSelect,
  onBack,
  message,
  disabledKinds = [],
  disabledHint,
}: {
  onSelect: (kind: CreateDocumentKind) => void;
  onBack: () => void;
  message?: string;
  disabledKinds?: CreateDocumentKind[];
  disabledHint?: string;
}) {
  const { theme } = useMobileTheme();
  const { t } = useLocale();
  const pc = t.contracts.picker;
  const library = t.contracts.screen.library;
  return (
    <View style={styles.root}>
      <MobileButton variant="outline" onPress={onBack}>
        {pc.back}
      </MobileButton>
      <View style={styles.heading}>
        <Text style={[styles.title, { color: theme.textHeading }]}>
          {pc.title}
        </Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          {pc.question}
        </Text>
        {!!message && (
          <Text accessibilityRole="alert" style={styles.message}>
            {message}
          </Text>
        )}
      </View>
      {([
        { title: library.rental, kinds: ["reservation", "lease", "renewal"] },
        { title: library.finance, kinds: ["invoice"] },
        { title: library.brokerage, kinds: ["broker_appointment", "agent_commission"] },
      ]).map(group => <View key={group.title} style={styles.group}>
        <Text style={[styles.groupTitle, { color: theme.textHeading }]}>{group.title}</Text>
        {CREATE_OPTIONS.filter(option => group.kinds.includes(option.kind)).map(option => {
          const label = option.label ? pc[option.label] : t.agent.contracts.commissionConfirmation.menu;
          const disabled = disabledKinds.includes(option.kind);
          return <Pressable key={option.kind} accessibilityRole="button" accessibilityState={{ disabled }}
            accessibilityLabel={fillTemplate(pc.createA11y, { label })} disabled={disabled}
            onPress={() => onSelect(option.kind)} style={({ pressed }) => [styles.tile, disabled && styles.tileDisabled, { opacity: disabled ? 0.65 : pressed ? 0.75 : 1 }]}>
            <View style={styles.icon}><MobileIcon name={option.icon} size={23} color={disabled ? "#64748B" : "#A66B00"} weight="regular" /></View>
            <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
            <MobileIcon name="chevron-right" size={18} color="#64748B" />
          </Pressable>;
        })}
        {group.title === library.finance && <Text style={[styles.description, { color: theme.textSecondary }]}>{library.autoFinanceHint}</Text>}
      </View>)}
      {!!disabledHint && (
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          {disabledHint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 22, paddingBottom: 24, backgroundColor: "#FFFFFF" },
  heading: { gap: 6 },
  title: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 22,
    lineHeight: 32,
  },
  description: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 23,
  },
  message: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
    color: "#C74747",
  },
  group: { gap: 10 },
  groupTitle: { fontFamily: tokens.typography.native.headingTh, fontSize: 17, lineHeight: 26 },
  tile: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
    borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 16, backgroundColor: "#FFFFFF",
  },
  icon: { backgroundColor: "#FFF6DC", padding: 10, borderRadius: 12 },
  label: { flex: 1, fontFamily: tokens.typography.native.headingTh, fontSize: 14, lineHeight: 22, color: "#334155" },
  tileDisabled: { backgroundColor: "#F8FAFC" },
  labelDisabled: { color: "#64748B" },
});
