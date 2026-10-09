import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, SlideInRight } from "react-native-reanimated";
import {
  MobileBottomSheet,
  MobileBrandLoader,
  MobileButton,
  MobileIcon,
  MobileInput,
  MobileSegmentedTabs,
  tokens,
  useMobileTheme,
} from "@nestyk/ui/native";
import type { AgentContract, AgentTenant, AgentTenantBill, AgentTenantBilling, TenantBill } from "@nestyk/types";
import { localizedError, useLocale } from "@nestyk/i18n";
import { getAgentTenant, listAgentTenants, updateAgentTenant } from "../lib/agent-tenants-api";
import { nextIdentityNumberDraft } from "../lib/identity-number";
import { billFormatters } from "../lib/bill-format";
import { confirmAgentRentSlip, listAgentRentSlips, openAgentRentSlip } from "../lib/tenant-bills-api";
import { TENANT_BILLING_DEMO, demoTenantBilling } from "../lib/tenant-billing-demo";
import {
  confirmBill,
  tenantLease,
  tenantNextAction,
  tenantSlips,
  withLiveSlips,
  type TenantNextAction,
  type TenantSection,
} from "../lib/tenant-detail";
import { tenantWorkItems, type TenantWorkItem, type TenantWorkKind } from "../lib/tenant-work";
import { TenantForm } from "./TenantForm";
import { ContractsScreen } from "./ContractsScreen";
import { ContractDocumentPreview } from "./ContractDocumentPreview";
import type { CreateDocumentKind } from "./ContractTypePicker";
import { TenantDetailHub } from "./TenantDetailHub";
import { TenantBillsBody } from "./TenantBillsBody";
import { TenantPaymentsBody } from "./TenantPaymentsBody";
import { TenantRoomBody } from "./TenantRoomBody";
import { TenantAttachmentsBody } from "./TenantAttachmentsBody";
import { TenantWorkBody } from "./TenantWorkBody";
import { TenantDirectoryBody, type TenantDirectoryFilter } from "./TenantDirectoryBody";
import { DetailCard, DetailField } from "./TenantDetailParts";

export type TenantListView = "work" | "all";
type WorkFilter = "overdue_payment" | "awaiting_signature" | "renewal" | "lead_follow_up";
const WORK_FILTER_KIND: Partial<Record<WorkFilter, TenantWorkKind>> = {
  overdue_payment: "overdue",
  awaiting_signature: "signing",
  renewal: "renewal",
};

/** Detail/edit state the shell needs for its header, bottom bar and hardware back. */
export type TenantDetailState = {
  open: boolean;
  /** Section page open inside the detail; null is the hub. */
  section: TenantSection | null;
  title: string;
  /** "name · room" under a section title; empty on the hub. */
  subtitle: string;
  editing: boolean;
  canEdit: boolean;
  saving: boolean;
  error: string;
};
export const TENANT_DETAIL_CLOSED: TenantDetailState = {
  open: false,
  section: null,
  title: "",
  subtitle: "",
  editing: false,
  canEdit: false,
  saving: false,
  error: "",
};
export type TenantDetailActions = {
  /** Cancels an edit first, then leaves a section for the hub, otherwise closes the detail. */
  back: () => void;
  edit: () => void;
  save: () => void;
};
/** A tenant whose page opens as soon as the screen mounts, e.g. from a lead that booked a room. */
export type TenantEntry = {
  tenantId: number;
  /** Already at hand (just booked); otherwise the tenant is read by id. */
  tenant?: AgentTenant;
  /** Go straight into creating this document for the tenant. */
  startContract?: CreateDocumentKind | null;
};

