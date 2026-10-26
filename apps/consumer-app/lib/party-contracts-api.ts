import type { ContractParty } from "@nestyk/types";
import { Platform } from "react-native";
import type {
  AgreementAttachmentChecklist,
  DepositFinancialDocumentKind,
  PartyContract,
} from "@nestyk/types";
import { apiGet, apiPost, apiRequest } from "./api";

export function listMyContracts(): Promise<PartyContract[]> {
  return apiGet("/contracts/mine");
}

export type OwnedRoom = { property: string; room: string | null };

export function listMyOwnedRooms(): Promise<OwnedRoom[]> {
  return apiGet("/contracts/mine/rooms");
}

export function openMyContractDocument(id: number): Promise<{ url: string }> {
  return apiPost(`/contracts/mine/${id}/document`, {});
}

/** D13: "commission-confirmation" is the landlord's only (the API refuses it for the tenant). */
export function openMyFinancialDocument(id: number, kind: "invoice" | "receipt" | "payment-slip" | "commission-confirmation" | DepositFinancialDocumentKind): Promise<{ url: string }> {
  return apiGet(`/contracts/mine/${id}/financial-documents/${kind}`);
}

/** D10: the tenant sends the slip for the deposit invoice of a generated lease. */
export function uploadMyDepositPaymentSlip(
  id: number,
  file: { uri: string; name: string; mimeType: string; file?: File },
): Promise<PartyContract> {
  return uploadMyReservationPaymentSlip(id, file, "deposit-payment-slip");
}

export async function uploadMyReservationPaymentSlip(
  id: number,
  file: { uri: string; name: string; mimeType: string; file?: File },
  route: "payment-slip" | "deposit-payment-slip" = "payment-slip",
): Promise<PartyContract> {
  const form = new FormData();
  if (Platform.OS === "web")
    form.append("file", file.file ?? (await (await fetch(file.uri)).blob()), file.name);
  else
    form.append("file", { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    return await apiRequest(`/contracts/mine/${id}/${route}`, { method: "POST", body: form, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function listMyAttachments(
  id: number,
): Promise<AgreementAttachmentChecklist> {
  return apiGet(`/contracts/mine/${id}/attachments`);
}

export function openMyAttachment(
  id: number,
  documentId: number,
): Promise<{ url: string }> {
  return apiGet(`/contracts/mine/${id}/attachments/${documentId}/url`);
}

export async function uploadMyAttachment(
  id: number,
  input: {
    subject: string;
    documentTypeCode: string;
    supersedesDocumentId?: number;
  },
  file: { uri: string; name: string; mimeType: string; file?: File },
): Promise<AgreementAttachmentChecklist> {
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
  return apiRequest(`/contracts/mine/${id}/attachments`, {
    method: "POST",
    body: form,
  });
}

export function signMyContract(
  id: number,
  party: ContractParty,
  signaturePng: string,
): Promise<PartyContract> {
  return apiPost(`/contracts/mine/${id}/sign`, { party, signaturePng });
}

/** D6: the handover record of the lease; the landlord and the tenant review it, then sign their own side. */
export function getMyHandover(id: number): Promise<import("@nestyk/types").HandoverRecord> {
  return apiGet(`/contracts/mine/${id}/handover`);
}

export function signMyHandover(
  id: number,
  body: import("@nestyk/types").SignHandover,
): Promise<import("@nestyk/types").HandoverRecord> {
  return apiPost(`/contracts/mine/${id}/handover/sign`, body);
}
