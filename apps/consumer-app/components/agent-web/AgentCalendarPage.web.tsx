import React, { useMemo, useState } from "react";
import type { LeadViewing } from "@nestyk/types";
import { useLocale } from "@nestyk/i18n";
import { MobileIcon } from "@nestyk/ui/native";
import { calendarDateKey, calendarLocalDate } from "../../lib/agent-calendar-demo";
import { viewingToCalendarEvent, type CalendarViewingEvent } from "../../lib/agent-calendar-viewings";
import {
  VIEWING_STATE_KEYS,
  buildMonthGrid,
  countByState,
  eventsInMonth,
  filterCalendarEvents,
  groupEventsByDate,
  shiftMonth,
  viewingStateKey,
  type ViewingStateKey,
} from "../../lib/agent-calendar-grid";
import { LeadViewingSheet } from "../LeadViewingSheet";
import { STATUS_INTENT_TONES, StatusBadge, WebSkeleton, WebState, viewingIntent, type StatusIntent } from "./ui";
import type { AgentCalendarPageProps } from "./AgentCalendarPage.types";
import "./agent-calendar.css";

/** D2 (Mos 6 Nov 2026): the week starts on Monday, as the app's calendar (`firstDay={1}`). */
const WEEK_START = 1;
const CHIPS_PER_DAY = 3;
const LOCALE_TAG = { th: "th-TH", en: "en-GB", zh: "zh-CN", ja: "ja-JP" } as const;
const STATE_INTENT: Record<ViewingStateKey, StatusIntent> = { scheduled: "prog", done: "done", overdue: "attn" };
const ALL_STATES: ReadonlySet<ViewingStateKey> = new Set(VIEWING_STATE_KEYS);
type View = "month" | "agenda";

/**
 * Agent web calendar (W13, Mos 6 Nov 2026): day picker, status filter and the selected day on the left;
 * month grid or list on the right. Same rows (cancelled left out), same reschedule/cancel editor
 * (`LeadViewingSheet`) and same rule as the app: viewings are scheduled from a lead, never created here.
 */
