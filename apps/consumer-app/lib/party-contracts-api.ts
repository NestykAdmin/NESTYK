import { Platform } from "react-native";
import type {
  AgreementAttachmentChecklist,
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

export function openMyFinancialDocument(id: number, kind: "invoice" | "receipt" | "payment-slip"): Promise<{ url: string }> {
  return apiGet(`/contracts/mine/${id}/financial-documents/${kind}`);
}

export async function uploadMyReservationPaymentSlip(
  id: number,
  file: { uri: string; name: string; mimeType: string; file?: File },
): Promise<PartyContract> {
  const form = new FormData();
  if (Platform.OS === "web")
    form.append("file", file.file ?? (await (await fetch(file.uri)).blob()), file.name);
  else
    form.append("file", { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    return await apiRequest(`/contracts/mine/${id}/payment-slip`, { method: "POST", body: form, signal: controller.signal });
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
  party: "owner" | "tenant",
  signaturePng: string,
): Promise<PartyContract> {
  return apiPost(`/contracts/mine/${id}/sign`, { party, signaturePng });
}
