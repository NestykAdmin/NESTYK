import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import * as DocumentPicker from "expo-document-picker";
import {
  MobileBottomSheet,
  MobileButton,
  tokens,
  useMobileTheme,
} from "@nestyk/ui/native";
import type {
  AgreementAttachment,
  AgreementAttachmentChecklist,
  AgreementDocumentSubject,
} from "@nestyk/types";
import {
  listAgreementAttachments,
  removeAgreementAttachment,
  openAgreementAttachment,
  reuseAgreementAttachment,
  uploadAgreementAttachment,
} from "../lib/agent-contracts-api";
import { fillTemplate, localizedError, useLocale } from "@nestyk/i18n";
import { ContractDocumentPreview } from "./ContractDocumentPreview";

const EXTRA_SLOTS = [
  {
    code: "other",
    label: "other",
    hint: "otherHint",
    defaultSubject: "tenant" as AgreementDocumentSubject,
  },
] as const;

const LEASE_EXTRA_SLOTS = [
  {
    code: "lease_annex_1",
    label: "annex1",
    hint: "annex1Hint",
    defaultSubject: "property" as AgreementDocumentSubject,
  },
  {
    code: "lease_annex_2",
    label: "annex2",
    hint: "annex2Hint",
    defaultSubject: "property" as AgreementDocumentSubject,
  },
] as const;

type ExtraSlot = (typeof EXTRA_SLOTS)[number] | (typeof LEASE_EXTRA_SLOTS)[number];
type ExtraSlotCode = ExtraSlot["code"];

function extraSlotsFor(formKind?: string | null): ExtraSlot[] {
  return formKind === "lease"
    ? [...LEASE_EXTRA_SLOTS, ...EXTRA_SLOTS]
    : [...EXTRA_SLOTS];
}

function namedExtraCodes(slots: ExtraSlot[]) {
  return new Set<string>(
    slots.filter((slot) => slot.code !== "other").map((slot) => slot.code),
  );
}

type Requirement = AgreementAttachmentChecklist["requirements"][number];
type Sheet =
  | { kind: "pickType"; requirement: Requirement }
  | { kind: "extraUpload"; slot: ExtraSlotCode }
  | { kind: "reuse"; document: AgreementAttachment }
  | null;

function typeName(
  code: string,
  types: AgreementAttachmentChecklist["documentTypes"],
) {
  return types.find((t) => t.code === code)?.nameTh ?? code;
}

function currentDocForRequirement(
  requirement: Requirement,
  documents: AgreementAttachment[],
) {
  return documents.find(
    (d) =>
      d.isCurrent &&
      d.subject === requirement.subject &&
      requirement.documentTypeCodes.includes(d.documentTypeCode),
  );
}

function matchedCurrentIds(
  requirements: Requirement[],
  documents: AgreementAttachment[],
) {
  const ids = new Set<number>();
  for (const requirement of requirements) {
    const doc = currentDocForRequirement(requirement, documents);
    if (doc) ids.add(doc.id);
  }
  return ids;
}