export function AgentTenantsScreen({
  workFilter = null,
  reloadToken = 0,
  onReloadSettled,
  creating: creatingProp,
  onCreatingChange,
  onCreateBusy,
  createBackRef,
  createdTenant = null,
  onTenantCreated,
  entry = null,
  onEntryBack,
  detailActionsRef,
  onDetailStateChange,
  onWorkFilterHandled,
  onListViewChange,
}: {
  /** Controlled by the shell so its header/back/tab bar switch to the create-tenant layout. */
  creating?: boolean;
  onCreatingChange?: (creating: boolean) => void;
  onCreateBusy?: (busy: boolean) => void;
  createBackRef?: React.MutableRefObject<(() => boolean) | null>;
  /** The shell remounts this screen when the form closes; reopen the tenant just created. */
  createdTenant?: AgentTenant | null;
  onTenantCreated?: (tenant: AgentTenant) => void;
  /** Read on mount: open this tenant's page instead of the list. */
  entry?: TenantEntry | null;
  /** Back from the `entry` tenant's page: return to where the shell came from, not to the list. */
  onEntryBack?: () => void;
  detailActionsRef?: React.MutableRefObject<TenantDetailActions | null>;
  onDetailStateChange?: (state: TenantDetailState) => void;
  /** A dashboard shortcut: opens the to-do tab on that kind of work. */
  workFilter?: WorkFilter | null;
  /** The shortcut was applied; the shell can drop it. */
  onWorkFilterHandled?: () => void;
  /** List tab shown, for the shell's header subtitle. */
  onListViewChange?: (view: TenantListView) => void;
  reloadToken?: number;
  onReloadSettled?: (token: number) => void;
} = {}) {
  const { t, locale } = useLocale();
  const c = t.agent.tenants;
  const d = c.detail;
  const { theme } = useMobileTheme();
  const [items, setItems] = useState<AgentTenant[]>([]);
  const [selected, setSelected] = useState<AgentTenant | null>(
    entry?.tenant ?? createdTenant,
  );
  const [creatingLocal, setCreatingLocal] = useState(false);
  const creating = creatingProp ?? creatingLocal;
  const setCreating = onCreatingChange ?? setCreatingLocal;
  const [section, setSection] = useState<TenantSection | null>(
    entry?.startContract ? "contracts" : null,
  );
  /** Document the contracts section starts creating when it opens (the reservation letter after a booking). */
  const [contractStart, setContractStart] = useState<CreateDocumentKind | null>(
    entry?.startContract ?? null,
  );
  /** Contract the contracts section opens on, when reached from a work item. */
  const [contractFocus, setContractFocus] = useState<AgentContract | null>(null);
  /** Rent slips waiting for this agent's review, across all tenants (`GET /bills/agent`). */
  const [slips, setSlips] = useState<TenantBill[]>([]);
  const [billing, setBilling] = useState<AgentTenantBilling | null>(null);
  const [paymentNotice, setPaymentNotice] = useState("");
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [slipPreview, setSlipPreview] = useState<{ url: string; title: string } | null>(null);
  useEffect(() => {
    if (!selected) {
      setBilling(null);
      return;
    }
    setBilling(
      withLiveSlips(TENANT_BILLING_DEMO ? demoTenantBilling(selected) : null, tenantSlips(selected, slips)),
    );
  }, [selected, slips]);
  useEffect(() => setPaymentNotice(""), [section, selected?.id]);
  /** Null until the agent picks a tab: then it follows whether there is open work. */
  const [view, setView] = useState<TenantListView | null>(null);
  const [workKind, setWorkKind] = useState<TenantWorkKind | null>(null);
  const [workQuery, setWorkQuery] = useState("");
  const [directoryFilter, setDirectoryFilter] = useState<TenantDirectoryFilter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [gateOpen, setGateOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    createdTenant && !entry ? c.createdNotice : "",
  );
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    identityNumber: "",
    nationality: "",
    note: "",
  });
  useEffect(() => {
    if (!workFilter) return;
    setView("work");
    setWorkKind(WORK_FILTER_KIND[workFilter] ?? null);
    onWorkFilterHandled?.();
  }, [workFilter, onWorkFilterHandled]);
  const workItems = useMemo(() => tenantWorkItems(items, slips), [items, slips]);
  const listView: TenantListView = view ?? (workItems.length ? "work" : "all");
  useEffect(() => {
    onListViewChange?.(listView);
  }, [listView, onListViewChange]);
  const refreshVersion = useRef(0);
  const panel = { backgroundColor: theme.surface, borderColor: theme.border };
  const title = { color: theme.textHeading };
  const muted = { color: theme.textSecondary };

  useEffect(() => {
    if (loading && !items.length) setGateOpen(false);
  }, [loading, items.length]);

  async function reload() {
    const version = ++refreshVersion.current;
    setLoading(true);
    setError("");
    try {
      const [data, waiting] = await Promise.all([
        listAgentTenants(),
        listAgentRentSlips().catch(() => null),
      ]);
      if (version !== refreshVersion.current) return;
      setItems(data);
      setSlips(waiting ?? []);
      if (!waiting) setError(c.list.slipsLoadError);
    } catch (e) {
      if (version === refreshVersion.current)
        setError(localizedError(e, c.list.loadError, locale));
    } finally {
      if (version === refreshVersion.current) setLoading(false);
    }
  }
  useEffect(() => {
    let cancelled = false;
    void reload().finally(() => {
      if (!cancelled) onReloadSettled?.(reloadToken);
    });
    return () => {
      cancelled = true;
      refreshVersion.current++;
    };
  }, [reloadToken]);
  // A tenant the shell asks for by id opens the same way as a tap on its row.
  useEffect(() => {
    if (entry && !entry.tenant) void open(entry.tenantId);
    // Read once: the shell mounts this screen for the entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function open(id: number, at: TenantSection | null = null) {
    if (opening) return;
    setOpening(true);
    setError("");
    setNotice("");
    setEditing(false);
    try {
      setSelected(await getAgentTenant(id));
      setSection(at);
    } catch (e) {
      setError(localizedError(e, c.list.openError, locale));
    } finally {
      setOpening(false);
    }
  }
  async function refreshTenant(id: number) {
    try {
      const latest = await getAgentTenant(id);
      setSelected((current) => (current?.id === id ? latest : current));
      setItems((current) => current.map((t) => (t.id === id ? latest : t)));
    } catch {
      setError(c.list.contractReloadFailed);
    }
  }
  function beginEdit(tenant: AgentTenant) {
    setEditForm({
      firstName: tenant.firstName || tenant.name.trim().split(/\s+/)[0] || "",
      lastName: tenant.lastName || tenant.name.trim().split(/\s+/).slice(1).join(" "),
      phone: tenant.phone,
      email: tenant.email || "",
      identityNumber: tenant.identityNumber || "",
      nationality: tenant.nationality || "",
      note: tenant.note || "",
    });
    setEditing(true);
    setError("");
    setNotice("");
  }
  async function saveEdit() {
    if (!selected || savingEdit) return;
    if (!editForm.firstName.trim() || !editForm.phone.trim()) {
      setError(d.requiredNamePhone);
      return;
    }
    setSavingEdit(true);
    setError("");
    try {
      const latest = await updateAgentTenant(selected.id, {
        name: [editForm.firstName.trim(), editForm.lastName.trim()].filter(Boolean).join(" "),
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
        identityNumber: editForm.identityNumber.trim(),
        nationality: editForm.nationality.trim(),
        note: editForm.note.trim(),
      });
      setSelected(latest);
      setItems((current) =>
        current.map((t) => (t.id === latest.id ? latest : t)),
      );
      setEditing(false);
      setNotice(d.saved);
    } catch (e) {
      setError(localizedError(e, c.list.saveFailed, locale));
    } finally {
      setSavingEdit(false);
    }
  }
  const detailOpen = !creating && !!selected;
  const sectionTitle: Record<TenantSection, string> = {
    profile: d.sectionProfile,
    room: d.sectionRoom,
    contracts: d.sectionContracts,
    bills: d.sectionBills,
    payments: d.sectionPayments,
    attachments: d.sectionAttachments,
  };
  const detailTitle = section ? sectionTitle[section] : d.title;
  const detailSubtitle =
    section && selected
      ? selected.room
        ? d.subtitle.replace("{name}", selected.name).replace("{room}", selected.room)
        : selected.name
      : "";
  useEffect(() => {
    onDetailStateChange?.(
      detailOpen
        ? {
            open: true,
            section,
            title: detailTitle,
            subtitle: detailSubtitle,
            editing,
            canEdit: (section === null || section === "profile") && !editing,
            saving: savingEdit,
            error: editing ? error : "",
          }
        : TENANT_DETAIL_CLOSED,
    );
  }, [detailOpen, section, detailTitle, detailSubtitle, editing, savingEdit, error, onDetailStateChange]);
  useEffect(
    () => () => onDetailStateChange?.(TENANT_DETAIL_CLOSED),
    [onDetailStateChange],
  );
  useEffect(() => {
    if (!detailActionsRef) return;
    detailActionsRef.current = {
      back: () => {
        if (savingEdit) return;
        setError("");
        if (editing) {
          setEditing(false);
          return;
        }
        if (section) {
          setSection(null);
          setContractStart(null);
          setContractFocus(null);
          return;
        }
        if (onEntryBack && entry && selected?.id === entry.tenantId) {
          onEntryBack();
          return;
        }
        setSelected(null);
        setNotice("");
      },
      edit: () => {
        if (!selected) return;
        setSection("profile");
        beginEdit(selected);
      },
      save: () => {
        void saveEdit();
      },
    };
  });
  useEffect(
    () => () => {
      if (detailActionsRef) detailActionsRef.current = null;
    },
    [detailActionsRef],
  );
  if (!gateOpen && !creating && !selected) {
    return (
      <MobileBrandLoader
        fill
        size="md"
        done={!loading && !opening}
        onComplete={() => setGateOpen(true)}
      />
    );
  }
  if (creating)
    return (
      <TenantForm
        onBusy={onCreateBusy}
        backRef={createBackRef}
        onCreated={(tenant) => {
          setItems((current) => [
            tenant,
            ...current.filter((t) => t.id !== tenant.id),
          ]);
          onTenantCreated?.(tenant);
          setCreating(false);
          setSelected(tenant);
          setSection(null);
          setError("");
          setNotice(c.createdNotice);
        }}
      />
    );
  if (selected) {
    const fmt = billFormatters(locale);
    const runAction = (action: TenantNextAction) => {
      setNotice("");
      setContractFocus(action.kind === "sign" ? action.contract : null);
      if (action.kind === "review_slip") setSection("payments");
      else if (action.kind === "sign") setSection("contracts");
      else if (!selected.email) {
        setSection("profile");
        beginEdit(selected);
      } else {
        setContractStart("reservation");
        setSection("contracts");
      }
    };
    const confirmSlip = async (bill: AgentTenantBill) => {
      if (confirmingId != null) return;
      setConfirmingId(bill.id);
      setError("");
      setPaymentNotice("");
      try {
        await confirmAgentRentSlip(bill.id);
        setSlips((current) => current.filter((row) => row.id !== bill.id));
        setBilling((current) => (current ? confirmBill(current, bill.id) : current));
        setPaymentNotice(d.confirmedNotice.replace("{month}", fmt.month(bill.period)));
      } catch (e) {
        setError(localizedError(e, d.slipConfirmFailed, locale));
      } finally {
        setConfirmingId(null);
      }
    };
    const viewSlip = async (bill: AgentTenantBill) => {
      setError("");
      try {
        const { url } = await openAgentRentSlip(bill.id);
        setSlipPreview({ url, title: bill.documentNo });
      } catch (e) {
        setError(localizedError(e, c.list.slipsLoadError, locale));
      }
    };
    return (
      <View style={s.root}>
        {!!notice && (
          <Text
            accessibilityRole="alert"
            style={[s.body, { color: "#198460" }]}
          >
            {notice}
          </Text>
        )}
        {!!error && !editing && (
          <Text
            accessibilityRole="alert"
            style={[s.body, { color: "#C43D4C" }]}
          >
            {error}
          </Text>
        )}
        <Animated.View
          key={section ?? "hub"}
          entering={section ? SlideInRight.duration(200) : FadeIn.duration(150)}
          style={s.section}
        >
        {section === null ? (
          <TenantDetailHub
            tenant={selected}
            billing={billing}
            demo={TENANT_BILLING_DEMO}
            nextAction={tenantNextAction(selected, billing)}
            onOpen={(next) => {
              setNotice("");
              setContractFocus(null);
              setSection(next);
            }}
            onAction={runAction}
          />
        ) : section === "room" ? (
          <TenantRoomBody tenant={selected} />
        ) : section === "bills" ? (
          <TenantBillsBody
            billing={billing}
            leaseActive={tenantLease(selected)?.status === "active"}
            demo={TENANT_BILLING_DEMO}
            onReview={() => setSection("payments")}
          />
        ) : section === "payments" ? (
          <TenantPaymentsBody
            billing={billing}
            demo={TENANT_BILLING_DEMO}
            notice={paymentNotice}
            confirmingId={confirmingId}
            onConfirm={(bill) => void confirmSlip(bill)}
            onViewSlip={(bill) => void viewSlip(bill)}
          />
        ) : section === "attachments" ? (
          <TenantAttachmentsBody tenant={selected} />
        ) : section === "contracts" ? (
          <ContractsScreen
            key={selected.id}
            tenant={selected}
            initialContract={contractFocus}
            startCreate={contractStart}
            onStartCreateHandled={() => setContractStart(null)}
            onChanged={() => {
              void refreshTenant(selected.id);
            }}
          />
        ) : editing ? (
          <View style={[s.card, panel]}>
            {(
              [
                ["firstName", `${c.fieldFirstName} *`, d.placeholderFirstName],
                ["lastName", c.fieldLastName, d.placeholderOptional],
                ["phone", `${c.fieldPhone} *`, d.placeholderPhone],
                ["email", d.fieldEmail, "name@example.com"],
                ["identityNumber", d.fieldIdentity, c.reserveIdentityPlaceholder],
                ["nationality", c.fieldNationality, d.placeholderNationality],
                ["note", c.fieldNote, d.placeholderNote],
              ] as const
            ).map(([key, label, placeholder]) => (
              <View key={key} style={{ gap: 6 }}>
                <Text style={[s.body, title]}>{label}</Text>
                <MobileInput
                  accessibilityLabel={label}
                  value={editForm[key]}
                  onChangeText={(value) =>
                    setEditForm((current) => ({
                      ...current,
                      [key]: key === "identityNumber" ? nextIdentityNumberDraft(value) : value,
                    }))
                  }
                  placeholder={placeholder}
                  maxLength={
                    key === "note"
                      ? 500
                      : key === "phone"
                        ? 50
                        : key === "identityNumber"
                          ? 100
                          : key === "nationality"
                            ? 120
                            : 255
                  }
                  keyboardType={
                    key === "phone"
                      ? "phone-pad"
                      : key === "email"
                        ? "email-address"
                        : "default"
                  }
                  autoCapitalize={
                    key === "email"
                      ? "none"
                      : key === "identityNumber"
                        ? "characters"
                        : "sentences"
                  }
                  autoCorrect={key === "identityNumber" ? false : undefined}
                  editable={!savingEdit}
                />
              </View>
            ))}
            <Text style={[s.small, muted]}>
              {d.profileLocked}
              {selected.property
                ? ` · ${selected.property}${selected.room ? ` · ${d.roomTitle.replace("{room}", selected.room)}` : ""}`
                : ""}
            </Text>
          </View>
        ) : (
          <DetailCard style={s.profile}>
            {(
              [
                ["phone", c.fieldPhone, selected.phone],
                ["email", d.fieldEmail, selected.email],
                ["identity", d.fieldIdentity, selected.identityNumber],
                ["nationality", c.fieldNationality, selected.nationality],
                ["property", d.fieldProperty, selected.property],
                ["room", d.fieldRoom, selected.room],
                ["address", d.fieldAddress, selected.fullAddress],
                ["note", c.fieldNote, selected.note],
              ] as const
            ).map(([key, label, value]) => (
              <DetailField key={key} label={label} value={value?.trim() || d.notSet} />
            ))}
            <Text style={[s.small, muted]}>
              {d.tenantSince.replace("{date}", fmt.date(selected.createdAt))}
            </Text>
          </DetailCard>
        )}
        </Animated.View>
        <MobileBottomSheet visible={slipPreview != null} onClose={() => setSlipPreview(null)} maxHeight="90%">
          <View style={s.previewSheet}>
            <Text style={[s.subtitle, title]} numberOfLines={1}>
              {slipPreview?.title}
            </Text>
            <MobileButton variant="outline" onPress={() => setSlipPreview(null)}>
              {t.owner.bills.close}
            </MobileButton>
            {slipPreview ? (
              <View style={s.preview}>
                <ContractDocumentPreview url={slipPreview.url} />
              </View>
            ) : null}
          </View>
        </MobileBottomSheet>
      </View>
    );
  }
  const openWork = (item: TenantWorkItem, at: TenantSection | null) => {
    setContractFocus(at === "contracts" && "contract" in item ? item.contract : null);
    void open(item.tenant.id, at);
  };
  return (
    <View style={s.root}>
      <MobileSegmentedTabs
        tabs={[
          { key: "work", label: c.list.tabWork, count: loading ? "–" : workItems.length },
          { key: "all", label: c.list.tabAll, count: loading ? "–" : items.length },
        ]}
        value={listView}
        onChange={setView}
      />
      {opening ? <ActivityIndicator color={tokens.colors.roles.agent} /> : null}
      {!!error && (
        <Text accessibilityRole="alert" style={[s.body, { color: tokens.colors.danger }]}>
          {error}
        </Text>
      )}
      <Animated.View key={listView} entering={FadeIn.duration(150)}>
        {listView === "work" ? (
          <TenantWorkBody
            items={workItems}
            kind={workKind}
            onKindChange={setWorkKind}
            query={workQuery}
            onQueryChange={setWorkQuery}
            busy={opening}
            onOpenTenant={(item) => openWork(item, null)}
            onAction={(item) => openWork(item, item.kind === "slip" ? "payments" : "contracts")}
          />
        ) : (
          <TenantDirectoryBody
            tenants={items}
            items={workItems}
            loading={loading}
            query={query}
            onQueryChange={setQuery}
            filter={directoryFilter}
            onFilterChange={setDirectoryFilter}
            busy={opening}
            onOpen={(tenant) => void open(tenant.id)}
          />
        )}
      </Animated.View>
    </View>
  );
}

