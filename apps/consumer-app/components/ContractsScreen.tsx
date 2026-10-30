import type { ContractParty } from "@nestyk/types";
import { FinancialDocumentForm } from "./FinancialDocumentForm";
import { CommissionConfirmationForm } from "./CommissionConfirmationForm";
import { AgreementAttachments } from "./AgreementAttachments";
import {
  ReservationLetterFields,
  emptyReservationLetterForm,
  reservationLetterFieldErrors,
  reservationIssueDate,
} from "./ReservationLetterFields";
import { listLeadDealOffers } from "../lib/deal-offers-api";
import { OFFER_LEASE_LOCKED_KEYS, OFFER_RESERVATION_LOCKED_KEYS } from "../lib/deal-offer";
import {
  BrokerAppointmentFields,
  emptyBrokerAppointmentForm,
  completeBrokerNames,
  brokerAppointmentFieldErrors,
} from "./BrokerAppointmentFields";
import {
  LeaseAgreementFields,
  emptyLeaseAgreementForm,
  completeLeaseNames,
  leaseAgreementFieldErrors,
  leaseAgreementFieldStep,
} from "./LeaseAgreementFields";
import {
  LeaseRenewalFields,
  emptyLeaseRenewalForm,
  leaseRenewalFieldErrors,
} from "./LeaseRenewalFields";
import {
  ContractTypePicker,
  type CreateDocumentKind,
} from "./ContractTypePicker";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Modal,
  Alert,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import {
  MobileThemeProvider,
  MobileBottomSheet,
  MobileButton,
  MobileIcon,
  MobileInput,
  ModePageScrollContext,
  tokens,
  useMobileTheme,
} from "@nestyk/ui/native";
import { fillTemplate, localizedError, useLocale } from "@nestyk/i18n";
import { localeTag } from "../lib/lead-format";
import type {
  AgreementType,
  AgreementTemplate,
  AgentContract,
  AgentContractDocumentKind,
  CommissionConfirmation,
  StandaloneInvoice,
  RejectedAttachmentNotice,
  AgentContractSignParty,
  AgreementSignatureLogEntry,
  AgentContractStatus,
  ContractCandidate,
  AgentTenant,
  ReservationLetterInput,
  BrokerAppointmentInput,
  LeaseAgreementInput,
  LeaseRenewalInput,
} from "@nestyk/types";
import {
  listAgentContracts,
  listCommissionConfirmations,
  listStandaloneInvoices,
  listAgreementTypes,
  listAgreementTemplates,
  getAgentContract,
  listContractCandidates,
  listAgentContractSignatures,
  getReservationDefaults,
  getBrokerAppointmentLeadDefaults,
  getLeaseDefaults,
  createAgentContract,
  updateAgentContractDraft,
  cancelAgentContractDraft,
  getDealCancellationPreview,
  cancelDeal,
  recordDealRefund,
  getAgentContractDraftTemplate,
  uploadAgentContractDocument,
  signAgentContract,
  signAgentContractWitness,
  issueAgentDepositInvoice,
  returnDepositSlip,
  moveHandoverDue,
  returnReservationSlip,
  deliverAgentContract,
  previewAgentReservation,
  generateAgentReservation,
  previewAgentBrokerAppointment,
  generateAgentBrokerAppointment,
  previewAgentLeaseAgreement,
  generateAgentLeaseAgreement,
  previewAgentLeaseRenewal,
  generateAgentLeaseRenewal,
  generateFinancialDocument,
} from "../lib/agent-contracts-api";
import { ReservationPaymentCard } from "./ReservationPaymentCard";
import { ReservationTerms } from "./ReservationTerms";
import { DealOfferSection } from "./DealOfferSection";
import { DepositPaymentCard } from "./DepositPaymentCard";
import { HandoverDueControl } from "./HandoverDueControl";
import { DealCancellationCard, type PickedFile } from "./DealCancellationCard";
import { canCancelDeal } from "../lib/deal-cancellation";
import { HandoverCard } from "./HandoverCard";
import { DepositSettlementCard } from "./DepositSettlementCard";
import { RejectedAttachmentsNotice } from "./RejectedAttachmentsNotice";
import { bookingPaymentBlocksSigning } from "../lib/contract-signing";
import { AgentContractLibrary } from "./AgentContractLibrary";
import { emptyLibraryView, type ContractLibraryEntry } from "../lib/agent-contract-library";
import { ContractDocumentPreview } from "./ContractDocumentPreview";
import {
  ContractSignaturePad,
  type ContractSignaturePadHandle,
} from "./ContractSignaturePad";
import { bangkokDateKey, isIsoDate, leaseTermEnd, positiveMonths, shiftIsoDate } from "../lib/lease-term";
import { canCancelRenewal, renewalCandidates, renewalClosedMessage, renewalCommissionValue } from "../lib/contract-renewal";
import { signatureChannelText } from "../lib/signature-log";
import { canCloseContract } from "../lib/contract-close";
import { ContractCloseCard, closeResultNotice } from "./ContractCloseCard";

const color = (status: AgentContractStatus) =>
  status === "active"
    ? "#278268"
    : status.startsWith("awaiting")
      ? "#BB7914"
      : "#788193";

const bangkokToday = bangkokDateKey;

function firstContractOf(rows: AgentContract[], source: AgentContract) {
  const rootId = source.rootAgreementId || source.id;
  return rows.find((row) => row.id === rootId) ?? source;
}

function issuedOn(row: AgentContract) {
  const data = row.data ?? {};
  const lease =
    data.leaseAgreement && typeof data.leaseAgreement === "object"
      ? (data.leaseAgreement as { issueDate?: string })
      : {};
  const renewal =
    data.leaseRenewal && typeof data.leaseRenewal === "object"
      ? (data.leaseRenewal as { issueDate?: string })
      : {};
  const issue = lease.issueDate || renewal.issueDate || "";
  return /^\d{4}-\d{2}-\d{2}$/.test(issue) ? issue : row.startDate;
}

function firstLeaseFieldsFrom(root: AgentContract) {
  return {
    firstLeaseNo: root.contractNo,
    firstLeaseDate: issuedOn(root),
    firstLeaseStart: root.startDate,
    firstLeaseEnd: root.endDate ?? "",
  };
}

function renewalDraftFromLease(
  source: AgentContract,
  root: AgentContract,
): LeaseRenewalInput {
  const leaseOf = (row: AgentContract) =>
    row.data?.leaseAgreement && typeof row.data.leaseAgreement === "object"
      ? (row.data.leaseAgreement as Partial<LeaseAgreementInput>)
      : {};
  const prior =
    source.data?.leaseRenewal && typeof source.data.leaseRenewal === "object"
      ? (source.data.leaseRenewal as Partial<LeaseRenewalInput>)
      : {};
  const lease = Object.keys(leaseOf(source)).length ? leaseOf(source) : leaseOf(root);
  const landlord =
    prior.landlordName ||
    [lease.landlordFirstName, lease.landlordLastName].filter(Boolean).join(" ") ||
    lease.landlordName ||
    "";
  const tenantName =
    prior.tenantName ||
    [lease.tenantFirstName, lease.tenantLastName].filter(Boolean).join(" ") ||
    lease.tenantName ||
    source.tenant;
  const propertyLine =
    prior.propertyLine ||
    [lease.project, lease.houseNo, source.room, lease.propertyAddress || source.property]
      .filter(Boolean)
      .join(" ");
  const bankParts = [lease.bankName, lease.accountName, lease.accountNo].map(value => value?.trim() || '');
  const bankAccount =
    prior.bankAccount ||
    (bankParts.some(Boolean) ? bankParts.join(" / ") : '');
  return {
    ...emptyLeaseRenewalForm(),
    issueDate: bangkokToday(),
    landlordName: landlord,
    tenantName,
    propertyLine,
    ...firstLeaseFieldsFrom(root),
    originalLeaseNo: source.contractNo,
    originalLeaseDate: issuedOn(source),
    originalExpiryDate: source.endDate ?? lease.termTo ?? "",
    renewMonths: "12",
    startDate: shiftIsoDate(source.endDate ?? lease.termTo ?? "", 1),
    endDate: leaseTermEnd(shiftIsoDate(source.endDate ?? lease.termTo ?? "", 1), 12),
    monthlyRent:
      source.monthlyRent == null ? lease.monthlyRent ?? "" : String(source.monthlyRent),
    dueDay: prior.dueDay || lease.rentDueDay || "",
    bankAccount,
    depositCarried:
      source.deposit == null ? lease.depositAmount ?? "" : String(source.deposit),
    landlordSignName: landlord,
    tenantSignName: tenantName,
  };
}

type ContractsScreenProps = {
  tenant?: AgentTenant;
  initialContract?: AgentContract | null;
  onChanged?: () => void;
  /** Open this document's create flow directly, skipping the type picker. */
  startCreate?: CreateDocumentKind | null;
  /** Clear the requested create kind after it has been opened. */
  onStartCreateHandled?: () => void;
  /**
   * Filled with this screen's own back step for the host's header back button.
   * Returns true when the screen stepped back itself (type picker or a create menu opened from it).
   */
  backRef?: React.MutableRefObject<(() => boolean) | null>;
};

export function ContractsScreen(props: ContractsScreenProps = {}) {
  return <MobileThemeProvider defaultMode="light"><ContractsWorkspace {...props} /></MobileThemeProvider>;
}

/** D1: the API marks a booked tenant whose room + tenant has no valid broker appointment; such a tenant cannot start a reservation letter. */
export function appointmentBlocked(candidate: ContractCandidate | undefined): boolean {
  return !!candidate && candidate.brokerAppointmentReady === false;
}

