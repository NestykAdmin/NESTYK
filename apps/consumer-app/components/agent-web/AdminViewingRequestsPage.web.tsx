import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AdminViewingRequest, AdminViewingRequestDetail, ViewingRequestStatus } from "@nestyk/types";
import { fillTemplate, useLocale } from "@nestyk/i18n";
import { MobileIcon, useMobileTheme } from "@nestyk/ui/native";
import { ApiError } from "../../lib/api";
import {
  ADMIN_VR_TABS,
  actionsFor,
  closeReasonText,
  countByTab,
  eventKind,
  filterRequests,
  mergeRequests,
  pickSelection,
  replaceGroup,
  requestCode,
  scheduleIso,
  scheduleProblem,
  tabOf,
  type AdminVrAction,
  type AdminVrTab,
} from "../../lib/admin-viewing-requests";
import {
  getAdminViewingRequest,
  listAdminEndedViewingRequests,
  listAdminViewingRequests,
  moveAdminViewingRequest,
  type AdminViewingRequestMove,
} from "../../lib/admin-viewing-requests-api";
import { StatusBadge, StatusFilterChip, WebDialog, WebSkeleton, WebState, viewingRequestIntent } from "./ui";
import type { AdminViewingRequestsPageProps } from "./AdminViewingRequestsPage.types";
import "./admin-viewing-requests.css";

/** Load state of one group of the queue; a reload keeps "ready" so the list stays on screen while it refreshes. */
type LoadState = "idle" | "loading" | "error" | "ready";
type DetailState = { status: "idle" | "loading" | "error" } | { status: "ready"; data: AdminViewingRequestDetail };
type Dialog = null | "forward" | "schedule" | "close" | "cancel";

const REASONS = ["rented", "noContact", "notInterested", "wrongInfo", "other"] as const;
type Reason = (typeof REASONS)[number];

function intlLocale(locale: string): string {
  return locale === "th" ? "th-TH-u-ca-gregory" : locale;
}

