import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocale } from "@nestyk/i18n";
import { useMobileTheme } from "@nestyk/ui/native";
import type { AgentTenant } from "@nestyk/types";
import { AgreementAttachments } from "./AgreementAttachments";
import { DetailCard, ps } from "./TenantDetailParts";

/** Every contract's attachment checklist on one page, newest contract first. */
export function TenantAttachmentsBody({ tenant }: { tenant: AgentTenant }) {
  const { t } = useLocale();
  const d = t.agent.tenants.detail;
  const { theme } = useMobileTheme();
  const contracts = tenant.contracts
    .filter((c) => c.status !== "cancelled")
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || b.id - a.id);

  if (!contracts.length) {
    return (
      <DetailCard>
        <Text style={[ps.body, { color: theme.textSecondary, textAlign: "center" }]}>{d.attachmentsEmpty}</Text>
      </DetailCard>
    );
  }

  return (
    <View style={s.root}>
      <Text style={[ps.body, { color: theme.textSecondary }]}>{d.attachmentsSummary}</Text>
      {contracts.map((contract) => (
        <DetailCard key={contract.id}>
          <View>
            <Text style={[ps.rowTitle, { color: theme.textHeading }]}>{contract.agreementTypeName}</Text>
            <Text style={[ps.small, { color: theme.textSecondary }]}>{contract.contractNo}</Text>
          </View>
          <AgreementAttachments contractId={contract.id} formKind={contract.formKind} />
        </DetailCard>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 14 },
});
