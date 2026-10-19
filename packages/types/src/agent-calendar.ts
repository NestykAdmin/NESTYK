/** Appointments entered directly in the agent calendar. Lead room viewings keep their own lifecycle. */
export interface AgentCalendarEvent {
  id: string;
  title: string;
  location: string;
  startsAt: string;
  /** Legacy category returned for older clients; new appointments only need a title. */
  kind: string;
  status: 'pending' | 'confirmed' | 'scheduled' | 'done' | 'cancelled';
}
export type CreateAgentCalendarEvent = Pick<AgentCalendarEvent, 'title' | 'location' | 'startsAt'>;

export type UpdateAgentCalendarEvent = Partial<CreateAgentCalendarEvent> & { status?: 'scheduled' | 'done' | 'cancelled' };
