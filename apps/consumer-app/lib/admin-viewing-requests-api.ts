import type { AdminViewingRequest, AdminViewingRequestDetail } from '@nestyk/types';
import { apiGet, apiPost } from './api';

/**
 * Admin API for viewing requests (apps/api/src/viewing-requests/admin-viewing-requests.controller.ts, admin role only).
 * The API returns at most 200 rows per call, newest first, and the web counts and searches them (Mos 24 Nov 2026: no
 * API change this round). Open requests and ended ones load apart, so ended ones never push open ones out (review R1).
 */
export function listAdminViewingRequests(): Promise<AdminViewingRequest[]> {
  return apiGet('/admin/viewing-requests?status=open');
}

/** Ended requests: one call per ended status, so each gets its own 200 rows. */
export async function listAdminEndedViewingRequests(): Promise<AdminViewingRequest[]> {
  const lists = await Promise.all(
    (['viewed', 'cancelled', 'closed'] as const).map((status) => apiGet<AdminViewingRequest[]>(`/admin/viewing-requests?status=${status}`)),
  );
  return lists.flat();
}

export function getAdminViewingRequest(id: number): Promise<AdminViewingRequestDetail> {
  return apiGet(`/admin/viewing-requests/${id}`);
}

export type AdminViewingRequestMove =
  | { action: 'forward' | 'take' | 'viewed' | 'cancel'; note?: string }
  | { action: 'schedule'; scheduledAt: string; note?: string }
  | { action: 'close'; reason: string }
  | { action: 'notes'; note: string };

/** Runs one admin action and returns the request as it is now (with its timeline). */
export function moveAdminViewingRequest(id: number, move: AdminViewingRequestMove): Promise<AdminViewingRequestDetail> {
  const { action, ...body } = move;
  return apiPost(`/admin/viewing-requests/${id}/${action}`, body);
}
