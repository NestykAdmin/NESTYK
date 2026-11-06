import React from "react";
import type { LeadDetailColumnProps, LeadDetailColumnsProps } from "./LeadDetailColumns.types";
import "./agent-leads.css";

/**
 * Agent web lead page (W6, Mos 5 Nov 2026): the lead card, full-info link and viewings on the left, matched rooms on
 * the right. The cards, sheets and actions are the app's own (`AgentLeadDetailBody`); only their placement changes.
 */
export function LeadDetailColumns({ web, children }: LeadDetailColumnsProps) {
  if (!web) return <>{children}</>;
  return (
    <div className="awl-detail" data-testid="lead.detail">
      {children}
    </div>
  );
}

export function LeadDetailColumn({ web, side, children }: LeadDetailColumnProps) {
  if (!web) return <>{children}</>;
  return <div className={`awl-detail-col awl-detail-${side}`}>{children}</div>;
}
