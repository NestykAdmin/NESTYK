import type { ContractParty } from "@nestyk/types";
import type {
  AgreementType,
  AgentContract,
  AgentContractDocumentKind,
  ContractCandidate,
  CreateAgentContract,
  SignAgentContract,
} from "@nestyk/types";
import { apiGet, apiPost, apiRequest } from "./api";
import { ensureAgentSession } from "./agent-session";
import { Platform } from "react-native";
export async function listAgentContracts(): Promise<AgentContract[]> {
  await ensureAgentSession();
  return apiGet("/agent/contracts");
}
export async function getAgentContract(id: number): Promise<AgentContract> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/${id}`);
}
export async function listContractEndReasons(): Promise<import("@nestyk/types").ContractEndReason[]> {
  await ensureAgentSession();
  return apiGet("/agent/contracts/end-reasons");
}
export async function closeAgentContract(id: number, input: import("@nestyk/types").CloseAgentContract):
  Promise<import("@nestyk/types").CloseAgentContractResult> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/close`, input);
}
/**
 * D11 (AC-3.4): return the tenant's booking slip with a reason; the tenant then sends a new one. submittedAt is the
 * slip the agent looked at: a newer one gives 409 SLIP_CHANGED.
 */
export async function returnReservationSlip(id: number, reason: string, submittedAt: string | null): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/reservation-payment/return`, { reason, submittedAt });
}
/** D11 (AC-5.4): the same for the deposit slip of a lease. */
/** D4 (AC-5.5): move the handover day of a lease waiting for its deposit or handover, with a reason. */
export function moveHandoverDue(id: number, date: string, reason: string): Promise<AgentContract> {
  return apiPost(`/agent/contracts/${id}/handover-due`, { date, reason });
}

export async function returnDepositSlip(id: number, reason: string, submittedAt: string | null): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/deposit-payment/return`, { reason, submittedAt });
}
export async function listContractCandidates(): Promise<ContractCandidate[]> {
  await ensureAgentSession();
  return apiGet("/agent/contracts/candidates");
}
export async function searchOwnerUsers(
  query: string,
): Promise<
  Array<{
    id: number;
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    identityNumber: string;
    nationality: string;
  }>
> {
  await ensureAgentSession();
  const q = encodeURIComponent(query.trim());
  return apiGet(`/agent/contracts/owner-users?q=${q}`);
}
export async function getReservationDefaults(
  leadId: number,
): Promise<import("@nestyk/types").ReservationLetterInput> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/reservation-defaults/${leadId}`);
}
export async function getBrokerAppointmentLeadDefaults(
  leadId: number,
): Promise<import("@nestyk/types").BrokerAppointmentInput> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/broker-appointment-defaults/${leadId}`);
}
export async function getLeaseDefaults(
  leadId: number,
): Promise<import("@nestyk/types").LeaseAgreementInput> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/lease-defaults/${leadId}`);
}
export async function previewAgentBrokerAppointment(
  id: number,
): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/broker-appointment-preview`, {});
}
export async function generateAgentBrokerAppointment(
  id: number,
): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/generate-broker-appointment`, {});
}
export async function previewAgentLeaseAgreement(
  id: number,
): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/lease-preview`, {});
}
export async function previewAgentLeaseRenewal(
  id: number,
): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/lease-renewal-preview`, {});
}
export async function generateAgentLeaseRenewal(
  id: number,
): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/generate-lease-renewal`, {});
}
export async function generateAgentLeaseAgreement(
  id: number,
): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/generate-lease`, {});
}
export async function createAgentContract(
  input: CreateAgentContract,
): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost("/agent/contracts", input);
}

export async function listAgreementTypes(): Promise<AgreementType[]> {
  await ensureAgentSession();
  return apiGet("/agent/contracts/types");
}

export async function signAgentContract(
  id: number,
  input: SignAgentContract,
): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/sign`, input);
}

/** D9: the lease witness signs on the agent's device; asAgent when the agent is the witness. */
export async function signAgentContractWitness(
  id: number,
  input: { signaturePng: string; asAgent: boolean; signerName?: string },
): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/witness-sign`, input);
}

/** D10: issue the deposit invoice of a generated lease again (it is issued when the lease is generated). */
export async function issueAgentDepositInvoice(id: number): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/deposit-invoice`, {});
}

