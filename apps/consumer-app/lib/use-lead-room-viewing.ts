import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AgentLead, LeadViewing } from '@nestyk/types';
import { getAgentLead, listLeadViewings } from './agent-leads-api';

/**
 * The lead's scheduled viewing of one room (the latest one, past or upcoming), shared by the
 * matched-room banner and its bottom bar. Pass `lead = null` while the page is closed so
 * reopening it re-reads viewings booked elsewhere.
 */
export function useLeadRoomViewing(
  lead: AgentLead | null,
  roomId: number | null,
  onLeadChange?: (lead: AgentLead) => void,
) {
  const leadId = lead?.id ?? null;
  const [viewings, setViewings] = useState<LeadViewing[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setViewings([]);
    setReady(false);
    if (leadId == null) return;
    let active = true;
    listLeadViewings(leadId)
      .then((rows) => {
        if (active) setViewings(rows);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [leadId]);

  const viewing = useMemo(() => {
    let latest: LeadViewing | null = null;
    for (const v of viewings) {
      if (v.rentRoomId !== roomId || v.status !== 'scheduled') continue;
      if (!latest || new Date(v.scheduledAt).getTime() > new Date(latest.scheduledAt).getTime()) latest = v;
    }
    return latest;
  }, [viewings, roomId]);

  const onSaved = useCallback(
    (saved: LeadViewing) => {
      setViewings((rows) => [...rows.filter((v) => v.id !== saved.id), saved]);
      if (leadId != null && onLeadChange) {
        getAgentLead(leadId)
          .then(onLeadChange)
          .catch(() => {});
      }
    },
    [leadId, onLeadChange],
  );

  return { viewing, ready, onSaved };
}
