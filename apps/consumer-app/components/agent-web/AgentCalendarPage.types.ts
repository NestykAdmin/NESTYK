import type { LeadViewing } from "@nestyk/types";

/** Same props as the app's `AgentCalendarScreen` (rows come from `useAgentCalendarViewings` in app/index.tsx). */
export interface AgentCalendarPageProps {
  viewings: LeadViewing[];
  status: "loading" | "available" | "error";
  onRetry: () => void;
  onSaved: (viewing: LeadViewing) => void;
  /** Selected day, YYYY-MM-DD. */
  selectedDate: string;
  onSelectDate: (date: string) => void;
  /** First day of the month on screen, YYYY-MM-01. */
  visibleMonth: string;
  onMonthChange: (date: string) => void;
  /** Desktop web: viewings are scheduled from a lead (as in the app), so the page links to the leads list. */
  onOpenLeads?: () => void;
}
