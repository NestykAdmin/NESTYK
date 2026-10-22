import type { DealOffer, DealOfferConfirmationMethod, SaveDealOffer } from "@nestyk/types";
import { apiGet, apiPost, apiRequest } from "./api";

/** D2: the agent's offers of one lead, newest first. */
export function listLeadDealOffers(leadId: number): Promise<DealOffer[]> {
  return apiGet(`/agent/leads/${leadId}/deal-offers`);
}
export function createDealOffer(body: SaveDealOffer): Promise<DealOffer> {
  return apiPost("/agent/deal-offers", body);
}
export function updateDealOffer(id: number, body: SaveDealOffer): Promise<DealOffer> {
  return apiRequest(`/agent/deal-offers/${id}`, { method: "PUT", body: JSON.stringify(body) });
}
export function sendDealOffer(id: number, revision: number): Promise<DealOffer> {
  return apiPost(`/agent/deal-offers/${id}/send`, { revision });
}
export function recordDealOfferConfirmation(
  id: number,
  body: { revision: number; method: DealOfferConfirmationMethod; note: string },
): Promise<DealOffer> {
  return apiPost(`/agent/deal-offers/${id}/confirm`, body);
}
export function cancelDealOffer(id: number, revision: number): Promise<DealOffer> {
  return apiPost(`/agent/deal-offers/${id}/cancel`, { revision });
}
/** The landlord's offers to confirm, and the ones already confirmed. */
export function listLandlordDealOffers(): Promise<DealOffer[]> {
  return apiGet("/contracts/mine/deal-offers");
}
export function confirmLandlordDealOffer(id: number, revision: number): Promise<DealOffer> {
  return apiPost(`/contracts/mine/deal-offers/${id}/confirm`, { revision });
}