export function AgentCalendarPage({
  viewings,
  status,
  onRetry,
  onSaved,
  selectedDate,
  onSelectDate,
  visibleMonth,
  onMonthChange,
  onOpenLeads,
}: AgentCalendarPageProps) {
  const { t, locale } = useLocale();
  const copy = t.agent.calendar;
  const web = copy.web;
  const tag = LOCALE_TAG[locale as keyof typeof LOCALE_TAG] ?? "en-GB";
  const [view, setView] = useState<View>("month");
  const [hidden, setHidden] = useState<ViewingStateKey[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<LeadViewing | null>(null);

  const ready = status === "available";
  const now = new Date();
  const todayKey = calendarDateKey(now);
  const events = useMemo(
    () => (ready ? viewings.filter((row) => row.status !== "cancelled").map(viewingToCalendarEvent) : []),
    [viewings, ready],
  );
  const states = new Set(VIEWING_STATE_KEYS.filter((key) => !hidden.includes(key)));
  const shown = filterCalendarEvents(events, { states, query, now });
  const byDate = groupEventsByDate(shown);
  const monthShown = eventsInMonth(shown, visibleMonth);
  // Counts follow the search but not the status switches (each switch shows what it would bring back).
  const counts = countByState(eventsInMonth(filterCalendarEvents(events, { states: ALL_STATES, query, now }), visibleMonth), now);
  const filtered = hidden.length > 0 || query.trim() !== "";
  const cells = buildMonthGrid(visibleMonth, WEEK_START, now);
  const rows = Array.from({ length: cells.length / 7 }, (_, row) => cells.slice(row * 7, row * 7 + 7));
  const dayList = byDate.get(selectedDate) ?? [];
  const agenda = [...groupEventsByDate(monthShown).entries()];

  const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, options);
  const monthLabel = fmt({ month: "long", year: "numeric" }).format(calendarLocalDate(visibleMonth));
  const weekdays = cells.slice(0, 7).map((cell) => fmt({ weekday: "short" }).format(calendarLocalDate(cell.dateKey)));
  const dayLabel = (key: string) => fmt({ weekday: "long", day: "numeric", month: "long" }).format(calendarLocalDate(key));
  const countLabel = (count: number) => copy.eventCount.replace("{count}", String(count));
  const stateLabel: Record<ViewingStateKey, string> = {
    scheduled: web.stateScheduled,
    done: web.stateDone,
    overdue: web.stateOverdue,
  };
  const stateOf = (event: CalendarViewingEvent): ViewingStateKey => viewingStateKey(event.viewing, now) ?? "scheduled";
  const intentOf = (event: CalendarViewingEvent) => viewingIntent(event.viewing.status, event.viewing.scheduledAt, now);
  const dotStyle = (intent: StatusIntent) => ({ background: STATUS_INTENT_TONES[intent].dot });

  const pickDay = (key: string) => {
    onSelectDate(key);
    if (key.slice(0, 7) !== visibleMonth.slice(0, 7)) onMonthChange(`${key.slice(0, 7)}-01`);
  };
  const goToday = () => {
    onSelectDate(todayKey);
    onMonthChange(`${todayKey.slice(0, 7)}-01`);
  };
  const toggleState = (key: ViewingStateKey) =>
    setHidden((list) => (list.includes(key) ? list.filter((item) => item !== key) : [...list, key]));
  const clearFilters = () => {
    setHidden([]);
    setQuery("");
  };
  // Only a viewing that is still scheduled can be moved or cancelled (same as the app).
  const manageButton = (event: CalendarViewingEvent) =>
    event.viewing.status === "scheduled" ? (
      <button
        type="button"
        className="awu-btn awc-manage"
        onClick={() => setEditing(event.viewing)}
        data-testid={`calendar.manage.${event.viewing.id}`}
      >
        {copy.manage}
      </button>
    ) : null;
  const monthButtons = (
    <>
      <button type="button" className="awc-icon-btn" aria-label={copy.previousMonth} onClick={() => onMonthChange(shiftMonth(visibleMonth, -1))}>
        <MobileIcon name="chevron-left" size={16} color="currentColor" />
      </button>
      <button type="button" className="awc-icon-btn" aria-label={copy.nextMonth} onClick={() => onMonthChange(shiftMonth(visibleMonth, 1))}>
        <MobileIcon name="chevron-right" size={16} color="currentColor" />
      </button>
    </>
  );

  return (
    <div className="awc-page" data-testid="calendar.page">
      <div className="awc-head">
        <p className="awc-hint">{web.headerHint}</p>
        {onOpenLeads ? (
          <button type="button" className="awu-btn" onClick={onOpenLeads} data-testid="calendar.openLeads">
            {web.openLeads}
            <MobileIcon name="chevron-right" size={16} color="currentColor" />
          </button>
        ) : null}
      </div>

      <div className="awc-layout">
        <div className="awc-side">
          <section className="awc-card awc-picker" aria-label={web.pickDay} data-testid="calendar.picker">
            <div className="awc-picker-head">
              <strong>{monthLabel}</strong>
              {monthButtons}
            </div>
            <div className="awc-mini" role="group" aria-label={monthLabel}>
              {weekdays.map((day, index) => (
                <span key={`dow-${index}`} className="awc-mini-dow" aria-hidden="true">
                  {day}
                </span>
              ))}
              {cells.map((cell) => {
                const selected = cell.dateKey === selectedDate;
                const has = (byDate.get(cell.dateKey) ?? []).length > 0;
                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    className={`awc-mini-day${cell.inMonth ? "" : " is-out"}${selected ? " is-selected" : ""}${cell.isToday ? " is-today" : ""}${has ? " has-events" : ""}`}
                    aria-pressed={selected}
                    aria-current={cell.isToday ? "date" : undefined}
                    aria-label={dayLabel(cell.dateKey)}
                    onClick={() => pickDay(cell.dateKey)}
                    data-testid={`calendar.mini.${cell.dateKey}`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="awc-card" aria-labelledby="awc-status-title" data-testid="calendar.status">
            <h2 id="awc-status-title" className="awc-card-title">
              {web.statusTitle}
            </h2>
            {VIEWING_STATE_KEYS.map((key) => (
              <label key={key} className="awc-check">
                <input
                  type="checkbox"
                  checked={!hidden.includes(key)}
                  onChange={() => toggleState(key)}
                  data-testid={`calendar.status.${key}`}
                />
                <span className="awc-dot" style={dotStyle(STATE_INTENT[key])} aria-hidden="true" />
                <span className="awc-check-label">{stateLabel[key]}</span>
                <b>{ready ? counts[key] : "–"}</b>
              </label>
            ))}
          </section>

          <section className="awc-card" aria-labelledby="awc-day-title" data-testid="calendar.dayList">
            <h2 id="awc-day-title" className="awc-card-title">
              {ready
                ? web.dayTitle.replace("{day}", dayLabel(selectedDate)).replace("{count}", countLabel(dayList.length))
                : dayLabel(selectedDate)}
            </h2>
            {status === "loading" ? (
              <WebSkeleton rows={2} columns={1} testID="calendar.dayLoading" />
            ) : status === "error" ? (
              <p className="awc-muted">{copy.loadError}</p>
            ) : dayList.length === 0 ? (
              <div className="awc-day-empty">
                <strong>{copy.emptyTitle}</strong>
                <span className="awc-muted">{copy.emptyHint}</span>
              </div>
            ) : (
              <ul className="awc-day-list">
                {dayList.map((event) => (
                  <li key={event.id} className="awc-day-item">
                    <i className="awc-bar" style={dotStyle(intentOf(event))} aria-hidden="true" />
                    <div className="awc-day-main">
                      <strong>{event.location}</strong>
                      <span className="awc-muted">{`${event.time} · ${event.viewing.leadName}`}</span>
                      <div className="awc-day-actions">
                        <StatusBadge label={stateLabel[stateOf(event)]} intent={intentOf(event)} />
                        {manageButton(event)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="awc-card awc-main" aria-label={web.monthGridLabel}>
          <div className="awc-toolbar" data-testid="calendar.toolbar">
            <button type="button" className="awu-btn awc-today" onClick={goToday}>
              {copy.today}
            </button>
            {monthButtons}
            <h2 className="awc-month">{monthLabel}</h2>
            <span className="awc-muted" aria-live="polite">
              {ready ? web.monthCount.replace("{count}", String(monthShown.length)) : ""}
            </span>
            <label className="awc-search" title={web.searchScope}>
              <MobileIcon name="search" size={16} color="currentColor" />
              <input
                type="search"
                value={query}
                placeholder={web.searchPlaceholder}
                aria-label={web.searchLabel}
                aria-describedby="awc-search-scope"
                onChange={(event) => setQuery(event.target.value)}
                data-testid="calendar.search"
              />
              <span id="awc-search-scope" className="awu-sr">
                {web.searchScope}
              </span>
            </label>
            <div className="awc-view" role="tablist" aria-label={web.viewLabel}>
              <button
                type="button"
                role="tab"
                aria-selected={view === "month"}
                className={`awc-view-btn${view === "month" ? " is-active" : ""}`}
                onClick={() => setView("month")}
                data-testid="calendar.view.month"
              >
                {web.viewMonth}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={false}
                className="awc-view-btn"
                disabled
                title={web.viewWeekSoon}
                data-testid="calendar.view.week"
              >
                {web.viewWeek}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "agenda"}
                className={`awc-view-btn${view === "agenda" ? " is-active" : ""}`}
                onClick={() => setView("agenda")}
                data-testid="calendar.view.agenda"
              >
                {web.viewAgenda}
              </button>
            </div>
          </div>

          {status === "loading" ? (
            <WebSkeleton rows={6} columns={7} testID="calendar.loading" />
          ) : status === "error" ? (
            <WebState kind="error" title={copy.loadError} onRetry={onRetry} testID="calendar.error" />
          ) : (
            <>
              {monthShown.length === 0 ? (
                filtered ? (
                  <div className="awc-notice" role="status" data-testid="calendar.noMatch">
                    <span>{web.noMatch}</span>
                    <button type="button" className="awu-btn" onClick={clearFilters}>
                      {t.agent.tenants.clearFilters}
                    </button>
                  </div>
                ) : (
                  <div className="awc-notice" role="status" data-testid="calendar.emptyMonth">
                    <span>{web.emptyMonth}</span>
                    <span className="awc-muted">{copy.emptyHint}</span>
                  </div>
                )
              ) : null}

              {view === "month" ? (
                <div className="awc-grid" role="grid" aria-label={web.monthGridLabel} data-testid="calendar.monthGrid">
                  <div role="row" className="awc-grid-row awc-grid-head">
                    {weekdays.map((day, index) => (
                      <span key={`head-${index}`} role="columnheader" className="awc-gh">
                        {day}
                      </span>
                    ))}
                  </div>
                  {rows.map((week) => (
                    <div key={week[0].dateKey} role="row" className="awc-grid-row">
                      {week.map((cell) => {
                        const list = byDate.get(cell.dateKey) ?? [];
                        const selected = cell.dateKey === selectedDate;
                        return (
                          <div key={cell.dateKey} role="gridcell" aria-selected={selected} className="awc-gc">
                            <button
                              type="button"
                              className={`awc-cell${cell.inMonth ? "" : " is-out"}${selected ? " is-selected" : ""}${cell.isToday ? " is-today" : ""}`}
                              aria-current={cell.isToday ? "date" : undefined}
                              aria-label={`${dayLabel(cell.dateKey)}, ${countLabel(list.length)}`}
                              onClick={() => pickDay(cell.dateKey)}
                              data-testid={`calendar.day.${cell.dateKey}`}
                            >
                              <span className="awc-num">{cell.day}</span>
                              {list.slice(0, CHIPS_PER_DAY).map((event) => (
                                <span key={event.id} className={`awc-chip is-${stateOf(event)}`} title={`${event.time} · ${event.title}`}>
                                  <span className="awc-dot" style={dotStyle(intentOf(event))} aria-hidden="true" />
                                  <span className="awc-chip-time">{event.time}</span>
                                  <span className="awc-chip-text">{event.viewing.roomTitle}</span>
                                </span>
                              ))}
                              {list.length > CHIPS_PER_DAY ? (
                                <span className="awc-more">{web.moreCount.replace("{count}", String(list.length - CHIPS_PER_DAY))}</span>
                              ) : null}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="awc-agenda" aria-label={web.agendaLabel} data-testid="calendar.agenda">
                  {agenda.map(([dateKey, list]) => {
                    const date = calendarLocalDate(dateKey);
                    return (
                      <section key={dateKey} className={`awc-ag${dateKey === todayKey ? " is-today" : ""}`} aria-label={dayLabel(dateKey)}>
                        <div className="awc-ag-date" aria-hidden="true">
                          <span>{fmt({ weekday: "short" }).format(date)}</span>
                          <span className="awc-ag-num">{date.getDate()}</span>
                        </div>
                        <ul className="awc-ag-list">
                          {list.map((event) => (
                            <li key={event.id} className="awc-ag-item">
                              <i className="awc-bar" style={dotStyle(intentOf(event))} aria-hidden="true" />
                              <span className="awc-ag-time">{event.time}</span>
                              <span className="awc-ag-main">
                                <strong>{web.viewingOf.replace("{room}", event.location)}</strong>
                                <span className="awc-muted">{event.viewing.leadName}</span>
                              </span>
                              <StatusBadge label={stateLabel[stateOf(event)]} intent={intentOf(event)} />
                              {manageButton(event)}
                            </li>
                          ))}
                        </ul>
                      </section>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {editing ? (
        <LeadViewingSheet
          visible
          leadId={editing.leadId}
          roomId={editing.rentRoomId}
          viewing={editing}
          onClose={() => setEditing(null)}
          onSaved={(row) => {
            setEditing(null);
            onSaved(row);
          }}
        />
      ) : null}
    </div>
  );
}
