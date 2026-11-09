import type React from "react";
import type { LeadFormDraft, LeadFormTabKey } from "../../lib/lead-form-readiness";

/** What the page hands to `CreateLeadForm` (its optional web props). Native passes nothing. */
export type LeadFormBind = {
  onDraftChange?: (draft: LeadFormDraft) => void;
  requestedTab?: { tab: LeadFormTabKey; nonce: number };
};

export interface AgentLeadFormPageProps {
  mode: "create" | "edit";
  /** Renders the app's `CreateLeadForm` with the bind props spread in. */
  children: (bind: LeadFormBind) => React.ReactNode;
}