function when(iso: string | null, locale: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

function ago(iso: string, locale: string, now: number): string {
  const minutes = Math.round((Date.parse(iso) - now) / 60000);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

/** Bangkok day and time of a moment, as the date and time inputs want them. */
function bangkokParts(iso: string | null): { day: string; time: string } {
  if (!iso) return { day: "", time: "" };
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  return { day, time };
}

/**
 * Admin web: viewing request queue (plan step 3; Mos picked 24 Nov 2026: split view, list on the left and the request
 * on the right; the existing admin API, counted and searched on the web; the menu shows the new count).
 * Buttons follow the API's state table (lib/admin-viewing-requests.ts actionsFor).
 */
export function AdminViewingRequestsPage({ onNewCount }: AdminViewingRequestsPageProps) {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.adminWeb.viewing;
  const [items, setItems] = useState<AdminViewingRequest[]>([]);
  const [openState, setOpenState] = useState<LoadState>("loading");
  const [endedState, setEndedState] = useState<LoadState>("idle");
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<AdminVrTab>("new");
  const [query, setQuery] = useState("");
  const [chosenId, setChosenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DetailState>({ status: "idle" });
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState({ day: "", time: "", note: "" });
  const [reason, setReason] = useState<Reason>("rented");
  const [reasonDetail, setReasonDetail] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);

  const loadErrorText = useRef(copy.loadError);
  loadErrorText.current = copy.loadError;

  // Open requests (new to scheduled): on open and on every reload (review R1: never mixed with the ended ones).
  useEffect(() => {
    let cancelled = false;
    setOpenState((state) => (state === "ready" ? state : "loading"));
    listAdminViewingRequests()
      .then((fresh) => {
        if (cancelled) return;
        setItems((list) => replaceGroup(list, fresh, "open"));
        setOpenState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        // A failed refresh keeps the list on screen and says so; a failed first load shows the error state.
        setOpenState((state) => (state === "ready" ? state : "error"));
        setNotice({ kind: "error", text: loadErrorText.current });
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  // Ended requests load only when their tab is open, and again on a reload while it is open.
  const endedTab = tab === "ended";
  useEffect(() => {
    if (!endedTab) return;
    let cancelled = false;
    setEndedState((state) => (state === "ready" ? state : "loading"));
    listAdminEndedViewingRequests()
      .then((fresh) => {
        if (cancelled) return;
        setItems((list) => replaceGroup(list, fresh, "ended"));
        setEndedState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        // A failed refresh keeps the list on screen and says so; a failed first load shows the error state.
        setEndedState((state) => (state === "ready" ? state : "error"));
        setNotice({ kind: "error", text: loadErrorText.current });
      });
    return () => {
      cancelled = true;
    };
  }, [endedTab, reload]);

  const tabState = endedTab ? endedState : openState;
  const counts = useMemo(() => countByTab(items), [items]);
  useEffect(() => {
    if (openState === "ready") onNewCount?.(counts.new);
  }, [openState, counts.new, onNewCount]);

  const shown = useMemo(() => filterRequests(items, tab, query), [items, tab, query]);
  const selectedId = pickSelection(items, tab, query, chosenId);
  // An action's answer can arrive after admin picked another request (review R6): it must not take over the panel.
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  useEffect(() => {
    if (selectedId == null) {
      setDetail({ status: "idle" });
      return;
    }
    let cancelled = false;
    setDetail((current) => (current.status === "ready" && current.data.id === selectedId ? current : { status: "loading" }));
    getAdminViewingRequest(selectedId)
      .then((data) => {
        if (!cancelled) setDetail({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setDetail({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, reload]);

  // A new request on the right starts with fresh notes and messages.
  useEffect(() => {
    setNotice(null);
    setNote("");
    setCopied(false);
  }, [selectedId]);

  const current = detail.status === "ready" && detail.data.id === selectedId ? detail.data : null;

  const run = useCallback(
    async (move: AdminViewingRequestMove, after?: () => void) => {
      if (!current || busy) return;
      const id = current.id;
      setBusy(true);
      setDialogError(null);
      try {
        const data = await moveAdminViewingRequest(id, move);
        setItems((list) => mergeRequests(list, [data]));
        setDialog(null);
        if (selectedRef.current !== id) return;
        setDetail({ status: "ready", data });
        setNotice({ kind: "ok", text: copy.saved });
        // The request moved to another tab (taken, forwarded, booked, ended): follow it there (review R2, Mos 24 Nov 2026).
        const nextTab = tabOf(data.status);
        if (nextTab !== tab) {
          setTab(nextTab);
          setChosenId(id);
        }
        after?.();
      } catch (error) {
        const code = error instanceof ApiError ? error.code : undefined;
        const text = code === "WRONG_STATUS" ? copy.errorWrongStatus : code === "NO_AGENT" ? copy.errorNoAgent : copy.errorFailed;
        if (code === "WRONG_STATUS") {
          setDialog(null);
          setReload((n) => n + 1);
          if (selectedRef.current === id) setNotice({ kind: "error", text });
        } else if (dialog) {
          setDialogError(text);
        } else if (selectedRef.current === id) {
          setNotice({ kind: "error", text });
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, copy, current, dialog, tab],
  );

  const openDialog = (next: Exclude<Dialog, null>) => {
    if (!current) return;
    setDialogError(null);
    if (next === "schedule") {
      const parts = bangkokParts(current.scheduledAt ?? current.preferredAt);
      setSchedule({ day: parts.day, time: parts.time, note: "" });
    }
    if (next === "close") {
      setReason("rented");
      setReasonDetail("");
    }
    setDialog(next);
  };

  const onAction = (action: AdminVrAction) => {
    if (action === "forward") openDialog("forward");
    else if (action === "schedule" || action === "reschedule") openDialog("schedule");
    else if (action === "close") openDialog("close");
    else if (action === "cancel") openDialog("cancel");
    else if (action === "take") void run({ action: "take" });
    else if (action === "viewed") void run({ action: "viewed" });
  };

  const statusText = (status: ViewingRequestStatus) => copy.status[status];
  const actionLabel = (action: AdminVrAction) => copy.actions[action];

  const info = (request: AdminViewingRequestDetail): string | null => {
    switch (request.status) {
      case "new":
        return request.isAgentRoom ? copy.infoNewAgent : copy.infoNewNestyk;
      case "awaiting_agent":
        return copy.infoWaiting;
      case "agent_handling":
        return copy.infoAgentHandling;
      case "admin_handling":
        return copy.infoAdminHandling;
      case "scheduled":
        return request.handledBy === "agent" ? copy.infoScheduledAgent : null;
      case "viewed":
        return copy.infoViewed;
      case "closed":
        return fillTemplate(copy.infoClosed, { reason: request.closeReason ?? "" });
      case "cancelled":
        return request.cancelledBy === "guest" ? copy.infoCancelledGuest : copy.infoCancelledAdmin;
      default:
        return null;
    }
  };

  const owner = (request: AdminViewingRequest) =>
    request.isAgentRoom
      ? request.agent
        ? fillTemplate(copy.ownerAgent, { name: request.agent.name })
        : copy.ownerAgentUnknown
      : copy.ownerNestyk;

  const now = Date.now();
  const tabLabel: Record<AdminVrTab, string> = copy.tabs;

  const submitSchedule = () => {
    const problem = scheduleProblem(schedule.day, schedule.time, Date.now());
    if (problem) {
      setDialogError(problem === "past" ? copy.errorTimePast : copy.errorTimeNeed);
      return;
    }
    void run({ action: "schedule", scheduledAt: scheduleIso(schedule.day, schedule.time), ...(schedule.note.trim() ? { note: schedule.note.trim() } : {}) });
  };

  const submitClose = () => {
    const text = closeReasonText(copy.reasons[reason], reasonDetail, reason === "other");
    if (!text) {
      setDialogError(copy.errorReason);
      return;
    }
    void run({ action: "close", reason: text });
  };

  const saveNote = () => {
    const text = note.trim();
    if (!text) {
      setNotice({ kind: "error", text: copy.errorNote });
      return;
    }
    void run({ action: "notes", note: text }, () => setNote(""));
  };

  const copyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="avr" data-testid="adminViewing.page">
      <div className="avr-top">
        <p className="avr-sub">{copy.subtitle}</p>
        <label className="avr-search">
          <MobileIcon name="search" size={18} color={theme.textSecondary} />
          <input
            type="search"
            value={query}
            placeholder={copy.search}
            aria-label={copy.search}
            onChange={(event) => setQuery(event.target.value)}
            data-testid="adminViewing.search"
          />
        </label>
        <button
          type="button"
          className="avr-btn"
          disabled={tabState === "loading"}
          onClick={() => setReload((n) => n + 1)}
          data-testid="adminViewing.refresh"
        >
          {copy.refresh}
        </button>
      </div>
      <div className="avr-tabs" role="group" aria-label={copy.title} data-testid="adminViewing.tabs">
        {ADMIN_VR_TABS.map((value) => (
          <StatusFilterChip
            key={value}
            label={tabLabel[value]}
            count={(value === "ended" ? endedState : openState) === "ready" ? counts[value] : undefined}
            selected={tab === value}
            onPress={() => setTab(value)}
          />
        ))}
      </div>

      <div className="avr-split">
        <section className="avr-card avr-list" aria-label={copy.title}>
          {tabState === "loading" || tabState === "idle" ? (
            <WebSkeleton rows={6} columns={2} />
          ) : tabState === "error" ? (
            <WebState kind="error" compact title={copy.loadError} onRetry={() => setReload((n) => n + 1)} />
          ) : shown.length === 0 ? (
            <WebState kind={query.trim() ? "filtered" : "empty"} compact title={query.trim() ? copy.emptySearch : copy.empty} onClearFilters={query.trim() ? () => setQuery("") : undefined} />
          ) : (
            <ul className="avr-items" data-testid="adminViewing.list">
              {shown.map((request) => {
                const on = request.id === selectedId;
                return (
                  <li key={request.id}>
                    <button
                      type="button"
                      className={on ? "avr-item is-on" : "avr-item"}
                      aria-current={on ? "true" : undefined}
                      onClick={() => setChosenId(request.id)}
                    >
                      {request.status === "new" ? <span className="avr-dot" aria-hidden="true" /> : null}
                      <span className="avr-item-main">
                        <span className="avr-item-room">{request.room.title}</span>
                        <span className="avr-item-sub">
                          {request.contact.name} · {when(request.preferredAt, locale)}
                        </span>
                      </span>
                      <span className="avr-item-side">
                        <StatusBadge label={statusText(request.status)} intent={viewingRequestIntent(request.status)} />
                        <span className="avr-item-age">{ago(request.createdAt, locale, now)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="avr-card avr-detail" aria-label={current ? current.room.title : copy.pick} data-testid="adminViewing.detail">
          {selectedId == null ? (
            tabState === "ready" ? <p className="avr-pick">{copy.pick}</p> : null
          ) : detail.status === "error" ? (
            <WebState kind="error" compact title={copy.loadError} onRetry={() => setReload((n) => n + 1)} />
          ) : !current ? (
            <WebSkeleton rows={6} columns={2} />
          ) : (
            <>
              <header className="avr-head">
                <div className="avr-head-row">
                  <h2>{current.room.title}</h2>
                  <StatusBadge label={statusText(current.status)} intent={viewingRequestIntent(current.status)} />
                </div>
                <p className="avr-head-sub">
                  <span>#{requestCode(current.id)}</span>
                  <span>{fillTemplate(copy.sent, { date: when(current.createdAt, locale) })}</span>
                  <span>{current.isAgentRoom ? copy.agentRoom : copy.nestykRoom}</span>
                </p>
              </header>

              {(() => {
                const acts = actionsFor(current);
                if (!acts.primary.length && !acts.secondary.length) return null;
                return (
                  <div className="avr-acts" data-testid="adminViewing.actions">
                    {acts.primary.map((action, i) => (
                      <button
                        key={action}
                        type="button"
                        className={i === 0 ? "avr-btn is-primary" : "avr-btn"}
                        disabled={busy}
                        onClick={() => onAction(action)}
                        data-testid={`adminViewing.${action}`}
                      >
                        {actionLabel(action)}
                      </button>
                    ))}
                    <span className="avr-grow" />
                    {acts.secondary.map((action) => (
                      <button
                        key={action}
                        type="button"
                        className={action === "close" ? "avr-btn is-danger" : "avr-btn"}
                        disabled={busy}
                        onClick={() => onAction(action)}
                        data-testid={`adminViewing.${action}`}
                      >
                        {actionLabel(action)}
                      </button>
                    ))}
                  </div>
                );
              })()}

              {notice ? (
                <p className={notice.kind === "ok" ? "avr-notice is-ok" : "avr-notice is-error"} role={notice.kind === "ok" ? "status" : "alert"}>
                  {notice.text}
                </p>
              ) : null}
              {info(current) ? (
                <p className="avr-info">
                  <MobileIcon name="info" size={16} color={theme.textSecondary} />
                  <span>{info(current)}</span>
                </p>
              ) : null}

              <dl className="avr-facts">
                <div>
                  <dt>{copy.guest}</dt>
                  <dd>
                    <strong>{current.contact.name}</strong>
                  </dd>
                </div>
                <div>
                  <dt>{copy.phone}</dt>
                  <dd>
                    {current.contact.phone}
                    <button type="button" className="avr-mini" aria-live="polite" onClick={() => void copyPhone(current.contact.phone)}>
                      {copied ? copy.copied : copy.copy}
                    </button>
                    <a className="avr-mini" href={`tel:${current.contact.phone.replace(/[^\d+]/g, "")}`}>
                      {copy.call}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>{copy.preferred}</dt>
                  <dd>{when(current.preferredAt, locale)}</dd>
                </div>
                <div>
                  <dt>{copy.scheduledAt}</dt>
                  <dd>{current.scheduledAt ? when(current.scheduledAt, locale) : copy.notScheduled}</dd>
                </div>
                <div>
                  <dt>{copy.email}</dt>
                  <dd>{current.contact.email ?? "—"}</dd>
                </div>
                <div>
                  <dt>{copy.owner}</dt>
                  <dd>{owner(current)}</dd>
                </div>
                <div className="avr-full">
                  <dt>{copy.message}</dt>
                  <dd>
                    <span className="avr-msg">{current.message ?? copy.noMessage}</span>
                  </dd>
                </div>
              </dl>

              <div className="avr-tl">
                <h3>{copy.timeline}</h3>
                <ol>
                  {current.events.map((event, i) => {
                    const kind = eventKind(event);
                    const what =
                      kind === "created"
                        ? copy.eventCreated
                        : kind === "reschedule"
                          ? copy.actions.reschedule
                          : kind === "note"
                            ? copy.eventNote
                            : statusText(event.toStatus);
                    return (
                      <li key={event.id} className={i === current.events.length - 1 ? "is-last" : undefined}>
                        <span className="avr-tl-dot" aria-hidden="true" />
                        <span className="avr-tl-text">
                          <strong>{event.actorName ?? copy.eventSystem}</strong> · {what}
                          {event.note ? <span className="avr-tl-note">“{event.note}”</span> : null}
                        </span>
                        <span className="avr-tl-at">{when(event.createdAt, locale)}</span>
                      </li>
                    );
                  })}
                </ol>
                <div className="avr-note">
                  <input
                    type="text"
                    value={note}
                    maxLength={500}
                    placeholder={copy.notePlaceholder}
                    aria-label={copy.notePlaceholder}
                    onChange={(event) => setNote(event.target.value)}
                    onKeyDown={(event) => {
                      // Enter that confirms an IME word (ja, zh) must not save the note (review R9).
                      if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) saveNote();
                    }}
                  />
                  <button type="button" className="avr-btn" disabled={busy} onClick={saveNote}>
                    {copy.noteSave}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <WebDialog
        open={dialog === "forward"}
        title={copy.forwardTitle}
        onClose={() => setDialog(null)}
        size="sm"
        testID="adminViewing.forwardDialog"
        footer={
          <>
            <button type="button" className="avr-btn" onClick={() => setDialog(null)}>
              {copy.dismiss}
            </button>
            <button type="button" className="avr-btn is-primary" disabled={busy} onClick={() => void run({ action: "forward" })}>
              {copy.forwardConfirm}
            </button>
          </>
        }
      >
        <p className="avr-dlg-text">{copy.forwardBody}</p>
        <p className="avr-info">{copy.forwardHint}</p>
        {dialogError ? <p className="avr-notice is-error" role="alert">{dialogError}</p> : null}
      </WebDialog>

      <WebDialog
        open={dialog === "schedule"}
        title={copy.scheduleTitle}
        onClose={() => setDialog(null)}
        size="sm"
        testID="adminViewing.scheduleDialog"
        footer={
          <>
            <button type="button" className="avr-btn" onClick={() => setDialog(null)}>
              {copy.dismiss}
            </button>
            <button type="button" className="avr-btn is-primary" disabled={busy} onClick={submitSchedule}>
              {copy.scheduleConfirm}
            </button>
          </>
        }
      >
        {current ? <p className="avr-info">{fillTemplate(copy.scheduleAsked, { when: when(current.preferredAt, locale) })}</p> : null}
        <div className="avr-grid2">
          <label className="avr-field">
            <span>{copy.scheduleDate}</span>
            <input type="date" value={schedule.day} onChange={(event) => setSchedule((s) => ({ ...s, day: event.target.value }))} />
          </label>
          <label className="avr-field">
            <span>{copy.scheduleTime}</span>
            <input type="time" step={1800} value={schedule.time} onChange={(event) => setSchedule((s) => ({ ...s, time: event.target.value }))} />
          </label>
        </div>
        <label className="avr-field">
          <span>{copy.noteOptional}</span>
          <input type="text" maxLength={500} value={schedule.note} onChange={(event) => setSchedule((s) => ({ ...s, note: event.target.value }))} />
        </label>
        {dialogError ? <p className="avr-notice is-error" role="alert">{dialogError}</p> : null}
      </WebDialog>

      <WebDialog
        open={dialog === "close"}
        title={copy.closeTitle}
        description={copy.closeHint}
        onClose={() => setDialog(null)}
        size="sm"
        testID="adminViewing.closeDialog"
        footer={
          <>
            <button type="button" className="avr-btn" onClick={() => setDialog(null)}>
              {copy.dismiss}
            </button>
            <button type="button" className="avr-btn is-ink" disabled={busy} onClick={submitClose}>
              {copy.closeConfirm}
            </button>
          </>
        }
      >
        <div className="avr-chips" role="group" aria-label={copy.closeTitle}>
          {REASONS.map((value) => (
            <button key={value} type="button" className={reason === value ? "avr-chip is-on" : "avr-chip"} aria-pressed={reason === value} onClick={() => setReason(value)}>
              {copy.reasons[value]}
            </button>
          ))}
        </div>
        <label className="avr-field">
          <span>{copy.closeDetail}</span>
          <textarea rows={3} maxLength={500} placeholder={copy.closeDetailHint} value={reasonDetail} onChange={(event) => setReasonDetail(event.target.value)} />
        </label>
        {dialogError ? <p className="avr-notice is-error" role="alert">{dialogError}</p> : null}
      </WebDialog>

      <WebDialog
        open={dialog === "cancel"}
        title={copy.cancelTitle}
        description={copy.cancelBody}
        onClose={() => setDialog(null)}
        size="sm"
        testID="adminViewing.cancelDialog"
        footer={
          <>
            <button type="button" className="avr-btn" onClick={() => setDialog(null)}>
              {copy.dismiss}
            </button>
            <button type="button" className="avr-btn is-ink" disabled={busy} onClick={() => void run({ action: "cancel" })}>
              {copy.cancelConfirm}
            </button>
          </>
        }
      >
        {dialogError ? <p className="avr-notice is-error" role="alert">{dialogError}</p> : null}
      </WebDialog>
    </div>
  );
}