export async function deliverAgentContract(
  id: number,
  party: ContractParty,
): Promise<import("@nestyk/types").ContractDelivery> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/deliveries`, { party });
}

export async function uploadAgentContractDocument(
  id: number,
  kind: AgentContractDocumentKind,
  file: { uri: string; name: string; mimeType: string; file?: File },
): Promise<AgentContract> {
  await ensureAgentSession();
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = file.file ?? (await (await fetch(file.uri)).blob());
    form.append("file", blob, file.name);
  } else {
    form.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    return await apiRequest<AgentContract>(
      `/agent/contracts/${id}/documents/${kind}`,
      {
        method: "POST",
        body: form,
        signal: controller.signal,
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function previewAgentReservation(
  id: number,
): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/reservation-preview`, {});
}
export async function generateAgentReservation(
  id: number,
): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/generate-reservation`, {});
}

export async function listAgreementTemplates(
  code: string,
): Promise<import("@nestyk/types").AgreementTemplate[]> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/types/${encodeURIComponent(code)}/templates`);
}
export async function getAgreementHistory(
  id: number,
): Promise<AgentContract[]> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/${id}/history`);
}

/** D17: who signed a contract and through which channel. */
export async function listAgentContractSignatures(
  id: number,
): Promise<import("@nestyk/types").AgreementSignatureLogEntry[]> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/${id}/signatures`);
}

export async function listAgreementAttachments(
  id: number,
): Promise<import("@nestyk/types").AgreementAttachmentChecklist> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/${id}/attachments`);
}

export async function openAgreementAttachment(
  id: number,
  documentId: number,
): Promise<{ url: string }> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/${id}/attachments/${documentId}/url`);
}
export async function removeAgreementAttachment(
  id: number,
  documentId: number,
): Promise<import("@nestyk/types").AgreementAttachmentChecklist> {
  await ensureAgentSession();
  return apiRequest(`/agent/contracts/${id}/attachments/${documentId}`, { method: "DELETE" });
}
export async function reviewAgreementAttachment(
  id: number,
  documentId: number,
  status: "accepted" | "rejected",
  note?: string,
): Promise<import("@nestyk/types").AgreementAttachmentChecklist> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/attachments/${documentId}/review`, {
    status,
    note,
  });
}
export async function reuseAgreementAttachment(
  id: number,
  sourceDocumentId: number,
): Promise<import("@nestyk/types").AgreementAttachmentChecklist> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/attachments/reuse`, {
    sourceDocumentId,
    confirmedCurrent: true,
  });
}
export async function uploadAgreementAttachment(
  id: number,
  input: {
    subject: string;
    documentTypeCode: string;
    supersedesDocumentId?: number;
  },
  file: { uri: string; name: string; mimeType: string; file?: File },
): Promise<import("@nestyk/types").AgreementAttachmentChecklist> {
  await ensureAgentSession();
  const form = new FormData();
  form.append("subject", input.subject);
  form.append("documentTypeCode", input.documentTypeCode);
  if (input.supersedesDocumentId)
    form.append("supersedesDocumentId", String(input.supersedesDocumentId));
  if (Platform.OS === "web")
    form.append(
      "file",
      file.file ?? (await (await fetch(file.uri)).blob()),
      file.name,
    );
  else
    form.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    return await apiRequest(`/agent/contracts/${id}/attachments`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function getFinancialDocumentDefaults(id: number, kind: import('@nestyk/types').FinancialDocumentKind): Promise<import('@nestyk/types').FinancialDocumentInput> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/${id}/financial-documents/${kind}`);
}
export async function listCommissionConfirmations(): Promise<
  import("@nestyk/types").CommissionConfirmation[]
> {
  await ensureAgentSession();
  return apiGet("/agent/contracts/commission-confirmations");
}
export async function getNextCommissionNumber(): Promise<{ documentNo: string }> {
  await ensureAgentSession();
  return apiGet("/agent/contracts/commission-confirmations/next-number");
}
export async function createCommissionConfirmation(
  input: import("@nestyk/types").CommissionConfirmationInput & {
    tenantId?: number | null;
  },
): Promise<import("@nestyk/types").CommissionConfirmation> {
  await ensureAgentSession();
  return apiPost("/agent/contracts/commission-confirmations", input);
}
export async function getNextInvoiceNumber(): Promise<{ documentNo: string }> {
  await ensureAgentSession();
  return apiGet("/agent/contracts/invoices/next-number");
}
export async function listStandaloneInvoices(): Promise<
  import("@nestyk/types").StandaloneInvoice[]
> {
  await ensureAgentSession();
  return apiGet("/agent/contracts/invoices");
}
export async function createStandaloneInvoice(
  input: import("@nestyk/types").FinancialDocumentInput,
): Promise<import("@nestyk/types").StandaloneInvoice> {
  await ensureAgentSession();
  return apiPost("/agent/contracts/invoices", input);
}
export async function getReceiptDefaults(
  invoiceId: number,
): Promise<import("@nestyk/types").FinancialDocumentInput> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/invoices/${invoiceId}/receipt-defaults`);
}
export async function createReceiptForInvoice(
  invoiceId: number,
  input: Partial<import("@nestyk/types").FinancialDocumentInput>,
  slip?: { uri: string; name: string; mimeType: string; file?: File },
): Promise<import("@nestyk/types").StandaloneInvoice> {
  await ensureAgentSession();
  if (!slip)
    return apiPost(`/agent/contracts/invoices/${invoiceId}/receipt`, input);
  const form = new FormData();
  form.append("payload", JSON.stringify(input));
  if (Platform.OS === "web") {
    const blob = slip.file ?? (await (await fetch(slip.uri)).blob());
    form.append("file", blob, slip.name);
  } else {
    form.append("file", {
      uri: slip.uri,
      name: slip.name,
      type: slip.mimeType,
    } as unknown as Blob);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    return await apiRequest<import("@nestyk/types").StandaloneInvoice>(
      `/agent/contracts/invoices/${invoiceId}/receipt`,
      { method: "POST", body: form, signal: controller.signal },
    );
  } finally {
    clearTimeout(timeout);
  }
}
export async function generateFinancialDocument(
  id: number,
  kind: import("@nestyk/types").FinancialDocumentKind,
  input: Partial<import("@nestyk/types").FinancialDocumentInput>,
): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/financial-documents/${kind}`, input);
}

export async function updateAgentContractDraft(id: number, input: CreateAgentContract, expectedDraftRevision: unknown = null): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/draft`, { ...input, expectedDraftRevision });
}
type PickedFile = { uri: string; name: string; mimeType: string; file?: File };
async function appendFile(form: FormData, field: string, file: PickedFile) {
  if (Platform.OS === "web") form.append(field, file.file ?? (await (await fetch(file.uri)).blob()), file.name);
  else form.append(field, { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
}
async function postForm<T>(path: string, form: FormData): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    return await apiRequest<T>(path, { method: "POST", body: form, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
/** D5 (AC-C.4): what cancelling the deal of this booking letter or lease would close, and the money received so far. */
export async function getDealCancellationPreview(id: number): Promise<import("@nestyk/types").DealCancellationPreview> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/${id}/cancellation-preview`);
}
/** D5: cancel the deal before the handover, with who caused it, a reason and 1 to 5 evidence files. */
export async function cancelDeal(id: number, input: import("@nestyk/types").CancelDeal, evidence: PickedFile[]): Promise<AgentContract> {
  await ensureAgentSession();
  const form = new FormData();
  form.append("payload", JSON.stringify(input));
  for (const file of evidence) await appendFile(form, "evidence", file);
  return postForm(`/agent/contracts/${id}/cancel-deal`, form);
}
/** D5 (AC-C.2, C.3): record the refund to the tenant once, with its proof. */
export async function recordDealRefund(id: number, refundedOn: string, proof: PickedFile): Promise<AgentContract> {
  await ensureAgentSession();
  const form = new FormData();
  form.append("payload", JSON.stringify({ refundedOn }));
  await appendFile(form, "file", proof);
  return postForm(`/agent/contracts/${id}/cancellation/refund`, form);
}
export async function cancelAgentContractDraft(id: number, reason: string): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/cancel-draft`, { reason });
}
export async function getAgentContractDraftTemplate(id: number): Promise<import("@nestyk/types").AgreementTemplate> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/${id}/draft-template`);
}

/** D6: the handover record of a lease (annex 1 items, annex 2 photos, signatures). */
export async function getHandover(id: number): Promise<import("@nestyk/types").HandoverRecord> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/${id}/handover`);
}

