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
      <View style={styles.grid}>
        {CREATE_OPTIONS.map((option) => {
          const label = option.label
            ? pc[option.label]
            : t.agent.contracts.commissionConfirmation.menu;
          const disabled = disabledKinds.includes(option.kind);
          return (
          <Pressable
            key={option.kind}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            accessibilityLabel={fillTemplate(pc.createA11y, { label })}
            disabled={disabled}
            onPress={() => onSelect(option.kind)}
            style={({ pressed }) => [
              styles.tile,
              disabled && styles.tileDisabled,
              { opacity: disabled ? 1 : pressed ? 0.75 : 1 },
            ]}
          >
            <MobileIcon
              name={option.icon}
              size={30}
              color={disabled ? "#64748B" : "#FFFFFF"}
              weight="regular"
            />
            <Text style={[styles.label, disabled && styles.labelDisabled]}>
              {label}
            </Text>
          </Pressable>
          );
        })}
      </View>
      {!!disabledHint && (
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          {disabledHint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 22, paddingBottom: 24 },
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "31%",
    maxWidth: 160,
    aspectRatio: 1,
    borderRadius: 20,
    backgroundColor: "#008CC4",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    gap: 10,
  },
  label: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    color: "#FFFFFF",
  },
  tileDisabled: { backgroundColor: "#E5E7EB" },
  labelDisabled: { color: "#64748B" },
});
