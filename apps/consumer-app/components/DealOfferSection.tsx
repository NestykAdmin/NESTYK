import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { MobileButton, MobileInput, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { DealOffer, DealOfferConfirmationMethod, DealOfferRevision } from "@nestyk/types";
import { fillTemplate, localizedError, useLocale } from "@nestyk/i18n";
import {
  EMPTY_DEAL_OFFER_FORM,
  dealOfferBody,
  dealOfferDirty,
  dealOfferForm,
  dealOfferIssues,
  openDealOfferFor,
  reservationOverpaid,
  bangkokDay,
  revisionChanges,
  type DealOfferField,
  type DealOfferForm,
  type DealOfferIssue,
} from "../lib/deal-offer";
import {
  cancelDealOffer,
  createDealOffer,
  listLeadDealOffers,
  recordDealOfferConfirmation,
  reviseDealOffer,
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
 * D2 round 2 (AC-2.4): the changes made to a confirmed offer, oldest first: when, how the landlord agreed, what changed,
 * and (for the agent) the reason. The landlord's list passes revisions without the reason.
 */
export function DealOfferHistory({ revisions }: { revisions: readonly DealOfferRevision[] }) {
  const { theme } = useMobileTheme();
  const { t } = useLocale();
  const oc = t.contracts.offer;
  const rc = oc.revise;
  const text = { color: theme.textSecondary, fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20 };
  const value = (v: string | number | boolean | null) => (v === null || v === "" ? oc.summary.none : typeof v === "boolean" ? (v ? oc.yes : oc.no) : String(v));
  if (!revisions.length) return null;
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ ...text, color: theme.textHeading, fontFamily: tokens.typography.native.bodyBold, fontSize: 14 }}>{rc.history}</Text>
      {revisions.map((r, index) => (
        <View key={r.revision} style={{ gap: 2 }}>
          <Text style={{ ...text, color: theme.textHeading }}>
            {fillTemplate(rc.historyItem, {
              n: String(index + 1),
              date: bangkokDay(r.createdAt),
              method: oc.methods[r.agreedVia],
            })}
          </Text>
          {revisionChanges(r).map((c) => (
            <Text key={c.key} style={text}>
              {fillTemplate(rc.change, { field: rc.labels[c.key], from: value(c.from), to: value(c.to) })}
            </Text>
          ))}
          {r.reason ? <Text style={text}>{fillTemplate(rc.historyReason, { reason: r.reason })}</Text> : null}
        </View>
      ))}
    </View>
  );
}

/**
 * D2 (AC-2.1 to 2.4, round 1): the offer for this lead and room, inside the booking sheet. The agent fills it in,
 * sends it to the landlord (who confirms in the app) or records how the landlord confirmed, and can book only once
 * it is confirmed. Round 2 (Aof 26 Oct 2026): a confirmed offer changes through "change offer" with a reason and how
 * the landlord agreed; mode "deal" shows only a confirmed offer (on the contract screen, after booking).
 */
