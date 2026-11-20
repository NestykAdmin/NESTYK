import React, { useId } from "react";
import { useLocale } from "@nestyk/i18n";
import { MobileIcon, tokens, useMobileTheme } from "@nestyk/ui/native";
import { interpolate, type DashboardSectionStatus } from "@nestyk/feature-listing";
import { WebContentContainer } from "@nestyk/ui/web-content";
import { WebSkeleton, WebState } from "../agent-web/ui/WebState";
import {
  SELF_OWNER_LOCALE_TAG,
  SELF_OWNER_PREVIEW,
  summarizeRent,
  summarizeRooms,
  type SelfOwnerRoom,
  type SelfOwnerWorkKind,
} from "../../lib/self-owner-dashboard";
import type { SelfOwnerOverviewProps } from "./SelfOwnerOverview.types";
import "./self-owner-overview.css";

const TODO_ORDER: SelfOwnerWorkKind[] = ["overdue_rent", "new_interest", "awaiting_signature", "renewal"];

function Section({ title, aside, className = "", children }: { title: string; aside?: React.ReactNode; className?: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section className={`sov-section ${className}`} aria-labelledby={id}>
      <div className="sov-section-head">
        <h2 id={id}>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * Self owner web Dashboard (UI round, 19 Nov 2026, ClickUp z8rcteng6b). Same theme as the agent overview
 * (--aw-* tokens, Mitr headings), laid out around the owner's own rooms. Pages it would link to do not exist yet,
 * so it has no navigation; the one action is shown disabled as "coming soon".
 */
export function SelfOwnerOverview({ snapshot, deletionScheduledFor, onOpenRooms }: SelfOwnerOverviewProps) {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.selfOwnerDashboard;
  const tag = SELF_OWNER_LOCALE_TAG[locale as keyof typeof SELF_OWNER_LOCALE_TAG] ?? SELF_OWNER_LOCALE_TAG.th;
  const isDark = theme.mode === "dark";

  const money = (amount: number) =>
    new Intl.NumberFormat(tag, { style: "currency", currency: snapshot.currency, maximumFractionDigits: 0 }).format(amount);
  const day = (ymd: string, withYear: boolean) =>
    new Date(`${ymd}T00:00:00+07:00`).toLocaleDateString(tag, {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" as const } : {}),
      timeZone: "Asia/Bangkok",
    });
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" });
  const period = new Date(snapshot.rent.periodYear, snapshot.rent.periodMonth - 1, 1).toLocaleDateString(tag, {
    month: "long",
    year: "numeric",
  });

  const ready = (status: DashboardSectionStatus, content: React.ReactNode) => {
    if (status === "error") return <WebState kind="error" compact title={copy.sectionError} />;
    if (status === "loading") return <WebSkeleton rows={3} columns={3} />;
    if (status === "not_configured") return <p className="sov-muted">{copy.comingSoon}</p>;
    return content;
  };

  const isReady = (status: DashboardSectionStatus) => status === "available" || status === "demo";
  const rooms = summarizeRooms(snapshot.rooms.items);
  const rent = summarizeRent(snapshot.rent.items);
  const receivedShare = rent.total > 0 ? Math.round((rent.received / rent.total) * 100) : 0;
  const todo = TODO_ORDER.map((kind) => ({ kind, count: snapshot.todo.items.find((item) => item.kind === kind)?.count ?? 0 })).filter(
    (item) => item.count > 0,
  );
  const viewings = [...snapshot.viewings.items].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  // Pages these lead to do not exist yet: same place as the agent's "view all" links, disabled as coming soon.
  const viewAll = (label: string, onOpen?: () => void) =>
    onOpen ? (
      <button type="button" className="sov-link" onClick={onOpen}>
        {label}
      </button>
    ) : (
      <button type="button" className="sov-link" disabled aria-disabled="true" title={copy.comingSoon}>
        {label}
      </button>
    );
  const more = (total: number, shown: number) =>
    total > shown ? <p className="sov-more">{interpolate(copy.moreItems, { n: total - shown })}</p> : null;

  const roomMeta = (room: SelfOwnerRoom) => {
    if (room.state === "occupied") {
      return (
        <>
          <span>{interpolate(copy.tenantLine, { name: room.tenantName ?? "" })}</span>
          {room.leaseEndsAt ? <span>{interpolate(copy.leaseEnds, { date: day(room.leaseEndsAt, true) })}</span> : null}
        </>
      );
    }
    if (room.state === "listed") return <span>{interpolate(copy.interests, { n: room.interestCount ?? 0 })}</span>;
    return null;
  };

  return (
    <div
      className="sov-scroll"
      data-testid="self-owner-desktop-overview"
      data-theme={theme.mode}
      style={
        {
          "--aw-bg": theme.background,
          "--aw-surface": theme.surface,
          "--aw-ink": theme.screenTitle,
          "--aw-muted": theme.textSecondary,
          "--aw-border": theme.border,
          "--sov-accent": isDark ? tokens.colors.rolesOnDark.self_owner : tokens.colors.roles.self_owner,
        } as React.CSSProperties
      }
    >
      <WebContentContainer>
        <div className="sov-dashboard">
          {deletionScheduledFor ? (
            <p className="sov-deletion" role="alert">
              {t.mobile.account.deleteAccountOverview.replace(
                "{date}",
                new Date(deletionScheduledFor).toLocaleDateString(tag, { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" }),
              )}
            </p>
          ) : null}

          <header className="sov-intro">
            <div>
              <h1>{interpolate(copy.greeting, { name: snapshot.greetingName })}</h1>
              <p className="sov-date">{snapshot.localDateLabel}</p>
            </div>
            <button type="button" className="sov-action" disabled aria-disabled="true" title={copy.comingSoon}>
              <MobileIcon name="plus" size={16} color="currentColor" />
              {copy.addListing}
              <span className="sov-soon">{copy.comingSoon}</span>
            </button>
          </header>

          {snapshot.isDemoPreview ? (
            <p className="sov-demo" role="note">
              <MobileIcon name="info" size={16} color="currentColor" />
              {copy.demoNote}
            </p>
          ) : null}

          <Section
            title={copy.myRooms}
            className="sov-rooms"
            aside={
              <div className="sov-head-aside">
                {!isReady(snapshot.rooms.status) ? null : (
                  <p className="sov-counts">
                    <span>{interpolate(copy.roomCount, { n: rooms.total })}</span>
                    <span className="sov-count-occupied">{interpolate(copy.occupiedCount, { n: rooms.occupied })}</span>
                    <span>{interpolate(copy.vacantCount, { n: rooms.vacant })}</span>
                  </p>
                )}
                {viewAll(copy.viewAllRooms, onOpenRooms)}
              </div>
            }
          >
            {ready(
              snapshot.rooms.status,
              snapshot.rooms.items.length === 0 ? (
                <p className="sov-muted">{copy.noRooms}</p>
              ) : (
                <>
                <ul className="sov-room-grid">
                  {snapshot.rooms.items.slice(0, SELF_OWNER_PREVIEW.rooms).map((room) => (
                    <li key={room.id} className="sov-room" data-state={room.state}>
                      <span className="sov-room-state">{copy.roomState[room.state]}</span>
                      <h3 className="sov-room-title" title={room.title}>{room.title}</h3>
                      <p className="sov-room-project">{room.project}</p>
                      <p className="sov-room-rent">{interpolate(copy.perMonth, { amount: money(room.monthlyRent) })}</p>
                      <p className="sov-room-meta">{roomMeta(room)}</p>
                    </li>
                  ))}
                </ul>
                {more(snapshot.rooms.items.length, SELF_OWNER_PREVIEW.rooms)}
                </>
              ),
            )}
          </Section>

          <div className="sov-columns">
            <Section title={interpolate(copy.rentTitle, { period })} className="sov-panel sov-rent" aside={viewAll(copy.viewAllRent)}>
              {ready(
                snapshot.rent.status,
                snapshot.rent.items.length === 0 ? (
                  <p className="sov-muted">{copy.noRent}</p>
                ) : (
                  <>
                    <div className="sov-rent-summary">
                      <p className="sov-rent-received">
                        {interpolate(copy.received, { received: money(rent.received), total: money(rent.total) })}
                      </p>
                      <div className="sov-bar" aria-hidden="true">
                        <span style={{ width: `${receivedShare}%` }} />
                      </div>
                      {rent.overdue > 0 ? (
                        <p className="sov-rent-overdue">{interpolate(copy.outstanding, { amount: money(rent.overdue) })}</p>
                      ) : null}
                    </div>
                    <ul className="sov-rent-list">
                      {snapshot.rent.items.slice(0, SELF_OWNER_PREVIEW.rent).map((row) => (
                        <li key={row.id} className="sov-rent-row" data-state={row.state}>
                          <span className="sov-rent-room">
                            <strong title={row.roomTitle}>{row.roomTitle}</strong>
                            <span>{row.tenantName}</span>
                          </span>
                          <span className="sov-rent-amount">{money(row.amount)}</span>
                          <span className="sov-rent-state">
                            {row.state === "paid"
                              ? copy.rentState.paid
                              : row.state === "overdue"
                                ? interpolate(copy.rentState.overdue, { days: row.overdueDays ?? 0 })
                                : interpolate(copy.rentState.due, { date: day(row.dueDate, false) })}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {more(snapshot.rent.items.length, SELF_OWNER_PREVIEW.rent)}
                  </>
                ),
              )}
            </Section>

            <div className="sov-side">
              <Section title={copy.todoTitle} className="sov-panel">
                {ready(
                  snapshot.todo.status,
                  todo.length === 0 ? (
                    <p className="sov-muted">{copy.noTodo}</p>
                  ) : (
                    <ul className="sov-todo-list">
                      {todo.map((item) => (
                        <li key={item.kind} className="sov-todo-row" data-kind={item.kind}>
                          <span>{copy.todo[item.kind]}</span>
                          <strong>{item.count}</strong>
                        </li>
                      ))}
                    </ul>
                  ),
                )}
              </Section>
              <Section title={copy.viewingsTitle} className="sov-panel" aside={viewAll(copy.viewCalendar)}>
                {ready(
                  snapshot.viewings.status,
                  viewings.length === 0 ? (
                    <p className="sov-muted">{copy.noViewings}</p>
                  ) : (
                    <>
                    <ul className="sov-viewing-list">
                      {viewings.slice(0, SELF_OWNER_PREVIEW.viewings).map((item) => (
                        <li key={item.id} className="sov-viewing">
                          <time dateTime={item.startsAt}>{time(item.startsAt)}</time>
                          <span>
                            <strong>{item.roomTitle}</strong>
                            <span>{item.contactName}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                    {more(viewings.length, SELF_OWNER_PREVIEW.viewings)}
                    </>
                  ),
                )}
              </Section>
            </div>
          </div>
        </div>
      </WebContentContainer>
    </div>
  );
}
