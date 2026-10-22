import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { MobileBottomSheet, MobileButton, MobileInput, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { HandoverRecord, HandoverSignParty } from "@nestyk/types";
import { fillTemplate, localizedError, useLocale } from "@nestyk/i18n";
import { localeTag } from "../lib/lead-format";
import {
  HANDOVER_CONDITIONS,
  HANDOVER_MAX_PHOTOS,
  HANDOVER_SIGN_PARTIES,
  emptyHandoverItem,
  handoverBody,
  handoverDraft,
  handoverEditable,
  handoverFormIssues,
  handoverFormValid,
  handoverSignBlocker,
  handoverSignedAt,
  type HandoverDraft,
  type HandoverFormIssues,
} from "../lib/handover";
import { getHandover, removeHandoverPhoto, saveHandover, signHandoverOnSite, uploadHandoverPhoto } from "../lib/agent-contracts-api";
import { getMyHandover, signMyHandover } from "../lib/party-contracts-api";
import { ContractSignaturePad, type ContractSignaturePadHandle } from "./ContractSignaturePad";

type Mode = "agent" | "party";

/**
 * D6 (AC-6.1 to 6.4): what the handover record shows. The agent sees edit, photo and on-site sign buttons; a party
 * (landlord or tenant) sees a sign button for their own side. Kept free of loading so a test can render each state.
 */
export function HandoverSummary({
  record,
  mode,
  busy,
  onEdit,
  onAddPhoto,
  onRemovePhoto,
  onSign,
}: {
  record: HandoverRecord;
  mode: Mode;
  busy: boolean;
  onEdit?: () => void;
  onAddPhoto?: () => void;
  onRemovePhoto?: (photoId: number) => void;
  onSign?: (party: HandoverSignParty) => void;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const hc = t.contracts.handover;
  const parties = t.contracts.common.parties;
  const text = { color: theme.textSecondary, fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 22 };
  const heading = { color: theme.textHeading, fontFamily: tokens.typography.native.headingTh, fontSize: 16, lineHeight: 24 };
  const badge = {
    blocked: { color: "#6B7280", background: "#F3F4F6" },
    not_started: { color: "#B45309", background: "#FFFBEB" },
    in_progress: { color: "#1D4ED8", background: "#EFF6FF" },
    completed: { color: "#15803D", background: "#F0FDF4" },
  }[record.status];
  const date = (value: string) =>
    new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString(localeTag(locale), { day: "numeric", month: "short", year: "numeric" });
  const editable = mode === "agent" && handoverEditable(record);
  const mine = mode === "agent" ? HANDOVER_SIGN_PARTIES : record.myParties ?? [];
  const started = record.id != null;
  return (
    <View style={{ backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <Text style={{ ...heading, fontSize: 18, lineHeight: 27 }}>{hc.title}</Text>
        <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: badge.background }}>
          <Text accessibilityLabel={fillTemplate(hc.statusA11y, { status: hc.status[record.status] })} style={{ ...text, color: badge.color, fontSize: 13 }}>
            {hc.status[record.status]}
          </Text>
        </View>
      </View>
      <Text style={text}>{hc.subtitle}</Text>
      {record.blockedReason ? <Text style={text}>{hc.blocked[record.blockedReason]}</Text> : null}
      {!started && !record.blockedReason ? <Text style={text}>{mode === "agent" ? hc.notStarted : hc.partyNotStarted}</Text> : null}
      {started ? (
        <>
          <Text style={text}>{record.handoverDate ? fillTemplate(hc.date, { date: date(record.handoverDate) }) : hc.noDate}</Text>
          {record.note ? <Text style={text}>{fillTemplate(hc.note, { note: record.note })}</Text> : null}
          <Text style={heading}>{hc.annex1}</Text>
          {record.items.length ? (
            record.items.map((item) => (
              <View key={item.id}>
                <Text style={text}>
                  {fillTemplate(hc.item, { name: item.name, quantity: String(item.quantity), condition: hc.condition[item.condition] })}
                </Text>
                {item.note ? <Text style={{ ...text, fontSize: 13 }}>{fillTemplate(hc.note, { note: item.note })}</Text> : null}
              </View>
            ))
          ) : (
            <Text style={text}>{hc.noItems}</Text>
          )}
          <Text style={heading}>{fillTemplate(hc.annex2, { count: String(record.photos.length), max: String(HANDOVER_MAX_PHOTOS) })}</Text>
          {record.photos.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {record.photos.map((photo, index) => (
                <View key={photo.id} style={{ gap: 4 }}>
                  {photo.url ? (
                    <Image
                      accessibilityLabel={fillTemplate(hc.photoA11y, { index: String(index + 1) })}
                      source={{ uri: photo.url }}
                      style={{ width: 88, height: 88, borderRadius: 8, backgroundColor: theme.border }}
                    />
                  ) : null}
                  {editable && onRemovePhoto ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={fillTemplate(hc.removePhoto, { index: String(index + 1) })}
                      disabled={busy}
                      onPress={() => onRemovePhoto(photo.id)}
                    >
                      <Text style={{ ...text, fontSize: 13, color: tokens.colors.danger }}>{fillTemplate(hc.removePhoto, { index: String(index + 1) })}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={text}>{hc.noPhotos}</Text>
          )}
        </>
      ) : null}
      {editable && onEdit ? (
        <MobileButton variant={started ? "outline" : "primary"} disabled={busy} onPress={onEdit}>
          {started ? hc.edit : hc.fill}
        </MobileButton>
      ) : null}
      {editable && onAddPhoto ? (
        record.photos.length >= HANDOVER_MAX_PHOTOS ? (
          <Text style={text}>{fillTemplate(hc.photoLimit, { max: String(HANDOVER_MAX_PHOTOS) })}</Text>
        ) : (
          <MobileButton variant="outline" disabled={busy} isLoading={busy} onPress={onAddPhoto}>
            {hc.addPhoto}
          </MobileButton>
        )
      ) : null}
      {editable && record.signatures.length ? <Text style={{ ...text, fontSize: 13 }}>{hc.editVoidsSignatures}</Text> : null}
      {started ? (
        <>
          <Text style={heading}>{hc.signatures}</Text>
          {HANDOVER_SIGN_PARTIES.map((party) => {
            const signed = handoverSignedAt(record, party);
            const blocker = handoverSignBlocker(record, party);
            return (
              <View key={party} style={{ gap: 6 }}>
                <Text style={text}>
                  {parties[party]}:{" "}
                  {signed
                    ? fillTemplate(signed.channel === "on_site" ? hc.signedOnSite : hc.signed, { date: date(signed.signedAt) })
                    : hc.unsigned}
                </Text>
                {!signed && mine.includes(party) && onSign && record.status === "in_progress" ? (
                  blocker === "needs_photo" || blocker === "needs_date" ? (
                    <Text style={{ ...text, fontSize: 13 }}>{blocker === "needs_photo" ? hc.needsPhoto : hc.needsDate}</Text>
                  ) : (
                    <MobileButton disabled={busy || blocker != null} onPress={() => onSign(party)}>
                      {fillTemplate(mode === "agent" ? hc.signOnSite : hc.signMine, { party: parties[party] })}
                    </MobileButton>
                  )
                ) : null}
              </View>
            );
          })}
        </>
      ) : null}
      {record.status === "completed" ? <Text style={text}>{hc.completed}</Text> : null}
    </View>
  );
}

/** D6: loads the handover record of a lease and runs the agent's or the party's actions on it. */
export function HandoverCard({
  contractId,
  mode,
  refreshKey,
  defaultDate,
}: {
  contractId: number;
  mode: Mode;
  /** Changes when the lease or its deposit changes, so a handover that just opened shows up. */
  refreshKey?: string;
  /** The date the form starts with before anything is saved (the lease start date). */
  defaultDate?: string;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const hc = t.contracts.handover;
  const tc = t.contracts;
  const [record, setRecord] = useState<HandoverRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<HandoverDraft | null>(null);
  const [issues, setIssues] = useState<HandoverFormIssues>({ items: {} });
  const [signing, setSigning] = useState<HandoverSignParty | null>(null);
  const [padKey, setPadKey] = useState(0);
  const padRef = useRef<ContractSignaturePadHandle>(null);
  const text = { color: theme.textSecondary, fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 22 };

  /** clearError: a load started by the screen (not after a refused action) clears an old load error. */
  const load = useCallback(async (clearError = false) => {
    setLoading(true);
    try {
      setRecord(mode === "agent" ? await getHandover(contractId) : await getMyHandover(contractId));
      if (clearError) setError("");
    } catch (e) {
      setError(localizedError(e, hc.loadFailed, locale));
    } finally {
      setLoading(false);
    }
  }, [contractId, mode, hc.loadFailed, locale]);

  useEffect(() => {
    void load(true);
  }, [load, refreshKey]);

  useEffect(() => {
    if (!signing) return;
    const timer = setTimeout(() => padRef.current?.reinitialize?.(), 320);
    return () => clearTimeout(timer);
  }, [signing, padKey]);

  /** Runs an action; on any error the record is read again, so a stale revision is replaced. */
  async function run(action: () => Promise<HandoverRecord>, fallback: string, done?: string) {
    if (busy) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setRecord(await action());
      if (done) setNotice(done);
      return true;
    } catch (e) {
      setError(localizedError(e, fallback, locale));
      await load();
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!draft || !record) return;
    const found = handoverFormIssues(draft);
    setIssues(found);
    if (!handoverFormValid(found)) return;
    if (await run(() => saveHandover(contractId, handoverBody(draft, record.revision)), hc.saveFailed, hc.saved)) setDraft(null);
  }

  async function addPhoto() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error(hc.photoPermission);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        quality: 0.8,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) throw new Error(hc.photoTooLarge);
      const file = { uri: asset.uri, name: asset.fileName || "room.jpg", mimeType: asset.mimeType || "image/jpeg", file: asset.file };
      await run(() => uploadHandoverPhoto(contractId, file), hc.photoFailed);
    } catch (e) {
      setError(localizedError(e, hc.photoFailed, locale));
    }
  }

  async function submit(image: string) {
    if (!signing || !record) return;
    const body = { party: signing, signaturePng: image, revision: record.revision };
    await run(
      () => (mode === "agent" ? signHandoverOnSite(contractId, body) : signMyHandover(contractId, body)),
      hc.signFailed,
      hc.signedNotice,
    );
    // Closed either way: after a refusal the record is read again, and the signer reviews it before signing
    // (a 409 means the content changed since they opened the sheet).
    setSigning(null);
  }

  if (loading && !record) return <ActivityIndicator color={tokens.colors.brand[500]} />;
  if (!record) return error ? <Text accessibilityRole="alert" style={{ ...text, color: tokens.colors.danger }}>{error}</Text> : null;
  const setItem = (index: number, patch: Partial<HandoverDraft["items"][number]>) =>
    setDraft((current) => current && { ...current, items: current.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  const formErrors = tc.handover.form.errors;
  return (
    <View style={{ gap: 8 }}>
      <HandoverSummary
        record={record}
        mode={mode}
        busy={busy}
        onEdit={mode === "agent" ? () => { setIssues({ items: {} }); setDraft(handoverDraft(record.id ? record : null, defaultDate)); } : undefined}
        onAddPhoto={mode === "agent" ? () => void addPhoto() : undefined}
        onRemovePhoto={mode === "agent" ? (photoId) => void run(() => removeHandoverPhoto(contractId, photoId), hc.saveFailed) : undefined}
        onSign={(party) => { setError(""); setPadKey((key) => key + 1); setSigning(party); }}
      />
      {error ? <Text accessibilityRole="alert" style={{ ...text, color: tokens.colors.danger }}>{error}</Text> : null}
      {notice ? <Text style={text}>{notice}</Text> : null}

      <MobileBottomSheet visible={draft != null} onClose={() => !busy && setDraft(null)} maxHeight="94%" avoidKeyboard>
        {draft ? (
          <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }} keyboardShouldPersistTaps="handled">
            <Text style={{ ...text, color: theme.textHeading, fontSize: 18 }}>{hc.form.title}</Text>
            <MobileInput
              label={hc.form.date}
              value={draft.handoverDate}
              onChangeText={(handoverDate) => setDraft({ ...draft, handoverDate })}
              error={issues.handoverDate ? formErrors.date : undefined}
              placeholder="2026-11-01"
            />
            <Text style={{ ...text, color: theme.textHeading }}>{hc.form.items}</Text>
            {draft.items.map((item, index) => {
              const row = issues.items[index] ?? {};
              return (
                <View key={index} style={{ gap: 8, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12 }}>
                  <Text style={text}>{fillTemplate(hc.form.itemNo, { index: String(index + 1) })}</Text>
                  <MobileInput
                    label={hc.form.itemName}
                    value={item.name}
                    maxLength={120}
                    onChangeText={(name) => setItem(index, { name })}
                    error={row.name ? formErrors.name : undefined}
                  />
                  <MobileInput
                    label={hc.form.quantity}
                    value={item.quantity}
                    keyboardType="number-pad"
                    maxLength={3}
                    onChangeText={(quantity) => setItem(index, { quantity })}
                    error={row.quantity ? formErrors.quantity : undefined}
                  />
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {HANDOVER_CONDITIONS.map((condition) => (
                      <MobileButton
                        key={condition}
                        variant={item.condition === condition ? "primary" : "outline"}
                        onPress={() => setItem(index, { condition })}
                      >
                        {hc.condition[condition]}
                      </MobileButton>
                    ))}
                  </View>
                  <MobileInput
                    label={hc.form.itemNote}
                    value={item.note}
                    maxLength={500}
                    onChangeText={(note) => setItem(index, { note })}
                    error={row.note ? formErrors.itemNote : undefined}
                  />
                  <MobileButton
                    variant="outline"
                    onPress={() => setDraft({ ...draft, items: draft.items.filter((_, i) => i !== index) })}
                  >
                    {hc.form.removeItem}
                  </MobileButton>
                </View>
              );
            })}
            {issues.tooManyItems ? <Text style={{ ...text, color: tokens.colors.danger }}>{formErrors.tooMany}</Text> : null}
            <MobileButton variant="outline" onPress={() => setDraft({ ...draft, items: [...draft.items, emptyHandoverItem()] })}>
              {hc.form.addItem}
            </MobileButton>
            <MobileInput
              label={hc.form.note}
              value={draft.note}
              multiline
              maxLength={1000}
              onChangeText={(note) => setDraft({ ...draft, note })}
              error={issues.note ? formErrors.note : undefined}
            />
            {record.signatures.length ? <Text style={{ ...text, fontSize: 13 }}>{hc.editVoidsSignatures}</Text> : null}
            {error ? <Text accessibilityRole="alert" style={{ ...text, color: tokens.colors.danger }}>{error}</Text> : null}
            <MobileButton disabled={busy} isLoading={busy} onPress={() => void save()}>
              {hc.form.save}
            </MobileButton>
            <MobileButton variant="outline" disabled={busy} onPress={() => setDraft(null)}>
              {tc.common.cancel}
            </MobileButton>
          </ScrollView>
        ) : null}
      </MobileBottomSheet>

      <MobileBottomSheet visible={signing != null} onClose={() => !busy && setSigning(null)} maxHeight="90%">
        {signing ? (
          <View style={{ gap: 12, padding: 16 }}>
            <Text style={{ ...text, color: theme.textHeading, fontSize: 18 }}>
              {fillTemplate(hc.signTitle, { party: tc.common.parties[signing] })}
            </Text>
            <Text style={text}>{hc.signHint}</Text>
            <Text style={text}>{tc.common.drawSignature}</Text>
            {error ? <Text accessibilityRole="alert" style={{ ...text, color: tokens.colors.danger }}>{error}</Text> : null}
            <ContractSignaturePad
              key={`${padKey}-${signing}`}
              ref={padRef}
              onOK={(image) => void submit(image)}
              onEmpty={() => setError(tc.common.drawSignatureFirst)}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <MobileButton variant="outline" style={{ flex: 1 }} disabled={busy} onPress={() => padRef.current?.clearSignature()}>
                {tc.common.clearSignature}
              </MobileButton>
              <MobileButton style={{ flex: 1 }} disabled={busy} isLoading={busy} onPress={() => { if (!busy) padRef.current?.readSignature(); }}>
                {tc.common.confirmSignature}
              </MobileButton>
            </View>
          </View>
        ) : null}
      </MobileBottomSheet>
    </View>
  );
}