function ContractsWorkspace({ tenant, initialContract, onChanged, startCreate = null, onStartCreateHandled, backRef }: ContractsScreenProps) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const docs = t.agent.contracts;
  const cn = docs.notice;
  const tc = t.contracts;
  const sc = tc.screen;
  // Errors the app can explain in the reader's language even when the API message is Thai only.
  const message = (error: unknown) => {
    const code = (error as { code?: unknown } | null)?.code;
    if (code === "BROKER_APPOINTMENT_REQUIRED") return docs.reservationNeedsBroker;
    if (code === "WITNESS_SIGNATURE_REQUIRED") return docs.witnessRequired;
    if (code === "CO_BROKE_REQUIRED") return tc.offer.coBrokeRequired;
    if (code === "SLIP_CHANGED") return tc.slipReturn.changed;
    return localizedError(error, cn.connectError, locale);
  };
  const labels = tc.common.status;
  const money = (value: number | null) =>
    value == null
      ? tc.common.notSpecified
      : `฿${value.toLocaleString(localeTag(locale), { maximumFractionDigits: 2 })}`;
  const date = (value: string | null) =>
    value
      ? new Date(`${value}T00:00:00`).toLocaleDateString(localeTag(locale), {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : tc.common.notSpecified;
  const roomSuffix = (room: string | null | undefined) =>
    room ? ` · ${fillTemplate(tc.common.room, { room })}` : "";
  const typeLabel = (contract: Pick<AgentContract, "formKind" | "agreementTypeName">) =>
    locale === "th" ? contract.agreementTypeName : tc.common.kinds[contract.formKind];
  const tenantPayer = useMemo(() => {
    if (!tenant) return undefined;
    const digits = (tenant.identityNumber ?? "").replace(/\D/g, "");
    return {
      tenantId: tenant.id,
      name: tenant.name,
      firstName: tenant.firstName,
      lastName: tenant.lastName,
      phone: tenant.phone,
      email: tenant.email ?? "",
      address: (tenant.fullAddress ?? "").slice(0, 240),
      taxId: /^\d{13}$/.test(digits) ? digits : "",
    };
  }, [tenant]);
  const [contracts, setContracts] = useState<AgentContract[]>([]);
  const [invoices, setInvoices] = useState<StandaloneInvoice[]>([]);
  const [commissions, setCommissions] = useState<CommissionConfirmation[]>([]);
  const shownCommissions = tenant
    ? commissions.filter((row) => row.tenantId === tenant.id)
    : commissions;
  const shownInvoices = tenant
    ? invoices.filter((row) => row.tenantId === tenant.id)
    : invoices;
  const [viewingInvoice, setViewingInvoice] = useState<StandaloneInvoice | null>(
    null,
  );
  const [payingInvoice, setPayingInvoice] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [retry, setRetry] = useState(0);
  const listRequest = useRef(0);
  useEffect(() => {
    const request = ++listRequest.current;
    setLoadingList(true);
    setListError("");
    Promise.allSettled([
      listAgentContracts(),
      listStandaloneInvoices(),
      listCommissionConfirmations(),
    ]).then(([contractResult, invoiceResult, commissionResult]) => {
      if (request !== listRequest.current) return;
      if (contractResult.status === "fulfilled")
        setContracts(
          contractResult.value.filter(
            (row) => !tenant || row.tenantId === tenant.id,
          ),
        );
      if (invoiceResult.status === "fulfilled") setInvoices(invoiceResult.value);
      if (commissionResult.status === "fulfilled")
        setCommissions(commissionResult.value);
      const failed = [contractResult, invoiceResult, commissionResult].find(result => result.status === "rejected");
      if (failed?.status === "rejected") setListError(message(failed.reason));
    })
      .catch((e) => {
        if (request === listRequest.current) setListError(message(e));
      })
      .finally(() => {
        if (request === listRequest.current) setLoadingList(false);
      });
    return () => {
      listRequest.current++;
    };
  }, [tenant?.id, retry]);
  const startedCreate = useRef(false);
  useEffect(() => {
    if (!startCreate) {
      startedCreate.current = false;
      return;
    }
    if (loadingList) return;
    if (startedCreate.current) return;
    startedCreate.current = true;
    onStartCreateHandled?.();
    void onCreateKind(startCreate);
    // One start per request; `onCreateKind` is a new function on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startCreate, loadingList]);
  const [selected, setSelected] = useState<AgentContract | null>(
    initialContract ?? null,
  );
  const [agreementType, setAgreementType] = useState<AgreementType | null>(
    null,
  );
  const [renewing, setRenewing] = useState<AgentContract | null>(null);
  const [template, setTemplate] = useState<AgreementTemplate | null>(null);
  const [extraFields, setExtraFields] = useState<Record<string, string>>({});
  const reservation = agreementType?.formKind === "reservation";
  const broker = agreementType?.formKind === "broker_appointment";
  const lease = agreementType?.formKind === "lease";
  const renewal = agreementType?.formKind === "renewal";
  const standardFields = new Set([
    "startDate",
    "endDate",
    "moveInDate",
    "monthlyRent",
    "deposit",
    "reservationFee",
  ]);
  const customFields = Object.entries(
    (template?.dataSchema.properties ?? {}) as Record<
      string,
      { type?: string; title?: string; enum?: unknown[] }
    >,
  ).filter(([key]) => !standardFields.has(key));
  const [choosingType, setChoosingType] = useState(false);
  const [menuCreate, setMenuCreate] = useState<CreateDocumentKind | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmingSave, setConfirmingSave] = useState(false);
  const [creationStep, setCreationStep] = useState(0);
  const creationAnchorRef = useRef<View>(null);
  const steppedCreation = reservation || lease;
  const creationSteps = lease
    ? sc.leaseSteps
    : sc.reservationSteps;
  const reservationFieldStep = (key: string) =>
    key.startsWith("tenant") || key.startsWith("landlord")
      ? 0
      : ["project", "issueDate", "termFrom", "termTo"].includes(key)
        ? 1
        : 2;
  const changeCreationStep = (next: number) => {
    setCreationStep(next);
    requestAnimationFrame(() =>
      pageScroll?.scrollToView(creationAnchorRef, {
        offset: 8,
        animated: true,
      }),
    );
  };
  function finalizedReservation(forLeadId: number | null) {
    return contracts.some(
      (row) =>
        row.formKind === "reservation" &&
        row.reservationLetterStatus === "ready" &&
        !["cancelled", "expired", "terminated"].includes(row.status) &&
        (forLeadId == null || row.leadId === forLeadId),
    );
  }
  const nextCreationStep = () => {
    if (!leadId) {
      setError(cn.selectTenantRoom);
      changeCreationStep(0);
      return;
    }
    if (reservation && !editingDraft && appointmentBlocked(candidates.find((c) => c.leadId === leadId))) {
      setError(docs.reservationNeedsBroker);
      changeCreationStep(0);
      return;
    }
    if (
      lease &&
      !renewing &&
      !editingDraft?.previousAgreementId &&
      !finalizedReservation(leadId)
    ) {
      setError(cn.leaseRequiresReservation);
      changeCreationStep(0);
      return;
    }
    const errors = lease
      ? leaseAgreementFieldErrors(leaseForm, tc.validation)
      : reservationLetterFieldErrors(letter, tc.validation);
    const currentErrors = Object.fromEntries(
      Object.entries(errors).filter(
        ([key]) =>
          (lease ? leaseAgreementFieldStep(key) : reservationFieldStep(key)) ===
          creationStep,
      ),
    );
    if (lease) setLeaseErrors(currentErrors);
    else setLetterErrors(currentErrors);
    if (Object.keys(currentErrors).length) {
      setError(cn.stepRequired);
      changeCreationStep(creationStep);
      return;
    }
    setError("");
    changeCreationStep(creationStep + 1);
  };
  const [editingDraft, setEditingDraft] = useState<AgentContract | null>(null);
  const [cancellingDraft, setCancellingDraft] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [financialKind, setFinancialKind] = useState<"invoice" | "receipt" | null>(null);
  // D10: the agent is issuing the receipt for the lease deposit invoice.
  const [payingDeposit, setPayingDeposit] = useState(false);
  const [attachmentsNonce, setAttachmentsNonce] = useState(0);
  const [focusDocuments, setFocusDocuments] = useState(false);
  const [attachmentReadiness, setAttachmentReadiness] = useState<{
    contractId: number;
    ready: boolean;
    /** B3: attachments the agent rejected, shown to whoever still has to sign. */
    rejected: RejectedAttachmentNotice[];
  } | null>(null);
  const pageScroll = useContext(ModePageScrollContext);
  const documentsAnchorRef = useRef<View>(null);
  useEffect(() => {
    if (!focusDocuments || financialKind) return;
    const id = requestAnimationFrame(() => {
      pageScroll?.scrollToView(documentsAnchorRef, { offset: 8, animated: true });
    });
    return () => cancelAnimationFrame(id);
  }, [focusDocuments, pageScroll, selected?.id, financialKind]);
  const [uploadingKind, setUploadingKind] =
    useState<AgentContractDocumentKind | null>(null);
  const [pickKind, setPickKind] = useState<AgentContractDocumentKind | null>(
    null,
  );
  const [signParties, setSignParties] = useState<
    AgentContractSignParty[] | null
  >(null);
  // D9: the lease witness signing sheet (asAgent: the agent is the witness; otherwise a named person signs here).
  const [witnessSign, setWitnessSign] = useState<{ asAgent: boolean } | null>(null);
  const [witnessName, setWitnessName] = useState("");
  const [viewSignature, setViewSignature] = useState<{
    label: string;
    url: string;
  } | null>(null);
  // D17: how each party signed the open contract (null until loaded; a failed load just hides the lines).
  const [signatureLog, setSignatureLog] = useState<AgreementSignatureLogEntry[] | null>(null);
  const signatureKey = selected
    ? `${selected.id}:${selected.ownerSignedAt}:${selected.tenantSignedAt}:${selected.agentSignedAt}`
    : "";
  useEffect(() => {
    if (!selected) return;
    let live = true;
    setSignatureLog(null);
    listAgentContractSignatures(selected.id)
      .then((rows) => {
        if (live) setSignatureLog(rows);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [signatureKey]);
  const witnessEntry = signatureLog?.find((row) => row.party === "witness") ?? null;
  // Only known once the log has loaded; if it cannot load, the API still refuses to generate without a witness.
  const leaseNeedsWitness = signatureLog != null && !witnessEntry;
  function openWitnessSheet(asAgent: boolean) {
    if (busy || signing.current) return;
    setError("");
    setWitnessName("");
    setSignPadKey((key) => key + 1);
    setWitnessSign({ asAgent });
  }
  const [previewDoc, setPreviewDoc] = useState<{
    name: string;
    url: string;
    kind: AgentContractDocumentKind | "commission_confirmation" | "payment_slip";
  } | null>(null);
  const [signPadKey, setSignPadKey] = useState(0);
  const padRef = useRef<ContractSignaturePadHandle>(null);
  const saving = useRef(false);
  const signing = useRef(false);
  const picking = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [candidates, setCandidates] = useState<ContractCandidate[]>([]);
  // D1: on the global screen, the booked tenants that could start a reservation letter (null until loaded, or if loading fails).
  const [pickerCandidates, setPickerCandidates] = useState<ContractCandidate[] | null>(null);
  const tenantMode = !!tenant;
  useEffect(() => {
    if (!choosingType || tenantMode) return;
    let live = true;
    setPickerCandidates(null);
    listContractCandidates()
      .then((rows) => {
        if (live) setPickerCandidates(rows);
      })
      .catch(() => {
        if (live) setPickerCandidates(null);
      });
    return () => {
      live = false;
    };
  }, [choosingType, tenantMode]);
  const noReadyReservationTenant =
    !tenant && !!pickerCandidates && !pickerCandidates.some((c) => !appointmentBlocked(c));
  const [leadId, setLeadId] = useState<number | null>(null);
  // D2: an offer the landlord confirmed for the chosen tenant's room fixes the letter's and the lease's numbers
  // (the API sets them whatever is typed), so those fields are locked here. The room is known from the contract
  // candidates; inside a tenant or an open draft it is not, and then the lead's confirmed offer is the booked room's
  // (booking closes the lead's offers on other rooms).
  const [offerLocked, setOfferLocked] = useState(false);
  const offerRoomId = candidates.find((c) => c.leadId === leadId)?.rentRoomId;
  useEffect(() => {
    setOfferLocked(false);
    if (!leadId || !(reservation || lease)) return;
    let live = true;
    listLeadDealOffers(leadId)
      .then((offers) => {
        if (live) setOfferLocked(offers.some((o) => o.status === "confirmed" && (offerRoomId == null || o.rentRoomId === offerRoomId)));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [leadId, offerRoomId, reservation, lease]);
  const [form, setForm] = useState({
    startDate: "",
    endDate: "",
    moveInDate: "",
    monthlyRent: "",
    deposit: "",
    reservationFee: "",
    notes: "",
  });
  const [letter, setLetter] = useState<ReservationLetterInput>(
    emptyReservationLetterForm(),
  );
  const [letterErrors, setLetterErrors] = useState<
    Partial<Record<string, string>>
  >({});
  const [brokerForm, setBrokerForm] = useState<BrokerAppointmentInput>(
    emptyBrokerAppointmentForm(),
  );
  const [brokerErrors, setBrokerErrors] = useState<
    Partial<Record<string, string>>
  >({});
  const [leaseForm, setLeaseForm] = useState<LeaseAgreementInput>(
    emptyLeaseAgreementForm(),
  );
  const [leaseErrors, setLeaseErrors] = useState<
    Partial<Record<string, string>>
  >({});
  const [renewalForm, setRenewalForm] = useState<LeaseRenewalInput>(
    emptyLeaseRenewalForm(),
  );
  // AC-8.1: the renewal commission, typed by the agent (kept outside the renewal form's PDF fields).
  const [renewalCommission, setRenewalCommission] = useState("");
  const [renewalErrors, setRenewalErrors] = useState<
    Partial<Record<string, string>>
  >({});
  const [libraryView, setLibraryView] = useState(emptyLibraryView);
  const accent =
    creating && steppedCreation
      ? tokens.colors.brand[500]
      : tokens.colors.roles.agent;
  const card = { backgroundColor: theme.surface, borderColor: theme.border };
  const title = { color: theme.textHeading };
  const muted = { color: theme.textSecondary };
  const button = (
    label: string,
    onPress: () => void,
    primary = false,
    reactKey?: string | number,
  ) => (
    <Pressable
      key={reactKey}
      accessibilityRole="button"
      disabled={busy}
      accessibilityState={{ disabled: busy }}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: primary ? accent : theme.background,
          borderColor: primary ? accent : theme.border,
          opacity: pressed || busy ? 0.6 : 1,
        },
      ]}
    >
      <Text
        style={[
          s.body,
          {
            color: primary
              ? creating && steppedCreation
                ? tokens.colors.onBrand
                : "#fff"
              : theme.textHeading,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
  const errorView = error ? (
    // selectable: the agent can copy an error to report it.
    <Text accessibilityRole="alert" selectable style={[s.body, { color: "#C74747" }]}>
      {error}
    </Text>
  ) : null;
  useEffect(() => {
    if (!initialContract?.id) return;
    let cancelled = false;
    getAgentContract(initialContract.id)
      .then((row) => {
        if (!cancelled) setSelected(row);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [initialContract?.id]);
  const documentSlots = (
    contract: AgentContract,
  ): Array<{
    kind: AgentContractDocumentKind;
    name: string;
    url: string | null;
  }> =>
    contract.formKind === "renewal"
      ? [
          {
            kind: "lease_agreement",
            name: tc.renewalForm.title,
            url: contract.leaseDocumentUrl,
          },
        ]
      : contract.formKind === "lease"
      ? [
          {
            kind: "lease_agreement",
            name: docs.leaseAgreement,
            url: contract.leaseDocumentUrl,
          },
        ]
      : contract.formKind === "broker_appointment"
        ? [
            {
              kind: "broker_appointment",
              name: tc.common.brokerAppointmentDocument,
              url: contract.brokerAppointmentUrl,
            },
          ]
        : [
            {
              kind: "reservation_letter",
              name: docs.reservationLetter,
              url: contract.reservationLetterUrl,
            },
          ];
  function openDocumentPreview(
    name: string,
    url: string,
    kind: AgentContractDocumentKind | "commission_confirmation" | "payment_slip",
  ) {
    setError("");
    setPreviewDoc({ name, url, kind });
  }
  /** D5: cancel the deal or record its refund; the other agreements of the deal are reloaded (they changed too). */
  async function saveDealChange(run: () => Promise<AgentContract>, done: string) {
    if (busy || saving.current) return false;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const updated = await run();
      setSelected(updated);
      setContracts((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
      setNotice(done);
      onChanged?.();
      setRetry((n) => n + 1);
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  /** D10: issue the deposit invoice again when issuing it with the generated lease failed. */
  async function issueDepositInvoice() {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      const updated = await issueAgentDepositInvoice(selected.id);
      setSelected(updated);
      setContracts((rows) => rows.map((row) => row.id === updated.id ? updated : row));
      setNotice(tc.deposit.issued);
      onChanged?.();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  /** D11 (AC-3.4, 5.4): return the tenant's booking or deposit slip with a reason. */
  async function returnSlip(kind: "reservation" | "deposit", reason: string) {
    if (!selected || busy) return false;
    setBusy(true);
    setError("");
    try {
      const seen = kind === "reservation" ? selected.reservationPayment?.submittedAt : selected.depositPayment?.submittedAt;
      const updated = await (kind === "reservation" ? returnReservationSlip : returnDepositSlip)(selected.id, reason, seen ?? null);
      setSelected(updated);
      setContracts((rows) => rows.map((row) => row.id === updated.id ? updated : row));
      setNotice(tc.slipReturn.done);
      onChanged?.();
      return true;
    } catch (e) {
      setError(message(e));
      // The tenant sent a newer slip meanwhile: show it, so the agent checks that one.
      if ((e as { code?: string } | null)?.code === "SLIP_CHANGED")
        await getAgentContract(selected.id)
          .then((row) => {
            setSelected(row);
            setContracts((rows) => rows.map((existing) => existing.id === row.id ? row : existing));
          })
          .catch(() => undefined);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function createBookingInvoice() {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      const updated = await generateFinancialDocument(selected.id, "invoice", {});
      setSelected(updated);
      setContracts((rows) => rows.map((row) => row.id === updated.id ? updated : row));
      setNotice(cn.invoiceCreated);
      onChanged?.();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function openPaymentProof(invoice: StandaloneInvoice) {
    setNotice("");
    setViewingInvoice(invoice);
    if (!invoice.paymentSlipUrl) {
      setPreviewDoc(null);
      setError(docs.financial.slipMissing);
      return;
    }
    openDocumentPreview(
      docs.financial.paymentProof,
      invoice.paymentSlipUrl,
      "receipt",
    );
  }
  function replaceFromPreview() {
    if (
      !previewDoc ||
      previewDoc.kind === "reservation_letter" ||
      previewDoc.kind === "broker_appointment" ||
      previewDoc.kind === "lease_agreement" ||
      previewDoc.kind === "payment_slip" ||
      previewDoc.kind === "commission_confirmation"
    )
      return;
    const kind = previewDoc.kind;
    setPreviewDoc(null);
    setTimeout(() => setPickKind(kind), 400);
  }
  async function openDocumentExternally(url: string) {
    setError("");
    try {
      await Linking.openURL(url);
    } catch {
      setError(docs.previewError);
    }
  }
  async function pickAndUpload(
    kind: AgentContractDocumentKind,
    source: "documents" | "photos",
  ) {
    if (
      !selected ||
      uploadingKind ||
      kind === "reservation_letter" ||
      kind === "broker_appointment" ||
      kind === "lease_agreement"
    )
      return;
    let picked: {
      uri: string;
      name: string;
      mimeType: string;
      file?: File;
    } | null = null;
    try {
      if (source === "photos") {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setError(docs.photosPermission);
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: false,
          quality: 0.8,
          preferredAssetRepresentationMode:
            ImagePicker.UIImagePickerPreferredAssetRepresentationMode
              .Compatible,
        });
        if (result.canceled) return;
        const asset = result.assets[0];
        if (!asset?.uri) return;
        picked = {
          uri: asset.uri,
          name: asset.fileName || `${kind}.jpg`,
          mimeType: asset.mimeType || "image/jpeg",
          file: "file" in asset ? asset.file : undefined,
        };
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["application/pdf", "image/jpeg", "image/png"],
          copyToCacheDirectory: true,
        });
        if (result.canceled) return;
        const asset = result.assets[0];
        if (!asset?.uri) return;
        picked = {
          uri: asset.uri,
          name: asset.name || `${kind}.pdf`,
          mimeType: asset.mimeType || "application/octet-stream",
          file: "file" in asset ? asset.file : undefined,
        };
      }
    } catch (e) {
      setError(localizedError(e, docs.uploadError, locale));
      return;
    }
    if (!picked) return;
    setUploadingKind(kind);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const latest = await uploadAgentContractDocument(
        selected.id,
        kind,
        picked,
      );
      setSelected(latest);
      setContracts((current) =>
        current.map((item) => (item.id === latest.id ? latest : item)),
      );
      setNotice(docs.uploadSuccess);
      onChanged?.();
    } catch (e) {
      setError(localizedError(e, docs.uploadError, locale));
    } finally {
      setUploadingKind(null);
      setBusy(false);
    }
  }
  function choosePickSource(source: "documents" | "photos") {
    const kind = pickKind;
    setPickKind(null);
    if (!kind || picking.current || uploadingKind) return;
    picking.current = true;
    setTimeout(() => {
      void (async () => {
        try {
          await pickAndUpload(kind, source);
        } finally {
          picking.current = false;
        }
      })();
    }, 400);
  }
  const partyMeta = (
    contract: AgentContract,
  ): Array<{
    key: AgentContractSignParty;
    label: string;
    signed: string | null;
    signatureUrl: string | null;
  }> => {
    const all = [
      {
        key: "owner" as const,
        label:
          contract.formKind === "broker_appointment" ? tc.common.parties.owner : docs.owner,
        signed: contract.ownerSignedAt,
        signatureUrl: contract.ownerSignatureUrl,
      },
      {
        key: "tenant" as const,
        label: docs.tenant,
        signed: contract.tenantSignedAt,
        signatureUrl: contract.tenantSignatureUrl,
      },
      {
        key: "agent" as const,
        label:
          contract.formKind === "broker_appointment" ? tc.common.parties.agent : docs.agent,
        signed: contract.agentSignedAt,
        signatureUrl: contract.agentSignatureUrl,
      },
    ];
    return contract.formKind === "broker_appointment"
      ? all.filter((row) => row.key !== "tenant")
      : contract.formKind === "lease" || contract.formKind === "renewal"
        ? all.filter((row) => row.key !== "agent")
        : all;
  };
  const signingLocked = (status: AgentContractStatus) =>
    status === "cancelled" ||
    status === "expired" ||
    status === "terminated" ||
    status === "active" ||
    // D7: a generated lease waiting for its deposit or handover is not signed again.
    status === "awaiting_deposit" ||
    status === "awaiting_handover";
  const reservationLocked =
    !!selected &&
    selected.formKind === "reservation" &&
    selected.reservationLetterStatus === "ready";
  const brokerLocked =
    !!selected &&
    selected.formKind === "broker_appointment" &&
    selected.brokerAppointmentStatus === "ready";
  const leaseLocked =
    !!selected &&
    selected.formKind === "lease" &&
    selected.leaseAgreementStatus === "ready";
  const draftCancelled = selected?.status === "cancelled";
  const documentLocked = reservationLocked || brokerLocked || leaseLocked || draftCancelled;
  const attachmentsRequired =
    !!selected &&
    (selected.formKind === "reservation" || selected.formKind === "lease");
  const attachmentsReady =
    !attachmentsRequired ||
    (attachmentReadiness?.contractId === selected.id &&
      attachmentReadiness.ready);
  function signSheetTitle(parties: AgentContractSignParty[]) {
    const names = partyMeta(selected!).filter((row) =>
      parties.includes(row.key),
    );
    return docs.signTitle.replace(
      "{name}",
      names.map((row) => row.label).join(" · ") || "",
    );
  }
  function openSignSheet(parties: AgentContractSignParty[]) {
    if (
      !parties.length ||
      busy ||
      signing.current ||
      documentLocked ||
      !attachmentsReady
    )
      return;
    if (selected && parties.some((party) => bookingPaymentBlocksSigning(selected, party))) {
      setError(t.mobile.partyContracts.bookingPaymentBeforeSigning);
      return;
    }
    setError("");
    setSignPadKey((key) => key + 1);
    setSignParties(parties);
  }
  function partyDeliveredAt(
    contract: AgentContract,
    party: ContractParty,
  ) {
    return party === "owner"
      ? contract.ownerDeliveredAt
      : contract.tenantDeliveredAt;
  }
  function confirmShare(party: ContractParty) {
    if (!selected || busy || documentLocked || !attachmentsReady) return;
    // The contract goes to the party's account once, and they sign in the app (signing by link was removed, 21 Oct 2026).
    if (partyDeliveredAt(selected, party)) return;
    const label = party === "owner" ? docs.owner : docs.tenant;
    Alert.alert(docs.shareSign, docs.shareSignMessage.replace("{party}", label), [
      { text: t.common.cancel, style: "cancel" },
      { text: docs.shareSignSend, onPress: () => void shareSignInvite(party) },
    ]);
  }
  async function shareSignInvite(party: ContractParty) {
    if (!selected || busy || documentLocked || !attachmentsReady) return;
    if (partyDeliveredAt(selected, party)) return;
    const contractId = selected.id;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const sent = await deliverAgentContract(contractId, party);
      const stamp = (contract: AgentContract): AgentContract =>
        contract.id !== contractId
          ? contract
          : {
              ...contract,
              ownerDeliveredAt:
                party === "owner" ? sent.deliveredAt : contract.ownerDeliveredAt,
              tenantDeliveredAt:
                party === "tenant"
                  ? sent.deliveredAt
                  : contract.tenantDeliveredAt,
            };
      setSelected((current) => (current ? stamp(current) : current));
      setContracts((rows) => rows.map(stamp));
      setNotice(party === "owner" ? cn.sharedOwner : cn.sharedTenant);
    } catch (e) {
      setError(localizedError(e, docs.shareSignError, locale));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!signParties && !witnessSign) return;
    const timer = setTimeout(() => {
      padRef.current?.reinitialize?.();
    }, 320);
    return () => clearTimeout(timer);
  }, [signParties, witnessSign, signPadKey]);
  const reservationRequest = useRef(false);
  const [pdfAction, setPdfAction] = useState<"preview" | "generate" | null>(
    null,
  );
  useEffect(() => {
    if (!backRef) return;
    backRef.current = () => {
      if (choosingType) {
        setChoosingType(false);
        setError("");
        return true;
      }
      // These menus' own back buttons return to the type picker, so the header back does the same.
      if (menuCreate === "renewal" || menuCreate === "agent_commission" || menuCreate === "invoice") {
        setMenuCreate(null);
        setChoosingType(true);
        return true;
      }
      return false;
    };
  });
  useEffect(
    () => () => {
      if (backRef) backRef.current = null;
    },
    [backRef],
  );
  async function openReservation(generate: boolean) {
    if (!selected || reservationRequest.current) return;
    reservationRequest.current = true;
    setBusy(true);
    setPdfAction(generate ? "generate" : "preview");
    setError("");
    try {
      const latest = await (
        generate ? generateAgentReservation : previewAgentReservation
      )(selected.id);
      setSelected(latest);
      setContracts((current) =>
        current.map((item) => (item.id === latest.id ? latest : item)),
      );
      if (!latest.reservationLetterUrl)
        throw new Error(cn.openDocumentFailed);
      openDocumentPreview(
        docs.reservationLetter,
        latest.reservationLetterUrl,
        "reservation_letter",
      );
      if (generate) setNotice(cn.generatedReservation);
      onChanged?.();
    } catch (e) {
      setError(message(e));
    } finally {
      reservationRequest.current = false;
      setBusy(false);
      setPdfAction(null);
    }
  }
  async function openBrokerAppointment(generate: boolean) {
    if (!selected || reservationRequest.current) return;
    reservationRequest.current = true;
    setBusy(true);
    setPdfAction(generate ? "generate" : "preview");
    setError("");
    try {
      const latest = await (
        generate
          ? generateAgentBrokerAppointment
          : previewAgentBrokerAppointment
      )(selected.id);
      setSelected(latest);
      setContracts((current) =>
        current.map((item) => (item.id === latest.id ? latest : item)),
      );
      if (!latest.brokerAppointmentUrl)
        throw new Error(cn.openDocumentFailed);
      openDocumentPreview(
        tc.common.brokerAppointmentDocument,
        latest.brokerAppointmentUrl,
        "broker_appointment",
      );
      if (generate) setNotice(cn.generatedBroker);
      onChanged?.();
    } catch (e) {
      setError(message(e));
    } finally {
      reservationRequest.current = false;
      setBusy(false);
      setPdfAction(null);
    }
  }
  async function openLeaseAgreement(generate: boolean) {
    if (!selected || reservationRequest.current) return;
    reservationRequest.current = true;
    setBusy(true);
    setPdfAction(generate ? "generate" : "preview");
    setError("");
    try {
      const renewingDoc = selected.formKind === "renewal";
      const latest = await (
        generate
          ? renewingDoc
            ? generateAgentLeaseRenewal
            : generateAgentLeaseAgreement
          : renewingDoc
            ? previewAgentLeaseRenewal
            : previewAgentLeaseAgreement
      )(selected.id);
      setSelected(latest);
      setContracts((current) =>
        current.map((item) => (item.id === latest.id ? latest : item)),
      );
      if (!latest.leaseDocumentUrl)
        throw new Error(cn.openDocumentFailed);
      openDocumentPreview(
        renewingDoc ? tc.renewalForm.title : docs.leaseAgreement,
        latest.leaseDocumentUrl,
        "lease_agreement",
      );
      if (generate) setNotice(cn.generatedLease);
      onChanged?.();
    } catch (e) {
      setError(message(e));
    } finally {
      reservationRequest.current = false;
      setBusy(false);
      setPdfAction(null);
    }
  }
  async function submitWitnessSignature(image: string) {
    if (!selected || !witnessSign || signing.current) return;
    if (!witnessSign.asAgent && !witnessName.trim()) {
      setError(docs.witnessNameRequired);
      return;
    }
    signing.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const latest = await signAgentContractWitness(selected.id, {
        signaturePng: image,
        asAgent: witnessSign.asAgent,
        ...(witnessSign.asAgent ? {} : { signerName: witnessName.trim() }),
      });
      setWitnessSign(null);
      setSelected(latest);
      setContracts((current) =>
        current.map((item) => (item.id === latest.id ? latest : item)),
      );
      setSignatureLog(await listAgentContractSignatures(latest.id).catch(() => null));
      setNotice(docs.signSuccess);
      onChanged?.();
    } catch (e) {
      setError(localizedError(e, docs.signError, locale));
    } finally {
      signing.current = false;
      setBusy(false);
    }
  }
  async function submitSignature(image: string) {
    if (witnessSign) return submitWitnessSignature(image);
    if (!selected || !signParties?.length || signing.current) return;
    signing.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const latest = await signAgentContract(selected.id, {
        parties: signParties,
        signaturePng: image,
      });
      setSignParties(null);
      setSelected(latest);
      setContracts((current) =>
        current.map((item) => (item.id === latest.id ? latest : item)),
      );
      setNotice(docs.signSuccess);
      onChanged?.();
    } catch (e) {
      setError(localizedError(e, docs.signError, locale));
    } finally {
      signing.current = false;
      setBusy(false);
    }
  }
  async function loadCandidates() {
    setBusy(true);
    setError("");
    try {
      setCandidates(
        tenant
          ? [
              {
                leadId: tenant.leadId,
                tenant: tenant.name,
                property: tenant.property,
                room: tenant.room,
                brokerAppointmentReady: tenant.brokerAppointmentReady,
              },
            ]
          : await listContractCandidates(),
      );
      if (tenant) setLeadId(tenant.leadId);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function beginContract(
    type: AgreementType,
    source: AgentContract | null = null,
  ) {
    setEditingDraft(null);
    setCancellingDraft(false);
    setRenewing(source);
    setAgreementType(type);
    setChoosingType(false);
    setCreationStep(0);
    setCreating(true);
    setTemplate(null);
    setExtraFields({});
    setError("");
    setBusy(true);
    setLeadId(source?.leadId ?? tenant?.leadId ?? null);
    let nextStart = "";
    if (source?.endDate) nextStart = shiftIsoDate(source.endDate, 1);
    setForm({
      startDate: nextStart,
      endDate: "",
      moveInDate: "",
      monthlyRent:
        source?.monthlyRent == null ? "" : String(source.monthlyRent),
      deposit: source?.deposit == null ? "" : String(source.deposit),
      reservationFee: "",
      notes: source?.notes ?? "",
    });
    setLetter(emptyReservationLetterForm());
    setLetterErrors({});
    setBrokerForm(emptyBrokerAppointmentForm());
    setBrokerErrors({});
    setLeaseForm(emptyLeaseAgreementForm());
    setLeaseErrors({});
    setRenewalForm(
      type.formKind === "renewal" && source
        ? renewalDraftFromLease(source, firstContractOf(contracts, source))
        : emptyLeaseRenewalForm(),
    );
    setRenewalCommission("");
    setRenewalErrors({});
    try {
      const [available, people] = await Promise.all([
        listAgreementTemplates(type.code),
        source
          ? Promise.resolve([
              {
                leadId: source.leadId,
                tenant: source.tenant,
                property: source.property,
                room: source.room,
              },
            ])
          : tenant
            ? Promise.resolve([
                {
                  leadId: tenant.leadId,
                  tenant: tenant.name,
                  property: tenant.property,
                  room: tenant.room,
                  brokerAppointmentReady: tenant.brokerAppointmentReady,
                },
              ])
            : listContractCandidates(),
      ]);
      setTemplate(available[0] ?? null);
      setCandidates(people);
      // D1: a reservation starts on the first tenant whose broker appointment is valid.
      const initialLead =
        source?.leadId ??
        tenant?.leadId ??
        (type.formKind === "reservation" ? people.find((c) => !appointmentBlocked(c)) : people[0])?.leadId ??
        null;
      if (initialLead) setLeadId(initialLead);
      if (type.formKind === "reservation" && initialLead) {
        try {
          const defaults = await getReservationDefaults(initialLead);
          setLetter(defaults);
          setForm((current) => ({
            ...current,
            startDate: defaults.issueDate || current.startDate,
            moveInDate: defaults.termFrom || current.moveInDate,
            reservationFee:
              defaults.reservationPayment || current.reservationFee,
          }));
        } catch {
          /* keep empty letter; user can fill manually */
        }
      }
      if (type.formKind === "broker_appointment" && initialLead) {
        try {
          const defaults = await getBrokerAppointmentLeadDefaults(initialLead);
          setBrokerForm(completeBrokerNames(defaults));
          setForm((current) => ({
            ...current,
            startDate: defaults.issueDate || current.startDate,
          }));
        } catch {
          /* keep empty */
        }
      }
      if (type.formKind === "lease" && initialLead) {
        try {
          const defaults = await getLeaseDefaults(initialLead);
          if (
            source?.data?.leaseAgreement &&
            typeof source.data.leaseAgreement === "object"
          ) {
            setLeaseForm(
              completeLeaseNames({
                ...(source.data.leaseAgreement as LeaseAgreementInput),
                landlordSignaturePng: "",
                tenantSignaturePng: "",
              }),
            );
          } else {
            setLeaseForm(completeLeaseNames(defaults));
          }
          setForm((current) => ({
            ...current,
            startDate: defaults.termFrom || current.startDate,
            endDate: defaults.termTo || current.endDate,
            monthlyRent: defaults.monthlyRent || current.monthlyRent,
            deposit: defaults.depositAmount || current.deposit,
          }));
        } catch {
          /* keep empty */
        }
      }
      if (source && available[0]) {
        const keys = Object.keys(
          (available[0].dataSchema.properties ?? {}) as object,
        );
        setExtraFields(
          Object.fromEntries(
            keys
              .filter(
                (key) => !standardFields.has(key) && source.data[key] != null,
              )
              .map((key) => [key, String(source.data[key])]),
          ),
        );
      }
      if (!available.length)
        setError(cn.noTemplate);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function editDraft(contract: AgentContract) {
    setBusy(true);
    setError("");
    try {
      const draftTemplate = await getAgentContractDraftTemplate(contract.id);
      const latest = await getAgentContract(contract.id);
      setEditingDraft(latest);
      setRenewing(null);
      setAgreementType({
        code: latest.agreementTypeCode,
        nameTh: latest.agreementTypeName,
        nameEn: latest.agreementTypeName,
        icon: "key",
        formKind: latest.formKind,
      });
      setTemplate(draftTemplate);
      setLeadId(latest.leadId);
      setCandidates([
        {
          leadId: latest.leadId,
          tenant: latest.tenant,
          property: latest.property,
          room: latest.room,
        },
      ]);
      setForm({
        startDate: latest.startDate,
        endDate: latest.endDate ?? "",
        moveInDate: latest.moveInDate ?? "",
        monthlyRent: String(latest.monthlyRent ?? ""),
        deposit: String(latest.deposit ?? ""),
        reservationFee: String(latest.reservationFee ?? ""),
        notes: latest.notes ?? "",
      });
      setLetter({
        ...emptyReservationLetterForm(),
        ...((latest.data
          .reservationLetter as Partial<ReservationLetterInput>) ?? {}),
      });
      setBrokerForm(
        completeBrokerNames(
          (latest.data.brokerAppointment as Partial<BrokerAppointmentInput>) ??
            {},
        ),
      );
      setLeaseForm(
        completeLeaseNames(
          (latest.data.leaseAgreement as Partial<LeaseAgreementInput>) ?? {},
        ),
      );
      setRenewalCommission(latest.data.renewalCommission == null ? "" : String(latest.data.renewalCommission));
      setRenewalForm(() => {
        const saved = {
          ...emptyLeaseRenewalForm(),
          ...((latest.data.leaseRenewal as Partial<LeaseRenewalInput>) ?? {}),
        };
        const root = contracts.find(
          (row) => row.id === (latest.rootAgreementId || latest.id),
        );
        if (root) Object.assign(saved, firstLeaseFieldsFrom(root));
        if (isIsoDate(saved.originalExpiryDate)) {
          saved.startDate = shiftIsoDate(saved.originalExpiryDate, 1);
          const months = positiveMonths(saved.renewMonths);
          if (months) saved.endDate = leaseTermEnd(saved.startDate, months);
        }
        return saved;
      });
      setLetterErrors({});
      setBrokerErrors({});
      setLeaseErrors({});
      setRenewalErrors({});
      setExtraFields(
        Object.fromEntries(
          Object.keys((draftTemplate.dataSchema.properties ?? {}) as object)
            .filter(
              (key) => !standardFields.has(key) && latest.data[key] != null,
            )
            .map((key) => [key, String(latest.data[key])]),
        ),
      );
      setCancellingDraft(false);
      setCreationStep(0);
      setCreating(true);
      setChoosingType(false);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function cancelDraft() {
    if (!selected || busy || saving.current || !cancelReason.trim()) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const latest = await cancelAgentContractDraft(selected.id, cancelReason);
      setSelected(latest);
      setContracts((rows) =>
        rows.map((row) => (row.id === latest.id ? latest : row)),
      );
      setCancellingDraft(false);
      setCancelReason("");
      setNotice(cn.draftCancelled);
      onChanged?.();
    } catch (e) {
      setError(message(e));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function save(confirmed = false) {
    if (saving.current || busy) return;
    if (!template) {
      setError(cn.templateRequired);
      return;
    }
    const savedReservation = editingDraft?.data?.reservationLetter as
      ReservationLetterInput | undefined;
    const reservationLetter = reservation
      ? {
          ...letter,
          // Always derive the wording from the current amount when generating the PDF.
          reservationWords: "",
          documentNo: savedReservation?.documentNo ?? "",
          issueDate: reservationIssueDate(savedReservation?.issueDate),
        }
      : letter;
    if (reservation) {
      if (!leadId) {
        changeCreationStep(0);
        setError(cn.selectTenant);
        return;
      }
      const fieldErrors = reservationLetterFieldErrors(reservationLetter, tc.validation);
      if (Object.keys(fieldErrors).length) {
        changeCreationStep(
          Math.min(...Object.keys(fieldErrors).map(reservationFieldStep)),
        );
        setLetterErrors(fieldErrors);
        setError(cn.reservationRequired);
        return;
      }
      setLetterErrors({});
    } else if (broker) {
      if (!leadId) {
        setError(cn.selectTenant);
        return;
      }
      const fieldErrors = brokerAppointmentFieldErrors(brokerForm, tc.validation);
      if (Object.keys(fieldErrors).length) {
        setBrokerErrors(fieldErrors);
        setError(cn.brokerRequired);
        return;
      }
      setBrokerErrors({});
    } else if (lease) {
      if (!leadId) {
        changeCreationStep(0);
        setError(cn.selectTenant);
        return;
      }
      if (
        !renewing &&
        !editingDraft?.previousAgreementId &&
        !finalizedReservation(leadId)
      ) {
        changeCreationStep(0);
        setError(cn.leaseRequiresReservation);
        return;
      }
      const fieldErrors = leaseAgreementFieldErrors(leaseForm, tc.validation);
      if (Object.keys(fieldErrors).length) {
        changeCreationStep(Math.min(...Object.keys(fieldErrors).map(leaseAgreementFieldStep)));
        setLeaseErrors(fieldErrors);
        setError(cn.leaseRequired);
        return;
      }
      setLeaseErrors({});
    } else if (renewal) {
      if (!leadId || (!renewing && !editingDraft)) {
        setError(cn.selectTenant);
        return;
      }
      const fieldErrors = leaseRenewalFieldErrors(renewalForm, tc.validation);
      const expiry = renewalForm.originalExpiryDate.trim();
      const months = positiveMonths(renewalForm.renewMonths);
      if (isIsoDate(expiry)) {
        const nextStart = shiftIsoDate(expiry, 1);
        if (renewalForm.startDate.trim() !== nextStart)
          fieldErrors.startDate = tc.renewalForm.startsOnExpiry;
        if (months && renewalForm.endDate.trim() !== leaseTermEnd(nextStart, months))
          fieldErrors.endDate = tc.validation.termEndsBeforeAnniversary;
      }
      if (!months) fieldErrors.renewMonths = tc.validation.required;
      if (Object.keys(fieldErrors).length) {
        setRenewalErrors(fieldErrors);
        setError(cn.leaseRequired);
        return;
      }
      if (renewalCommissionValue(renewalCommission) == null) {
        setError(tc.renewalForm.commissionInvalid);
        return;
      }
      setRenewalErrors({});
    } else if (
      !leadId ||
      !form.startDate ||
      !form.endDate ||
      !form.monthlyRent.trim() ||
      !form.deposit.trim()
    ) {
      setError(cn.financialRequired);
      return;
    }
    if (
      customFields.some(
        ([key, field]) =>
          key !== "reservationLetter" &&
          key !== "brokerAppointment" &&
          key !== "leaseAgreement" &&
          key !== "leaseRenewal" &&
          !["string", "number", "integer", "boolean"].includes(
            field.type ?? "",
          ),
      )
    ) {
      setError(cn.unsupportedFields);
      return;
    }
    if (!confirmed) {
      setConfirmingSave(true);
      return;
    }
    setConfirmingSave(false);
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const extra = Object.fromEntries(
        customFields
          .filter(
            ([key]) =>
              key !== "reservationLetter" &&
              key !== "brokerAppointment" &&
              key !== "leaseAgreement" &&
              key !== "leaseRenewal" &&
              extraFields[key] != null &&
              extraFields[key] !== "",
          )
          .map(([key, field]) => [
            key,
            field.type === "number" || field.type === "integer"
              ? Number(extraFields[key])
              : field.type === "boolean"
                ? extraFields[key] === "true"
                : extraFields[key],
          ]),
      );
      const startDate = reservation
        ? reservationLetter.issueDate.trim()
        : broker
          ? brokerForm.issueDate.trim()
          : lease
            ? leaseForm.termFrom.trim()
            : renewal
              ? renewalForm.startDate.trim()
              : form.startDate.trim();
      const moveInDate = reservation
        ? (reservationLetter.termFrom || reservationLetter.issueDate).trim()
        : undefined;
      const reservationFee = reservation
        ? Number(String(letter.reservationPayment).replace(/,/g, ""))
        : undefined;
      const leaseRent = lease
        ? Number(String(leaseForm.monthlyRent).replace(/,/g, ""))
        : renewal
          ? Number(String(renewalForm.monthlyRent).replace(/,/g, ""))
          : Number(form.monthlyRent);
      const leaseDeposit = lease
        ? Number(String(leaseForm.depositAmount).replace(/,/g, ""))
        : renewal
          ? Number(String(renewalForm.depositCarried).replace(/,/g, ""))
          : Number(form.deposit);
      const persist = editingDraft ? (input: Parameters<typeof createAgentContract>[0]) => updateAgentContractDraft(editingDraft.id, input, editingDraft.data.draftRevision ?? null) : createAgentContract;
      const contract = await persist({
        leadId,
        startDate,
        ...(reservation
          ? { moveInDate, reservationFee }
          : broker
            ? {}
            : {
                endDate: lease
                  ? leaseForm.termTo.trim()
                  : renewal
                    ? renewalForm.endDate.trim()
                    : form.endDate.trim(),
                monthlyRent: leaseRent,
                deposit: leaseDeposit,
              }),
        agreementTypeCode: agreementType?.code,
        templateId: template.id,
        ...(renewing ? { previousAgreementId: renewing.id } : {}),
        data: {
          ...extra,
          ...(reservation ? { reservationLetter } : {}),
          ...(broker ? { brokerAppointment: brokerForm } : {}),
          ...(lease ? { leaseAgreement: leaseForm } : {}),
          ...(renewal ? { leaseRenewal: renewalForm, renewalCommission: renewalCommissionValue(renewalCommission) } : {}),
        },
        notes: form.notes,
      });
      listRequest.current++;
      setLoadingList(false);
      setListError("");
      setContracts((current) => [
        contract,
        ...current.filter((item) => item.id !== contract.id),
      ]);
      setCreating(false);
      setSelected(contract);
      setRenewing(null);
      setNotice(editingDraft ? cn.draftEdited : reservation ? cn.draftSavedWithInvoice : cn.draftSaved);
      setEditingDraft(null);
      onChanged?.();
      setLeadId(null);
      setLetter(emptyReservationLetterForm());
      setLetterErrors({});
      setBrokerForm(emptyBrokerAppointmentForm());
      setBrokerErrors({});
      setLeaseForm(emptyLeaseAgreementForm());
      setLeaseErrors({});
      setRenewalForm(emptyLeaseRenewalForm());
      setRenewalErrors({});
      setForm({
        startDate: "",
        endDate: "",
        moveInDate: "",
        monthlyRent: "",
        deposit: "",
        reservationFee: "",
        notes: "",
      });
    } catch (e) {
      setError(message(e));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const back = () => {
    setSelected(null);
    setEditingDraft(null);
    setCancellingDraft(false);
    setCancelReason("");
    setRenewing(null);
    setCreating(false);
    setFinancialKind(null);
    setMenuCreate(null);
    setFocusDocuments(false);
    setError("");
    setNotice("");
  };

  function reservationHosts() {
    return contracts.filter(
      (c) =>
        c.formKind === "reservation" &&
        c.reservationLetterStatus !== "ready" &&
        !["cancelled", "expired", "terminated"].includes(c.status),
    );
  }

  async function onCreateKind(kind: CreateDocumentKind, selectedSource?: AgentContract) {
    setError("");
    setNotice("");
    if (kind === "reservation" && tenant && !tenant.brokerAppointmentReady) {
      setError(docs.reservationNeedsBroker);
      return;
    }
    if (kind === "reservation" && noReadyReservationTenant) {
      setError(docs.reservationNoReadyTenant);
      return;
    }
    if (
      kind === "lease" &&
      !loadingList &&
      !finalizedReservation(tenant?.leadId ?? null)
    ) {
      setError(cn.leaseRequiresReservation);
      return;
    }
    if (
      kind === "reservation" ||
      kind === "lease" ||
      kind === "broker_appointment" ||
      kind === "renewal"
    ) {
      setBusy(true);
      try {
        const types = await listAgreementTypes();
        const type =
          kind === "renewal"
            ? types.find(
                (row) => row.formKind === "renewal" || row.code === "lease_renewal",
              )
            : types.find((row) => row.formKind === kind || row.code === kind);
        if (!type) throw new Error(cn.typeNotFound);
        const sources = kind === "renewal"
          ? renewalCandidates(contracts).filter((row) =>
              !renewalClosedMessage(contracts, tc.renewalForm, row.id))
          : [];
        const source = kind === "renewal" ? selectedSource ?? sources[0] ?? null : null;
        if (kind === "renewal") {
          const closed = renewalClosedMessage(contracts, tc.renewalForm, selectedSource?.id);
          if (closed) {
            setError(closed);
            return;
          }
        }
        setChoosingType(false);
        if (kind === "renewal" && !selectedSource && sources.length > 1) {
          setMenuCreate("renewal");
          return;
        }
        setMenuCreate(null);
        await beginContract(type, source);
      } catch (e) {
        setError(message(e));
      } finally {
        setBusy(false);
      }
      return;
    }
    setChoosingType(false);
    setMenuCreate(kind);
  }

  if (choosingType) {
    const locks: Array<[CreateDocumentKind, string]> = [
      // D1: inside a tenant, the API says whether this room + tenant has a valid broker appointment;
      // on the global screen, the lock waits for the tenant list and applies when no tenant has one.
      [
        "reservation",
        tenant
          ? !tenant.brokerAppointmentReady
            ? docs.reservationNeedsBroker
            : ""
          : noReadyReservationTenant
            ? docs.reservationNoReadyTenant
            : "",
      ],
      ["lease", !loadingList && !finalizedReservation(tenant?.leadId ?? null) ? cn.leaseRequiresReservation : ""],
      ["renewal", renewalClosedMessage(contracts, tc.renewalForm)],
    ];
    const locked = locks.filter(([, hint]) => !!hint);
    return (
      <ContractTypePicker
        message={error}
        disabledKinds={locked.map(([kind]) => kind)}
        disabledHint={locked.map(([, hint]) => hint).join("\n") || undefined}
        onBack={() => {
          setChoosingType(false);
          setError("");
        }}
        onSelect={(kind) => {
          void onCreateKind(kind);
        }}
      />
    );
  }
  if (menuCreate === "renewal")
    return (
      <View style={s.root}>
        {button(sc.backToTypes, () => {
          setMenuCreate(null);
          setChoosingType(true);
        })}
        <Text style={[s.subtitle, title]}>{sc.tenantAndRoom}</Text>
        {errorView}
        {renewalCandidates(contracts)
          .filter((row) => !renewalClosedMessage(contracts, tc.renewalForm, row.id))
          .map((row) => (
            <View key={row.id} style={[s.card, card]}>
              <Text style={[s.body, muted]}>{`${row.tenant} • ${row.property} ${row.room ?? ""}`}</Text>
              {button(fillTemplate(sc.renewFrom, { no: row.contractNo }), () => {
                void onCreateKind("renewal", row);
              })}
            </View>
          ))}
      </View>
    );
  if (menuCreate === "agent_commission")
    return (
      <CommissionConfirmationForm
        tenant={tenant}
        onBack={() => {
          setMenuCreate(null);
          setChoosingType(true);
        }}
        onCreated={(doc) => {
          setCommissions((rows) => [
            doc,
            ...rows.filter((row) => row.id !== doc.id),
          ]);
          setMenuCreate(null);
          setNotice(docs.commissionConfirmation.success);
          if (doc.pdfUrl)
            openDocumentPreview(
              docs.commissionConfirmation.title,
              doc.pdfUrl,
              "commission_confirmation",
            );
          onChanged?.();
        }}
      />
    );
  if (menuCreate === "invoice")
    return (
      <FinancialDocumentForm
        key={`menu:${menuCreate}`}
        kind={menuCreate}
        payer={tenantPayer}
        hosts={reservationHosts()}
        onBack={() => {
          setMenuCreate(null);
          setChoosingType(true);
        }}
        onStandaloneCreated={(invoice) => {
          setInvoices((rows) => [
            invoice,
            ...rows.filter((row) => row.id !== invoice.id),
          ]);
          setMenuCreate(null);
          setViewingInvoice(invoice);
          setNotice(docs.financial.success);
          onChanged?.();
        }}
        onCreated={(row) => {
          setSelected(row);
          setContracts((rows) =>
            rows.map((existing) => (existing.id === row.id ? row : existing)),
          );
          setMenuCreate(null);
          setFocusDocuments(true);
          setNotice(docs.financial.success);
          onChanged?.();
        }}
      />
    );
  if (creating)
    return (
      <View style={s.root} ref={creationAnchorRef} collapsable={false}>
        {button(
          renewing || editingDraft ? sc.backToOriginal : sc.backToTypes,
          () => {
            if (busy) return;
            setConfirmingSave(false);
            setCreating(false);
            if (!renewing && !editingDraft) setChoosingType(true);
            setEditingDraft(null);
            setRenewing(null);
            setError("");
          },
        )}
        <Text style={[s.heading, title]}>
          {fillTemplate(
            editingDraft ? sc.editDraftTitle : renewing ? sc.renewTitle : sc.createTitle,
            {
              type:
                (locale !== "th" &&
                  (reservation
                    ? tc.common.kinds.reservation
                    : broker
                      ? tc.common.kinds.broker_appointment
                      : lease
                        ? tc.common.kinds.lease
                        : null)) ||
                agreementType?.nameTh ||
                tc.common.kinds.lease,
            },
          )}
        </Text>
        <Text style={[s.body, muted]}>
          {editingDraft
            ? sc.editDraftHint
            : steppedCreation
              ? sc.stepHint
              : sc.pickHint}
        </Text>
        {steppedCreation && (
          <>
            <View style={{ flexDirection: "row" }}>
              {creationSteps.map((label, index) => (
                <View
                  key={label}
                  style={{ flex: 1, alignItems: "center", gap: 6 }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      width: "100%",
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        height: 2,
                        backgroundColor:
                          index === 0
                            ? "transparent"
                            : index <= creationStep
                              ? tokens.colors.brand[500]
                              : theme.border,
                      }}
                    />
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor:
                          index <= creationStep
                            ? tokens.colors.brand[500]
                            : theme.border,
                      }}
                    >
                      <Text
                        style={{
                          color:
                            index <= creationStep
                              ? tokens.colors.onBrand
                              : theme.textSecondary,
                          fontWeight: "600",
                        }}
                      >
                        {index < creationStep ? "✓" : index + 1}
                      </Text>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        height: 2,
                        backgroundColor:
                          index === creationSteps.length - 1
                            ? "transparent"
                            : index < creationStep
                              ? tokens.colors.brand[500]
                              : theme.border,
                      }}
                    />
                  </View>
                  <Text
                    style={{
                      color:
                        index === creationStep
                          ? theme.textHeading
                          : theme.textSecondary,
                      fontSize: 12,
                      lineHeight: 18,
                      textAlign: "center",
                    }}
                  >
                    {label}
                  </Text>
                </View>
              ))}
            </View>
            <Text
              accessibilityRole="header"
              style={[s.subtitle, title]}
            >{`0${creationStep + 1} ${creationSteps[creationStep]}`}</Text>
          </>
        )}
        {errorView}
        {busy && <ActivityIndicator color={accent} />}
        {renewing && (
          <Text style={[s.body, muted]}>
            {fillTemplate(sc.renewFrom, { no: renewing.contractNo })}
          </Text>
        )}
        {!template &&
          !busy &&
          button(sc.reloadTemplate, () => {
            if (agreementType) void beginContract(agreementType, renewing);
          })}
        {(!steppedCreation || creationStep === 0) && (
          <View style={[s.card, card]}>
            <Text style={[s.subtitle, title]}>{sc.tenantAndRoom}</Text>
            {candidates.map((c) => (
              <Pressable
                key={c.leadId}
                disabled={busy || !!editingDraft || (reservation && appointmentBlocked(c))}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: leadId === c.leadId,
                  disabled: busy || !!editingDraft || (reservation && appointmentBlocked(c)),
                }}
                onPress={() => {
                  setLeadId(c.leadId);
                  if (reservation) {
                    void getReservationDefaults(c.leadId)
                      .then((defaults) => {
                        setLetter(defaults);
                        setForm((current) => ({
                          ...current,
                          startDate: defaults.issueDate || current.startDate,
                          moveInDate: defaults.termFrom || current.moveInDate,
                          reservationFee:
                            defaults.reservationPayment ||
                            current.reservationFee,
                        }));
                      })
                      .catch(() => undefined);
                  }
                  if (broker) {
                    void getBrokerAppointmentLeadDefaults(c.leadId)
                      .then((defaults) => {
                        setBrokerForm(completeBrokerNames(defaults));
                        setForm((current) => ({
                          ...current,
                          startDate: defaults.issueDate || current.startDate,
                        }));
                      })
                      .catch(() => undefined);
                  }
                  if (lease) {
                    void getLeaseDefaults(c.leadId)
                      .then((defaults) => {
                        setLeaseForm(completeLeaseNames(defaults));
                        setForm((current) => ({
                          ...current,
                          startDate: defaults.termFrom || current.startDate,
                          endDate: defaults.termTo || current.endDate,
                          monthlyRent:
                            defaults.monthlyRent || current.monthlyRent,
                          deposit: defaults.depositAmount || current.deposit,
                        }));
                      })
                      .catch(() => undefined);
                  }
                }}
                style={[
                  s.facts,
                  {
                    borderWidth: 1,
                    borderColor: leadId === c.leadId ? accent : theme.border,
                  },
                ]}
              >
                <Text style={[s.body, title]}>
                  {leadId === c.leadId ? "● " : "○ "}
                  {c.tenant}
                </Text>
                <Text style={[s.small, muted]}>
                  {c.property}
                  {roomSuffix(c.room)}
                </Text>
                {reservation && !editingDraft && appointmentBlocked(c) && (
                  <Text style={[s.small, muted]}>{docs.candidateNeedsBroker}</Text>
                )}
              </Pressable>
            ))}
            {!busy && !candidates.length && (
              <Text style={[s.body, muted]}>
                {error
                  ? sc.tenantsLoadFailed
                  : sc.noTenants}
              </Text>
            )}
            {!renewing &&
              !editingDraft &&
              button(sc.reloadTenants, () => {
                void loadCandidates();
              })}
          </View>
        )}
        <View style={steppedCreation ? { gap: 16 } : [s.card, card]}>
          {!steppedCreation && (
            <Text style={[s.subtitle, title]}>
              {reservation
                ? sc.reservationDetails
                : broker
                  ? tc.broker.details
                : lease
                  ? sc.leaseDetails
                  : renewal
                    ? tc.renewalForm.title
                    : sc.rentalTerms}
            </Text>
          )}
          {reservation ? (
            <>
              <ReservationLetterFields
                lockedKeys={offerLocked ? OFFER_RESERVATION_LOCKED_KEYS : undefined}
                step={creationStep}
                onStepChange={changeCreationStep}
                value={letter}
                onChange={(next) => {
                  setLetter(next);
                  if (Object.keys(letterErrors).length)
                    setLetterErrors(reservationLetterFieldErrors(next, tc.validation));
                }}
                disabled={busy}
                errors={letterErrors}
              />
              {creationStep === 3 && (
                <View style={{ gap: 6, marginTop: 8 }}>
                  <Text style={[s.body, title]}>{sc.notes}</Text>
                  <MobileInput
                    value={form.notes}
                    onChangeText={(value) =>
                      setForm((current) => ({ ...current, notes: value }))
                    }
                    placeholder={sc.notesPlaceholder}
                  />
                </View>
              )}
            </>
          ) : broker ? (
            <>
              <BrokerAppointmentFields
                value={brokerForm}
                onChange={(next) => {
                  setBrokerForm(next);
                  if (Object.keys(brokerErrors).length)
                    setBrokerErrors(brokerAppointmentFieldErrors(next, tc.validation));
                }}
                disabled={busy}
                errors={brokerErrors}
              />
              <View style={{ gap: 6, marginTop: 8 }}>
                <Text style={[s.body, title]}>{sc.notes}</Text>
                <MobileInput
                  value={form.notes}
                  onChangeText={(value) =>
                    setForm((current) => ({ ...current, notes: value }))
                  }
                  placeholder={sc.notesPlaceholder}
                />
              </View>
            </>
          ) : renewal ? (
            <>
              {!!renewing && (
                <Text style={[s.body, muted]}>
                  {fillTemplate(tc.renewalForm.source, { no: renewing.contractNo })}
                </Text>
              )}
              <LeaseRenewalFields
                value={renewalForm}
                onChange={(next) => {
                  setRenewalForm(next);
                  if (Object.keys(renewalErrors).length)
                    setRenewalErrors(leaseRenewalFieldErrors(next, tc.validation));
                }}
                disabled={busy}
                errors={renewalErrors}
              />
              <MobileInput
                label={tc.renewalForm.commission}
                value={renewalCommission}
                onChangeText={setRenewalCommission}
                keyboardType="decimal-pad"
                maxLength={14}
                editable={!busy}
                required
              />
              <Text style={[s.small, muted]}>{tc.renewalForm.commissionHint}</Text>
            </>
          ) : lease ? (
            <>
              <LeaseAgreementFields
                lockedKeys={offerLocked ? OFFER_LEASE_LOCKED_KEYS : undefined}
                step={creationStep}
                onStepChange={changeCreationStep}
                value={leaseForm}
                onChange={(next) => {
                  setLeaseForm(next);
                  if (Object.keys(leaseErrors).length)
                    setLeaseErrors(leaseAgreementFieldErrors(next, tc.validation));
                }}
                disabled={busy}
                errors={leaseErrors}
              />
              {creationStep === 3 && (
                <View style={{ gap: 6, marginTop: 8 }}>
                  <Text style={[s.body, title]}>{sc.notes}</Text>
                  <MobileInput
                    value={form.notes}
                    onChangeText={(value) =>
                      setForm((current) => ({ ...current, notes: value }))
                    }
                    placeholder={sc.notesPlaceholder}
                  />
                </View>
              )}
            </>
          ) : (
            (
              [
                ["startDate", sc.startDate, "2026-10-01"],
                ["endDate", sc.endDate, "2027-09-30"],
                ["monthlyRent", sc.monthlyRentInput, "15000"],
                ["deposit", sc.depositInput, "30000"],
                ["notes", sc.notes, sc.notesPlaceholder],
              ] as Array<[keyof typeof form, string, string]>
            ).map(([key, label, placeholder]) => (
              <View key={key} style={{ gap: 6 }}>
                <Text style={[s.body, title]}>{label}</Text>
                <MobileInput
                  value={form[key]}
                  onChangeText={(value) =>
                    setForm((current) => ({ ...current, [key]: value }))
                  }
                  placeholder={placeholder}
                  keyboardType={
                    key === "monthlyRent" || key === "deposit"
                      ? "decimal-pad"
                      : "default"
                  }
                />
              </View>
            ))
          )}
          {(!steppedCreation || creationStep === 3) &&
            reservation && (
              <Text style={[s.body, muted]}>{sc.invoiceOnSave}</Text>
            )}
          {(!steppedCreation || creationStep === 3) &&
            customFields
              .filter(
                ([key]) =>
                  key !== "reservationLetter" &&
                  key !== "brokerAppointment" &&
                  key !== "leaseAgreement" &&
                  key !== "leaseRenewal",
              )
              .map(([key, field]) => (
                <View key={key} style={{ gap: 6 }}>
                  <Text style={[s.body, title]}>
                    {field.title || key}
                    {(
                      (template?.dataSchema.required ?? []) as string[]
                    ).includes(key)
                      ? " *"
                      : ""}
                  </Text>
                  {field.enum || field.type === "boolean" ? (
                    (field.enum ?? [true, false]).map((option) =>
                      button(
                        `${extraFields[key] === String(option) ? "● " : "○ "}${option === true ? sc.yes : option === false ? sc.no : String(option)}`,
                        () =>
                          setExtraFields((current) => ({
                            ...current,
                            [key]:
                              current[key] === String(option)
                                ? ""
                                : String(option),
                          })),
                        false,
                        `${key}-${String(option)}`,
                      ),
                    )
                  ) : (
                    <MobileInput
                      value={extraFields[key] ?? ""}
                      onChangeText={(value) =>
                        setExtraFields((current) => ({
                          ...current,
                          [key]: value,
                        }))
                      }
                      keyboardType={
                        field.type === "number" || field.type === "integer"
                          ? "decimal-pad"
                          : "default"
                      }
                    />
                  )}
                </View>
              ))}
          {steppedCreation && (
            <View style={{ flexDirection: "row", gap: 12, paddingVertical: 8 }}>
              {creationStep > 0 && (
                <View style={{ flex: 1 }}>
                  {button(sc.previousStep, () => {
                    setError("");
                    changeCreationStep(creationStep - 1);
                  })}
                </View>
              )}
              {creationStep < 3 && (
                <View style={{ flex: 2 }}>
                  {button(
                    fillTemplate(sc.nextStep, { step: creationSteps[creationStep + 1] }),
                    nextCreationStep,
                    true,
                  )}
                </View>
              )}
            </View>
          )}
          {(!steppedCreation || creationStep === 3) &&
            button(
              busy ? sc.working : sc.saveDraft,
              () => {
                void save();
              },
              true,
            )}
          {(!steppedCreation || creationStep === 3) && (
            <Text style={[s.small, muted]}>
              {sc.saveDraftHint}
            </Text>
          )}
        </View>
        <MobileBottomSheet
          visible={confirmingSave}
          onClose={() => {
            if (!busy) setConfirmingSave(false);
          }}
        >
          <View style={s.saveConfirm}>
            <Text style={[s.subtitle, title]}>
              บันทึก{agreementType?.nameTh || "สัญญา"}นี้?
            </Text>
            <Text style={[s.body, muted]}>
              {editingDraft
                ? "หลังบันทึก การแก้ไขจะแทนที่ฉบับร่างเดิม และคู่สัญญาที่มีบัญชีจะเห็นข้อมูลล่าสุด"
                : reservation
                  ? "บันทึกเป็นฉบับร่างและสร้างใบแจ้งหนี้ค่าจอง คู่สัญญาที่มีบัญชีจะเห็นสัญญานี้ทันที"
                  : "บันทึกเป็นฉบับร่าง คู่สัญญาที่มีบัญชีจะเห็นสัญญานี้ทันที"}
            </Text>
            <View style={s.saveConfirmActions}>
              <MobileButton
                style={s.saveConfirmButton}
                variant="outline"
                disabled={busy}
                onPress={() => setConfirmingSave(false)}
              >
                ยกเลิก
              </MobileButton>
              <MobileButton
                style={s.saveConfirmButton}
                disabled={busy}
                isLoading={busy}
                onPress={() => {
                  void save(true);
                }}
              >
                บันทึกฉบับร่าง
              </MobileButton>
            </View>
          </View>
        </MobileBottomSheet>
      </View>
    );
  if (selected && payingDeposit && selected.depositPayment?.invoiceId != null)
    return <FinancialDocumentForm key={`deposit:${selected.depositPayment.invoiceId}`} kind="receipt"
      fixedInvoiceId={selected.depositPayment.invoiceId} slipOnFile={!!selected.depositPayment.submittedAt} payer={tenantPayer}
      landlordReceipt="deposit"
      onBack={() => setPayingDeposit(false)}
      onStandaloneCreated={() => {
        setPayingDeposit(false);
        setNotice(docs.financial.success);
        void getAgentContract(selected.id)
          .then((row) => {
            setSelected(row);
            setContracts((rows) => rows.map((existing) => existing.id === row.id ? row : existing));
          })
          .catch((e) => setError(message(e)));
        onChanged?.();
      }}
      onCreated={() => undefined} />;
  if (selected && financialKind && !draftCancelled && !["expired", "terminated"].includes(selected.status))
    return <FinancialDocumentForm key={`${selected.id}:${financialKind}`} contractId={selected.id} kind={financialKind} payer={tenantPayer}
      landlordReceipt={financialKind === "receipt" && selected.formKind === "reservation" ? "reservation" : undefined}
      onBack={() => setFinancialKind(null)}
      onStandaloneCreated={(invoice) => {
        setInvoices((rows) => [
          invoice,
          ...rows.filter((row) => row.id !== invoice.id),
        ]);
        setFinancialKind(null);
        setNotice(docs.financial.success);
        onChanged?.();
      }}
      onCreated={row => {
        setSelected(row);
        setContracts(rows => rows.map(existing => existing.id === row.id ? row : existing));
        setFinancialKind(null);
        setFocusDocuments(true);
        setNotice(docs.financial.success);
        onChanged?.();
      }} />;
  if (selected)
    return (
      <View style={s.root}>
        {button(sc.backToContracts, back)}
        {errorView}
        {!!notice && (
          <Text accessibilityRole="alert" style={[s.body, { color: accent }]}>
            {notice}
          </Text>
        )}
        <View style={[s.card, card]}>
          <Text style={[s.eyebrow, { color: accent }]}>E-CONTRACT</Text>
          <Text style={[s.heading, title]}>{selected.property}</Text>
          <Text style={[s.body, muted]}>
            {fillTemplate(tc.common.contractNo, { no: selected.contractNo })}
          </Text>
          <Text style={[s.body, muted]}>
            {selected.tenant}
            {roomSuffix(selected.room)}
          </Text>
          <Text style={[s.body, { color: color(selected.status) }]}>
            {labels[selected.status]}
          </Text>
          <View style={[s.divider, { borderColor: theme.border }]} />
          <Text style={[s.small, muted]}>
            {typeLabel(selected)} ·{" "}
            {selected.formKind === "reservation"
              ? sc.reservationFee
              : selected.formKind === "broker_appointment"
                ? tc.common.kinds.broker_appointment
                : sc.monthlyRent}
          </Text>
          <Text style={[s.heading, title]}>
            {selected.formKind === "broker_appointment"
              ? selected.contractNo
              : money(
                  selected.formKind === "reservation"
                    ? selected.reservationFee
                    : selected.monthlyRent,
                )}
          </Text>
          {(selected.formKind === "lease" || selected.formKind === "renewal") && (
            <Text style={[s.body, muted]}>
              {fillTemplate(sc.deposit, { amount: money(selected.deposit) })}
            </Text>
          )}
          <Text style={[s.body, muted]}>
            {selected.formKind === "reservation"
              ? fillTemplate(tc.common.bookingAndMoveIn, { booking: date(selected.bookingDate), moveIn: date(selected.moveInDate) })
              : selected.formKind === "broker_appointment"
                ? fillTemplate(tc.common.dated, { date: date(selected.startDate) })
                : `${date(selected.startDate)} – ${date(selected.endDate)}`}
          </Text>
          {!!selected.notes && (
            <Text style={[s.body, muted]}>{selected.notes}</Text>
          )}
          {selected.formKind === "renewal" && selected.data.renewalCommission != null && (
            <Text style={[s.body, muted]}>
              {fillTemplate(tc.renewalForm.commissionShown, { amount: money(Number(selected.data.renewalCommission)) })}
            </Text>
          )}
        </View>
        {((selected.status === "draft" && !selected.ownerSignedAt && !selected.tenantSignedAt && !selected.agentSignedAt && !documentLocked && !selected.receiptUrl && selected.reservationPayment?.status !== "submitted")
          // AC-8.2: a renewal partly signed can still be cancelled.
          || (canCancelRenewal(selected) && !documentLocked)) && (
          <View style={[s.card, card]}>
            {selected.status === "draft" && !selected.ownerSignedAt && !selected.tenantSignedAt && !selected.agentSignedAt
              && button(sc.editDraft, () => { void editDraft(selected); })}
            {/* D5: a booking letter is cancelled with its deal (who caused it, evidence), below. */}
            {selected.formKind !== "reservation" && button(sc.cancelDraft, () => { setCancellingDraft(true); setCancelReason(""); setError(""); })}
            {cancellingDraft && <>
              <Text style={[s.body, title]}>{fillTemplate(sc.confirmCancel, { no: selected.contractNo })}</Text>
              <Text style={[s.small, muted]}>{sc.cancelHint}</Text>
              <MobileInput label={sc.cancelReason} value={cancelReason} onChangeText={setCancelReason} editable={!busy} maxLength={1000}
                placeholder={sc.cancelReason} accessibilityLabel={sc.cancelReasonA11y} multiline />
              <MobileButton disabled={busy || !cancelReason.trim()} onPress={() => { void cancelDraft(); }}>{sc.confirmCancelDraft}</MobileButton>
              {button(sc.keepDraft, () => { setCancellingDraft(false); setCancelReason(""); })}
            </>}
          </View>
        )}
        {selected.status === "cancelled" && !!selected.data.draftCancellation && (
          <Text style={[s.body, muted]}>{fillTemplate(sc.cancelledReason, { reason: String((selected.data.draftCancellation as { reason?: string }).reason ?? "") })}</Text>
        )}
        {(!!selected.cancellation || canCancelDeal(selected)) && (
          // D5 (AC-C.1 to C.4): cancel the deal before the handover; once cancelled, the money and the refund.
          <View style={[s.card, card]}>
            <DealCancellationCard
              key={selected.id}
              contract={selected}
              busy={busy}
              today={bangkokToday()}
              loadPreview={() => getDealCancellationPreview(selected.id)}
              onOpen={(url, label) => openDocumentPreview(label, url, "payment_slip")}
              onCancel={(input, evidence) => saveDealChange(() => cancelDeal(selected.id, input, evidence), tc.dealCancel.done)}
              onRecordRefund={(refundedOn, proof: PickedFile) => saveDealChange(() => recordDealRefund(selected.id, refundedOn, proof), tc.dealCancel.refundDone)}
            />
          </View>
        )}
        {(!!selected.previousAgreementId ||
          (selected.formKind === "lease" &&
            ["active", "expired"].includes(selected.status))) && (
        <View style={[s.card, card]}>
          {!!selected.previousAgreementId && (
            <Text style={[s.body, muted]}>
              {fillTemplate(sc.renewalOf, {
                previous: selected.previousAgreementId,
                root: selected.rootAgreementId ?? "",
              })}
            </Text>
          )}
          {(selected.formKind === "lease" || selected.formKind === "renewal") &&
            ["active", "expired"].includes(selected.status) &&
            renewalCandidates(contracts).some((row) => row.id === selected.id) &&
            button(sc.renew, () => {
              void (async () => {
                setBusy(true);
                setError("");
                try {
                  const types = await listAgreementTypes();
                  const type = types.find(
                    (row) =>
                      row.formKind === "renewal" || row.code === "lease_renewal",
                  );
                  if (!type) throw new Error(cn.typeNotFound);
                  const closed = renewalClosedMessage(contracts, tc.renewalForm, selected.id);
                  if (closed) {
                    setError(closed);
                    return;
                  }
                  await beginContract(type, selected);
                } catch (e) {
                  setError(message(e));
                } finally {
                  setBusy(false);
                }
              })();
            })}

        </View>
        )}
        {canCloseContract(selected) && (
          <ContractCloseCard
            key={selected.id}
            contract={selected}
            disabled={busy}
            onClosed={(result) => {
              setSelected(result.contract);
              setContracts((rows) =>
                rows.map((row) => (row.id === result.contract.id ? result.contract : row)),
              );
              setNotice(closeResultNotice(result, docs.closeContract));
              onChanged?.();
            }}
          />
        )}
        {(selected.formKind === "reservation" ||
          selected.formKind === "lease" ||
          selected.formKind === "renewal" ||
          selected.formKind === "broker_appointment") && (
          <View ref={documentsAnchorRef} collapsable={false} style={[s.card, card]}>
            <Text style={[s.subtitle, title]}>
              {selected.formKind === "renewal"
                ? tc.renewalForm.title
                : selected.formKind === "lease"
                ? docs.leaseDocuments
                : docs.documents}
            </Text>
            {selected.formKind === "lease" && (
              <Text style={[s.small, muted]}>{docs.leaseDocumentHint}</Text>
            )}
            {documentSlots(selected).map((slot) => {
              if (slot.kind === "reservation_letter") {
                const complete =
                  selected.reservationLetterStatus === "ready_to_generate" ||
                  selected.reservationLetterStatus === "ready";
                const generated = selected.reservationLetterStatus === "ready";
                return (
                  <View key={slot.kind} style={[s.documentItem, { borderColor: theme.border }]}>
                    <View style={s.documentHead}>
                      <View style={[s.documentStatus, { borderColor: generated ? "#198460" : theme.textSecondary, backgroundColor: generated ? "#19846018" : theme.background }]}>
                        <Text style={[s.body, { color: generated ? "#198460" : theme.textSecondary }]}>{generated ? "✓" : "○"}</Text>
                      </View>
                      <Text style={[s.documentTitle, title]}>{slot.name}</Text>
                    </View>
                    {generated && <Text style={[s.body, title]}>{`reservation-${selected.contractNo}.pdf`}</Text>}
                    <MobileButton
                      variant="outline"
                      disabled={busy}
                      isLoading={pdfAction === "preview"}
                      onPress={() => void openReservation(false)}
                    >
                      {sc.viewReservation}
                    </MobileButton>
                    <Text style={[s.small, muted]}>
                      {generated
                        ? sc.lockedAllThree
                        : complete
                          ? sc.allSigned
                          : sc.previewReservation}
                    </Text>
                  </View>
                );
              }
              if (slot.kind === "broker_appointment") {
                const complete =
                  selected.brokerAppointmentStatus === "ready_to_generate" ||
                  selected.brokerAppointmentStatus === "ready";
                const generated = selected.brokerAppointmentStatus === "ready";
                return (
                  <View key={slot.kind} style={[s.documentItem, { borderColor: theme.border }]}>
                    <View style={s.documentHead}>
                      <View style={[s.documentStatus, { borderColor: generated ? "#198460" : theme.textSecondary, backgroundColor: generated ? "#19846018" : theme.background }]}>
                        <Text style={[s.body, { color: generated ? "#198460" : theme.textSecondary }]}>{generated ? "✓" : "○"}</Text>
                      </View>
                      <Text style={[s.documentTitle, title]}>{slot.name}</Text>
                    </View>
                    {generated && (
                      <Text style={[s.body, title]}>
                        {`broker-${selected.contractNo}.pdf`}
                      </Text>
                    )}
                    <MobileButton
                      variant="outline"
                      disabled={busy}
                      isLoading={pdfAction === "preview"}
                      onPress={() => void openBrokerAppointment(false)}
                    >
                      {sc.viewBroker}
                    </MobileButton>
                    <Text style={[s.small, muted]}>
                      {generated
                        ? sc.lockedSigned
                        : complete
                          ? sc.allSigned
                          : sc.previewBroker}
                    </Text>
                  </View>
                );
              }
              if (slot.kind === "lease_agreement") {
                if (
                  selected.leaseAgreementStatus != null ||
                  selected.data?.leaseAgreement != null ||
                  selected.data?.leaseRenewal != null
                ) {
                  const complete =
                    selected.leaseAgreementStatus === "ready_to_generate" ||
                    selected.leaseAgreementStatus === "ready";
                  const generated = selected.leaseAgreementStatus === "ready";
                  return (
                    <View
                      key={slot.kind}
                      style={[s.documentItem, { borderColor: theme.border }]}
                    >
                      <View style={s.documentHead}>
                        <View
                          style={[
                            s.documentStatus,
                            {
                              borderColor: generated
                                ? "#198460"
                                : theme.textSecondary,
                              backgroundColor: generated
                                ? "#19846018"
                                : theme.background,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              s.body,
                              {
                                color: generated
                                  ? "#198460"
                                  : theme.textSecondary,
                              },
                            ]}
                          >
                            {generated ? "✓" : "○"}
                          </Text>
                        </View>
                        <Text style={[s.documentTitle, title]}>{slot.name}</Text>
                      </View>
                      {generated && (
                        <Text style={[s.body, title]}>
                          {`lease-${selected.contractNo}.pdf`}
                        </Text>
                      )}
                      <MobileButton
                        variant="outline"
                        disabled={busy}
                        isLoading={pdfAction === "preview"}
                        onPress={() => void openLeaseAgreement(false)}
                      >
                        {selected.formKind === "renewal"
                          ? tc.renewalForm.view
                          : sc.viewLease}
                      </MobileButton>
                      <Text style={[s.small, muted]}>
                        {generated
                          ? sc.lockedSigned
                          : complete
                            ? sc.allSigned
                            : selected.formKind === "renewal"
                              ? tc.renewalForm.preview
                              : sc.previewLease}
                      </Text>
                    </View>
                  );
                }
              }
              const hasFile = !!slot.url;
              const storedNames = selected.data.documentFileNames as Record<string, string> | undefined;
              const extension = slot.url?.split(/[?#]/)[0]?.match(/\.(pdf|jpe?g|png)$/i)?.[0] ?? "";
              const originalName = storedNames?.[slot.kind];
              const fileName = typeof originalName === "string" && originalName.trim()
                ? originalName
                : `${slot.name}${extension}`;
              const statusColor = hasFile ? "#198460" : theme.textSecondary;
              return (
                <View key={slot.kind} style={[s.documentItem, { borderColor: theme.border }]}>
                  <View style={s.documentHead}>
                    <View style={[s.documentStatus, { borderColor: statusColor, backgroundColor: `${statusColor}18` }]}>
                      <Text style={[s.body, { color: statusColor }]}>{hasFile ? "✓" : "○"}</Text>
                    </View>
                    <Text style={[s.documentTitle, title]}>{slot.name}</Text>
                  </View>
                  {hasFile && slot.url ? (
                    <>
                      <View style={[s.documentFile, { backgroundColor: theme.background }]}>
                        <Text style={[s.body, title]} numberOfLines={2}>{fileName}</Text>
                      </View>
                      <MobileButton
                        variant="outline"
                        disabled={busy}
                        onPress={() =>
                          openDocumentPreview(fileName, slot.url!, slot.kind)
                        }
                      >
                        {tc.common.view}
                      </MobileButton>
                    </>
                  ) : documentLocked ? (
                    <Text style={[s.small, muted]}>
                      {tc.common.notAttached}
                    </Text>
                  ) : (
                    <>
                      <Text style={[s.small, muted]}>
                        {tc.common.notAttached}
                      </Text>
                      <MobileButton
                        disabled={busy}
                        isLoading={uploadingKind === slot.kind}
                        onPress={() => setPickKind(slot.kind)}
                      >
                        {tc.common.attach}
                      </MobileButton>
                    </>
                  )}
                </View>
              );
            })}
          </View>
        )}
        {(selected.formKind === "reservation" || selected.formKind === "lease") && selected.rentRoomId != null &&
          !["cancelled", "expired", "terminated"].includes(selected.status) && (
          // D2 round 2 (AC-2.4): the deal's confirmed offer. Changing it updates the documents nobody signed, so the
          // contract is read again; an old deal with no offer shows nothing.
          <DealOfferSection
            key={`offer:${selected.leadId}:${selected.rentRoomId}`}
            mode="deal"
            leadId={selected.leadId}
            roomId={selected.rentRoomId}
            disabled={busy}
            onRevised={() => {
              const id = selected.id;
              void getAgentContract(id)
                .then((row) => {
                  setSelected((current) => (current?.id === id ? row : current));
                  setContracts((rows) => rows.map((existing) => (existing.id === row.id ? row : existing)));
                })
                .catch((e) => setError(message(e)));
              onChanged?.();
            }}
          />
        )}
        {/* D13 + D3: the commission confirmation signed with the letter, and the 3-day signing due day. */}
        <ReservationTerms
          contract={selected}
          today={bangkokToday()}
          onOpenCommission={(url) => openDocumentPreview(tc.reservationTerms.openCommission, url, "commission_confirmation")}
        />
        {selected.formKind === "reservation" && (
          <ReservationPaymentCard
            contract={selected}
            busy={busy}
            onOpen={(kind) => {
              const url = kind === "invoice" ? selected.invoiceUrl : kind === "receipt" ? selected.receiptUrl : selected.reservationPayment?.paymentSlipUrl;
              if (url) openDocumentPreview(kind === "invoice" ? tc.common.paymentDocuments.invoice : kind === "receipt" ? tc.common.paymentDocuments.receipt : tc.common.paymentDocuments.paymentSlip, url, kind === "payment-slip" ? "payment_slip" : kind);
            }}
            onIssueReceipt={() => { setError(""); setFinancialKind("receipt"); }}
            onCreateInvoice={() => void createBookingInvoice()}
            onReturnSlip={(reason) => returnSlip("reservation", reason)}
          />
        )}
        {selected.formKind === "lease" && (
          <DepositPaymentCard
            contract={selected}
            busy={busy}
            onOpen={(kind) => {
              const deposit = selected.depositPayment;
              const url = kind === "deposit-invoice" ? deposit?.invoiceUrl : kind === "deposit-receipt" ? deposit?.receiptUrl : deposit?.paymentSlipUrl;
              if (url) openDocumentPreview(kind === "deposit-invoice" ? tc.common.paymentDocuments.invoice : kind === "deposit-receipt" ? tc.common.paymentDocuments.receipt : tc.common.paymentDocuments.paymentSlip, url, kind === "deposit-payment-slip" ? "payment_slip" : kind === "deposit-invoice" ? "invoice" : "receipt");
            }}
            onIssueReceipt={() => { setError(""); setPayingDeposit(true); }}
            onIssueInvoice={() => void issueDepositInvoice()}
            onReturnSlip={(reason) => returnSlip("deposit", reason)}
          />
        )}
        {selected.formKind === "lease" && (
          // D4 (AC-5.5): the handover day (the agent is reminded if the deposit is not paid by then), moved with a reason.
          <HandoverDueControl
            contract={selected}
            busy={busy}
            onMove={async (date, reason) => {
              if (busy) return false;
              setBusy(true);
              setError("");
              try {
                const updated = await moveHandoverDue(selected.id, date, reason);
                setSelected(updated);
                setContracts((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
                setNotice(tc.handoverDue.done);
                onChanged?.();
                return true;
              } catch (e) {
                setError(message(e));
                return false;
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
        {selected.formKind === "lease" && (
          // D6: the room is handed over after the deposit receipt (annex 1 items, annex 2 photos, 2 signatures).
          <HandoverCard
            key={`handover:${selected.id}`}
            contractId={selected.id}
            mode="agent"
            defaultDate={selected.startDate}
            refreshKey={`${selected.status}:${selected.leaseAgreementStatus}:${selected.depositPayment?.status ?? ""}`}
          />
        )}
        {(selected.formKind === "lease" || selected.formKind === "renewal") && (
          <HandoverCard
            key={`move-out:${selected.id}`}
            contractId={selected.id}
            mode="agent"
            kind="move_out"
            defaultDate={selected.endDate ?? undefined}
            refreshKey={`${selected.status}:${selected.endDate ?? ""}`}
          />
        )}
        {(selected.formKind === "lease" || selected.formKind === "renewal") && (
          <DepositSettlementCard key={`deposit:${selected.id}`} contractId={selected.id} mode="agent" />
        )}
        {(selected.formKind === "reservation" ||
          selected.formKind === "lease") && (
          <AgreementAttachments
            key={selected.id}
            contractId={selected.id}
            formKind={selected.formKind}
            onReadinessChange={setAttachmentReadiness}
            refreshKey={`${selected.status}:${selected.ownerSignedAt}:${selected.tenantSignedAt}:${selected.agentSignedAt}:${selected.reservationLetterStatus}:${selected.leaseAgreementStatus}:${attachmentsNonce}`}
          />
        )}
        <View style={[s.card, card]}>
          <Text style={[s.subtitle, title]}>{docs.signatories}</Text>
          {attachmentsRequired && !attachmentsReady ? (
            <Text style={[s.small, muted]}>
              {sc.attachBeforeSigning}
            </Text>
          ) : null}
          {attachmentReadiness?.contractId === selected.id && partyMeta(selected).some((party) => !party.signed) ? (
            <RejectedAttachmentsNotice items={attachmentReadiness.rejected} />
          ) : null}
          {partyMeta(selected).map((party) => (
            <View key={party.key} style={s.signRow}>
              <View style={s.sourceCopy}>
                <Text style={[s.body, title]}>{party.label}</Text>
                <Text style={[s.small, muted]}>
                  {party.signed
                    ? `✓ ${new Date(party.signed).toLocaleString("th-TH")}`
                    : docs.unsigned}
                </Text>
                {!!party.signed && !!signatureChannelText(signatureLog, party.key, docs) && (
                  <Text style={[s.small, muted]}>{signatureChannelText(signatureLog, party.key, docs)}</Text>
                )}
                {!party.signed && bookingPaymentBlocksSigning(selected, party.key) && (
                  <Text style={[s.small, muted]}>{t.mobile.partyContracts.bookingPaymentBeforeSigning}</Text>
                )}
                {!party.signed &&
                  (party.key === "owner" || party.key === "tenant") &&
                  !!partyDeliveredAt(selected, party.key) && (
                    <Text style={[s.small, muted]}>{docs.shareSignDelivered}</Text>
                  )}
              </View>
              {party.signed && party.signatureUrl ? (
                <MobileButton
                  variant="outline"
                  style={s.signatureButton}
                  disabled={busy}
                  onPress={() =>
                    setViewSignature({
                      label: party.label,
                      url: party.signatureUrl!,
                    })
                  }
                >
                  {docs.viewSignature}
                </MobileButton>
              ) : null}
              {!party.signed &&
              !signingLocked(selected.status) &&
              !documentLocked ? (
                <View style={s.partyActions}>
                  {(party.key === "owner" || party.key === "tenant") && (
                    <MobileButton
                      variant="outline"
                      style={s.shareButton}
                      disabled={
                        busy ||
                        !attachmentsReady ||
                        !!partyDeliveredAt(selected, party.key)
                      }
                      onPress={() => confirmShare(party.key === "owner" ? "owner" : "tenant")}
                    >
                      {partyDeliveredAt(selected, party.key)
                        ? docs.shareSignSent
                        : docs.shareSign}
                    </MobileButton>
                  )}
                  <MobileButton
                    style={s.signatureButton}
                    disabled={busy || !attachmentsReady || bookingPaymentBlocksSigning(selected, party.key)}
                    onPress={() => openSignSheet([party.key])}
                  >
                    {docs.signFor}
                  </MobileButton>
                </View>
              ) : null}
            </View>
          ))}
          {selected.formKind === "lease" && (
            <View style={s.signRow}>
              <View style={s.sourceCopy}>
                <Text style={[s.body, title]}>{docs.witness}</Text>
                <Text style={[s.small, muted]}>
                  {witnessEntry
                    ? `✓ ${new Date(witnessEntry.signedAt).toLocaleString("th-TH")}`
                    : docs.unsigned}
                </Text>
                {!!witnessEntry && (
                  <Text style={[s.small, muted]}>{signatureChannelText(signatureLog, "witness", docs)}</Text>
                )}
                {!witnessEntry && <Text style={[s.small, muted]}>{docs.witnessHint}</Text>}
              </View>
              {!witnessEntry && signatureLog != null && !signingLocked(selected.status) && !documentLocked ? (
                <View style={s.partyActions}>
                  <MobileButton
                    variant="outline"
                    style={s.shareButton}
                    disabled={busy}
                    onPress={() => openWitnessSheet(false)}
                  >
                    {docs.witnessOther}
                  </MobileButton>
                  <MobileButton
                    style={s.signatureButton}
                    disabled={busy}
                    onPress={() => openWitnessSheet(true)}
                  >
                    {docs.witnessAsAgent}
                  </MobileButton>
                </View>
              ) : null}
            </View>
          )}
        </View>
        {selected.formKind === "reservation" && (
          <View style={[s.card, card]}>
            {selected.reservationLetterStatus === "ready" ? (
              <>
                <Text style={[s.small, muted]}>
                  {sc.reservationGenerated}
                </Text>
                <MobileButton
                  disabled={busy}
                  isLoading={pdfAction === "preview"}
                  onPress={() => void openReservation(false)}
                >
                  {sc.viewFinal}
                </MobileButton>
              </>
            ) : (
              <>
                <Text style={[s.small, muted]}>
                  {sc.reservationGenerateHint}
                </Text>
                <MobileButton
                  disabled={
                    busy ||
                    selected.reservationLetterStatus !== "ready_to_generate" ||
                    attachmentReadiness?.contractId !== selected.id ||
                    !attachmentReadiness.ready
                  }
                  isLoading={pdfAction === "generate"}
                  onPress={() => void openReservation(true)}
                >
                  {sc.confirmGenerate}
                </MobileButton>
              </>
            )}
          </View>
        )}
        {selected.formKind === "broker_appointment" && (
          <View style={[s.card, card]}>
            {selected.brokerAppointmentStatus === "ready" ? (
              <>
                <Text style={[s.small, muted]}>
                  {sc.brokerGenerated}
                </Text>
                <MobileButton
                  disabled={busy}
                  isLoading={pdfAction === "preview"}
                  onPress={() => void openBrokerAppointment(false)}
                >
                  {sc.viewFinal}
                </MobileButton>
              </>
            ) : (
              <>
                <Text style={[s.small, muted]}>
                  {sc.brokerGenerateHint}
                </Text>
                <MobileButton
                  disabled={
                    busy ||
                    selected.brokerAppointmentStatus !== "ready_to_generate"
                  }
                  isLoading={pdfAction === "generate"}
                  onPress={() => void openBrokerAppointment(true)}
                >
                  {sc.confirmGenerate}
                </MobileButton>
              </>
            )}
          </View>
        )}
        {(selected.formKind === "lease" || selected.formKind === "renewal") &&
          selected.leaseAgreementStatus != null && (
          <View style={[s.card, card]}>
            {selected.leaseAgreementStatus === "ready" ? (
              <>
                <Text style={[s.small, muted]}>
                  {selected.formKind === "renewal"
                    ? tc.renewalForm.generated
                    : sc.leaseGenerated}
                </Text>
                <MobileButton
                  disabled={busy}
                  isLoading={pdfAction === "preview"}
                  onPress={() => void openLeaseAgreement(false)}
                >
                  {sc.viewFinal}
                </MobileButton>
              </>
            ) : (
              <>
                <Text style={[s.small, muted]}>
                  {selected.formKind === "renewal"
                    ? tc.renewalForm.preview
                    : sc.leaseGenerateHint}
                </Text>
                {selected.formKind === "lease" && leaseNeedsWitness && (
                  <Text style={[s.small, muted]}>{docs.witnessRequired}</Text>
                )}
                <MobileButton
                  disabled={
                    busy ||
                    selected.leaseAgreementStatus !== "ready_to_generate" ||
                    !attachmentsReady ||
                    (selected.formKind === "lease" && leaseNeedsWitness)
                  }
                  isLoading={pdfAction === "generate"}
                  onPress={() => void openLeaseAgreement(true)}
                >
                  {sc.confirmGenerate}
                </MobileButton>
              </>
            )}
          </View>
        )}
        <Modal
          visible={previewDoc != null}
          onRequestClose={() => setPreviewDoc(null)}
          animationType="slide"
          presentationStyle="fullScreen"
        >
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <SafeAreaView
              style={{ flex: 1, backgroundColor: theme.background }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 16,
                  gap: 12,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tc.common.closeDocument}
                  onPress={() => setPreviewDoc(null)}
                  style={{ padding: 8 }}
                >
                  <Text style={title}>{tc.common.close}</Text>
                </Pressable>
                <Text style={[s.sheetTitle, title]}>
                  {previewDoc
                    ? docs.previewTitle.replace("{name}", previewDoc.name)
                    : docs.preview}
                </Text>
              </View>
              {previewDoc ? (
                <ContractDocumentPreview
                  key={previewDoc.url}
                  url={previewDoc.url}
                />
              ) : null}
              {previewDoc ? (
                <View style={[s.previewActions, { padding: 12 }]}>
                  {previewDoc.kind === "receipt" && !selected.receiptUrl &&
                    !draftCancelled && (
                      <MobileButton
                        disabled={busy}
                        onPress={() => {
                          const kind = previewDoc.kind as "invoice" | "receipt";
                          setPreviewDoc(null);
                          setFinancialKind(kind);
                        }}
                      >
                        {docs.financial.edit}
                      </MobileButton>
                    )}
                  <MobileButton
                    variant="outline"
                    disabled={busy}
                    onPress={() => {
                      void openDocumentExternally(previewDoc.url);
                    }}
                  >
                    {docs.openExternally}
                  </MobileButton>
                </View>
              ) : null}
            </SafeAreaView>
          </SafeAreaProvider>
        </Modal>
        <MobileBottomSheet
          visible={viewSignature != null}
          onClose={() => setViewSignature(null)}
          maxHeight={480}
          sheetStyle={s.sheetPanel}
        >
          <Text style={[s.sheetTitle, title]}>
            {viewSignature
              ? docs.viewSignatureTitle.replace("{name}", viewSignature.label)
              : docs.viewSignature}
          </Text>
          {viewSignature ? (
            <View style={s.signaturePreview}>
              <Image
                source={{ uri: viewSignature.url }}
                style={s.signatureImage}
                contentFit="contain"
                accessibilityLabel={docs.viewSignatureTitle.replace(
                  "{name}",
                  viewSignature.label,
                )}
              />
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            android_ripple={{ color: `${accent}22` }}
            onPress={() => setViewSignature(null)}
            style={({ pressed }) => [
              s.sheetCancel,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[s.sheetCancelLabel, muted]}>{t.common.cancel}</Text>
          </Pressable>
        </MobileBottomSheet>
        <MobileBottomSheet
          visible={pickKind != null}
          onClose={() => setPickKind(null)}
          maxHeight={420}
          sheetStyle={s.sheetPanel}
        >
          <Text style={[s.sheetTitle, title]}>{docs.pickSourceTitle}</Text>
          <Text style={[s.sheetHint, muted]}>{docs.pickSourceHint}</Text>
          {[
            {
              source: "documents" as const,
              icon: "note" as const,
              label: docs.pickFromDocuments,
              hint: docs.pickFromDocumentsHint,
            },
            {
              source: "photos" as const,
              icon: "camera" as const,
              label: docs.pickFromPhotos,
              hint: docs.pickFromPhotosHint,
            },
          ].map((option) => (
            <Pressable
              key={option.source}
              accessibilityRole="button"
              android_ripple={{ color: `${accent}22` }}
              onPress={() => choosePickSource(option.source)}
              style={({ pressed }) => [
                s.sourceCard,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.background,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <View style={[s.sourceIcon, { backgroundColor: `${accent}18` }]}>
                <MobileIcon
                  name={option.icon}
                  size={22}
                  color={accent}
                  weight="bold"
                />
              </View>
              <View style={s.sourceCopy}>
                <Text style={[s.sourceLabel, title]}>{option.label}</Text>
                <Text style={[s.sourceHint, muted]}>{option.hint}</Text>
              </View>
              <MobileIcon name="chevron-right" size={18} tone="muted" />
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            android_ripple={{ color: `${accent}22` }}
            onPress={() => setPickKind(null)}
            style={({ pressed }) => [
              s.sheetCancel,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[s.sheetCancelLabel, muted]}>{t.common.cancel}</Text>
          </Pressable>
        </MobileBottomSheet>
        <MobileBottomSheet
          visible={signParties != null || witnessSign != null}
          onClose={() => {
            if (busy) return;
            setSignParties(null);
            setWitnessSign(null);
          }}
          maxHeight="90%"
          sheetStyle={s.sheetPanel}
        >
          <Text style={[s.sheetTitle, title]}>
            {witnessSign ? docs.witnessSignTitle : signParties ? signSheetTitle(signParties) : docs.signatories}
          </Text>
          <Text style={[s.sheetHint, muted]}>{docs.signHint}</Text>
          {witnessSign && !witnessSign.asAgent ? (
            <MobileInput
              label={docs.witnessName}
              value={witnessName}
              onChangeText={setWitnessName}
              editable={!busy}
              maxLength={255}
            />
          ) : null}
          {!!error && (signParties || witnessSign) ? (
            <Text
              accessibilityRole="alert"
              style={[s.body, { color: "#C74747", marginBottom: 8 }]}
            >
              {error}
            </Text>
          ) : null}
          {signParties || witnessSign ? (
            <ContractSignaturePad
              key={`${signPadKey}-${witnessSign ? `witness-${witnessSign.asAgent}` : signParties!.join("-")}`}
              ref={padRef}
              onOK={(image) => {
                void submitSignature(image);
              }}
              onEmpty={() => setError(docs.signEmpty)}
            />
          ) : null}
          <View style={s.signActions}>
            <MobileButton
              variant="outline"
              disabled={busy}
              onPress={() => padRef.current?.clearSignature()}
            >
              {docs.clearSignature}
            </MobileButton>
            <MobileButton
              disabled={busy}
              isLoading={busy}
              onPress={() => {
                if (busy || signing.current) return;
                padRef.current?.readSignature();
              }}
            >
              {docs.confirmSignature}
            </MobileButton>
          </View>
        </MobileBottomSheet>
      </View>
    );
  if (viewingInvoice && payingInvoice)
    return (
      <FinancialDocumentForm
        key={`pay:${viewingInvoice.id}`}
        kind="receipt"
        fixedInvoiceId={viewingInvoice.id}
        payer={tenantPayer}
        onBack={() => setPayingInvoice(false)}
        onStandaloneCreated={(invoice) => {
          setInvoices((rows) =>
            rows.map((row) => (row.id === invoice.id ? invoice : row)),
          );
          setViewingInvoice(invoice);
          setPayingInvoice(false);
          setNotice(docs.financial.success);
          onChanged?.();
        }}
        onCreated={() => undefined}
      />
    );
  if (viewingInvoice)
    return (
      <View style={s.root}>
        {button(tc.common.back, () => {
          setPayingInvoice(false);
          setViewingInvoice(null);
          setPreviewDoc(null);
        })}
        <Text style={[s.heading, title]}>{sc.invoice}</Text>
        {errorView}
        <View style={[s.card, card]}>
          <Text style={[s.subtitle, title]}>{viewingInvoice.documentNo}</Text>
          <Text style={[s.body, title]}>{viewingInvoice.customerName}</Text>
          <Text style={[s.small, muted]}>
            {fillTemplate(tc.common.dated, { date: date(viewingInvoice.issueDate) })}
          </Text>
          <Text style={[s.body, title]}>{money(viewingInvoice.total)}</Text>
          <Text
            style={[
              s.body,
              { color: viewingInvoice.receiptDocumentNo ? "#198460" : "#B45309" },
            ]}
          >
            {viewingInvoice.receiptDocumentNo
              ? docs.financial.paid
              : docs.financial.awaitingPayment}
          </Text>
          {viewingInvoice.receiptDocumentNo ? (
            <Text style={[s.small, muted]}>
              {fillTemplate(sc.receiptNo, { no: viewingInvoice.receiptDocumentNo })}
            </Text>
          ) : null}
        </View>
        {!viewingInvoice.receiptDocumentNo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={docs.financial.markPaid}
            onPress={() => setPayingInvoice(true)}
            style={({ pressed }) => [
              s.button,
              {
                backgroundColor: accent,
                borderColor: accent,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[s.body, { color: "#fff" }]}>{docs.financial.markPaid}</Text>
          </Pressable>
        ) : null}
        {viewingInvoice.invoiceUrl
          ? button(
              sc.viewDocument,
              () =>
                openDocumentPreview(
                  fillTemplate(sc.invoiceNo, { no: viewingInvoice.documentNo }),
                  viewingInvoice.invoiceUrl!,
                  "invoice",
                ),
              true,
            )
          : (
              <Text style={[s.body, muted]}>{sc.documentUnavailable}</Text>
            )}
        {viewingInvoice.receiptUrl
          ? button(
              fillTemplate(sc.viewReceipt, { no: viewingInvoice.receiptDocumentNo ?? "" }).trim(),
              () =>
                openDocumentPreview(
                  fillTemplate(sc.receiptNo, { no: viewingInvoice.receiptDocumentNo ?? "" }).trim(),
                  viewingInvoice.receiptUrl!,
                  "receipt",
                ),
            )
          : null}
        {viewingInvoice.receiptDocumentNo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={docs.financial.viewSlip}
            onPress={() => openPaymentProof(viewingInvoice)}
            style={({ pressed }) => [
              s.button,
              {
                backgroundColor: theme.background,
                borderColor: theme.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[s.body, title]}>{docs.financial.viewSlip}</Text>
          </Pressable>
        ) : null}
        <Modal
          visible={previewDoc != null}
          onRequestClose={() => setPreviewDoc(null)}
          animationType="slide"
          presentationStyle="fullScreen"
        >
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 16,
                  gap: 12,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tc.common.closeDocument}
                  onPress={() => setPreviewDoc(null)}
                  style={{ padding: 8 }}
                >
                  <Text style={title}>{tc.common.close}</Text>
                </Pressable>
                <Text style={[s.sheetTitle, title]}>
                  {previewDoc
                    ? docs.previewTitle.replace("{name}", previewDoc.name)
                    : docs.preview}
                </Text>
              </View>
              {previewDoc ? (
                <ContractDocumentPreview
                  key={previewDoc.url}
                  url={previewDoc.url}
                />
              ) : null}
              {previewDoc ? (
                <View style={[s.previewActions, { padding: 12 }]}>
                  <MobileButton
                    variant="outline"
                    disabled={busy}
                    onPress={() => {
                      void openDocumentExternally(previewDoc.url);
                    }}
                  >
                    {docs.openExternally}
                  </MobileButton>
                </View>
              ) : null}
            </SafeAreaView>
          </SafeAreaProvider>
        </Modal>
      </View>
    );
  async function openLibraryEntry(entry: ContractLibraryEntry) {
    if (busy) return;
    setError("");
    setNotice("");
    setFocusDocuments(false);
    if (entry.kind === "commission") {
      if (entry.value.pdfUrl) openDocumentPreview(docs.commissionConfirmation.title, entry.value.pdfUrl, "commission_confirmation");
      return;
    }
    if (entry.kind === "invoice" || entry.kind === "receipt") {
      setViewingInvoice(entry.value);
      if (entry.kind === "receipt" && entry.value.receiptUrl)
        openDocumentPreview(`${tc.screen.library.receipt} ${entry.value.receiptDocumentNo}`, entry.value.receiptUrl, "receipt");
      return;
    }
    setBusy(true);
    try {
      const latest = await getAgentContract(entry.value.id);
      const url = entry.kind === "booking_receipt" ? latest.receiptUrl : latest.invoiceUrl;
      if (entry.kind !== "contract" && !url) throw new Error(entry.kind === "booking_invoice" ? cn.invoiceNotFound : cn.openDocumentFailed);
      setSelected(latest);
      setContracts(current => current.map(item => item.id === latest.id ? latest : item));
      if (entry.kind !== "contract" && url) {
        const receipt = entry.kind === "booking_receipt";
        openDocumentPreview(`${receipt ? tc.screen.library.receipt : tc.screen.library.bookingInvoice} ${receipt ? latest.reservationPayment?.receiptDocumentNo : latest.reservationPayment?.invoiceDocumentNo}`, url, receipt ? "receipt" : "invoice");
      }
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  return (
    <View style={s.root}>
      {errorView}
      {(loadingList || busy) && <ActivityIndicator color={tokens.colors.brand[500]} />}
      {!!listError && <View style={[s.card, card]}>
        <Text accessibilityRole="alert" style={[s.body, muted]}>{listError}</Text>
        {button(tc.common.retry, () => setRetry(value => value + 1))}
      </View>}
      <AgentContractLibrary contracts={contracts} invoices={shownInvoices} commissions={shownCommissions}
        tenantName={tenant?.name} view={libraryView} onViewChange={setLibraryView}
        busy={busy} loading={loadingList || !!listError} onOpen={entry => void openLibraryEntry(entry)}
        onCreate={() => { setViewingInvoice(null); setChoosingType(true); setNotice(""); setError(""); }} />
        <Modal
          visible={previewDoc != null}
          onRequestClose={() => setPreviewDoc(null)}
          animationType="slide"
          presentationStyle="fullScreen"
        >
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 16,
                  gap: 12,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tc.common.closeDocument}
                  onPress={() => setPreviewDoc(null)}
                  style={{ padding: 8 }}
                >
                  <Text style={title}>{tc.common.close}</Text>
                </Pressable>
                <Text style={[s.sheetTitle, title]}>
                  {previewDoc
                    ? docs.previewTitle.replace("{name}", previewDoc.name)
                    : docs.preview}
                </Text>
              </View>
              {previewDoc ? (
                <ContractDocumentPreview
                  key={previewDoc.url}
                  url={previewDoc.url}
                />
              ) : null}
              {previewDoc ? (
                <View style={[s.previewActions, { padding: 12 }]}>
                  <MobileButton
                    variant="outline"
                    disabled={busy}
                    onPress={() => {
                      void openDocumentExternally(previewDoc.url);
                    }}
                  >
                    {docs.openExternally}
                  </MobileButton>
                </View>
              ) : null}
            </SafeAreaView>
          </SafeAreaProvider>
        </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 16, paddingBottom: 24 },
  hero: { borderRadius: 22, padding: 24, gap: 12 },
  heroTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 25,
    lineHeight: 37,
  },
  saveConfirm: { paddingHorizontal: 20, paddingBottom: 8, gap: 12 },
  saveConfirmActions: { flexDirection: "row", gap: 8 },
  saveConfirmButton: { flexGrow: 1, flexBasis: 120 },
  heading: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 22,
    lineHeight: 32,
  },
  subtitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 17,
    lineHeight: 26,
  },
  group: { gap: 10 },
  groupTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 18,
    lineHeight: 27,
  },
  section: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 10,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sectionTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    flex: 1,
  },
  sectionCount: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
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
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  card: { padding: 18, borderWidth: 1, borderRadius: 18, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, padding: 12, borderWidth: 1, borderRadius: 16, gap: 3 },
  count: { fontSize: 28, fontFamily: tokens.typography.native.headingTh },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  badge: {
    fontFamily: tokens.typography.native.body,
    fontSize: 11,
    overflow: "hidden",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  facts: { borderRadius: 10, padding: 12, gap: 3 },
  button: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  divider: { borderTopWidth: 1, marginVertical: 6 },
  sheetPanel: { paddingHorizontal: 20, flexGrow: 0 },
  sheetTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 18,
    lineHeight: 27,
    marginBottom: 4,
  },
  sheetHint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  sourceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  sourceIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceCopy: { flex: 1, minWidth: 0, gap: 2 },
  previewActions: { gap: 10, marginBottom: 4 },
  signaturePreview: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F8FAFC",
    marginBottom: 8,
  },
  signatureImage: {
    width: "100%",
    height: 220,
  },
  signRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 64,
    paddingVertical: 6,
  },
  signatureButton: { width: 96, minHeight: 46, flexShrink: 0, paddingHorizontal: 8, borderWidth: 1, borderColor: tokens.colors.brand[500] },
  shareButton: { width: 64, minHeight: 46, flexShrink: 0, paddingHorizontal: 8 },
  documentItem: { gap: 10, padding: 12, borderWidth: 1, borderRadius: 14 },
  documentHead: { flexDirection: "row", gap: 10, alignItems: "center" },
  documentStatus: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  documentTitle: { flex: 1, fontFamily: tokens.typography.native.headingTh, fontSize: 15, lineHeight: 23 },
  documentFile: { gap: 8, padding: 12, borderRadius: 12 },
  documentActions: { gap: 8 },
  partyActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 8,
    justifyContent: "flex-end",
  },
  signActions: { marginTop: 16, gap: 10 },
  sourceLabel: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
  },
  sourceHint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
  },
  sheetCancel: {
    marginTop: 4,
    paddingVertical: 12,
    alignItems: "center",
  },
  sheetCancelLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 23,
  },
});
