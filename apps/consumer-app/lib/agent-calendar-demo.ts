/** UI-only fixtures for follow-ups and contracts. Never reads or writes an API or persistent storage; viewings come from `agent-calendar-viewings`. */
export type CalendarEventKind = 'viewing' | 'followUp' | 'contract';
export interface CalendarDemoEvent {
  id: string;
  date: string;
  time: string;
  kind: CalendarEventKind;
  title: string;
  location: string;
  status: 'confirmed' | 'pending';
}

export function calendarDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function calendarLocalDate(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function createCalendarDemoEvents(today = new Date()): CalendarDemoEvent[] {
  const date = calendarDateKey(today);
  const shifted = (days: number) => {
    const next = calendarLocalDate(date);
    next.setDate(next.getDate() + days);
    return calendarDateKey(next);
  };
  return [
    { id: 'demo-2', date, time: '13:30', kind: 'followUp', title: 'Non · BTS On Nut', location: 'BTS On Nut', status: 'pending' },
    { id: 'demo-3', date, time: '16:00', kind: 'contract', title: 'Ploy · Life Asoke', location: 'Life Asoke · 2105', status: 'confirmed' },
    { id: 'demo-5', date: shifted(3), time: '14:00', kind: 'followUp', title: 'Bank · Ashton Asoke', location: 'Ashton Asoke', status: 'pending' },
    { id: 'demo-6', date: shifted(-2), time: '09:30', kind: 'contract', title: 'Mint · Rhythm Ekkamai', location: 'Rhythm Ekkamai · 905', status: 'confirmed' },
  ];
}