/** Save / cancel for tenant edit mode, rendered in the shell's bottom bar so it stays reachable. */
export function TenantEditBar({
  saving,
  error,
  onCancel,
  onSave,
}: {
  saving: boolean;
  error: string;
  onCancel: () => void;
  onSave: () => void;
}) {
  const { t } = useLocale();
  const c = t.agent.tenants;
  const { theme } = useMobileTheme();
  return (
    <View style={[s.editBar, { borderTopColor: theme.border }]}>
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={[s.editBarError, { color: tokens.colors.danger }]}
        >
          {error}
        </Text>
      )}
      <View style={s.editBarRow}>
        <MobileButton
          variant="outline"
          onPress={onCancel}
          disabled={saving}
          style={s.editBarCancel}
        >
          {c.cancel}
        </MobileButton>
        <MobileButton
          onPress={onSave}
          disabled={saving}
          isLoading={saving}
          style={s.editBarSave}
        >
          <View style={s.editBarSaveInner}>
            <MobileIcon name="check" size={18} color={tokens.colors.primary} />
            <Text style={s.editBarSaveText}>{c.save}</Text>
          </View>
        </MobileButton>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    gap: 16,
    paddingBottom: 24,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  subtitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 25,
  },
  body: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 23,
  },
  small: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 20,
  },
  card: { borderWidth: 1, borderRadius: 17, padding: 16, gap: 15 },
  editBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  editBarError: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
  },
  editBarRow: { flexDirection: "row", gap: 10 },
  editBarCancel: { flex: 1, minHeight: 50, borderRadius: 12 },
  editBarSave: { flex: 2, minHeight: 50, borderRadius: 12 },
  editBarSaveInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  editBarSaveText: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    color: tokens.colors.primary,
  },
  section: { gap: 16 },
  profile: { gap: 14 },
  previewSheet: { height: "90%", paddingHorizontal: 16, gap: 8 },
  preview: { flex: 1, minHeight: 280 },
});
