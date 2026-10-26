import React, { useState } from "react";
import { Text, View } from "react-native";
import { MobileButton, MobileInput, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { AgentContract } from "@nestyk/types";
import { fillTemplate, useLocale } from "@nestyk/i18n";
import { billFormatters } from "../lib/bill-format";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * D4 (AC-5.5): the handover day of a lease waiting for its deposit or handover (the lease start unless moved), the
 * moves so far, and moving it with a reason. The agent is reminded on that day if the deposit is not paid.
 */
export function HandoverDueControl({
  contract,
  busy,
  onMove,
}: {
  contract: Pick<AgentContract, "handoverDue">;
  busy: boolean;
  /** True when saved (the form closes); false keeps what was typed. */
  onMove: (date: string, reason: string) => Promise<boolean>;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const hc = t.contracts.handoverDue;
  const fmt = billFormatters(locale);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [issue, setIssue] = useState<"" | "date" | "reason">("");
  const due = contract.handoverDue;
  if (!due) return null;
  const text = { color: theme.textSecondary, fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20 };
  async function save() {
    const day = date.trim();
    if (!ISO_DATE.test(day)) return setIssue("date");
    if (!reason.trim()) return setIssue("reason");
    setIssue("");
    if (await onMove(day, reason.trim())) {
      setOpen(false);
      setDate("");
      setReason("");
    }
  }
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ ...text, color: theme.textHeading, fontFamily: tokens.typography.native.bodyBold, fontSize: 14 }}>
        {fillTemplate(hc.title, { date: fmt.date(due.date) })}
      </Text>
      {due.history.map((h, i) => (
        <Text key={`${h.at}:${i}`} style={text}>
          {fillTemplate(hc.historyItem, { from: fmt.date(h.from), to: fmt.date(h.to), reason: h.reason })}
        </Text>
      ))}
      {open ? (
        <View style={{ gap: 8 }}>
          <MobileInput label={hc.date} value={date} placeholder="2026-11-05" maxLength={10} editable={!busy}
            onChangeText={(value) => { setDate(value); setIssue(""); }} error={issue === "date" ? hc.dateInvalid : undefined} />
          <MobileInput label={hc.reason} value={reason} multiline maxLength={500} editable={!busy}
            onChangeText={(value) => { setReason(value); setIssue(""); }} error={issue === "reason" ? hc.reasonRequired : undefined} />
          <MobileButton disabled={busy} isLoading={busy} onPress={() => void save()}>{hc.save}</MobileButton>
          <MobileButton variant="outline" disabled={busy} onPress={() => { setOpen(false); setIssue(""); }}>{hc.cancel}</MobileButton>
        </View>
      ) : (
        <MobileButton variant="outline" disabled={busy} onPress={() => setOpen(true)}>{hc.move}</MobileButton>
      )}
    </View>
  );
}
