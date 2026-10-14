import { Platform } from "react-native";
import type { TenantBill, TenantNextBill } from "@nestyk/types";
import { ensureAgentSession } from "./agent-session";
import { apiGet, apiPost, apiRequest } from "./api";

export function listMyBills(): Promise<TenantBill[]> {
  return apiGet("/bills/mine");
}

export function getMyNextBill(): Promise<TenantNextBill | null> {
  return apiGet("/bills/mine/next");
}

export function openMyBillSlip(id: number): Promise<{ url: string }> {
  return apiGet(`/bills/mine/${id}/payment-slip`);
}

export function listReceivedBills(): Promise<TenantBill[]> {
  return apiGet("/bills/received");
}

export function openReceivedBillSlip(id: number): Promise<{ url: string }> {
  return apiGet(`/bills/received/${id}/payment-slip`);
}

export async function listAgentRentSlips(): Promise<TenantBill[]> {
  await ensureAgentSession();
  return apiGet("/bills/agent");
}

export async function openAgentRentSlip(id: number): Promise<{ url: string }> {
  await ensureAgentSession();
  return apiGet(`/bills/agent/${id}/payment-slip`);
}

export async function confirmAgentRentSlip(id: number): Promise<TenantBill> {
  await ensureAgentSession();
  return apiPost(`/bills/agent/${id}/confirm`, {});
}

export async function returnAgentRentSlip(id: number, reason: string): Promise<TenantBill> {
  await ensureAgentSession();
  return apiPost(`/bills/agent/${id}/return`, { reason });
}

export function submitMyBillSlip(id: number): Promise<TenantBill> {
  return apiPost(`/bills/mine/${id}/confirm`, {});
}

export async function uploadMyBillSlip(
  id: number,
  file: { uri: string; name: string; mimeType: string; file?: File },
): Promise<TenantBill> {
  const form = new FormData();
  if (Platform.OS === "web")
    form.append("file", file.file ?? (await (await fetch(file.uri)).blob()), file.name);
  else
    form.append("file", { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    return await apiRequest(`/bills/mine/${id}/payment-slip`, { method: "POST", body: form, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
