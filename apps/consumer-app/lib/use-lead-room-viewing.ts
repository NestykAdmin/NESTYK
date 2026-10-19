import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  account?: string,
) {
  const leadId = lead?.id ?? null;
  const identity = `${account ?? ''}:${leadId ?? ''}`;
  const currentIdentity = useRef({ identity, epoch: 0 });
  if (currentIdentity.current.identity !== identity) currentIdentity.current = { identity, epoch: currentIdentity.current.epoch + 1 };
  const epoch = currentIdentity.current.epoch;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [viewings, setViewings] = useState<LeadViewing[]>([]);
  const [ready, setReady] = useState(false);
  const dataIdentity = useRef(identity);

  useEffect(() => {
    dataIdentity.current = identity;
    setViewings([]);
    setReady(false);
    if (leadId == null) return;
    let active = true;
    listLeadViewings(leadId)
      .then((rows) => {
        if (active && currentIdentity.current.epoch === epoch) setViewings(rows);
      })
      .catch(() => {})
      .finally(() => {
        if (active && currentIdentity.current.epoch === epoch) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [leadId, account]);

  const viewing = useMemo(() => {
    if (dataIdentity.current !== identity) return null;
    let latest: LeadViewing | null = null;
    for (const v of viewings) {
      if (v.rentRoomId !== roomId || v.status !== 'scheduled') continue;
      if (!latest || new Date(v.scheduledAt).getTime() > new Date(latest.scheduledAt).getTime()) latest = v;
    }
    return latest;
  }, [viewings, roomId, identity]);

  const onSaved = useCallback(
    (saved: LeadViewing) => {
      if (!mounted.current || currentIdentity.current.epoch !== epoch || saved.leadId !== leadId) return;
      setViewings((rows) => [...rows.filter((v) => v.id !== saved.id), saved]);
      if (leadId != null && onLeadChange) {
        getAgentLead(leadId)
          .then(result => { if (mounted.current && currentIdentity.current.epoch === epoch) onLeadChange(result); })
          .catch(() => {});
      }
    },
    [leadId, onLeadChange, identity, epoch],
  );

  return { viewing, ready: ready && dataIdentity.current === identity, onSaved };
}
