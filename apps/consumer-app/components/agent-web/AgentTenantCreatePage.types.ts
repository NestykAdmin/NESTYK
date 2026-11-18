import type React from "react";
import type { AgentTenant } from "@nestyk/types";

/** Where the agent goes after booking: the reservation letter, the tenant page, or back to the list ("later"). */
export type TenantCreateNext = "reservation" | "tenant" | "list";

export interface AgentTenantCreatePageProps {
  onBusy?: (busy: boolean) => void;
  /** Shell header / browser back: returns true when it stepped back, false on the first step. */
  backRef?: React.MutableRefObject<(() => boolean) | null>;
  /** The tenant was created and the lead is booked; `next` is what the agent chose on the "booked" dialog. */
  /** Called as soon as the tenant is created (lead is booked), before the "Booked" dialog closes, as the app sheet's onReserved. */
  onCreated: (tenant: AgentTenant) => void;
  /** Where to go after the "Booked" dialog. */
  onDone: (tenant: AgentTenant, next: TenantCreateNext) => void;
}
