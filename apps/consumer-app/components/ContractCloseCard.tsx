import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MobileButton, MobileFilterChip, MobileInput, tokens, useMobileTheme } from "@nestyk/ui/native";
import { fillTemplate, localizedError, useLocale } from "@nestyk/i18n";
import type { AgentContract, CloseAgentContractResult, ContractEndReason } from "@nestyk/types";
import { closeAgentContract, listContractEndReasons } from "../lib/agent-contracts-api";
import { closeDateProblem, closeInput, closeOptions, type CloseOption } from "../lib/contract-close";
import { bangkokDateKey } from "../lib/lease-term";

/**
 * "Close contract" on an active lease or renewal: pick a reason the API accepts today,
 * check the end date, read what will happen, then confirm. Closing cannot be undone.
 */
export function ContractCloseCard({
  contract,
  disabled = false,
  onClosed,
  today = bangkokDateKey(),
}: {
  contract: AgentContract;
  disabled?: boolean;
  onClosed: (result: CloseAgentContractResult) => void;
  today?: string;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const cc = t.agent.contracts.closeContract;
  const statusLabel = t.contracts.common.status;
  const [open, setOpen] = useState(false);
  const [reasons, setReasons] = useState<ContractEndReason[] | null>(null);
  const [code, setCode] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || reasons) return;
    let live = true;
    listContractEndReasons()
      .then((rows) => {
        if (live) setReasons(rows);
      })
      .catch((e) => {
        if (live) setError(localizedError(e, cc.loadFailed, locale));
      });
    return () => {
      live = false;
    };
  }, [open, reasons, cc.loadFailed, locale]);

  const options = reasons ? closeOptions(contract, reasons, today) : [];
  const option: CloseOption | undefined = options.find((row) => row.reason.code === code);
  const start = contract.startDate.slice(0, 10);
  const end = contract.endDate?.slice(0, 10) ?? "";
  const problem = option ? closeDateProblem(option, option.dateLocked ? option.date : date, contract, today) : null;
  const noteMissing = !!option?.reason.requiresNote && !note.trim();
  const reasonName = (reason: ContractEndReason) => (locale === "th" ? reason.nameTh : reason.nameEn || reason.nameTh);

  function choose(next: CloseOption) {
    setCode(next.reason.code);
    setDate(next.date);
    setError("");
  }

  function reset() {
    setOpen(false);
    setCode("");
    setDate("");
    setNote("");
    setError("");
  }

  async function confirm() {
    if (!option || problem || noteMissing || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await closeAgentContract(contract.id, closeInput(option, date, note));
      reset();
      onClosed(result);
    } catch (e) {
      setError(localizedError(e, cc.failed, locale));
    } finally {
      setBusy(false);
    }
  }

  const ink = { color: theme.textHeading };
  const muted = { color: theme.textSecondary };
  if (!open)
    return (
      <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[s.small, muted]}>{cc.hint}</Text>
        <MobileButton variant="outline" disabled={disabled} onPress={() => setOpen(true)}>
          {cc.action}
        </MobileButton>
      </View>
    );

  return (
    <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[s.title, ink]}>{fillTemplate(cc.title, { no: contract.contractNo })}</Text>
      {!!error && (
        <Text accessibilityRole="alert" style={[s.body, s.error]}>
          {error}
        </Text>
      )}
      {!reasons ? (
        !error && <Text style={[s.body, muted]}>{cc.loading}</Text>
      ) : !options.length ? (
        <Text style={[s.body, muted]}>{cc.noOption}</Text>
      ) : (
        <>
          <Text style={[s.label, ink]}>{cc.reason}</Text>
          <View style={s.chips}>
            {options.map((row) => (
              <MobileFilterChip
                key={row.reason.code}
                label={reasonName(row.reason)}
                selected={row.reason.code === code}
                disabled={busy}
                onPress={() => choose(row)}
              />
            ))}
          </View>
          {option && (
            <>
              {option.reason.status === "cancelled" && today >= start && (
                <Text style={[s.body, s.error]}>{fillTemplate(cc.cancelAfterStart, { start })}</Text>
              )}
              {option.dateLocked ? (
                <Text style={[s.body, muted]}>{fillTemplate(cc.dateLocked, { date: option.date })}</Text>
              ) : (
                <MobileInput
                  label={cc.date}
                  value={date}
                  onChangeText={setDate}
                  editable={!busy}
                  maxLength={10}
                  autoCapitalize="none"
                  error={problem ? fillTemplate(cc.problems[problem], { start, end }) : undefined}
                />
              )}
              <MobileInput
                label={option.reason.requiresNote ? cc.noteRequired : cc.note}
                value={note}
                onChangeText={setNote}
                editable={!busy}
                maxLength={1000}
                multiline
              />
              <Text style={[s.label, ink]}>{cc.effectsTitle}</Text>
              {[
                fillTemplate(cc.effectStatus, { status: statusLabel[option.reason.status] }),
                cc.effectRoom,
                cc.effectLinks,
                cc.effectBills,
              ].map((line) => (
                <Text key={line} style={[s.body, muted]}>{`• ${line}`}</Text>
              ))}
            </>
          )}
        </>
      )}
      <MobileButton disabled={!option || !!problem || noteMissing || busy} isLoading={busy} onPress={() => void confirm()}>
        {cc.confirm}
      </MobileButton>
      <MobileButton variant="outline" disabled={busy} onPress={reset}>
        {cc.back}
      </MobileButton>
    </View>
  );
}

/** The notice shown after closing: what happened to the bills that were already issued. */
export function closeResultNotice(
  result: CloseAgentContractResult,
  copy: { done: string; doneUnpaid: string; doneAfterEnd: string },
): string {
  const lines = [copy.done];
  if (result.billing.unpaidCount)
    lines.push(
      fillTemplate(copy.doneUnpaid, {
        count: result.billing.unpaidCount,
        amount: Number(result.billing.unpaidAmount).toLocaleString("en-US", { minimumFractionDigits: 2 }),
      }),
    );
  if (result.billing.billsDueAfterEndCount)
    lines.push(fillTemplate(copy.doneAfterEnd, { count: result.billing.billsDueAfterEndCount }));
  return lines.join(" · ");
}

const s = StyleSheet.create({
  card: { padding: 18, borderWidth: 1, borderRadius: 18, gap: 10 },
  title: { fontFamily: tokens.typography.native.headingTh, fontSize: 17, lineHeight: 27 },
  label: { fontFamily: tokens.typography.native.bodyBold, fontSize: 14, lineHeight: 22 },
  body: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 23 },
  small: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  error: { color: "#C74747" },
});