export function DealOfferSection({
  leadId,
  roomId,
  disabled = false,
  mode = "booking",
  onConfirmedChange,
  onRevised,
}: {
  leadId: number;
  roomId: number;
  disabled?: boolean;
  /** booking: the booking sheet (make, send, confirm, cancel); deal: a confirmed offer only, to read and change. */
  mode?: "booking" | "deal";
  /** True while this lead and room have an offer the landlord confirmed. */
  onConfirmedChange?: (confirmed: boolean) => void;
  /** After a change: the documents of the deal may have changed too. */
  onRevised?: (offer: DealOffer) => void;
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
  const [revising, setRevising] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonMissing, setReasonMissing] = useState(false);
  const [agreedVia, setAgreedVia] = useState<DealOfferConfirmationMethod>("phone");
  const [notice, setNotice] = useState("");
  const text = { color: theme.textSecondary, fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 22 };

  const show = useCallback((next: DealOffer | null) => {
    setOffer(next);
    setForm(next ? dealOfferForm(next) : EMPTY_DEAL_OFFER_FORM);
    setIssues({});
    setRecording(false);
    setRevising(false);
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
    onConfirmedChange?.(offer?.status === "confirmed");
  }, [offer, onConfirmedChange]);

  /** The app's own words for the refusals a change of the offer can get (AC-2.4, AC-2.5). */
  function refusal(e: unknown) {
    const code = (e as { code?: string } | null)?.code;
    const errors = oc.revise.errors;
    if (code === "OFFER_LEASE_SIGNED") return errors.leaseSigned;
    if (code === "OFFER_DOCUMENT_SIGNING") return errors.documentSigning;
    if (code === "OFFER_START_BEFORE_LEASE_END") return errors.startBeforeLeaseEnd;
    if (code === "OFFER_UNCHANGED") return oc.revise.unchanged;
    return localizedError(e, t.common.errorGeneric, locale);
  }

  /** Runs an action; after a refusal (e.g. a newer revision) the offer is read again. */
  async function run(action: () => Promise<DealOffer>, revised = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await action();
      show(next.status === "cancelled" ? null : next);
      if (revised) {
        setNotice(oc.revise.done);
        onRevised?.(next);
      }
    } catch (e) {
      setError(refusal(e));
      // A refused change keeps what the agent typed, to fix it and try again, unless the offer changed meanwhile:
      // then the latest one is read (the agent changes that one).
      if (!revised || (e as { code?: string } | null)?.code === "OFFER_CHANGED") await load();
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

  function startRevising() {
    if (!offer) return;
    setForm(dealOfferForm(offer));
    setIssues({});
    setReason("");
    setReasonMissing(false);
    setNotice("");
    setRevising(true);
  }

  function saveRevision() {
    if (!offer) return;
    const found = dealOfferIssues(form);
    setIssues(found);
    if (Object.keys(found).length) return;
    if (!reason.trim()) {
      setReasonMissing(true);
      return;
    }
    void run(() => reviseDealOffer(offer.id, { ...dealOfferBody(form), revision: offer.revision, reason: reason.trim(), agreedVia }), true);
  }

  function record() {
    if (!offer) return;
    if (!note.trim()) {
      setNoteMissing(true);
      return;
    }
    void run(() => recordDealOfferConfirmation(offer.id, { revision: offer.revision, method, note: note.trim() }));
  }

  // On the contract screen only a confirmed offer is shown (an old deal has none).
  if (mode === "deal" && offer?.status !== "confirmed" && !error) return null;
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
  const termFields = (
    <>
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
    </>
  );
  const overpaid = offer ? reservationOverpaid(offer) : null;

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
          {overpaid ? (
            <Text accessibilityRole="alert" style={{ ...text, color: tokens.colors.danger }}>
              {fillTemplate(oc.revise.overpaid, overpaid)}
            </Text>
          ) : null}
          <DealOfferHistory revisions={offer.revisions ?? []} />
          {revising ? (
            <View style={{ gap: 8 }}>
              <Text style={{ ...text, fontSize: 13 }}>{oc.revise.intro}</Text>
              {termFields}
              <MobileInput
                label={oc.revise.reason}
                value={reason}
                multiline
                maxLength={500}
                editable={!off}
                onChangeText={(value) => {
                  setReason(value);
                  setReasonMissing(false);
                }}
                error={reasonMissing ? oc.revise.reasonRequired : undefined}
              />
              <Text style={text}>{oc.revise.agreedVia}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {METHODS.map((value) => (
                  <MobileButton key={value} variant={agreedVia === value ? "primary" : "outline"} disabled={off} onPress={() => setAgreedVia(value)}>
                    {oc.methods[value]}
                  </MobileButton>
                ))}
              </View>
              {!dirty ? <Text style={{ ...text, fontSize: 13 }}>{oc.revise.unchanged}</Text> : null}
              <MobileButton disabled={off || !dirty} isLoading={busy} onPress={saveRevision}>
                {oc.revise.save}
              </MobileButton>
              <MobileButton variant="outline" disabled={off} onPress={() => { show(offer); setError(""); }}>
                {oc.revise.cancel}
              </MobileButton>
            </View>
          ) : (
            <>
              <Text style={{ ...text, fontSize: 13 }}>{oc.locked}</Text>
              <MobileButton variant="outline" disabled={off} onPress={startRevising}>
                {oc.revise.open}
              </MobileButton>
              {mode === "booking" ? (
                <MobileButton variant="outline" disabled={off} onPress={() => void run(() => cancelDealOffer(offer.id, offer.revision))}>
                  {oc.cancel}
                </MobileButton>
              ) : null}
            </>
          )}
        </>
      ) : (
        <>
          <Text style={{ ...text, fontSize: 13 }}>{oc.intro}</Text>
          {termFields}
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
      {notice ? <Text style={{ ...text, color: theme.textHeading }}>{notice}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={{ ...text, color: tokens.colors.danger }}>{error}</Text> : null}
      {loading && offer ? <ActivityIndicator color={tokens.colors.brand[500]} /> : null}
    </View>
  );
}
