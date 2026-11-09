import React from "react";
import { AgentCalendarScreen } from "../AgentCalendarScreen";
import type { AgentCalendarPageProps } from "./AgentCalendarPage.types";

/** Platform fallback: native keeps the app's calendar; the web page and its CSS stay out of native bundles. */
export function AgentCalendarPage({
  viewings,
  status,
  onRetry,
  onSaved,
  selectedDate,
  onSelectDate,
  visibleMonth,
  onMonthChange,
}: AgentCalendarPageProps) {
  return (
    <AgentCalendarScreen
      viewings={viewings}
      status={status}
      onRetry={onRetry}
      onSaved={onSaved}
      selectedDate={selectedDate}
      onSelectDate={onSelectDate}
      visibleMonth={visibleMonth}
      onMonthChange={onMonthChange}
    />
  );
}
