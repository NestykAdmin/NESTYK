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

export async function deliverAgentContract(
  id: number,
  party: "owner" | "tenant",
): Promise<import("@nestyk/types").ContractDelivery> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/deliveries`, { party });
}

export async function createContractSignInvite(
  id: number,
  party: "owner" | "tenant",
): Promise<import("@nestyk/types").ContractSignInvite> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/sign-invites`, { party });
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

export async function listAgreementAttachments(
  id: number,
): Promise<import("@nestyk/types").AgreementAttachmentChecklist> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/${id}/attachments`);
}
export async function getBrokerAppointmentDefaults(
  id: number,
): Promise<import("@nestyk/types").BrokerAppointmentInput> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/${id}/attachments/broker-appointment/defaults`);
}
export async function generateBrokerAppointment(
  id: number,
  body: import("@nestyk/types").BrokerAppointmentInput,
): Promise<import("@nestyk/types").AgreementAttachmentChecklist> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/attachments/broker-appointment`, body);
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
export async function cancelAgentContractDraft(id: number, reason: string): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/cancel-draft`, { reason });
}
export async function getAgentContractDraftTemplate(id: number): Promise<import("@nestyk/types").AgreementTemplate> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/${id}/draft-template`);
}
