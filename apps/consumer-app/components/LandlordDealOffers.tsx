import React, { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { MobileButton, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { DealOffer } from "@nestyk/types";
import { fillTemplate, localizedError, useLocale } from "@nestyk/i18n";
import { confirmLandlordDealOffer, listLandlordDealOffers } from "../lib/deal-offers-api";
import { DealOfferSummary } from "./DealOfferSection";

/**
 * D2: offers on the landlord's rooms. The landlord confirms the ones waiting for them; confirmed ones stay listed
 * so the landlord sees what was agreed. Nothing is shown when there is no offer.
 */
export function LandlordDealOffers({ reloadToken = 0 }: { reloadToken?: number }) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const oc = t.contracts.offer;
  const [offers, setOffers] = useState<DealOffer[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const text = { color: theme.textSecondary, fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 22 };

  const load = useCallback(async () => {
    try {
      setOffers(await listLandlordDealOffers());
    } catch (e) {
      setError(localizedError(e, oc.loadFailed, locale));
    }
  }, [oc.loadFailed, locale]);

  useEffect(() => {
    setError("");
    void load();
  }, [load, reloadToken]);

  async function confirm(offer: DealOffer) {
    if (busy != null) return;
    setBusy(offer.id);
    setError("");
    try {
      const next = await confirmLandlordDealOffer(offer.id, offer.revision);
      setOffers((current) => current.map((row) => (row.id === next.id ? next : row)));
    } catch (e) {
      // A newer revision or a closed offer: read the list again so the landlord sees the latest terms.
      setError(localizedError(e, t.common.errorGeneric, locale));
      await load();
    } finally {
      setBusy(null);
    }
  }

  const waiting = offers.filter((offer) => offer.status === "awaiting_landlord");
  const confirmed = offers.filter((offer) => offer.status === "confirmed");
  if (!waiting.length && !confirmed.length && !error) return null;
  const card = (offer: DealOffer) => (
    <View key={offer.id} style={{ gap: 6, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 14, backgroundColor: theme.card }}>
      <Text style={{ ...text, color: theme.textHeading, fontFamily: tokens.typography.native.bodyBold }}>{offer.roomLabel}</Text>
      <Text style={text}>{fillTemplate(oc.landlordTenant, { name: offer.leadName })}</Text>
      <DealOfferSummary offer={offer} />
      {offer.status === "awaiting_landlord" ? (
        <>
          <Text style={{ ...text, fontSize: 13 }}>{oc.landlordConfirmHint}</Text>
          <MobileButton disabled={busy != null} isLoading={busy === offer.id} onPress={() => void confirm(offer)}>
            {oc.landlordConfirm}
          </MobileButton>
        </>
      ) : (
        <Text style={{ ...text, fontSize: 13 }}>{oc.status.confirmed}</Text>
      )}
    </View>
  );
  return (
    <View style={{ gap: 10 }}>
      {waiting.length ? <Text style={{ ...text, color: theme.textHeading, fontSize: 16 }}>{oc.landlordTitle}</Text> : null}
      {waiting.map(card)}
      {confirmed.length ? <Text style={{ ...text, color: theme.textHeading, fontSize: 16 }}>{oc.landlordConfirmedTitle}</Text> : null}
      {confirmed.map(card)}
      {error ? <Text accessibilityRole="alert" style={{ ...text, color: tokens.colors.danger }}>{error}</Text> : null}
    </View>
  );
}
