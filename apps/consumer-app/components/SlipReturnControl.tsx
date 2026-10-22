import React, { useState } from "react";
import { Text, View } from "react-native";
import { MobileButton, MobileInput, tokens, useMobileTheme } from "@nestyk/ui/native";
import { useLocale } from "@nestyk/i18n";

/**
 * D11 (AC-3.4, 5.4): the agent returns the tenant's booking or deposit slip with a reason (required, up to 500
 * characters, the same rule as rent bills). The tenant sees the reason and sends a new slip.
 */
export function SlipReturnControl({
  busy,
  onReturn,
}: {
  busy: boolean;
  /** Resolves false when the request failed, so the reason stays for another try. */
  onReturn: (reason: string) => Promise<boolean | void> | boolean | void;
}) {
  const { theme } = useMobileTheme();
  const { t } = useLocale();
  const sr = t.contracts.slipReturn;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open)
    return (
      <MobileButton variant="outline" disabled={busy} onPress={() => { setReason(""); setOpen(true); }}>
        {sr.action}
      </MobileButton>
    );
  const text = reason.trim();
  return (
    <View style={{ gap: 8 }}>
      <MobileInput
        label={sr.reason}
        placeholder={sr.placeholder}
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={500}
        required
      />
      <Text style={{ color: theme.textSecondary, fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20 }}>
        {sr.hint}
      </Text>
      <MobileButton
        disabled={busy || !text}
        isLoading={busy}
        onPress={async () => {
          if (busy || !text) return;
          if ((await onReturn(text)) !== false) setOpen(false);
        }}
      >
        {sr.confirm}
      </MobileButton>
      <MobileButton variant="outline" disabled={busy} onPress={() => setOpen(false)}>
        {sr.cancel}
      </MobileButton>
    </View>
  );
}
