import { Platform } from "react-native";
import type { AgentTenantBilling, TenantBill, TenantNextBill } from "@nestyk/types";
import { ensureAgentSession } from "./agent-session";
import { apiGet, apiPost, apiRequest } from "./api";

/**
 * QA (5 Nov 2026): GET /bills/* only reads. Before reading, ask the API to issue the bills that fell due, so a bill
 * shows at once instead of after the 00:05 job. The home card and the bills page ask at the same time after sign-in:
 * they share one request. A failed refresh does not stop the read (the job still issues the bill tonight).
 */
const refreshing = new Map<string, Promise<void>>();
function refreshOnce(path: string): Promise<void> {
  const pending = refreshing.get(path);
  if (pending) return pending;
  const run = apiPost(path, {})
    .then(() => undefined, () => undefined)
    .finally(() => refreshing.delete(path));
  refreshing.set(path, run);
  return run;
}

export async function listMyBills(): Promise<TenantBill[]> {
  await refreshOnce("/bills/mine/refresh");
  return apiGet("/bills/mine");
}

export async function getMyNextBill(): Promise<TenantNextBill | null> {
  await refreshOnce("/bills/mine/refresh");
  return apiGet("/bills/mine/next");
}

export function openMyBillSlip(id: number): Promise<{ url: string }> {
  return apiGet(`/bills/mine/${id}/payment-slip`);
}

export async function listReceivedBills(): Promise<TenantBill[]> {
  await refreshOnce("/bills/received/refresh");
  return apiGet("/bills/received");
}

export function openReceivedBillSlip(id: number): Promise<{ url: string }> {
  return apiGet(`/bills/received/${id}/payment-slip`);
}

export async function listAgentRentSlips(): Promise<TenantBill[]> {
  await ensureAgentSession();
  return apiGet("/bills/agent");
}

export async function getAgentTenantBilling(tenantId: number): Promise<AgentTenantBilling> {
  await ensureAgentSession();
  return apiGet(`/bills/agent/tenants/${tenantId}`);
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

export async function createAgentLateFee(id: number, input: { amount: number; dueDate: string }): Promise<TenantBill> {
  await ensureAgentSession();
  return apiPost(`/bills/agent/${id}/late-fee`, input);
}

export async function returnAgentLateFeeSlip(id: number, reason: string, submittedAt: string): Promise<TenantBill> {
  await ensureAgentSession();
  return apiPost(`/bills/agent/${id}/late-fee/return`, { reason, submittedAt });
}

export async function openAgentLateFee(id: number, kind: "invoice" | "receipt" | "payment-slip"): Promise<{ url: string }> {
  await ensureAgentSession();
  return apiGet(`/bills/agent/${id}/late-fee/${kind}`);
}

export function openMyLateFee(id: number, kind: "invoice" | "receipt" | "payment-slip"): Promise<{ url: string }> {
  return apiGet(`/bills/mine/${id}/late-fee/${kind}`);
}

export function openReceivedLateFee(id: number, kind: "invoice" | "receipt" | "payment-slip"): Promise<{ url: string }> {
  return apiGet(`/bills/received/${id}/late-fee/${kind}`);
}


export function submitMyBillSlip(id: number): Promise<TenantBill> {
  return apiPost(`/bills/mine/${id}/confirm`, {});
}

async function uploadSlip(path: string, file: { uri: string; name: string; mimeType: string; file?: File }): Promise<TenantBill> {
  const form = new FormData();
  if (Platform.OS === "web")
    form.append("file", file.file ?? (await (await fetch(file.uri)).blob()), file.name);
  else
    form.append("file", { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    return await apiRequest(path, { method: "POST", body: form, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function uploadMyBillSlip(
  id: number,
  file: { uri: string; name: string; mimeType: string; file?: File },
): Promise<TenantBill> {
  return uploadSlip(`/bills/mine/${id}/payment-slip`, file);
}

export function uploadMyLateFeeSlip(
  id: number,
  file: { uri: string; name: string; mimeType: string; file?: File },
): Promise<TenantBill> {
  return uploadSlip(`/bills/mine/${id}/late-fee/payment-slip`, file);
}
