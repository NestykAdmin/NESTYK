import React, { useEffect, useRef, useState } from 'react';
import type { UpdateAgentCalendarEvent } from '@nestyk/types';
import { AgentCalendarScreen } from './AgentCalendarScreen';
import { calendarViewingRange, viewingToCalendarEvent } from '../lib/agent-calendar-viewings';
import { calendarEventFromApi, calendarEventInput, type CalendarEvent, type CalendarEventInput, type CalendarSource } from '../lib/agent-calendar';
import { listAgentViewings } from '../lib/agent-leads-api';
import { listCalendarEvents, createCalendarEvent, updateCalendarEvent } from '../lib/agent-calendar-api';

type Props = Omit<React.ComponentProps<typeof AgentCalendarScreen>, 'events' | 'onAdd' | 'onUpdate' | 'loading' | 'failedSources' | 'onRetry'> & {
  reloadToken: number;
  onReloadSettled: (token: number) => void;
};
export function AgentCalendarBody({ reloadToken, onReloadSettled, ...props }: Props) {
  const [rows, setRows] = useState<Record<CalendarSource, CalendarEvent[]>>({ lead: [], manual: [] });
  const [loading, setLoading] = useState(true);
  const [failedSources, setFailedSources] = useState<CalendarSource[]>([]);
  const [retry, setRetry] = useState<{ source: CalendarSource; revision: number }>({ source: 'manual', revision: 0 });
  const mounted = useRef(true);
  const generation = useRef(0);
  const lastScope = useRef('');
  const lastRetry = useRef(-1);
  const lastMonth = useRef(props.visibleMonth);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; ++generation.current; }; }, []);
  useEffect(() => {
    const request = ++generation.current;
    const scope = `${props.visibleMonth}:${reloadToken}`;
    const targeted = scope === lastScope.current && retry.revision > 0 && retry.revision !== lastRetry.current;
    const sources: CalendarSource[] = targeted ? [retry.source] : ['lead', 'manual'];
    lastRetry.current = retry.revision;
    lastScope.current = scope;
    if (lastMonth.current !== props.visibleMonth) {
      setRows({ lead: [], manual: [] }); setFailedSources([]);
      lastMonth.current = props.visibleMonth;
    }
    setLoading(true);
    const { from, to } = calendarViewingRange(props.visibleMonth);
    Promise.allSettled(sources.map(source => {
      const read = source === 'lead'
        ? listAgentViewings(from, to).then(items => items.map(viewingToCalendarEvent))
        : listCalendarEvents(from, to).then(items => items.map(calendarEventFromApi));
      return read.then(items => {
        if (generation.current !== request) return;
        setRows(previous => ({ ...previous, [source]: items }));
        setFailedSources(previous => previous.filter(item => item !== source));
      }).catch(() => {
        if (generation.current !== request) return;
        // Keep this source's last successful data if a refresh fails.
        setFailedSources(previous => previous.includes(source) ? previous : [...previous, source]);
      });
    }))
      .finally(() => { if (generation.current === request) { setLoading(false); onReloadSettled(reloadToken); } });
    return () => { ++generation.current; };
  }, [props.visibleMonth, reloadToken, retry, onReloadSettled]);
  const saved = (event: Parameters<typeof calendarEventFromApi>[0]) => {
    if (!mounted.current) return;
    const row = calendarEventFromApi(event);
    setRows(previous => ({ ...previous, manual: [...previous.manual.filter(item => item.id !== row.id), ...(row.status === 'cancelled' ? [] : [row])] }));
    setRetry(previous => ({ source: 'manual', revision: previous.revision + 1 }));
  };
  const add = async (draft: CalendarEventInput) => saved(await createCalendarEvent(calendarEventInput(draft)));
  const update = async (id: string, patch: UpdateAgentCalendarEvent) => saved(await updateCalendarEvent(id, patch));
  return <AgentCalendarScreen {...props} events={[...rows.lead, ...rows.manual]} onAdd={add} onUpdate={update} loading={loading} failedSources={failedSources}
    onRetry={source => setRetry(previous => ({ source, revision: previous.revision + 1 }))} />;
}