export async function saveHandover(
  id: number,
  body: import("@nestyk/types").SaveHandover,
): Promise<import("@nestyk/types").HandoverRecord> {
  await ensureAgentSession();
  return apiRequest(`/agent/contracts/${id}/handover`, { method: "PUT", body: JSON.stringify(body) });
}

export async function uploadHandoverPhoto(
  id: number,
  file: { uri: string; name: string; mimeType: string; file?: File },
): Promise<import("@nestyk/types").HandoverRecord> {
  await ensureAgentSession();
  const form = new FormData();
  if (Platform.OS === "web")
    form.append("file", file.file ?? (await (await fetch(file.uri)).blob()), file.name);
  else
    form.append("file", { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    return await apiRequest(`/agent/contracts/${id}/handover/photos`, { method: "POST", body: form, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function removeHandoverPhoto(id: number, photoId: number): Promise<import("@nestyk/types").HandoverRecord> {
  await ensureAgentSession();
  return apiRequest(`/agent/contracts/${id}/handover/photos/${photoId}`, { method: "DELETE" });
}

/** D6: the landlord or the tenant signs the handover on the agent's device. */
export async function signHandoverOnSite(
  id: number,
  body: import("@nestyk/types").SignHandover,
): Promise<import("@nestyk/types").HandoverRecord> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/handover/sign`, body);
}