function Chip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { theme } = useMobileTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.chip,
        {
          borderColor: selected ? "#FFBF19" : theme.border,
          backgroundColor: selected ? "#FFE29A" : theme.surface,
          opacity: pressed || disabled ? 0.65 : 1,
        },
      ]}
    >
      <Text
        style={[
          s.chipText,
          { color: selected ? "#202631" : theme.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function AgreementAttachments({
  contractId,
  refreshKey,
  formKind,
  onReadinessChange,
}: {
  contractId: number;
  refreshKey?: string;
  formKind?: string | null;
  onReadinessChange?: (value: { contractId: number; ready: boolean }) => void;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const cn = t.agent.contracts.notice;
  const tc = t.contracts;
  const ac = tc.attachments;
  const subjects = ac.subjects;
  const [state, setState] = useState<AgreementAttachmentChecklist | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [preview, setPreview] = useState<{ name: string; url: string; document: AgreementAttachment } | null>(
    null,
  );
  const [extraSubject, setExtraSubject] =
    useState<AgreementDocumentSubject>("tenant");
  const [extraType, setExtraType] = useState("national_id");
  const running = useRef(false);
  const picking = useRef(false);
  const request = useRef(0);
  const contractIdRef = useRef(contractId);
  const extraSlots = useMemo(() => extraSlotsFor(formKind), [formKind]);
  const namedExtras = useMemo(() => namedExtraCodes(extraSlots), [extraSlots]);
  useEffect(() => {
    // Keep last known readiness while reloading — do not treat busy/null as "not ready".
    onReadinessChange?.({ contractId, ready: !!state?.readyToSign });
  }, [contractId, state?.readyToSign, onReadinessChange]);
  const ink = { color: theme.textHeading };
  const muted = { color: theme.textSecondary };

  const progress = useMemo(() => {
    if (!state?.requirements.length) return null;
    const done = state.requirements.filter((r) =>
      currentDocForRequirement(r, state.documents),
    ).length;
    return { done, total: state.requirements.length };
  }, [state]);

  const extraDocs = useMemo(() => {
    if (!state) return [];
    const matched = matchedCurrentIds(state.requirements, state.documents);
    return state.documents.filter((d) => d.isCurrent && !matched.has(d.id));
  }, [state]);

  function docsForExtraSlot(code: ExtraSlotCode) {
    if (code === "other") {
      return extraDocs.filter(
        (d) => !namedExtras.has(d.documentTypeCode),
      );
    }
    return extraDocs.filter((d) => d.documentTypeCode === code);
  }

  function openExtraUpload(slot: ExtraSlotCode) {
    const meta = extraSlots.find((row) => row.code === slot)!;
    setExtraSubject(meta.defaultSubject);
    setExtraType(slot);
    setSheet({ kind: "extraUpload", slot });
  }

  async function load() {
    const n = ++request.current;
    setError("");
    setBusy(true);
    try {
      const next = await listAgreementAttachments(contractId);
      if (n === request.current) setState(next);
    } catch (e) {
      if (n === request.current)
        setError(localizedError(e, cn.loadAttachmentsFailed, locale));
    } finally {
      if (n === request.current) setBusy(false);
    }
  }

  useEffect(() => {
    const switched = contractIdRef.current !== contractId;
    contractIdRef.current = contractId;
    // Only clear checklist when switching contracts; keep prior state across refreshKey reloads.
    if (switched) setState(null);
    void load();
    return () => {
      request.current++;
    };
  }, [contractId, refreshKey]);

  async function act(action: () => Promise<void>) {
    if (running.current || busy) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(localizedError(e, cn.actionFailed, locale));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  async function pickAndUpload(input: {
    subject: AgreementDocumentSubject;
    documentTypeCode: string;
    supersedesDocumentId?: number;
  }) {
    await act(async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if (file.size && file.size > 10 * 1024 * 1024)
        throw new Error(t.common.fileTooLarge.replace("{size}", "10"));
      setState(
        await uploadAgreementAttachment(
          contractId,
          {
            subject: input.subject,
            documentTypeCode: input.documentTypeCode,
            supersedesDocumentId: input.supersedesDocumentId,
          },
          {
            uri: file.uri,
            name: file.name,
            mimeType: file.mimeType ?? "application/octet-stream",
            file: file.file,
          },
        ),
      );
    });
  }

  function queuePickAndUpload(
    input: {
      subject: AgreementDocumentSubject;
      documentTypeCode: string;
      supersedesDocumentId?: number;
    },
    afterSheet = false,
  ) {
    if (picking.current || running.current || busy) return;
    picking.current = true;
    if (afterSheet) setSheet(null);
    setTimeout(() => {
      void (async () => {
        try {
          await pickAndUpload(input);
        } finally {
          picking.current = false;
        }
      })();
    }, afterSheet ? 400 : 0);
  }

  function startUploadForRequirement(requirement: Requirement) {
    if (requirement.documentTypeCodes.length === 1) {
      queuePickAndUpload({
        subject: requirement.subject,
        documentTypeCode: requirement.documentTypeCodes[0]!,
        supersedesDocumentId: currentDocForRequirement(
          requirement,
          state?.documents ?? [],
        )?.id,
      });
      return;
    }
    setSheet({ kind: "pickType", requirement });
  }

  async function openDoc(document: AgreementAttachment) {
    await act(async () => {
      const result = await openAgreementAttachment(contractId, document.id);
      setPreview({ name: document.fileName, url: result.url, document });
    });
  }

  function renderDocActions(document: AgreementAttachment) {
    return (
      <View style={s.actions}>
        <MobileButton
          variant="outline"
          disabled={busy}
          onPress={() => {
            void openDoc(document);
          }}
        >
          {tc.common.view}
        </MobileButton>
      </View>
    );
  }

  function renderRequirement(requirement: Requirement) {
    if (!state) return null;
    const doc = currentDocForRequirement(requirement, state.documents);
    const options = requirement.documentTypeCodes
      .map((code) => typeName(code, state.documentTypes))
      .join(tc.common.or);
    const complete = !!doc;
    const statusColor = complete ? "#198460" : theme.textSecondary;

    return (
      <View
        key={requirement.groupKey}
        style={[s.requirement, { borderColor: theme.border }]}
      >
        <View style={s.requirementHead}>
          <View
            style={[
              s.statusDot,
              {
                backgroundColor: `${statusColor}18`,
                borderColor: statusColor,
              },
            ]}
          >
            <Text style={[s.statusMark, { color: statusColor }]}>
              {complete ? "✓" : "○"}
            </Text>
          </View>
          <View style={s.requirementCopy}>
            <Text style={[s.requirementTitle, ink]}>{requirement.label}</Text>
            <Text style={[s.requirementHint, muted]}>{options}</Text>
          </View>
        </View>
        {doc ? (
          <View style={[s.docBox, { backgroundColor: theme.background }]}>
            <View style={s.docHead}>
              <Text style={[s.docName, ink]} numberOfLines={2}>
                {doc.fileName}
              </Text>

            </View>
            <Text style={[s.docMeta, muted]}>
              {subjects[doc.subject]} ·{" "}
              {typeName(doc.documentTypeCode, state.documentTypes)} ·{" "}
              {new Date(doc.createdAt).toLocaleDateString("th-TH")}
            </Text>

            {renderDocActions(doc)}
          </View>
        ) : (
          <>
            <Text style={[s.requirementHint, muted]}>
              {tc.common.notAttached}
            </Text>
            {state.editable && (
              <MobileButton
                disabled={busy}
                onPress={() => startUploadForRequirement(requirement)}
              >
                {tc.common.attach}
              </MobileButton>
            )}
          </>
        )}
      </View>
    );
  }

  return (
    <View style={s.stack}>
      <View
        style={[
          s.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={s.header}>
          <Text style={[s.heading, ink]}>{ac.required}</Text>
          {progress && (
            <View style={[s.progressPill, { backgroundColor: "#FFE29A" }]}>
              <Text style={s.progressText}>
                {fillTemplate(ac.progress, { done: progress.done, total: progress.total })}
              </Text>
            </View>
          )}
        </View>

        {busy && !state && <ActivityIndicator />}
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: "#C43D4C" }}>
            {error}
          </Text>
        )}

        {!state ? (
          <MobileButton
            variant="outline"
            disabled={busy}
            onPress={() => {
              void load();
            }}
          >
            {ac.reload}
          </MobileButton>
        ) : (
          <>
            <Text style={[s.summary, muted]}>
              {!state.editable
                ? state.requirements.length
                  ? ac.locked
                  : ac.noRequired
                : state.readyToSign
                  ? ac.ready
                  : state.requirements.length
                    ? ac.attachBeforeSigning
                    : ac.notRequired}
            </Text>
            {state.requirements.length === 0 ? (
              <Text style={[s.requirementHint, muted]}>
                {ac.noRequiredItems}
              </Text>
            ) : (
              state.requirements.map(renderRequirement)
            )}
            {state.editable && state.reusableDocuments.length > 0 && (
              <View style={s.section}>
                <Text style={[s.sectionTitle, ink]}>{ac.reuseTitle}</Text>
                <Text style={[s.requirementHint, muted]}>
                  {ac.reuseHint}
                </Text>
                {state.reusableDocuments.map((document) => (
                  <View
                    key={document.id}
                    style={[s.reuseRow, { borderColor: theme.border }]}
                  >
                    <View style={s.grow}>
                      <Text style={[s.docName, ink]} numberOfLines={1}>
                        {document.fileName}
                      </Text>
                      <Text style={[s.docMeta, muted]}>
                        {subjects[document.subject]} ·{" "}
                        {typeName(document.documentTypeCode, state.documentTypes)}
                      </Text>
                    </View>
                    <MobileButton
                      variant="outline"
                      disabled={busy}
                      onPress={() => setSheet({ kind: "reuse", document })}
                    >
                      {ac.reuse}
                    </MobileButton>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>

      {!!state && (
        <View
          style={[
            s.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={s.header}>
            <Text style={[s.heading, ink]}>{ac.extra}</Text>
          </View>
          <Text style={[s.summary, muted]}>
            {!state.editable
              ? ac.locked
              : ac.extraHint}
          </Text>
          {extraSlots.map((slot) => {
            const files = docsForExtraSlot(slot.code);
            const hasFile = files.length > 0;
            const statusColor = hasFile ? "#198460" : theme.textSecondary;
            const typeAvailable =
              slot.code === "other" ||
              state.documentTypes.some((t) => t.code === slot.code);
            return (
              <View
                key={slot.code}
                style={[s.requirement, { borderColor: theme.border }]}
              >
                <View style={s.requirementHead}>
                  <View
                    style={[
                      s.statusDot,
                      {
                        backgroundColor: `${statusColor}18`,
                        borderColor: statusColor,
                      },
                    ]}
                  >
                    <Text style={[s.statusMark, { color: statusColor }]}>
                      {hasFile ? "✓" : "○"}
                    </Text>
                  </View>
                  <View style={s.requirementCopy}>
                    <Text style={[s.requirementTitle, ink]}>{ac[slot.label]}</Text>
                    <Text style={[s.requirementHint, muted]}>{ac[slot.hint]}</Text>
                  </View>
                </View>
                {files.length > 0 ? (
                  files.map((document) => (
                    <View
                      key={document.id}
                      style={[s.docBox, { backgroundColor: theme.background }]}
                    >
                      <Text style={[s.docName, ink]} numberOfLines={2}>
                        {document.fileName}
                      </Text>
                      <Text style={[s.docMeta, muted]}>
                        {subjects[document.subject]} ·{" "}
                        {typeName(document.documentTypeCode, state.documentTypes)}
                      </Text>
                      <View style={s.extraActions}>
                        <MobileButton
                          variant="outline"
                          disabled={busy}
                          onPress={() => {
                            void openDoc(document);
                          }}
                        >
                          {tc.common.view}
                        </MobileButton>
                        {state.editable && (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={fillTemplate(ac.removeFile, { name: document.fileName })}
                            disabled={busy}
                            style={({ pressed }) => [
                              s.removeFileButton,
                              { opacity: busy || pressed ? 0.5 : 1 },
                            ]}
                            onPress={() => {
                              void act(async () => {
                                setState(
                                  await removeAgreementAttachment(
                                    contractId,
                                    document.id,
                                  ),
                                );
                              });
                            }}
                          >
                            <Svg width={18} height={18} viewBox="0 0 24 24">
                              <Path
                                d="M6 6L18 18M18 6L6 18"
                                stroke={theme.textSecondary}
                                strokeWidth={2}
                                strokeLinecap="round"
                              />
                            </Svg>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={[s.requirementHint, muted]}>
                    {ac.notAttachedShort}
                  </Text>
                )}
                {state.editable && typeAvailable && (
                  <MobileButton
                    variant="outline"
                    disabled={busy}
                    onPress={() => openExtraUpload(slot.code)}
                  >
                    {tc.common.attach}
                  </MobileButton>
                )}
              </View>
            );
          })}
        </View>
      )}

      <MobileBottomSheet
        visible={sheet?.kind === "pickType"}
        onClose={() => setSheet(null)}
      >
        <View style={s.sheet}>
          <Text style={[s.sheetTitle, ink]}>{ac.pickType}</Text>
          <Text style={[s.requirementHint, muted]}>
            {sheet?.kind === "pickType" ? sheet.requirement.label : ""}
          </Text>
          {sheet?.kind === "pickType" &&
            sheet.requirement.documentTypeCodes.map((code) => (
              <MobileButton
                key={code}
                disabled={busy}
                onPress={() => {
                  queuePickAndUpload(
                    {
                      subject: sheet.requirement.subject,
                      documentTypeCode: code,
                      supersedesDocumentId: currentDocForRequirement(
                        sheet.requirement,
                        state?.documents ?? [],
                      )?.id,
                    },
                    true,
                  );
                }}
              >
                {typeName(code, state?.documentTypes ?? [])}
              </MobileButton>
            ))}
          <MobileButton variant="outline" onPress={() => setSheet(null)}>
            {tc.common.cancel}
          </MobileButton>
        </View>
      </MobileBottomSheet>

      <MobileBottomSheet
        visible={sheet?.kind === "extraUpload"}
        onClose={() => setSheet(null)}
      >
        <ScrollView style={s.sheet} contentContainerStyle={{ gap: 12 }}>
          <Text style={[s.sheetTitle, ink]}>
            {(() => {
              const slot =
                sheet?.kind === "extraUpload"
                  ? extraSlots.find((row) => row.code === sheet.slot)
                  : undefined;
              return slot ? ac[slot.label] : ac.attachMore;
            })()}
          </Text>
          <Text style={[s.requirementHint, muted]}>{ac.ownerOf}</Text>
          <View style={s.chips}>
            {(Object.keys(subjects) as AgreementDocumentSubject[]).map(
              (value) => (
                <Chip
                  key={value}
                  label={subjects[value]}
                  selected={extraSubject === value}
                  onPress={() => setExtraSubject(value)}
                />
              ),
            )}
          </View>
          {sheet?.kind === "extraUpload" && sheet.slot === "other" ? (
            <>
              <Text style={[s.requirementHint, muted]}>{ac.documentType}</Text>
              <View style={s.chips}>
                {(state?.documentTypes ?? [])
                  .filter(
                    (t) =>
                      t.code === "other" ||
                      (!namedExtras.has(t.code) &&
                        t.code !== "ownership_proof"),
                  )
                  .map((t) => (
                    <Chip
                      key={t.code}
                      label={t.nameTh}
                      selected={extraType === t.code}
                      onPress={() => setExtraType(t.code)}
                    />
                  ))}
              </View>
            </>
          ) : (
            <Text style={[s.requirementHint, muted]}>
              {ac.typeLabel}{" "}
              {typeName(
                sheet?.kind === "extraUpload" ? sheet.slot : extraType,
                state?.documentTypes ?? [],
              )}
            </Text>
          )}
          <Text style={[s.requirementHint, muted]}>
            {ac.fileRule}
          </Text>
          <MobileButton
            disabled={busy}
            onPress={() => {
              const slot =
                sheet?.kind === "extraUpload" ? sheet.slot : "other";
              queuePickAndUpload(
                {
                  subject: extraSubject,
                  documentTypeCode:
                    slot === "other" ? extraType || "other" : slot,
                },
                true,
              );
            }}
          >
            {ac.pickAndAttach}
          </MobileButton>
          <MobileButton variant="outline" onPress={() => setSheet(null)}>
            {tc.common.cancel}
          </MobileButton>
        </ScrollView>
      </MobileBottomSheet>

      <MobileBottomSheet
        visible={sheet?.kind === "reuse"}
        onClose={() => setSheet(null)}
      >
        <View style={s.sheet}>
          <Text style={[s.sheetTitle, ink]}>
            {ac.reuseSheetTitle}
          </Text>
          {sheet?.kind === "reuse" && (
            <Text style={[s.requirementHint, muted]}>
              {sheet.document.fileName}
            </Text>
          )}
          <Text style={[s.requirementHint, muted]}>
            {ac.reuseConfirmHint}
          </Text>
          <MobileButton
            disabled={busy}
            onPress={() => {
              if (sheet?.kind !== "reuse") return;
              void act(async () => {
                setState(
                  await reuseAgreementAttachment(
                    contractId,
                    sheet.document.id,
                  ),
                );
                setSheet(null);
              });
            }}
          >
            {ac.confirmReuse}
          </MobileButton>
          <MobileButton variant="outline" onPress={() => setSheet(null)}>
            {tc.common.cancel}
          </MobileButton>
        </View>
      </MobileBottomSheet>

      <Modal
        visible={!!preview}
        onRequestClose={() => setPreview(null)}
        animationType="slide"
      >
        <View style={[s.modal, { backgroundColor: theme.surface }]}>
          <Text style={[s.heading, ink]}>{preview?.name}</Text>
          <MobileButton variant="outline" onPress={() => setPreview(null)}>
            {tc.common.closeDocument}
          </MobileButton>
          {preview && <ContractDocumentPreview url={preview.url} />}
          {preview && state?.editable && preview.document.isCurrent && (
            <MobileButton
              disabled={busy}
              onPress={() => {
                const document = preview.document;
                setPreview(null);
                setTimeout(() => {
                  const requirement = state.requirements.find((item) =>
                    currentDocForRequirement(item, state.documents)?.id === document.id,
                  );
                  if (requirement) startUploadForRequirement(requirement);
                  else queuePickAndUpload({
                    subject: document.subject,
                    documentTypeCode: document.documentTypeCode,
                    supersedesDocumentId: document.id,
                  });
                }, 400);
              }}
            >
              {tc.common.reupload}
            </MobileButton>
          )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  stack: { gap: 12 },
  card: { padding: 16, gap: 14, borderWidth: 1, borderRadius: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  heading: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "600",
  },
  progressPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  progressText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: "#202631",
    fontWeight: "600",
  },
  summary: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
  },
  section: { gap: 10 },
  sectionTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "600",
  },
  requirement: {
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 14,
  },
  requirementHead: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  statusDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusMark: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  requirementCopy: { flex: 1, gap: 2, minWidth: 0 },
  requirementTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "600",
  },
  requirementHint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
  },
  extraFileRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingLeft: 12,
    paddingRight: 4,
    gap: 8,
    borderRadius: 12,
  },
  extraFileName: {
    flex: 1,
    minWidth: 0,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
  },
  extraActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 4,
  },
  removeFileButton: {
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  docBox: { gap: 8, padding: 12, borderRadius: 12 },
  docHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  docName: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  docMeta: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
  },
  badge: {
    fontFamily: tokens.typography.native.body,
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    overflow: "hidden",
  },
  actions: { gap: 8 },
  reuseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
  },
  sheet: { padding: 20, gap: 12 },
  sheetTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "600",
  },
  modal: { flex: 1, padding: 20, paddingTop: 50, gap: 12 },
});
