import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { MobileButton, MobileInput, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { DealOffer, DealOfferConfirmationMethod } from "@nestyk/types";
import { fillTemplate, localizedError, useLocale } from "@nestyk/i18n";
import {
  EMPTY_DEAL_OFFER_FORM,
  dealOfferBody,
  dealOfferDirty,
  dealOfferForm,
  dealOfferIssues,
  openDealOfferFor,
  type DealOfferField,
  type DealOfferForm,
  type DealOfferIssue,
} from "../lib/deal-offer";
import {
  cancelDealOffer,
  createDealOffer,
  listLeadDealOffers,
  recordDealOfferConfirmation,
  sendDealOffer,
  updateDealOffer,
} from "../lib/deal-offers-api";

const METHODS: readonly DealOfferConfirmationMethod[] = ["phone", "line", "in_person", "other"];

/** D2: the terms of an offer as read-only lines (the agent's confirmed offer, and the landlord's list). */
export function DealOfferSummary({ offer }: { offer: DealOffer }) {
  const { theme } = useMobileTheme();
  const { t } = useLocale();
  const oc = t.contracts.offer;
  const sc = oc.summary;
  const text = { color: theme.textSecondary, fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 22 };
  const rows: Array<[string, string]> = [
    [sc.rent, offer.monthlyRent],
    [sc.term, fillTemplate(sc.termValue, { months: String(offer.termMonths), from: offer.startDate, to: offer.endDate })],
    [sc.reservation, offer.reservationAmount],
    [sc.deposit, offer.depositAmount],
    [sc.contractDate, offer.contractDate],
    [sc.due, fillTemplate(sc.dueValue, { day: String(offer.rentDueDay) })],
    [sc.grace, offer.graceDay == null ? sc.none : fillTemplate(sc.graceValue, { day: String(offer.graceDay) })],
    [sc.lateFee, offer.lateFeePerDay ?? sc.none],
    [sc.notice, fillTemplate(sc.noticeValue, { days: String(offer.renewalNoticeDays) })],
    // The landlord's view has no agent name (deal-offers.service.ts landlordDealOffer).
    [sc.coBroke, offer.coBroke ? offer.coBrokeAgentName || oc.yes : oc.no],
  ];
  return (
    <View style={{ gap: 2 }}>
      {rows.map(([label, value]) => (
        <Text key={label} style={text}>
          {label}: {value}
        </Text>
      ))}
    </View>
  );
}

/**
 * D2 (AC-2.1 to 2.4, round 1): the offer for this lead and room, inside the booking sheet. The agent fills it in,
 * sends it to the landlord (who confirms in the app) or records how the landlord confirmed, and can book only once
 * it is confirmed. A confirmed offer is read-only; to change it the agent cancels it and makes a new one.
 */
export function DealOfferSection({
  leadId,
  roomId,
  disabled = false,
  onConfirmedChange,
}: {
  leadId: number;
  roomId: number;
  disabled?: boolean;
  /** True while this lead and room have an offer the landlord confirmed. */
  onConfirmedChange: (confirmed: boolean) => void;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const oc = t.contracts.offer;
  const [offer, setOffer] = useState<DealOffer | null>(null);
  const [form, setForm] = useState<DealOfferForm>(EMPTY_DEAL_OFFER_FORM);
  const [issues, setIssues] = useState<Partial<Record<DealOfferField, DealOfferIssue>>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [method, setMethod] = useState<DealOfferConfirmationMethod>("phone");
  const [note, setNote] = useState("");
  const [noteMissing, setNoteMissing] = useState(false);
  const text = { color: theme.textSecondary, fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 22 };

  const show = useCallback((next: DealOffer | null) => {
    setOffer(next);
    setForm(next ? dealOfferForm(next) : EMPTY_DEAL_OFFER_FORM);
    setIssues({});
    setRecording(false);
  }, []);

  /** Only the latest load counts: a slow answer for another lead or room must not show (or allow booking). */
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      const offers = await listLeadDealOffers(leadId);
      if (seq === loadSeq.current) show(openDealOfferFor(offers, roomId));
    } catch (e) {
      if (seq === loadSeq.current) setError(localizedError(e, oc.loadFailed, locale));
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [leadId, roomId, show, oc.loadFailed, locale]);

  useEffect(() => {
    setError("");
    void load();
  }, [load]);

  useEffect(() => {
    onConfirmedChange(offer?.status === "confirmed");
  }, [offer, onConfirmedChange]);

  /** Runs an action; after a refusal (e.g. a newer revision) the offer is read again. */
  async function run(action: () => Promise<DealOffer>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await action();
      show(next.status === "cancelled" ? null : next);
    } catch (e) {
      setError(localizedError(e, t.common.errorGeneric, locale));
      await load();
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const found = dealOfferIssues(form);
    setIssues(found);
    if (Object.keys(found).length) return;
    const body = dealOfferBody(form);
    void run(() => (offer ? updateDealOffer(offer.id, { ...body, revision: offer.revision }) : createDealOffer({ ...body, leadId, rentRoomId: roomId })));
  }

  function record() {
    if (!offer) return;
    if (!note.trim()) {
      setNoteMissing(true);
      return;
    }
    void run(() => recordDealOfferConfirmation(offer.id, { revision: offer.revision, method, note: note.trim() }));
  }

  if (loading && !offer && !error) return <Text style={text}>{oc.loading}</Text>;
  const off = disabled || busy;
  const dirty = dealOfferDirty(form, offer);
  const setField = (key: DealOfferField, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
    setIssues((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };
  const issue = (key: DealOfferField) => (issues[key] ? oc.issues[issues[key]!] : undefined);
  const input = (key: Exclude<DealOfferField, "coBroke">, numeric = false) => (
    <MobileInput
      key={key}
      label={oc.fields[key]}
      value={form[key]}
      onChangeText={(value) => setField(key, value)}
      keyboardType={numeric ? "decimal-pad" : undefined}
      placeholder={key === "startDate" || key === "contractDate" ? "2026-11-01" : key === "renewalNoticeDays" ? "30" : undefined}
      maxLength={key === "coBrokeAgentName" ? 120 : 20}
      editable={!off}
      error={issue(key)}
    />
  );
  const status = offer?.status ?? "draft";

  return (
    <View style={{ gap: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <Text style={{ ...text, color: theme.textHeading, fontFamily: tokens.typography.native.bodyBold, fontSize: 16 }}>{oc.title}</Text>
        {offer ? (
          <Text accessibilityLabel={fillTemplate(oc.statusA11y, { status: oc.status[status] })} style={{ ...text, fontSize: 13 }}>
            {oc.status[status]}
          </Text>
        ) : null}
      </View>
      {offer?.status === "confirmed" ? (
        <>
          <DealOfferSummary offer={offer} />
          <Text style={text}>
            {offer.confirmationChannel === "app"
              ? oc.confirmedInApp
              : fillTemplate(oc.confirmedRecorded, { method: oc.methods[offer.confirmationMethod ?? "other"], note: offer.confirmationNote ?? "" })}
          </Text>
          <Text style={{ ...text, fontSize: 13 }}>{oc.locked}</Text>
          <MobileButton variant="outline" disabled={off} onPress={() => void run(() => cancelDealOffer(offer.id, offer.revision))}>
            {oc.cancel}
          </MobileButton>
        </>
      ) : (
        <>
          <Text style={{ ...text, fontSize: 13 }}>{oc.intro}</Text>
          {input("monthlyRent", true)}
          {form.monthlyRent.trim() && !issues.monthlyRent ? (
            <Text style={{ ...text, fontSize: 13 }}>{fillTemplate(oc.reservationAmount, { amount: form.monthlyRent.trim() })}</Text>
          ) : null}
          {input("termMonths", true)}
          {input("startDate")}
          {input("depositAmount", true)}
          {input("contractDate")}
          {input("rentDueDay", true)}
          {input("graceDay", true)}
          {input("lateFeePerDay", true)}
          {input("renewalNoticeDays", true)}
          <Text style={text}>{oc.fields.coBroke}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[true, false].map((value) => (
              <MobileButton key={String(value)} variant={form.coBroke === value ? "primary" : "outline"} disabled={off} onPress={() => setField("coBroke", value)}>
                {value ? oc.yes : oc.no}
              </MobileButton>
            ))}
          </View>
          {form.coBroke ? input("coBrokeAgentName") : null}
          <MobileButton disabled={off || (!!offer && !dirty)} isLoading={busy} onPress={save}>
            {oc.save}
          </MobileButton>
          {offer ? (
            <>
              {dirty ? <Text style={{ ...text, fontSize: 13 }}>{oc.unsaved}</Text> : null}
              {offer.status === "awaiting_landlord" ? <Text style={{ ...text, fontSize: 13 }}>{oc.sentHint}</Text> : null}
              {offer.status === "draft" && offer.landlordInApp ? (
                <MobileButton variant="outline" disabled={off || dirty} onPress={() => void run(() => sendDealOffer(offer.id, offer.revision))}>
                  {oc.send}
                </MobileButton>
              ) : null}
              {!offer.landlordInApp ? <Text style={{ ...text, fontSize: 13 }}>{oc.noLandlordApp}</Text> : null}
              {recording ? (
                <View style={{ gap: 8 }}>
                  <Text style={text}>{oc.recordTitle}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {METHODS.map((value) => (
                      <MobileButton key={value} variant={method === value ? "primary" : "outline"} disabled={off} onPress={() => setMethod(value)}>
                        {oc.methods[value]}
                      </MobileButton>
                    ))}
                  </View>
                  <MobileInput
                    label={oc.recordNote}
                    value={note}
                    multiline
                    maxLength={500}
                    editable={!off}
                    onChangeText={(value) => {
                      setNote(value);
                      setNoteMissing(false);
                    }}
                    error={noteMissing ? oc.recordNoteRequired : undefined}
                  />
                  <MobileButton disabled={off || dirty} isLoading={busy} onPress={record}>
                    {oc.recordConfirm}
                  </MobileButton>
                  <MobileButton variant="outline" disabled={off} onPress={() => setRecording(false)}>
                    {oc.recordCancel}
                  </MobileButton>
                </View>
              ) : (
                <MobileButton variant="outline" disabled={off || dirty} onPress={() => { setNote(""); setNoteMissing(false); setRecording(true); }}>
                  {oc.record}
                </MobileButton>
              )}
              <MobileButton variant="outline" disabled={off} onPress={() => void run(() => cancelDealOffer(offer.id, offer.revision))}>
                {oc.cancel}
              </MobileButton>
            </>
          ) : null}
        </>
      )}
      {error ? <Text accessibilityRole="alert" style={{ ...text, color: tokens.colors.danger }}>{error}</Text> : null}
      {loading && offer ? <ActivityIndicator color={tokens.colors.brand[500]} /> : null}
    </View>
  );
}
